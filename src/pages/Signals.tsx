import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Filter, ZoomIn, ZoomOut, X } from 'lucide-react';
import { supabase, isVIPActive } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Signal } from '@/types';
import SignalCard from '@/components/features/SignalCard';
import { playSignalSound } from '@/lib/notificationSound';
import { notifyNewSignal } from '@/lib/browserNotifications';

type FilterType = 'active' | 'pending' | 'closed';

interface ImageViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

function ImageViewer({ url, title, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastPinch = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }
  function onPointerUp() { setDragging(false); }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinch.current !== null) setScale(s => Math.min(5, Math.max(1, s * (dist / lastPinch.current!))));
      lastPinch.current = dist;
    }
  }
  function onTouchEnd() { lastPinch.current = null; }
  function onWheel(e: React.WheelEvent) { e.preventDefault(); setScale(s => Math.min(5, Math.max(1, s - e.deltaY * 0.002))); }

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <span className="text-white text-sm font-bold">📊 {title}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { setScale(s => Math.max(1, s - 0.5)); setOffset({ x: 0, y: 0 }); }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center press">
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(5, s + 0.5))}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center press">
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center press ml-2">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <img
          src={url} alt={title}
          className="select-none"
          style={{
            maxWidth: '100%', maxHeight: '100%',
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: dragging ? 'none' : 'transform 0.1s ease',
            objectFit: 'contain',
          }}
          draggable={false}
        />
      </div>
      <p className="text-center text-[11px] text-white/40 py-2 flex-shrink-0">Pinch or scroll to zoom · Drag to pan</p>
    </div>
  );
}

export default function Signals() {
  const { profile, isAdmin } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('active');
  const [viewImage, setViewImage] = useState<{ url: string; title: string } | null>(null);
  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);
  const prevSignalCount = useRef(0);

  useEffect(() => {
    supabase.from('signals').select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) { setSignals(data); prevSignalCount.current = data.length; }
        setLoading(false);
      });

    // Poll for new signals — play special alert sound when new signal posted
    const pollInterval = setInterval(async () => {
      const { data } = await supabase.from('signals').select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) {
        const activeCount = data.filter(s => s.status === 'active').length;
        const prevActiveCount = prevSignalCount.current;
        if (activeCount > prevActiveCount && prevActiveCount > 0) {
          playSignalSound();
          // Browser notification for each new signal
          const prevIds = signals.map(s => s.id);
          data.filter(s => s.status === 'active' && !prevIds.includes(s.id)).forEach(s => {
            notifyNewSignal(s.pair, s.direction, s.type);
          });
        }
        prevSignalCount.current = activeCount;
        setSignals(data);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  const filters: { key: FilterType; label: string; emoji: string }[] = [
    { key: 'active', label: 'Active', emoji: '🟢' },
    { key: 'pending', label: 'Pending', emoji: '⏳' },
    { key: 'closed', label: 'Closed', emoji: '✅' },
  ];

  const filtered = signals.filter(s => {
    if (filter === 'closed') return s.status === 'closed';
    return s.status === filter;
  });
  const pinned = filtered.filter(s => s.is_pinned);
  const regular = filtered.filter(s => !s.is_pinned);

  function canViewSetup(s: Signal) {
    // Closed signals: everyone can view setup & result (to encourage VIP signup)
    if (s.status === 'closed') return true;
    // Free signals: everyone
    if (!s.is_vip) return true;
    // VIP signals that are active/pending: need VIP
    return hasVIP;
  }

  function renderSignal(s: Signal) {
    const hasSetup = !!(s as any).setup_image_url;
    const hasResult = !!(s as any).result_image_url;
    const canSeeSetup = canViewSetup(s);

    return (
      <SignalCard
        key={s.id}
        signal={s}
        hasAccess={hasVIP}
        // For closed signals, show even to non-VIP so they can see the results and be encouraged to join
        forceShowClosed={s.status === 'closed'}
        onViewSetup={hasSetup && canSeeSetup ? () => setViewImage({ url: (s as any).setup_image_url, title: `${s.pair} Setup` }) : undefined}
        onViewResult={hasResult && s.status === 'closed' ? () => setViewImage({ url: (s as any).result_image_url, title: `${s.pair} Result` }) : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 animate-fade-in" style={{ paddingTop: '70px' }}>
      {viewImage && <ImageViewer url={viewImage.url} title={viewImage.title} onClose={() => setViewImage(null)} />}

      <div className="px-3 py-4 mb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black text-foreground">Live Signals</h1>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-0.5" />
        </div>
        <p className="text-xs text-muted-foreground">Real-time forex, gold & crypto signals</p>
      </div>

      {/* Stats */}
      <div className="px-3 mb-4 grid grid-cols-3 gap-2">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-green-400">{signals.filter(s => s.status === 'active').length}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-yellow-400">{signals.filter(s => s.status === 'pending').length}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </div>
        <div className="bg-muted border border-border rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-foreground">{signals.filter(s => s.status === 'closed').length}</p>
          <p className="text-[10px] text-muted-foreground">Closed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 mb-4">
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-2xl text-xs font-bold transition-all press ${
                filter === f.key ? 'gradient-pink text-white pink-glow-xs' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}>
              <span className="text-base">{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No {filter} signals yet</p>
        </div>
      ) : (
        <div className="px-3 space-y-3">
          {pinned.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">📌 Pinned</p>
              {pinned.map(s => renderSignal(s))}
            </>
          )}
          {regular.length > 0 && (
            <>
              {pinned.length > 0 && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Others</p>}
              {regular.map(s => renderSignal(s))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
