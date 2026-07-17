import { useState, useEffect } from 'react';
import {
  Bot, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit3, Check, X,
  Upload, Palette, Type, Grid, List, RotateCcw, BarChart2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';

const ICON_OPTIONS = [
  'TrendingUp', 'Target', 'Shield', 'Brain', 'Zap', 'Layers', 'Bell',
  'Newspaper', 'Trophy', 'Sparkles', 'Star', 'BookOpen', 'CandlestickChart',
  'BarChart2', 'Activity', 'DollarSign', 'Globe', 'Lightbulb', 'Compass',
  'PieChart', 'Percent', 'AlertTriangle', 'Eye', 'Search', 'Calculator',
];

const FONT_FAMILIES = [
  { value: 'default', label: 'Default (System)' },
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'mono', label: 'Monospace' },
];

const FONT_SIZES = [
  { value: 'sm', label: 'Small (13px)' },
  { value: 'md', label: 'Medium (15px)' },
  { value: 'lg', label: 'Large (17px)' },
];

interface AITool {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: string;
  systemPrompt: string;
  intro: string;
}

interface SmartMarketTopic {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: string;
  enabled: boolean;
  order_index: number;
}

interface AVAXConfig {
  hub_name: string;
  hub_subtitle: string;
  card_style: 'grid' | 'list';
  chat_bg_color: string;
  chat_bg_url: string;
  chat_bg_gradient_from: string;
  chat_bg_gradient_to: string;
  bubble_own: string;
  bubble_other: string;
  font_size: string;
  font_family: string;
  ai_avatar_url: string;
  tools: AITool[];
  smart_market_topics?: SmartMarketTopic[];
}

const DEFAULT_CONFIG: AVAXConfig = {
  hub_name: 'AVAX AI',
  hub_subtitle: 'Advanced Trading Intelligence',
  card_style: 'grid',
  chat_bg_color: '#080c14',
  chat_bg_url: '',
  chat_bg_gradient_from: '#080c14',
  chat_bg_gradient_to: '#0a1628',
  bubble_own: '#FF1493',
  bubble_other: '#1e2d3d',
  font_size: 'md',
  font_family: 'default',
  ai_avatar_url: '',
  tools: [],
};

const DEFAULT_SM_TOPICS: SmartMarketTopic[] = [
  { id: 'live_forex', name: 'Live Forex Data', desc: 'Real-time currency pair prices, spreads & movements', color: '#2196F3', icon: 'TrendingUp', enabled: true, order_index: 0 },
  { id: 'live_crypto', name: 'Live Crypto Data', desc: 'Bitcoin, Ethereum & top crypto live prices', color: '#FF9800', icon: 'Zap', enabled: true, order_index: 1 },
  { id: 'live_indices', name: 'Live Indices', desc: 'Nasdaq, S&P500, DAX & global indices', color: '#4CAF50', icon: 'BarChart2', enabled: true, order_index: 2 },
  { id: 'live_commodities', name: 'Live Commodities', desc: 'Gold, Oil, Silver & commodity markets', color: '#FFC107', icon: 'DollarSign', enabled: true, order_index: 3 },
  { id: 'volatility_scanner', name: 'Volatility Scanner', desc: 'Identify high volatility pairs & opportunities', color: '#E91E63', icon: 'Activity', enabled: true, order_index: 4 },
  { id: 'strength_meter', name: 'Strength Meter', desc: 'Currency strength analysis across all pairs', color: '#9C27B0', icon: 'PieChart', enabled: true, order_index: 5 },
  { id: 'daily_breakdown', name: 'Daily Market Breakdown', desc: "Today's key movements, setup & outlook", color: '#3F51B5', icon: 'Calendar', enabled: true, order_index: 6 },
  { id: 'weekly_breakdown', name: 'Weekly Breakdown', desc: 'Full week review & next week prep', color: '#009688', icon: 'RefreshCw', enabled: true, order_index: 7 },
  { id: 'risk_management', name: 'Risk Management & R:R', desc: 'Position sizing, lot calculation & risk/reward', color: '#FF1493', icon: 'Shield', enabled: true, order_index: 8 },
  { id: 'price_action', name: 'Price Action', desc: 'Read markets using pure price movement', color: '#795548', icon: 'BarChart2', enabled: true, order_index: 9 },
  { id: 'trend_trading', name: 'Trend Trading', desc: 'How to identify, enter and ride trends', color: '#4CAF50', icon: 'TrendingUp', enabled: true, order_index: 10 },
  { id: 'top_down_analysis', name: 'Top-Down Analysis', desc: 'Multi-timeframe analysis from macro to micro', color: '#9C27B0', icon: 'Eye', enabled: true, order_index: 11 },
  { id: 'trading_psychology', name: 'Trading Psychology', desc: 'Master emotions, discipline & mental edge', color: '#9C27B0', icon: 'Brain', enabled: true, order_index: 12 },
  { id: 'trading_plan', name: 'Trading Plan', desc: 'Build a complete personalized trading plan', color: '#3F51B5', icon: 'BookOpen', enabled: true, order_index: 13 },
  { id: 'prop_firm', name: 'Prop Firm Masterclass', desc: 'How to pass prop firm challenges & get funded', color: '#FFC107', icon: 'Trophy', enabled: true, order_index: 14 },
  { id: 'news_trading', name: 'How to Trade News', desc: 'Profit from economic news releases safely', color: '#607D8B', icon: 'Newspaper', enabled: true, order_index: 15 },
];

export default function AdminAVAXAI() {
  const [config, setConfig] = useState<AVAXConfig>(DEFAULT_CONFIG);
  const [smTopics, setSmTopics] = useState<SmartMarketTopic[]>(DEFAULT_SM_TOPICS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTool, setEditingTool] = useState<AITool | null>(null);
  const [isNewTool, setIsNewTool] = useState(false);
  const [editingSMTopic, setEditingSMTopic] = useState<SmartMarketTopic | null>(null);
  const [isNewSMTopic, setIsNewSMTopic] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'tools' | 'chat' | 'smart_market'>('general');

  useEffect(() => { fetchConfig(); }, []);

  async function fetchConfig() {
    setLoading(true);
    const { data } = await supabase.from('site_settings').select('avax_ai_config').eq('id', 'main').single();
    if (data?.avax_ai_config && typeof data.avax_ai_config === 'object') {
      const merged = { ...DEFAULT_CONFIG, ...data.avax_ai_config };
      setConfig(merged);
      if (data.avax_ai_config.smart_market_topics?.length) {
        setSmTopics(data.avax_ai_config.smart_market_topics);
      }
    }
    setLoading(false);
  }

  async function saveConfig(cfg = config) {
    setSaving(true);
    const payload = { ...cfg, smart_market_topics: smTopics };
    const { error } = await supabase.from('site_settings').update({ avax_ai_config: payload }).eq('id', 'main');
    setSaving(false);
    if (error) toast.error('Failed to save: ' + error.message);
    else toast.success('AVAX AI config saved!');
  }

  function moveTool(index: number, dir: 'up' | 'down') {
    const tools = [...config.tools];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= tools.length) return;
    [tools[index], tools[target]] = [tools[target], tools[index]];
    setConfig(p => ({ ...p, tools }));
  }

  function deleteTool(id: string) {
    setConfig(p => ({ ...p, tools: p.tools.filter(t => t.id !== id) }));
    toast.success('Tool removed');
  }

  function saveTool(tool: AITool) {
    if (!tool.name.trim()) return toast.error('Tool name is required');
    if (isNewTool) {
      setConfig(p => ({ ...p, tools: [...p.tools, { ...tool, id: Date.now().toString() }] }));
    } else {
      setConfig(p => ({ ...p, tools: p.tools.map(t => t.id === tool.id ? tool : t) }));
    }
    setEditingTool(null);
    setIsNewTool(false);
    toast.success(isNewTool ? 'AI tool added!' : 'AI tool updated!');
  }

  function moveSmTopic(index: number, dir: 'up' | 'down') {
    const arr = [...smTopics];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setSmTopics(arr.map((t, i) => ({ ...t, order_index: i })));
  }

  function saveSmTopic(topic: SmartMarketTopic) {
    if (!topic.name.trim()) return toast.error('Topic name required');
    if (isNewSMTopic) {
      setSmTopics(p => [...p, { ...topic, id: Date.now().toString(), order_index: p.length }]);
    } else {
      setSmTopics(p => p.map(t => t.id === topic.id ? topic : t));
    }
    setEditingSMTopic(null);
    setIsNewSMTopic(false);
    toast.success('Topic saved!');
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingBg(true);
    const url = await uploadFile('media', `avax-ai-bg/${Date.now()}`, file);
    setConfig(p => ({ ...p, chat_bg_url: url }));
    setUploadingBg(false);
    toast.success('Background uploaded!');
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadFile('avatars', `avax-ai-avatar/${Date.now()}`, file);
    setConfig(p => ({ ...p, ai_avatar_url: url }));
    setUploadingAvatar(false);
    toast.success('AI avatar uploaded!');
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />)}</div>;

  // ── Tool Editor ──
  if (editingTool) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { setEditingTool(null); setIsNewTool(false); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="font-black text-foreground">{isNewTool ? 'Add New AI Tool' : 'Edit AI Tool'}</h2>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Tool Name</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="e.g. Market Analysis" value={editingTool.name} onChange={e => setEditingTool(p => p ? { ...p, name: e.target.value } : p)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Short Description</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="e.g. Live market conditions & structure" value={editingTool.desc} onChange={e => setEditingTool(p => p ? { ...p, desc: e.target.value } : p)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-muted" value={editingTool.color} onChange={e => setEditingTool(p => p ? { ...p, color: e.target.value } : p)} />
              <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary font-mono" value={editingTool.color} onChange={e => setEditingTool(p => p ? { ...p, color: e.target.value } : p)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Icon Name (lucide-react)</label>
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {ICON_OPTIONS.map(icon => (
                <button key={icon} onClick={() => setEditingTool(p => p ? { ...p, icon } : p)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all press truncate ${editingTool.icon === icon ? 'gradient-pink text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Intro Message</label>
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none" placeholder="Hello! I am your Market Analysis AI..." rows={3} value={editingTool.intro} onChange={e => setEditingTool(p => p ? { ...p, intro: e.target.value } : p)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">System Prompt (AI Instructions)</label>
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none font-mono" placeholder="You are a professional forex AI specializing in..." rows={8} value={editingTool.systemPrompt} onChange={e => setEditingTool(p => p ? { ...p, systemPrompt: e.target.value } : p)} />
          </div>
          <button onClick={() => saveTool(editingTool)} className="w-full py-3 gradient-pink rounded-2xl text-white font-bold flex items-center justify-center gap-2 press">
            <Check className="w-4 h-4" /> {isNewTool ? 'Add Tool' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // ── Smart Market Topic Editor ──
  if (editingSMTopic) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { setEditingSMTopic(null); setIsNewSMTopic(false); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="font-black text-foreground">{isNewSMTopic ? 'Add Smart Market Topic' : 'Edit Topic'}</h2>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase mb-1.5 block">Topic Name</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="e.g. Live Forex Data" value={editingSMTopic.name} onChange={e => setEditingSMTopic(p => p ? { ...p, name: e.target.value } : p)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase mb-1.5 block">Description</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Short description" value={editingSMTopic.desc} onChange={e => setEditingSMTopic(p => p ? { ...p, desc: e.target.value } : p)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase mb-1.5 block">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-12 h-10 rounded-xl border border-border cursor-pointer bg-muted" value={editingSMTopic.color} onChange={e => setEditingSMTopic(p => p ? { ...p, color: e.target.value } : p)} />
              <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none font-mono" value={editingSMTopic.color} onChange={e => setEditingSMTopic(p => p ? { ...p, color: e.target.value } : p)} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
            <p className="text-sm font-bold text-foreground">Enabled</p>
            <button onClick={() => setEditingSMTopic(p => p ? { ...p, enabled: !p.enabled } : p)}>
              {editingSMTopic.enabled ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
            </button>
          </div>
          <button onClick={() => saveSmTopic(editingSMTopic)} className="w-full py-3 gradient-pink rounded-2xl text-white font-bold flex items-center justify-center gap-2 press">
            <Check className="w-4 h-4" /> {isNewSMTopic ? 'Add Topic' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // ── Main Panel ──
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center pink-glow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-black text-foreground">AVAX AI Manager</h2>
          <p className="text-xs text-muted-foreground">Configure AI tools, styles & chat appearance</p>
        </div>
        <button onClick={() => saveConfig()} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-60">
          {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save All
        </button>
      </div>

      {/* Section tabs */}
      <div className="grid grid-cols-4 gap-1.5">
        {([
          { key: 'general', label: '⚙️ General' },
          { key: 'tools', label: '🤖 Tools' },
          { key: 'chat', label: '🎨 Chat' },
          { key: 'smart_market', label: '📊 Market' },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`py-2 rounded-xl text-xs font-bold transition-all press ${activeSection === s.key ? 'gradient-pink text-white' : 'bg-card border border-border text-muted-foreground'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ── */}
      {activeSection === 'general' && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Hub Settings</h3>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Hub Name</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="AVAX AI" value={config.hub_name} onChange={e => setConfig(p => ({ ...p, hub_name: e.target.value }))} />
            <p className="text-[10px] text-muted-foreground mt-1">Appears in hub header, chat header, and hero button</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Hub Subtitle</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Advanced Trading Intelligence" value={config.hub_subtitle} onChange={e => setConfig(p => ({ ...p, hub_subtitle: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">AI Avatar Image</label>
            <p className="text-[10px] text-muted-foreground mb-2">Shows as AI icon in all chat screens and message bubbles</p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/30 bg-muted flex items-center justify-center">
                {config.ai_avatar_url ? <img src={config.ai_avatar_url} alt="AI Avatar" className="w-full h-full object-cover" /> : <Bot className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1 space-y-2">
                <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-xs outline-none focus:border-primary" placeholder="Image URL or upload below" value={config.ai_avatar_url} onChange={e => setConfig(p => ({ ...p, ai_avatar_url: e.target.value }))} />
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-all press">
                  {uploadingAvatar ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{config.ai_avatar_url ? '✓ Set — click to change' : 'Upload AI avatar'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                {config.ai_avatar_url && <button onClick={() => setConfig(p => ({ ...p, ai_avatar_url: '' }))} className="text-xs text-red-400 press">Remove avatar</button>}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1.5 block">Card Layout Style</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfig(p => ({ ...p, card_style: 'grid' }))}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all press ${config.card_style === 'grid' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                <Grid className="w-4 h-4" /> Grid (2 cols)
              </button>
              <button onClick={() => setConfig(p => ({ ...p, card_style: 'list' }))}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all press ${config.card_style === 'list' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                <List className="w-4 h-4" /> List (tall)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOLS ── */}
      {activeSection === 'tools' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">AI Tools <span className="text-muted-foreground font-normal">({config.tools.length} custom + built-in)</span></p>
            <button onClick={() => { setEditingTool({ id: '', name: '', desc: '', color: '#FF1493', icon: 'Bot', systemPrompt: '', intro: '' }); setIsNewTool(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
              <Plus className="w-3.5 h-3.5" /> Add AI Tool
            </button>
          </div>
          {config.tools.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No custom tools yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Built-in tools always shown. Custom tools appear at top.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.tools.map((tool, idx) => (
                <div key={tool.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                    style={{ background: tool.color + '22', color: tool.color, border: `1px solid ${tool.color}44` }}>
                    {tool.name[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tool.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveTool(idx, 'up')} disabled={idx === 0} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => moveTool(idx, 'down')} disabled={idx === config.tools.length - 1} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => { setEditingTool({ ...tool }); setIsNewTool(false); }} className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center press"><Edit3 className="w-3.5 h-3.5 text-primary" /></button>
                    <button onClick={() => deleteTool(tool.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center press"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CHAT STYLE ── */}
      {activeSection === 'chat' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Chat Background</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-bold mb-1.5 block">From Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="w-10 h-9 rounded-lg border border-border bg-muted cursor-pointer" value={config.chat_bg_gradient_from} onChange={e => setConfig(p => ({ ...p, chat_bg_gradient_from: e.target.value }))} />
                  <input className="flex-1 bg-muted border border-border rounded-lg px-2 py-2 text-foreground text-xs outline-none font-mono" value={config.chat_bg_gradient_from} onChange={e => setConfig(p => ({ ...p, chat_bg_gradient_from: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-bold mb-1.5 block">To Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="w-10 h-9 rounded-lg border border-border bg-muted cursor-pointer" value={config.chat_bg_gradient_to} onChange={e => setConfig(p => ({ ...p, chat_bg_gradient_to: e.target.value }))} />
                  <input className="flex-1 bg-muted border border-border rounded-lg px-2 py-2 text-foreground text-xs outline-none font-mono" value={config.chat_bg_gradient_to} onChange={e => setConfig(p => ({ ...p, chat_bg_gradient_to: e.target.value }))} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Background Image (optional)</label>
              <div className="flex gap-2">
                <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-xs outline-none focus:border-primary" placeholder="Image URL or upload below" value={config.chat_bg_url} onChange={e => setConfig(p => ({ ...p, chat_bg_url: e.target.value }))} />
                {config.chat_bg_url && <button onClick={() => setConfig(p => ({ ...p, chat_bg_url: '' }))} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center press"><RotateCcw className="w-3.5 h-3.5 text-red-400" /></button>}
              </div>
              <label className="mt-2 flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-all press">
                {uploadingBg ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground">{config.chat_bg_url ? '✓ Image set — click to change' : 'Upload background image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              </label>
            </div>
            <div className="w-full h-16 rounded-xl border border-border/50 relative overflow-hidden"
              style={{ background: config.chat_bg_url ? `url(${config.chat_bg_url}) center/cover` : `linear-gradient(135deg, ${config.chat_bg_gradient_from}, ${config.chat_bg_gradient_to})` }}>
              <span className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">Preview</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Message Bubbles</h3>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: 'My Messages', key: 'bubble_own' as const }, { label: 'AI Messages', key: 'bubble_other' as const }].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground font-bold mb-1.5 block">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-9 rounded-lg border border-border bg-muted cursor-pointer" value={config[key]} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                    <input className="flex-1 bg-muted border border-border rounded-lg px-2 py-2 text-foreground text-xs outline-none font-mono" value={config[key]} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                  <div className="mt-1.5 px-3 py-2 rounded-2xl text-white text-xs font-medium w-fit" style={{ background: config[key] }}>Sample</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Type className="w-4 h-4 text-primary" /> Font Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Font Family</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none" value={config.font_family} onChange={e => setConfig(p => ({ ...p, font_family: e.target.value }))}>
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Font Size</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none" value={config.font_size} onChange={e => setConfig(p => ({ ...p, font_size: e.target.value }))}>
                  {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SMART MARKET MANAGEMENT ── */}
      {activeSection === 'smart_market' && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-4 h-4 text-primary" />
              <p className="font-bold text-foreground text-sm">Smart Market Topics</p>
            </div>
            <p className="text-xs text-muted-foreground">Enable/disable topics, edit names & descriptions, reorder. Changes appear in Smart Market page.</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{smTopics.filter(t => t.enabled).length}/{smTopics.length} topics enabled</p>
            <button onClick={() => { setEditingSMTopic({ id: '', name: '', desc: '', color: '#2196F3', icon: 'TrendingUp', enabled: true, order_index: smTopics.length }); setIsNewSMTopic(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
              <Plus className="w-3.5 h-3.5" /> Add Topic
            </button>
          </div>

          <div className="space-y-2">
            {smTopics.map((topic, idx) => (
              <div key={topic.id} className={`bg-card border rounded-2xl p-3 flex items-center gap-3 transition-all ${!topic.enabled ? 'opacity-50' : 'border-border'}`}
                style={{ borderColor: topic.enabled ? `${topic.color}30` : undefined }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: topic.color }} />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${topic.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{topic.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{topic.desc}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => moveSmTopic(idx, 'up')} disabled={idx === 0} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronUp className="w-3 h-3 text-muted-foreground" /></button>
                  <button onClick={() => moveSmTopic(idx, 'down')} disabled={idx === smTopics.length - 1} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronDown className="w-3 h-3 text-muted-foreground" /></button>
                  <button onClick={() => setSmTopics(p => p.map(t => t.id === topic.id ? { ...t, enabled: !t.enabled } : t))}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold press ${topic.enabled ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {topic.enabled ? 'On' : 'Off'}
                  </button>
                  <button onClick={() => { setEditingSMTopic({ ...topic }); setIsNewSMTopic(false); }} className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center press"><Edit3 className="w-3.5 h-3.5 text-primary" /></button>
                  <button onClick={() => { setSmTopics(p => p.filter(t => t.id !== topic.id)); toast.success('Topic removed'); }} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center press"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <button onClick={() => saveConfig()} disabled={saving}
        className="w-full py-3.5 gradient-pink rounded-2xl text-white font-bold flex items-center justify-center gap-2 pink-glow press disabled:opacity-60">
        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        Save AVAX AI Config
      </button>
    </div>
  );
}
