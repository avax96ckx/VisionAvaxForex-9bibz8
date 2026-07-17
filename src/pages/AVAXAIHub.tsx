import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Bot, TrendingUp, Shield, Brain, Zap, Target,
  Bell, Newspaper, Trophy, Layers, Star, BookOpen, CandlestickChart,
  Loader2, Crown, ChevronRight, Sparkles, BarChart2, Activity,
  DollarSign, Globe, Lightbulb, Compass, PieChart, Percent, AlertTriangle,
  Eye, Search, Calculator, Trash2, Mic, MicOff, GraduationCap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isVIPActive } from '@/lib/supabase';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';

// Icon map for dynamic rendering
const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Target, Shield, Brain, Zap, Layers, Bell,
  Newspaper, Trophy, Sparkles, Star, BookOpen, CandlestickChart,
  BarChart2, Activity, DollarSign, Globe, Lightbulb, Compass,
  PieChart, Percent, AlertTriangle, Eye, Search, Calculator, Bot,
  GraduationCap,
};

// ── Built-in AI definitions ────────────────────────────────────────────────────
const BUILTIN_AI_TOOLS = [
  { id: 'courses_mentor',     name: 'Courses AI Mentor',    icon: 'GraduationCap',    color: '#FF1493', desc: 'AI-powered trading courses & certification' },
  { id: 'market_analysis',    name: 'Market Analysis',      icon: 'TrendingUp',       color: '#2196F3', desc: 'Live market conditions & structure' },
  { id: 'trade_suggestions',  name: 'Trade Suggestions',    icon: 'Target',           color: '#4CAF50', desc: 'High-probability setups & entries' },
  { id: 'risk_management',    name: 'Risk Management',      icon: 'Shield',           color: '#FF9800', desc: 'Position sizing & capital protection' },
  { id: 'psychology',         name: 'Trading Psychology',   icon: 'Brain',            color: '#9C27B0', desc: 'Master emotions & discipline' },
  { id: 'trend_detection',    name: 'Trend Detection',      icon: 'Zap',              color: '#00BCD4', desc: 'Identify trends early & accurately' },
  { id: 'support_resistance', name: 'Support & Resistance', icon: 'Layers',           color: '#FF5722', desc: 'Key price levels & order blocks' },
  { id: 'smart_alerts',       name: 'Smart Alerts',         icon: 'Bell',             color: '#E91E63', desc: 'Intelligent alert strategies' },
  { id: 'news_interpretation',name: 'News Interpretation',  icon: 'Newspaper',        color: '#607D8B', desc: 'Economic events & fundamental impact' },
  { id: 'trader_coach',       name: 'Trader Coach',         icon: 'Trophy',           color: '#FFC107', desc: 'Personalized coaching & growth path' },
  { id: 'strategy_ai',        name: 'Strategy Builder',     icon: 'Sparkles',         color: '#3F51B5', desc: 'Build complete trading strategies' },
  { id: 'trading_mentor',     name: 'Trading Mentor',       icon: 'Star',             color: '#FF1493', desc: 'Senior mentor — holistic wisdom' },
  { id: 'price_action',       name: 'Price Action',         icon: 'CandlestickChart', color: '#795548', desc: 'Read markets through pure price' },
  { id: 'forex_basics',       name: 'Forex Basics',         icon: 'BookOpen',         color: '#009688', desc: 'Learn fundamentals from scratch' },
];

interface AITool {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: string;
  systemPrompt?: string;
  intro?: string;
}

interface AVAXConfig {
  hub_name: string;
  hub_subtitle: string;
  card_style: 'grid' | 'list';
  chat_bg_url: string;
  chat_bg_gradient_from: string;
  chat_bg_gradient_to: string;
  bubble_own: string;
  bubble_other: string;
  font_size: string;
  font_family: string;
  ai_avatar_url: string;
  tools: AITool[];
}

const DEFAULT_CONFIG: AVAXConfig = {
  hub_name: 'AVAX AI',
  hub_subtitle: 'Advanced Trading Intelligence',
  card_style: 'grid',
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

const FONT_SIZE_MAP: Record<string, string> = { sm: '13px', md: '15px', lg: '17px' };
const FONT_FAMILY_MAP: Record<string, string> = {
  default: 'inherit',
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  mono: "'Courier New', monospace",
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

// ── AI Avatar — pure icon/image, ZERO wrapper card ───────────────────────────
function AIAvatar({ avatarUrl, iconName, color, size = 'md' }: {
  avatarUrl?: string; iconName: string; color: string; size?: 'sm' | 'md';
}) {
  const Icon = ICON_MAP[iconName] || Bot;
  const px = size === 'sm' ? 26 : 34;
  const iconCls = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="AI"
        style={{ width: px, height: px, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }
  // Truly bare — no div/span wrapper, just the SVG icon
  return <Icon className={iconCls} style={{ color, flexShrink: 0 }} />;
}

// ── Shared AudioContext ───────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _audioCtx;
}
// ── Tick Sound — subtle typing indicator ─────────────────────────────────────
let tickInterval: ReturnType<typeof setInterval> | null = null;
function startTickSound() {
  if (tickInterval) return;
  const ctx = getAudioCtx();
  let count = 0;
  tickInterval = setInterval(() => {
    count++;
    if (count > 30) { stopTickSound(); return; }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 800 + Math.random() * 200;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }, 280);
}
function stopTickSound() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}
// ── Chime — 3-note ascending tone when AI finishes responding ─────────────────
function playChimeSound() {
  try {
    const ctx = getAudioCtx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.10, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.start(t); osc.stop(t + 0.39);
    });
  } catch {}
}

// ── Voice Input Hook ───────────────────────────────────────────────────────────
function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Try Swahili first, fall back to English
    recognition.lang = 'sw-KE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
      // If Swahili not supported, retry with English
      if (event.error === 'language-not-supported' || event.error === 'no-speech') {
        const rec2 = new SpeechRecognition();
        rec2.lang = 'en-US';
        rec2.continuous = false;
        rec2.interimResults = false;
        rec2.onresult = (e: any) => {
          const t = e.results[0][0].transcript;
          onTranscript(t);
          setIsListening(false);
        };
        rec2.onerror = () => setIsListening(false);
        rec2.onend = () => setIsListening(false);
        rec2.start();
        recognitionRef.current = rec2;
        return;
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function toggleVoice() {
    if (isListening) stopListening();
    else startListening();
  }

  return { isListening, toggleVoice };
}

// ── Chat View ─────────────────────────────────────────────────────────────────
function AVAXAIChat({
  aiId,
  aiName,
  aiColor,
  iconName,
  config,
  pendingUserMessage,
  onBack,
}: {
  aiId: string;
  aiName: string;
  aiColor: string;
  iconName: string;
  config: AVAXConfig;
  pendingUserMessage?: string;
  onBack: () => void;
}) {
  const storageKey = `avax_ai_chat_${aiId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontSize = FONT_SIZE_MAP[config.font_size] || '15px';
  const fontFamily = FONT_FAMILY_MAP[config.font_family] || 'inherit';

  const { isListening, toggleVoice } = useVoiceInput((transcript) => {
    setInput(prev => prev ? prev + ' ' + transcript : transcript);
    // Auto-resize textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    }, 50);
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch {}
    }
    if (!pendingUserMessage) loadIntro();
  }, []);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-send pending message from hub input
  useEffect(() => {
    if (!pendingUserMessage || autoSentRef.current) return;
    autoSentRef.current = true;

    const userMsg: Message = { role: 'user', content: pendingUserMessage, id: Date.now().toString() };
    setMessages([userMsg]);
    setLoading(true);
    startTickSound();

    supabase.functions.invoke('avax-ai', {
      body: { aiId, messages: [{ role: 'user', content: pendingUserMessage }] }
    }).then(({ data, error }) => {
      stopTickSound();
      playChimeSound();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error || !data?.text ? '⚠️ Connection error. Please try again.' : data.text,
        id: (Date.now() + 1).toString(),
      }]);
      setLoading(false);
    });
  }, [pendingUserMessage]);

  async function loadIntro() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('avax-ai', { body: { aiId, messages: [] } });
    setMessages([{
      role: 'assistant',
      content: error || !data?.text ? `Hello! I am ${aiName}. How can I help you today?` : data.text,
      id: Date.now().toString(),
    }]);
    setLoading(false);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: Message = { role: 'user', content: text, id: Date.now().toString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    startTickSound();

    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: { aiId, messages: updated.map(m => ({ role: m.role, content: m.content })) }
    });

    stopTickSound();
    playChimeSound();
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function renderText(text: string) {
    return text.split('\n').map((line, i, arr) => {
      const html = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.88em">$1</code>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: html }} />
          {i < arr.length - 1 && <br />}
        </span>
      );
    });
  }

  const chatBg = config.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: chatBg, fontFamily, fontSize }}>
      {/* Header — VIP room style */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: '10px',
        }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <AIAvatar avatarUrl={config.ai_avatar_url} iconName={iconName} color={aiColor} size="sm" />
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-none">{aiName}</p>
              <p className="text-green-400 text-[10px] flex items-center gap-1 mt-0.5 justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                AVAX AI · Online
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
            <AIAvatar avatarUrl={config.ai_avatar_url} iconName={iconName} color={aiColor} size="md" />
            <p className="text-white text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {/* AI — truly bare, no background wrapper */}
            {msg.role === 'assistant' && (
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
                <AIAvatar avatarUrl={config.ai_avatar_url} iconName={iconName} color={aiColor} size="sm" />
              </span>
            )}
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed"
              style={msg.role === 'user'
                ? { background: config.bubble_own, color: '#fff', borderBottomRightRadius: 4 }
                : { background: config.bubble_other, color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }
              }
            >
              {renderText(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-end gap-2">
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'none' }}>
              <AIAvatar avatarUrl={config.ai_avatar_url} iconName={iconName} color={aiColor} size="sm" />
            </span>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: config.bubble_other, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: aiColor, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="px-4 pt-3 flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-end gap-2">
          {/* Voice button */}
          <button
            onClick={toggleVoice}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press transition-all"
            style={{
              background: isListening
                ? 'rgba(239,68,68,0.85)'
                : 'rgba(255,255,255,0.10)',
              border: isListening ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.10)',
              boxShadow: isListening ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
            }}
            title={isListening ? 'Stop recording' : 'Voice input'}
          >
            {isListening
              ? <MicOff className="w-4 h-4 text-white animate-pulse" />
              : <Mic className="w-4 h-4 text-white/80" />
            }
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎤 Listening...' : `Ask ${aiName}...`}
            rows={1}
            className="flex-1 rounded-full px-5 py-3 text-white outline-none resize-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              maxHeight: 120,
              lineHeight: '1.5',
              fontFamily,
              fontSize,
            }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press disabled:opacity-40 transition-all"
            style={{
              background: input.trim() && !loading
                ? `linear-gradient(135deg, ${config.bubble_own}, ${config.bubble_own}cc)`
                : 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Hub ──────────────────────────────────────────────────────────────────
export default function AVAXAIHub() {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [selectedAI, setSelectedAI] = useState<AITool | null>(null);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [config, setConfig] = useState<AVAXConfig>(DEFAULT_CONFIG);
  const [aiTools, setAiTools] = useState(BUILTIN_AI_TOOLS);

  const [generalInput, setGeneralInput] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | undefined>(undefined);

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  // Voice for hub general input
  const generalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { isListening: isHubListening, toggleVoice: toggleHubVoice } = useVoiceInput((transcript) => {
    setGeneralInput(prev => prev ? prev + ' ' + transcript : transcript);
    setTimeout(() => {
      if (generalTextareaRef.current) {
        generalTextareaRef.current.style.height = 'auto';
        generalTextareaRef.current.style.height = Math.min(generalTextareaRef.current.scrollHeight, 100) + 'px';
      }
    }, 50);
  });

  useEffect(() => {
    supabase.from('site_settings').select('avax_ai_config').eq('id', 'main').single()
      .then(({ data }) => {
        if (data?.avax_ai_config && typeof data.avax_ai_config === 'object') {
          const cfg: AVAXConfig = { ...DEFAULT_CONFIG, ...data.avax_ai_config };
          setConfig(cfg);
          if (cfg.tools && cfg.tools.length > 0) {
            const builtinIds = new Set(BUILTIN_AI_TOOLS.map(t => t.id));
            const customOnly = cfg.tools.filter(t => !builtinIds.has(t.id));
            setAiTools([...customOnly, ...BUILTIN_AI_TOOLS]);
          }
        }
      });
  }, []);

  function handleSelectAI(ai: AITool) {
    if (!hasVIP) { setShowVIPSelector(true); return; }
    // Courses AI Mentor opens dedicated page
    if (ai.id === 'courses_mentor') {
      navigate('/courses-ai');
      return;
    }
    setPendingUserMessage(undefined);
    setSelectedAI(ai);
  }

  function handleGeneralSend() {
    const text = generalInput.trim();
    if (!text) return;
    if (!hasVIP) { setShowVIPSelector(true); return; }
    setGeneralInput('');
    setPendingUserMessage(text);
    setSelectedAI({ id: 'trading_mentor', name: config.hub_name, desc: 'General AI Assistant', color: '#FF1493', icon: 'Bot' });
  }

  function handleGeneralKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGeneralSend(); }
  }

  if (selectedAI) {
    return (
      <AVAXAIChat
        aiId={selectedAI.id}
        aiName={selectedAI.name}
        aiColor={selectedAI.color}
        iconName={selectedAI.icon}
        config={config}
        pendingUserMessage={pendingUserMessage}
        onBack={() => { setSelectedAI(null); setPendingUserMessage(undefined); }}
      />
    );
  }

  const chatBg = config.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config.chat_bg_gradient_from} 0%, ${config.chat_bg_gradient_to} 100%)`;

  return (
    <div className="fixed inset-0 z-[290] flex flex-col overflow-hidden" style={{ background: chatBg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}
      >
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)' }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            {config.ai_avatar_url ? (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <img src={config.ai_avatar_url} alt="AI" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)' }}>
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm leading-none">{config.hub_name}</p>
              <p className="text-white/50 text-[10px]">{config.hub_subtitle}</p>
            </div>
          </div>
        </div>

        {!hasVIP ? (
          <button
            onClick={() => setShowVIPSelector(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press"
            style={{ background: 'rgba(255,20,147,0.20)', border: '1px solid rgba(255,20,147,0.4)' }}
          >
            <Crown className="w-4 h-4 text-pink-400" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      {/* AI tools grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
        <p className="text-white/40 text-[11px] uppercase font-bold tracking-widest mb-3">Select an AI Tool</p>

        {config.card_style === 'list' ? (
          <div className="space-y-2">
            {aiTools.map(ai => {
              const Icon = ICON_MAP[ai.icon] || Bot;
              return (
                <button
                  key={ai.id}
                  onClick={() => handleSelectAI(ai)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press transition-all text-left relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${ai.color}18 0%, ${ai.color}08 100%)`, border: `1px solid ${ai.color}30` }}
                >
                  {config.ai_avatar_url ? (
                    <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                      <img src={config.ai_avatar_url} alt="AI" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6" style={{ color: ai.color }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{ai.name}</p>
                    <p className="text-white/45 text-xs leading-tight truncate">{ai.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                  {!hasVIP && <Crown className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {aiTools.map(ai => {
              const Icon = ICON_MAP[ai.icon] || Bot;
              return (
                <button
                  key={ai.id}
                  onClick={() => handleSelectAI(ai)}
                  className="relative text-left rounded-2xl p-4 press transition-all group overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${ai.color}18 0%, ${ai.color}08 100%)`, border: `1px solid ${ai.color}30` }}
                >
                  <div className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity rounded-2xl" style={{ background: `radial-gradient(circle at center, ${ai.color}25 0%, transparent 70%)` }} />
                  {/* Icon — no card background */}
                  {config.ai_avatar_url ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden mb-3">
                      <img src={config.ai_avatar_url} alt="AI" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center mb-3">
                      <Icon className="w-7 h-7" style={{ color: ai.color }} />
                    </div>
                  )}
                  <p className="text-white font-bold text-xs leading-tight mb-1">{ai.name}</p>
                  <p className="text-white/45 text-[10px] leading-tight line-clamp-2">{ai.desc}</p>
                  <div className="absolute top-3 right-3">
                    <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                  </div>
                  {!hasVIP && (
                    <div className="absolute bottom-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,20,147,0.2)', border: '1px solid rgba(255,20,147,0.4)' }}>
                      <Crown className="w-2.5 h-2.5 text-pink-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!hasVIP && (
          <button
            onClick={() => setShowVIPSelector(true)}
            className="w-full mt-4 py-4 rounded-2xl flex items-center justify-center gap-2 press"
            style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)', boxShadow: '0 0 24px rgba(255,20,147,0.35)' }}
          >
            <Crown className="w-5 h-5 text-white" />
            <span className="text-white font-black text-sm">Upgrade to VIP to Unlock {config.hub_name}</span>
          </button>
        )}

        <div className="h-4" />
      </div>

      {/* General chat input at bottom */}
      <div
        className="px-4 pt-3 flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-end gap-2">
          {/* Voice button */}
          <button
            onClick={toggleHubVoice}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press transition-all"
            style={{
              background: isHubListening ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.10)',
              border: isHubListening ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.10)',
              boxShadow: isHubListening ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
            }}
          >
            {isHubListening
              ? <MicOff className="w-4 h-4 text-white animate-pulse" />
              : <Mic className="w-4 h-4 text-white/80" />
            }
          </button>

          <textarea
            ref={generalTextareaRef}
            value={generalInput}
            onChange={e => setGeneralInput(e.target.value)}
            onKeyDown={handleGeneralKeyDown}
            placeholder={isHubListening ? '🎤 Listening...' : `Ask ${config.hub_name} anything about forex...`}
            rows={1}
            className="flex-1 rounded-full px-5 py-3 text-white text-sm outline-none resize-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              maxHeight: 100,
              lineHeight: '1.5',
            }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={handleGeneralSend}
            disabled={!generalInput.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press disabled:opacity-40 transition-all"
            style={{
              background: generalInput.trim() ? 'linear-gradient(135deg, #FF1493, #FF69B4)' : 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
