import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RatingScale from '@/components/RatingScale';
import ImageUpload from '@/components/ImageUpload';

interface StockingFormProps {
  data: any;
  onDataChange: (val: any) => void;
  comments: string;
  onCommentsChange: (val: string) => void;
  photoUrl: string;
  onPhotoUrlChange: (val: string) => void;
}

const StockingForm = ({
  data,
  onDataChange,
  comments,
  onCommentsChange,
  photoUrl,
  onPhotoUrlChange
}: StockingFormProps) => {
  const handleChange = (field: string, value: any) => {
    onDataChange({ ...data, [field]: value });
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-5 animate-fade-in-up">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Stocking Details</h2>

      <div className="space-y-1.5">
        <Label className="text-xs">Source of Broodstock *</Label>
        <Input
          value={data.broodstockSource || ''}
          onChange={e => handleChange('broodstockSource', e.target.value)}
          placeholder="Enter broodstock source"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Name of the Hatchery or Section</Label>
        <Input
          value={data.hatcheryName || ''}
          onChange={e => handleChange('hatcheryName', e.target.value)}
          placeholder="Enter hatchery / section name"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tank Stocking Number (Population) *</Label>
        <Input
          type="number"
          min="0"
          value={data.tankStockingNumber || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseFloat(val) >= 0) {
              handleChange('tankStockingNumber', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Number of Nauplii Stocked in Million *</Label>
        <Input
          type="number"
          min="0"
          step="any"
          value={data.naupliiStocked || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseFloat(val) >= 0) {
              handleChange('naupliiStocked', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <RatingScale
        label="Animal Condition Score"
        required
        value={data.animalConditionScore || 0}
        onChange={val => handleChange('animalConditionScore', val)}
      />



      <RatingScale
        label="Water Quality Score"
        required
        value={data.waterQualityScore || 0}
        onChange={val => handleChange('waterQualityScore', val)}
      />



      <div className="space-y-1.5 pt-2 border-t border-dashed">
        <ImageUpload value={photoUrl} onUpload={onPhotoUrlChange} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Comments</Label>
        <Textarea
          value={comments}
          onChange={e => onCommentsChange(e.target.value)}
          placeholder="Add notes..."
          rows={3}
        />
      </div>
    </div>
  );
};

export default StockingForm;
