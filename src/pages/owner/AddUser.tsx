import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';

const AddUser = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [farms, setFarms] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        selectedFarms: [] as string[],
    });

    useEffect(() => {
        fetchFarms();
    }, [user]);

    const fetchFarms = async () => {
        if (!user?.hatchery_id) return;
        const { data } = await supabase
            .from('farms')
            .select('id, name')
            .eq('hatchery_id', user.hatchery_id);
        if (data) setFarms(data);
    };

    const handleFarmToggle = (farmId: string) => {
        setFormData(prev => {
            const selected = prev.selectedFarms.includes(farmId)
                ? prev.selectedFarms.filter(id => id !== farmId)
                : [...prev.selectedFarms, farmId];
            return { ...prev, selectedFarms: selected };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.hatchery_id) return;

        if (!formData.username.trim() || !formData.password.trim() || formData.selectedFarms.length === 0) {
            toast.error("Please fill in all fields and select at least one farm");
            return;
        }

        if (formData.password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        try {
            setLoading(true);

            // 1. Create Auth User using a secondary client (to not log out current owner)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error("Supabase URL or Anon Key is missing in environment variables.");
            }

            const { createClient } = await import('@supabase/supabase-js');
            const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            const emailToUse = `${formData.username.toLowerCase().trim().replace(/\s+/g, '')}@shrimphatchery.com`;

            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: emailToUse,
                password: formData.password,
            });

            if (authError) {
                console.error("Auth Signup Error:", authError);
                throw authError;
            }
            if (!authData.user) throw new Error("User creation failed in Supabase Auth.");

            // 2. Activate profile via RPC
            const { error: claimError } = await supabase.rpc('activate_user_profile', {
                username_input: formData.username.trim(),
                user_id_input: authData.user.id,
                email_input: emailToUse
            });

            if (claimError) {
                console.error("Profile claim error:", claimError);
            }

            // 3. Ensure profile exists and has correct info (Role, Hatchery, etc.)
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', formData.username.trim())
                .maybeSingle();

            let targetProfileId;

            if (existingProfile) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        auth_user_id: authData.user.id,
                        email: emailToUse,
                        role: 'worker',
                        hatchery_id: user?.hatchery_id
                    })
                    .eq('username', formData.username.trim());

                if (updateError) throw updateError;
                targetProfileId = existingProfile.id;
            } else {
                const { data: newProfile, error: profileError } = await supabase
                    .from('profiles')
                    .insert([{
                        username: formData.username.trim(),
                        role: 'worker',
                        hatchery_id: user?.hatchery_id,
                        full_name: formData.username,
                        auth_user_id: authData.user.id,
                        email: emailToUse
                    }])
                    .select()
                    .single();

                if (profileError) throw profileError;
                targetProfileId = newProfile.id;
            }

            // 4. Assign Farm Access (Sync selection)
            // First, clear existing access if any (prevents duplicate key errors)
            await supabase
                .from('farm_access')
                .delete()
                .eq('user_id', targetProfileId);

            if (formData.selectedFarms.length > 0) {
                const accessData = formData.selectedFarms.map(farmId => ({
                    user_id: targetProfileId,
                    farm_id: farmId
                }));

                const { error: accessError } = await supabase
                    .from('farm_access')
                    .insert(accessData);

                if (accessError) throw accessError;
            }

            toast.success(`User "${formData.username}" created successfully!`);
            navigate('/owner/dashboard');

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to create user");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 pb-20">
            <div className="max-w-md mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate('/owner/dashboard')} className="pl-0 hover:bg-transparent">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Back to Dashboard
                </Button>

                <div>
                    <h1 className="text-2xl font-bold">Add New User</h1>
                    <p className="text-muted-foreground">Create a user account and assign permissions</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-2xl shadow-sm border">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username *</Label>
                        <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="e.g. farm_worker_1"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Set Password *</Label>
                        <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Min. 6 characters"
                            required
                        />
                    </div>


                    <div className="space-y-3">
                        <Label>Assign Farm Access *</Label>
                        {farms.length === 0 ? (
                            <p className="text-sm text-yellow-600">No farms created yet.</p>
                        ) : (
                            <div className="grid gap-2">
                                {farms.map(farm => (
                                    <div key={farm.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent transition-colors">
                                        <Checkbox
                                            id={farm.id}
                                            checked={formData.selectedFarms.includes(farm.id)}
                                            onCheckedChange={() => handleFarmToggle(farm.id)}
                                        />
                                        <label
                                            htmlFor={farm.id}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                        >
                                            {farm.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || !formData.username}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add User'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default AddUser;
