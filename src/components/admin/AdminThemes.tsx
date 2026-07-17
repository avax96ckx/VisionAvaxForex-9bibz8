import { useState, useEffect } from 'react';
import { Palette, Save, Image, RefreshCw, Type, Globe, LogIn, Layout, Grid, Sun, Sparkles, Upload } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';
import ImageCropper from '@/components/features/ImageCropper';

const FONT_SIZES = [
  { key: 'xs3', label: 'XXXS', px: '8px' }, { key: 'xs2', label: 'XXS', px: '10px' }, { key: 'xs', label: 'XS', px: '11px' },
  { key: 'sm', label: 'Small', px: '13px' }, { key: 'md', label: 'Medium', px: '14px' },
  { key: 'lg', label: 'Large', px: '16px' }, { key: 'xl', label: 'XL', px: '18px' },
  { key: '2xl', label: '2XL', px: '20px' }, { key: '3xl', label: '3XL', px: '24px' },
  { key: '4xl', label: '4XL', px: '28px' },
];

const FONT_FAMILIES = [
  { key: 'default', label: 'Default', value: 'inherit', preview: 'The quick brown fox' },
  { key: 'inter', label: 'Inter', value: '"Inter", sans-serif', preview: 'Clean modern look' },
  { key: 'roboto', label: 'Roboto', value: '"Roboto", sans-serif', preview: 'Google style' },
  { key: 'poppins', label: 'Poppins', value: '"Poppins", sans-serif', preview: 'Rounded friendly' },
  { key: 'nunito', label: 'Nunito', value: '"Nunito", sans-serif', preview: 'Soft rounded' },
  { key: 'ubuntu', label: 'Ubuntu', value: '"Ubuntu", sans-serif', preview: 'Ubuntu terminal' },
  { key: 'oswald', label: 'Oswald', value: '"Oswald", sans-serif', preview: 'BOLD HEADER STYLE' },
  { key: 'mono', label: 'Monospace', value: '"Courier New", monospace', preview: 'code { style }' },
  { key: 'serif', label: 'Serif', value: '"Georgia", serif', preview: 'Classic elegant' },
  { key: 'playfair', label: 'Playfair', value: '"Playfair Display", serif', preview: 'Luxury editorial' },
  { key: 'cursive', label: 'Cursive ✍️', value: 'cursive', preview: 'Handwritten style' },
  { key: 'italic', label: 'Italic Sans', value: 'italic "Inter", sans-serif', preview: 'Slanted modern' },
  { key: 'fantasy', label: 'Fantasy 🎨', value: 'fantasy', preview: 'Decorative creative' },
  { key: 'thin', label: 'Thin Light', value: '100 "Inter", sans-serif', preview: 'Minimal hairline' },
];

const FONT_SCOPES = [
  { key: 'all', label: '🌐 Whole Website' },
  { key: 'vip', label: '👑 VIP Room Only' },
  { key: 'messenger', label: '💬 Messenger Only' },
];

const GRID_STYLES = [
  { key: 'telegram', label: 'Telegram', emoji: '✈️', desc: 'Smart adaptive layout like Telegram' },
  { key: 'whatsapp', label: 'WhatsApp', emoji: '📱', desc: '1 big left + 2 stacked right' },
  { key: 'grid2', label: '2 Column', emoji: '⬛⬛', desc: 'Always 2 equal columns' },
  { key: 'grid3', label: '3 Column', emoji: '▪▪▪', desc: 'Always 3 equal columns' },
  { key: 'strip', label: 'Strip', emoji: '📜', desc: 'Horizontal scrollable strip' },
  { key: 'mosaic', label: 'Mosaic', emoji: '🖼️', desc: 'Pinterest-like alternating sizes' },
];

const PRESET_WALLPAPERS = [
  { label: 'None', value: '' },
  { label: 'Dark Pink', value: 'linear-gradient(135deg,#1a001a 0%,#3d0033 50%,#1a001a 100%)' },
  { label: 'Night Sky', value: 'linear-gradient(135deg,#0a0a1a 0%,#1a1a3d 50%,#0d0d1a 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg,#0a1a0d 0%,#1a3d1e 50%,#0a1a0d 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg,#1a0a00 0%,#3d1a00 50%,#1a0a00 100%)' },
  { label: 'Ocean', value: 'linear-gradient(135deg,#001a2d 0%,#003d5c 50%,#001a2d 100%)' },
];

const PRESET_PRIMARIES = [
  '#FF1493', '#FF4500', '#1877F2', '#25D366', '#9B59B6', '#F39C12', '#E74C3C', '#1ABC9C',
  '#FF6B35', '#0066CC', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899',
];

// Gradient mixes (shown as special swatches)
const GRADIENT_PRESETS = [
  { label: 'Pink Sunset', value: '#FF1493', gradient: 'linear-gradient(135deg,#FF1493,#FF6B35)' },
  { label: 'Ocean Blue', value: '#1877F2', gradient: 'linear-gradient(135deg,#1877F2,#06B6D4)' },
  { label: 'Purple Neon', value: '#8B5CF6', gradient: 'linear-gradient(135deg,#8B5CF6,#EC4899)' },
  { label: 'Green Matrix', value: '#10B981', gradient: 'linear-gradient(135deg,#10B981,#06B6D4)' },
  { label: 'Gold VIP', value: '#F59E0B', gradient: 'linear-gradient(135deg,#F59E0B,#EF4444)' },
  { label: 'Fire Red', value: '#EF4444', gradient: 'linear-gradient(135deg,#EF4444,#FF6B35)' },
  { label: 'Cosmic', value: '#9B59B6', gradient: 'linear-gradient(135deg,#9B59B6,#1877F2)' },
  { label: 'WhatsApp', value: '#25D366', gradient: 'linear-gradient(135deg,#25D366,#1877F2)' },
];

// Website style presets
const WEBSITE_STYLES = [
  {
    key: 'dark_pink',
    label: 'Dark Pink (Default)',
    desc: 'Deep dark background with pink/hot-pink accents',
    preview: 'linear-gradient(135deg,#0a000f 0%,#1a0020 50%,#FF1493 100%)',
    vars: { '--background': '270 100% 4%', '--foreground': '0 0% 98%', '--card': '270 50% 7%', '--primary': '330 100% 54%', '--muted': '270 30% 12%', '--border': '270 20% 18%' },
    primaryHex: '#FF1493',
  },
  {
    key: 'dark_blue',
    label: 'Dark Blue (Corporate)',
    desc: 'Professional dark navy with royal blue accents',
    preview: 'linear-gradient(135deg,#000a1a 0%,#001a3d 50%,#1877F2 100%)',
    vars: { '--background': '220 100% 4%', '--foreground': '0 0% 98%', '--card': '220 50% 7%', '--primary': '214 89% 52%', '--muted': '220 30% 12%', '--border': '220 20% 18%' },
    primaryHex: '#1877F2',
  },
  {
    key: 'dark_green',
    label: 'Dark Green (Matrix)',
    desc: 'Dark background with emerald green trader vibe',
    preview: 'linear-gradient(135deg,#001a00 0%,#003d00 50%,#10B981 100%)',
    vars: { '--background': '140 100% 3%', '--foreground': '0 0% 98%', '--card': '140 50% 6%', '--primary': '160 84% 39%', '--muted': '140 30% 10%', '--border': '140 20% 15%' },
    primaryHex: '#10B981',
  },
  {
    key: 'dark_purple',
    label: 'Dark Purple (Premium)',
    desc: 'Elegant purple theme for premium feeling',
    preview: 'linear-gradient(135deg,#0a0015 0%,#1a003d 50%,#8B5CF6 100%)',
    vars: { '--background': '260 100% 4%', '--foreground': '0 0% 98%', '--card': '260 50% 7%', '--primary': '258 90% 66%', '--muted': '260 30% 12%', '--border': '260 20% 18%' },
    primaryHex: '#8B5CF6',
  },
  {
    key: 'dark_gold',
    label: 'Dark Gold (VIP)',
    desc: 'Luxury black with gold VIP accents',
    preview: 'linear-gradient(135deg,#100800 0%,#2a1500 50%,#F59E0B 100%)',
    vars: { '--background': '30 100% 3%', '--foreground': '0 0% 98%', '--card': '30 50% 6%', '--primary': '38 92% 50%', '--muted': '30 30% 10%', '--border': '30 20% 15%' },
    primaryHex: '#F59E0B',
  },
  {
    key: 'light_minimal',
    label: 'Light Minimal',
    desc: 'Clean white light mode with pink accents',
    preview: 'linear-gradient(135deg,#f8f8ff 0%,#fff0f8 50%,#FF1493 100%)',
    vars: { '--background': '0 0% 98%', '--foreground': '0 0% 5%', '--card': '0 0% 100%', '--primary': '330 100% 54%', '--muted': '0 0% 93%', '--border': '0 0% 88%' },
    primaryHex: '#FF1493',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Dark',
    desc: 'Classic WhatsApp dark interface',
    preview: 'linear-gradient(135deg,#0b141a 0%,#1f2c34 50%,#25D366 100%)',
    vars: { '--background': '200 50% 7%', '--foreground': '0 0% 95%', '--card': '200 40% 10%', '--primary': '142 70% 49%', '--muted': '200 30% 14%', '--border': '200 20% 18%' },
    primaryHex: '#25D366',
  },
  {
    key: 'telegram',
    label: 'Telegram Blue',
    desc: 'Classic Telegram messenger style',
    preview: 'linear-gradient(135deg,#17212b 0%,#232e3c 50%,#2AABEE 100%)',
    vars: { '--background': '210 35% 13%', '--foreground': '0 0% 95%', '--card': '210 30% 16%', '--primary': '200 82% 56%', '--muted': '210 25% 20%', '--border': '210 20% 22%' },
    primaryHex: '#2AABEE',
  },
];

function hexToHsl(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '330 100% 54%';
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lit = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lit * 100)}%`;
}

function applyFontGlobally(fontKey: string, scope: string) {
  const ff = FONT_FAMILIES.find(f => f.key === fontKey);
  if (!ff || fontKey === 'default') {
    document.body.style.removeProperty('font-family');
    return;
  }
  if (scope === 'all') {
    document.body.style.fontFamily = ff.value;
  }
}

export default function AdminThemes() {
  const [settings, setSettings] = useState({
    chat_wallpaper: '', chat_bg_color: '', chat_bg_brightness: 100,
    chat_bubble_color_own: '#FF1493', chat_bubble_color_other: '#1e1e2e',
    chat_font_size: 'md', chat_font_family: 'default', font_scope: 'all',
    primary_color: '#FF1493', secondary_color: '#FF69B4', auth_bg_url: '',
    global_cover_url: '', media_grid_style: 'telegram',
    vip_wallpaper: '', vip_bg_color: '#0d0d1a', vip_bg_brightness: 100,
    vip_bubble_color_own: '#FF1493', vip_bubble_color_other: '#1e1e2e',
    vip_font_size: 'md', vip_font_family: 'default',
    agent_name: 'AVAX Support', agent_bg_color: '#0d0d1a', agent_bg_url: '',
    agent_bubble_own: '#FF1493', agent_bubble_other: '#1e1e2e',
    agent_font_size: 'md', agent_font_family: 'default', agent_avatar_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [uploadingVIPWallpaper, setUploadingVIPWallpaper] = useState(false);
  const [uploadingAuthBg, setUploadingAuthBg] = useState(false);
  const [uploadingGlobalCover, setUploadingGlobalCover] = useState(false);
  const [globalCoverCropFile, setGlobalCoverCropFile] = useState<File | null>(null);
  const [activeSection, setActiveSection] = useState<'messenger' | 'vip' | 'website' | 'styles' | 'media' | 'agent' | 'brand'>('styles');
  const [uploadingHeroBanner, setUploadingHeroBanner] = useState(false);
  const [brandSettings, setBrandSettings] = useState({
    hero_title: 'Trade Smart. Live Better.',
    hero_subtitle: 'Professional Forex Signals & Premium Trading Education',
    hero_banner_url: '',
    hero_title_color: '#ffffff',
    hero_subtitle_color: 'rgba(255,255,255,0.6)',
    hero_title_size: '2xl',
    hero_title_style: 'default',
    hero_subtitle_style: 'default',
  });

  useEffect(() => { fetchSettings(); fetchBrandSettings(); }, []);

  async function fetchBrandSettings() {
    const { data } = await supabase.from('site_settings').select('hero_title,hero_subtitle,hero_banner_url,hero_title_color,hero_subtitle_color,hero_title_size,hero_title_style').eq('id', 'main').single();
    if (data) {
      const d = data as any;
      setBrandSettings(s => ({
        ...s,
        hero_title: d.hero_title || 'Trade Smart. Live Better.',
        hero_subtitle: d.hero_subtitle || 'Professional Forex Signals & Premium Trading Education',
        hero_banner_url: d.hero_banner_url || '',
        hero_title_color: d.hero_title_color || '#ffffff',
        hero_subtitle_color: d.hero_subtitle_color || 'rgba(255,255,255,0.6)',
        hero_title_size: d.hero_title_size || '2xl',
        hero_title_style: d.hero_title_style || 'default',
      }));
    }
  }

  async function saveBrandSettings() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({
      hero_title: brandSettings.hero_title,
      hero_subtitle: brandSettings.hero_subtitle,
      hero_banner_url: brandSettings.hero_banner_url || null,
      hero_title_color: brandSettings.hero_title_color,
      hero_subtitle_color: brandSettings.hero_subtitle_color,
      hero_title_size: brandSettings.hero_title_size,
      hero_title_style: brandSettings.hero_title_style,
    } as any).eq('id', 'main');
    setSaving(false);
    if (error) toast.error('Save failed: ' + error.message);
    else toast.success('Brand assets saved! Reload home to see changes.');
  }

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('site_settings').select('*').eq('id', 'main').single();
    if (data) {
      setSettings({
        chat_wallpaper: (data as any).chat_wallpaper || '',
        chat_bg_color: (data as any).chat_bg_color || '',
        chat_bg_brightness: (data as any).chat_bg_brightness ?? 100,
        chat_bubble_color_own: (data as any).chat_bubble_color_own || '#FF1493',
        chat_bubble_color_other: (data as any).chat_bubble_color_other || '#1e1e2e',
        chat_font_size: (data as any).chat_font_size || 'md',
        chat_font_family: (data as any).chat_font_family || 'default',
        font_scope: (data as any).font_scope || 'all',
        primary_color: (data as any).primary_color || '#FF1493',
        secondary_color: (data as any).secondary_color || '#FF69B4',
        auth_bg_url: (data as any).auth_bg_url || '',
        global_cover_url: (data as any).global_cover_url || '',
        media_grid_style: (data as any).media_grid_style || 'telegram',
        vip_wallpaper: (data as any).vip_wallpaper || '',
        vip_bg_color: (data as any).vip_bg_color || '#0d0d1a',
        vip_bg_brightness: (data as any).vip_bg_brightness ?? 100,
        vip_bubble_color_own: (data as any).vip_bubble_color_own || '#FF1493',
        vip_bubble_color_other: (data as any).vip_bubble_color_other || '#1e1e2e',
        vip_font_size: (data as any).vip_font_size || 'md',
        vip_font_family: (data as any).vip_font_family || 'default',
        agent_name: (data as any).agent_name || 'AVAX Support',
        agent_bg_color: (data as any).agent_bg_color || '#0d0d1a',
        agent_bg_url: (data as any).agent_bg_url || '',
        agent_bubble_own: (data as any).agent_bubble_own || '#FF1493',
        agent_bubble_other: (data as any).agent_bubble_other || '#1e1e2e',
        agent_font_size: (data as any).agent_font_size || 'md',
        agent_font_family: (data as any).agent_font_family || 'default',
        agent_avatar_url: (data as any).agent_avatar_url || '',
      });
    }
    setLoading(false);
  }

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>, isVIP = false) {
    const file = e.target.files?.[0]; if (!file) return;
    if (isVIP) setUploadingVIPWallpaper(true); else setUploadingWallpaper(true);
    const url = await uploadFile('banners', `wallpaper_${isVIP ? 'vip_' : ''}${Date.now()}`, file);
    if (isVIP) {
      setSettings(s => ({ ...s, vip_wallpaper: url, vip_bg_color: '' }));
      setUploadingVIPWallpaper(false);
    } else {
      setSettings(s => ({ ...s, chat_wallpaper: url, chat_bg_color: '' }));
      setUploadingWallpaper(false);
    }
    toast.success('Wallpaper uploaded!');
    e.target.value = '';
  }

  async function handleAuthBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingAuthBg(true);
    const url = await uploadFile('banners', `auth_bg_${Date.now()}`, file);
    setSettings(s => ({ ...s, auth_bg_url: url }));
    await supabase.from('site_settings').update({ auth_bg_url: url } as any).eq('id', 'main');
    toast.success('Login background updated!');
    setUploadingAuthBg(false);
    e.target.value = '';
  }

  function handleGlobalCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setGlobalCoverCropFile(file);
    e.target.value = '';
  }

  async function handleGlobalCoverCropped(blob: Blob) {
    setGlobalCoverCropFile(null);
    setUploadingGlobalCover(true);
    const file = new File([blob], `global_cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const url = await uploadFile('banners', `global_cover_${Date.now()}`, file);
    setSettings(s => ({ ...s, global_cover_url: url }));
    await supabase.from('site_settings').update({ global_cover_url: url } as any).eq('id', 'main');
    toast.success('Global cover photo set!');
    setUploadingGlobalCover(false);
  }

  async function saveSettings() {
    setSaving(true);
    const updateData: any = {
      chat_wallpaper: settings.chat_wallpaper || null,
      chat_bg_color: settings.chat_bg_color || null,
      chat_bg_brightness: settings.chat_bg_brightness,
      chat_bubble_color_own: settings.chat_bubble_color_own,
      chat_bubble_color_other: settings.chat_bubble_color_other,
      chat_font_size: settings.chat_font_size,
      chat_font_family: settings.chat_font_family,
      font_scope: settings.font_scope,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      media_grid_style: settings.media_grid_style,
      vip_wallpaper: settings.vip_wallpaper || null,
      vip_bg_color: settings.vip_bg_color,
      vip_bg_brightness: settings.vip_bg_brightness,
      vip_bubble_color_own: settings.vip_bubble_color_own,
      vip_bubble_color_other: settings.vip_bubble_color_other,
      vip_font_size: settings.vip_font_size,
      vip_font_family: settings.vip_font_family,
      agent_name: settings.agent_name,
      agent_bg_color: settings.agent_bg_color,
      agent_bg_url: settings.agent_bg_url || null,
      agent_bubble_own: settings.agent_bubble_own,
      agent_bubble_other: settings.agent_bubble_other,
      agent_font_size: settings.agent_font_size,
      agent_font_family: settings.agent_font_family,
      agent_avatar_url: settings.agent_avatar_url || null,
      ai_support_instructions: (settings as any).ai_support_instructions || null,
    };

    const { error } = await supabase.from('site_settings').update(updateData).eq('id', 'main');
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    // Apply primary color immediately
    const primaryHsl = hexToHsl(settings.primary_color);
    document.documentElement.style.setProperty('--primary', primaryHsl);
    document.documentElement.style.setProperty('--ring', primaryHsl);
    document.documentElement.style.setProperty('--accent', primaryHsl);

    // Apply full website style if a preset was selected
    const selectedStyle = WEBSITE_STYLES.find(s => s.primaryHex === settings.primary_color);
    if (selectedStyle?.vars) {
      const root = document.documentElement;
      Object.entries(selectedStyle.vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      localStorage.setItem('vaf_website_style', JSON.stringify(selectedStyle.vars));
    }

    // Apply font immediately if scope is all
    applyFontGlobally(settings.chat_font_family, settings.font_scope);

    // Persist to localStorage so it survives page reload
    localStorage.setItem('vaf_primary_color', settings.primary_color);
    localStorage.setItem('vaf_font_family', settings.chat_font_family);
    localStorage.setItem('vaf_font_scope', settings.font_scope);

    toast.success('Theme saved & applied to website!');
    setSaving(false);
  }

  const curFontPx = FONT_SIZES.find(f => f.key === settings.chat_font_size)?.px || '14px';
  const curVipFontPx = FONT_SIZES.find(f => f.key === settings.vip_font_size)?.px || '14px';
  const curFontFamily = FONT_FAMILIES.find(f => f.key === settings.chat_font_family)?.value || 'inherit';
  const curVipFontFamily = FONT_FAMILIES.find(f => f.key === settings.vip_font_family)?.value || 'inherit';

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  const sectionTabs = [
    { key: 'styles', label: '🎨 Styles' },
    { key: 'brand', label: '✨ Brand' },
    { key: 'website', label: '🌐 Website' },
    { key: 'messenger', label: '💬 Messenger' },
    { key: 'vip', label: '👑 VIP Room' },
    { key: 'media', label: '🖼️ Media & Cover' },
    { key: 'agent', label: '🤖 Live Agent' },
  ] as const;

  return (
    <div className="space-y-4">
      {globalCoverCropFile && (
        <ImageCropper imageFile={globalCoverCropFile} aspectRatio={16 / 9} isCircular={false}
          title="Crop Global Cover Photo (16:9)" onCrop={handleGlobalCoverCropped} onCancel={() => setGlobalCoverCropFile(null)} />
      )}

      {/* Section tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {sectionTabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key as any)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all press ${activeSection === tab.key ? 'gradient-pink text-white' : 'bg-card border border-border text-muted-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BRAND ASSETS ── */}
      {activeSection === 'brand' && (
        <div className="space-y-4 animate-fade-in">
          {/* Hero Preview */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div
              className="relative h-44 flex flex-col justify-end p-4"
              style={{
                background: brandSettings.hero_banner_url
                  ? `url(${brandSettings.hero_banner_url}) center/cover`
                  : 'linear-gradient(135deg,#0a0010 0%,#1a0028 100%)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10">
                <p
                  className="leading-tight mb-1"
                  style={{
                    color: brandSettings.hero_title_color,
                    fontSize: FONT_SIZES.find(f => f.key === brandSettings.hero_title_size)?.px || '20px',
                    fontStyle: brandSettings.hero_title_style === 'italic' ? 'italic' : 'normal',
                    fontWeight: brandSettings.hero_title_style === 'thin' ? 300 : 900,
                  }}
                >
                  {brandSettings.hero_title} 🔥
                </p>
                <p className="text-xs leading-relaxed"
                  style={{
                    color: brandSettings.hero_subtitle_color,
                    fontStyle: (brandSettings as any).hero_subtitle_style === 'italic' ? 'italic' : 'normal',
                    fontWeight: (brandSettings as any).hero_subtitle_style === 'thin' ? 300 : 400,
                  }}>
                  {brandSettings.hero_subtitle}
                </p>
              </div>
            </div>
            <div className="p-3 bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">Hero section preview</p>
            </div>
          </div>

          {/* Hero Banner Upload */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Hero Banner Image
            </h3>
            <input
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
              placeholder="Image URL"
              value={brandSettings.hero_banner_url}
              onChange={e => setBrandSettings(s => ({ ...s, hero_banner_url: e.target.value }))}
            />
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all press">
              {uploadingHeroBanner
                ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <Upload className="w-4 h-4 text-primary" />
              }
              <span className="text-sm text-muted-foreground flex-1">
                {brandSettings.hero_banner_url ? '✓ Banner set — upload to replace' : 'Upload Hero Banner'}
              </span>
              {brandSettings.hero_banner_url && (
                <button type="button" onClick={() => setBrandSettings(s => ({ ...s, hero_banner_url: '' }))} className="text-red-400 text-xs">Clear</button>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploadingHeroBanner(true);
                const url = await uploadFile('banners', `hero_banner_${Date.now()}`, file);
                setBrandSettings(s => ({ ...s, hero_banner_url: url }));
                setUploadingHeroBanner(false);
                toast.success('Hero banner uploaded!');
                e.target.value = '';
              }} />
            </label>
          </div>

          {/* Hero Title */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Hero Title
            </h3>
            <input
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
              placeholder="Trade Smart. Live Better."
              value={brandSettings.hero_title}
              onChange={e => setBrandSettings(s => ({ ...s, hero_title: e.target.value }))}
            />

            {/* Title color */}
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Title Text Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={brandSettings.hero_title_color}
                  onChange={e => setBrandSettings(s => ({ ...s, hero_title_color: e.target.value }))}
                  className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-muted" />
                <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary font-mono"
                  value={brandSettings.hero_title_color}
                  onChange={e => setBrandSettings(s => ({ ...s, hero_title_color: e.target.value }))} />
                <div className="w-10 h-10 rounded-xl border border-border" style={{ background: brandSettings.hero_title_color }} />
              </div>
            </div>

            {/* Title size */}
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Title Font Size</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[{key:'lg',px:'16px'},{key:'xl',px:'18px'},{key:'2xl',px:'20px'},{key:'3xl',px:'24px'},{key:'4xl',px:'28px'}].map(fs => (
                  <button key={fs.key} onClick={() => setBrandSettings(s => ({ ...s, hero_title_size: fs.key }))}
                    className={`py-2 rounded-xl border-2 transition-all press text-center ${brandSettings.hero_title_size === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                    <p className="font-black text-foreground" style={{ fontSize: fs.px }}>Aa</p>
                    <p className="text-[9px] text-muted-foreground">{fs.key.toUpperCase()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Title style */}
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Title Font Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'default', label: 'Bold', preview: 'BOLD' },
                  { key: 'italic', label: 'Italic', preview: 'ITALIC' },
                  { key: 'thin', label: 'Thin', preview: 'THIN' },
                ].map(st => (
                  <button key={st.key} onClick={() => setBrandSettings(s => ({ ...s, hero_title_style: st.key }))}
                    className={`py-2.5 rounded-xl border-2 transition-all press text-center ${brandSettings.hero_title_style === st.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                    <p className="text-sm text-foreground"
                      style={{ fontStyle: st.key === 'italic' ? 'italic' : 'normal', fontWeight: st.key === 'thin' ? 200 : 900 }}>
                      {st.preview}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hero Subtitle */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Hero Subtitle
            </h3>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
              rows={2}
              placeholder="Professional Forex Signals & Premium Trading Education"
              value={brandSettings.hero_subtitle}
              onChange={e => setBrandSettings(s => ({ ...s, hero_subtitle: e.target.value }))}
            />
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Subtitle Text Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={brandSettings.hero_subtitle_color.startsWith('rgba') ? '#ffffff' : brandSettings.hero_subtitle_color}
                  onChange={e => setBrandSettings(s => ({ ...s, hero_subtitle_color: e.target.value }))}
                  className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-muted" />
                <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary font-mono"
                  value={brandSettings.hero_subtitle_color}
                  onChange={e => setBrandSettings(s => ({ ...s, hero_subtitle_color: e.target.value }))} />
              </div>
            </div>
            {/* Subtitle style */}
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Subtitle Font Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'default', label: 'Normal', sample: 'Normal text' },
                  { key: 'italic', label: 'Italic ✍️', sample: 'Italic style' },
                  { key: 'thin', label: 'Thin Light', sample: 'Light thin' },
                ].map(st => (
                  <button key={st.key} onClick={() => setBrandSettings(s => ({ ...s, hero_subtitle_style: st.key }))}
                    className={`py-2.5 px-2 rounded-xl border-2 transition-all press text-center ${(brandSettings as any).hero_subtitle_style === st.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                    <p className="text-sm text-foreground"
                      style={{ fontStyle: st.key === 'italic' ? 'italic' : 'normal', fontWeight: st.key === 'thin' ? 300 : 400 }}>
                      {st.sample}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={saveBrandSettings}
            disabled={saving}
            className="w-full py-3.5 gradient-pink rounded-2xl text-white font-bold flex items-center justify-center gap-2 pink-glow press disabled:opacity-60"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Brand Assets
          </button>
        </div>
      )}

      {activeSection === 'styles' && (
        <>
          {/* Website Style Presets */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Website Style Presets
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Select a complete visual style. Changes background, card colors, and accent — applies to the entire website.</p>
            <div className="space-y-2 mb-4">
              {WEBSITE_STYLES.map(style => (
                <button
                  key={style.key}
                  onClick={() => {
                    setSettings(s => ({ ...s, primary_color: style.primaryHex }));
                    // Apply CSS vars immediately
                    const root = document.documentElement;
                    Object.entries(style.vars).forEach(([key, value]) => {
                      root.style.setProperty(key, value);
                    });
                    localStorage.setItem('vaf_primary_color', style.primaryHex);
                    // Persist all vars for reload
                    localStorage.setItem('vaf_website_style', JSON.stringify(style.vars));
                    toast.success(`Style "${style.label}" applied! Save to make permanent.`);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all press text-left hover:border-primary/40"
                  style={{ borderColor: settings.primary_color === style.primaryHex ? style.primaryHex : 'hsl(var(--border))' }}
                >
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: style.preview }} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{style.label}</p>
                    <p className="text-[10px] text-muted-foreground">{style.desc}</p>
                  </div>
                  {settings.primary_color === style.primaryHex && (
                    <div className="w-5 h-5 rounded-full gradient-pink flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Accent Color
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Changes ALL pink/primary accents: buttons, badges, gradients, icons, borders — website-wide.</p>
            {/* Gradient presets */}
            <p className="text-xs text-muted-foreground mb-2 font-medium">Gradient Presets:</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {GRADIENT_PRESETS.map(gp => (
                <button
                  key={gp.value}
                  onClick={() => setSettings(s => ({ ...s, primary_color: gp.value }))}
                  className={`relative h-10 rounded-xl border-2 transition-all press ${settings.primary_color === gp.value ? 'border-white scale-105' : 'border-transparent'}`}
                  style={{ background: gp.gradient }}
                  title={gp.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Solid Colors:</p>
            <div className="grid grid-cols-8 gap-2 mb-3">
              {PRESET_PRIMARIES.map(c => (
                <button key={c} onClick={() => setSettings(s => ({ ...s, primary_color: c }))}
                  className={`w-full aspect-square rounded-xl border-2 transition-all press ${settings.primary_color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input type="color" value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
              <input value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
              <div className="w-10 h-10 rounded-xl border border-border" style={{ background: settings.primary_color }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">⚡ Live preview — click Save & Apply to make permanent.</p>
          </div>
        </>
      )}

      {/* ── WEBSITE SECTION ── */}
      {activeSection === 'website' && (
        <>
          {/* Website Color — legacy fallback */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Website Accent Color
            </h3>
            <div className="grid grid-cols-8 gap-2 mb-3">
              {PRESET_PRIMARIES.map(c => (
                <button key={c} onClick={() => setSettings(s => ({ ...s, primary_color: c }))}
                  className={`w-full aspect-square rounded-xl border-2 transition-all press ${settings.primary_color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input type="color" value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
              <input value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
              <div className="w-10 h-10 rounded-xl border border-border" style={{ background: settings.primary_color }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">⚡ Changes apply immediately to buttons, badges, and accents site-wide.</p>
          </div>

          {/* Login Background */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-primary" /> Login Page Background
            </h3>
            {settings.auth_bg_url && (
              <div className="mb-3 rounded-xl overflow-hidden border border-border" style={{ height: 100 }}>
                <img src={settings.auth_bg_url} alt="Auth bg" className="w-full h-full object-cover" />
              </div>
            )}
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingAuthBg ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground flex-1">{settings.auth_bg_url ? '✓ Set — upload to replace' : 'Upload Login Background'}</span>
              {settings.auth_bg_url && (
                <button type="button" onClick={() => { setSettings(s => ({ ...s, auth_bg_url: '' })); supabase.from('site_settings').update({ auth_bg_url: null } as any).eq('id', 'main'); toast.success('Removed'); }} className="text-red-400 text-xs">Clear</button>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAuthBgUpload} />
            </label>
          </div>
        </>
      )}

      {/* ── MESSENGER SECTION ── */}
      {activeSection === 'messenger' && (
        <>
          {/* Preview */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Messenger Preview
            </h3>
            <div className="rounded-xl p-4 relative overflow-hidden" style={{
              background: settings.chat_wallpaper
                ? (settings.chat_wallpaper.startsWith('linear-gradient') ? settings.chat_wallpaper : `url(${settings.chat_wallpaper}) center/cover`)
                : settings.chat_bg_color || '#0d0d1a',
              minHeight: 120,
              fontFamily: curFontFamily,
            }}>
              {/* Brightness overlay */}
              {settings.chat_bg_brightness < 100 && (
                <div className="absolute inset-0 bg-black rounded-xl pointer-events-none" style={{ opacity: (100 - settings.chat_bg_brightness) / 100 }} />
              )}
              <div className="relative z-10">
                <div className="flex justify-end mb-2">
                  <div className="px-3 py-2 rounded-2xl max-w-[70%]" style={{ background: settings.chat_bubble_color_own, fontSize: curFontPx }}>
                    <p className="text-white font-medium">Hello! 👋</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl max-w-[70%]" style={{ background: settings.chat_bubble_color_other, fontSize: curFontPx }}>
                    <p className="text-foreground font-medium" style={{ fontFamily: curFontFamily }}>How are you? 😊</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Background */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Chat Background
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESET_WALLPAPERS.map(wp => (
                <button key={wp.label} onClick={() => setSettings(s => ({ ...s, chat_wallpaper: wp.value, chat_bg_color: '' }))}
                  className={`h-14 rounded-xl border-2 transition-all press overflow-hidden flex items-center justify-center ${settings.chat_wallpaper === wp.value ? 'border-primary' : 'border-border'}`}
                  style={{ background: wp.value || '#0d0d1a' }}>
                  {!wp.value && <span className="text-[10px] text-muted-foreground">{wp.label}</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-3 items-center mb-3">
              <input type="color" value={settings.chat_bg_color || '#0d0d1a'} onChange={e => setSettings(s => ({ ...s, chat_bg_color: e.target.value, chat_wallpaper: '' }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
              <input value={settings.chat_bg_color || ''} onChange={e => setSettings(s => ({ ...s, chat_bg_color: e.target.value, chat_wallpaper: '' }))}
                placeholder="#0d0d1a" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
            </div>
            {/* Brightness */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1 font-medium"><Sun className="w-3 h-3" /> Background Brightness</label>
                <span className="text-xs font-bold text-foreground">{settings.chat_bg_brightness}%</span>
              </div>
              <input type="range" min={20} max={100} value={settings.chat_bg_brightness}
                onChange={e => setSettings(s => ({ ...s, chat_bg_brightness: Number(e.target.value) }))}
                className="w-full accent-primary" />
              <p className="text-[10px] text-muted-foreground mt-1">Lower = darker background, messages more readable</p>
            </div>
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingWallpaper ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground flex-1">{settings.chat_wallpaper && !settings.chat_wallpaper.startsWith('linear-gradient') ? '✓ Custom wallpaper set' : 'Upload Custom Wallpaper'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => handleWallpaperUpload(e, false)} />
            </label>
          </div>

          {/* Bubble Colors */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Chat Bubble Colors
            </h3>
            {[{ label: 'Your Messages (Sent)', key: 'chat_bubble_color_own' as const }, { label: "Others' Messages", key: 'chat_bubble_color_other' as const }].map(({ label, key }) => (
              <div key={key} className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
                  <input value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
                  <div className="w-10 h-10 rounded-xl border border-border" style={{ background: settings[key] }} />
                </div>
              </div>
            ))}
          </div>

          {/* Font */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Font Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Font Size:</p>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {FONT_SIZES.map(fs => (
                <button key={fs.key} onClick={() => setSettings(s => ({ ...s, chat_font_size: fs.key }))}
                  className={`py-2 rounded-xl border-2 transition-all press text-center ${settings.chat_font_size === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="font-black text-foreground" style={{ fontSize: fs.px }}>Aa</p>
                  <p className="text-[9px] text-muted-foreground">{fs.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Font Style:</p>
            <div className="grid grid-cols-2 gap-2 mb-3 max-h-64 overflow-y-auto">
              {FONT_FAMILIES.map(ff => (
                <button key={ff.key} onClick={() => setSettings(s => ({ ...s, chat_font_family: ff.key }))}
                  className={`py-2.5 px-3 rounded-xl border-2 transition-all press text-left ${settings.chat_font_family === ff.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="text-sm text-foreground font-bold" style={{ fontFamily: ff.value }}>{ff.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight" style={{ fontFamily: ff.value }}>{ff.preview}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Apply font to:</p>
            <div className="grid grid-cols-3 gap-2">
              {FONT_SCOPES.map(scope => (
                <button key={scope.key} onClick={() => setSettings(s => ({ ...s, font_scope: scope.key }))}
                  className={`py-2 px-2 rounded-xl border-2 transition-all press text-center text-xs font-bold ${settings.font_scope === scope.key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                  {scope.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── VIP ROOM SECTION ── */}
      {activeSection === 'vip' && (
        <>
          {/* VIP Preview */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> VIP Room Preview
            </h3>
            <div className="rounded-xl p-4 relative overflow-hidden" style={{
              background: settings.vip_wallpaper
                ? (settings.vip_wallpaper.startsWith('linear-gradient') ? settings.vip_wallpaper : `url(${settings.vip_wallpaper}) center/cover`)
                : settings.vip_bg_color || '#0d0d1a',
              minHeight: 120, fontFamily: curVipFontFamily,
            }}>
              {settings.vip_bg_brightness < 100 && (
                <div className="absolute inset-0 bg-black rounded-xl pointer-events-none" style={{ opacity: (100 - settings.vip_bg_brightness) / 100 }} />
              )}
              <div className="relative z-10">
                <div className="flex justify-end mb-2">
                  <div className="px-3 py-2 rounded-2xl max-w-[70%]" style={{ background: settings.vip_bubble_color_own, fontSize: curVipFontPx }}>
                    <p className="text-white font-medium">VIP member 👑</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl max-w-[70%]" style={{ background: settings.vip_bubble_color_other, fontSize: curVipFontPx }}>
                    <p className="text-white font-medium">Welcome! 🔥</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VIP Background */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> VIP Room Background
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESET_WALLPAPERS.map(wp => (
                <button key={wp.label} onClick={() => setSettings(s => ({ ...s, vip_wallpaper: wp.value, vip_bg_color: '' }))}
                  className={`h-14 rounded-xl border-2 transition-all press overflow-hidden flex items-center justify-center ${settings.vip_wallpaper === wp.value ? 'border-primary' : 'border-border'}`}
                  style={{ background: wp.value || '#0d0d1a' }}>
                  {!wp.value && <span className="text-[10px] text-muted-foreground">{wp.label}</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-3 items-center mb-3">
              <input type="color" value={settings.vip_bg_color || '#0d0d1a'} onChange={e => setSettings(s => ({ ...s, vip_bg_color: e.target.value, vip_wallpaper: '' }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
              <input value={settings.vip_bg_color || ''} onChange={e => setSettings(s => ({ ...s, vip_bg_color: e.target.value, vip_wallpaper: '' }))}
                placeholder="#0d0d1a" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
            </div>
            {/* Brightness */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1 font-medium"><Sun className="w-3 h-3" /> Background Brightness</label>
                <span className="text-xs font-bold text-foreground">{settings.vip_bg_brightness}%</span>
              </div>
              <input type="range" min={20} max={100} value={settings.vip_bg_brightness}
                onChange={e => setSettings(s => ({ ...s, vip_bg_brightness: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingVIPWallpaper ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground flex-1">{settings.vip_wallpaper && !settings.vip_wallpaper.startsWith('linear-gradient') ? '✓ VIP wallpaper set' : 'Upload VIP Room Wallpaper'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => handleWallpaperUpload(e, true)} />
            </label>
          </div>

          {/* VIP Bubble Colors */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> VIP Bubble Colors
            </h3>
            {[{ label: 'Your Messages (Sent)', key: 'vip_bubble_color_own' as const }, { label: "Others' Messages", key: 'vip_bubble_color_other' as const }].map(({ label, key }) => (
              <div key={key} className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
                  <input value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
                  <div className="w-10 h-10 rounded-xl border border-border" style={{ background: settings[key] }} />
                </div>
              </div>
            ))}
          </div>

          {/* VIP Font */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> VIP Room Font
            </h3>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Font Size:</p>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {FONT_SIZES.map(fs => (
                <button key={fs.key} onClick={() => setSettings(s => ({ ...s, vip_font_size: fs.key }))}
                  className={`py-2 rounded-xl border-2 transition-all press text-center ${settings.vip_font_size === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="font-black text-foreground" style={{ fontSize: fs.px }}>Aa</p>
                  <p className="text-[9px] text-muted-foreground">{fs.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Font Style:</p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {FONT_FAMILIES.map(ff => (
                <button key={ff.key} onClick={() => setSettings(s => ({ ...s, vip_font_family: ff.key }))}
                  className={`py-2.5 px-3 rounded-xl border-2 transition-all press text-left ${settings.vip_font_family === ff.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="text-sm text-foreground font-bold" style={{ fontFamily: ff.value }}>{ff.label}</p>
                  <p className="text-[10px] text-muted-foreground" style={{ fontFamily: ff.value }}>{ff.preview}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── MEDIA & COVER SECTION ── */}
      {activeSection === 'media' && (
        <>
          {/* Media Grid Style */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" /> Photo Grid Layout
            </h3>
            <p className="text-xs text-muted-foreground mb-3">How multiple photos are displayed in VIP Room and Messenger chats.</p>
            <div className="space-y-2">
              {GRID_STYLES.map(gs => (
                <button key={gs.key} onClick={() => setSettings(s => ({ ...s, media_grid_style: gs.key }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all press text-left ${settings.media_grid_style === gs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                  <span className="text-xl flex-shrink-0">{gs.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{gs.label}</p>
                    <p className="text-[10px] text-muted-foreground">{gs.desc}</p>
                  </div>
                  {settings.media_grid_style === gs.key && (
                    <div className="w-5 h-5 rounded-full gradient-pink flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Crop Disabled Toggle */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Image Upload Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-3">When cropping is disabled, users can upload avatars and cover photos without mandatory cropping.</p>
            <label className="flex items-center justify-between p-3 bg-muted/30 rounded-xl cursor-pointer press">
              <div>
                <p className="text-sm font-bold text-foreground">Disable Image Cropping</p>
                <p className="text-[11px] text-muted-foreground">Upload directly without crop step</p>
              </div>
              <div
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${ (settings as any).crop_disabled ? 'bg-primary' : 'bg-muted border border-border'}`}
                onClick={async () => {
                  const newVal = !(settings as any).crop_disabled;
                  setSettings(s => ({ ...s, crop_disabled: newVal } as any));
                  await supabase.from('site_settings').update({ crop_disabled: newVal } as any).eq('id', 'main');
                  toast.success(newVal ? 'Cropping disabled' : 'Cropping enabled');
                }}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${ (settings as any).crop_disabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          {/* Global Cover Photo */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary" /> Global Profile Cover
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Upload one cover photo that appears on ALL member profiles who don't have a custom cover.</p>
            {settings.global_cover_url && (
              <div className="mb-3 rounded-xl overflow-hidden border border-border" style={{ height: 120 }}>
                <img src={settings.global_cover_url} alt="Global cover" className="w-full h-full object-cover" />
              </div>
            )}
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingGlobalCover ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground flex-1">
                {uploadingGlobalCover ? 'Uploading...' : settings.global_cover_url ? '✓ Cover set — upload to replace' : 'Upload Global Cover Photo (16:9)'}
              </span>
              {settings.global_cover_url && (
                <button type="button" onClick={async () => {
                  setSettings(s => ({ ...s, global_cover_url: '' }));
                  await supabase.from('site_settings').update({ global_cover_url: null } as any).eq('id', 'main');
                  toast.success('Global cover removed');
                }} className="text-red-400 text-xs">Clear</button>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleGlobalCoverSelect} />
            </label>
          </div>
        </>
      )}

      {/* ── AGENT SECTION ── */}
      {activeSection === 'agent' && (
        <>
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Live Agent Identity
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Agent Name</label>
                <input value={settings.agent_name} onChange={e => setSettings(s => ({ ...s, agent_name: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
                  placeholder="e.g. AVAX Support" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Agent Avatar</label>
                <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
                  <Image className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground flex-1">{settings.agent_avatar_url ? '✓ Avatar set — upload to replace' : 'Upload Agent Avatar'}</span>
                  {settings.agent_avatar_url && (
                    <button type="button" onClick={() => setSettings(s => ({ ...s, agent_avatar_url: '' }))} className="text-red-400 text-xs">Clear</button>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadFile('avatars', `agent_avatar_${Date.now()}`, file);
                    setSettings(s => ({ ...s, agent_avatar_url: url }));
                    toast.success('Agent avatar uploaded!');
                  }} />
                </label>
                {settings.agent_avatar_url && (
                  <div className="mt-2 w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30">
                    <img src={settings.agent_avatar_url} alt="Agent" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agent Wallpaper */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Agent Chat Wallpaper
            </h3>
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploadingWallpaper ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground flex-1">{settings.agent_bg_url && !settings.agent_bg_url.startsWith('linear') ? '✓ Wallpaper set — upload to replace' : 'Upload Agent Chat Wallpaper'}</span>
              {settings.agent_bg_url && <button type="button" onClick={() => setSettings(s => ({ ...s, agent_bg_url: '' }))} className="text-red-400 text-xs">Clear</button>}
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploadingWallpaper(true);
                const url = await uploadFile('banners', `agent_wallpaper_${Date.now()}`, file);
                setSettings(s => ({ ...s, agent_bg_url: url, agent_bg_color: '' }));
                setUploadingWallpaper(false);
                toast.success('Agent wallpaper uploaded!');
                e.target.value = '';
              }} />
            </label>
          </div>

          {/* AI Support Custom Instructions */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Custom AI Instructions
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Add custom instructions for the AI support agent — e.g. special offers, restricted topics, or specific guidance.</p>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
              rows={4}
              placeholder="e.g. Always mention our 20% discount this week. Never discuss competitor platforms."
              value={(settings as any).ai_support_instructions || ''}
              onChange={e => setSettings(s => ({ ...s, ai_support_instructions: e.target.value } as any))}
            />
          </div>

          {/* Agent Chat Preview */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Agent Chat Appearance
            </h3>
            <div className="rounded-xl p-4 relative overflow-hidden mb-3" style={{
              background: settings.agent_bg_url ? `url(${settings.agent_bg_url}) center/cover` : settings.agent_bg_color,
              minHeight: 100,
            }}>
              <div className="flex justify-start mb-2">
                <div className="px-3 py-2 rounded-2xl" style={{ background: settings.agent_bubble_other, fontSize: FONT_SIZES.find(f => f.key === settings.agent_font_size)?.px || '14px' }}>
                  <p className="text-white text-xs">Hello! How can I help you? 👋</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="px-3 py-2 rounded-2xl" style={{ background: settings.agent_bubble_own, fontSize: FONT_SIZES.find(f => f.key === settings.agent_font_size)?.px || '14px' }}>
                  <p className="text-white text-xs">I need help with VIP plans</p>
                </div>
              </div>
            </div>

            {/* Bg color */}
            <div className="flex gap-3 items-center mb-3">
              <input type="color" value={settings.agent_bg_color} onChange={e => setSettings(s => ({ ...s, agent_bg_color: e.target.value, agent_bg_url: '' }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
              <input value={settings.agent_bg_color} onChange={e => setSettings(s => ({ ...s, agent_bg_color: e.target.value }))}
                placeholder="Background color" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
            </div>

            {/* Bubble colors */}
            {[{ label: 'User Messages', key: 'agent_bubble_own' as const }, { label: "Agent Messages", key: 'agent_bubble_other' as const }].map(({ label, key }) => (
              <div key={key} className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
                  <input value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
                  <div className="w-10 h-10 rounded-xl border border-border" style={{ background: settings[key] }} />
                </div>
              </div>
            ))}

            {/* Font size */}
            <p className="text-xs text-muted-foreground mb-2 font-medium">Font Size:</p>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {FONT_SIZES.map(fs => (
                <button key={fs.key} onClick={() => setSettings(s => ({ ...s, agent_font_size: fs.key }))}
                  className={`py-2 rounded-xl border-2 transition-all press text-center ${settings.agent_font_size === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="font-black text-foreground" style={{ fontSize: fs.px }}>Aa</p>
                  <p className="text-[9px] text-muted-foreground">{fs.label}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => { fetchSettings(); toast.success('Settings reloaded'); }}
          className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground text-sm font-bold press">
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
        <button onClick={saveSettings} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press pink-glow-xs">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save & Apply Theme'}
        </button>
      </div>
    </div>
  );
}
