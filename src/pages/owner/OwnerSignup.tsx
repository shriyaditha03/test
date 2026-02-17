import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPicker } from '@/components/MapPicker';
import { toast } from 'sonner';
import { Eye, EyeOff, Waves, Loader2, MapPin, LocateFixed } from 'lucide-react';

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

const OwnerSignup = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    const [formData, setFormData] = useState({
        hatcheryName: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });

    const [address, setAddress] = useState<AddressConfig>({
        plotNumber: '',
        areaName: '',
        street: '',
        city: '',
        state: '',
        pincode: '',
        fullAddress: '',
        latitude: null,
        longitude: null,
        plotArea: 0,
        plotLength: 0,
        plotWidth: 0
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleLocationSelect = useCallback(async (lat: number, lng: number, providedAddress?: string) => {
        setAddress(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            fullAddress: providedAddress || prev.fullAddress || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`
        }));

        setAddressLoading(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            if (res.ok) {
                const data = await res.json();
                const addr = data.address || {};

                // Helper to clean address values (remove Plus Codes, Ward numbers etc)
                const cleanValue = (val: string | undefined) => {
                    if (!val) return '';
                    const plusCodeRegex = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;
                    let cleaned = val.replace(plusCodeRegex, '').trim();
                    cleaned = cleaned.replace(/Ward\s*(No\s*)?\d+/i, '').trim();
                    // Also remove "Sector X", "Phase X" if it's too robotic, but maybe keep it?
                    // For now, let's keep it but remove robotic "No" prefixes
                    return cleaned.replace(/^,|,$/g, '').trim();
                };

                // Robust extraction
                const plotNo = cleanValue(addr.house_number || addr.housenumber || addr.building || addr.office || addr.shop || addr.place);
                const street = cleanValue(addr.road || addr.street || addr.pedestrian || addr.cycleway);
                const areaParts = [
                    addr.suburb,
                    addr.neighbourhood,
                    addr.residential,
                    addr.subdistrict,
                    addr.district,
                    addr.quarter,
                    addr.city_district,
                    addr.village,
                    addr.hamlet
                ].map(cleanValue).filter(Boolean);

                // Take the most specific area name that isn't empty
                const areaName = areaParts[0] || '';

                setAddress(prev => {
                    const rawDisplayName = data.display_name || '';
                    const newFullAddress = providedAddress || rawDisplayName || prev.fullAddress;

                    // Enhanced Coordinate Check & Construction
                    const isCoordsOnly = /^Lat:.*Lng:/.test(newFullAddress);
                    let constructedAddress = newFullAddress;

                    if (isCoordsOnly || (rawDisplayName.length < 20 && !rawDisplayName.includes(','))) {
                        constructedAddress = [plotNo, street, areaName, addr.city || addr.town || addr.village, addr.state, addr.postcode]
                            .filter(Boolean)
                            .join(', ');
                    }

                    // If the user's manual search was very specific (like "5310 Rome Dr"),
                    // and the API returned a generic neighborhood name, we should trust the user's query more
                    // for the display but keep the API's parsed parts for the DB.

                    return {
                        ...prev,
                        plotNumber: plotNo || prev.plotNumber,
                        street: street || prev.street,
                        areaName: areaName || prev.areaName,
                        city: addr.city || addr.town || addr.village || addr.municipality || prev.city,
                        state: addr.state || prev.state,
                        pincode: addr.postcode || prev.pincode,
                        fullAddress: constructedAddress || prev.fullAddress
                    };
                });
            }
        } catch (error) {
            console.error("Failed to fetch address:", error);
        } finally {
            setAddressLoading(false);
        }
    }, []);

    const handlePlotAreaSelect = useCallback((area: number, length: number, width: number) => {
        setAddress(prev => ({
            ...prev,
            plotArea: Math.round(area * 100) / 100,
            plotLength: Math.round(length * 100) / 100,
            plotWidth: Math.round(width * 100) / 100
        }));
        toast.info(`Plot area detected: ${area.toFixed(2)} sqm`);
    }, []);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        // Specific field validation with descriptive toasts
        if (!formData.hatcheryName) return toast.error("Hatchery Name is required");
        if (!formData.username) return toast.error("Username is required");
        if (!formData.password) return toast.error("Password is required");

        if (formData.password !== formData.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (!address.latitude || !address.longitude) {
            toast.error("Please pick a location on the map");
            setMapOpen(true);
            return;
        }

        try {
            setLoading(true);
            // ... (rest of handlesignup stays same)

            // 1. Sign Up Auth User
            const emailToUse = formData.email || `${formData.username.toLowerCase().replace(/\s+/g, '')}@shrimpit.local`;

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: emailToUse,
                password: formData.password,
                options: {
                    data: {
                        username: formData.username,
                        full_name: formData.username,
                    },
                },
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Signup failed");

            const userId = authData.user.id;

            // 2. Create Hatchery with Address Details
            const { data: hatcheryData, error: hatcheryError } = await supabase
                .from('hatcheries')
                .insert([{
                    name: formData.hatcheryName,
                    location: address.city || address.areaName || 'Unknown', // Fallback location string
                    address: address.fullAddress,
                    plot_number: address.plotNumber,
                    area_name: address.areaName,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    plot_area_sqm: address.plotArea,
                    plot_length_m: address.plotLength,
                    plot_width_m: address.plotWidth,
                    created_by: userId,
                }])
                .select()
                .single();

            if (hatcheryError) throw hatcheryError;

            // 3. Create Owner Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    auth_user_id: userId,
                    username: formData.username,
                    full_name: formData.username,
                    role: 'owner',
                    hatchery_id: hatcheryData.id,
                    email: emailToUse,
                    phone: formData.phone,
                }]);

            if (profileError) {
                console.error("Profile creation error:", profileError);
                throw new Error(`Failed to create profile: ${profileError.message}`);
            }

            toast.success("Hatchery Owner Account Created!");
            navigate('/login');

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Signup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen ocean-gradient flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-card rounded-2xl p-6 sm:p-8 shadow-2xl my-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Waves className="w-6 h-6 text-primary" />
                        <span className="text-xl font-bold">AquaNexus</span>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Owner Registration</h1>
                    <p className="text-muted-foreground text-sm">Create your Hatchery Account</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-semibold text-lg">Account Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hatcheryName">Hatchery Name *</Label>
                                <Input id="hatcheryName" value={formData.hatcheryName} onChange={handleChange} placeholder="e.g. Sunrise Aqua" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">Username *</Label>
                                <Input id="username" value={formData.username} onChange={handleChange} placeholder="e.g. raju_owner" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Optional)</Label>
                                <Input id="email" type="email" value={formData.email} onChange={handleChange} placeholder="For recovery" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone (Optional)</Label>
                                <Input id="phone" value={formData.phone} onChange={handleChange} placeholder="+91..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPass ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-muted-foreground">
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm *</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2 pt-2">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" /> Location & Address
                            </h3>
                            <Dialog open={mapOpen} onOpenChange={setMapOpen}>
                                <DialogTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                                        <LocateFixed className="w-4 h-4" /> Pick on Map
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-none shadow-2xl">
                                    <DialogHeader className="p-6 pb-2">
                                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                            <LocateFixed className="w-6 h-6 text-primary" />
                                            Select Hatchery Location & Plot Area
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="flex-1 min-h-0 relative bg-slate-50 border-y border-slate-100">
                                        <MapPicker
                                            onLocationSelect={handleLocationSelect}
                                            onPlotAreaSelect={handlePlotAreaSelect}
                                        />
                                    </div>
                                    <div className="p-4 bg-card flex justify-end gap-3">
                                        <Button type="button" variant="outline" onClick={() => setMapOpen(false)}>Cancel</Button>
                                        <Button type="button" className="px-8 shadow-lg shadow-primary/20" onClick={() => setMapOpen(false)}>Confirm Location</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>


                        <div className="space-y-2 relative">
                            <Label htmlFor="fullAddress" className="text-muted-foreground text-xs uppercase font-bold flex items-center gap-2">
                                Full Address {addressLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </Label>
                            <Textarea
                                id="fullAddress"
                                value={address.fullAddress}
                                onChange={(e) => setAddress(prev => ({ ...prev, fullAddress: e.target.value }))}
                                placeholder={addressLoading ? "Fetching address..." : "Complete address with landmark, city, etc."}
                                className="h-20"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-xl border border-dashed">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Plot Area (m²)</Label>
                                <Input
                                    type="number"
                                    value={address.plotArea || ''}
                                    onChange={(e) => setAddress(prev => ({ ...prev, plotArea: parseFloat(e.target.value) || 0 }))}
                                    className="h-8 text-sm bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Length (m)</Label>
                                <Input
                                    type="number"
                                    value={address.plotLength || ''}
                                    onChange={(e) => setAddress(prev => ({ ...prev, plotLength: parseFloat(e.target.value) || 0 }))}
                                    className="h-8 text-sm bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Width (m)</Label>
                                <Input
                                    type="number"
                                    value={address.plotWidth || ''}
                                    onChange={(e) => setAddress(prev => ({ ...prev, plotWidth: parseFloat(e.target.value) || 0 }))}
                                    className="h-8 text-sm bg-background"
                                />
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-primary/20" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Hatchery Account'}
                    </Button>

                    <div className="text-center mt-4">
                        <Link to="/login" className="text-sm text-primary hover:underline">
                            Already have an account? Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OwnerSignup;
