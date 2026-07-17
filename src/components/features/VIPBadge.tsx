import type { BadgeStyle } from '@/types';

interface VIPBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  badgeStyle?: BadgeStyle;
  animate?: boolean;
  onClick?: () => void;
}

// ── Color definitions — solid flat colors + gradients ─────────────
type ColorDef = {
  solid?: string;           // flat single color (like the photos)
  from?: string;            // gradient start
  to?: string;              // gradient end
  mid?: string;             // gradient mid (3-stop)
  glow: string;
  checkColor?: string;      // checkmark color (default white)
};

const PALETTE: Record<string, ColorDef> = {
  // ── Solid blues ──
  blue:      { solid: '#1D9BF0', glow: '0 2px 10px rgba(29,155,240,0.7)' },
  blue2:     { solid: '#1565C0', glow: '0 2px 10px rgba(21,101,192,0.7)' },
  blue3:     { solid: '#0288D1', glow: '0 2px 10px rgba(2,136,209,0.7)' },
  blue4:     { solid: '#2979FF', glow: '0 2px 10px rgba(41,121,255,0.7)' },
  blue5:     { solid: '#003399', glow: '0 2px 10px rgba(0,51,153,0.7)' },
  sky:       { solid: '#29B6F6', glow: '0 2px 10px rgba(41,182,246,0.65)' },
  sky2:      { solid: '#81D4FA', glow: '0 2px 10px rgba(129,212,250,0.65)', checkColor: '#0277BD' },
  sky3:      { solid: '#4FC3F7', glow: '0 2px 10px rgba(79,195,247,0.65)' },
  // ── Purple ──
  purple:    { solid: '#9C27B0', glow: '0 2px 10px rgba(156,39,176,0.65)' },
  purple2:   { solid: '#7B1FA2', glow: '0 2px 10px rgba(123,31,162,0.65)' },
  purple3:   { solid: '#CE93D8', glow: '0 2px 10px rgba(206,147,216,0.6)', checkColor: '#6A1B9A' },
  indigo:    { solid: '#3F51B5', glow: '0 2px 10px rgba(63,81,181,0.65)' },
  indigo2:   { solid: '#283593', glow: '0 2px 10px rgba(40,53,147,0.65)' },
  // ── Green ──
  green:     { solid: '#43A047', glow: '0 2px 10px rgba(67,160,71,0.65)' },
  green2:    { solid: '#00C853', glow: '0 2px 10px rgba(0,200,83,0.65)' },
  green3:    { solid: '#1B5E20', glow: '0 2px 10px rgba(27,94,32,0.65)' },
  lime:      { solid: '#C6E727', glow: '0 2px 10px rgba(198,231,39,0.65)', checkColor: '#33691E' },
  lime2:     { solid: '#76FF03', glow: '0 2px 10px rgba(118,255,3,0.65)', checkColor: '#1B5E20' },
  // ── Red ──
  red:       { solid: '#E53935', glow: '0 2px 10px rgba(229,57,53,0.65)' },
  red2:      { solid: '#D50000', glow: '0 2px 10px rgba(213,0,0,0.65)' },
  red3:      { solid: '#FF1744', glow: '0 2px 10px rgba(255,23,68,0.65)' },
  // ── Pink ──
  pink:      { solid: '#E91E63', glow: '0 2px 10px rgba(233,30,99,0.65)' },
  pink2:     { solid: '#FF4081', glow: '0 2px 10px rgba(255,64,129,0.65)' },
  // ── Gold / Yellow / Orange ──
  gold:      { solid: '#FFB300', glow: '0 2px 10px rgba(255,179,0,0.7)', checkColor: '#4E2700' },
  gold2:     { solid: '#F9A825', glow: '0 2px 10px rgba(249,168,37,0.7)', checkColor: '#3E2723' },
  orange:    { solid: '#F4511E', glow: '0 2px 10px rgba(244,81,30,0.65)' },
  orange2:   { solid: '#FF6D00', glow: '0 2px 10px rgba(255,109,0,0.65)' },
  // ── Gray / Silver ──
  gray:      { solid: '#607D8B', glow: '0 2px 8px rgba(96,125,139,0.5)' },
  silver:    { solid: '#9E9E9E', glow: '0 2px 8px rgba(158,158,158,0.5)' },
  silver2:   { solid: '#BDBDBD', glow: '0 2px 8px rgba(189,189,189,0.5)', checkColor: '#424242' },
  // ── White ──
  white:     { solid: '#FFFFFF', glow: '0 2px 10px rgba(255,255,255,0.6)', checkColor: '#1565C0' },
  // ── Black ──
  black:     { solid: '#212121', glow: '0 2px 10px rgba(0,0,0,0.6)' },
  black2:    { solid: '#424242', glow: '0 2px 8px rgba(0,0,0,0.5)' },
  // ── Cyan / Teal ──
  cyan:      { solid: '#00BCD4', glow: '0 2px 10px rgba(0,188,212,0.65)' },
  cyan2:     { solid: '#00E5FF', glow: '0 2px 10px rgba(0,229,255,0.65)', checkColor: '#006064' },
  teal:      { solid: '#009688', glow: '0 2px 10px rgba(0,150,136,0.65)' },
  teal2:     { solid: '#004D40', glow: '0 2px 10px rgba(0,77,64,0.65)' },
  // ── Gradients ──
  rainbow:   { from: '#FF6B6B', to: '#4ECDC4', mid: '#FFD93D', glow: '0 2px 14px rgba(255,107,107,0.6)' },
  gradient:  { from: '#FF1493', to: '#7B2FF7', mid: '#00B4D8', glow: '0 2px 14px rgba(123,47,247,0.6)' },
  sunset:    { from: '#FF512F', to: '#F09819', mid: '#DD2476', glow: '0 2px 14px rgba(255,81,47,0.6)' },
  ocean:     { from: '#2196F3', to: '#00BCD4', mid: '#009688', glow: '0 2px 14px rgba(33,150,243,0.6)' },
  fire:      { from: '#FF0000', to: '#FFAB40', mid: '#FF6D00', glow: '0 2px 14px rgba(255,109,0,0.65)' },
  aurora:    { from: '#00C9FF', to: '#92FE9D', mid: '#7367F0', glow: '0 2px 14px rgba(0,201,255,0.6)' },
  neon:      { from: '#F11712', to: '#FF44CC', mid: '#00FFCC', glow: '0 2px 14px rgba(241,23,18,0.6)' },
};

function getColorDef(style: BadgeStyle): ColorDef {
  // Map style string to palette key
  const s = style as string;
  // Try full prefix (e.g. blue2, sky3, purple_burst → purple)
  const parts = s.split('_');
  if (parts.length >= 2) {
    // e.g. "blue2_burst" → prefix is "blue2"
    const prefix = parts[0];
    if (PALETTE[prefix]) return PALETTE[prefix];
    // Try without number suffix for legacy
    const basePrefix = prefix.replace(/\d+$/, '');
    if (PALETTE[basePrefix]) return PALETTE[basePrefix];
  }
  return PALETTE.blue;
}

// ── Shapes ────────────────────────────────────────────────────────

function buildPoly(cx: number, cy: number, r1: number, r2: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

// 10-point starburst (Twitter/Instagram default)
function BurstShape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 10.8, 7.5, 10)} fill={fill} />;
}
// Slightly different starburst — tighter teeth
function Burst2Shape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 11.0, 6.8, 10)} fill={fill} />;
}
// Burst with 14 points
function Burst3Shape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 10.8, 7.8, 14)} fill={fill} />;
}
// 12-point star seal (Instagram-style)
function StarShape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 10.5, 7.8, 12)} fill={fill} />;
}
// Circle
function CircleShape({ fill }: { fill: string }) {
  return <circle cx="12" cy="12" r="10.5" fill={fill} />;
}
// 8-petal wavy (cloud/flower)
function WavyShape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 10.5, 8.2, 8)} fill={fill} />;
}
// Stamp/Seal (16-point)
function SealShape({ fill }: { fill: string }) {
  return <polygon points={buildPoly(12, 12, 10.5, 8.0, 16)} fill={fill} />;
}

type ShapeName = 'burst' | 'burst2' | 'burst3' | 'star' | 'circle' | 'wavy' | 'seal';

function getShape(style: BadgeStyle): ShapeName {
  const s = style as string;
  const suffix = s.split('_').slice(1).join('_');
  if (suffix === 'shield' || suffix === 'burst') return 'burst';
  if (suffix === 'burst2') return 'burst2';
  if (suffix === 'burst3') return 'burst3';
  if (suffix === 'star') return 'star';
  if (suffix === 'circle') return 'circle';
  if (suffix === 'wavy') return 'wavy';
  if (suffix === 'seal') return 'seal';
  return 'burst';
}

// Build shine polygon points (same as shape but used for overlay)
function getShinePoints(shape: ShapeName): string {
  switch (shape) {
    case 'star': return buildPoly(12, 12, 10.5, 7.8, 12);
    case 'seal': return buildPoly(12, 12, 10.5, 8.0, 16);
    case 'wavy': return buildPoly(12, 12, 10.5, 8.2, 8);
    case 'burst2': return buildPoly(12, 12, 11.0, 6.8, 10);
    case 'burst3': return buildPoly(12, 12, 10.8, 7.8, 14);
    default: return buildPoly(12, 12, 10.8, 7.5, 10);
  }
}

export default function VIPBadge({
  size = 'sm',
  badgeStyle = 'blue_burst',
  animate = false,
  onClick,
}: VIPBadgeProps) {
  const dim = { xs: 14, sm: 17, md: 22, lg: 30 }[size];
  const uid = `vb-${badgeStyle}-${dim}`;
  const colorDef = getColorDef(badgeStyle);
  const shape = getShape(badgeStyle);
  const isGradient = !colorDef.solid;
  const checkColor = colorDef.checkColor || 'white';

  // Resolve fill value
  const fillValue = isGradient ? `url(#grad-${uid})` : colorDef.solid!;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      title="Verified"
      aria-label="Verified"
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        cursor: onClick ? 'pointer' : 'default',
        filter: `drop-shadow(${colorDef.glow})`,
        animation: animate ? 'badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
        transition: 'filter 0.2s ease',
      }}
    >
      <defs>
        {isGradient && (
          <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={colorDef.from} />
            {colorDef.mid && <stop offset="50%" stopColor={colorDef.mid} />}
            <stop offset="100%" stopColor={colorDef.to} />
          </linearGradient>
        )}
        {/* Subtle shine overlay */}
        <linearGradient id={`shine-${uid}`} x1="6" y1="2" x2="16" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.22" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main shape */}
      {shape === 'burst'   && <BurstShape  fill={fillValue} />}
      {shape === 'burst2'  && <Burst2Shape fill={fillValue} />}
      {shape === 'burst3'  && <Burst3Shape fill={fillValue} />}
      {shape === 'star'    && <StarShape   fill={fillValue} />}
      {shape === 'circle'  && <CircleShape fill={fillValue} />}
      {shape === 'wavy'    && <WavyShape   fill={fillValue} />}
      {shape === 'seal'    && <SealShape   fill={fillValue} />}

      {/* Shine overlay */}
      {shape === 'circle'
        ? <circle cx="12" cy="12" r="10.5" fill={`url(#shine-${uid})`} />
        : <polygon points={getShinePoints(shape)} fill={`url(#shine-${uid})`} />
      }

      {/* Checkmark */}
      <path
        d="M8 12.5L10.8 15.5L16 9"
        stroke={checkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
