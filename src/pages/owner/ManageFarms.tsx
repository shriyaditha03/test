import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Warehouse, Layers, Cylinder, Plus, MoreVertical, Pencil, Trash2, Settings, Utensils, Beaker, Waves } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

interface Tank {
    id: string;
    section_id: string;
    name: string;
    type: string;
    volume_litres: number;
}

interface TankActivity {
    feed?: {
        qty: number;
        unit: string;
        time: string;
    };
    water?: {
        ph: number;
        salinity: number;
        do: number;
        temp: number;
        time: string;
    };
}

interface Section {
    id: string;
    farm_id: string;
    name: string;
    tanks: Tank[];
}

interface Farm {
    id: string;
    hatchery_id: string;
    name: string;
    sections: Section[];
}

const ManageFarms = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [farms, setFarms] = useState<Farm[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [tankActivities, setTankActivities] = useState<Record<string, TankActivity>>({});

    // Edit State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
    const [newName, setNewName] = useState('');

    // Delete State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingFarm, setDeletingFarm] = useState<Farm | null>(null);

    useEffect(() => {
        if (user?.hatchery_id) {
            fetchFarms();
        }
    }, [user]);

    const fetchFarms = async () => {
        try {
            // 1. Get Farms
            const { data: farmsData, error: farmError } = await supabase
                .from('farms')
                .select('*')
                .eq('hatchery_id', user!.hatchery_id)
                .order('created_at', { ascending: true });

            if (farmError) throw farmError;

            if (!farmsData || farmsData.length === 0) {
                setFarms([]);
                setLoading(false);
                return;
            }

            // 2. Get Sections for all these farms
            const farmIds = farmsData.map(f => f.id);
            const { data: sectionsData, error: sectionError } = await supabase
                .from('sections')
                .select('*')
                .in('farm_id', farmIds)
                .order('name');

            if (sectionError) throw sectionError;

            // 3. Get Tanks for all these sections
            const sectionIds = sectionsData?.map(s => s.id) || [];
            let tanksData: Tank[] = [];

            if (sectionIds.length > 0) {
                const { data: tData, error: tankError } = await supabase
                    .from('tanks')
                    .select('*')
                    .in('section_id', sectionIds)
                    .order('name');
                if (tankError) throw tankError;
                tanksData = tData || [];
            }

            // 4. Assemble Hierarchy
            const fullFarms = farmsData.map(farm => {
                const farmSections = sectionsData?.filter(s => s.farm_id === farm.id) || [];
                const sectionsWithTanks = farmSections.map(section => ({
                    ...section,
                    tanks: tanksData.filter(t => t.section_id === section.id)
                }));
                return { ...farm, sections: sectionsWithTanks };
            });

            setFarms(fullFarms);

            // 5. Fetch Latest Activities for all tanks (Optimization: fetch all recent and map)
            const { data: activityData } = await supabase
                .from('activity_logs')
                .select('tank_id, activity_type, data, created_at')
                .in('activity_type', ['Feed', 'Water Quality'])
                .order('created_at', { ascending: false });

            if (activityData) {
                const activitiesMap: Record<string, TankActivity> = {};

                // Process newest first to get "latest"
                activityData.forEach(log => {
                    if (!log.tank_id) return;

                    if (!activitiesMap[log.tank_id]) {
                        activitiesMap[log.tank_id] = {};
                    }

                    const tankAct = activitiesMap[log.tank_id];

                    if (log.activity_type === 'Feed' && !tankAct.feed) {
                        tankAct.feed = {
                            qty: log.data.feedQty,
                            unit: log.data.feedUnit,
                            time: log.created_at
                        };
                    } else if (log.activity_type === 'Water Quality' && !tankAct.water) {
                        tankAct.water = {
                            ph: log.data.waterData?.pH,
                            salinity: log.data.waterData?.Salinity,
                            do: log.data.waterData?.['Dissolved Oxygen'],
                            temp: log.data.waterData?.Temperature,
                            time: log.created_at
                        };
                    }
                });
                setTankActivities(activitiesMap);
            }
        } catch (error) {
            console.error('Error fetching farms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRenameFarm = async () => {
        if (!editingFarm || !newName.trim()) return;

        try {
            setActionLoading(true);
            const { error } = await supabase
                .from('farms')
                .update({ name: newName.trim() })
                .eq('id', editingFarm.id);

            if (error) throw error;

            toast.success("Farm renamed successfully");
            setIsEditDialogOpen(false);
            fetchFarms();
        } catch (error: any) {
            toast.error(error.message || "Failed to rename farm");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteFarm = async () => {
        if (!deletingFarm) return;

        try {
            setActionLoading(true);

            // 1. Delete associated Activity Logs (Manually handle cascade delete)
            const { error: logsError } = await supabase
                .from('activity_logs')
                .delete()
                .eq('farm_id', deletingFarm.id);

            if (logsError) throw logsError;

            // 2. Delete the Farm (Sections and Tanks will cascade automatically via DB constraints)
            const { error } = await supabase
                .from('farms')
                .delete()
                .eq('id', deletingFarm.id);

            if (error) throw error;

            toast.success("Farm deleted successfully");
            setIsDeleteDialogOpen(false);
            fetchFarms();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete farm");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 pb-20">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate('/owner/dashboard')} className="pl-0 hover:bg-transparent">
                        <ArrowLeft className="w-5 h-5 mr-1" /> Back to Dashboard
                    </Button>
                    <Button size="sm" onClick={() => navigate('/owner/create-farm')}>
                        <Plus className="w-4 h-4 mr-1" /> Add Farm
                    </Button>
                </div>

                <div>
                    <h1 className="text-2xl font-bold">Manage Farms</h1>
                    <p className="text-muted-foreground">Overview of your hatchery infrastructure</p>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Loading farms...</div>
                ) : farms.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-2xl border border-dashed">
                        <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <h3 className="text-lg font-semibold">No Farms Yet</h3>
                        <p className="text-muted-foreground mb-4">You haven't created any farms.</p>
                        <Button onClick={() => navigate('/owner/create-farm')}>Create First Farm</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {farms.map(farm => (
                            <div key={farm.id} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                                <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <Warehouse className="w-5 h-5 text-primary" />
                                            <h3 className="font-semibold text-lg">{farm.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 ml-auto">
                                            <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border font-bold">
                                                {farm.sections.length} SECTIONS
                                            </span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/owner/edit-farm/${farm.id}`)}>
                                                        <Settings className="mr-2 h-4 w-4" /> Edit Configuration
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingFarm(farm);
                                                        setNewName(farm.name);
                                                        setIsEditDialogOpen(true);
                                                    }}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600"
                                                        onClick={() => {
                                                            setDeletingFarm(farm);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <Accordion type="single" collapsible className="w-full">
                                        {farm.sections.map(section => (
                                            <AccordionItem key={section.id} value={section.id}>
                                                <AccordionTrigger className="hover:no-underline py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Layers className="w-4 h-4 text-blue-500" />
                                                        <span>{section.name}</span>
                                                        <span className="text-xs text-muted-foreground font-normal ml-2">
                                                            ({section.tanks.length} tanks)
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 pb-4">
                                                        {section.tanks.map(tank => (
                                                            <div key={tank.id} className="bg-secondary/30 p-3 rounded-xl flex flex-col gap-3 hover:bg-secondary/50 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 shrink-0">
                                                                        <Cylinder className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-sm text-foreground">{tank.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground uppercase opacity-80">{tank.type} • {tank.volume_litres?.toLocaleString()}L</p>
                                                                    </div>
                                                                </div>

                                                                {/* Tank Conditions */}
                                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                                    <div className="bg-background/50 rounded-lg p-2 flex flex-col justify-center border border-muted/50">
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase mb-1">
                                                                            <Waves className="w-3 h-3 text-cyan-500" /> Water
                                                                        </div>
                                                                        {tankActivities[tank.id]?.water ? (
                                                                            <div className="space-y-0.5">
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-muted-foreground">pH</span>
                                                                                    <span className="font-bold">{tankActivities[tank.id].water!.ph || '-'}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-muted-foreground">Sal</span>
                                                                                    <span className="font-bold">{tankActivities[tank.id].water!.salinity || '-'}</span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] italic text-muted-foreground/60">No data</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="bg-background/50 rounded-lg p-2 flex flex-col justify-center border border-muted/50">
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase mb-1">
                                                                            <Utensils className="w-3 h-3 text-orange-500" /> Feeding
                                                                        </div>
                                                                        {tankActivities[tank.id]?.feed ? (
                                                                            <div className="space-y-0.5">
                                                                                <span className="text-xs font-bold block">
                                                                                    {tankActivities[tank.id].feed!.qty} {tankActivities[tank.id].feed!.unit}
                                                                                </span>
                                                                                <span className="text-[9px] text-muted-foreground">
                                                                                    {new Date(tankActivities[tank.id].feed!.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] italic text-muted-foreground/60">No data</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Rename Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Farm</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Farm Name</Label>
                            <Input
                                id="name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Enter new farm name"
                                onKeyDown={(e) => e.key === 'Enter' && handleRenameFarm()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameFarm} disabled={actionLoading}>
                            {actionLoading ? "Renaming..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deletingFarm?.name}" and all its sections and tanks. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteFarm();
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={actionLoading}
                        >
                            {actionLoading ? "Deleting..." : "Delete Farm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ManageFarms;
