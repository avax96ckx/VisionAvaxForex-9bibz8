import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface Props {
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export default function GlobalMediaViewer({ items, initialIndex = 0, onClose }: Props) {
  const [current, setCurrent] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Touch tracking refs
  const lastPinchDist = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const swipeStartX = useRef<number | null>(null);
  const lastTap = useRef<number>(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && scale <= 1) go(-1);
      if (e.key === 'ArrowRight' && scale <= 1) go(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, scale]);

  function go(dir: number) {
    resetZoom();
    setCurrent(c => Math.max(0, Math.min(items.length - 1, c + dir)));
  }

  function resetZoom() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      swipeStartX.current = touch.clientX;
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      offsetAtDragStart.current = { ...offset };
      isDraggingRef.current = false;

      // Double-tap to zoom
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (scale > 1) { resetZoom(); }
        else { setScale(2.5); }
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    } else if (e.touches.length === 2) {
      // Start pinch
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      swipeStartX.current = null;
      dragStartRef.current = null;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const ratio = dist / lastPinchDist.current;
        setScale(s => Math.min(7, Math.max(1, s * ratio)));
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && dragStartRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      if (scale > 1) {
        // Pan when zoomed
        isDraggingRef.current = true;
        setOffset({
          x: offsetAtDragStart.current.x + dx,
          y: offsetAtDragStart.current.y + dy,
        });
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    lastPinchDist.current = null;

    if (scale <= 1 && swipeStartX.current !== null && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
      if (Math.abs(deltaX) > 65 && !isDraggingRef.current) {
        go(deltaX < 0 ? 1 : -1);
      }
    }
    swipeStartX.current = null;
    dragStartRef.current = null;
    isDraggingRef.current = false;
  }

  // Mouse wheel zoom (desktop)
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale(s => Math.min(7, Math.max(1, s - e.deltaY * 0.003)));
    if (scale <= 1) setOffset({ x: 0, y: 0 });
  }

  // Mouse drag (desktop)
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null);
  const mouseOffsetAtStart = useRef({ x: 0, y: 0 });
  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    mouseOffsetAtStart.current = { ...offset };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!mouseStartRef.current || scale <= 1) return;
    setOffset({
      x: mouseOffsetAtStart.current.x + (e.clientX - mouseStartRef.current.x),
      y: mouseOffsetAtStart.current.y + (e.clientY - mouseStartRef.current.y),
    });
  }
  function onMouseUp() { mouseStartRef.current = null; }

  const item = items[current];
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-black/60">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-white text-sm font-bold">{current + 1} / {items.length}</span>
          {scale > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setScale(s => Math.max(1, s - 0.5))} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center press">
                <ZoomOut className="w-3 h-3 text-white" />
              </button>
              <span className="text-white/60 text-[10px] w-8 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(7, s + 0.5))} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center press">
                <ZoomIn className="w-3 h-3 text-white" />
              </button>
              <button onClick={resetZoom} className="text-[10px] text-primary px-2 py-0.5 bg-primary/10 rounded-full ml-1 press">Reset</button>
            </div>
          )}
        </div>
        <a href={item.url} download target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press">
          <Download className="w-4 h-4 text-white" />
        </a>
      </div>

      {/* Media area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{
          touchAction: 'none',
          cursor: scale > 1 ? (mouseStartRef.current ? 'grabbing' : 'grab') : 'default',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {item.type === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            className="max-w-full max-h-full"
            style={{ maxHeight: 'calc(100vh - 140px)' }}
          />
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt=""
            className="select-none"
            style={{
              maxWidth: scale > 1 ? 'none' : '100%',
              maxHeight: scale > 1 ? 'none' : 'calc(100vh - 140px)',
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transition: isDraggingRef.current || mouseStartRef.current ? 'none' : 'transform 0.15s ease',
              objectFit: 'contain',
              userSelect: 'none',
              WebkitUserDrag: 'none',
            } as React.CSSProperties}
            draggable={false}
            onDoubleClick={() => scale > 1 ? resetZoom() : setScale(2.5)}
          />
        )}

        {/* Nav arrows — only when not zoomed */}
        {scale <= 1 && current > 0 && (
          <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center press z-10">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        {scale <= 1 && current < items.length - 1 && (
          <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center press z-10">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Zoom hint */}
        {scale > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/40 text-[10px] select-none pointer-events-none bg-black/40 px-2 py-1 rounded-full">
            Pinch to zoom · Drag to pan · Double-tap to reset
          </div>
        )}
        {scale === 1 && items.length === 1 && item.type === 'image' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/30 text-[10px] select-none pointer-events-none">
            Pinch or scroll to zoom · Double-tap to zoom in
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="flex-shrink-0 flex gap-1.5 overflow-x-auto px-4 py-2 bg-black/60 justify-center">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => { resetZoom(); setCurrent(i); }}
              className={`flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all press ${i === current ? 'border-white' : 'border-transparent opacity-50'}`}
            >
              {it.type === 'video'
                ? <video src={it.url} className="w-full h-full object-cover" muted />
                : <img src={it.url} alt="" className="w-full h-full object-cover" />
              }
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
