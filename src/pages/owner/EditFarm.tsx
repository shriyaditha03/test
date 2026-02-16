import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Layers, Cylinder, Plus, Check, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TankConfig {
    id?: string;
    name: string;
    type: 'FRP' | 'CONCRETE';
    shape: 'CIRCLE' | 'RECTANGLE';
    length: number;
    width: number;
    height: number;
    radius: number;
    volume: number;
    area: number;
}

interface SectionConfig {
    id?: string;
    name: string;
    tanks: TankConfig[];
}

const EditFarm = () => {
    const { id: farmId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [farmName, setFarmName] = useState('');
    const [sections, setSections] = useState<SectionConfig[]>([]);

    useEffect(() => {
        if (farmId) {
            fetchFarmData();
        }
    }, [farmId]);

    const fetchFarmData = async () => {
        try {
            setLoading(true);

            // 1. Get Farm
            const { data: farm, error: farmError } = await supabase
                .from('farms')
                .select('*')
                .eq('id', farmId)
                .single();

            if (farmError) throw farmError;
            setFarmName(farm.name);

            // 2. Get Sections
            const { data: sectionsData, error: sectionError } = await supabase
                .from('sections')
                .select('*')
                .eq('farm_id', farmId)
                .order('created_at');

            if (sectionError) throw sectionError;

            // 3. Get Tanks
            const { data: tanksData, error: tankError } = await supabase
                .from('tanks')
                .select('*')
                .eq('farm_id', farmId)
                .order('name');

            if (tankError) throw tankError;

            // 4. Map to local state
            const mappedSections: SectionConfig[] = sectionsData.map(s => ({
                id: s.id,
                name: s.name,
                tanks: tanksData
                    .filter(t => t.section_id === s.id)
                    .map(t => ({
                        id: t.id,
                        name: t.name,
                        type: t.type as 'FRP' | 'CONCRETE',
                        shape: t.shape as 'CIRCLE' | 'RECTANGLE',
                        length: t.length || 0,
                        width: t.width || 0,
                        height: t.height || 0,
                        radius: t.radius || 0,
                        volume: t.volume_litres || 0,
                        area: t.area_sqm || 0
                    }))
            }));

            setSections(mappedSections);
        } catch (error: any) {
            console.error('Error fetching farm:', error);
            toast.error("Failed to load farm details");
            navigate('/owner/farms');
        } finally {
            setLoading(false);
        }
    };

    const calculateTank = (tank: TankConfig): { volume: number, area: number } => {
        let volume = 0;
        let area = 0;
        const h = Number(tank.height) || 0;

        if (tank.shape === 'RECTANGLE') {
            const l = Number(tank.length) || 0;
            const w = Number(tank.width) || 0;
            area = l * w;
            volume = area * h * 1000;
        } else {
            const r = Number(tank.radius) || 0;
            area = Math.PI * Math.pow(r, 2);
            volume = area * h * 1000;
        }

        return {
            volume: Math.round(volume * 100) / 100,
            area: Math.round(area * 100) / 100
        };
    };

    const updateTank = (sIdx: number, tIdx: number, updates: Partial<TankConfig>) => {
        setSections(prev => {
            const newSections = [...prev];
            const tank = { ...newSections[sIdx].tanks[tIdx], ...updates };
            const { volume, area } = calculateTank(tank);
            newSections[sIdx].tanks[tIdx] = { ...tank, volume, area };
            return newSections;
        });
    };

    const addSection = () => {
        setSections(prev => [
            ...prev,
            { name: `New Section ${prev.length + 1}`, tanks: [] }
        ]);
    };

    const removeSection = (sIdx: number) => {
        setSections(prev => prev.filter((_, idx) => idx !== sIdx));
    };

    const addTank = (sIdx: number) => {
        setSections(prev => {
            const newSections = [...prev];
            newSections[sIdx].tanks.push({
                name: `Tank ${newSections[sIdx].tanks.length + 1}`,
                type: 'FRP',
                shape: 'CIRCLE',
                length: 0,
                width: 0,
                height: 0,
                radius: 0,
                volume: 0,
                area: 0
            });
            return newSections;
        });
    };

    const removeTank = (sIdx: number, tIdx: number) => {
        setSections(prev => {
            const newSections = [...prev];
            newSections[sIdx].tanks = newSections[sIdx].tanks.filter((_, idx) => idx !== tIdx);
            return newSections;
        });
    };

    const handleSubmit = async () => {
        if (!user?.hatchery_id || !farmId) return;
        if (!farmName.trim()) {
            toast.error("Farm name is required");
            return;
        }

        try {
            setSaving(true);

            // 1. Update Farm Name
            const { error: farmError } = await supabase
                .from('farms')
                .update({ name: farmName })
                .eq('id', farmId);
            if (farmError) throw farmError;

            // Get existing IDs from DB to detect deletions
            const { data: dbSections } = await supabase.from('sections').select('id').eq('farm_id', farmId);
            const { data: dbTanks } = await supabase.from('tanks').select('id').eq('farm_id', farmId);

            const activeSectionIds = sections.map(s => s.id).filter(Boolean) as string[];
            const activeTankIds = sections.flatMap(s => s.tanks.map(t => t.id)).filter(Boolean) as string[];

            // 2. Perform Deletions
            const sectionsToDelete = dbSections?.filter(s => !activeSectionIds.includes(s.id)).map(s => s.id) || [];
            const tanksToDelete = dbTanks?.filter(t => !activeTankIds.includes(t.id)).map(t => t.id) || [];

            if (tanksToDelete.length > 0) {
                // Delete associated logs first
                await supabase.from('activity_logs').delete().in('tank_id', tanksToDelete);
                await supabase.from('tanks').delete().in('id', tanksToDelete);
            }
            if (sectionsToDelete.length > 0) {
                // Delete associated logs first
                await supabase.from('activity_logs').delete().in('section_id', sectionsToDelete);
                await supabase.from('sections').delete().in('id', sectionsToDelete);
            }

            // 3. Process Sections and Tanks (Upsert)
            for (const section of sections) {
                let currentSectionId = section.id;

                if (!currentSectionId) {
                    // Create new section
                    const { data: newSec, error: secErr } = await supabase
                        .from('sections')
                        .insert([{ farm_id: farmId, name: section.name }])
                        .select().single();
                    if (secErr) throw secErr;
                    currentSectionId = newSec.id;
                } else {
                    // Update existing section
                    const { error: secErr } = await supabase
                        .from('sections')
                        .update({ name: section.name })
                        .eq('id', currentSectionId);
                    if (secErr) throw secErr;
                }

                // Upsert Tanks for this section
                const tanksToUpsert = section.tanks.map(tank => ({
                    id: tank.id, // If it has an ID, Supabase will update
                    farm_id: farmId,
                    section_id: currentSectionId,
                    name: tank.name,
                    type: tank.type,
                    shape: tank.shape,
                    length: tank.shape === 'RECTANGLE' ? tank.length : null,
                    width: tank.shape === 'RECTANGLE' ? tank.width : null,
                    height: tank.height,
                    radius: tank.shape === 'CIRCLE' ? tank.radius : null,
                    volume_litres: tank.volume,
                    area_sqm: tank.area
                }));

                const { error: tankErr } = await supabase.from('tanks').upsert(tanksToUpsert);
                if (tankErr) throw tankErr;
            }

            toast.success("Farm configuration updated!");
            navigate('/owner/farms');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 pb-24">
            <div className="max-w-3xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate('/owner/farms')} className="pl-0 hover:bg-transparent">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Back to Manage Farms
                </Button>

                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold">Edit Farm Configuration</h1>
                        <p className="text-muted-foreground">Modify sections and individual tanks</p>
                    </div>
                </div>

                <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                    <CardContent className="p-6">
                        <div className="space-y-2">
                            <Label htmlFor="farmName">Farm Name</Label>
                            <Input
                                id="farmName"
                                value={farmName}
                                onChange={(e) => setFarmName(e.target.value)}
                                placeholder="e.g. Block A"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    {sections.map((section, sIdx) => (
                        <div key={section.id || `new-sec-${sIdx}`} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <Input
                                        className="h-9 font-bold bg-transparent border-none text-lg p-0 focus-visible:ring-0 w-auto"
                                        value={section.name}
                                        onChange={(e) => {
                                            const newSections = [...sections];
                                            newSections[sIdx].name = e.target.value;
                                            setSections(newSections);
                                        }}
                                    />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeSection(sIdx)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4 mr-1" /> Remove Section
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                {section.tanks.map((tank, tIdx) => (
                                    <Card key={tank.id || `new-tank-${tIdx}`} className="rounded-2xl border-none shadow-md overflow-hidden bg-card/50">
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <Input
                                                    className="font-bold border-none bg-transparent p-0 text-md focus-visible:ring-0 w-1/2"
                                                    value={tank.name}
                                                    onChange={(e) => updateTank(sIdx, tIdx, { name: e.target.value })}
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => removeTank(sIdx, tIdx)} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Type</Label>
                                                    <Select value={tank.type} onValueChange={(val: any) => updateTank(sIdx, tIdx, { type: val })}>
                                                        <SelectTrigger className="h-9 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="FRP">FRP</SelectItem>
                                                            <SelectItem value="CONCRETE">Concrete</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Shape</Label>
                                                    <Select value={tank.shape} onValueChange={(val: any) => updateTank(sIdx, tIdx, { shape: val })}>
                                                        <SelectTrigger className="h-9 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="CIRCLE">Circular</SelectItem>
                                                            <SelectItem value="RECTANGLE">Rectangular</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className={`grid ${tank.shape === 'CIRCLE' ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Height (m)</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-9 text-xs"
                                                        value={tank.height || ''}
                                                        onChange={(e) => updateTank(sIdx, tIdx, { height: Number(e.target.value) })}
                                                    />
                                                </div>
                                                {tank.shape === 'CIRCLE' ? (
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Radius (m)</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-9 text-xs"
                                                            value={tank.radius || ''}
                                                            onChange={(e) => updateTank(sIdx, tIdx, { radius: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Length (m)</Label>
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs"
                                                                value={tank.length || ''}
                                                                onChange={(e) => updateTank(sIdx, tIdx, { length: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Width (m)</Label>
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs"
                                                                value={tank.width || ''}
                                                                onChange={(e) => updateTank(sIdx, tIdx, { width: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className={`pt-1 grid ${tank.shape === 'CIRCLE' ? 'grid-cols-2' : 'grid-cols-3'} gap-3 border-t border-dashed mt-1`}>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Volume</p>
                                                    <p className="font-bold text-primary text-sm">{tank.volume.toLocaleString()} L</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Area</p>
                                                    <p className="font-bold text-primary text-sm">{tank.area.toLocaleString()} m²</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" onClick={() => addTank(sIdx)} className="border-dashed h-12 rounded-xl border-2 hover:bg-muted/50">
                                    <Plus className="w-4 h-4 mr-2" /> Add Tank to {section.name}
                                </Button>
                            </div>
                        </div>
                    ))}

                    <Button onClick={addSection} className="w-full h-14 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all">
                        <Plus className="w-5 h-5 mr-2" /> Add New Section
                    </Button>
                </div>

                <div className="h-10" />

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-center">
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="w-full max-w-lg h-12 rounded-xl text-md font-bold shadow-xl shadow-primary/20"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                            <div className="flex items-center justify-center gap-2">
                                <Check className="w-5 h-5" /> Save Changes
                            </div>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditFarm;
