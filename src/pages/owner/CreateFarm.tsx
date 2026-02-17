import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Layers, Plus, ArrowRight, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TankConfig {
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
    name: string;
    tanks: TankConfig[];
}

interface AddressConfig {
    plotNumber: string;
    areaName: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    fullAddress: string;
    latitude: number | null;
    longitude: number | null;
    plotArea: number;
    plotLength: number;
    plotWidth: number;
}

const TankCountInput = ({ count, onChange }: { count: number, onChange: (val: number) => void }) => {
    const [val, setVal] = useState<string | number>(count);

    useEffect(() => {
        setVal(count);
    }, [count]);

    return (
        <Input
            type="number"
            min="0"
            max="100"
            value={val}
            onChange={(e) => {
                const v = e.target.value;
                setVal(v);
                const num = parseInt(v);
                if (!isNaN(num) && num >= 0) {
                    onChange(num);
                }
            }}
            onBlur={() => {
                if (val === '' || isNaN(Number(val))) {
                    setVal(count);
                }
            }}
            className="w-14 h-7 text-center font-bold text-xs bg-transparent border-none focus-visible:ring-0"
        />
    );
};

const CreateFarm = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const [farmName, setFarmName] = useState('');
    const [sectionCount, setSectionCount] = useState<number | string>(1);
    const [sections, setSections] = useState<SectionConfig[]>([]);

    const calculateTank = (tank: TankConfig): { volume: number, area: number } => {
        let volume = 0;
        let area = 0;
        const h = Number(tank.height) || 0;
        const l = Number(tank.length) || 0;
        const w = Number(tank.width) || 0;

        area = l * w;
        volume = area * h * 1000;

        return {
            volume: Math.round(volume * 100) / 100,
            area: Math.round(area * 100) / 100
        };
    };

    const handleContinueToSetup = () => {
        if (!farmName.trim()) {
            toast.error("Please enter a farm name");
            return;
        }

        // Initialize sections with 0 tanks by default as requested
        const count = Number(sectionCount) || 1;
        const newSections: SectionConfig[] = Array.from({ length: count }).map((_, sIdx) => ({
            name: `Section ${sIdx + 1}`,
            tanks: []
        }));

        setSections(newSections);
        setStep(2);
    };

    const addTank = (sIdx: number) => {
        setSections(prev => {
            const newSections = [...prev];
            const currentTanks = newSections[sIdx].tanks;
            const newTank: TankConfig = {
                name: `Tank ${currentTanks.length + 1}`,
                type: currentTanks[currentTanks.length - 1]?.type || 'FRP',
                shape: 'RECTANGLE',
                length: 0,
                width: 0,
                height: 0,
                radius: 0,
                volume: 0,
                area: 0
            };
            newSections[sIdx].tanks = [...currentTanks, newTank];
            return newSections;
        });
        toast.success(`Added new tank to ${sections[sIdx].name}`);
    };

    const addSection = () => {
        const newSection: SectionConfig = {
            name: `Section ${sections.length + 1}`,
            tanks: []
        };
        setSections(prev => [...prev, newSection]);
        toast.success("Added new section");
    };

    const updateTankCount = (sIdx: number, count: number) => {
        setSections(prev => {
            const newSections = [...prev];
            const currentTanks = newSections[sIdx].tanks;

            if (count > currentTanks.length) {
                // Add tanks
                const additionalCount = count - currentTanks.length;
                const additionalTanks = Array.from({ length: additionalCount }).map((_, i) => ({
                    name: `Tank ${currentTanks.length + i + 1}`,
                    type: (currentTanks[0]?.type || 'FRP') as 'FRP' | 'CONCRETE',
                    shape: 'RECTANGLE' as 'CIRCLE' | 'RECTANGLE',
                    length: 0,
                    width: 0,
                    height: 0,
                    radius: 0,
                    volume: 0,
                    area: 0
                }));
                newSections[sIdx].tanks = [...currentTanks, ...additionalTanks];
            } else if (count < currentTanks.length) {
                // Remove tanks
                newSections[sIdx].tanks = currentTanks.slice(0, Math.max(0, count));
            }

            return newSections;
        });
    };

    const updateTank = (sIdx: number, tIdx: number, updates: Partial<TankConfig>) => {
        setSections(prev => {
            const newSections = [...prev];
            const tank = { ...newSections[sIdx].tanks[tIdx], ...updates };

            // Re-calculate volume/area
            const { volume, area } = calculateTank(tank);
            newSections[sIdx].tanks[tIdx] = { ...tank, volume, area };

            return newSections;
        });
    };

    const handleSubmit = async () => {
        if (!user?.hatchery_id) return;

        // Validation: Ensure at least one tank exists total
        const totalTanks = sections.reduce((acc, s) => acc + s.tanks.length, 0);
        if (totalTanks === 0) {
            toast.error("Please add at least one tank to your farm");
            return;
        }

        try {
            setLoading(true);

            // 1. Create Farm
            const { data: farm, error: farmError } = await supabase
                .from('farms')
                .insert([{ hatchery_id: user.hatchery_id, name: farmName }])
                .select().single();

            if (farmError) throw farmError;

            // 2. Create Sections
            const { data: dbSections, error: sectionError } = await supabase
                .from('sections')
                .insert(sections.map(s => ({ farm_id: farm.id, name: s.name })))
                .select();

            if (sectionError) throw sectionError;

            // 3. Create Tanks
            const tanksToCreate: any[] = [];
            dbSections.forEach((dbSec, idx) => {
                const configTanks = sections[idx].tanks;
                configTanks.forEach(ct => {
                    tanksToCreate.push({
                        farm_id: farm.id,
                        section_id: dbSec.id,
                        name: ct.name,
                        type: ct.type,
                        shape: ct.shape,
                        length: ct.shape === 'RECTANGLE' ? ct.length : null,
                        width: ct.shape === 'RECTANGLE' ? ct.width : null,
                        height: ct.height,
                        radius: ct.shape === 'CIRCLE' ? ct.radius : null,
                        volume_litres: ct.volume,
                        area_sqm: ct.area
                    });
                });
            });

            if (tanksToCreate.length > 0) {
                const { error: tankError } = await supabase.from('tanks').insert(tanksToCreate);
                if (tankError) throw tankError;
            }

            toast.success("Farm created successfully!");
            navigate('/owner/dashboard');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to create farm");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 pb-24">
            <div className="max-w-3xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => step === 1 ? navigate('/owner/dashboard') : setStep(1)} className="pl-0 hover:bg-transparent">
                    <ArrowLeft className="w-5 h-5 mr-1" /> {step === 1 ? 'Back to Dashboard' : 'Back to General Info'}
                </Button>

                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold">Create New Farm</h1>
                        <p className="text-muted-foreground text-sm">
                            {step === 1 ? 'Step 1: Farm Structure' : 'Step 2: Tank Configuration'}
                        </p>
                    </div>
                    <div className="flex gap-1.5 pb-1">
                        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${step === 1 ? 'bg-primary' : 'bg-primary/20'}`} />
                        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-primary/20'}`} />
                    </div>
                </div>

                {step === 1 ? (
                    <Card className="rounded-2xl border shadow-sm overflow-hidden">
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="farmName" className="font-semibold">Farm Name</Label>
                                <Input
                                    id="farmName"
                                    value={farmName}
                                    onChange={(e) => setFarmName(e.target.value)}
                                    placeholder="e.g. Block A"
                                    className="h-12 text-md"
                                />
                                <p className="text-[10px] text-muted-foreground">Give your farm a memorable name</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">Number of Sections</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={sectionCount}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setSectionCount('');
                                        } else {
                                            const num = parseInt(val);
                                            if (!isNaN(num) && num >= 1 && num <= 50) {
                                                setSectionCount(num);
                                            }
                                        }
                                    }}
                                    className="h-12 text-md w-full"
                                />
                                <p className="text-[10px] text-muted-foreground">You can add more sections later</p>
                            </div>

                            <Button onClick={handleContinueToSetup} className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                                Continue to Tank Setup <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {sections.map((section, sIdx) => (
                            <div key={sIdx} className="space-y-4">
                                <div className="glass-card p-4 rounded-2xl border-l-4 border-l-primary flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <Input
                                                className="h-6 font-bold border-none bg-transparent p-0 text-lg focus-visible:ring-0 w-32"
                                                value={section.name}
                                                onChange={(e) => {
                                                    const newSections = [...sections];
                                                    newSections[sIdx].name = e.target.value;
                                                    setSections(newSections);
                                                }}
                                            />
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Configure Section</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addTank(sIdx)}
                                            className="h-9 px-3 border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-xl transition-all"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add Tank
                                        </Button>
                                        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-muted">
                                            <TankCountInput
                                                count={section.tanks.length}
                                                onChange={(val) => updateTankCount(sIdx, val)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 pl-4 border-l-2 border-dashed border-muted ml-5">
                                    {section.tanks.length === 0 ? (
                                        <div className="py-8 bg-muted/20 border border-dashed rounded-2xl text-center">
                                            <p className="text-xs text-muted-foreground font-medium italic">No tanks added to this section yet.</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => addTank(sIdx)}
                                                className="mt-2 text-primary hover:bg-primary/10 font-bold"
                                            >
                                                Click to add tank
                                            </Button>
                                        </div>
                                    ) : (
                                        section.tanks.map((tank, tIdx) => (
                                            <Card key={tIdx} className="rounded-2xl border shadow-sm overflow-hidden bg-card/40 transition-all hover:bg-card">
                                                <CardContent className="p-4 space-y-4">
                                                    <div className="flex justify-between items-center bg-muted/20 -mx-4 -mt-4 px-4 py-3 border-b mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                {tIdx + 1}
                                                            </div>
                                                            <Input
                                                                className="font-bold border-none bg-transparent p-0 text-sm focus-visible:ring-0 h-auto"
                                                                value={tank.name}
                                                                onChange={(e) => updateTank(sIdx, tIdx, { name: e.target.value })}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-md font-bold text-muted-foreground uppercase tracking-wider">
                                                            {section.name.charAt(0)}{sIdx + 1}.{tIdx + 1}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 pt-1">
                                                        <div className="space-y-1.5 text-center sm:text-left">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-tight">Material Type</Label>
                                                            <Select value={tank.type} onValueChange={(val: any) => updateTank(sIdx, tIdx, { type: val })}>
                                                                <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-muted shadow-none">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="FRP">FRP</SelectItem>
                                                                    <SelectItem value="CONCRETE">Concrete</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Height (m)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="h-10 text-xs rounded-xl shadow-none"
                                                                value={tank.height || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (e.target.value === '' || val >= 0) {
                                                                        updateTank(sIdx, tIdx, { height: e.target.value === '' ? 0 : val });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Length (m)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="h-10 text-xs rounded-xl shadow-none"
                                                                value={tank.length || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (e.target.value === '' || val >= 0) {
                                                                        updateTank(sIdx, tIdx, { length: e.target.value === '' ? 0 : val });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Width (m)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="h-10 text-xs rounded-xl shadow-none"
                                                                value={tank.width || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (e.target.value === '' || val >= 0) {
                                                                        updateTank(sIdx, tIdx, { width: e.target.value === '' ? 0 : val });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 grid grid-cols-2 gap-3 border-t border-dashed">
                                                        <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Total Volume</p>
                                                            <p className="font-extrabold text-primary text-md">{tank.volume.toLocaleString()} <span className="text-[10px] font-bold">LITRES</span></p>
                                                        </div>
                                                        <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Surface Area</p>
                                                            <p className="font-extrabold text-primary text-md">{tank.area.toLocaleString()} <span className="text-[10px] font-bold">m²</span></p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                onClick={addSection}
                                className="border-dashed border-2 py-8 w-full rounded-2xl text-muted-foreground hover:text-primary hover:border-primary transition-all flex flex-col gap-1"
                            >
                                <Plus className="w-6 h-6" />
                                <span className="font-bold text-sm uppercase tracking-wider">Add New Section</span>
                            </Button>
                        </div>

                        <div className="h-12" />

                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 shadow-2xl">
                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full max-w-lg mx-auto block h-14 rounded-2xl text-md font-bold shadow-xl shadow-primary/25 transition-all active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (
                                    <div className="flex items-center justify-center gap-2 uppercase tracking-wide">
                                        <Check className="w-6 h-6" /> Finalize & Create Farm
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateFarm;

