import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, Calendar, Info, Filter, BarChart2, Waves, Beaker, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, toLocal, getTodayStr, getDateRangeUTC } from '@/lib/date-utils';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const OwnerActivityLogs = () => {
    const { type } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);

    // Date Range - Defaults to "Today"
    const [fromDate, setFromDate] = useState(getTodayStr());
    const [toDate, setToDate] = useState(getTodayStr());

    useEffect(() => {
        if (user?.hatchery_id && type) {
            fetchLogs();
        }
    }, [user, type, fromDate, toDate]);

    const fetchLogs = async () => {
        if (!type || !user?.hatchery_id) return;

        try {
            setLoading(true);
            const typeMap: Record<string, string> = {
                'feed': 'Feed',
                'treatment': 'Treatment',
                'water': 'Water Quality',
                'animal': 'Animal Quality',
                'stocking': 'Stocking',
                'observation': 'Observation'
            };
            const dbType = typeMap[type?.toLowerCase() || ''] || type;

            const { startDate, endDate } = getDateRangeUTC(fromDate, toDate);

            const { data, error } = await supabase
                .from('activity_logs')
                .select(`
                    *,
                    tanks (
                        name
                    ),
                    sections (
                        name
                    ),
                    farms (
                        name
                    )
                `)
                .eq('activity_type', dbType)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setLogs(data || []);
        } catch (err: any) {
            console.error('Error fetching logs:', err);
            toast.error('Failed to load activity logs');
        } finally {
            setLoading(false);
        }
    };

    const getChartData = () => {
        if (!logs.length) return { data: [], tanks: [], summary: null };

        const dataByDate: Record<string, any> = {};
        const locationKeys = new Set<string>();
        let grandTotal = 0;
        let mostActiveTank = { name: '', value: 0 };
        const tankTotals: Record<string, number> = {};

        // 1. First pass: Get all unique location keys (Farm - Section - Tank)
        logs.forEach(log => {
            const farmName = log.farms?.name || 'Unknown Farm';
            const sectionName = log.sections?.name || 'Unknown Section';
            const tankName = log.tanks?.name || 'Unknown Tank';
            const locationKey = `${farmName} - ${sectionName} - ${tankName}`;
            locationKeys.add(locationKey);
        });
        const activeLocationsList = Array.from(locationKeys);

        // 2. Aggregate data
        logs.forEach(log => {
            const dateStr = formatDate(log.created_at, 'dd MMM');
            const farmName = log.farms?.name || 'Unknown Farm';
            const sectionName = log.sections?.name || 'Unknown Section';
            const tankName = log.tanks?.name || 'Unknown Tank';
            const locationKey = `${farmName} - ${sectionName} - ${tankName}`;

            if (!dataByDate[dateStr]) {
                dataByDate[dateStr] = { date: dateStr };
                activeLocationsList.forEach(loc => dataByDate[dateStr][loc] = 0);
            }

            let value = 0;
            const logData = log.data || {};
            const typeLower = type?.toLowerCase();

            if (typeLower === 'feed') {
                value = parseFloat(logData.feedQty) || 0;
            } else if (typeLower === 'treatment') {
                value = parseFloat(logData.treatmentDosage) || 0;
            } else if (typeLower === 'stocking') {
                value = parseFloat(logData.naupliiStocked) || 0;
            } else if (typeLower === 'observation') {
                value = parseFloat(logData.deadAnimals) || 0;
            } else if (typeLower === 'water') {
                value = parseFloat(logData.waterData?.pH) || 0;
            }

            dataByDate[dateStr][locationKey] += value;
            grandTotal += value;
            tankTotals[locationKey] = (tankTotals[locationKey] || 0) + value;

            if (tankTotals[locationKey] > mostActiveTank.value) {
                mostActiveTank = { name: locationKey, value: tankTotals[locationKey] };
            }
        });

        const chartDataArr = Object.values(dataByDate);
        const avg = chartDataArr.length > 0 ? grandTotal / chartDataArr.length : 0;

        // Calculate trend (last value vs average)
        const lastEntry = chartDataArr[chartDataArr.length - 1];
        let lastTotal = 0;
        if (lastEntry) {
            activeLocationsList.forEach(loc => {
                lastTotal += lastEntry[loc] || 0;
            });
        }

        // Only show trend if we have more than one data point or a range
        const isSingleDay = fromDate === toDate;
        const trendPct = !isSingleDay && avg > 0 ? ((lastTotal - avg) / avg) * 100 : 0;

        return {
            data: chartDataArr,
            tanks: activeLocationsList,
            summary: {
                total: grandTotal.toFixed(2),
                avg: avg.toFixed(2),
                mostActive: mostActiveTank.name || 'N/A',
                trend: trendPct.toFixed(1)
            }
        };
    };

    const { data: chartData, tanks: activeTanks, summary } = getChartData();

    // Diverse color palette for scalability
    const CHART_COLORS = [
        '#0ea5e9', // Sky Blue
        '#8b5cf6', // Violet
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#ef4444', // Red
        '#6366f1', // Indigo
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#f97316', // Orange
    ];

    // Create config for each tank
    const chartConfig: ChartConfig = {};
    activeTanks.forEach((tank, i) => {
        chartConfig[tank] = {
            label: tank,
            color: CHART_COLORS[i % CHART_COLORS.length],
        };
    });

    const formatActivityData = (data: any) => {
        if (!data) return '-';
        const typeLower = type?.toLowerCase();

        if (typeLower === 'feed') {
            return `${data.feedType || 'N/A'} - ${data.feedQty || '0'} ${data.feedUnit || 'kg'}`;
        } else if (typeLower === 'treatment') {
            return `${data.treatmentType || 'N/A'} - ${data.treatmentDosage || '0'} ${data.treatmentUnit || 'ml'}`;
        } else if (typeLower === 'stocking') {
            return `Nauplii: ${data.naupliiStocked || '0'}, Source: ${data.source || 'N/A'}`;
        } else if (typeLower === 'observation') {
            return `Dead Animals: ${data.deadAnimals || '0'}, Survival Rate: ${data.survivalRate || 'N/A'}%`;
        } else if (typeLower === 'water') {
            const waterData = data.waterData || {};
            const params = Object.entries(waterData)
                .filter(([_, value]) => value)
                .map(([key, value]) => `${key}: ${value}`)
                .slice(0, 3)
                .join(', ');
            return params || 'No parameters recorded';
        } else if (typeLower === 'animal') {
            return `Size: ${data.animalSize || 'N/A'}`;
        }

        return '-';
    };

    const getStatLabel = () => {
        const typeLower = type?.toLowerCase();
        if (typeLower === 'feed') return { total: 'Total Feed', unit: 'kg', icon: <Waves className="w-4 h-4" /> };
        if (typeLower === 'treatment') return { total: 'Total Dosage', unit: 'ml', icon: <Beaker className="w-4 h-4" /> };
        if (typeLower === 'stocking') return { total: 'Total Stocked', unit: 'qty', icon: <Layers className="w-4 h-4" /> };
        if (typeLower === 'water') return { total: 'Avg pH', unit: '', icon: <Waves className="w-4 h-4" /> };
        if (typeLower === 'observation') return { total: 'Total Dead', unit: 'qty', icon: <Info className="w-4 h-4" /> };
        return { total: 'Total', unit: '', icon: <BarChart2 className="w-4 h-4" /> };
    };

    const stats = getStatLabel();

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="ocean-gradient p-4 pb-6 rounded-b-2xl shadow-lg">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/owner/dashboard')}
                        className="text-primary-foreground hover:bg-primary-foreground/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold text-primary-foreground capitalize leading-none">
                            {type} Reports
                        </h1>
                        <p className="text-[10px] text-primary-foreground/70 font-medium">
                            {fromDate === toDate ? `Today, ${formatDate(new Date(), 'dd MMM')}` : `${formatDate(fromDate, 'dd MMM')} - ${formatDate(toDate, 'dd MMM')}`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6 max-w-7xl mx-auto">
                {/* Date Range Filter */}
                <div className="glass-card p-4 rounded-2xl border shadow-sm">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 space-y-1.5 w-full">
                            <Label className="text-xs font-semibold">From Date</Label>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="flex-1 space-y-1.5 w-full">
                            <Label className="text-xs font-semibold">To Date</Label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <Button
                            onClick={fetchLogs}
                            className="h-10 gap-2 shrink-0"
                            disabled={loading}
                        >
                            <Filter className="w-4 h-4" />
                            Apply Filter
                        </Button>

                        {(fromDate !== getTodayStr() || toDate !== getTodayStr()) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFromDate(getTodayStr());
                                    setToDate(getTodayStr());
                                    // fetchLogs will be triggered by useEffect
                                }}
                                className="h-10 border-dashed hover:bg-muted"
                            >
                                Reset to Today
                            </Button>
                        )}
                    </div>
                </div>

                {/* Quick Stats Grid */}
                {!loading && summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="rounded-2xl border shadow-sm overflow-hidden bg-primary/5 border-primary/10">
                            <CardContent className="p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                    {stats.icon}
                                    {stats.total}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold">{summary.total}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground">{stats.unit}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border shadow-sm overflow-hidden">
                            <CardContent className="p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                    <BarChart2 className="w-4 h-4 text-primary" />
                                    Daily Avg
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold">{summary.avg}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground">{stats.unit}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border shadow-sm overflow-hidden">
                            <CardContent className="p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                    <Info className="w-4 h-4 text-primary" />
                                    Trend vs Avg
                                </p>
                                <div className="flex items-center gap-1">
                                    <span className={`text-xl font-bold ${parseFloat(summary.trend) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {parseFloat(summary.trend) > 0 ? '+' : ''}{summary.trend}%
                                    </span>
                                    <span className="text-[10px] font-medium text-muted-foreground">in current frame</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border shadow-sm overflow-hidden">
                            <CardContent className="p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                    <Waves className="w-4 h-4 text-primary" />
                                    Busiest Tank
                                </p>
                                <p className="text-sm font-bold truncate max-w-full" title={summary.mostActive}>
                                    {summary.mostActive.split(' - ').pop()}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                    {summary.mostActive.split(' - ').slice(0, 2).join(' - ')}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Visualizations Section */}
                {!loading && logs.length > 0 && ['feed', 'water', 'observation', 'treatment', 'stocking'].includes(type?.toLowerCase() || '') && (
                    <Card className="rounded-2xl border shadow-sm overflow-hidden border-t-4 border-t-primary">
                        <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-primary" />
                                    Trend Analysis
                                </CardTitle>
                                <CardDescription className="text-[10px]">
                                    {fromDate === toDate ? "Daily distribution across tanks" : `Consolidated trends from ${formatDate(fromDate, 'dd MMM')} to ${formatDate(toDate, 'dd MMM')}`}
                                </CardDescription>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${fromDate === toDate ? 'bg-blue-50 text-blue-700 border-blue-100' : parseFloat(summary?.trend || '0') >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                {fromDate === toDate ? 'Individual Day' : parseFloat(summary?.trend || '0') >= 0 ? 'Improving Trend' : 'Declining Trend'}
                            </div>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-4">
                            <ChartContainer config={chartConfig} className="h-[250px] w-full mt-2">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        {activeTanks.map((location, i) => (
                                            <linearGradient key={`grad-${location}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        fontSize={10}
                                        fontWeight="bold"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        fontSize={10}
                                        tickFormatter={(val) => val === 0 ? '0' : val.toString()}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingBottom: '15px' }}
                                    />
                                    {activeTanks.map((location, i) => (
                                        <Area
                                            key={location}
                                            type="monotone"
                                            dataKey={location}
                                            stroke={chartConfig[location]?.color}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill={`url(#grad-${i})`}
                                            animationDuration={1500}
                                        />
                                    ))}
                                </AreaChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p>Loading records...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <h3 className="text-lg font-semibold">No Records Found</h3>
                        <p className="text-muted-foreground">No {type} activities found in this range.</p>
                    </div>
                ) : (
                    <div className="glass-card rounded-2xl border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-bold">Date & Time</TableHead>
                                        <TableHead className="font-bold">Farm</TableHead>
                                        <TableHead className="font-bold">Section</TableHead>
                                        <TableHead className="font-bold">Tank</TableHead>
                                        <TableHead className="font-bold">Activity Details</TableHead>
                                        <TableHead className="font-bold">Comments</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-muted/30">
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold">
                                                        {formatDate(log.created_at, 'dd-MM-yyyy')}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatDate(log.created_at, 'hh:mm a')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-xs">
                                                {log.farms?.name || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-[10px] uppercase">
                                                {log.sections?.name || 'N/A'}
                                            </TableCell>
                                            <TableCell className="font-medium text-xs">
                                                {log.tanks?.name || 'N/A'}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <span className="text-xs font-medium">
                                                    {formatActivityData(log.data)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <span className="text-xs text-muted-foreground italic">
                                                    {log.data?.comments || '-'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OwnerActivityLogs;
