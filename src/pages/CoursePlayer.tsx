import {
  ArrowLeft, Play, Pause, BookOpen, Video, MessageCircle, Lock, FileText,
  Volume2, VolumeX, Maximize, SkipForward, SkipBack, ExternalLink,
  ChevronRight, Sun, Image as ImageIcon, Download, CheckCircle2
} from 'lucide-react';
import CourseCompleteModal from '@/components/features/CourseCompleteModal';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isVIPActive, WHATSAPP_NUMBER, openWhatsApp } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, CourseLesson } from '@/types';
import { toast } from 'sonner';

type Mode = null | 'videos' | 'mentor';

// ── PDF Viewer ──────────────────────────────────────────────
function PDFViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [mode, setMode] = useState<'embed' | 'object'>('embed');

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted press"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <p className="font-bold text-foreground text-sm flex-1">PDF Document</p>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-xl text-foreground text-xs font-bold press"><ExternalLink className="w-3.5 h-3.5" /> Open</a>
          <a href={url} download target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press"><Download className="w-3.5 h-3.5" /> Download</a>
        </div>
      </div>
      <div className="flex-1 relative bg-white">
        {mode === 'embed' && (
          <embed src={`${url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`} type="application/pdf" className="w-full h-full" onError={() => setMode('object')} />
        )}
        {mode === 'object' && (
          <object data={`${url}#toolbar=1&view=FitH`} type="application/pdf" className="w-full h-full">
            <div className="flex flex-col items-center justify-center h-full bg-card px-6 text-center">
              <FileText className="w-16 h-16 text-primary mb-4 opacity-60" />
              <p className="text-foreground font-bold mb-2">PDF Preview</p>
              <p className="text-sm text-muted-foreground mb-5">Your browser doesn't support inline PDF preview.</p>
              <a href={url} target="_blank" rel="noreferrer" className="px-6 py-3 gradient-pink rounded-xl text-white font-bold text-sm flex items-center gap-2 press pink-glow-xs"><ExternalLink className="w-4 h-4" /> Open PDF in Browser</a>
              <a href={url} download target="_blank" rel="noreferrer" className="mt-3 text-sm text-primary font-bold flex items-center gap-1.5 press"><Download className="w-4 h-4" /> Download PDF</a>
            </div>
          </object>
        )}
      </div>
    </div>
  );
}

// ── Image Fullscreen ──────────────────────────────────────────
function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center press"><ArrowLeft className="w-5 h-5 text-white" /></button>
      <a href={url} download onClick={e => e.stopPropagation()} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center press"><Download className="w-5 h-5 text-white" /></a>
      <img src={url} alt="media" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ── Premium Video Player ──────────────────────────────────────
function VideoPlayer({ src, onNext, onPrev, hasNext, hasPrev }: {
  src: string; onNext?: () => void; onPrev?: () => void; hasNext: boolean; hasPrev: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, resetHideTimer]);

  function togglePlay() {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
    resetHideTimer();
  }
  function handleVideoClick() {
    if (showControls) { if (playing) { setShowControls(false); if (hideTimer.current) clearTimeout(hideTimer.current); } } else { resetHideTimer(); }
  }
  function onTimeUpdate() {
    const v = videoRef.current; if (!v || !v.duration) return;
    setCurrentTime(v.currentTime); setProgress((v.currentTime / v.duration) * 100);
  }
  function onLoaded() { const v = videoRef.current; if (v) setDuration(v.duration); }
  function seek(val: number) { const v = videoRef.current; if (!v) return; v.currentTime = (val / 100) * v.duration; setProgress(val); }
  function setVol(val: number) { setVolume(val); if (videoRef.current) videoRef.current.volume = val; setMuted(val === 0); }
  function toggleMute() { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }
  function setPlaybackSpeed(s: number) { setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s; setShowSettings(false); }
  function skip(secs: number) { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.currentTime + secs, v.duration)); }
  function handleFullscreen() {
    const el = containerRef.current; if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      if ((screen as any).orientation?.lock) (screen as any).orientation.lock('landscape').catch(() => {});
      setFullscreen(true);
    } else { document.exitFullscreen(); setFullscreen(false); }
  }
  function formatDur(s: number) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

  return (
    <div ref={containerRef} className="relative bg-black select-none" style={{ cursor: showControls ? 'default' : 'none' }}>
      <video ref={videoRef} key={src} src={src} className="w-full"
        style={{ filter: `brightness(${brightness})`, display: 'block', maxHeight: fullscreen ? '100vh' : '45vh', objectFit: 'contain' }}
        onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoaded}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={handleVideoClick} playsInline
      />
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, rgba(0,0,0,0.3) 100%)' }}
        onClick={handleVideoClick}>
        <div className="flex items-center justify-between px-4 pt-3" onClick={e => e.stopPropagation()}>
          <div />
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="px-2.5 py-1 bg-black/40 rounded-lg flex items-center gap-1 press">
              <span className="text-white text-xs font-bold">{speed}x</span>
            </button>
            {showSettings && (
              <div className="absolute top-8 right-0 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-30 animate-scale-in min-w-[90px]">
                <div className="px-3 py-1.5 border-b border-border"><p className="text-[10px] text-muted-foreground font-bold uppercase">Speed</p></div>
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)} className={`block w-full px-3 py-2 text-sm text-left hover:bg-muted transition-all press ${speed === s ? 'text-primary font-bold' : 'text-foreground'}`}>
                    {s}x {speed === s ? '✓' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-8" onClick={e => e.stopPropagation()}>
          {hasPrev && <button onClick={onPrev} className="w-10 h-10 flex items-center justify-center press opacity-80"><SkipBack className="w-7 h-7 text-white fill-white" /></button>}
          <button onClick={e => { e.stopPropagation(); skip(-10); resetHideTimer(); }} className="w-10 h-10 flex items-center justify-center press">
            <div className="relative"><SkipBack className="w-6 h-6 text-white" /><span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white font-bold">10</span></div>
          </button>
          <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center press hover:bg-white/30 transition-all">
            {playing ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white ml-1" />}
          </button>
          <button onClick={e => { e.stopPropagation(); skip(10); resetHideTimer(); }} className="w-10 h-10 flex items-center justify-center press">
            <div className="relative"><SkipForward className="w-6 h-6 text-white" /><span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white font-bold">10</span></div>
          </button>
          {hasNext && <button onClick={onNext} className="w-10 h-10 flex items-center justify-center press opacity-80"><SkipForward className="w-7 h-7 text-white fill-white" /></button>}
        </div>
        <div className="px-4 pb-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white text-[11px] font-mono w-10 text-right flex-shrink-0">{formatDur(currentTime)}</span>
            <input ref={progressRef} type="range" min={0} max={100} step={0.1} value={progress} onChange={e => seek(+e.target.value)}
              className="flex-1 accent-pink-500 h-1.5 cursor-pointer rounded-full"
              style={{ background: `linear-gradient(to right, #FF1493 ${progress}%, rgba(255,255,255,0.3) ${progress}%)` }} />
            <span className="text-white text-[11px] font-mono w-10 flex-shrink-0">{formatDur(duration)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <button onClick={toggleMute} className="press">{muted || volume === 0 ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}</button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={e => setVol(+e.target.value)} className="w-20 accent-pink-500 h-1 cursor-pointer" />
            </div>
            <div className="flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-white/70" />
              <input type="range" min={0.2} max={2} step={0.1} value={brightness} onChange={e => setBrightness(+e.target.value)} className="w-16 accent-pink-500 h-1 cursor-pointer" />
            </div>
            <button onClick={handleFullscreen} className="press"><Maximize className="w-5 h-5 text-white" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main CoursePlayer ─────────────────────────────────────────
export default function CoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<string | null>(null);
  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [showComplete, setShowComplete] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);

  // Load course data
  useEffect(() => {
    if (!courseId) return;
    Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('course_lessons').select('*').eq('course_id', courseId).order('order_index'),
    ]).then(([{ data: c }, { data: l }]) => {
      if (c) setCourse(c);
      if (l) { setLessons(l); if (l.length > 0) setActiveLesson(l[0]); }
      setLoading(false);
    });
  }, [courseId]);

  // Load progress from DB + localStorage
  useEffect(() => {
    if (!courseId) return;
    // Instant cache from localStorage
    const saved = localStorage.getItem(`vaf_progress_${courseId}`);
    if (saved) {
      try { setCompletedLessons(new Set(JSON.parse(saved))); } catch {}
    }
    // Also sync from DB for cross-device persistence
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.from('course_progress').select('lesson_id').eq('user_id', session.user.id).eq('course_id', courseId).then(({ data }) => {
        if (data && data.length > 0) {
          const ids = new Set(data.map((d: any) => d.lesson_id as string));
          setCompletedLessons(ids);
          localStorage.setItem(`vaf_progress_${courseId}`, JSON.stringify([...ids]));
        }
      });
    });
  }, [courseId]);

  function markLessonComplete(lessonId: string) {
    setCompletedLessons(prev => {
      const next = new Set(prev);
      next.add(lessonId);
      localStorage.setItem(`vaf_progress_${courseId}`, JSON.stringify([...next]));
      // Persist to DB
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user || !courseId) return;
        supabase.from('course_progress').upsert(
          { user_id: session.user.id, lesson_id: lessonId, course_id: courseId },
          { onConflict: 'user_id,lesson_id' }
        );
      });
      return next;
    });
  }

  useEffect(() => {
    if (!lessons.length || courseCompleted) return;
    const accessibleLessons = lessons.filter(l => l.is_free || hasVIP);
    if (accessibleLessons.length > 0 && accessibleLessons.every(l => completedLessons.has(l.id))) {
      setCourseCompleted(true);
      setShowComplete(true);
    }
  }, [completedLessons, lessons, hasVIP, courseCompleted]);

  const activeIdx = lessons.findIndex(l => l.id === activeLesson?.id);
  const hasNext = activeIdx < lessons.length - 1;
  const hasPrev = activeIdx > 0;

  function goNext() { if (hasNext) setActiveLesson(lessons[activeIdx + 1]); }
  function goPrev() { if (hasPrev) setActiveLesson(lessons[activeIdx - 1]); }

  function getLessonMedia(lesson: CourseLesson) {
    if (lesson.video_url) return { type: 'video', url: lesson.video_url };
    if (lesson.file_url) {
      const ext = lesson.file_url.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return { type: 'pdf', url: lesson.file_url };
      if (['jpg','jpeg','png','gif','webp'].includes(ext || '')) return { type: 'image', url: lesson.file_url };
    }
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-muted-foreground mb-4">Course not found</p>
        <button onClick={() => navigate('/courses')} className="text-primary font-bold">← Back to Courses</button>
      </div>
    );
  }

  // Mode selection screen
  if (!mode) {
    return (
      <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 mb-6">
          <button onClick={() => navigate('/courses')} className="p-1.5 rounded-xl hover:bg-muted press"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground text-sm truncate">{course.title}</p>
            <p className="text-xs text-muted-foreground">{course.category}</p>
          </div>
        </div>
        <div className="flex-1 px-4 flex flex-col items-center justify-center gap-5 max-w-sm mx-auto w-full">
          <div className="text-center mb-2">
            <div className="w-20 h-20 rounded-3xl gradient-pink flex items-center justify-center mx-auto mb-4 pink-glow animate-float">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-1">Start Learning</h1>
            <p className="text-sm text-muted-foreground">{course.title}</p>
          </div>
          <button onClick={() => setMode('videos')} className="w-full p-5 bg-card border border-border rounded-3xl hover:border-primary/40 transition-all press card-hover text-left group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0 pink-glow-xs group-hover:scale-105 transition-transform">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-foreground text-base">Learn With Videos</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lessons.length} lessons · Self-paced</p>
              </div>
              <ChevronRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['HD Videos', 'Speed Control', 'Brightness', 'PDF & Images'].map(f => (
                <span key={f} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{f}</span>
              ))}
            </div>
          </button>
          <button onClick={() => openWhatsApp(WHATSAPP_NUMBER, `Hello, I need a live mentor session for: ${course.title}`)}
            className="w-full p-5 bg-card border border-border rounded-3xl hover:border-green-500/40 transition-all press card-hover text-left group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform" style={{ boxShadow: '0 0 14px rgba(37,211,102,0.4)' }}>
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-foreground text-base">Live Mentor</p>
                <p className="text-xs text-muted-foreground mt-0.5">1-on-1 session · WhatsApp</p>
              </div>
              <ExternalLink className="w-5 h-5 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-[11px] text-green-400">Opens WhatsApp for live 1-on-1 tutoring with the admin</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Video/content player mode
  const media = activeLesson ? getLessonMedia(activeLesson) : null;
  const displayName = profile?.full_name || profile?.username || 'Student';
  const accessibleCount = lessons.filter(l => l.is_free || hasVIP).length;
  const completionPercent = accessibleCount ? Math.round((completedLessons.size / accessibleCount) * 100) : 0;

  return (
    <>
      {pdfViewer && <PDFViewer url={pdfViewer} onClose={() => setPdfViewer(null)} />}
      {imageViewer && <ImageViewer url={imageViewer} onClose={() => setImageViewer(null)} />}
      {showComplete && course && (
        <CourseCompleteModal userName={displayName} courseTitle={course.title} completionDate={new Date()} onClose={() => setShowComplete(false)} />
      )}
      <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'max(0px, env(safe-area-inset-top))' }}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 flex-shrink-0 sticky top-0 z-10" style={{ background: 'rgba(9,10,17,0.97)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setMode(null)} className="p-1.5 rounded-xl hover:bg-muted press"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{activeLesson?.title || course.title}</p>
            <p className="text-xs text-muted-foreground">{course.title} · {activeIdx + 1}/{lessons.length}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-[10px] text-muted-foreground">{completionPercent}%</p>
            <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-pink rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
            </div>
            {courseCompleted && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Main content area */}
          <div className="lg:flex-1 bg-black relative">
            {media?.type === 'video' ? (
              <VideoPlayer src={media.url} onNext={hasNext ? goNext : undefined} onPrev={hasPrev ? goPrev : undefined} hasNext={hasNext} hasPrev={hasPrev} />
            ) : media?.type === 'image' ? (
              <div className="w-full flex items-center justify-center bg-black relative" style={{ minHeight: '220px' }}>
                <img src={media.url} alt="lesson" className="max-w-full max-h-[45vh] object-contain cursor-pointer" onClick={() => setImageViewer(media.url)} />
                <button onClick={() => setImageViewer(media.url)} className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl text-white text-xs font-bold press">
                  <Maximize className="w-3.5 h-3.5" /> View Fullscreen
                </button>
              </div>
            ) : media?.type === 'pdf' ? (
              <div className="w-full flex flex-col items-center justify-center bg-card py-12 px-4">
                <FileText className="w-16 h-16 text-primary mb-4 opacity-60" />
                <p className="text-foreground font-bold mb-2">{activeLesson?.title}</p>
                <p className="text-xs text-muted-foreground mb-5">PDF Document · Tap to open</p>
                <button onClick={() => setPdfViewer(media.url)} className="px-6 py-3 gradient-pink rounded-xl text-white font-bold text-sm flex items-center gap-2 press pink-glow-xs">
                  <FileText className="w-4 h-4" /> Open PDF
                </button>
                <a href={media.url} download target="_blank" rel="noreferrer" className="mt-3 text-sm text-primary font-bold flex items-center gap-1.5 press">
                  <Download className="w-4 h-4" /> Download PDF
                </a>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center bg-black py-12">
                <Video className="w-12 h-12 text-muted-foreground opacity-30 mb-2" />
                <p className="text-sm text-muted-foreground">No media for this lesson</p>
                {activeLesson?.content && (
                  <div className="mt-4 px-6 max-w-lg text-center">
                    <p className="text-sm text-foreground leading-relaxed">{activeLesson.content}</p>
                  </div>
                )}
              </div>
            )}
            {/* Mark as Complete */}
            {activeLesson && (activeLesson.is_free || hasVIP) && !completedLessons.has(activeLesson.id) && (
              <div className="p-3 flex justify-center border-t border-border/30">
                <button onClick={() => markLessonComplete(activeLesson.id)} className="flex items-center gap-2 px-6 py-2.5 gradient-pink rounded-2xl text-white text-sm font-bold press pink-glow-xs shadow-lg">
                  <CheckCircle2 className="w-4 h-4" /> Mark as Complete
                </button>
              </div>
            )}
            {activeLesson && completedLessons.has(activeLesson.id) && (
              <div className="p-3 flex justify-center border-t border-border/30">
                <div className="flex items-center gap-2 px-6 py-2.5 bg-green-500/10 border border-green-500/25 rounded-2xl text-green-400 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Completed
                </div>
              </div>
            )}
          </div>

          {/* Lesson list sidebar */}
          <div className="lg:w-80 flex flex-col bg-card border-t lg:border-t-0 lg:border-l border-border overflow-y-auto" style={{ maxHeight: '55vh' }}>
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <p className="font-bold text-foreground text-sm">{lessons.length} Lessons</p>
            </div>
            <div className="divide-y divide-border/50">
              {lessons.map((lesson, idx) => {
                const canWatch = lesson.is_free || hasVIP;
                const isActive = activeLesson?.id === lesson.id;
                const lessonMedia = getLessonMedia(lesson);
                return (
                  <button key={lesson.id}
                    onClick={() => { if (!canWatch) { toast.error('Upgrade to VIP to unlock this lesson'); return; } setActiveLesson(lesson); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all press ${isActive ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/40'} ${completedLessons.has(lesson.id) && !isActive ? 'opacity-75' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'gradient-pink' : completedLessons.has(lesson.id) ? 'bg-green-500/20' : 'bg-muted'}`}>
                      {!canWatch ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        : completedLessons.has(lesson.id) && !isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        : isActive ? <Play className="w-3.5 h-3.5 text-white fill-white" />
                        : lessonMedia?.type === 'pdf' ? <FileText className="w-3 h-3 text-blue-400" />
                        : lessonMedia?.type === 'image' ? <ImageIcon className="w-3 h-3 text-purple-400" />
                        : lessonMedia?.type === 'video' ? <Video className="w-3 h-3 text-primary" />
                        : <span className="text-[11px] font-bold text-muted-foreground">{idx + 1}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-primary' : canWatch ? 'text-foreground' : 'text-muted-foreground'}`}>{lesson.title}</p>
                      {lesson.duration_minutes > 0 && <p className="text-[10px] text-muted-foreground">{lesson.duration_minutes} min</p>}
                    </div>
                    {lesson.is_free && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-bold flex-shrink-0">FREE</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
