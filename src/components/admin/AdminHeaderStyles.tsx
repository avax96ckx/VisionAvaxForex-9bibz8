import { useState, useEffect } from 'react';
import { Save, Layout, Eye, RefreshCw, Smartphone, Upload, Image, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Modern Header Style Presets ──
const HEADER_STYLES = [
  {
    key: 'style_default',
    label: '🎯 Classic Center',
    desc: 'Bell left · Logo gradient center · Avatar right',
    config: { logoFontStyle: 'gradient', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'pill',
  },
  {
    key: 'style_black_pill',
    label: '⚫ Black Pill (Current)',
    desc: 'Dark pill with logo center + blue tick badge',
    config: { logoFontStyle: 'gradient', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'pill',
  },
  {
    key: 'style_gold',
    label: '🥇 Gold Trading',
    desc: 'Gold luxury text · Premium forex style',
    config: { logoFontStyle: 'gold', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'pill',
  },
  {
    key: 'style_white_clean',
    label: '⬜ Pure White',
    desc: 'Clean white text · Minimal modern',
    config: { logoFontStyle: 'white', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'flat',
  },
  {
    key: 'style_pink',
    label: '💗 Bold Pink',
    desc: 'Solid primary color · Strong brand presence',
    config: { logoFontStyle: 'solid_pink', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'pill',
  },
  {
    key: 'style_neon',
    label: '🌈 Neon Glow',
    desc: 'Neon gradient text · Crypto/trading vibe',
    config: { logoFontStyle: 'neon', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'floating',
  },
  {
    key: 'style_minimal_bell',
    label: '🔕 Minimal (No Icons)',
    desc: 'Logo only · Hide bell & messenger',
    config: { logoFontStyle: 'white', showBellIcon: false, showMessengerIcon: false },
    navStyle: 'minimal',
  },
  {
    key: 'style_telegram',
    label: '✈️ Telegram Style',
    desc: 'Blue-white gradient · Professional',
    config: { logoFontStyle: 'telegram_blue', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'flat',
  },
  {
    key: 'style_dark_bold',
    label: '🖤 Dark Bold',
    desc: 'Large bold white text · Dark aggressive',
    config: { logoFontStyle: 'white', showBellIcon: true, showMessengerIcon: false, logoFontSize: '16' },
    navStyle: 'pill',
  },
  {
    key: 'style_rainbow',
    label: '🎨 Rainbow Gradient',
    desc: 'Full color spectrum · Eye-catching',
    config: { logoFontStyle: 'rainbow', showBellIcon: true, showMessengerIcon: true },
    navStyle: 'floating',
  },
];

const LOGO_FONT_SIZES = [
  { key: '10', label: 'XS', px: '10px' },
  { key: '11', label: 'SM', px: '11px' },
  { key: '12', label: 'MD', px: '12px' },
  { key: '13', label: 'LG', px: '13px' },
  { key: '14', label: 'XL', px: '14px' },
  { key: '16', label: '2XL', px: '16px' },
  { key: '18', label: '3XL', px: '18px' },
];

const LOGO_FONT_STYLES = [
  { key: 'gradient', label: 'White → Pink Gradient', preview: { background: 'linear-gradient(90deg, #fff 0%, #FF69B4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
  { key: 'solid_pink', label: 'Solid Primary Color', preview: { color: 'hsl(var(--primary))' } },
  { key: 'white', label: 'Pure White', preview: { color: '#ffffff' } },
  { key: 'gold', label: '🥇 Gold Luxury', preview: { background: 'linear-gradient(90deg, #f5d020 0%, #f6d365 50%, #fda085 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
  { key: 'neon', label: '✨ Neon Glow', preview: { background: 'linear-gradient(90deg, #00f5d4 0%, #00bbf9 50%, #f15bb5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
  { key: 'telegram_blue', label: '✈️ Telegram Blue', preview: { background: 'linear-gradient(90deg, #2AABEE 0%, #229ED9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
  { key: 'rainbow', label: '🌈 Rainbow', preview: { background: 'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
  { key: 'fire', label: '🔥 Fire Orange', preview: { background: 'linear-gradient(90deg, #f12711 0%, #f5af19 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
];

const LOGO_POSITIONS = [
  { key: 'center', label: '⊙ Center' },
  { key: 'left', label: '← Left' },
];

interface HeaderConfig {
  logoFontSize: string;
  logoFontStyle: string;
  logoPosition: string;
  showBellIcon: boolean;
  showMessengerIcon: boolean;
  memberNameSize: string;
  badgeSpacing: string;
}

const DEFAULT_CONFIG: HeaderConfig = {
  logoFontSize: '13',
  logoFontStyle: 'gradient',
  logoPosition: 'center',
  showBellIcon: true,
  showMessengerIcon: true,
  memberNameSize: 'sm',
  badgeSpacing: 'normal',
};

// Live preview of header
function HeaderPreview({ config, websiteName }: { config: HeaderConfig; websiteName: string }) {
  function getLogoStyle(): React.CSSProperties {
    const size = parseInt(config.logoFontSize || '13');
    const baseStyle: React.CSSProperties = { fontSize: size, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 };
    switch (config.logoFontStyle) {
      case 'gradient': return { ...baseStyle, background: 'linear-gradient(90deg, #fff 0%, #FF1493 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      case 'solid_pink': return { ...baseStyle, color: '#FF1493' };
      case 'white': return { ...baseStyle, color: '#fff' };
      case 'gold': return { ...baseStyle, background: 'linear-gradient(90deg, #f5d020, #fda085)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      case 'neon': return { ...baseStyle, background: 'linear-gradient(90deg, #00f5d4, #00bbf9, #f15bb5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      case 'telegram_blue': return { ...baseStyle, background: 'linear-gradient(90deg, #2AABEE, #229ED9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      case 'rainbow': return { ...baseStyle, background: 'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      case 'fire': return { ...baseStyle, background: 'linear-gradient(90deg, #f12711, #f5af19)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
      default: return { ...baseStyle, color: '#fff' };
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 mb-4" style={{ background: 'rgba(8,9,14,0.97)' }}>
      <div className="flex items-center px-3 h-12 gap-2">
        {/* Left */}
        {config.showBellIcon ? (
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px]">🔔</span>
          </div>
        ) : <div className="w-7" />}

        {/* Center */}
        <div className={`flex-1 flex items-center gap-1.5 ${config.logoPosition === 'center' ? 'justify-center' : 'justify-start'}`}>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-black text-white">VM</span>
          </div>
          <span style={getLogoStyle()} className="truncate max-w-[140px]">
            {websiteName || 'VISION AVAX FOREX'}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
            <circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
            <path d="M6.5 12.5L10 16L17.5 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {config.showMessengerIcon && (
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-[10px]">💬</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">A</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHeaderStyles() {
  const [config, setConfig] = useState<HeaderConfig>(DEFAULT_CONFIG);
  const [websiteName, setWebsiteName] = useState('VISION AVAX FOREX');
  const [showHeader, setShowHeader] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [navStyle, setNavStyle] = useState('pill');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    supabase.from('site_settings').select('website_name,show_header,show_bottom_nav,header_config,nav_style,logo_url').eq('id', 'main').single().then(({ data }) => {
      if (data) {
        setWebsiteName((data as any).website_name || 'VISION AVAX FOREX');
        setShowHeader((data as any).show_header !== false);
        setShowBottomNav((data as any).show_bottom_nav !== false);
        setNavStyle((data as any).nav_style || 'pill');
        if ((data as any).header_config) {
          setConfig(prev => ({ ...prev, ...(data as any).header_config }));
        }
        if ((data as any).logo_url) setLogoUrl((data as any).logo_url);
      }
      setLoading(false);
    });
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const path = `logo_${Date.now()}.${file.name.split('.').pop() || 'png'}`;
    const encodedPath = encodeURIComponent(path);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/banners/${encodedPath}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': file.type || 'image/png', 'x-upsert': 'true' },
      body: file,
    });
    if (res.ok) {
      const url = `${supabaseUrl}/storage/v1/object/public/banners/${encodedPath}`;
      setLogoUrl(url);
      await supabase.from('site_settings').update({ logo_url: url } as any).eq('id', 'main');
      toast.success('✅ Logo uploaded & saved!');
    } else {
      toast.error('Upload failed. Try again.');
    }
    setUploadingLogo(false);
    e.target.value = '';
  }

  async function save() {
    setSaving(true);
    await supabase.from('site_settings').update({
      website_name: websiteName,
      show_header: showHeader,
      show_bottom_nav: showBottomNav,
      header_config: config,
      nav_style: navStyle,
      logo_url: logoUrl || null,
    } as any).eq('id', 'main');
    toast.success('✅ Header settings saved! Reload the page to see changes.');
    setSaving(false);
  }

  function applyPreset(style: typeof HEADER_STYLES[0]) {
    setConfig(prev => ({ ...prev, ...style.config }));
    setNavStyle(style.navStyle);
    toast.success(`Style "${style.label}" applied`);
  }

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Live Preview */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Live Preview
        </h3>
        <HeaderPreview config={config} websiteName={websiteName} />
        <p className="text-[10px] text-muted-foreground text-center">Preview updates instantly as you change settings below</p>
      </div>

      {/* Logo Upload */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" /> Brand Logo (Header Icon)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Pakia picha ya logo — itaonekana kwenye header na chat headers zote badala ya VM circle</p>
        <div className="flex items-center gap-3">
          {/* Preview */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border border-border">
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-xl font-black text-primary">VM</span>
            }
          </div>
          <div className="flex-1">
            <label className="flex items-center gap-2 p-2.5 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingLogo
                ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                : <Upload className="w-4 h-4 text-primary" />
              }
              <span className="text-sm text-muted-foreground flex-1">{uploadingLogo ? 'Uploading...' : logoUrl ? '↩️ Replace Logo' : 'Upload Logo (PNG/JPG)'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
            {logoUrl && (
              <button
                onClick={async () => { setLogoUrl(''); await supabase.from('site_settings').update({ logo_url: null } as any).eq('id', 'main'); toast.success('Logo removed'); }}
                className="mt-1.5 text-xs text-red-400 hover:text-red-300 press"
              >✕ Remove Logo</button>
            )}
          </div>
        </div>
      </div>

      {/* Style Presets */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <Layout className="w-4 h-4 text-primary" /> Style Presets (10 Styles)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Gonga preset kubadilisha style ya header mara moja</p>
        <div className="grid grid-cols-2 gap-2">
          {HEADER_STYLES.map(style => (
            <button
              key={style.key}
              onClick={() => applyPreset(style)}
              className="flex flex-col gap-1 p-3 rounded-xl border-2 transition-all press text-left hover:border-primary/50 active:scale-[0.97]"
              style={{ borderColor: 'hsl(var(--border))' }}
            >
              <p className="text-xs font-bold text-foreground leading-tight">{style.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Website Name */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Layout className="w-4 h-4 text-primary" /> Website Name & Logo Text
        </h3>
        <input
          className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary mb-4"
          value={websiteName}
          onChange={e => setWebsiteName(e.target.value)}
          placeholder="VISION AVAX FOREX"
        />

        {/* Logo Font Style */}
        <p className="text-xs text-muted-foreground mb-2 font-medium">Logo Text Style (Color):</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {LOGO_FONT_STYLES.map(s => (
            <button key={s.key} onClick={() => setConfig(c => ({ ...c, logoFontStyle: s.key }))}
              className={`py-2.5 px-3 rounded-xl border-2 transition-all press text-left ${config.logoFontStyle === s.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
              <span className="text-xs font-black" style={s.preview as React.CSSProperties}>{s.label.replace(/[🥇✨✈️🌈🔥]/g, '').trim()}</span>
            </button>
          ))}
        </div>

        {/* Logo Font Size */}
        <p className="text-xs text-muted-foreground mb-2 font-medium">Logo Text Size:</p>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {LOGO_FONT_SIZES.map(fs => (
            <button key={fs.key} onClick={() => setConfig(c => ({ ...c, logoFontSize: fs.key }))}
              className={`py-2 rounded-xl border-2 transition-all press text-center ${config.logoFontSize === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
              <p className="font-black text-foreground" style={{ fontSize: fs.px }}>A</p>
              <p className="text-[8px] text-muted-foreground">{fs.label}</p>
            </button>
          ))}
        </div>

        {/* Logo Position */}
        <p className="text-xs text-muted-foreground mb-2 font-medium">Logo Position:</p>
        <div className="grid grid-cols-2 gap-2">
          {LOGO_POSITIONS.map(p => (
            <button key={p.key} onClick={() => setConfig(c => ({ ...c, logoPosition: p.key }))}
              className={`py-2 rounded-xl border-2 transition-all press text-center text-sm font-bold ${config.logoPosition === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show/Hide Elements */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Show / Hide Elements
        </h3>
        <div className="space-y-2.5">
          {[
            { label: '🔔 Bell Notification Icon', key: 'showBellIcon' as const, desc: 'Notification badge top-left' },
            { label: '💬 Messenger Icon', key: 'showMessengerIcon' as const, desc: 'Direct messages button' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div>
                <p className="text-sm text-foreground font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, [item.key]: !c[item.key] }))}
                className={`relative w-12 h-6 rounded-full transition-all press flex-shrink-0 ${config[item.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config[item.key] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <div>
              <p className="text-sm text-foreground font-medium">📱 Show Header Bar</p>
              <p className="text-[10px] text-muted-foreground">Toggle entire top navigation</p>
            </div>
            <button
              onClick={() => setShowHeader(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-all press flex-shrink-0 ${showHeader ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showHeader ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <div>
              <p className="text-sm text-foreground font-medium">🗂 Show Bottom Navigation</p>
              <p className="text-[10px] text-muted-foreground">Toggle bottom nav bar</p>
            </div>
            <button
              onClick={() => setShowBottomNav(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-all press flex-shrink-0 ${showBottomNav ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showBottomNav ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Nav Style */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" /> Bottom Navigation Style
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'pill', label: '💊 Pill (Rounded)', desc: 'Dark pill container — current style' },
            { key: 'flat', label: '▬ Flat Bar', desc: 'Standard flat bottom bar' },
            { key: 'floating', label: '🌊 Floating', desc: 'Floating pill with shadow glow' },
            { key: 'minimal', label: '· Minimal Dots', desc: 'Icons only, no labels' },
            { key: 'telegram', label: '✈️ Telegram', desc: 'Text labels below icons' },
            { key: 'bold', label: '🔲 Bold Block', desc: 'Square blocks with active fill' },
          ].map(ns => (
            <button key={ns.key} onClick={() => setNavStyle(ns.key)}
              className={`p-3 rounded-xl border-2 transition-all press text-left ${navStyle === ns.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
              <p className="text-sm font-bold text-foreground">{ns.label}</p>
              <p className="text-[10px] text-muted-foreground">{ns.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-2 pb-4">
        <button
          onClick={() => { setConfig(DEFAULT_CONFIG); setShowHeader(true); setShowBottomNav(true); setNavStyle('pill'); toast.success('Reset to default'); }}
          className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground text-sm font-bold press"
        >
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press pink-glow-xs"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
