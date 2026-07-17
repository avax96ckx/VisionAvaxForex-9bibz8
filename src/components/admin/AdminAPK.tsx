import { useState, useEffect } from 'react';
import { Smartphone, Plus, Upload, Save, Trash2, RefreshCw, Tag, FileText, AlertTriangle, Star, Edit2, X, Check } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { AppVersion } from '@/types';
import { toast } from 'sonner';

function VersionForm({
  initial,
  onSave,
  onCancel,
  uploading,
  onAPKUpload,
}: {
  initial?: Partial<AppVersion>;
  onSave: (data: Partial<AppVersion>) => void;
  onCancel: () => void;
  uploading: boolean;
  onAPKUpload: (e: React.ChangeEvent<HTMLInputElement>, setUrl: (u: string) => void) => void;
}) {
  const [form, setForm] = useState<Partial<AppVersion>>({
    version_name: '',
    version_code: 1,
    apk_url: '',
    release_notes: '',
    is_latest: true,
    force_update: false,
    ...initial,
  });

  return (
    <div className="p-4 bg-muted/30 border border-primary/20 rounded-2xl space-y-3 animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Version Name *</label>
          <input
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
            placeholder="e.g. 1.0.2"
            value={form.version_name || ''}
            onChange={e => setForm(p => ({ ...p, version_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Version Code</label>
          <input
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
            placeholder="e.g. 102"
            type="number"
            value={form.version_code || ''}
            onChange={e => setForm(p => ({ ...p, version_code: parseInt(e.target.value) || 1 }))}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block font-medium">Changelog / Release Notes</label>
        <textarea
          className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
          placeholder="- Fixed login bug&#10;- Improved signal speed&#10;- New VIP features"
          rows={4}
          value={form.release_notes || ''}
          onChange={e => setForm(p => ({ ...p, release_notes: e.target.value }))}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Tip: Start each line with - for bullet points in changelog</p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block font-medium">APK Download URL</label>
        <input
          className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
          placeholder="https://... or upload below"
          value={form.apk_url || ''}
          onChange={e => setForm(p => ({ ...p, apk_url: e.target.value }))}
        />
      </div>

      <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${uploading ? 'border-primary/50 bg-primary/5' : 'border-dashed border-primary/35 hover:bg-primary/5 hover:border-primary/50'}`}>
        {uploading
          ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          : <Upload className="w-4 h-4 text-primary" />
        }
        <span className="text-sm text-muted-foreground flex-1">
          {uploading ? 'Uploading APK...' : form.apk_url?.includes('supabase') ? '✓ APK file uploaded' : 'Upload APK file (.apk)'}
        </span>
        <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" disabled={uploading} onChange={e => onAPKUpload(e, (url) => setForm(p => ({ ...p, apk_url: url })))} />
      </label>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, is_latest: !p.is_latest }))}
          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all press ${form.is_latest ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}
        >
          <Star className={`w-4 h-4 ${form.is_latest ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left flex-1">
            <p className={`text-xs font-bold ${form.is_latest ? 'text-primary' : 'text-muted-foreground'}`}>Mark as Latest</p>
            <p className="text-[9px] text-muted-foreground">{form.is_latest ? 'Will be shown as latest' : 'Not latest release'}</p>
          </div>
          {form.is_latest && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, force_update: !p.force_update }))}
          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all press ${form.force_update ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-muted/30'}`}
        >
          <AlertTriangle className={`w-4 h-4 ${form.force_update ? 'text-orange-400' : 'text-muted-foreground'}`} />
          <div className="text-left flex-1">
            <p className={`text-xs font-bold ${form.force_update ? 'text-orange-400' : 'text-muted-foreground'}`}>Force Update</p>
            <p className="text-[9px] text-muted-foreground">{form.force_update ? 'Required for all users' : 'Optional update'}</p>
          </div>
          {form.force_update && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-3 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press pink-glow-xs"
        >
          <Save className="w-4 h-4" /> Publish Version
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 bg-muted rounded-xl text-muted-foreground text-sm font-bold press"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminAPK() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { fetchVersions(); }, []);

  async function fetchVersions() {
    setLoading(true);
    const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoading(false);
  }

  async function handleAPKUpload(e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error('APK must be under 100MB'); return; }
    setUploading(true);
    try {
      const url = await uploadFile('media', `apk/${Date.now()}_${file.name}`, file);
      setUrl(url);
      toast.success('APK uploaded successfully!');
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function saveVersion(data: Partial<AppVersion>, editId?: string) {
    if (!data.version_name?.trim()) return toast.error('Version name is required');

    if (data.is_latest) {
      // Unset is_latest on all others first
      await supabase.from('app_versions').update({ is_latest: false }).neq('id', editId || '00000000-0000-0000-0000-000000000000');
    }

    if (editId) {
      const { error } = await supabase.from('app_versions').update({
        version_name: data.version_name,
        version_code: data.version_code || 1,
        apk_url: data.apk_url || null,
        release_notes: data.release_notes || null,
        is_latest: data.is_latest ?? false,
        force_update: data.force_update ?? false,
      }).eq('id', editId);
      if (error) { toast.error('Failed: ' + error.message); return; }
      toast.success('Version updated!');
      setEditingId(null);
    } else {
      const { error } = await supabase.from('app_versions').insert({
        version_name: data.version_name,
        version_code: data.version_code || 1,
        apk_url: data.apk_url || null,
        release_notes: data.release_notes || null,
        is_latest: data.is_latest ?? true,
        force_update: data.force_update ?? false,
      });
      if (error) { toast.error('Failed: ' + error.message); return; }
      toast.success('New version published!');
      setShowForm(false);
    }
    fetchVersions();
  }

  async function toggleForceUpdate(v: AppVersion) {
    await supabase.from('app_versions').update({ force_update: !v.force_update }).eq('id', v.id);
    toast.success(v.force_update ? 'Force update removed' : 'Force update enabled');
    fetchVersions();
  }

  async function setLatest(id: string) {
    await supabase.from('app_versions').update({ is_latest: false }).neq('id', id);
    await supabase.from('app_versions').update({ is_latest: true }).eq('id', id);
    toast.success('Set as latest version');
    fetchVersions();
  }

  async function deleteVersion(id: string) {
    if (!confirm('Delete this version? This cannot be undone.')) return;
    await supabase.from('app_versions').delete().eq('id', id);
    toast.success('Version deleted');
    fetchVersions();
  }

  const latestVersion = versions.find(v => v.is_latest);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center pink-glow-xs">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-foreground">APK Version Management</h3>
              <p className="text-xs text-muted-foreground">
                {latestVersion ? `Latest: v${latestVersion.version_name}` : 'No versions yet'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setEditingId(null); }}
            className="flex items-center gap-1.5 px-3 py-2 gradient-pink rounded-xl text-white text-xs font-bold press pink-glow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Version
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-black text-foreground">{versions.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Releases</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-2.5 text-center">
            <p className="text-sm font-black text-primary">{latestVersion?.version_name || '—'}</p>
            <p className="text-[10px] text-muted-foreground">Latest</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-2.5 text-center">
            <p className="text-sm font-black text-orange-400">{versions.filter(v => v.force_update).length}</p>
            <p className="text-[10px] text-muted-foreground">Force Updates</p>
          </div>
        </div>

        {/* New Version Form */}
        {showForm && (
          <VersionForm
            onSave={(data) => saveVersion(data)}
            onCancel={() => setShowForm(false)}
            uploading={uploading}
            onAPKUpload={handleAPKUpload}
          />
        )}
      </div>

      {/* Version list */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> All Versions
        </h3>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Smartphone className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
            <p className="text-sm text-muted-foreground font-bold">No versions yet</p>
            <p className="text-xs text-muted-foreground">Click "New Version" to publish your first APK</p>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map(v => (
              <div key={v.id}>
                {editingId === v.id ? (
                  <VersionForm
                    initial={v}
                    onSave={(data) => saveVersion(data, v.id)}
                    onCancel={() => setEditingId(null)}
                    uploading={uploading}
                    onAPKUpload={handleAPKUpload}
                  />
                ) : (
                  <div className={`p-3.5 rounded-xl border ${v.is_latest ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/15'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-primary" />
                            <span className="font-black text-foreground text-sm">v{v.version_name}</span>
                          </div>
                          {v.version_code > 0 && (
                            <span className="text-[10px] text-muted-foreground">· Build {v.version_code}</span>
                          )}
                          {v.is_latest && (
                            <span className="text-[10px] px-2 py-0.5 gradient-pink rounded-full text-white font-bold">LATEST</span>
                          )}
                          {v.force_update && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-bold flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> REQUIRED
                            </span>
                          )}
                          {v.apk_url && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-medium">APK ✓</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {v.release_notes && (
                      <div className="mb-2 space-y-0.5">
                        {v.release_notes.split('\n').filter(Boolean).slice(0, 4).map((line, i) => {
                          const isItem = line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*');
                          const text = line.replace(/^[-•*]\s*/, '').trim();
                          return isItem ? (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-primary text-[11px] flex-shrink-0 mt-0.5">•</span>
                              <p className="text-xs text-muted-foreground">{text}</p>
                            </div>
                          ) : (
                            <p key={i} className="text-xs text-muted-foreground">{text}</p>
                          );
                        })}
                        {v.release_notes.split('\n').filter(Boolean).length > 4 && (
                          <p className="text-[10px] text-muted-foreground opacity-60">+{v.release_notes.split('\n').filter(Boolean).length - 4} more...</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setEditingId(v.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] font-bold flex items-center gap-1 hover:text-foreground press transition-all"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      {!v.is_latest && (
                        <button onClick={() => setLatest(v.id)} className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1 press">
                          <RefreshCw className="w-3 h-3" /> Set Latest
                        </button>
                      )}
                      <button
                        onClick={() => toggleForceUpdate(v)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 press ${v.force_update ? 'bg-orange-500/15 text-orange-400' : 'bg-muted text-muted-foreground hover:text-orange-400'}`}
                      >
                        <AlertTriangle className="w-3 h-3" /> {v.force_update ? 'Unforce' : 'Force'}
                      </button>
                      {v.apk_url && (
                        <a href={v.apk_url} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[11px] font-bold">
                          Download
                        </a>
                      )}
                      <button onClick={() => deleteVersion(v.id)} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-bold flex items-center gap-1 press">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
