import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Trash2, Play, Pause } from 'lucide-react';
import { uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  onSend: (audioUrl: string, duration: number) => Promise<void>;
  disabled?: boolean;
  bucket?: string;
  folder?: string;
}

function formatDur(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Send icon (paper airplane) ──
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5" style={{ marginLeft: 2 }}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

// ── Telegram-style waveform bars ──
function WaveBar({ bars, progress, duration, isRecording }: {
  bars: number[];
  progress: number;
  duration: number;
  isRecording?: boolean;
}) {
  const filled = duration > 0 ? Math.floor((progress / duration) * bars.length) : 0;
  return (
    <div className="flex items-center gap-[2px] h-full w-full">
      {bars.map((h, i) => {
        const pct = Math.max(15, Math.min(100, h * 100));
        const active = isRecording ? true : i < filled;
        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-75"
            style={{
              height: `${pct}%`,
              background: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.32)',
              minWidth: 2,
              maxWidth: 4,
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceNoteRecorder({ onSend, disabled, bucket = 'media', folder = 'voice' }: Props) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recBars, setRecBars] = useState<number[]>(Array(48).fill(0.15));
  const [previewBars, setPreviewBars] = useState<number[]>(Array(48).fill(0.15));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recBarsBuf = useRef<number[]>(Array(48).fill(0.15));
  const mimeTypeRef = useRef<string>('audio/webm');
  const durationRef = useRef(0);

  const stopVisualizer = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    analyserRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    analyserRef.current = null;
    audioCtxRef.current = null;
  }, []);

  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const frame = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / 48));
        const newBars = Array.from({ length: 48 }, (_, i) => {
          const val = data[i * step] / 255;
          return 0.35 * (recBarsBuf.current[i] || 0.15) + 0.65 * Math.max(0.1, val);
        });
        recBarsBuf.current = newBars;
        setRecBars([...newBars]);
        animRef.current = requestAnimationFrame(frame);
      };
      animRef.current = requestAnimationFrame(frame);
    } catch {}
  }, []);

  async function startRecording() {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      durationRef.current = 0;
      setDuration(0);
      setRecBars(Array(48).fill(0.15));
      recBarsBuf.current = Array(48).fill(0.15);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg;codecs=opus';
      mimeTypeRef.current = mimeType;

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        setRecorded(blob);
        setRecordedUrl(url);
        // Freeze bars for preview
        const frozen = recBarsBuf.current.map((v, i) =>
          Math.min(1, Math.max(0.12, v) + Math.abs(Math.sin(i * 0.4)) * 0.2)
        );
        setPreviewBars(frozen);
        stopVisualizer();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setPhase('preview');
      };
      mr.start(100);
      setPhase('recording');
      startVisualizer(stream);
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(d => {
          if (d >= 300) { stopRecording(); return d; }
          return d + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone permission denied');
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
  }

  function cancelAll() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    stopVisualizer();
    audioRef.current?.pause();
    audioRef.current = null;
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecorded(null);
    setRecordedUrl(null);
    durationRef.current = 0;
    setDuration(0);
    setPlaying(false);
    setPlaybackTime(0);
    setRecBars(Array(48).fill(0.15));
    recBarsBuf.current = Array(48).fill(0.15);
    setPhase('idle');
  }

  function togglePlayback() {
    if (!recordedUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(recordedUrl);
      audioRef.current.ontimeupdate = () => setPlaybackTime(audioRef.current?.currentTime || 0);
      audioRef.current.onended = () => { setPlaying(false); setPlaybackTime(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  async function sendVoiceNote() {
    if (!recorded || !recordedUrl) return;
    setUploading(true);
    try {
      const ext = mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([recorded], `voice_${Date.now()}.${ext}`, { type: mimeTypeRef.current });
      const url = await uploadFile(bucket, `${folder}/voice_${Date.now()}.${ext}`, file);
      await onSend(url, durationRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
      URL.revokeObjectURL(recordedUrl);
      setRecorded(null);
      setRecordedUrl(null);
      durationRef.current = 0;
      setDuration(0);
      setPlaying(false);
      setPlaybackTime(0);
      setPreviewBars(Array(48).fill(0.15));
      setPhase('idle');
    } catch {
      toast.error('Failed to send voice note');
    }
    setUploading(false);
  }

  useEffect(() => {
    return () => {
      stopVisualizer();
      if (timerRef.current) clearInterval(timerRef.current);
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  // ── IDLE: plain mic button (circular, same size as send button) ──
  if (phase === 'idle') {
    return (
      <button
        onClick={startRecording}
        disabled={disabled}
        className="w-10 h-10 rounded-full flex items-center justify-center press flex-shrink-0 disabled:opacity-40 transition-all"
        style={{ background: 'rgba(40,40,55,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}
        title="Tap to record voice note"
      >
        <Mic className="w-5 h-5 text-white/70" />
      </button>
    );
  }

  // ── RECORDING: mic button is pulsing red (replaces idle mic), AND a floating bar above input ──
  if (phase === 'recording') {
    return (
      <>
        {/* Floating recording bar — fixed above keyboard */}
        <div
          className="fixed left-0 right-0 z-[900] px-3 animate-fade-in"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
        >
          <div
            className="flex items-center gap-2 w-full max-w-lg mx-auto"
            style={{
              height: 48,
              borderRadius: 28,
              background: '#1e1e2e',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0 10px',
            }}
          >
            {/* Trash — cancel */}
            <button
              onClick={cancelAll}
              className="w-8 h-8 rounded-full flex items-center justify-center press flex-shrink-0 transition-all"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <Trash2 className="w-4 h-4 text-white/60" />
            </button>

            {/* Live waveform — grows */}
            <div className="flex-1 h-8 py-0.5 min-w-0">
              <WaveBar bars={recBars} progress={0} duration={0} isRecording />
            </div>

            {/* Red timer */}
            <span className="text-red-400 text-xs font-black flex-shrink-0 tabular-nums min-w-[32px] text-right">
              {formatDur(duration)}
            </span>
          </div>
        </div>

        {/* Pulsing red mic button — tap to stop */}
        <button
          onClick={stopRecording}
          className="w-10 h-10 rounded-full flex items-center justify-center press flex-shrink-0"
          style={{
            background: '#ef4444',
            boxShadow: '0 0 14px rgba(239,68,68,0.75)',
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
          title="Tap to stop recording"
        >
          <Mic className="w-5 h-5 text-white" />
        </button>
      </>
    );
  }

  // ── PREVIEW: Telegram-style floating bar above input ──
  return (
    <>
      {/* Floating preview bar */}
      <div
        className="fixed left-0 right-0 z-[900] px-3 animate-fade-in"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
      >
        <div
          className="flex items-center gap-2 w-full max-w-lg mx-auto"
          style={{
            height: 52,
            borderRadius: 28,
            background: '#12121f',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '0 10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Trash — delete */}
          <button
            onClick={cancelAll}
            className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0 transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
            title="Discard"
          >
            <Trash2 className="w-4 h-4 text-white/65" />
          </button>

          {/* Blue pill: play + waveform + duration */}
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            style={{
              height: 38,
              borderRadius: 22,
              background: '#1a8cff',
              padding: '0 10px',
            }}
          >
            {/* Play/Pause circle */}
            <button
              onClick={togglePlayback}
              className="w-7 h-7 rounded-full flex items-center justify-center press flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.22)' }}
            >
              {playing
                ? <Pause className="w-3 h-3 text-white" />
                : <Play className="w-3 h-3 text-white" style={{ marginLeft: 1 }} />}
            </button>

            {/* Waveform */}
            <div className="flex-1 h-6 min-w-0">
              <WaveBar
                bars={previewBars}
                progress={playbackTime}
                duration={duration}
              />
            </div>

            {/* Duration */}
            <span className="text-white text-[11px] font-bold flex-shrink-0 tabular-nums" style={{ minWidth: 30 }}>
              {playing ? formatDur(playbackTime) : formatDur(duration)}
            </span>
          </div>

          {/* Send — blue circle with paper airplane */}
          <button
            onClick={sendVoiceNote}
            disabled={uploading}
            className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0 disabled:opacity-50"
            style={{ background: '#1a8cff', boxShadow: '0 2px 12px rgba(26,140,255,0.5)' }}
            title="Send voice note"
          >
            {uploading
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <SendIcon />}
          </button>
        </div>
      </div>

      {/* Keep a placeholder mic button in send slot (greyed out while preview is open) */}
      <button
        disabled
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 opacity-30"
        style={{ background: 'rgba(40,40,55,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <Mic className="w-5 h-5 text-white/70" />
      </button>
    </>
  );
}
