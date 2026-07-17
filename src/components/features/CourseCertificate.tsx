import { useEffect, useRef, useState } from 'react';
import { X, Download, Share2, Award } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userName: string;
  courseTitle: string;
  completionDate: Date;
  onClose: () => void;
}

export default function CourseCertificate({ userName, courseTitle, completionDate, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(true);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    generateCertificate();
  }, []);

  async function generateCertificate() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 1200;
    const H = 850;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // ── Background: deep dark gradient ──
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0010');
    bg.addColorStop(0.5, '#1a0020');
    bg.addColorStop(1, '#0a0010');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle background texture dots ──
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,20,147,${Math.random() * 0.12 + 0.03})`;
      ctx.fill();
    }
    ctx.restore();

    // ── Outer gold border (double line) ──
    const MARGIN = 28;
    // Outer
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 4;
    roundRect(ctx, MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2, 20);
    ctx.stroke();
    // Inner
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    roundRect(ctx, MARGIN + 12, MARGIN + 12, W - (MARGIN + 12) * 2, H - (MARGIN + 12) * 2, 14);
    ctx.stroke();

    // ── Gold corner ornaments ──
    drawCornerOrnament(ctx, MARGIN, MARGIN, 1, 1);
    drawCornerOrnament(ctx, W - MARGIN, MARGIN, -1, 1);
    drawCornerOrnament(ctx, MARGIN, H - MARGIN, 1, -1);
    drawCornerOrnament(ctx, W - MARGIN, H - MARGIN, -1, -1);

    // ── Top gold divider line with diamond ──
    const divY = 130;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(MARGIN + 30, divY);
    ctx.lineTo(W / 2 - 18, divY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 + 18, divY);
    ctx.lineTo(W - MARGIN - 30, divY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Diamond
    ctx.save();
    ctx.translate(W / 2, divY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();

    // ── Bottom divider ──
    const divY2 = H - 130;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(MARGIN + 30, divY2);
    ctx.lineTo(W / 2 - 18, divY2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 + 18, divY2);
    ctx.lineTo(W - MARGIN - 30, divY2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(W / 2, divY2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();

    // ── Organization name (top) ──
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('VISION AVAX FOREX', W / 2, 85);
    ctx.letterSpacing = '0px';

    // Small tagline
    ctx.fillStyle = 'rgba(255,215,0,0.55)';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('PROFESSIONAL TRADING EDUCATION', W / 2, 108);

    // ── "Certificate of Completion" heading ──
    ctx.font = 'italic bold 52px Georgia, serif';
    const grad1 = ctx.createLinearGradient(W / 2 - 280, 0, W / 2 + 280, 0);
    grad1.addColorStop(0, '#B8860B');
    grad1.addColorStop(0.5, '#FFD700');
    grad1.addColorStop(1, '#B8860B');
    ctx.fillStyle = grad1;
    ctx.fillText('Certificate of Completion', W / 2, 210);

    // ── "This is to certify that" ──
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('This is to certify that', W / 2, 278);

    // ── Recipient name ──
    const nameGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
    nameGrad.addColorStop(0, '#FF69B4');
    nameGrad.addColorStop(0.5, '#FF1493');
    nameGrad.addColorStop(1, '#FF69B4');
    ctx.fillStyle = nameGrad;
    ctx.font = 'bold 58px Georgia, serif';
    ctx.fillText(userName, W / 2, 355);

    // Underline under name
    const nameW = ctx.measureText(userName).width;
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(W / 2 - nameW / 2 - 10, 368);
    ctx.lineTo(W / 2 + nameW / 2 + 10, 368);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── "has successfully completed" ──
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('has successfully completed the course', W / 2, 410);

    // ── Course title ──
    const titleGrad = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0);
    titleGrad.addColorStop(0, '#FFD700');
    titleGrad.addColorStop(0.5, '#FFF8DC');
    titleGrad.addColorStop(1, '#FFD700');

    // Measure and wrap title if too long
    const maxTitleW = W - 160;
    ctx.font = 'bold 38px Georgia, serif';
    const titleLines = wrapText(ctx, courseTitle, maxTitleW);
    ctx.fillStyle = titleGrad;
    const titleStartY = titleLines.length === 1 ? 476 : 462;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, titleStartY + i * 50);
    });

    // ── Date & verification area ──
    const dateStr = completionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(`Awarded on ${dateStr}`, W / 2, 572);

    // ── Seal / badge ──
    drawSeal(ctx, W / 2, 650, 70);

    // ── Footer: website + ID ──
    ctx.fillStyle = 'rgba(255,215,0,0.4)';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('visionavaxforex.com', W / 2, H - 72);

    // Verification code
    const code = `VAF-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px monospace';
    ctx.fillText(`Certificate ID: ${code}`, W / 2, H - 52);

    const url = canvas.toDataURL('image/png', 1.0);
    setDataUrl(url);
    setGenerating(false);
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCornerOrnament(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number) {
    const SIZE = 40;
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + dx * 8, y);
    ctx.lineTo(x + dx * SIZE, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 8);
    ctx.lineTo(x, y + dy * SIZE);
    ctx.stroke();
    // small diamond at corner
    ctx.save();
    ctx.translate(x + dx * 4, y + dy * 4);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.restore();
  }

  function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    // Outer spiky border
    ctx.save();
    const spikes = 16;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const rad = i % 2 === 0 ? r + 10 : r - 2;
      const sx = cx + Math.cos(angle) * rad;
      const sy = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    const sealGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 10);
    sealGrad.addColorStop(0, '#7B006A');
    sealGrad.addColorStop(0.6, '#3D0033');
    sealGrad.addColorStop(1, '#FF1493');
    ctx.fillStyle = sealGrad;
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ✓ checkmark
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 2);
    ctx.lineTo(cx - 5, cy + 16);
    ctx.lineTo(cx + 20, cy - 14);
    ctx.stroke();

    ctx.restore();
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `certificate-${courseTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success('Certificate downloaded!');
  }

  async function handleShare() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'certificate.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${courseTitle} - Certificate`,
          text: `I just completed ${courseTitle} on VISION AVAX FOREX! 🎓`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-lg relative overflow-hidden animate-slide-up max-h-[95vh] flex flex-col">
        <div className="h-1.5 gradient-pink flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-pink flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-foreground text-sm">Certificate Ready!</h2>
              <p className="text-[11px] text-muted-foreground">Download or share your achievement</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="relative rounded-2xl overflow-hidden border border-border/50" style={{ aspectRatio: '1200/850' }}>
            <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-card">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">Generating certificate...</p>
                </div>
              </div>
            )}
          </div>

          {!generating && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 py-3 gradient-pink rounded-2xl text-white font-bold text-sm press pink-glow-xs"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 bg-muted border border-border rounded-2xl text-foreground font-bold text-sm press hover:border-primary/30 transition-all"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
