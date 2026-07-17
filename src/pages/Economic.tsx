import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Loader2, Send, Mic, MicOff, Trash2, Bot,
  Globe, TrendingUp, AlertTriangle, RefreshCw, Clock, Newspaper
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isVIPActive } from '@/lib/supabase';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';

const ECONOMIC_TOPICS = [
  { id: 'economic_calendar', name: 'Economic Calendar', desc: 'Upcoming high-impact economic events this week', icon: 'Calendar', color: '#2196F3' },
  { id: 'high_impact_events', name: 'High Impact Events', desc: 'NFP, CPI, FOMC & other market-moving events', icon: 'AlertTriangle', color: '#FF5722' },
  { id: 'news_analysis', name: 'News Analysis', desc: 'Breaking news impact on forex & commodities', icon: 'Newspaper', color: '#607D8B' },
  { id: 'central_bank', name: 'Central Bank Updates', desc: 'Fed, ECB, BOE, BOJ policy & statements', icon: 'Globe', color: '#9C27B0' },
  { id: 'ai_news_summary', name: 'AI News Summaries', desc: 'AI-curated daily market news summary', icon: 'Bot', color: '#FF1493' },
  { id: 'cpi_inflation', name: 'CPI & Inflation', desc: 'Consumer Price Index & inflation data analysis', icon: 'TrendingUp', color: '#E91E63' },
  { id: 'nfp_employment', name: 'NFP & Employment', desc: 'Non-Farm Payrolls & employment data', icon: 'RefreshCw', color: '#4CAF50' },
  { id: 'gdp_growth', name: 'GDP & Economic Growth', desc: 'GDP reports and economic growth analysis', icon: 'TrendingUp', color: '#00BCD4' },
  { id: 'market_sentiment', name: 'Market Sentiment', desc: 'Current risk-on / risk-off market sentiment', icon: 'Globe', color: '#FF9800' },
  { id: 'weekly_forecast', name: 'Weekly Forecast', desc: "AI's weekly outlook for major currency pairs", icon: 'Calendar', color: '#3F51B5' },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Calendar, AlertTriangle, Newspaper, Globe, Bot, TrendingUp, RefreshCw, Clock,
};

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
  default: 'inherit', inter: "'Inter', sans-serif", poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif", mono: "'Courier New', monospace",
};

let _audioCtx: AudioContext | null = null;
function playChime() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = _audioCtx;
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
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start(); setListening(true);
  }
  return { listening, toggle };
}

interface Message { role: 'user' | 'assistant'; content: string; id: string; }

function EconomicChat({ topic, config, onBack }: { topic: typeof ECONOMIC_TOPICS[0]; config: AVAXConfig; onBack: () => void }) {
  const storageKey = `economic_chat_${topic.id}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontSize = FONT_SIZE_MAP[config.font_size] || '15px';
  const fontFamily = FONT_FAMILY_MAP[config.font_family] || 'inherit';
  const Icon = ICON_MAP[topic.icon] || Bot;

  const { listening, toggle: toggleVoice } = useVoice((t) => setInput(prev => prev ? prev + ' ' + t : t));

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { try { const p = JSON.parse(saved); if (p?.length > 0) { setMessages(p); return; } } catch {} }
    loadIntro();
  }, []);

  useEffect(() => { if (messages.length > 0) localStorage.setItem(storageKey, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function loadIntro() {
    setLoading(true);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const systemPrompt = `You are an expert forex economic analyst specializing in "${topic.name}". Today is ${today}. ${topic.desc}. Provide current, accurate, and actionable information. Start with a comprehensive overview of ${topic.name} right now, including any relevant current events, data, or analysis. Be specific and helpful. End by asking the user if they have specific questions.`;

    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: { aiId: `economic_${topic.id}`, messages: [], customSystemPrompt: systemPrompt }
    });
    setMessages([{
      role: 'assistant',
      content: error || !data?.text ? `Hello! I am your **${topic.name}** analyst. I provide real-time economic analysis and insights. What would you like to know?` : data.text,
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
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const systemPrompt = `You are an expert forex economic analyst specializing in "${topic.name}". Today is ${today}. ${topic.desc}. Provide current, accurate, and actionable analysis. Always answer in detail, using actual knowledge of economic data and events.`;
    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: { aiId: `economic_${topic.id}`, messages: updated.map(m => ({ role: m.role, content: m.content })), customSystemPrompt: systemPrompt }
    });
    playChime();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: error || !data?.text ? '⚠️ Connection error. Please try again.' : data.text,
      id: Date.now().toString(),
    }]);
    setLoading(false);
  }

  function clearChat() { localStorage.removeItem(storageKey); setMessages([]); loadIntro(); }

  function renderText(text: string) {
    return text.split('\n').map((line, i, arr) => {
      const html = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;font-size:0.88em">$1</code>');
      return <span key={i}><span dangerouslySetInnerHTML={{ __html: html }} />{i < arr.length - 1 && <br />}</span>;
    });
  }

  const chatBg = config.chat_bg_url ? `url(${config.chat_bg_url}) center/cover` : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: chatBg, fontFamily, fontSize }}>
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {config.ai_avatar_url ? <img src={config.ai_avatar_url} alt="AI" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <Icon className="w-5 h-5 flex-shrink-0" style={{ color: topic.color }} />}
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-none">{topic.name}</p>
              <p className="text-green-400 text-[10px] flex items-center gap-1 mt-0.5 justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />Economic AI · Online
              </p>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}>
          <Trash2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
                {config.ai_avatar_url ? <img src={config.ai_avatar_url} alt="AI" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                  : <Icon className="w-5 h-5" style={{ color: topic.color }} />}
              </span>
            )}
            <div className="max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed"
              style={msg.role === 'user'
                ? { background: config.bubble_own, color: '#fff', borderBottomRightRadius: 4 }
                : { background: config.bubble_other, color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }}>
              {renderText(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start items-end gap-2">
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
              <Icon className="w-5 h-5" style={{ color: topic.color }} />
            </span>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: config.bubble_other, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: topic.color, animationDelay: `${i * 0.15}s` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pt-3 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(18px)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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

export default function Economic() {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<typeof ECONOMIC_TOPICS[0] | null>(null);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [config, setConfig] = useState<AVAXConfig>(DEFAULT_CONFIG);
  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  useEffect(() => {
    supabase.from('site_settings').select('avax_ai_config').eq('id', 'main').single()
      .then(({ data }) => { if (data?.avax_ai_config) setConfig({ ...DEFAULT_CONFIG, ...data.avax_ai_config }); });
  }, []);

  function handleSelect(topic: typeof ECONOMIC_TOPICS[0]) {
    if (!hasVIP) { setShowVIPSelector(true); return; }
    setSelectedTopic(topic);
  }

  if (selectedTopic) return <EconomicChat topic={selectedTopic} config={config} onBack={() => setSelectedTopic(null)} />;

  const chatBg = config.chat_bg_url ? `url(${config.chat_bg_url}) center/cover` : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[290] flex flex-col" style={{ background: chatBg }}>
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <Globe className="w-4 h-4 text-purple-400" />
            <div><p className="text-white font-bold text-sm leading-none">Economic Center</p><p className="text-white/50 text-[10px]">AI-Powered Economic Analysis</p></div>
          </div>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-white/40 text-[11px] uppercase font-bold tracking-widest mb-3 mt-2">Select Topic</p>
        <div className="space-y-2">
          {ECONOMIC_TOPICS.map(topic => {
            const Icon = ICON_MAP[topic.icon] || Bot;
            return (
              <button key={topic.id} onClick={() => handleSelect(topic)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press transition-all text-left"
                style={{ background: `linear-gradient(135deg, ${topic.color}18 0%, ${topic.color}08 100%)`, border: `1px solid ${topic.color}30` }}>
                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                  {config.ai_avatar_url ? <img src={config.ai_avatar_url} alt="AI" className="w-11 h-11 rounded-full object-cover" />
                    : <Icon className="w-6 h-6" style={{ color: topic.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{topic.name}</p>
                  <p className="text-white/45 text-xs leading-tight truncate">{topic.desc}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-white/25 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
