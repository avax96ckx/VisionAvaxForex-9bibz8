import { useState, useEffect } from 'react';
import { Save, User, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import VIPBadge from '@/components/features/VIPBadge';
import type { BadgeStyle } from '@/types';
import { toast } from 'sonner';

interface ProfileStyles {
  tickPosition: 'inline' | 'below' | 'far-right';
  tickSize: 'xs' | 'sm' | 'md' | 'lg';
  nameFontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tickGap: 'tight' | 'normal' | 'wide';
  badgeStyle: BadgeStyle;
}

const DEFAULT_STYLES: ProfileStyles = {
  tickPosition: 'inline',
  tickSize: 'sm',
  nameFontSize: 'md',
  tickGap: 'tight',
  badgeStyle: 'blue_burst',
};

const NAME_FONT_SIZES: Record<string, string> = {
  xs: '13px', sm: '15px', md: '18px', lg: '22px', xl: '26px',
};
const TICK_GAPS: Record<string, string> = {
  touch: '-2px', closer: '0px', tight: '4px', normal: '8px', wide: '14px',
};

const BADGE_STYLES: BadgeStyle[] = [
  'blue_burst', 'blue2_burst', 'gold_burst', 'rainbow_burst',
  'gradient_burst', 'green_burst', 'purple_burst', 'pink_burst',
  'red_burst', 'orange_burst', 'sunset_burst', 'ocean_burst',
  'fire_burst', 'aurora_burst', 'blue_circle', 'gold_circle',
  'green_circle', 'purple_circle', 'blue_star', 'gold_star',
  'blue_seal', 'gold_seal',
];

export default function AdminProfileStyles() {
  const [styles, setStyles] = useState<ProfileStyles>(DEFAULT_STYLES);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('site_settings').select('profile_styles').eq('id', 'main').single()
      .then(({ data }) => {
        if (data?.profile_styles) {
          setStyles({ ...DEFAULT_STYLES, ...(data.profile_styles as any) });
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('site_settings')
      .update({ profile_styles: styles } as any)
      .eq('id', 'main');
    if (error) toast.error('Save failed: ' + error.message);
    else toast.success('Profile styles saved!');
    setSaving(false);
  }

  // Live preview name font size
  const previewFontSize = NAME_FONT_SIZES[styles.nameFontSize] || '18px';
  const previewGap = TICK_GAPS[styles.tickGap] || '4px';

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-5">
      {/* Live Preview */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-primary" /> Live Preview
        </p>

        {/* Preview container */}
        <div className="flex flex-col items-center gap-4 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.1), hsl(var(--primary)/0.03))' }}>
          {/* Avatar mock */}
          <div className="w-20 h-20 rounded-full gradient-pink flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>

          {/* Name + Badge preview */}
          {styles.tickPosition === 'inline' && (
            <div className="flex items-center" style={{ gap: previewGap }}>
              <span className="font-black text-foreground" style={{ fontSize: previewFontSize }}>John Trader</span>
              <VIPBadge size={styles.tickSize} badgeStyle={styles.badgeStyle} />
            </div>
          )}
          {styles.tickPosition === 'below' && (
            <div className="flex flex-col items-center" style={{ gap: '4px' }}>
              <span className="font-black text-foreground" style={{ fontSize: previewFontSize }}>John Trader</span>
              <VIPBadge size={styles.tickSize} badgeStyle={styles.badgeStyle} />
            </div>
          )}
          {styles.tickPosition === 'far-right' && (
            <div className="flex items-center w-full justify-center" style={{ gap: '32px' }}>
              <span className="font-black text-foreground" style={{ fontSize: previewFontSize }}>John Trader</span>
              <VIPBadge size={styles.tickSize} badgeStyle={styles.badgeStyle} />
            </div>
          )}

          {/* Profile pill preview (in header/chats) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/10">
            <div className="w-6 h-6 rounded-full gradient-pink flex-shrink-0" />
            <div className="flex items-center" style={{ gap: styles.tickPosition === 'inline' ? previewGap : '4px' }}>
              <span className="text-white font-bold text-xs">John Trader</span>
              {styles.tickPosition !== 'below' && <VIPBadge size={styles.tickSize} badgeStyle={styles.badgeStyle} />}
            </div>
            {styles.tickPosition === 'far-right' && <div className="flex-1" />}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profile Style Controls
        </h3>

        {/* Tick Position */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Blue Tick Position</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: 'inline', label: '🔵 Inline', desc: 'Next to name' },
              { val: 'below', label: '⬇️ Below', desc: 'Under name' },
              { val: 'far-right', label: '➡️ Far Right', desc: 'End of row' },
            ] as const).map(opt => (
              <button key={opt.val} onClick={() => setStyles(p => ({ ...p, tickPosition: opt.val }))}
                className={`p-2.5 rounded-xl border text-center press transition-all ${styles.tickPosition === opt.val ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                <p className="text-xs font-bold text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tick Size */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Blue Tick Size</p>
          <div className="grid grid-cols-4 gap-2">
            {(['xs', 'sm', 'md', 'lg'] as const).map(sz => (
              <button key={sz} onClick={() => setStyles(p => ({ ...p, tickSize: sz }))}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 press transition-all ${styles.tickSize === sz ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                <VIPBadge size={sz} badgeStyle={styles.badgeStyle} />
                <p className="text-[10px] font-bold text-foreground uppercase">{sz}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tick Gap (only shown for inline/far-right) */}
        {styles.tickPosition !== 'below' && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Gap Between Name & Tick</p>
            <div className="grid grid-cols-5 gap-2">
              {([
                { val: 'touch', label: 'Touch', px: '-2px' },
                { val: 'closer', label: 'Closer', px: '0px' },
                { val: 'tight', label: 'Tight', px: '4px' },
                { val: 'normal', label: 'Normal', px: '8px' },
                { val: 'wide', label: 'Wide', px: '14px' },
              ] as const).map(gap => (
                <button key={gap.val} onClick={() => setStyles(p => ({ ...p, tickGap: gap.val as any }))}
                  className={`p-2 rounded-xl border text-center press transition-all ${styles.tickGap === gap.val ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                  <p className="text-xs font-bold text-foreground">{gap.label}</p>
                  <p className="text-[10px] text-muted-foreground">{gap.px}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile Name Font Size */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Profile Name Font Size</p>
          <div className="grid grid-cols-5 gap-2">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(sz => (
              <button key={sz} onClick={() => setStyles(p => ({ ...p, nameFontSize: sz }))}
                className={`py-2 rounded-xl border text-center press transition-all ${styles.nameFontSize === sz ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                <p className="font-black text-foreground" style={{ fontSize: NAME_FONT_SIZES[sz] }}>A</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 uppercase">{sz}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Default Badge Style */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Default Badge Style (for new members)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {BADGE_STYLES.map(bs => (
              <button key={bs} onClick={() => setStyles(p => ({ ...p, badgeStyle: bs }))}
                className={`p-1.5 rounded-xl border press transition-all ${styles.badgeStyle === bs ? 'border-primary bg-primary/10' : 'border-border bg-muted/10'}`}
                title={bs}>
                <VIPBadge size="sm" badgeStyle={bs} />
              </button>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3 gradient-pink rounded-xl text-white font-bold flex items-center justify-center gap-2 press disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Profile Styles'}
        </button>
      </div>
    </div>
  );
}
