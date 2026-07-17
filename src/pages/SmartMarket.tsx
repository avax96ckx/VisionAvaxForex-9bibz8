import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Send, Loader2, Mic, MicOff, Trash2, Bot,
  TrendingUp, BarChart2, Globe, Zap, Activity, DollarSign, BookOpen,
  Brain, Shield, Target, Layers, Star, ChevronRight, PieChart,
  RefreshCw, Eye, Calculator, Newspaper, Calendar, Clock, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isVIPActive } from '@/lib/supabase';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';

const SMART_MARKET_TOPICS = [
  // Live Market Data
  { id: 'live_forex', category: 'Live Data', name: 'Live Forex Data', desc: 'Real-time currency pair prices, spreads & movements', icon: 'TrendingUp', color: '#2196F3' },
  { id: 'live_crypto', category: 'Live Data', name: 'Live Crypto Data', desc: 'Bitcoin, Ethereum & top crypto live prices', icon: 'Zap', color: '#FF9800' },
  { id: 'live_indices', category: 'Live Data', name: 'Live Indices', desc: 'Nasdaq, S&P500, DAX & global indices', icon: 'BarChart2', color: '#4CAF50' },
  { id: 'live_commodities', category: 'Live Data', name: 'Live Commodities', desc: 'Gold, Oil, Silver & commodity markets', icon: 'DollarSign', color: '#FFC107' },
  { id: 'volatility_scanner', category: 'Live Data', name: 'Volatility Scanner', desc: 'Identify high volatility pairs & opportunities', icon: 'Activity', color: '#E91E63' },
  { id: 'strength_meter', category: 'Live Data', name: 'Strength Meter', desc: 'Currency strength analysis across all pairs', icon: 'PieChart', color: '#9C27B0' },
  { id: 'market_heatmap', category: 'Live Data', name: 'Market Heatmap', desc: 'Visual heatmap of market performance', icon: 'Globe', color: '#00BCD4' },
  { id: 'correlation_matrix', category: 'Live Data', name: 'Correlation Matrix', desc: 'Pair correlations for risk management', icon: 'Layers', color: '#607D8B' },
  // Analysis
  { id: 'daily_breakdown', category: 'Analysis', name: 'Daily Market Breakdown', desc: "Today's key movements, setup & outlook", icon: 'Calendar', color: '#3F51B5' },
  { id: 'mid_week', category: 'Analysis', name: 'Mid-Week Breakdown', desc: 'Wednesday market assessment & adjustments', icon: 'Clock', color: '#FF5722' },
  { id: 'weekly_breakdown', category: 'Analysis', name: 'Weekly Breakdown', desc: 'Full week review, performance & next week prep', icon: 'RefreshCw', color: '#009688' },
  { id: 'trade_recaps', category: 'Analysis', name: 'Trade Recaps', desc: 'Detailed review of recent trades & lessons', icon: 'Eye', color: '#795548' },
  { id: 'liquidity_analysis', category: 'Analysis', name: 'Liquidity Analysis', desc: 'Smart money liquidity pools & order flow', icon: 'Target', color: '#FF1493' },
  // Education
  { id: 'webinars', category: 'Education', name: 'Webinars', desc: 'Live and recorded trading webinars', icon: 'Star', color: '#FF9800' },
  { id: 'free_resources', category: 'Education', name: 'Free Resources', desc: 'Free trading guides, PDFs & materials', icon: 'BookOpen', color: '#4CAF50' },
  { id: 'physical_masterclass', category: 'Education', name: 'Physical Masterclass', desc: 'In-person trading masterclass info & schedule', icon: 'Award', color: '#2196F3' },
  { id: 'forex_brokerage', category: 'Education', name: 'Forex Brokerage', desc: 'How to choose & use a forex broker', icon: 'Shield', color: '#607D8B' },
  { id: 'prop_firm', category: 'Education', name: 'Prop Firm Masterclass', desc: 'How to pass prop firm challenges & get funded', icon: 'Trophy', color: '#FFC107' },
  // Psychology & Mindset
  { id: 'trading_psychology', category: 'Psychology', name: 'Trading Psychology', desc: 'Master emotions, discipline & mental edge', icon: 'Brain', color: '#9C27B0' },
  { id: 'dealing_losses', category: 'Psychology', name: 'Dealing with Losses', desc: 'How to handle losses and bounce back stronger', icon: 'Shield', color: '#E91E63' },
  { id: 'fomo_anxiety', category: 'Psychology', name: 'FOMO & Anxiety', desc: 'Overcome FOMO, anxiety & overtrading', icon: 'Brain', color: '#FF5722' },
  { id: 'overconfidence', category: 'Psychology', name: 'Overconfidence', desc: 'Recognize and manage overconfidence bias', icon: 'Eye', color: '#9C27B0' },
  { id: 'mass_psychology', category: 'Psychology', name: 'Mass Psychology', desc: 'How market sentiment & crowd behavior works', icon: 'Globe', color: '#3F51B5' },
  // Technical Skills
  { id: 'backtesting', category: 'Technical', name: 'Backtesting & Forward Testing', desc: 'How to test strategies on historical & live data', icon: 'Calculator', color: '#009688' },
  { id: 'watchlist_prep', category: 'Technical', name: 'Watchlist Preparation', desc: 'How to build and manage your daily watchlist', icon: 'Target', color: '#2196F3' },
  { id: 'journaling', category: 'Technical', name: 'Journaling', desc: 'How to journal trades for improvement', icon: 'BookOpen', color: '#FF9800' },
  { id: 'timeframe_structure', category: 'Technical', name: 'Timeframe & Market Structure', desc: 'Understanding market structure across timeframes', icon: 'Layers', color: '#4CAF50' },
  { id: 'break_of_structure', category: 'Technical', name: 'Break of Structure (BOS)', desc: 'Identify and trade break of structure signals', icon: 'Zap', color: '#E91E63' },
  { id: 'price_action', category: 'Technical', name: 'Price Action', desc: 'Read markets using pure price movement', icon: 'BarChart2', color: '#795548' },
  { id: 'support_resistance', category: 'Technical', name: 'Support & Resistance', desc: 'Key levels, zones and price reactions', icon: 'TrendingUp', color: '#FF5722' },
  { id: 'entry_refinement', category: 'Technical', name: 'Entry Refinement', desc: 'Refine entries for better risk/reward', icon: 'Target', color: '#2196F3' },
  { id: 'stop_loss', category: 'Technical', name: 'Stop Loss Formula', desc: 'Where to place SL for every setup type', icon: 'Shield', color: '#F44336' },
  { id: 'take_profit', category: 'Technical', name: 'Take Profit Principles', desc: 'When and where to take profits', icon: 'Star', color: '#4CAF50' },
  { id: 'trade_management', category: 'Technical', name: 'Trade Management', desc: 'How to manage open trades effectively', icon: 'Activity', color: '#00BCD4' },
  { id: 'top_down_analysis', category: 'Technical', name: 'Top-Down Analysis', desc: 'Multi-timeframe analysis from macro to micro', icon: 'Eye', color: '#9C27B0' },
  { id: 'validation', category: 'Technical', name: 'Validation & Invalidation', desc: 'When a setup is valid or invalidated', icon: 'Calculator', color: '#FF9800' },
  { id: 'dimunation', category: 'Technical', name: 'Accumulation & Distribution', desc: 'Smart money accumulation and distribution zones', icon: 'Layers', color: '#3F51B5' },
  { id: 'inverted_dimunation', category: 'Technical', name: 'Inverted Accumulation', desc: 'Advanced inverted accumulation patterns', icon: 'PieChart', color: '#FF1493' },
  { id: 'currency_correlation', category: 'Technical', name: 'Currency Pair Correlation', desc: 'How pairs correlate and affect each other', icon: 'Globe', color: '#607D8B' },
  { id: 'fundamental_price', category: 'Technical', name: 'Fundamental & Price Action', desc: 'Combining fundamentals with price action', icon: 'Newspaper', color: '#FF9800' },
  { id: 'trend_trading', category: 'Technical', name: 'Trend Trading', desc: 'How to identify, enter and ride trends', icon: 'TrendingUp', color: '#4CAF50' },
  { id: 'confirmation', category: 'Technical', name: 'Confirmation vs Non-Confirmation', desc: 'When to wait for confirmation before entry', icon: 'Eye', color: '#2196F3' },
  // Risk & Money
  { id: 'risk_management', category: 'Risk & Money', name: 'Risk Management & R:R', desc: 'Position sizing, lot calculation & risk/reward', icon: 'Shield', color: '#FF1493' },
  { id: 'probability', category: 'Risk & Money', name: 'Probability in Trading', desc: 'Statistical edge and probability thinking', icon: 'PieChart', color: '#9C27B0' },
  { id: 'withdraw_diversification', category: 'Risk & Money', name: 'Withdrawal & Diversification', desc: 'When and how to withdraw profits safely', icon: 'DollarSign', color: '#4CAF50' },
  { id: 'capital_growth', category: 'Risk & Money', name: 'Capital Growth Techniques', desc: 'Strategies to compound and grow capital', icon: 'TrendingUp', color: '#FFC107' },
  // Trading Life
  { id: 'trading_plan', category: 'Trading Life', name: 'Trading Plan', desc: 'Build a complete personalized trading plan', icon: 'BookOpen', color: '#3F51B5' },
  { id: 'planning_journaling', category: 'Trading Life', name: 'Planning & Journaling', desc: 'Daily planning and journaling for consistency', icon: 'Calendar', color: '#00BCD4' },
  { id: 'golden_principles', category: 'Trading Life', name: 'Golden Principles', desc: 'Core rules every successful trader follows', icon: 'Star', color: '#FFC107' },
  { id: 'flow_zone', category: 'Trading Life', name: 'Flow Zone', desc: 'How to get and stay in the trading flow zone', icon: 'Zap', color: '#E91E63' },
  { id: 'accountability', category: 'Trading Life', name: 'Accountability & Perfectionism', desc: 'Build accountability & avoid perfectionism traps', icon: 'Award', color: '#FF9800' },
  { id: 'routine', category: 'Trading Life', name: 'Trading Routine', desc: 'Build a profitable daily trading routine', icon: 'Clock', color: '#009688' },
  { id: 'streams_income', category: 'Trading Life', name: 'Streams of Income', desc: 'Multiple income sources for financial freedom', icon: 'DollarSign', color: '#4CAF50' },
  { id: 'full_time_trading', category: 'Trading Life', name: 'Reality of Full-Time Trading', desc: 'What it really takes to trade full time', icon: 'Brain', color: '#FF5722' },
  { id: 'goals_setting', category: 'Trading Life', name: 'Goals Setting', desc: 'Set realistic, measurable trading goals', icon: 'Target', color: '#2196F3' },
  { id: 'trading_life_balance', category: 'Trading Life', name: 'Trading & Life Balance', desc: 'Balance trading with personal life effectively', icon: 'Activity', color: '#9C27B0' },
  { id: 'news_trading', category: 'Trading Life', name: 'How to Trade News', desc: 'Profit from economic news releases safely', icon: 'Newspaper', color: '#607D8B' },
  { id: 'building_experience', category: 'Trading Life', name: 'Building Experience', desc: 'How to gain real trading experience faster', icon: 'TrendingUp', color: '#795548' },
  { id: 'confirmation_bias', category: 'Trading Life', name: 'Confirmation Bias', desc: 'Recognize and eliminate confirmation bias', icon: 'Eye', color: '#FF1493' },
  { id: 'balancing_work', category: 'Trading Life', name: 'Balancing Trading & Work', desc: 'Trade alongside a full-time job effectively', icon: 'Clock', color: '#3F51B5' },
  { id: 'learning_habits', category: 'Trading Life', name: 'Learning from Trading Habits', desc: 'Analyze habits to improve performance', icon: 'BookOpen', color: '#00BCD4' },
];

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, BarChart2, Globe, Zap, Activity, DollarSign, BookOpen,
  Brain, Shield, Target, Layers, Star, ChevronRight, PieChart,
  Eye, Calculator, Newspaper, Calendar, Clock, Award, Bot,
  RefreshCw, Trophy: Award,
};

const CATEGORIES = ['All', ...Array.from(new Set(SMART_MARKET_TOPICS.map(t => t.category)))];

interface AVAXConfig {
  chat_bg_gradient_from: string;
  chat_bg_gradient_to: string;
  chat_bg_url: string;
  bubble_own: string;
  bubble_other: string;
  font_size: string;
  font_family: string;
  ai_avatar_url: string;
}

const DEFAULT_CONFIG: AVAXConfig = {
  chat_bg_gradient_from: '#080c14',
  chat_bg_gradient_to: '#0a1628',
  chat_bg_url: '',
  bubble_own: '#FF1493',
  bubble_other: '#1e2d3d',
  font_size: 'md',
  font_family: 'default',
  ai_avatar_url: '',
};

const FONT_SIZE_MAP: Record<string, string> = { sm: '13px', md: '15px', lg: '17px' };
const FONT_FAMILY_MAP: Record<string, string> = {
  default: 'inherit',
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  mono: "'Courier New', monospace",
};

let _audioCtx: AudioContext | null = null;
function getAC() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _audioCtx;
}
function playChime() {
  try {
    const ctx = getAC();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.10, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.start(t); osc.stop(t + 0.39);
    });
  } catch {}
}

function useVoice(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<any>(null);
  function toggle() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported. Use Chrome.'); return; }
    if (listening) { ref.current?.stop(); setListening(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'sw-KE'; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { onText(e.results[0][0].transcript); setListening(false); };
    r.onerror = (e: any) => {
      if (e.error === 'language-not-supported' || e.error === 'no-speech') {
        const r2 = new SR(); r2.lang = 'en-US'; r2.continuous = false; r2.interimResults = false;
        r2.onresult = (ev: any) => { onText(ev.results[0][0].transcript); setListening(false); };
        r2.onerror = () => setListening(false); r2.onend = () => setListening(false);
        r2.start(); ref.current = r2; return;
      }
      setListening(false);
    };
    r.onend = () => setListening(false);
    r.start(); setListening(true);
  }
  return { listening, toggle };
}

interface Message { role: 'user' | 'assistant'; content: string; id: string; }

function TopicChat({ topic, config, onBack }: { topic: typeof SMART_MARKET_TOPICS[0]; config: AVAXConfig; onBack: () => void }) {
  const storageKey = `smart_market_chat_${topic.id}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  const fontSize = FONT_SIZE_MAP[config.font_size] || '15px';
  const fontFamily = FONT_FAMILY_MAP[config.font_family] || 'inherit';
  const Icon = ICON_MAP[topic.icon] || Bot;

  const { listening, toggle: toggleVoice } = useVoice((t) => {
    setInput(prev => prev ? prev + ' ' + t : t);
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p && p.length > 0) { setMessages(p); return; }
      } catch {}
    }
    loadIntro();
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function loadIntro() {
    setLoading(true);
    const systemPrompt = `You are an expert forex trading AI specializing in "${topic.name}". ${topic.desc}. Introduce yourself and this topic clearly, then invite the user to ask questions. Be educational, accurate, and practical.`;
    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: { aiId: topic.id, messages: [], customSystemPrompt: systemPrompt, topicName: topic.name }
    });
    setMessages([{
      role: 'assistant',
      content: error || !data?.text ? `Hello! I am your **${topic.name}** AI assistant. ${topic.desc}. Ask me anything!` : data.text,
      id: Date.now().toString(),
    }]);
    setLoading(false);
    playChime();
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const userMsg: Message = { role: 'user', content: text, id: Date.now().toString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    const systemPrompt = `You are an expert forex trading AI specializing in "${topic.name}". ${topic.desc}. Give accurate, practical, and detailed answers. At the end of your response, ask if the user understood or has more questions.`;
    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: {
        aiId: topic.id,
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        customSystemPrompt: systemPrompt,
      }
    });
    playChime();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: error || !data?.text ? '⚠️ Connection error. Please try again.' : data.text,
      id: Date.now().toString(),
    }]);
    setLoading(false);
  }

  function clearChat() {
    localStorage.removeItem(storageKey);
    setMessages([]);
    autoSentRef.current = false;
    loadIntro();
  }

  function renderText(text: string) {
    return text.split('\n').map((line, i, arr) => {
      const html = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.88em">$1</code>');
      return <span key={i}><span dangerouslySetInnerHTML={{ __html: html }} />{i < arr.length - 1 && <br />}</span>;
    });
  }

  const chatBg = config.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: chatBg, fontFamily, fontSize }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {config.ai_avatar_url
              ? <img src={config.ai_avatar_url} alt="AI" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <Icon className="w-5 h-5" style={{ color: topic.color, flexShrink: 0 }} />
            }
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-none">{topic.name}</p>
              <p className="text-green-400 text-[10px] flex items-center gap-1 mt-0.5 justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                Smart Market · Online
              </p>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }} title="Clear chat">
          <Trash2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
            <Icon className="w-12 h-12" style={{ color: topic.color }} />
            <p className="text-white text-sm">Loading {topic.name}...</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
                {config.ai_avatar_url
                  ? <img src={config.ai_avatar_url} alt="AI" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                  : <Icon className="w-5 h-5" style={{ color: topic.color }} />
                }
              </span>
            )}
            <div className="max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed"
              style={msg.role === 'user'
                ? { background: config.bubble_own, color: '#fff', borderBottomRightRadius: 4 }
                : { background: config.bubble_other, color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }
              }>
              {renderText(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start items-end gap-2">
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
              <Icon className="w-5 h-5" style={{ color: topic.color }} />
            </span>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: config.bubble_other, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: topic.color, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pt-3 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(18px)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-end gap-2">
          <button onClick={toggleVoice} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press transition-all"
            style={{ background: listening ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.10)', border: listening ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.10)', boxShadow: listening ? '0 0 12px rgba(239,68,68,0.5)' : 'none' }}>
            {listening ? <MicOff className="w-4 h-4 text-white animate-pulse" /> : <Mic className="w-4 h-4 text-white/80" />}
          </button>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={listening ? '🎤 Listening...' : `Ask about ${topic.name}...`} rows={1}
            className="flex-1 rounded-full px-5 py-3 text-white outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', maxHeight: 120, lineHeight: '1.5', fontFamily, fontSize }}
            onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} />
          <button onClick={send} disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press disabled:opacity-40 transition-all"
            style={{ background: input.trim() && !loading ? `linear-gradient(135deg, ${config.bubble_own}, ${config.bubble_own}cc)` : 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SmartMarket() {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState<typeof SMART_MARKET_TOPICS[0] | null>(null);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [config, setConfig] = useState<AVAXConfig>(DEFAULT_CONFIG);
  const [mergedTopics, setMergedTopics] = useState(SMART_MARKET_TOPICS);

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  useEffect(() => {
    supabase.from('site_settings').select('avax_ai_config').eq('id', 'main').single()
      .then(({ data }) => {
        if (data?.avax_ai_config && typeof data.avax_ai_config === 'object') {
          setConfig({ ...DEFAULT_CONFIG, ...data.avax_ai_config });
          // Load admin-customized topics from DB
          const dbTopics: any[] = data.avax_ai_config.smart_market_topics || [];
          if (dbTopics.length > 0) {
            // Build merged list: DB topics override defaults by id, respect enable/disable and order
            const dbById: Record<string, any> = {};
            dbTopics.forEach(t => { dbById[t.id] = t; });
            // Start with DB order
            const merged = dbTopics
              .filter(t => t.enabled !== false)
              .map(dbTopic => {
                // Find matching default for full data
                const def = SMART_MARKET_TOPICS.find(d => d.id === dbTopic.id);
                return def
                  ? { ...def, name: dbTopic.name || def.name, desc: dbTopic.desc || def.desc, color: dbTopic.color || def.color }
                  : { ...dbTopic, icon: dbTopic.icon || 'Bot', category: dbTopic.category || 'Custom' };
              });
            // Also add defaults that aren't in DB topics (new built-in topics)
            SMART_MARKET_TOPICS.forEach(def => {
              if (!dbById[def.id]) merged.push(def);
            });
            setMergedTopics(merged);
          }
        }
      });
  }, []);

  const allCategories = ['All', ...Array.from(new Set(mergedTopics.map(t => t.category)))];

  const filtered = mergedTopics.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  function handleSelect(topic: typeof SMART_MARKET_TOPICS[0]) {
    if (!hasVIP) { setShowVIPSelector(true); return; }
    setSelectedTopic(topic);
  }

  if (selectedTopic) {
    return <TopicChat topic={selectedTopic} config={config} onBack={() => setSelectedTopic(null)} />;
  }

  const chatBg = config.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[290] flex flex-col" style={{ background: chatBg }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-white font-bold text-sm leading-none">Smart Market</p>
              <p className="text-white/50 text-[10px]">AI-Powered Trading Hub</p>
            </div>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Search */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 px-4 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Search className="w-4 h-4 text-white/50 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search topics..." className="flex-1 py-3 bg-transparent text-white text-sm outline-none placeholder-white/40" />
          {search && <button onClick={() => setSearch('')} className="text-white/40 press"><ArrowLeft className="w-4 h-4 rotate-180" /></button>}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide flex-shrink-0">
        {allCategories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all press ${activeCategory === cat ? 'text-white' : 'text-white/50'}`}
            style={{ background: activeCategory === cat ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)', border: `1px solid ${activeCategory === cat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Topics list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/30">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No topics found for "{search}"</p>
          </div>
        )}
        {filtered.map(topic => {
          const Icon = ICON_MAP[topic.icon] || Bot;
          return (
            <button key={topic.id} onClick={() => handleSelect(topic)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press transition-all text-left relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${topic.color}18 0%, ${topic.color}08 100%)`, border: `1px solid ${topic.color}30` }}>
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                {config.ai_avatar_url
                  ? <img src={config.ai_avatar_url} alt="AI" className="w-10 h-10 rounded-full object-cover" />
                  : <Icon className="w-6 h-6" style={{ color: topic.color }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold text-sm">{topic.name}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/60 flex-shrink-0"
                    style={{ background: `${topic.color}25`, border: `1px solid ${topic.color}40` }}>
                    {topic.category}
                  </span>
                </div>
                <p className="text-white/45 text-xs leading-tight truncate">{topic.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
