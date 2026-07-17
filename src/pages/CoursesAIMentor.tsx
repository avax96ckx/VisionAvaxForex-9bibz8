import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Brain, Check, ChevronRight, Send, Loader2,
  Mic, MicOff, Trash2, Award, Trophy, Lock, Crown,
  GraduationCap, Share2, CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isVIPActive } from '@/lib/supabase';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import { toast } from 'sonner';

// ── Course definitions ────────────────────────────────────────
const COURSES = [
  {
    id: 'beginners',
    name: '🌱 Beginners Course',
    desc: 'Foundation of forex trading from zero',
    color: '#4CAF50',
    lessons: [
      'Welcome', 'Pre Requisite', 'Roadmap', 'Introduction to Financial Markets',
      'Introduction to Forex Trading', 'Important Terminologies', 'Introduction to Trading Platforms',
      'How to Use MetaTrader 4 & 5', 'Forex Brokers', 'Currency Pair',
      'Trade Duration and Assets Selection', 'Market Sessions', 'Types of Orders',
      'Types of Accounts', 'Types of Traders', 'Technical Analysis vs Price Action',
      'Trading Strategy', 'Market Trends', 'Candlestick Formation', 'Buying & Selling Pressure',
      'Watchlist Preparation', 'Trading Capital', 'Prop Firm vs Personal Capital',
      'Introduction Technical Pitfalls', 'Fibonacci Retracement', 'Smart Money Concept (SMC)',
      'Risk Management', 'Risk to Reward Ratio', 'Trading Frequency', 'Probability',
      'Winning Rate', 'Probability vs Winning Rate', 'Trading Plan',
      'Trading Journaling & Statistics', 'Goals Setting',
    ],
  },
  {
    id: 'technical',
    name: '📊 Technical Course',
    desc: 'Advanced technical analysis & price action mastery',
    color: '#2196F3',
    lessons: [
      'Pre Requisite', 'Our Principles', 'Risk to Reward Ratio', 'Risk Management',
      'Price Movement and Why of Price', 'Timeframe', 'Market Anatomy', 'Market Nature',
      'Psychology of Market Trend', 'Validation and Invalidation Price',
      'Introduction of Break of Structure', 'Case Scenario Break of Structure',
      'Distribution (Diminuation)', 'Accumulation', 'Psychology Price Level',
      'Break of Structure vs Break of Trend', 'Introduction of Trend Trading',
      'Case Scenario Trend Trading', 'Currency Pair Correlation', 'Behavior of Pair',
      'Price Reaction', 'Fundamental and Price Action', 'Confirmation and Non-Confirmation',
      'Entry Refinement', 'Execution Criteria', 'Stop Loss Formula', 'Take Profit Principles',
      'Trade Management', 'Introduction of Top Down Analysis', 'Top Down Analysis',
      'Creating a Trading Plan', 'Planning and Journaling', 'Backtesting',
      'Watchlist Preparation', 'Probability', 'Mass Psychology', 'Going All In',
      'Why 1% Matters', 'Dealing with Losses', 'When to Trade and When to Stay Away',
      'Withdraw and Diversification', 'Brokerage', 'Sessions and Time',
    ],
  },
  {
    id: 'propfirm',
    name: '🏆 Prop Firm Course',
    desc: 'Pass prop firm challenges and get funded',
    color: '#FFC107',
    lessons: [
      'Introduction to Prop Firm', 'Right Time to Join Prop Firm', 'Choosing the Right Prop Firm',
      'Prop Firm vs Personal Capital', 'Truth About Prop Firms and What to Expect',
      'Prop Firm Capital Size & Year Planning', 'Prop Firm Challenges', 'Pass and Perform Prop Firm',
    ],
  },
  {
    id: 'crypto',
    name: '₿ Crypto Currency Course',
    desc: 'Cryptocurrency trading and investment fundamentals',
    color: '#FF9800',
    lessons: [
      'Introduction to Cryptocurrency', 'Cryptocurrency Investment', 'Cryptocurrency Terms 101',
      'Mastering Crypto Transactions', 'Crypto Q & A',
    ],
  },
  {
    id: 'psychology',
    name: '🧠 Psychology Course',
    desc: 'Master your trading mindset and emotions',
    color: '#9C27B0',
    lessons: [
      'Introduction to Trading Psychology', 'The Role of Emotions in Trading',
      'Fear and Greed — The Twin Destroyers', 'Overcoming FOMO (Fear of Missing Out)',
      'Revenge Trading — How to Stop It', 'Dealing with Losses Like a Pro',
      'Building Unshakeable Discipline', 'Trading Routine and Daily Habits',
      'Overconfidence and How to Manage It', 'Confirmation Bias in Trading',
      'Mass Psychology and Market Sentiment', 'Flow Zone — Trading in Peak Performance',
      'Accountability and Perfectionism', 'Goals Setting for Traders',
      'Trading and Life Balance', 'Building Experience Through Deliberate Practice',
      'How to Handle Winning Streaks', 'How to Handle Losing Streaks',
      'The Mindset of Full-Time Traders', 'Mental Journaling Techniques',
    ],
  },
  {
    id: 'risk_advanced',
    name: '🛡️ Risk & Money Management',
    desc: 'Advanced capital protection and growth techniques',
    color: '#F44336',
    lessons: [
      'Position Sizing Mastery', 'Account Risk Percentage Rules', 'Maximum Daily Loss Limits',
      'Correlation Risk Between Pairs', 'Margin and Leverage Deep Dive',
      'Drawdown Management and Recovery', 'Capital Growth Techniques',
      'Withdrawal Strategy and Diversification', 'Building Multiple Income Streams',
      'Compounding Your Trading Account',
    ],
  },
  {
    id: 'smc',
    name: '💎 Smart Money Concepts (SMC)',
    desc: 'Institutional trading strategies and order flow',
    color: '#00BCD4',
    lessons: [
      'What is Smart Money Concept', 'Market Structure (BOS, CHoCH)', 'Order Blocks (OB)',
      'Fair Value Gap (FVG)', 'Liquidity and Liquidity Grabs', 'Supply and Demand Zones',
      'Premium and Discount Zones', 'Optimal Trade Entry (OTE)', 'Inducement Concept',
      'ICT Power of 3 (AMD)', 'Killzones and Best Trading Times',
      'Higher Timeframe vs Lower Timeframe Alignment', 'SMC Trade Setup from A to Z',
    ],
  },
  {
    id: 'price_action_adv',
    name: '🕯️ Price Action Mastery',
    desc: 'Read price without indicators',
    color: '#795548',
    lessons: [
      'Candlestick Patterns 101', 'Single Candlestick Signals', 'Double Candlestick Patterns',
      'Triple Candlestick Formations', 'Chart Patterns (Head & Shoulders, Double Top/Bottom)',
      'Continuation Patterns (Flags, Pennants, Wedges)', 'Trend Channels and Range Trading',
      'Pin Bar Strategy', 'Engulfing Candle Strategy', 'Inside Bar Breakout Strategy',
      'Price Action at Key Levels', 'Multi-Timeframe Price Action',
    ],
  },
  {
    id: 'economics',
    name: '🌎 Economics & Fundamentals',
    desc: 'Trade the news and economic events profitably',
    color: '#3F51B5',
    lessons: [
      'How Economic News Affects Forex', 'Non-Farm Payroll (NFP) Strategy',
      'CPI and Inflation Reports', 'Central Bank Decisions (Fed, ECB, BOE)',
      'GDP Reports and Their Impact', 'PMI Data and Currency Strength',
      'Geopolitical Events in Trading', 'Risk-On vs Risk-Off Markets',
      'Dollar Index (DXY) Analysis', 'Trading the High-Impact News Safely',
    ],
  },
  {
    id: 'advanced_trading',
    name: '🚀 Advanced Trading',
    desc: 'Professional trader strategies and systems',
    color: '#E91E63',
    lessons: [
      'Top Down Analysis Mastery', 'Multi-Timeframe Confluence Strategy',
      'Developing Your Own Edge', 'Building a Complete Trading System',
      'Backtesting Your Strategy (Step by Step)', 'Forward Testing on Demo',
      'Transitioning from Demo to Live', 'Scaling Up Your Account Safely',
      'Moving to Full-Time Trading', 'Managing Trading as a Business',
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────
function lessonId(courseId: string, lessonName: string) {
  return `${courseId}_${lessonName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function normalizeLessonId(raw: string) {
  // DB stores as course_id + lesson_id; local key uses same format
  return raw;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.start(t); osc.stop(t + 0.4);
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
        const r2 = new SR(); r2.lang = 'en-US'; r2.continuous = false;
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

// ── Certificate Component ─────────────────────────────────────
function Certificate({ course, username, onClose }: { course: typeof COURSES[0]; username: string; onClose: () => void }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  async function handleShare() {
    const text = `🏆 I just completed the ${course.name} at AVAX Trading Academy!\n\n✅ ${course.lessons.length} lessons completed\n📅 ${dateStr}\n\n#ForexTrading #AVAXAcademy #TradingEducation`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Trading Course Certificate', text, url: window.location.origin });
        toast.success('Shared successfully! 🎉');
      } catch (err: any) {
        if (err.name !== 'AbortError') toast.error('Share failed');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Certificate text copied! Paste to share 📋');
      } catch {
        toast.success('Certificate earned! 🏆 ' + course.name);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a1a, #1a0a2e)', border: '2px solid gold' }}>
        <div className="p-6 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-2">Certificate of Completion</p>
          <h2 className="text-white font-black text-xl mb-1">{username}</h2>
          <p className="text-white/60 text-sm mb-4">has successfully completed</p>
          <div className="p-4 rounded-2xl mb-4" style={{ background: `${course.color}20`, border: `1px solid ${course.color}40` }}>
            <p className="font-black text-white text-lg">{course.name}</p>
            <p className="text-white/50 text-xs mt-1">{course.lessons.length} lessons completed</p>
          </div>
          <p className="text-white/40 text-xs mb-6">{dateStr}</p>
          <div className="text-3xl mb-4">✨ AVAX Trading Academy ✨</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-bold text-sm press">Close</button>
            <button
              onClick={handleShare}
              className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 press"
              style={{ background: `linear-gradient(135deg, ${course.color}, ${course.color}cc)` }}>
              <Share2 className="w-4 h-4 text-white" />
              <span className="text-white font-bold text-sm">
                {navigator.share ? 'Share' : 'Copy'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lesson Chat ───────────────────────────────────────────────
function LessonChat({
  course, lessonName, config, onBack, onComplete
}: {
  course: typeof COURSES[0];
  lessonName: string;
  config: any;
  onBack: () => void;
  onComplete: () => void;
}) {
  const storageKey = `course_chat_${course.id}_${lessonName.replace(/[^a-z0-9]/gi, '_')}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { listening, toggle: toggleVoice } = useVoice((t) => setInput(p => p ? p + ' ' + t : t));

  const chatBg = config?.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config?.chat_bg_gradient_from || '#080c14'} 0%, ${config?.chat_bg_gradient_to || '#0a1628'} 100%)`;
  const bubbleOwn = config?.bubble_own || '#FF1493';
  const bubbleOther = config?.bubble_other || '#1e2d3d';
  const aiAvatarUrl = config?.ai_avatar_url || '';

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { try { const p = JSON.parse(saved); if (p?.length > 0) { setMessages(p); return; } } catch {} }
    loadIntro();
  }, []);

  useEffect(() => { if (messages.length > 0) localStorage.setItem(storageKey, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function loadIntro() {
    setLoading(true);
    const systemPrompt = buildSystemPrompt();
    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: {
        aiId: `course_${course.id}`,
        messages: [],
        customSystemPrompt: systemPrompt,
        topicName: lessonName,
      }
    });
    setMessages([{
      role: 'assistant',
      content: error || !data?.text
        ? `Welcome to the lesson: **${lessonName}** from ${course.name}!\n\nI'm your AI mentor and I'm going to teach you everything about this topic clearly and thoroughly. Let's begin!\n\n📚 Are you ready? Let me know and I'll start the lesson!`
        : data.text,
      id: Date.now().toString(),
    }]);
    setLoading(false);
    playChime();
  }

  function buildSystemPrompt() {
    return `You are an expert forex trading mentor at AVAX Trading Academy, teaching the lesson "${lessonName}" from the ${course.name}.

TEACHING APPROACH:
- Start by introducing the topic enthusiastically
- Explain the concept clearly with real examples
- Use analogies to make complex ideas simple
- Give practical tips and real-world application
- Use emojis to make learning engaging
- Structure your explanation clearly (intro → core concept → examples → key takeaways)
- Be thorough — cover all important aspects of "${lessonName}"
- At the end of your explanation, ask: "Did you understand? Do you have any questions about ${lessonName}?"

RULES:
- Be accurate and give real, correct information about forex trading
- If asked questions, answer them thoroughly and ask follow-up to confirm understanding
- Encourage the student throughout
- Respond in the user's language (English or Swahili)
- When the student says they fully understand and have no more questions, end with: "✅ Congratulations! You have completed the lesson on ${lessonName}! Type 'COMPLETE' to mark this lesson as done and earn your progress!"`;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (text.toUpperCase() === 'COMPLETE') {
      handleComplete();
      return;
    }

    const userMsg: Message = { role: 'user', content: text, id: Date.now().toString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: {
        aiId: `course_${course.id}`,
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        customSystemPrompt: buildSystemPrompt(),
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

  function handleComplete() {
    setCompleted(true);
    onComplete();
    toast.success(`✅ Lesson "${lessonName}" completed! 🎉`);
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

  return (
    <div className="fixed inset-0 z-[500] flex flex-col" style={{ background: chatBg }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px,env(safe-area-inset-top))', paddingBottom: 10 }}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center press"
          style={{ background: 'rgba(255,255,255,0.10)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {aiAvatarUrl
              ? <img src={aiAvatarUrl} alt="AI" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              : <Brain className="w-5 h-5 flex-shrink-0" style={{ color: course.color }} />
            }
            <div className="text-center">
              <p className="text-white font-bold text-xs leading-tight truncate max-w-[160px]">{lessonName}</p>
              <p className="text-white/40 text-[10px] truncate max-w-[160px]">{course.name}</p>
            </div>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem(storageKey); setMessages([]); loadIntro(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)' }}>
          <Trash2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {aiAvatarUrl
                  ? <img src={aiAvatarUrl} alt="AI" className="w-6 h-6 rounded-full object-cover" />
                  : <Brain className="w-5 h-5" style={{ color: course.color }} />
                }
              </span>
            )}
            <div className="max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed"
              style={msg.role === 'user'
                ? { background: bubbleOwn, color: '#fff', borderBottomRightRadius: 4 }
                : { background: bubbleOther, color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }
              }>
              {renderText(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start items-end gap-2">
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Brain className="w-5 h-5" style={{ color: course.color }} />
            </span>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: bubbleOther, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: course.color, animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Complete button if done */}
      {!completed && messages.length > 2 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <button onClick={handleComplete}
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 press text-sm font-bold"
            style={{ background: `${course.color}25`, border: `1px solid ${course.color}40`, color: course.color }}>
            <Check className="w-4 h-4" /> Mark as Complete ✓
          </button>
        </div>
      )}
      {completed && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
            style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80' }}>
            <CheckCircle2 className="w-4 h-4" /> Lesson Completed! 🎉
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-2 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(18px)', paddingBottom: 'max(20px,env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-end gap-2">
          <button onClick={toggleVoice} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press"
            style={{ background: listening ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.10)', border: listening ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.10)' }}>
            {listening ? <MicOff className="w-4 h-4 text-white animate-pulse" /> : <Mic className="w-4 h-4 text-white/80" />}
          </button>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={listening ? '🎤 Listening...' : 'Ask your mentor anything...'}
            rows={1} className="flex-1 rounded-full px-5 py-3 text-white text-sm outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', maxHeight: 120, lineHeight: 1.5 }}
            onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} />
          <button onClick={send} disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 press disabled:opacity-40"
            style={{ background: input.trim() && !loading ? `linear-gradient(135deg, ${bubbleOwn}, ${bubbleOwn}cc)` : 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Course Lessons View ───────────────────────────────────────
function CourseLessons({
  course, completedLessons, config, onSelectLesson, onComplete, onBack, username
}: {
  course: typeof COURSES[0];
  completedLessons: Set<string>;
  config: any;
  onSelectLesson: (lesson: string) => void;
  onComplete: () => void;
  onBack: () => void;
  username: string;
}) {
  const [showCertificate, setShowCertificate] = useState(false);
  const allComplete = course.lessons.every(l => completedLessons.has(lessonId(course.id, l)));
  const completedCount = course.lessons.filter(l => completedLessons.has(lessonId(course.id, l))).length;
  const progress = Math.round((completedCount / course.lessons.length) * 100);

  const chatBg = config?.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config?.chat_bg_gradient_from || '#080c14'} 0%, ${config?.chat_bg_gradient_to || '#0a1628'} 100%)`;

  return (
    <div className="fixed inset-0 z-[400] flex flex-col" style={{ background: chatBg }}>
      {showCertificate && <Certificate course={course} username={username} onClose={() => setShowCertificate(false)} />}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px,env(safe-area-inset-top))', paddingBottom: 10, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-sm">{course.name}</p>
          <p className="text-white/40 text-[10px]">{completedCount}/{course.lessons.length} lessons</p>
        </div>
        {allComplete && (
          <button onClick={() => setShowCertificate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl press text-xs font-bold"
            style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid rgba(255,215,0,0.4)', color: '#FFD700' }}>
            <Award className="w-3.5 h-3.5" /> Get Certificate
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white/60 text-xs">{progress}% Complete</p>
          <p className="text-white/60 text-xs">{completedCount}/{course.lessons.length}</p>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${course.color}, ${course.color}cc)` }} />
        </div>
        {allComplete && (
          <p className="text-center mt-2 font-bold text-sm" style={{ color: course.color }}>🎉 Course Complete! Claim your certificate above!</p>
        )}
      </div>

      {/* Lesson list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {course.lessons.map((lesson, idx) => {
          const lid = lessonId(course.id, lesson);
          const done = completedLessons.has(lid);
          return (
            <button key={lid} onClick={() => onSelectLesson(lesson)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press transition-all text-left"
              style={{ background: done ? `${course.color}15` : 'rgba(255,255,255,0.04)', border: `1px solid ${done ? course.color + '40' : 'rgba(255,255,255,0.08)'}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: done ? course.color : 'rgba(255,255,255,0.08)' }}>
                {done
                  ? <Check className="w-4 h-4 text-white" />
                  : <span className="text-white/50 text-xs font-bold">{idx + 1}</span>
                }
              </div>
              <p className={`flex-1 text-sm font-bold ${done ? 'text-white/60 line-through' : 'text-white'}`}>{lesson}</p>
              <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CoursesAIMentor() {
  const navigate = useNavigate();
  const { isAdmin, profile, user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<typeof COURSES[0] | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<any>(null);
  const [showVIPSelector, setShowVIPSelector] = useState(false);

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);
  const username = (profile as any)?.full_name || (profile as any)?.username || (user as any)?.username || 'Trader';

  const PROGRESS_KEY = `courses_ai_progress_${user?.id || 'guest'}`;

  // Load config and progress from both localStorage and DB
  const loadProgress = useCallback(async () => {
    // First load from localStorage for instant display
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompletedLessons(new Set(parsed));
      } catch {}
    }
    // Then load from DB for cross-device accuracy
    if (user?.id) {
      const { data } = await supabase
        .from('course_ai_progress')
        .select('course_id, lesson_id')
        .eq('user_id', user.id);
      if (data && data.length > 0) {
        const dbKeys = data.map(r => `${r.course_id}_${r.lesson_id}`);
        setCompletedLessons(prev => {
          const merged = new Set([...prev, ...dbKeys]);
          // Sync merged back to localStorage
          localStorage.setItem(PROGRESS_KEY, JSON.stringify([...merged]));
          return merged;
        });
      }
    }
  }, [user?.id, PROGRESS_KEY]);

  // Load config and progress
  useEffect(() => {
    supabase.from('site_settings').select('avax_ai_config').eq('id', 'main').single()
      .then(({ data }) => { if (data?.avax_ai_config) setConfig(data.avax_ai_config); });
    loadProgress();
  }, [loadProgress]);

  async function markComplete(courseId: string, lessonName: string) {
    const lid = lessonId(courseId, lessonName);
    const lessonSlug = lessonName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Update local state immediately
    setCompletedLessons(prev => {
      const next = new Set(prev);
      next.add(lid);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify([...next]));
      return next;
    });

    // Persist to DB if logged in
    if (user?.id) {
      await supabase.from('course_ai_progress').upsert({
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonSlug,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,course_id,lesson_id' });
    }
  }

  function handleSelectCourse(course: typeof COURSES[0]) {
    if (!hasVIP) { setShowVIPSelector(true); return; }
    setSelectedCourse(course);
    setSelectedLesson(null);
  }

  const chatBg = config?.chat_bg_url
    ? `url(${config.chat_bg_url}) center/cover`
    : `linear-gradient(160deg, ${config?.chat_bg_gradient_from || '#080c14'} 0%, ${config?.chat_bg_gradient_to || '#0a1628'} 100%)`;

  // Lesson chat view
  if (selectedCourse && selectedLesson) {
    return (
      <LessonChat
        course={selectedCourse}
        lessonName={selectedLesson}
        config={config}
        onBack={() => setSelectedLesson(null)}
        onComplete={async () => {
          await markComplete(selectedCourse.id, selectedLesson);
          setSelectedLesson(null);
        }}
      />
    );
  }

  // Course lessons view
  if (selectedCourse) {
    return (
      <CourseLessons
        course={selectedCourse}
        completedLessons={completedLessons}
        config={config}
        onSelectLesson={setSelectedLesson}
        onComplete={() => {}}
        onBack={() => setSelectedCourse(null)}
        username={username}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[290] flex flex-col" style={{ background: chatBg }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(14px,env(safe-area-inset-top))', paddingBottom: 10, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/avax-ai')} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {config?.ai_avatar_url
              ? <img src={config.ai_avatar_url} alt="AI" className="w-6 h-6 rounded-full object-cover" />
              : <GraduationCap className="w-5 h-5 text-pink-400" />
            }
            <div>
              <p className="text-white font-bold text-sm leading-none">Courses AI Mentor</p>
              <p className="text-white/50 text-[10px]">AI-powered trading education</p>
            </div>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Stats */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Courses', value: COURSES.length, color: '#FF1493' },
            { label: 'Completed', value: completedLessons.size, color: '#4CAF50' },
            { label: 'Total Lessons', value: COURSES.reduce((s, c) => s + c.lessons.length, 0), color: '#2196F3' },
          ].map(s => (
            <div key={s.label} className="text-center py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-black text-base" style={{ color: s.color }}>{s.value}</p>
              <p className="text-white/40 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Course grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <p className="text-white/40 text-[11px] uppercase font-bold tracking-widest mb-2">Choose a Course</p>
        {COURSES.map(course => {
          const completedCount = course.lessons.filter(l => completedLessons.has(lessonId(course.id, l))).length;
          const progress = Math.round((completedCount / course.lessons.length) * 100);
          const isAllDone = completedCount === course.lessons.length;
          return (
            <button key={course.id} onClick={() => handleSelectCourse(course)}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl press text-left"
              style={{ background: `linear-gradient(135deg, ${course.color}18 0%, ${course.color}08 100%)`, border: `1px solid ${course.color}30` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: `${course.color}20` }}>
                {isAllDone ? <Trophy className="w-6 h-6 text-yellow-400" /> : <BookOpen className="w-6 h-6" style={{ color: course.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-black text-sm">{course.name}</p>
                  {isAllDone && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">COMPLETE</span>}
                </div>
                <p className="text-white/40 text-[10px] mb-2">{course.desc} · {course.lessons.length} lessons</p>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: course.color }} />
                </div>
                <p className="text-white/30 text-[10px] mt-1">{completedCount}/{course.lessons.length} lessons completed</p>
              </div>
              {!hasVIP
                ? <Lock className="w-4 h-4 text-pink-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
              }
            </button>
          );
        })}
        <div className="h-6" />
      </div>

      {!hasVIP && (
        <div className="px-4 pb-6 flex-shrink-0">
          <button onClick={() => setShowVIPSelector(true)}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 press"
            style={{ background: 'linear-gradient(135deg,#FF1493,#FF69B4)', boxShadow: '0 0 24px rgba(255,20,147,0.35)' }}>
            <Crown className="w-5 h-5 text-white" />
            <span className="text-white font-black text-sm">Upgrade to VIP to Access All Courses</span>
          </button>
        </div>
      )}

      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
