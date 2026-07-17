import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface Props {
  items: MediaItem[];
  maxWidth?: number;
  gridStyle?: string;
  /** If provided, clicking media calls this instead of opening an internal viewer */
  onMediaClick?: (items: MediaItem[], index: number) => void;
}

const GAP = 2;

function MediaThumb({ item, style, onClick }: { item: MediaItem; style?: React.CSSProperties; onClick: () => void }) {
  const isVideo = item.type === 'video';
  return (
    <div
      className="relative overflow-hidden bg-muted/40 cursor-pointer select-none rounded-[2px]"
      style={style}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {isVideo ? (
        <>
          <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </>
      ) : (
        <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
      )}
    </div>
  );
}

function SingleMedia({ item, onClick, maxWidth }: { item: MediaItem; onClick: () => void; maxWidth: number }) {
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const isVideo = item.type === 'video';

  useEffect(() => {
    if (isVideo) return;
    const img = new Image();
    img.onload = () => setNaturalRatio(img.naturalWidth / img.naturalHeight);
    img.src = item.url;
  }, [item.url, isVideo]);

  // Portrait-first sizing like Telegram — tall images show taller
  let displayHeight: number;
  const w = maxWidth;
  if (naturalRatio === null) displayHeight = Math.round(w * 1.25); // default portrait
  else if (naturalRatio < 0.5) displayHeight = Math.min(Math.round(w * 1.8), 480); // very portrait
  else if (naturalRatio < 0.75) displayHeight = Math.min(Math.round(w * 1.45), 420); // portrait
  else if (naturalRatio < 1.05) displayHeight = Math.round(w * 1.0); // squarish
  else if (naturalRatio > 1.8) displayHeight = Math.round(w * 0.5); // very wide
  else displayHeight = Math.round(w * 0.75); // landscape

  return (
    <div style={{ width: w, maxWidth: '100%' }} className="rounded-2xl overflow-hidden">
      <div className="relative overflow-hidden cursor-pointer select-none bg-muted/40" style={{ width: '100%', height: displayHeight }}
        onClick={e => { e.stopPropagation(); onClick(); }}>
        {isVideo ? (
          <>
            <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center shadow-xl">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </div>
            </div>
          </>
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
    </div>
  );
}

export default function TelegramMediaGrid({ items, maxWidth = 260, gridStyle = 'telegram', onMediaClick }: Props) {
  if (items.length === 0) return null;

  const open = (idx: number) => {
    if (onMediaClick) {
      onMediaClick(items, idx);
    }
    // No internal viewer — caller handles it
  };

  const count = items.length;
  const w = maxWidth;

  // ── TELEGRAM style ──
  if (gridStyle === 'telegram' || !gridStyle) {
    if (count === 1) return <SingleMedia item={items[0]} onClick={() => open(0)} maxWidth={w} />;
    if (count === 2) {
      const cellH = Math.round(w * 0.7);
      return (
        <div style={{ width: w, maxWidth: '100%', display: 'flex', gap: GAP }} className="rounded-2xl overflow-hidden">
          <MediaThumb item={items[0]} style={{ flex: 1, height: cellH }} onClick={() => open(0)} />
          <MediaThumb item={items[1]} style={{ flex: 1, height: cellH }} onClick={() => open(1)} />
        </div>
      );
    }
    if (count === 3) {
      const totalH = Math.round(w * 0.85);
      const rightH = Math.round((totalH - GAP) / 2);
      return (
        <div style={{ width: w, maxWidth: '100%', display: 'flex', gap: GAP, height: totalH }} className="rounded-2xl overflow-hidden">
          <div style={{ flex: '0 0 55%', height: totalH }}>
            <MediaThumb item={items[0]} style={{ width: '100%', height: '100%' }} onClick={() => open(0)} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, height: totalH }}>
            <MediaThumb item={items[1]} style={{ flex: 1, height: rightH }} onClick={() => open(1)} />
            <MediaThumb item={items[2]} style={{ flex: 1, height: rightH }} onClick={() => open(2)} />
          </div>
        </div>
      );
    }
    if (count === 4) {
      const cellH = Math.round((w - GAP) / 2 * 0.85);
      return (
        <div style={{ width: w, maxWidth: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }} className="rounded-2xl overflow-hidden">
          {items.map((item, i) => <MediaThumb key={i} item={item} style={{ height: cellH }} onClick={() => open(i)} />)}
        </div>
      );
    }
    if (count === 5) {
      const topH = Math.round(w * 0.45);
      const botH = Math.round(w * 0.33);
      return (
        <div style={{ width: w, maxWidth: '100%' }} className="rounded-2xl overflow-hidden">
          <div style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
            {items.slice(0, 2).map((item, i) => <MediaThumb key={i} item={item} style={{ flex: 1, height: topH }} onClick={() => open(i)} />)}
          </div>
          <div style={{ display: 'flex', gap: GAP }}>
            {items.slice(2, 5).map((item, i) => <MediaThumb key={i + 2} item={item} style={{ flex: 1, height: botH }} onClick={() => open(i + 2)} />)}
          </div>
        </div>
      );
    }
    // 6+
    const topH = Math.round(w * 0.55);
    const botH = Math.round(w * 0.3);
    const showExtra = count > 5;
    const extra = count - 5;
    return (
      <div style={{ width: w, maxWidth: '100%' }} className="rounded-2xl overflow-hidden">
        <div style={{ marginBottom: GAP }}>
          <MediaThumb item={items[0]} style={{ width: '100%', height: topH }} onClick={() => open(0)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: GAP }}>
          {items.slice(1, 5).map((item, i) => (
            <div key={i + 1} className="relative">
              <MediaThumb item={item} style={{ height: botH }} onClick={() => open(i + 1)} />
              {i === 3 && showExtra && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center cursor-pointer rounded-[2px]" onClick={e => { e.stopPropagation(); open(5); }}>
                  <span className="text-white text-lg font-black">+{extra}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── WHATSAPP style ──
  if (gridStyle === 'whatsapp') {
    if (count === 1) return <SingleMedia item={items[0]} onClick={() => open(0)} maxWidth={w} />;
    if (count === 2) {
      const h = Math.round(w * 0.6);
      return (
        <div style={{ width: w, maxWidth: '100%', display: 'flex', gap: GAP, height: h }} className="rounded-2xl overflow-hidden">
          <MediaThumb item={items[0]} style={{ flex: 1, height: h }} onClick={() => open(0)} />
          <MediaThumb item={items[1]} style={{ flex: 1, height: h }} onClick={() => open(1)} />
        </div>
      );
    }
    const totalH = Math.round(w * 0.9);
    const extra = count - 3;
    return (
      <div style={{ width: w, maxWidth: '100%', display: 'flex', gap: GAP, height: totalH }} className="rounded-2xl overflow-hidden">
        <div style={{ flex: '0 0 60%', height: totalH }}>
          <MediaThumb item={items[0]} style={{ width: '100%', height: '100%' }} onClick={() => open(0)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, height: totalH }}>
          <MediaThumb item={items[1]} style={{ flex: 1 }} onClick={() => open(1)} />
          <div className="relative flex-1">
            <MediaThumb item={items[2]} style={{ width: '100%', height: '100%' }} onClick={() => open(2)} />
            {extra > 0 && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center cursor-pointer rounded-[2px]" onClick={e => { e.stopPropagation(); open(3); }}>
                <span className="text-white text-xl font-black">+{extra}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 2-COLUMN ──
  if (gridStyle === 'grid2') {
    const cellH = Math.round((w - GAP) / 2 * 0.9);
    return (
      <div style={{ width: w, maxWidth: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }} className="rounded-2xl overflow-hidden">
        {items.map((item, i) => <MediaThumb key={i} item={item} style={{ height: cellH }} onClick={() => open(i)} />)}
      </div>
    );
  }

  // ── 3-COLUMN ──
  if (gridStyle === 'grid3') {
    const cellH = Math.round((w - 2 * GAP) / 3 * 0.9);
    return (
      <div style={{ width: w, maxWidth: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: GAP }} className="rounded-2xl overflow-hidden">
        {items.map((item, i) => <MediaThumb key={i} item={item} style={{ height: cellH }} onClick={() => open(i)} />)}
      </div>
    );
  }

  // ── STRIP ──
  if (gridStyle === 'strip') {
    const cellH = Math.round(w * 0.45);
    const cellW = Math.round(cellH * 0.75);
    return (
      <div style={{ display: 'flex', gap: GAP, overflowX: 'auto' }} className="rounded-2xl overflow-hidden scrollbar-hide">
        {items.map((item, i) => (
          <div key={i} style={{ flex: `0 0 ${cellW}px`, height: cellH }}>
            <MediaThumb item={item} style={{ width: '100%', height: '100%' }} onClick={() => open(i)} />
          </div>
        ))}
      </div>
    );
  }

  // ── MOSAIC ──
  if (gridStyle === 'mosaic') {
    const bigH = Math.round(w * 0.6);
    const pairs: JSX.Element[] = [];
    for (let i = 0; i < items.length; i += 3) {
      const bigLeft = i % 6 === 0;
      const group = items.slice(i, i + 3);
      pairs.push(
        <div key={i} style={{ display: 'flex', gap: GAP, marginBottom: GAP, height: bigH }}>
          {bigLeft ? (
            <>
              <div style={{ flex: '0 0 55%', height: bigH }}>
                {group[0] && <MediaThumb item={group[0]} style={{ width: '100%', height: '100%' }} onClick={() => open(i)} />}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP }}>
                {group[1] && <MediaThumb item={group[1]} style={{ flex: 1 }} onClick={() => open(i + 1)} />}
                {group[2] && <MediaThumb item={group[2]} style={{ flex: 1 }} onClick={() => open(i + 2)} />}
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP }}>
                {group[0] && <MediaThumb item={group[0]} style={{ flex: 1 }} onClick={() => open(i)} />}
                {group[1] && <MediaThumb item={group[1]} style={{ flex: 1 }} onClick={() => open(i + 1)} />}
              </div>
              <div style={{ flex: '0 0 55%', height: bigH }}>
                {group[2] && <MediaThumb item={group[2]} style={{ width: '100%', height: '100%' }} onClick={() => open(i + 2)} />}
              </div>
            </>
          )}
        </div>
      );
    }
    return <div style={{ width: w, maxWidth: '100%' }} className="rounded-2xl overflow-hidden">{pairs}</div>;
  }

  // Default fallback
  return <SingleMedia item={items[0]} onClick={() => open(0)} maxWidth={w} />;
}
