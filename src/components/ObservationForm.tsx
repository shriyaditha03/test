import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RatingScale from '@/components/RatingScale';
import ImageUpload from '@/components/ImageUpload';

interface ObservationFormProps {
  data: any;
  onDataChange: (val: any) => void;
  comments: string;
  onCommentsChange: (val: string) => void;
  photoUrl: string;
  onPhotoUrlChange: (val: string) => void;
}

const ObservationForm = ({
  data,
  onDataChange,
  comments,
  onCommentsChange,
  photoUrl,
  onPhotoUrlChange
}: ObservationFormProps) => {
  const handleChange = (field: string, value: any) => {
    onDataChange({ ...data, [field]: value });
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-5 animate-fade-in-up">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Observation Details</h2>

      <RatingScale
        label="Animal Quality Score"
        required
        value={data.animalQualityScore || 0}
        onChange={val => handleChange('animalQualityScore', val)}
      />



      {/* Sampling Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sampling</h3>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-0">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground"></th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground">Sample 1</th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground">Sample 2</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-2 font-medium">Animal Count</td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample1Count || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample1Count', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample2Count || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample2Count', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-2 font-medium">Weight</td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample1Weight || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample1Weight', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample2Weight || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample2Weight', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-2 font-medium">Avg Wt *</td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample1AvgWt || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample1AvgWt', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
                <td className="py-2 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={data.sample2AvgWt || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        handleChange('sample2AvgWt', val);
                      }
                    }}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>



      <div className="space-y-1.5">
        <Label className="text-xs">Number of Molts Collected</Label>
        <p className="text-[10px] text-muted-foreground -mt-1">To help us calculate Molting Cycle</p>
        <Input
          type="number"
          min="0"
          value={data.moltsCollected || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseInt(val) >= 0) {
              handleChange('moltsCollected', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Number of Dead Animals (Mortality)</Label>
        <Input
          type="number"
          min="0"
          value={data.deadAnimals || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseInt(val) >= 0) {
              handleChange('deadAnimals', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Number of Nauplii Stocked in Million</Label>
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

      <div className="space-y-1.5">
        <Label className="text-xs">Present Population in the Tank *</Label>
        <Input
          type="number"
          min="0"
          value={data.presentPopulation || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseInt(val) >= 0) {
              handleChange('presentPopulation', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tank Stocking Number (Population)</Label>
        <Input
          type="number"
          min="0"
          value={data.tankStockingNumber || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseInt(val) >= 0) {
              handleChange('tankStockingNumber', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Number of Nauplii Stocked in Million</Label>
        <Input
          type="number"
          min="0"
          step="any"
          value={data.naupliiStockedMillion || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || parseFloat(val) >= 0) {
              handleChange('naupliiStockedMillion', val);
            }
          }}
          placeholder="0"
          className="h-11"
        />
      </div>

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
        <Textarea value={comments} onChange={e => onCommentsChange(e.target.value)} placeholder="Add notes..." rows={3} />
      </div>
    </div>
  );
};

export default ObservationForm;
