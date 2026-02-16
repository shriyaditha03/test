import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2, Utensils, Beaker, Waves, Search, Layers, Eye, Calendar, Pencil } from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { formatDate, isTodayLocal, getNowLocal } from '@/lib/date-utils';

const iconMap: Record<string, any> = {
    'Feed': Utensils,
    'Treatment': Beaker,
    'Water Quality': Waves,
    'Animal Quality': Search,
    'Stocking': Layers,
    'Observation': Eye
};

const colorMap: Record<string, string> = {
    'Feed': 'text-orange-600 bg-orange-100',
    'Treatment': 'text-blue-600 bg-blue-100',
    'Water Quality': 'text-cyan-600 bg-cyan-100',
    'Animal Quality': 'text-rose-600 bg-rose-100',
    'Stocking': 'text-emerald-600 bg-emerald-100',
    'Observation': 'text-purple-600 bg-purple-100'
};

const UserDailyReport = () => {
    const navigate = useNavigate();
    const { activities, loading, fetchActivities } = useActivities();

    const [now, setNow] = useState(getNowLocal());

    useEffect(() => {
        fetchActivities();
        // Live clock update
        const timer = setInterval(() => setNow(getNowLocal()), 10000);
        return () => clearInterval(timer);
    }, [fetchActivities]);

    const todayActivities = activities.filter(a => isTodayLocal(a.created_at));

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="ocean-gradient p-4 sm:p-6 pb-12 rounded-b-3xl shadow-lg mb-6">
                <div className="max-w-md mx-auto">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard')}
                        className="text-white hover:bg-white/20 mb-4 -ml-2"
                    >
                        <ArrowLeft className="w-5 h-5 mr-1" /> Dashboard
                    </Button>
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                            <FileText className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Daily Report</h1>
                            <p className="opacity-80 flex items-center gap-1 text-sm">
                                <Calendar className="w-3 h-3" /> {formatDate(now, 'eeee, dd-MM-yyyy')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pb-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p>Loading activities...</p>
                    </div>
                ) : todayActivities.length === 0 ? (
                    <div className="bg-card rounded-2xl p-8 text-center border shadow-sm">
                        <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
                        </div>
                        <h2 className="text-lg font-semibold">No records found</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Activities recorded today will appear here for consolidation.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {todayActivities.map((act) => {
                            const Icon = iconMap[act.activity_type] || FileText;
                            const colors = colorMap[act.activity_type] || 'text-slate-600 bg-slate-100';

                            return (
                                <div key={act.id} className="bg-card rounded-2xl p-4 shadow-sm border flex items-start gap-4">
                                    <div className={`p-3 rounded-xl shrink-0 ${colors}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-foreground truncate">{act.activity_type}</h3>
                                            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                                {formatDate(new Date(act.created_at), 'hh:mm a')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-primary mb-1">
                                            {act.sections?.name || act.tanks?.sections?.name || 'Unknown'} - {act.tanks?.name || 'Unknown'}
                                        </p>

                                        {/* Activity Data Summary */}
                                        <div className="text-xs text-muted-foreground line-clamp-2">
                                            {act.activity_type === 'Feed' && (
                                                <>{act.data.feedType}: {act.data.feedQty} {act.data.feedUnit}</>
                                            )}
                                            {act.activity_type === 'Treatment' && (
                                                <>{act.data.treatmentType}: {act.data.treatmentDosage} {act.data.treatmentUnit}</>
                                            )}
                                            {act.activity_type === 'Water Quality' && (
                                                <>pH: {act.data.waterData?.pH || '—'}, Temp: {act.data.waterData?.Temperature || '—'}°C</>
                                            )}
                                            {act.data.comments && (
                                                <span className="block italic mt-1 font-normal italic">
                                                    "{act.data.comments}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => navigate(`/user/activity/${(act.activity_type || '').toLowerCase()}?edit=${act.id}`)}
                                        className="text-muted-foreground hover:text-primary hover:bg-primary/5 h-8 w-8 self-center shrink-0"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDailyReport;
