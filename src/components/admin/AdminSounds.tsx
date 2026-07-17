import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Upload, Trash2, Play, Pause, Save, Music, RotateCcw, Smartphone, Check, Zap } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';
import { invalidateSoundCache } from '@/lib/notificationSound';

interface SoundSlot {
  key: 'sound_notification' | 'sound_messenger' | 'sound_viproom' | 'sound_signal';
  label: string;
  desc: string;
  emoji: string;
}

const SOUND_SLOTS: SoundSlot[] = [
  { key: 'sound_notification', label: 'Notifications', desc: 'Plays when a new notification arrives', emoji: '🔔' },
  { key: 'sound_messenger', label: 'Messenger', desc: 'Plays when a new private message is received', emoji: '💬' },
  { key: 'sound_viproom', label: 'VIP Room', desc: 'Plays when a new message arrives in VIP Room', emoji: '👑' },
  { key: 'sound_signal', label: 'New Signal', desc: 'Plays when admin posts a new BUY/SELL signal', emoji: '📈' },
];

// ── iOS-style sample sounds synthesized via Web Audio API ──
interface SampleSound {
  id: string;
  label: string;
  desc: string;
  icon: string;
  synth: (ctx: AudioContext, dest: AudioNode) => void;
}

function playOsc(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'sine',
  gainVal = 0.35,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

const IOS_SAMPLES: SampleSound[] = [
  {
    id: 'tritone',
    label: 'Tri-Tone',
    desc: 'Classic iMessage',
    icon: '📱',
    synth: (ctx, dest) => {
      // E5 → D5 → A4  (classic iMessage tri-tone)
      playOsc(ctx, dest, 659.25, 0.0, 0.18, 'sine', 0.4);
      playOsc(ctx, dest, 587.33, 0.2, 0.18, 'sine', 0.4);
      playOsc(ctx, dest, 440.00, 0.4, 0.3,  'sine', 0.4);
    },
  },
  {
    id: 'note',
    label: 'Note',
    desc: 'iOS Mail sound',
    icon: '✉️',
    synth: (ctx, dest) => {
      // Two quick ascending notes
      playOsc(ctx, dest, 523.25, 0.0, 0.12, 'sine', 0.35);
      playOsc(ctx, dest, 783.99, 0.14, 0.22, 'sine', 0.35);
    },
  },
  {
    id: 'chime',
    label: 'Chime',
    desc: 'Soft ascending chime',
    icon: '🔔',
    synth: (ctx, dest) => {
      // C5 → E5 → G5 ascending chime
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        playOsc(ctx, dest, freq, i * 0.12, 0.28, 'sine', 0.3);
        playOsc(ctx, dest, freq * 2, i * 0.12, 0.18, 'sine', 0.08);
      });
    },
  },
  {
    id: 'ping',
    label: 'Ping',
    desc: 'Quick ping',
    icon: '⚡',
    synth: (ctx, dest) => {
      playOsc(ctx, dest, 1046.5, 0.0, 0.35, 'sine', 0.4);
      playOsc(ctx, dest, 1318.5, 0.0, 0.12, 'sine', 0.15);
    },
  },
  {
    id: 'glass',
    label: 'Glass',
    desc: 'iOS glass tap',
    icon: '🎵',
    synth: (ctx, dest) => {
      // High glass tap
      playOsc(ctx, dest, 1567.98, 0.0, 0.08, 'sine', 0.35);
      playOsc(ctx, dest, 1174.66, 0.04, 0.22, 'sine', 0.25);
      playOsc(ctx, dest, 880.0,   0.1,  0.3,  'sine', 0.2);
    },
  },
  {
    id: 'chord',
    label: 'Bell Chord',
    desc: 'iOS FaceTime style',
    icon: '🎶',
    synth: (ctx, dest) => {
      // Major chord: C5 + E5 + G5 simultaneous
      [[523.25, 0.32], [659.25, 0.25], [783.99, 0.2], [1046.5, 0.12]].forEach(([f, v]) => {
        playOsc(ctx, dest, f as number, 0, 0.6, 'sine', v as number);
      });
    },
  },
];

// ── Waveform canvas drawn from AudioBuffer samples ──
function WaveformCanvas({
  audioBuffer,
  playing,
  progress,
}: {
  audioBuffer: AudioBuffer | null;
  playing: boolean;
  progress: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!audioBuffer) {
      // Draw placeholder bars
      const bars = 40;
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.6) * 0.3 + 0.35) * H;
        ctx.fillStyle = 'rgba(255,20,147,0.15)';
        ctx.beginPath();
        ctx.roundRect(i * (W / bars) + 1, (H - h) / 2, W / bars - 2, h, 2);
        ctx.fill();
      }
      return;
    }

    const data = audioBuffer.getChannelData(0);
    const bars = 60;
    const step = Math.floor(data.length / bars);

    for (let i = 0; i < bars; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        peak = Math.max(peak, Math.abs(data[i * step + j] || 0));
      }

      const barH = Math.max(3, peak * H * 0.9);
      const x = i * (W / bars) + 1;
      const barW = W / bars - 2;
      const y = (H - barH) / 2;

      const filled = (i / bars) * 100 <= progress;
      if (playing && filled) {
        // gradient pink for played portion
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, 'rgba(255,20,147,0.9)');
        grad.addColorStop(1, 'rgba(255,105,180,0.7)');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(255,20,147,0.22)';
      }
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 2);
      ctx.fill();
    }

    // Playhead
    if (playing && progress > 0) {
      const px = (progress / 100) * W;
      ctx.strokeStyle = 'rgba(255,20,147,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
  }, [audioBuffer, playing, progress]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={40}
      className="w-full rounded-lg"
      style={{ height: '40px' }}
    />
  );
}

// ── Normalize audio buffer to target peak ──
function normalizeBuffer(buffer: AudioBuffer, targetPeak = 0.85): AudioBuffer {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  let maxPeak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      maxPeak = Math.max(maxPeak, Math.abs(d[i]));
    }
  }

  if (maxPeak === 0 || maxPeak >= targetPeak) return buffer;
  const gain = targetPeak / maxPeak;
  const newBuf = offlineCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuf.getChannelData(ch);
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * gain;
  }
  return newBuf;
}

// ── Render a sample sound to a Blob URL ──
async function renderSampleToBlob(sample: SampleSound): Promise<string> {
  const duration = 1.2;
  const sampleRate = 44100;
  const offCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  sample.synth(offCtx as unknown as AudioContext, offCtx.destination);
  const buffer = await offCtx.startRendering();
  const norm = normalizeBuffer(buffer);

  // Encode to WAV
  const wav = encodeWAV(norm);
  return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
}

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  function ws(off: number, s: string) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
  function wu32(off: number, v: number) { view.setUint32(off, v, true); }
  function wu16(off: number, v: number) { view.setUint16(off, v, true); }

  ws(0, 'RIFF'); wu32(4, 36 + dataSize); ws(8, 'WAVE');
  ws(12, 'fmt '); wu32(16, 16); wu16(20, 1); wu16(22, numChannels);
  wu32(24, sampleRate); wu32(28, byteRate); wu16(32, blockAlign); wu16(34, bitDepth);
  ws(36, 'data'); wu32(40, dataSize);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return ab;
}

// ── Individual Sound Card ──
function SoundCard({
  slot,
  url,
  uploading,
  onUpload,
  onClear,
  onSelectSample,
}: {
  slot: SoundSlot;
  url: string;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, key: string) => void;
  onClear: (key: string) => void;
  onSelectSample: (key: string, blobUrl: string) => void;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [loadingBuf, setLoadingBuf] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [previewSample, setPreviewSample] = useState<string | null>(null);
  const [samplePlaying, setSamplePlaying] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleBlobsRef = useRef<Record<string, string>>({});

  // Load audio buffer for waveform + normalized playback
  useEffect(() => {
    if (!url) { setAudioBuffer(null); return; }
    let cancelled = false;
    setLoadingBuf(true);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(ab => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.decodeAudioData(ab);
      })
      .then(buf => {
        if (!cancelled) {
          setAudioBuffer(normalizeBuffer(buf));
          durationRef.current = buf.duration;
        }
      })
      .catch(() => { if (!cancelled) setAudioBuffer(null); })
      .finally(() => { if (!cancelled) setLoadingBuf(false); });
    return () => { cancelled = true; };
  }, [url]);

  function stopAnim() {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  }

  function updateProgress() {
    if (!audioCtxRef.current || !audioBuffer) return;
    const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
    const pct = Math.min((elapsed / durationRef.current) * 100, 100);
    setProgress(pct);
    if (pct < 100) {
      animRef.current = requestAnimationFrame(updateProgress);
    } else {
      setPlaying(false);
      setProgress(0);
    }
  }

  async function togglePlay() {
    if (!url || !audioBuffer) return;

    if (playing) {
      sourceRef.current?.stop();
      setPlaying(false);
      stopAnim();
      setProgress(0);
      return;
    }

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => { setPlaying(false); setProgress(0); stopAnim(); };
    sourceRef.current = source;

    startTimeRef.current = ctx.currentTime;
    source.start();
    setPlaying(true);
    animRef.current = requestAnimationFrame(updateProgress);
  }

  // Play sample preview
  async function playSample(sample: SampleSound) {
    // Stop any playing sample
    sampleAudioRef.current?.pause();
    setSamplePlaying(null);

    if (samplePlaying === sample.id) return;

    // Get or render blob
    if (!sampleBlobsRef.current[sample.id]) {
      sampleBlobsRef.current[sample.id] = await renderSampleToBlob(sample);
    }
    const blobUrl = sampleBlobsRef.current[sample.id];
    const audio = new Audio(blobUrl);
    sampleAudioRef.current = audio;
    audio.onended = () => setSamplePlaying(null);
    audio.play().then(() => setSamplePlaying(sample.id)).catch(() => {});
  }

  async function useSample(sample: SampleSound) {
    if (!sampleBlobsRef.current[sample.id]) {
      sampleBlobsRef.current[sample.id] = await renderSampleToBlob(sample);
    }
    onSelectSample(slot.key, sampleBlobsRef.current[sample.id]);
    setShowSamples(false);
    toast.success(`"${sample.label}" selected — click Save to apply`);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      stopAnim();
      sourceRef.current?.stop();
      sampleAudioRef.current?.pause();
      audioCtxRef.current?.close();
    };
  }, []);

  function formatDur(s: number) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  }

  const fileName = url
    ? url.startsWith('blob:')
      ? 'iOS Sample Sound'
      : (url.split('/').pop()?.split('?')[0]?.split('_').slice(2).join('_') || 'sound.mp3')
    : '';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0 text-xl">
          {slot.emoji}
        </div>
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">{slot.label}</p>
          <p className="text-xs text-muted-foreground">{slot.desc}</p>
        </div>
        {url && (
          <span className="text-[10px] px-2 py-0.5 bg-green-500/15 text-green-400 rounded-full font-bold">
            Custom ✓
          </span>
        )}
      </div>

      {/* Waveform + Player */}
      <div className="mx-4 mb-3">
        {url ? (
          <div className="p-3 bg-muted/30 border border-border/60 rounded-xl">
            {/* Waveform */}
            <div className="mb-2.5 relative">
              {loadingBuf && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <WaveformCanvas audioBuffer={audioBuffer} playing={playing} progress={progress} />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                disabled={loadingBuf || !audioBuffer}
                className={`w-8 h-8 rounded-lg flex items-center justify-center press flex-shrink-0 transition-all disabled:opacity-40 ${playing ? 'gradient-pink' : 'bg-primary/15 hover:bg-primary/25'}`}
              >
                {playing
                  ? <Pause className="w-3.5 h-3.5 text-white" />
                  : <Play className="w-3.5 h-3.5 text-primary" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground font-medium truncate">{fileName}</p>
                <div className="flex justify-between">
                  <span className="text-[9px] text-muted-foreground">
                    {playing ? formatDur((progress / 100) * durationRef.current) : '0:00'}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{formatDur(durationRef.current)}</span>
                </div>
              </div>
              <button
                onClick={() => onClear(slot.key)}
                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center press"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-muted/20 border border-dashed border-border rounded-xl">
            <WaveformCanvas audioBuffer={null} playing={false} progress={0} />
          </div>
        )}
      </div>

      {/* iOS Sample Picker */}
      <div className="px-4 mb-3">
        <button
          onClick={() => setShowSamples(v => !v)}
          className="w-full flex items-center gap-2 p-2.5 bg-muted/40 border border-border/60 rounded-xl hover:border-primary/30 transition-all press"
        >
          <Smartphone className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs font-bold text-foreground flex-1 text-left">iOS Default Sounds</span>
          <span className="text-[10px] text-muted-foreground">6 sounds · tap to preview</span>
        </button>

        {showSamples && (
          <div className="mt-2 p-3 bg-muted/30 border border-border/50 rounded-xl space-y-1.5 animate-slide-up">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-2">
              ▶ Preview → ✓ Use as default
            </p>
            {IOS_SAMPLES.map(sample => (
              <div
                key={sample.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border hover:border-primary/30 transition-all"
              >
                <span className="text-base flex-shrink-0">{sample.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{sample.label}</p>
                  <p className="text-[10px] text-muted-foreground">{sample.desc}</p>
                </div>
                <button
                  onClick={() => playSample(sample)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center press transition-all flex-shrink-0 ${samplePlaying === sample.id ? 'gradient-pink' : 'bg-muted hover:bg-primary/10'}`}
                  title="Preview"
                >
                  {samplePlaying === sample.id
                    ? <Pause className="w-3 h-3 text-white" />
                    : <Play className="w-3 h-3 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => useSample(sample)}
                  className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center press flex-shrink-0"
                  title="Use this sound"
                >
                  <Check className="w-3 h-3 text-primary" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Sound button */}
      <div className="px-4 pb-3">
        {url && (
          <button
            onClick={() => {
              try {
                const audio = new Audio(url);
                audio.play().catch(() => {});
              } catch {}
            }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 rounded-xl text-xs font-bold text-green-400 press transition-all"
          >
            <Play className="w-3.5 h-3.5" /> Test Saved Sound
          </button>
        )}
        {!url && (
          <p className="text-center text-[10px] text-muted-foreground py-1">Upload or select a sound, then save to test it</p>
        )}
      </div>

      {/* Upload button */}
      <div className="px-4 pb-4">
        <label
          className={`flex items-center gap-2 p-3 border border-dashed rounded-xl cursor-pointer transition-all ${
            uploading
              ? 'border-primary/50 bg-primary/5'
              : 'border-primary/30 hover:bg-primary/5 hover:border-primary/50'
          }`}
        >
          {uploading
            ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <Upload className="w-4 h-4 text-primary" />}
          <span className="text-sm text-muted-foreground flex-1">
            {uploading ? 'Uploading...' : url ? 'Replace with own file' : 'Upload custom file (MP3, WAV · max 5MB)'}
          </span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => onUpload(e, slot.key)}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}

// ── Main AdminSounds component ──
export default function AdminSounds() {
  const [sounds, setSounds] = useState<Record<string, string>>({
    sound_notification: '',
    sound_messenger: '',
    sound_viproom: '',
    sound_signal: '',
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  // Track blob URLs that need to be uploaded on save
  const pendingBlobsRef = useRef<Record<string, string>>({});

  useEffect(() => { fetchSounds(); }, []);

  async function fetchSounds() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_sound_settings');
    if (data && !error) {
      setSounds({
        sound_notification: data.sound_notification || '',
        sound_messenger: data.sound_messenger || '',
        sound_viproom: data.sound_viproom || '',
        sound_signal: data.sound_signal || '',
      });
    } else {
      const { data: fallback } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'main')
        .single();
      if (fallback) {
        setSounds({
          sound_notification: (fallback as any).sound_notification || '',
          sound_messenger: (fallback as any).sound_messenger || '',
          sound_viproom: (fallback as any).sound_viproom || '',
          sound_signal: (fallback as any).sound_signal || '',
        });
      }
    }
    setLoading(false);
    setHasUnsaved(false);
    pendingBlobsRef.current = {};
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, key: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Please upload an audio file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }

    setUploading(key);
    const url = await uploadFile('media', `sounds/${key}_${Date.now()}_${file.name}`, file);
    setSounds(prev => ({ ...prev, [key]: url }));
    setUploading(null);
    setHasUnsaved(true);
    toast.success('Sound uploaded! Click "Save" to apply.');
    e.target.value = '';
  }

  // Called when admin picks an iOS sample sound (blob URL)
  function handleSelectSample(key: string, blobUrl: string) {
    setSounds(prev => ({ ...prev, [key]: blobUrl }));
    pendingBlobsRef.current[key] = blobUrl;
    setHasUnsaved(true);
  }

  async function saveAllSounds() {
    setSaving(true);
    let finalSounds = { ...sounds };

    // Upload any pending blob URLs
    for (const [key, blobUrl] of Object.entries(pendingBlobsRef.current)) {
      if (!blobUrl.startsWith('blob:')) continue;
      try {
        const res = await fetch(blobUrl);
        const blob = await res.blob();
        const file = new File([blob], `${key}_ios_sample.wav`, { type: 'audio/wav' });
        const uploaded = await uploadFile('media', `sounds/${key}_${Date.now()}_ios_sample.wav`, file);
        finalSounds[key] = uploaded;
        URL.revokeObjectURL(blobUrl);
      } catch {
        toast.error(`Failed to upload sample for ${key}`);
      }
    }
    pendingBlobsRef.current = {};

    // Save via RPC with direct fallback
    const results = await Promise.all([
      supabase.rpc('update_sound_setting', { p_key: 'sound_notification', p_value: finalSounds.sound_notification || null }),
      supabase.rpc('update_sound_setting', { p_key: 'sound_messenger',    p_value: finalSounds.sound_messenger    || null }),
      supabase.rpc('update_sound_setting', { p_key: 'sound_viproom',      p_value: finalSounds.sound_viproom      || null }),
      supabase.rpc('update_sound_setting', { p_key: 'sound_signal',       p_value: finalSounds.sound_signal       || null }),
    ]);

    // Check if RPC failed (schema cache issue) — fall back to direct update
    const hasRpcError = results.some(r => r.error);
    if (hasRpcError) {
      const { error: directErr } = await supabase.from('site_settings').update({
        sound_notification: finalSounds.sound_notification || null,
        sound_messenger: finalSounds.sound_messenger || null,
        sound_viproom: finalSounds.sound_viproom || null,
        sound_signal: finalSounds.sound_signal || null,
      } as any).eq('id', 'main');
      if (directErr) {
        toast.error('Save failed: ' + directErr.message);
        setSaving(false);
        return;
      }
    }

    // Verify save
    const { data: verify, error: verifyErr } = await supabase.rpc('get_sound_settings');
    if (verifyErr) {
      // Try direct read as fallback
      const { data: fallbackVerify } = await supabase.from('site_settings').select('sound_notification,sound_messenger,sound_viproom,sound_signal').eq('id', 'main').single();
      invalidateSoundCache();
      toast.success('Sounds saved & applied globally!');
      setHasUnsaved(false);
      if (fallbackVerify) {
        setSounds({
          sound_notification: (fallbackVerify as any).sound_notification || '',
          sound_messenger:    (fallbackVerify as any).sound_messenger    || '',
          sound_viproom:      (fallbackVerify as any).sound_viproom      || '',
          sound_signal:       (fallbackVerify as any).sound_signal       || '',
        });
      }
    } else {
      invalidateSoundCache();
      toast.success('Sounds saved & applied globally!');
      setHasUnsaved(false);
      if (verify) {
        setSounds({
          sound_notification: verify.sound_notification || '',
          sound_messenger:    verify.sound_messenger    || '',
          sound_viproom:      verify.sound_viproom      || '',
          sound_signal:       verify.sound_signal       || '',
        });
      }
    }
    setSaving(false);
  }

  async function clearSound(key: string) {
    setSounds(prev => ({ ...prev, [key]: '' }));
    delete pendingBlobsRef.current[key];
    await supabase.rpc('update_sound_setting', { p_key: key, p_value: null });
    invalidateSoundCache();
    toast.success('Sound cleared — using synthesized default');
    setHasUnsaved(false);
  }

  if (loading) return <div className="h-48 bg-muted/30 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl gradient-pink flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-black text-foreground">Notification Sounds</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose from built-in iOS-style sounds or upload your own file. Each sound has a live waveform preview with volume normalization.
        </p>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Auto volume normalization</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg">
            <Smartphone className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">6 iOS-style defaults</span>
          </div>
        </div>
      </div>

      {/* Sound slots */}
      {SOUND_SLOTS.map(slot => (
        <SoundCard
          key={slot.key}
          slot={slot}
          url={sounds[slot.key]}
          uploading={uploading === slot.key}
          onUpload={handleUpload}
          onClear={clearSound}
          onSelectSample={handleSelectSample}
        />
      ))}

      {/* Save */}
      <button
        onClick={saveAllSounds}
        disabled={saving}
        className={`w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 press disabled:opacity-50 transition-all ${
          hasUnsaved ? 'gradient-pink pink-glow' : 'gradient-pink opacity-80'
        }`}
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : hasUnsaved ? '💾 Save All Sounds (Unsaved Changes!)' : 'Save All Sounds'}
      </button>

      <button
        onClick={fetchSounds}
        className="w-full py-2.5 bg-muted border border-border rounded-2xl text-muted-foreground text-sm font-bold flex items-center justify-center gap-2 press hover:border-border/80 transition-all"
      >
        <RotateCcw className="w-4 h-4" /> Reload from Database
      </button>

      <div className="bg-muted/30 border border-border rounded-2xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed space-y-1">
          <span className="block">💡 <strong>iOS Samples</strong> — tap ▶ to preview, then ✓ to select. Click Save to upload & apply.</span>
          <span className="block">🎚️ <strong>Normalization</strong> — all sounds auto-adjusted to consistent volume.</span>
          <span className="block">📊 <strong>Waveform</strong> — pink bars show audio shape; animated while playing.</span>
          <span className="block">📁 <strong>Upload</strong> — MP3/WAV/OGG/M4A, max 5MB recommended under 100KB.</span>
        </p>
      </div>
    </div>
  );
}
