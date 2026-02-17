import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Camera, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadProps {
    onUpload: (url: string) => void;
    value?: string;
}

const ImageUpload = ({ onUpload, value }: ImageUploadProps) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(value || null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) return;

            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `activity-logs/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('activity-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('activity-photos')
                .getPublicUrl(filePath);

            setPreview(publicUrl);
            onUpload(publicUrl);
            toast.success('Photo uploaded successfully');
        } catch (error: any) {
            console.error('Error uploading image:', error);
            toast.error(error.message || 'Error uploading image');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = () => {
        setPreview(null);
        onUpload('');
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Activity Photo
                </label>
                {preview && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeImage}
                        className="h-6 text-[10px] text-destructive hover:text-destructive/80"
                    >
                        <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                )}
            </div>

            <div className="relative group">
                {preview ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-border shadow-sm">
                        <img
                            src={preview}
                            alt="Activity"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <label className="cursor-pointer bg-white/90 text-slate-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                                <Camera className="w-3.5 h-3.5" />
                                Change Photo
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    disabled={uploading}
                                    className="hidden"
                                    capture="environment"
                                />
                            </label>
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-muted hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                        <div className="bg-primary/10 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            {uploading ? (
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            ) : (
                                <Camera className="w-6 h-6 text-primary" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">Take a Photo</p>
                            <p className="text-[10px] text-muted-foreground">or tap to upload image</p>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                            capture="environment"
                        />
                    </label>
                )}
            </div>
        </div>
    );
};

export default ImageUpload;
