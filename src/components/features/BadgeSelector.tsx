import { useState } from 'react';
import { X, Crown, Check } from 'lucide-react';
import VIPBadge from '@/components/features/VIPBadge';
import type { BadgeStyle } from '@/types';

interface BadgeSelectorProps {
  currentStyle: BadgeStyle;
  isVIP: boolean;
  onSelect: (style: BadgeStyle) => void;
  onClose: () => void;
  onUpgrade?: () => void;
}

// ── All badge groups ────────────────────────────────────────────────
const BADGE_GROUPS: { label: string; color: string; emoji: string; styles: BadgeStyle[] }[] = [
  {
    label: 'Blue',
    color: '#1D9BF0',
    emoji: '🔵',
    styles: ['blue_burst', 'blue_burst2', 'blue_burst3', 'blue_burst4', 'blue_star', 'blue_circle', 'blue_wavy', 'blue_seal'],
  },
  {
    label: 'Sky Blue',
    color: '#29B6F6',
    emoji: '🩵',
    styles: ['sky_burst', 'sky_burst2', 'sky_burst3', 'sky_star', 'sky_circle'],
  },
  {
    label: 'White',
    color: '#E0E0E0',
    emoji: '⚪',
    styles: ['white_burst', 'white_star', 'white_circle', 'white_seal'],
  },
  {
    label: 'Black',
    color: '#424242',
    emoji: '⚫',
    styles: ['black_burst', 'black_star', 'black_circle', 'black_seal'],
  },
  {
    label: 'Purple',
    color: '#9C27B0',
    emoji: '🟣',
    styles: ['purple_burst', 'purple_burst2', 'purple_burst3', 'purple_star', 'purple_circle', 'purple_wavy'],
  },
  {
    label: 'Indigo',
    color: '#3F51B5',
    emoji: '🫐',
    styles: ['indigo_burst', 'indigo_burst2', 'indigo_star'],
  },
  {
    label: 'Green',
    color: '#43A047',
    emoji: '🟢',
    styles: ['green_burst', 'green_burst2', 'green_burst3', 'green_star', 'green_circle', 'green_wavy'],
  },
  {
    label: 'Lime',
    color: '#C6E727',
    emoji: '🍏',
    styles: ['lime_burst', 'lime_burst2', 'lime_star'],
  },
  {
    label: 'Red',
    color: '#E53935',
    emoji: '🔴',
    styles: ['red_burst', 'red_burst2', 'red_burst3', 'red_star', 'red_circle'],
  },
  {
    label: 'Pink',
    color: '#E91E63',
    emoji: '🩷',
    styles: ['pink_burst', 'pink_burst2', 'pink_star', 'pink_circle'],
  },
  {
    label: 'Gold',
    color: '#FFB300',
    emoji: '🏅',
    styles: ['gold_burst', 'gold_burst2', 'gold_star', 'gold_circle'],
  },
  {
    label: 'Orange',
    color: '#F4511E',
    emoji: '🟠',
    styles: ['orange_burst', 'orange_burst2', 'orange_star'],
  },
  {
    label: 'Cyan',
    color: '#00BCD4',
    emoji: '💎',
    styles: ['cyan_burst', 'cyan_burst2', 'cyan_star'],
  },
  {
    label: 'Teal',
    color: '#009688',
    emoji: '🌊',
    styles: ['teal_burst', 'teal_burst2', 'teal_star'],
  },
  {
    label: 'Silver',
    color: '#9E9E9E',
    emoji: '🔘',
    styles: ['silver_burst', 'silver_star', 'gray_burst', 'gray_star', 'gray_circle'],
  },
  {
    label: 'Rainbow',
    color: 'linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF)',
    emoji: '🌈',
    styles: ['rainbow_burst', 'rainbow_star', 'rainbow_seal', 'rainbow_wavy'],
  },
  {
    label: 'Gradient',
    color: 'linear-gradient(90deg,#FF1493,#7B2FF7,#00B4D8)',
    emoji: '✨',
    styles: ['gradient_burst', 'gradient_star', 'gradient_seal'],
  },
  {
    label: 'Sunset',
    color: 'linear-gradient(90deg,#FF512F,#DD2476,#F09819)',
    emoji: '🌅',
    styles: ['sunset_burst', 'sunset_star'],
  },
  {
    label: 'Ocean',
    color: 'linear-gradient(90deg,#2196F3,#009688,#00BCD4)',
    emoji: '🌊',
    styles: ['ocean_burst', 'ocean_star'],
  },
  {
    label: 'Fire',
    color: 'linear-gradient(90deg,#FF0000,#FF6D00,#FFAB40)',
    emoji: '🔥',
    styles: ['fire_burst', 'fire_star'],
  },
  {
    label: 'Aurora',
    color: 'linear-gradient(90deg,#00C9FF,#7367F0,#92FE9D)',
    emoji: '🌌',
    styles: ['aurora_burst', 'aurora_star'],
  },
  {
    label: 'Neon',
    color: 'linear-gradient(90deg,#F11712,#FF44CC,#00FFCC)',
    emoji: '⚡',
    styles: ['neon_burst', 'neon_star'],
  },
];

const SHAPE_LABELS: Record<string, string> = {
  burst:   '10pt',
  burst2:  '10pt-B',
  burst3:  '14pt',
  burst4:  '10pt-D',
  burst5:  '10pt-E',
  star:    '12pt',
  circle:  'Circle',
  wavy:    'Cloud',
  seal:    'Stamp',
  shield:  '10pt',  // legacy
};

function getShapeLabel(style: BadgeStyle) {
  const suffix = (style as string).split('_').slice(1).join('_');
  return SHAPE_LABELS[suffix] || 'Badge';
}

export default function BadgeSelector({
  currentStyle,
  isVIP,
  onSelect,
  onClose,
  onUpgrade,
}: BadgeSelectorProps) {
  const [preview, setPreview] = useState<BadgeStyle>(currentStyle);
  const [saving, setSaving] = useState(false);

  async function handleApply() {
    if (!isVIP) return;
    setSaving(true);
    await onSelect(preview);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/80 flex items-end justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
          <div>
            <h3 className="font-black text-foreground text-base">Verification Badge</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isVIP ? `${BADGE_GROUPS.reduce((a, g) => a + g.styles.length, 0)}+ styles available` : 'VIP members only'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Non-VIP gate */}
        {!isVIP ? (
          <div className="px-5 py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl gradient-pink flex items-center justify-center mb-4 pink-glow animate-float">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h4 className="font-black text-foreground mb-1">VIP Feature</h4>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Upgrade to VIP to unlock custom verification badges and stand out.
            </p>
            <button
              onClick={() => { onClose(); onUpgrade?.(); }}
              className="px-6 py-3 gradient-pink rounded-xl text-white font-bold text-sm press pink-glow-xs"
            >
              Upgrade to VIP
            </button>
          </div>
        ) : (
          <>
            {/* Live preview */}
            <div className="flex items-center justify-center gap-3 py-4 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5 bg-card border border-border rounded-2xl px-5 py-3 shadow-lg">
                <div className="w-9 h-9 rounded-full gradient-pink flex items-center justify-center">
                  <span className="text-white text-sm font-black">V</span>
                </div>
                <span className="font-black text-foreground">Username</span>
                <VIPBadge size="md" badgeStyle={preview} animate />
              </div>
            </div>

            {/* Badge grid */}
            <div className="px-4 py-4 space-y-5 overflow-y-auto scrollbar-hide" style={{ maxHeight: '50vh' }}>
              {BADGE_GROUPS.map(group => (
                <div key={group.label}>
                  {/* Group label */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">{group.emoji}</span>
                    {/* Color swatch */}
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/15"
                      style={{
                        background: group.color.startsWith('linear') ? group.color : group.color,
                      }}
                    />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{group.label}</p>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  {/* Styles grid — 5 per row (compact) */}
                  <div className="grid grid-cols-5 gap-2">
                    {group.styles.map(style => {
                      const isSelected = preview === style;
                      const isActive = currentStyle === style;
                      return (
                        <button
                          key={style}
                          onClick={() => setPreview(style)}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition-all press ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-muted/30 hover:border-border/70'
                          }`}
                        >
                          <div className="relative">
                            <VIPBadge size="lg" badgeStyle={style} animate={isSelected} />
                            {isActive && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                                <Check className="w-2 h-2 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className={`text-[8px] font-semibold leading-none text-center px-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                            {getShapeLabel(style)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Apply button */}
            <div className="px-4 pt-2">
              <button
                onClick={handleApply}
                disabled={saving || preview === currentStyle}
                className="w-full py-3.5 gradient-pink rounded-2xl text-white font-black text-sm press pink-glow-xs disabled:opacity-40 transition-all"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying...
                  </span>
                ) : preview === currentStyle ? 'Badge Selected ✓' : 'Apply This Badge'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
