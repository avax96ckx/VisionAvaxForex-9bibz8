import { useState, useEffect } from 'react';
import { Save, Phone, Video, Palette, Upload, Check, Crown } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';

// Pre-built style presets
const CALL_PRESETS = [
  { id: 'midnight', label: 'Midnight', from: '#0d0d1a', to: '#1a0026', accent: '#FF1493', incoming_from: '#0d0d1a', incoming_to: '#1a0026' },
  { id: 'ocean', label: 'Ocean', from: '#0a1628', to: '#0e3460', accent: '#4FC3F7', incoming_from: '#0a1628', incoming_to: '#1565C0' },
  { id: 'forest', label: 'Forest', from: '#0a1f0a', to: '#1b3d1b', accent: '#4CAF50', incoming_from: '#0a1a0a', incoming_to: '#2e7d32' },
  { id: 'sunset', label: 'Sunset', from: '#1a0a00', to: '#5c1a00', accent: '#FF6B35', incoming_from: '#1a0800', incoming_to: '#7c2600' },
  { id: 'lavender', label: 'Lavender', from: '#12001f', to: '#2d0047', accent: '#CE93D8', incoming_from: '#100020', incoming_to: '#4a0080' },
  { id: 'aurora', label: 'Aurora', from: '#001a1a', to: '#003322', accent: '#80CBC4', incoming_from: '#001518', incoming_to: '#00695C' },
  { id: 'rose', label: 'Rose', from: '#1f0010', to: '#3d0020', accent: '#F48FB1', incoming_from: '#1a000e', incoming_to: '#880E4F' },
  { id: 'slate', label: 'Slate', from: '#0d1117', to: '#161b22', accent: '#58A6FF', incoming_from: '#0d1117', incoming_to: '#21262d' },
  { id: 'gold', label: 'Gold VIP', from: '#1a1200', to: '#3d2c00', accent: '#FFD700', incoming_from: '#181000', incoming_to: '#4a3600' },
];

export default function AdminCallStyles() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [settings, setSettings] = useState({
    bg_gradient_from: '#0d0d1a',
    bg_gradient_to: '#1a0026',
    accent_color: '#FF1493',
    incoming_bg_from: '#0d0d1a',
    incoming_bg_to: '#1a0026',
    ringtone_url: '',
  });
  const [uploadingRingtone, setUploadingRingtone] = useState(false);
  const [testingRingtone, setTestingRingtone] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('midnight');
  const testAudioRef = useState<HTMLAudioElement | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('call_settings').select('*').eq('id', 'main').single();
    if (data) {
      setSettings({
        bg_gradient_from: (data as any).bg_gradient_from || '#0d0d1a',
        bg_gradient_to: (data as any).bg_gradient_to || '#1a0026',
        accent_color: (data as any).accent_color || '#FF1493',
        incoming_bg_from: (data as any).incoming_bg_from || '#0d0d1a',
        incoming_bg_to: (data as any).incoming_bg_to || '#1a0026',
        ringtone_url: (data as any).ringtone_url || '',
      });
    }
    setLoading(false);
  }

  function applyPreset(preset: typeof CALL_PRESETS[0]) {
    setSelectedPreset(preset.id);
    setSettings(prev => ({
      ...prev,
      bg_gradient_from: preset.from,
      bg_gradient_to: preset.to,
      accent_color: preset.accent,
      incoming_bg_from: preset.incoming_from,
      incoming_bg_to: preset.incoming_to,
    }));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('call_settings').upsert({
      id: 'main', ...settings, updated_at: new Date().toISOString(),
    }).eq('id', 'main');
    if (error) toast.error('Save failed: ' + error.message);
    else toast.success('Call styles saved! New callers will see these styles.');
    setSaving(false);
  }

  async function handleRingtoneUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Please select an audio file (MP3, WAV, OGG)'); return; }
    setUploadingRingtone(true);
    try {
      const url = await uploadFile('media', `ringtone_${Date.now()}_${file.name}`, file);
      setSettings(p => ({ ...p, ringtone_url: url }));
      // Immediately save the ringtone URL to DB
      await supabase.from('call_settings').upsert({ id: 'main', ringtone_url: url, updated_at: new Date().toISOString() }).eq('id', 'main');
      toast.success('Ringtone uploaded and saved!');
    } catch { toast.error('Upload failed'); }
    setUploadingRingtone(false);
    e.target.value = '';
  }

  function testRingtone() {
    if (!settings.ringtone_url) { toast.error('No ringtone saved yet'); return; }
    if (testingRingtone) {
      testAudioRef[0]?.pause();
      (testAudioRef as any)[1](null);
      setTestingRingtone(false);
      return;
    }
    const audio = new Audio(settings.ringtone_url);
    audio.volume = 0.8;
    audio.play()
      .then(() => {
        setTestingRingtone(true);
        (testAudioRef as any)[1](audio);
        audio.onended = () => { setTestingRingtone(false); (testAudioRef as any)[1](null); };
        setTimeout(() => { audio.pause(); setTestingRingtone(false); }, 5000);
      })
      .catch(() => toast.error('Cannot play audio. Check the URL is a valid audio file.'));
  }

  function ColorRow({ label, field, value }: { label: string; field: string; value: string }) {
    return (
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
        <div className="flex gap-2 items-center">
          <input type="color" value={value} onChange={e => setSettings(p => ({ ...p, [field]: e.target.value }))}
            className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
          <input value={value} onChange={e => setSettings(p => ({ ...p, [field]: e.target.value }))}
            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary font-mono" />
          <div className="w-9 h-9 rounded-xl border border-border flex-shrink-0" style={{ background: value }} />
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  const outgoingPreview = `linear-gradient(180deg, ${settings.bg_gradient_from} 0%, ${settings.bg_gradient_to} 100%)`;
  const incomingPreview = `linear-gradient(180deg, ${settings.incoming_bg_from} 0%, ${settings.incoming_bg_to} 100%)`;

  return (
    <div className="space-y-5">
      {/* Live Preview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl overflow-hidden border border-border">
          <div className="h-28 flex flex-col items-center justify-center relative" style={{ background: outgoingPreview }}>
            <Phone className="w-7 h-7 text-white mb-1" />
            <p className="text-white text-xs font-black">Outgoing Call</p>
            <div className="absolute bottom-3 flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(70,70,70,0.9)' }}><Phone className="w-3.5 h-3.5 text-white" /></div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#fff' }}><Phone className="w-4 h-4 text-black" /></div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#e5263d' }}><PhoneOff className="w-4 h-4 text-white" /></div>
            </div>
          </div>
          <p className="text-center text-[10px] text-muted-foreground py-1.5 bg-card">Outgoing / Active</p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-border">
          <div className="h-28 flex flex-col items-center justify-center" style={{ background: incomingPreview }}>
            <div className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center mb-1">
              <span className="text-white text-lg font-black">M</span>
            </div>
            <p className="text-white text-xs font-black">Member</p>
            <p className="text-white/50 text-[9px] mt-0.5">Incoming call...</p>
          </div>
          <p className="text-center text-[10px] text-muted-foreground py-1.5 bg-card">Incoming Call</p>
        </div>
      </div>

      {/* Style Presets */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> Style Presets
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {CALL_PRESETS.map(preset => (
            <button key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`relative rounded-xl overflow-hidden press transition-all ${selectedPreset === preset.id ? 'ring-2 ring-primary' : ''}`}>
              <div className="h-12 w-full" style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }} />
              <div className="py-1.5 px-1 bg-card/90 text-center">
                <p className="text-[10px] font-bold text-foreground truncate">{preset.label}</p>
              </div>
              {selectedPreset === preset.id && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {[
          { key: 'outgoing', label: 'Outgoing / Active Call', icon: Phone },
          { key: 'incoming', label: 'Incoming Call', icon: Video },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveSection(key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all press ${activeSection === key ? 'gradient-pink text-white' : 'bg-card border border-border text-muted-foreground'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Outgoing section */}
      {activeSection === 'outgoing' && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Outgoing / Active Call Background
          </h3>
          <ColorRow label="Gradient Top Color" field="bg_gradient_from" value={settings.bg_gradient_from} />
          <ColorRow label="Gradient Bottom Color" field="bg_gradient_to" value={settings.bg_gradient_to} />
          <ColorRow label="Accent / Button Color" field="accent_color" value={settings.accent_color} />
        </div>
      )}

      {/* Incoming section */}
      {activeSection === 'incoming' && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" /> Incoming Call Screen Background
          </h3>
          <ColorRow label="Gradient Top Color" field="incoming_bg_from" value={settings.incoming_bg_from} />
          <ColorRow label="Gradient Bottom Color" field="incoming_bg_to" value={settings.incoming_bg_to} />
        </div>
      )}

      {/* Ringtone */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" /> Incoming Call Ringtone
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
            {uploadingRingtone
              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <Upload className="w-4 h-4 text-primary" />
            }
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">{settings.ringtone_url ? '✓ Ringtone uploaded' : 'Upload Ringtone'}</p>
              <p className="text-xs text-muted-foreground">MP3, WAV, OGG — max 5MB</p>
            </div>
            <input type="file" accept="audio/*" className="hidden" onChange={handleRingtoneUpload} />
          </label>

          {settings.ringtone_url && (
            <div className="flex gap-2 items-center p-3 bg-muted/30 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground font-medium truncate">{settings.ringtone_url.split('/').pop()?.split('_').slice(2).join('_') || 'ringtone'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{settings.ringtone_url.substring(0, 50)}...</p>
              </div>
              <button onClick={testRingtone}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold press flex items-center gap-1 ${testingRingtone ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                {testingRingtone ? '⏹ Stop' : '▶ Test'}
              </button>
              <button onClick={() => setSettings(p => ({ ...p, ringtone_url: '' }))}
                className="px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-bold press">
                Clear
              </button>
            </div>
          )}

          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-xs text-green-400 font-medium">✓ How it works</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">When saved, this audio will play automatically on all incoming calls. If no ringtone is set, the app uses a built-in tone.</p>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3.5 gradient-pink rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 press disabled:opacity-50 pink-glow-xs">
        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Call Styles'}
      </button>
    </div>
  );
}

// Missing lucide icon fix
function PhoneOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 3.07 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2 1.72h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L6.18 9.63" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}
