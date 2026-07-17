import { useState, useEffect } from 'react';
import { Plus, X, Play } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AdminStatus as AdminStatusType } from '@/types';
import { toast } from 'sonner';

export default function AdminStatus() {
  const { isAdmin } = useAuth();
  const [statuses, setStatuses] = useState<AdminStatusType[]>([]);
  const [viewing, setViewing] = useState<AdminStatusType | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStatuses();
  }, []);

  async function fetchStatuses() {
    const { data } = await supabase
      .from('admin_statuses')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) setStatuses(data);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const path = `status_${Date.now()}_${file.name}`;
    const url = await uploadFile('statuses', path, file);
    await supabase.from('admin_statuses').insert({ media_url: url, media_type: type });
    toast.success('Status posted!');
    fetchStatuses();
    setUploading(false);
  }

  async function deleteStatus(id: string) {
    await supabase.from('admin_statuses').delete().eq('id', id);
    setStatuses(s => s.filter(x => x.id !== id));
    setViewing(null);
    toast.success('Status deleted');
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto scrollbar-hide">
        {/* Admin upload button */}
        {isAdmin && (
          <label className="flex-shrink-0 cursor-pointer">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-primary flex items-center justify-center hover:bg-primary/10 transition-all">
              {uploading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-5 h-5 text-primary" />
              )}
            </div>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}

        {statuses.length === 0 && !isAdmin && (
          <p className="text-xs text-muted-foreground py-1">No updates yet</p>
        )}

        {statuses.map(s => (
          <button
            key={s.id}
            onClick={() => setViewing(s)}
            className="flex-shrink-0 w-12 h-12 rounded-full ring-2 ring-primary ring-offset-1 ring-offset-background overflow-hidden hover:scale-105 transition-all"
          >
            {s.media_type === 'video' ? (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary fill-primary" />
              </div>
            ) : (
              <img src={s.media_url} alt="status" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {/* Status viewer modal */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewing(null)} className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
            {isAdmin && (
              <button
                onClick={() => deleteStatus(viewing.id)}
                className="absolute top-2 left-2 z-10 px-3 py-1 rounded-full bg-red-500/80 text-white text-xs font-medium"
              >
                Delete
              </button>
            )}
            {viewing.media_type === 'video' ? (
              <video src={viewing.media_url} controls autoPlay className="w-full rounded-2xl" />
            ) : (
              <img src={viewing.media_url} alt="status" className="w-full rounded-2xl" />
            )}
            {viewing.text_content && (
              <div className="mt-3 p-3 bg-card rounded-xl">
                <p className="text-white text-sm">{viewing.text_content}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
