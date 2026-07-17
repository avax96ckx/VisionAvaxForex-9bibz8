import { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropperProps {
  imageFile: File;
  aspectRatio: number;
  isCircular?: boolean;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  title?: string;
}

export default function ImageCropper({
  imageFile, aspectRatio, isCircular = false, onCrop, onCancel, title
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const lastPinchDist = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);

  // Canvas dimensions
  const canvasW = Math.min(window.innerWidth, 480);
  const canvasH = Math.min(window.innerHeight - 180, 480);

  // Crop region dimensions (85% of canvas width)
  const cropW = canvasW * 0.85;
  const cropH = isCircular ? cropW : cropW / aspectRatio;
  const cropX = (canvasW - cropW) / 2;
  const cropY = (canvasH - cropH) / 2;

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      // Calculate initial scale so image fills entire crop area (no black gaps ever)
      const scaleX = cropW / img.naturalWidth;
      const scaleY = cropH / img.naturalHeight;
      const initScale = Math.max(scaleX, scaleY) * 1.01; // tiny buffer
      initialScaleRef.current = initScale;
      setScale(initScale);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
      setLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, cropW, cropH]);

  // Render the canvas
  useEffect(() => {
    if (!loaded || !imageRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas || !imageRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const img = imageRef.current;

      ctx.clearRect(0, 0, cw, ch);

      // Helper to draw image at current transform
      const drawImg = () => {
        ctx.translate(cw / 2 + offset.x, ch / 2 + offset.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
      };

      // 1. Draw full image (below overlay)
      ctx.save();
      drawImg();
      ctx.restore();

      // 2. Dark overlay
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();

      // 3. Cut out bright crop region
      ctx.save();
      if (isCircular) {
        ctx.beginPath();
        ctx.arc(cw / 2, ch / 2, cropW / 2, 0, Math.PI * 2);
      } else {
        ctx.beginPath();
        ctx.rect(cropX, cropY, cropW, cropH);
      }
      ctx.clip();
      drawImg();
      ctx.restore();

      // 4. Border
      ctx.save();
      ctx.strokeStyle = '#FF1493';
      ctx.lineWidth = 2;
      if (isCircular) {
        ctx.beginPath();
        ctx.arc(cw / 2, ch / 2, cropW / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(cropX, cropY, cropW, cropH);
        // Rule-of-thirds
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 1; i < 3; i++) {
          ctx.moveTo(cropX + cropW * i / 3, cropY);
          ctx.lineTo(cropX + cropW * i / 3, cropY + cropH);
          ctx.moveTo(cropX, cropY + cropH * i / 3);
          ctx.lineTo(cropX + cropW, cropY + cropH * i / 3);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }, [loaded, scale, rotation, offset, cropW, cropH, cropX, cropY, isCircular]);

  // Pointer events
  function onPointerDown(e: React.PointerEvent) {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }
  function onPointerUp() { setIsDragging(false); }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale(s => Math.min(8, Math.max(initialScaleRef.current, s - e.deltaY * 0.002)));
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        setScale(s => Math.min(8, Math.max(initialScaleRef.current, s * (dist / lastPinchDist.current!))));
      }
      lastPinchDist.current = dist;
    }
  }
  function onTouchEnd() { lastPinchDist.current = null; }

  function handleCrop() {
    if (!imageRef.current) return;
    const img = imageRef.current;

    // Output canvas — same size as crop region
    const outW = Math.round(cropW * 2); // 2x for quality
    const outH = Math.round(isCircular ? cropW * 2 : cropH * 2);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const octx = out.getContext('2d')!;

    if (isCircular) {
      octx.beginPath();
      octx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      octx.clip();
    }

    // The crop region center in canvas space is (canvasW/2, canvasH/2) + adjustments
    // We need to map canvas-space crop center to image-space
    // Canvas center = (canvasW/2, canvasH/2), crop center = same (since cropX and cropY center it)
    // Offset moves the image, so at canvas center the image pixel coordinate is:
    // imgX = (-offset.x) / scale  (relative to image center)
    // imgY = (-offset.y) / scale

    // Scale factor from output to canvas crop: cropW/(outW) 
    const outScale = outW / cropW; // how many output pixels per canvas pixel

    octx.save();
    octx.translate(outW / 2 + offset.x * outScale, outH / 2 + offset.y * outScale);
    octx.rotate((rotation * Math.PI) / 180);
    octx.scale(scale * outScale, scale * outScale);
    octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    octx.restore();

    out.toBlob(blob => { if (blob) onCrop(blob); }, 'image/jpeg', 0.92);
  }

  return (
    <div className="fixed inset-0 z-[800] bg-black flex flex-col animate-fade-in" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onCancel} className="p-2 rounded-xl bg-white/10 press">
          <X className="w-5 h-5 text-white" />
        </button>
        <p className="font-black text-white text-sm">{title || 'Crop Photo'}</p>
        <button
          onClick={handleCrop}
          className="flex items-center gap-1.5 px-4 py-2 gradient-pink rounded-xl text-white text-sm font-bold press pink-glow-xs"
        >
          <Check className="w-4 h-4" /> Done
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            maxWidth: '100%',
            display: 'block',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-center gap-4 px-4 py-4 border-t border-white/10 flex-shrink-0"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => setScale(s => Math.max(initialScaleRef.current, s - 0.1))}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center press"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 max-w-[160px]">
          <input
            type="range"
            min={Math.round(initialScaleRef.current * 100)}
            max="800"
            step="5"
            value={Math.round(scale * 100)}
            onChange={e => setScale(+e.target.value / 100)}
            className="w-full accent-pink-500"
          />
          <p className="text-[10px] text-white/40 text-center mt-0.5">{Math.round(scale * 100)}% zoom</p>
        </div>
        <button
          onClick={() => setScale(s => Math.min(8, s + 0.1))}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center press"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setRotation(r => (r + 90) % 360)}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center press"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </button>
      </div>
      <p className="text-center text-[10px] text-white/30 pb-3 flex-shrink-0">
        Drag to position · Pinch or scroll to zoom · Tap Done when ready
      </p>
    </div>
  );
}
