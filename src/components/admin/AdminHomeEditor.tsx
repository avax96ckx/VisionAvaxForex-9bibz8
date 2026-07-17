import { useState, useEffect, useRef } from 'react';
import {
  Home, GripVertical, Eye, EyeOff, Save, RefreshCw, ChevronUp, ChevronDown,
  Layout, Navigation, Sliders, ToggleLeft, ToggleRight, Type, Monitor
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type SectionKey = 'profile_pill' | 'hero' | 'stats' | 'signals' | 'courses' | 'fst_section' | 'challenge' | 'apk' | 'vip' | 'testimonials';

const SECTION_META: Record<SectionKey, { label: string; emoji: string; desc: string }> = {
  profile_pill: { label: 'Profile Pill', emoji: '👤', desc: 'User avatar + name + badge banner' },
  hero: { label: 'Hero Banner', emoji: '🖼️', desc: 'Main hero image with CTA buttons' },
  stats: { label: 'Stats Row', emoji: '📊', desc: 'Members, Win Rate, Experience' },
  signals: { label: 'Live Signals', emoji: '📈', desc: 'Latest active trading signals' },
  courses: { label: 'Courses', emoji: '🎓', desc: 'Trading course cards grid' },
  fst_section: { label: 'Future Successful Traders', emoji: '🚀', desc: 'Journal, Challenges, Economic, Smart Market boxes' },
  challenge: { label: 'Trading Challenge', emoji: '🏆', desc: 'Active challenge leaderboard & prize' },
  apk: { label: 'Mobile App', emoji: '📱', desc: 'APK download section' },
  vip: { label: 'VIP Section', emoji: '👑', desc: 'VIP plans / upgrade prompt' },
  testimonials: { label: 'Reviews', emoji: '⭐', desc: 'Member testimonials' },
};

const NAV_STYLES = [
  { key: 'default', label: 'Default', desc: 'Standard icons + labels with top indicator' },
  { key: 'telegram', label: 'Telegram Style', desc: 'Clean icons, no card background, extends to edges' },
  { key: 'float', label: 'Floating Pill', desc: 'Floating pill-shaped nav, elevated above screen' },
  { key: 'icons_only', label: 'Icons Only', desc: 'No labels, minimal' },
  { key: 'labels_only', label: 'Labels Only', desc: 'Text navigation only' },
  { key: 'pill', label: 'Pill Style', desc: 'Rounded active pill buttons' },
  { key: 'flat', label: 'Flat', desc: 'No background, flat transparent' },
];

interface Settings {
  home_layout: SectionKey[];
  show_header: boolean;
  show_bottom_nav: boolean;
  nav_style: string;
  header_config: {
    logoFontSize: string;
    logoFontStyle: string;
    logoPosition: string;
    showMessengerIcon: boolean;
    showBellIcon: boolean;
    memberNameSize: string;
    badgeSpacing: string;
  };
}

export default function AdminHomeEditor() {
  const [settings, setSettings] = useState<Settings>({
    home_layout: ['profile_pill', 'hero', 'stats', 'signals', 'courses', 'apk', 'vip', 'testimonials'],
    show_header: true,
    show_bottom_nav: true,
    nav_style: 'default',
    header_config: {
      logoFontSize: '13',
      logoFontStyle: 'gradient',
      logoPosition: 'center',
      showMessengerIcon: true,
      showBellIcon: true,
      memberNameSize: 'sm',
      badgeSpacing: 'normal',
    },
  });
  const [hiddenSections, setHiddenSections] = useState<Set<SectionKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('site_settings')
      .select('home_layout, show_header, show_bottom_nav, nav_style, header_config')
      .eq('id', 'main').single();
    if (data) {
      const layout = (data as any).home_layout || ['profile_pill', 'hero', 'stats', 'signals', 'courses', 'apk', 'vip', 'testimonials'];
      const allSections = Object.keys(SECTION_META) as SectionKey[];
      const hidden = new Set<SectionKey>(allSections.filter(s => !layout.includes(s)));
      const hc = (data as any).header_config || {};
      setSettings({
        home_layout: layout,
        show_header: (data as any).show_header !== false,
        show_bottom_nav: (data as any).show_bottom_nav !== false,
        nav_style: (data as any).nav_style || 'default',
        header_config: {
          logoFontSize: hc.logoFontSize ?? '13',
          logoFontStyle: hc.logoFontStyle ?? 'gradient',
          logoPosition: hc.logoPosition ?? 'center',
          showMessengerIcon: hc.showMessengerIcon !== false,
          showBellIcon: hc.showBellIcon !== false,
          memberNameSize: hc.memberNameSize ?? 'sm',
          badgeSpacing: hc.badgeSpacing ?? 'normal',
        },
      });
      setHiddenSections(hidden);
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({
      home_layout: settings.home_layout,
      show_header: settings.show_header,
      show_bottom_nav: settings.show_bottom_nav,
      nav_style: settings.nav_style,
      header_config: settings.header_config,
    } as any).eq('id', 'main');
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success('Home layout saved! Reload to see changes.');
    }
    setSaving(false);
  }

  function toggleSection(key: SectionKey) {
    if (hiddenSections.has(key)) {
      // Show: add to end of layout
      setHiddenSections(prev => { const n = new Set(prev); n.delete(key); return n; });
      setSettings(prev => ({ ...prev, home_layout: [...prev.home_layout, key] }));
    } else {
      // Hide: remove from layout
      setHiddenSections(prev => new Set([...prev, key]));
      setSettings(prev => ({ ...prev, home_layout: prev.home_layout.filter(s => s !== key) }));
    }
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const newLayout = [...settings.home_layout];
    [newLayout[idx - 1], newLayout[idx]] = [newLayout[idx], newLayout[idx - 1]];
    setSettings(prev => ({ ...prev, home_layout: newLayout }));
  }

  function moveDown(idx: number) {
    if (idx === settings.home_layout.length - 1) return;
    const newLayout = [...settings.home_layout];
    [newLayout[idx + 1], newLayout[idx]] = [newLayout[idx], newLayout[idx + 1]];
    setSettings(prev => ({ ...prev, home_layout: newLayout }));
  }

  // Drag handlers
  function onDragStart(idx: number) {
    dragItem.current = idx;
    setDragging(idx);
  }
  function onDragEnter(idx: number) {
    dragOverItem.current = idx;
    setDragOver(idx);
  }
  function onDragEnd() {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLayout = [...settings.home_layout];
      const [removed] = newLayout.splice(dragItem.current, 1);
      newLayout.splice(dragOverItem.current, 0, removed);
      setSettings(prev => ({ ...prev, home_layout: newLayout }));
    }
    setDragging(null);
    setDragOver(null);
    dragItem.current = null;
    dragOverItem.current = null;
  }

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  const allSections = Object.keys(SECTION_META) as SectionKey[];
  const hiddenList = allSections.filter(s => hiddenSections.has(s));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Home className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Home Page Editor</h3>
        </div>
        <p className="text-xs text-muted-foreground">Drag sections to reorder, toggle to show/hide. Saved order appears instantly on homepage.</p>
      </div>

      {/* Active sections (drag to reorder) */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <Layout className="w-4 h-4 text-primary" /> Visible Sections ({settings.home_layout.length})
        </h3>
        <div className="space-y-1.5">
          {settings.home_layout.map((key, idx) => {
            const meta = SECTION_META[key as SectionKey];
            if (!meta) return null;
            const isDraggingThis = dragging === idx;
            const isDragTarget = dragOver === idx && dragging !== idx;
            return (
              <div
                key={key}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all select-none ${
                  isDraggingThis ? 'opacity-40 scale-95' : isDragTarget ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border bg-muted/20'
                }`}
                style={{ cursor: 'grab' }}
              >
                {/* Grip */}
                <div className="text-muted-foreground flex-shrink-0">
                  <GripVertical className="w-4 h-4" />
                </div>
                {/* Order number */}
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[11px] font-black flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>
                {/* Emoji */}
                <span className="text-base flex-shrink-0">{meta.emoji}</span>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                </div>
                {/* Move buttons */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press"
                  >
                    <ChevronUp className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === settings.home_layout.length - 1}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press"
                  >
                    <ChevronDown className="w-4 h-4 text-foreground" />
                  </button>
                  {/* Hide */}
                  <button
                    onClick={() => toggleSection(key as SectionKey)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center press"
                    title="Hide section"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
          {settings.home_layout.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              All sections hidden. Restore sections below.
            </div>
          )}
        </div>
      </div>

      {/* Hidden sections */}
      {hiddenList.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-muted-foreground" /> Hidden Sections
          </h3>
          <div className="space-y-1.5">
            {hiddenList.map(key => {
              const meta = SECTION_META[key];
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/10 opacity-60">
                  <span className="text-base">{meta.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleSection(key)}
                    className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center press"
                    title="Show section"
                  >
                    <Eye className="w-3.5 h-3.5 text-green-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" /> Navigation Controls
        </h3>

        <div className="space-y-3">
          {/* Show header */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-bold text-foreground">Top Header Bar</p>
              <p className="text-[10px] text-muted-foreground">Logo + notification + avatar</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, show_header: !prev.show_header }))}
              className="flex-shrink-0"
            >
              {settings.show_header
                ? <ToggleRight className="w-8 h-8 text-primary" />
                : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              }
            </button>
          </div>

          {/* Show bottom nav */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-bold text-foreground">Bottom Navigation</p>
              <p className="text-[10px] text-muted-foreground">Home, Signals, Courses, VIP, Settings</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, show_bottom_nav: !prev.show_bottom_nav }))}
              className="flex-shrink-0"
            >
              {settings.show_bottom_nav
                ? <ToggleRight className="w-8 h-8 text-primary" />
                : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Nav Style */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" /> Navigation Style
        </h3>
        <div className="space-y-2">
          {NAV_STYLES.map(ns => (
            <button
              key={ns.key}
              onClick={() => setSettings(prev => ({ ...prev, nav_style: ns.key }))}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all press text-left ${
                settings.nav_style === ns.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'
              }`}
            >
              <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${settings.nav_style === ns.key ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
              <div>
                <p className="text-sm font-bold text-foreground">{ns.label}</p>
                <p className="text-[10px] text-muted-foreground">{ns.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Header Customizer */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" /> Header Bar Customization
        </h3>

        <div className="space-y-3">
          {/* Logo font size */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1">
              <Type className="w-3 h-3" /> Logo Font Size (px)
            </label>
            <input
              type="number" min="10" max="22"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              value={settings.header_config.logoFontSize}
              onChange={e => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, logoFontSize: e.target.value } }))}
            />
          </div>

          {/* Logo font style */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Logo Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'gradient', label: 'White→Pink Gradient' },
                { key: 'solid_pink', label: 'Solid Pink' },
                { key: 'white', label: 'All White' },
                { key: 'gold', label: 'Gold Gradient' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, logoFontStyle: opt.key } }))}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all press ${
                    settings.header_config.logoFontStyle === opt.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logo position */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Logo Position</label>
            <div className="flex gap-1.5">
              {['left', 'center', 'right'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, logoPosition: pos } }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all press ${
                    settings.header_config.logoPosition === pos ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Member name size */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Member Name Size</label>
            <div className="flex gap-1.5">
              {[{ key: 'xs', label: 'XS' }, { key: 'sm', label: 'SM' }, { key: 'md', label: 'MD' }, { key: 'lg', label: 'LG' }].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, memberNameSize: s.key } }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all press ${
                    settings.header_config.memberNameSize === s.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Badge spacing */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Badge Spacing (next to name)</label>
            <div className="flex gap-1.5">
              {[
                { key: 'tight', label: 'Tight' },
                { key: 'closer', label: 'Closer' },
                { key: 'normal', label: 'Normal' },
                { key: 'wide', label: 'Wide' },
              ].map(sp => (
                <button
                  key={sp.key}
                  onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, badgeSpacing: sp.key } }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all press ${
                    settings.header_config.badgeSpacing === sp.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-bold text-foreground">Messenger Icon</p>
                <p className="text-[10px] text-muted-foreground">Show 💬 icon in header</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, showMessengerIcon: !prev.header_config.showMessengerIcon } }))}
                className="flex-shrink-0"
              >
                {settings.header_config.showMessengerIcon
                  ? <ToggleRight className="w-8 h-8 text-primary" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                }
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-bold text-foreground">Notification Bell Icon</p>
                <p className="text-[10px] text-muted-foreground">Show 🔔 icon in header</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, header_config: { ...prev.header_config, showBellIcon: !prev.header_config.showBellIcon } }))}
                className="flex-shrink-0"
              >
                {settings.header_config.showBellIcon
                  ? <ToggleRight className="w-8 h-8 text-primary" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={fetchSettings}
          className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground text-sm font-bold press"
        >
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press pink-glow-xs"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Home Layout'}
        </button>
      </div>
    </div>
  );
}
