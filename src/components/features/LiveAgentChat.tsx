import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, ExternalLink, Shield, Bot, Copy, Check, RefreshCw, Wifi, WifiOff, Sparkles, Mic, MicOff } from 'lucide-react';

// ── Voice Input Hook ──────────────────────────────────────────────
function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported. Please use Chrome.'); return; }
    const r = new SR();
    recognitionRef.current = r;
    r.lang = 'sw-KE'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { onTranscript(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = (e: any) => {
      if (e.error === 'language-not-supported' || e.error === 'no-speech') {
        const r2 = new SR(); r2.lang = 'en-US'; r2.continuous = false; r2.interimResults = false;
        r2.onresult = (ev: any) => { onTranscript(ev.results[0][0].transcript); setIsListening(false); };
        r2.onerror = () => setIsListening(false); r2.onend = () => setIsListening(false);
        r2.start(); recognitionRef.current = r2; return;
      }
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    r.start(); setIsListening(true);
  }
  function stopListening() { recognitionRef.current?.stop(); setIsListening(false); }
  function toggleVoice() { if (isListening) stopListening(); else startListening(); }
  return { isListening, toggleVoice };
}
import VIPBadge from '@/components/features/VIPBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  time: string;
  error?: boolean;
}

const FONT_SIZES: Record<string, string> = {
  xs2: '10px', xs: '11px', sm: '13px', md: '14px',
  lg: '16px', xl: '18px', '2xl': '20px', '3xl': '24px',
};
const FONT_MAP: Record<string, string> = {
  inter: '"Inter", sans-serif', roboto: '"Roboto", sans-serif',
  poppins: '"Poppins", sans-serif', nunito: '"Nunito", sans-serif',
  ubuntu: '"Ubuntu", sans-serif', oswald: '"Oswald", sans-serif',
  mono: '"Courier New", monospace', serif: '"Georgia", serif',
  playfair: '"Playfair Display", serif', cursive: 'cursive',
  italic: 'italic "Inter", sans-serif', fantasy: 'fantasy',
  thin: '100 "Inter", sans-serif', default: 'inherit',
};

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Message Bubble ──
function MessageBubble({
  msg, isEffectiveAdmin, avatarUrl, agentLogoUrl, bubbleOwn, bubbleOther,
  fontSize, fontFamily, onRetry,
}: {
  msg: Message;
  isEffectiveAdmin: boolean;
  avatarUrl: string;
  agentLogoUrl: string;
  bubbleOwn: string;
  bubbleOther: string;
  fontSize: string;
  fontFamily: string;
  onRetry?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try { await navigator.clipboard.writeText(msg.content); }
    catch {
      const el = document.createElement('textarea');
      el.value = msg.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function renderContent(text: string) {
    return text.split(/(https?:\/\/[^\s\n]+)/g).map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="underline text-blue-300 inline-flex items-center gap-0.5 break-all">
            {part.length > 40 ? part.slice(0, 40) + '...' : part}
            <ExternalLink className="w-3 h-3 inline flex-shrink-0 ml-0.5" />
          </a>
        );
      }
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  }

  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2 group`}>
      {/* Agent avatar */}
      {!isUser && (
        <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 self-end mb-1 ${isEffectiveAdmin ? 'bg-primary/20' : 'gradient-pink'}`}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : agentLogoUrl && !isEffectiveAdmin
              ? <img src={agentLogoUrl} alt="" className="w-full h-full object-cover" />
              : isEffectiveAdmin
                ? <Shield className="w-3.5 h-3.5 text-primary" />
                : <Bot className="w-3.5 h-3.5 text-white" />
          }
        </div>
      )}

      <div style={{ maxWidth: '80%' }} className="relative">
        <div
          className={`px-3 py-2 shadow-sm ${msg.error ? 'opacity-80' : ''}`}
          style={{
            background: isUser ? bubbleOwn : (msg.error ? 'rgba(239,68,68,0.2)' : bubbleOther),
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            fontSize, fontFamily,
            border: msg.error ? '1px solid rgba(239,68,68,0.3)' : 'none',
          }}
        >
          <p className="text-white leading-relaxed">{renderContent(msg.content)}</p>
        </div>

        {/* Footer: time + actions */}
        <div className={`flex items-center gap-1 mt-0.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <p className="text-[10px] text-white/35">{msg.time}</p>
          {!isUser && !msg.error && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all press ml-1"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/50" />}
              <span className="text-[9px] text-white/40">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
          {msg.error && onRetry && (
            <button
              onClick={() => onRetry(msg.content)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-all press ml-1"
            >
              <RefreshCw className="w-3 h-3 text-red-300" />
              <span className="text-[9px] text-red-300">Retry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Typing Dots ──
function TypingDots({ bubbleOther }: { bubbleOther: string }) {
  return (
    <div className="flex justify-start gap-2">
      <div className="w-7 h-7 rounded-full gradient-pink flex items-center justify-center flex-shrink-0 self-end mb-1">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl" style={{ background: bubbleOther, borderRadius: '18px 18px 18px 4px' }}>
        <div className="flex gap-1 items-center h-4">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
  adminMode?: boolean;
}

type AdminAuthState = 'none' | 'awaiting_password' | 'verified';

export default function LiveAgentChat({ onClose, adminMode = false }: Props) {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(
    adminMode && isAdmin ? 'verified' : 'none'
  );
  const [agentSettings, setAgentSettings] = useState({
    name: adminMode ? 'Admin AI Assistant' : 'AVAX Support',
    avatar_url: '',
    bg_url: '',
    bg_color: adminMode ? '#080b1a' : '#0d0d1a',
    bubble_own: '#FF1493',
    bubble_other: adminMode ? '#151b3a' : '#1e1e2e',
    font_size: 'md',
    font_family: 'default',
    whatsapp_number: '+255746715235',
    logo_url: '',
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const chatIdRef = useRef(`chat_${Date.now()}`);

  // Voice input
  const { isListening, toggleVoice } = useVoiceInput((transcript) => {
    setInput(prev => prev ? prev + ' ' + transcript : transcript);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
      }
    }, 50);
  });

  // Online/offline detection
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load agent settings
  useEffect(() => {
    if (!adminMode) {
      supabase.from('site_settings')
        .select('agent_name,agent_avatar_url,agent_bg_url,agent_bg_color,agent_bubble_own,agent_bubble_other,agent_font_size,agent_font_family,whatsapp_number,logo_url,agent_bg_gradient_from,agent_bg_gradient_to')
        .eq('id', 'main').single()
        .then(({ data }) => {
          if (data) {
            const d = data as any;
            const gradFrom = d.agent_bg_gradient_from || '#0d0d1a';
            const gradTo = d.agent_bg_gradient_to || '#1a0026';
            const bgColor = d.agent_bg_url
              ? d.agent_bg_color || '#0d0d1a'
              : `linear-gradient(160deg, ${gradFrom} 0%, ${gradTo} 100%)`;
            setAgentSettings({
              name: d.agent_name || 'AVAX Support',
              avatar_url: d.agent_avatar_url || '',
              bg_url: d.agent_bg_url || '',
              bg_color: bgColor,
              bubble_own: d.agent_bubble_own || '#FF1493',
              bubble_other: d.agent_bubble_other || '#1e1e2e',
              font_size: d.agent_font_size || 'md',
              font_family: d.agent_font_family || 'default',
              whatsapp_number: d.whatsapp_number || '+255746715235',
              logo_url: d.logo_url || '',
            });
          }
        });
    }

    // Initial greeting
    const greeting: Message = {
      id: 'init',
      role: 'agent',
      time: formatTime(),
      content: adminMode
        ? isAdmin
          ? `Habari Admin! 👋 Mimi ni **Admin AI Assistant** wako.\n\nNinaweza:\n• 📊 Kuonyesha takwimu za platform\n• ✏️ Kubadilisha mipangilio ya website (WhatsApp, hero text, payment info, n.k.)\n• 📈 Kuripoti hali ya signals na wanachama\n• 💡 Kutoa mapendekezo ya kuboresha\n\nNiambie unachohitaji!`
          : `AI Assistant hii ni kwa Admin tu. Tafadhali wasiliana nasi kwa msaada.`
        : `Karibu! 👋 Mimi ni ${agentSettings.name || 'AVAX Support'}.\n\nNaweza kukusaidia na:\n• 💎 Bei za VIP na jinsi ya kujiunga\n• 💳 Maelekezo ya malipo\n• 📱 Kupakua App\n• 📊 Maswali kuhusu signals\n• 🎓 Kozi zinazopatikana\n\nUna swali gani?`,
    };
    setMessages([greeting]);
    historyRef.current = [{ role: 'assistant', content: greeting.content }];
  }, [adminMode, isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    if (!overrideText) setInput('');

    if (!isOnline) {
      const errMsg: Message = {
        id: Date.now().toString(),
        role: 'agent',
        content: '📶 Hakuna muunganisho wa mtandao. Angalia internet yako na ujaribu tena.',
        time: formatTime(),
        error: true,
      };
      setMessages(prev => [...prev, errMsg]);
      return;
    }

    // Add user message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, time: formatTime() };
    setMessages(prev => [...prev, userMsg]);
    historyRef.current.push({ role: 'user', content: text });

    // ── Password check phase ──
    if (!adminMode && adminAuth === 'awaiting_password') {
      setLoading(true);
      const { data } = await supabase.functions.invoke('live-agent', {
        body: { passwordAttempt: text },
      });
      setLoading(false);

      const isCorrect = data?.passwordCorrect === true;
      if (isCorrect) {
        setAdminAuth('verified');
        const confirmMsg: Message = {
          id: Date.now().toString(),
          role: 'agent',
          content: '✅ Utambulisho wa Admin umekubaliwa!\n\nSasa una mamlaka ya kubadilisha mipangilio ya website. Niambie mabadiliko unayotaka.',
          time: formatTime(),
        };
        setMessages(prev => [...prev, confirmMsg]);
        historyRef.current.push({ role: 'assistant', content: confirmMsg.content });
      } else {
        setAdminAuth('none');
        const failMsg: Message = {
          id: Date.now().toString(),
          role: 'agent',
          content: '❌ Password si sahihi. Tafadhali jaribu tena.',
          time: formatTime(),
          error: true,
        };
        setMessages(prev => [...prev, failMsg]);
        historyRef.current.push({ role: 'assistant', content: failMsg.content });
      }
      return;
    }

    // ── Admin detection (non-admin mode) ──
    if (!adminMode && adminAuth === 'none') {
      const lower = text.toLowerCase();
      if (lower.includes('mimi ni admin') || lower.includes('i am admin') || lower.includes('admin mimi') || lower.includes('niko admin') || lower.includes('admin access')) {
        setAdminAuth('awaiting_password');
        const askMsg: Message = {
          id: Date.now().toString(),
          role: 'agent',
          content: '🔐 Ninahitaji kuthibitisha utambulisho wako.\n\nTafadhali ingiza password ya admin:',
          time: formatTime(),
        };
        setMessages(prev => [...prev, askMsg]);
        historyRef.current.push({ role: 'assistant', content: askMsg.content });
        return;
      }
    }

    // ── Call AI ──
    setLoading(true);
    setTyping(true);
    const isEffective = adminMode || adminAuth === 'verified';

    let responseText = '';
    let dbChanged = false;
    let invokeError: any = null;

    try {
      const { data, error } = await supabase.functions.invoke('live-agent', {
        body: {
          messages: historyRef.current.slice(-20),
          isAdmin: isEffective,
          adminVerified: isEffective,
        },
      });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const raw = await error.context?.text?.().catch(() => '');
          invokeError = raw || error.message;
        } else {
          invokeError = error.message;
        }
      } else if (data?.text) {
        responseText = data.text;
        dbChanged = data.dbChanged || false;
      } else {
        invokeError = data?.error || 'Empty response from AI';
      }
    } catch (e: any) {
      invokeError = e?.message || String(e);
    }

    setTyping(false);
    setLoading(false);

    if (invokeError) {
      console.error('live-agent error:', invokeError);
      const errContent = String(invokeError).toLowerCase().includes('network')
        ? '📶 Tatizo la mtandao. Angalia internet na ujaribu tena.'
        : '⚠️ AI haitapatikana sasa hivi. Tafadhali jaribu tena baada ya sekunde chache.';
      const errMsg: Message = {
        id: Date.now().toString(),
        role: 'agent',
        content: errContent,
        time: formatTime(),
        error: true,
      };
      setMessages(prev => [...prev, errMsg]);
      return;
    }

    const finalText = dbChanged ? responseText + '\n\n✅ *Mabadiliko yamehifadhiwa.*' : responseText;
    const agentMsg: Message = { id: Date.now().toString(), role: 'agent', content: finalText, time: formatTime() };
    setMessages(prev => [...prev, agentMsg]);
    historyRef.current.push({ role: 'assistant', content: responseText });
  }, [input, loading, isOnline, adminMode, adminAuth]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    const greeting: Message = {
      id: Date.now().toString(),
      role: 'agent',
      content: adminMode
        ? 'Mazungumzo yamefutwa. Niko tayari kukusaidia tena! 🤖'
        : `Karibu tena! Niko tayari kukusaidia. Una swali gani? 😊`,
      time: formatTime(),
    };
    setMessages([greeting]);
    historyRef.current = [{ role: 'assistant', content: greeting.content }];
    chatIdRef.current = `chat_${Date.now()}`;
  }

  const fontSize = FONT_SIZES[agentSettings.font_size] || '14px';
  const fontFamily = FONT_MAP[agentSettings.font_family] || 'inherit';
  const bgStyle = agentSettings.bg_url
    ? { backgroundImage: `url(${agentSettings.bg_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: agentSettings.bg_color };

  const isEffectiveAdmin = adminMode || adminAuth === 'verified';
  const agentName = adminMode ? 'Admin AI' : agentSettings.name;

  return (
    <div className="fixed inset-0 z-[600] flex flex-col animate-fade-in" style={{ ...bgStyle, fontFamily }}>

      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '10px' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0"
          style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Center identity pill */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${isEffectiveAdmin ? 'bg-primary/30' : 'gradient-pink'}`}>
              {agentSettings.avatar_url
                ? <img src={agentSettings.avatar_url} alt="" className="w-full h-full object-cover" />
                : agentSettings.logo_url && !isEffectiveAdmin
                  ? <img src={agentSettings.logo_url} alt="" className="w-full h-full object-cover" />
                  : isEffectiveAdmin
                    ? <Shield className="w-3.5 h-3.5 text-primary" />
                    : <Sparkles className="w-3.5 h-3.5 text-white" />
              }
            </div>
            <span className="font-black text-white text-sm tracking-tight whitespace-nowrap">{agentName}</span>
            {/* Verified badge */}
            <VIPBadge size="xs" badgeStyle="blue_burst" />
            {/* Connection status dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} title={isOnline ? 'Online' : 'Offline'} />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* No refresh/clear button - keep header clean */}

          {/* WhatsApp (support mode only) */}
          {!adminMode && (
            <a
              href={`https://wa.me/${agentSettings.whatsapp_number.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0"
              style={{ background: '#25D366', boxShadow: '0 2px 12px rgba(37,211,102,0.4)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.112 1.534 5.836L.057 23.786l6.063-1.59A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.851 0-3.594-.473-5.115-1.306l-.366-.217-3.598.945.962-3.513-.24-.372A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* ── OFFLINE BANNER ── */}
      {!isOnline && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 mx-3 mb-1 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-xs">Hakuna mtandao — AI haitajibu hadi muunganisho urudi</span>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isEffectiveAdmin={isEffectiveAdmin}
            avatarUrl={agentSettings.avatar_url}
            agentLogoUrl={agentSettings.logo_url}
            bubbleOwn={agentSettings.bubble_own}
            bubbleOther={agentSettings.bubble_other}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onRetry={msg.error ? undefined : undefined}
          />
        ))}
        {typing && <TypingDots bubbleOther={agentSettings.bubble_other} />}
        <div ref={bottomRef} />
      </div>

      {/* ── QUICK REPLIES (support mode, first message only) ── */}
      {!adminMode && messages.length <= 1 && (
        <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
          {['Bei za VIP', 'Jinsi ya kulipa', 'Pakua App'].map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="px-3 py-1.5 rounded-full text-xs text-white/70 press transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── INPUT ── */}
      <div
        className="flex-shrink-0 flex gap-2 items-end px-3"
        style={{ paddingTop: '8px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
      >
        {/* Mic voice button */}
        <button
          onClick={toggleVoice}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 press transition-all"
          style={{
            background: isListening ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.08)',
            border: isListening ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.12)',
            boxShadow: isListening ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
          }}
          title={isListening ? 'Stop recording' : 'Voice input'}
        >
          {isListening
            ? <MicOff className="w-4 h-4 text-white animate-pulse" />
            : <Mic className="w-4 h-4 text-white/70" />
          }
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            isListening
              ? '🎙️ Listening...'
              : adminAuth === 'awaiting_password'
                ? '🔐 Ingiza password ya admin...'
                : isEffectiveAdmin
                  ? '✏️ Ambia AI mabadiliko...'
                  : '💬 Andika ujumbe wako...'
          }
          rows={1}
          className="flex-1 rounded-2xl px-4 py-2.5 text-white placeholder-white/35 outline-none resize-none text-sm"
          style={{
            maxHeight: 120,
            fontFamily, fontSize,
            background: 'rgba(26,26,26,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
          onInput={e => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading || !isOnline}
          className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center flex-shrink-0 press disabled:opacity-35 pink-glow-xs transition-all"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send className="w-4 h-4 text-white" />
          }
        </button>
      </div>
    </div>
  );
}
