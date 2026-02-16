import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import RatingScale from '@/components/RatingScale';
import StockingForm from '@/components/StockingForm';
import ObservationForm from '@/components/ObservationForm';
import { toast } from 'sonner';
import { formatDate, getNowLocal, getTodayStr } from '@/lib/date-utils';
import { useActivities } from '@/hooks/useActivities';

const TANKS = ['T1', 'T2', 'T3', 'T4'];
const ACTIVITIES = ['Feed', 'Treatment', 'Water Quality', 'Animal Quality', 'Stocking', 'Observation'] as const;
type ActivityType = typeof ACTIVITIES[number];

const FEED_TYPES = ['Starter Feed', 'Grower Feed', 'Finisher Feed', 'Supplement'];
const FEED_UNITS = ['kg', 'gms'];
const TREATMENT_TYPES = ['Probiotics', 'Antibiotics', 'Mineral Supplement', 'Disinfectant', 'Vitamin'];
const TREATMENT_UNITS = ['ml', 'L', 'gms', 'kg', 'ppm'];

const ANIMAL_RATING_FIELDS = [
  { key: 'swimmingActivity', label: 'Swimming Activity' },
  { key: 'homogenousStage', label: 'Homogenous Stage', required: true },
  { key: 'hepatopancreas', label: 'Hepatopancreas' },
  { key: 'intestinalContent', label: 'Intestinal Content' },
  { key: 'fecalStrings', label: 'Fecal Strings' },
  { key: 'necrosis', label: 'Necrosis' },
  { key: 'deformities', label: 'Deformities' },
  { key: 'fouling', label: 'Fouling', required: true },
  { key: 'epibionts', label: 'Epibionts' },
  { key: 'muscleGutRatio', label: 'Muscle Gut Ratio' },
  { key: 'size', label: 'Size', required: true },
  { key: 'nextStageConversion', label: 'Time taken for Next Stage Conversion' },
];

const waterFields = [
  'Salinity', 'pH', 'Dissolved Oxygen', 'Alkalinity', 'Chlorine Content',
  'Iron Content', 'Turbidity', 'Temperature', 'Hardness', 'Ammonia',
  'Nitrate [NO3]', 'Nitrite [NO2]', 'Vibrio Count', 'Yellow Green Bacteria',
  'Luminescence',
];

const WATER_QUALITY_RANGES: Record<string, string> = {
  'Salinity': '[10 - 35 ppt]',
  'pH': '[7.5 - 8.5]',
  'Dissolved Oxygen': '[> 4.0 ppm]',
  'Alkalinity': '[80 - 200 ppm]',
  'Chlorine Content': '[< 0.1 ppm]',
  'Iron Content': '[< 0.5 ppm]',
  'Turbidity': '[30 - 45 cm]',
  'Temperature': '[26 - 32 °C]',
  'Hardness': '[> 1000 ppm]',
  'Ammonia': '[< 0.1 ppm]',
  'Nitrate [NO3]': '[< 20 ppm]',
  'Nitrite [NO2]': '[< 0.25 ppm]',
  'Vibrio Count': '[< 1x10³ CFU/mL]',
  'Yellow Green Bacteria': '[< 1x10² CFU/mL]',
  'Luminescence': '[Nil]',
};

const RecordActivity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { type } = useParams();
  const editId = searchParams.get('edit');
  const { addActivity, updateActivity } = useActivities();

  const [loading, setLoading] = useState(false);
  const [availableTanks, setAvailableTanks] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [date, setDate] = useState(getTodayStr());
  const [time, setTime] = useState(formatDate(getNowLocal(), 'HH:mm'));
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(formatDate(getNowLocal(), 'a') as 'AM' | 'PM');
  const [isLiveTime, setIsLiveTime] = useState(!editId); // Auto-update time if not editing
  const [tankId, setTankId] = useState('');
  const [activity, setActivity] = useState<ActivityType | ''>('');

  // Live Time Update Effect
  useEffect(() => {
    if (!isLiveTime || editId) return;

    const timer = setInterval(() => {
      const now = getNowLocal();
      setDate(getTodayStr());
      setTime(formatDate(now, 'HH:mm'));
      setAmpm(formatDate(now, 'a') as 'AM' | 'PM');
    }, 10000); // Update every 10 seconds to keep it fresh

    return () => clearInterval(timer);
  }, [isLiveTime, editId]);

  useEffect(() => {
    fetchTanks();
  }, [user]);

  const fetchTanks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch tanks from farms the user has access to
      const { data: accessData, error: accessError } = await supabase
        .from('farm_access')
        .select(`
          farm_id,
          farms (
            name,
            sections (
              id,
              name,
              tanks (id, name)
            )
          )
        `)
        .eq('user_id', user.id);

      if (accessError) throw accessError;

      // Group tanks by section to avoid flat list & duplicates
      const sectionsMap = new Map<string, any>();

      accessData?.forEach((access: any) => {
        if (access.farms?.sections) {
          access.farms.sections.forEach((section: any) => {
            if (section.tanks && section.tanks.length > 0) {
              if (!sectionsMap.has(section.id)) {
                sectionsMap.set(section.id, {
                  id: section.id,
                  name: section.name,
                  farm_name: access.farms.name,
                  farm_id: access.farm_id,
                  tanks: section.tanks
                });
              }
            }
          });
        }
      });

      setAvailableTanks(Array.from(sectionsMap.values()));
    } catch (err) {
      console.error('Error fetching tanks:', err);
      toast.error('Failed to load tanks');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill data if editing
  useEffect(() => {
    if (editId) {
      loadActivityData();
    }
  }, [editId]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('id', editId)
        .single();

      if (error) throw error;
      if (data) {
        setDate(data.data.date || formatDate(data.created_at, 'yyyy-MM-dd'));
        setTime(data.data.time || formatDate(data.created_at, 'hh:mm'));
        setAmpm(data.data.ampm || (formatDate(data.created_at, 'a') as 'AM' | 'PM'));
        setTankId(data.tank_id);
        setSelectedSectionId(data.section_id || '');
        setSelectedFarmId(data.farm_id || '');
        setComments(data.data.comments || '');

        // Pre-fill activity specific fields
        const actType = data.activity_type;
        setActivity(actType as ActivityType);

        if (actType === 'Feed') {
          setFeedType(data.data.feedType || '');
          setFeedQty(data.data.feedQty || '');
          setFeedUnit(data.data.feedUnit || 'kg');
        } else if (actType === 'Treatment') {
          setTreatmentType(data.data.treatmentType || '');
          setTreatmentDosage(data.data.treatmentDosage || '');
          setTreatmentUnit(data.data.treatmentUnit || 'ml');
        } else if (actType === 'Water Quality') {
          setWaterData(data.data.waterData || {});
        } else if (actType === 'Animal Quality') {
          setAnimalSize(data.data.animalSize || '');
          setAnimalRatings(data.data.animalRatings || {});
          setDiseaseSymptoms(data.data.diseaseSymptoms || '');
          setAdditionalObservations(data.data.additionalObservations || data.data.otherAnimal || '');
        } else if (actType === 'Stocking') {
          setStockingData(data.data);
        } else if (actType === 'Observation') {
          setObservationData(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading activity:', err);
      toast.error('Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  // Auto-select activity from URL (if not editing)
  useEffect(() => {
    if (type && !editId) {
      const map: Record<string, ActivityType> = {
        'feed': 'Feed',
        'treatment': 'Treatment',
        'water': 'Water Quality',
        'animal': 'Animal Quality',
        'stocking': 'Stocking',
        'observation': 'Observation'
      };
      if (map[type.toLowerCase()]) {
        setActivity(map[type.toLowerCase()]);
      }
    }
  }, [type, editId]);

  // Feed fields
  const [feedType, setFeedType] = useState('');
  const [feedQty, setFeedQty] = useState('');
  const [feedUnit, setFeedUnit] = useState('gms');

  // Treatment fields
  const [treatmentType, setTreatmentType] = useState('');
  const [treatmentDosage, setTreatmentDosage] = useState('');
  const [treatmentUnit, setTreatmentUnit] = useState('ml');

  // Animal quality fields
  const [animalSize, setAnimalSize] = useState('');
  const [animalRatings, setAnimalRatings] = useState<Record<string, number>>({});
  const [hasDiseaseIdentified, setHasDiseaseIdentified] = useState<'Yes' | 'No' | ''>('');
  const [diseaseSymptoms, setDiseaseSymptoms] = useState('');
  const [additionalObservations, setAdditionalObservations] = useState('');

  // Water quality fields
  const [waterData, setWaterData] = useState<Record<string, string>>({});

  // Stocking & Observation extra data
  const [stockingData, setStockingData] = useState<any>({});
  const [observationData, setObservationData] = useState<any>({});

  const [comments, setComments] = useState('');

  const buildData = (): Record<string, any> => {
    const baseData = { date, time, ampm, comments };
    switch (activity) {
      case 'Feed': return { ...baseData, feedType, feedQty, feedUnit };
      case 'Treatment': return { ...baseData, treatmentType, treatmentDosage, treatmentUnit };
      case 'Water Quality': return { ...baseData, waterData };
      case 'Animal Quality': return { ...baseData, animalSize, animalRatings, hasDiseaseIdentified, diseaseSymptoms, additionalObservations };
      case 'Stocking': return { ...baseData, ...stockingData };
      case 'Observation': return { ...baseData, ...observationData };
      default: return baseData;
    }
  };

  const handleSave = async () => {
    if (!tankId || !activity) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (activity === 'Feed' && (!feedQty.trim() || !feedType.trim())) {
      toast.error('Feed Type and Quantity are required');
      return;
    }

    if (activity === 'Treatment' && (!treatmentType.trim() || !treatmentDosage.trim())) {
      toast.error('Treatment Type and Dosage are required');
      return;
    }

    if (activity === 'Stocking' && (!stockingData.broodstockSource?.trim() || !stockingData.tankStockingNumber || !stockingData.naupliiStocked || !stockingData.animalConditionScore || !stockingData.waterQualityScore)) {
      toast.error('Source, Stocking numbers, and Scores are required');
      return;
    }

    if (activity === 'Observation' && (!observationData.animalQualityScore || !observationData.waterQualityScore || !observationData.presentPopulation)) {
      toast.error('Scores and Present Population are required');
      return;
    }

    if (activity === 'Animal Quality' && !animalSize.trim()) {
      toast.error('Animal Size and Avg. Wt. is required');
      return;
    }

    let selectedTank: any = null;
    let farmId = selectedFarmId;
    let sectionId = selectedSectionId;

    for (const section of availableTanks) {
      const tank = section.tanks.find((t: any) => t.id === tankId);
      if (tank) {
        selectedTank = tank;
        sectionId = section.id;
        farmId = section.farm_id;
        break;
      }
    }

    if (!selectedTank && !editId) return; // Allow update if we have IDs from state

    try {
      setLoading(true);
      if (editId) {
        await updateActivity(editId, {
          tank_id: tankId,
          section_id: sectionId || undefined,
          farm_id: farmId || undefined,
          activity_type: activity,
          data: buildData()
        });
        toast.success('Activity updated!');
      } else {
        await addActivity({
          tank_id: tankId,
          section_id: sectionId || undefined,
          farm_id: farmId || undefined,
          activity_type: activity,
          data: buildData()
        });
        toast.success('Activity recorded!');
      }

      const target = user?.role === 'owner' ? '/owner/dashboard' : '/user/dashboard';
      setTimeout(() => navigate(target), 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save activity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="ocean-gradient p-4 pb-6 rounded-b-2xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const target = user?.role === 'owner' ? '/owner/dashboard' : '/user/dashboard';
              navigate(target);
            }}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-primary-foreground">
            {editId ? 'Edit Activity' : 'Record Activity'}
          </h1>
        </div>
      </div>

      <div className="p-3 sm:p-4 pb-8 space-y-4 max-w-lg mx-auto">
        {/* Date / Time */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => {
                  setDate(e.target.value);
                  setIsLiveTime(false);
                }}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={e => {
                    setTime(e.target.value);
                    setIsLiveTime(false);
                    // Update AM/PM based on 24h input
                    const [h] = e.target.value.split(':').map(Number);
                    if (!isNaN(h)) {
                      setAmpm(h >= 12 ? 'PM' : 'AM');
                    }
                  }}
                  className="h-11 w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tank & Activity */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {type ? 'Select Tank' : 'Tank & Activity'}
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs">Select Tank *</Label>
            <Select value={tankId} onValueChange={setTankId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose tank" />
              </SelectTrigger>
              <SelectContent>
                {availableTanks.map(section => (
                  <SelectGroup key={section.id}>
                    <SelectLabel className="bg-muted/50 text-xs py-1 px-2 font-bold text-primary">
                      {section.farm_name} - {section.name}
                    </SelectLabel>
                    {section.tanks.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!type && (
            <div className="space-y-1.5">
              <Label className="text-xs">Activity Type *</Label>
              <Select
                value={activity}
                onValueChange={v => setActivity(v as ActivityType)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose activity" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITIES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Dynamic Form */}
        {activity === 'Feed' && (
          <div className="glass-card rounded-2xl p-4 space-y-4 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Feed Details</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Feed Type *</Label>
              <Select value={feedType} onValueChange={setFeedType}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select feed type" /></SelectTrigger>
                <SelectContent>
                  {FEED_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Feed Quantity *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={feedQty}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || parseFloat(val) >= 0) {
                      setFeedQty(val);
                    }
                  }}
                  placeholder="0"
                  className="h-11 flex-1"
                />
                <Select value={feedUnit} onValueChange={setFeedUnit}>
                  <SelectTrigger className="w-24 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEED_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comments</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Add notes..." rows={3} />
            </div>
          </div>
        )}

        {activity === 'Treatment' && (
          <div className="glass-card rounded-2xl p-4 space-y-4 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Treatment Details</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Treatment Type *</Label>
              <Select value={treatmentType} onValueChange={setTreatmentType}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select treatment type" /></SelectTrigger>
                <SelectContent>
                  {TREATMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dosage *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={treatmentDosage}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || parseFloat(val) >= 0) {
                      setTreatmentDosage(val);
                    }
                  }}
                  placeholder="0"
                  className="h-11 flex-1"
                />
                <Select value={treatmentUnit} onValueChange={setTreatmentUnit}>
                  <SelectTrigger className="w-24 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TREATMENT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comments</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Add notes..." rows={3} />
            </div>
          </div>
        )}

        {activity === 'Water Quality' && (
          <div className="glass-card rounded-2xl p-4 space-y-4 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Water Quality Parameters</h2>
            <div className="grid grid-cols-2 gap-3">
              {waterFields.map(field => {
                const rangeLabel = WATER_QUALITY_RANGES[field];

                return (
                  <div key={field} className="space-y-1">
                    <Label className="text-[10px] font-medium flex justify-between">
                      {field}
                      {rangeLabel && <span className="text-[9px] text-muted-foreground">{rangeLabel}</span>}
                    </Label>
                    <Input
                      type={field === 'Other' ? 'text' : 'number'}
                      min="0"
                      step="any"
                      value={waterData[field] || ''}
                      onChange={e => setWaterData(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="—"
                      className="h-10 text-sm"
                    />
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comments</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Add notes..." rows={3} />
            </div>
          </div>
        )}

        {activity === 'Animal Quality' && (
          <div className="glass-card rounded-2xl p-4 space-y-5 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Animal Quality</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Animal Size and Avg. Wt. *</Label>
              <Input
                value={animalSize}
                onChange={e => {
                  const val = e.target.value;
                  // Allow numbers and '/' only
                  if (val === '' || /^[0-9/]*$/.test(val)) {
                    setAnimalSize(val);
                  }
                }}
                placeholder="Enter size / avg weight (e.g. 10/12)"
                className="h-11"
              />
              <p className="text-[10px] text-muted-foreground">Only numbers and '/' allowed</p>
            </div>
            <div className="space-y-4">
              {ANIMAL_RATING_FIELDS.map(f => (
                <RatingScale
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  value={animalRatings[f.key] || 0}
                  onChange={val => setAnimalRatings(prev => ({ ...prev, [f.key]: val }))}
                />
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-dashed">
              <Label className="text-xs">Any identification of disease?</Label>
              <Select value={hasDiseaseIdentified} onValueChange={v => setHasDiseaseIdentified(v as any)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select Yes/No" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasDiseaseIdentified === 'Yes' && (
              <div className="space-y-1.5 animate-fade-in">
                <Label className="text-xs">Symptoms *</Label>
                <Textarea
                  value={diseaseSymptoms}
                  onChange={e => setDiseaseSymptoms(e.target.value)}
                  placeholder="Describe the symptoms..."
                  rows={3}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Additional Observations</Label>
              <Input value={additionalObservations} onChange={e => setAdditionalObservations(e.target.value)} placeholder="Any other observations" className="h-11" />
            </div>

          </div>
        )}

        {activity === 'Stocking' && (
          <StockingForm
            data={stockingData}
            onDataChange={setStockingData}
            comments={comments}
            onCommentsChange={setComments}
          />
        )}

        {activity === 'Observation' && (
          <ObservationForm
            data={observationData}
            onDataChange={setObservationData}
            comments={comments}
            onCommentsChange={setComments}
          />
        )}

        {/* Save */}
        {activity && (
          <Button onClick={handleSave} className="w-full h-14 text-base font-semibold rounded-2xl gap-2 animate-fade-in-up" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Save className="w-5 h-5" /> {editId ? 'Update Activity' : 'Save Activity'}</>}
          </Button>
        )}
      </div>
    </div>
  );
};

export default RecordActivity;
