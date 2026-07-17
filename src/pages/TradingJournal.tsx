import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, BookOpen, Brain, Camera, TrendingUp,
  TrendingDown, Save, Loader2, CheckCircle2, Clock,
  Mic, MicOff, X, Upload, AlertCircle, BarChart2,
  FileText, Flame, Award, Bell
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { supabase, uploadFile, isVIPActive } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import { showBrowserNotification } from '@/lib/browserNotifications';
import { toast } from 'sonner';

interface TradeEntry {
  id: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entry: string;
  stop_loss: string;
  take_profit: string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | '';
  pips: string;
  emotion_before: string;
  emotion_after: string;
  setup_image_url: string;
  result_image_url: string;
  notes: string;
  session: string;
  date: string;
  ai_mode?: boolean;
  created_at?: string;
}

const EMPTY_TRADE: Omit<TradeEntry, 'id'> = {
  pair: '', direction: 'BUY', entry: '', stop_loss: '', take_profit: '',
  result: '', pips: '', emotion_before: '', emotion_after: '',
  setup_image_url: '', result_image_url: '', notes: '', session: 'London',
  date: new Date().toISOString().split('T')[0],
};

const EMOTIONS = ['Confident', 'Anxious', 'Calm', 'Excited', 'Fearful', 'Greedy', 'Focused', 'Tired', 'FOMO', 'Patient'];
const SESSIONS = ['Sydney', 'Tokyo', 'London', 'New York', 'Overlap'];
const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'GBPJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'];

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

async function analyzeImage(imageUrl: string, mode: 'setup' | 'result' = 'setup') {
  const { data: resp, error } = await supabase.functions.invoke('analyze-signal', {
    body: { imageUrl, mode: mode === 'result' ? 'result' : 'setup' }
  });
  if (error) {
    console.error('analyzeImage error:', error);
    return {};
  }
  console.log('analyzeImage response:', resp);
  // Handle both {data: {...}} and direct object
  return resp?.data || resp || {};
}

// ── Streak Calculator ──────────────────────────────────────────
function calcStreaks(entries: TradeEntry[]) {
  const sorted = [...entries]
    .filter(e => e.result === 'WIN' || e.result === 'LOSS')
    .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());

  let currentStreak = 0;
  let longestWin = 0;
  let currentLoss = 0;
  let longestLoss = 0;
  let curWin = 0;
  let curLoss = 0;

  sorted.forEach(e => {
    if (e.result === 'WIN') {
      curWin++;
      curLoss = 0;
      longestWin = Math.max(longestWin, curWin);
    } else {
      curLoss++;
      curWin = 0;
      longestLoss = Math.max(longestLoss, curLoss);
    }
  });

  // Current streak (from latest)
  const rev = [...sorted].reverse();
  if (rev.length > 0) {
    const lastType = rev[0].result;
    for (const e of rev) {
      if (e.result === lastType) currentStreak++;
      else break;
    }
    if (lastType === 'LOSS') currentStreak = -currentStreak;
  }

  return { currentStreak, longestWin, longestLoss: curLoss > 0 ? curLoss : 0, maxLossStreak: longestLoss };
}

// ── Performance Charts ─────────────────────────────────────────
function PerformanceCharts({ entries }: { entries: TradeEntry[] }) {
  function getWeekKey(dateStr: string) {
    const d = new Date(dateStr);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const weekMap: Record<string, { week: string; wins: number; losses: number; be: number; pips: number }> = {};
  entries.forEach(e => {
    const key = getWeekKey(e.date || e.created_at || '');
    if (!weekMap[key]) weekMap[key] = { week: key, wins: 0, losses: 0, be: 0, pips: 0 };
    if (e.result === 'WIN') { weekMap[key].wins++; weekMap[key].pips += parseFloat(e.pips) || 0; }
    if (e.result === 'LOSS') { weekMap[key].losses++; weekMap[key].pips -= parseFloat(e.pips) || 0; }
    if (e.result === 'BREAKEVEN') weekMap[key].be++;
  });
  const weeklyData = Object.values(weekMap).slice(-8);

  let cumPips = 0;
  const cumulativeData = [...entries]
    .filter(e => e.result === 'WIN' || e.result === 'LOSS')
    .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime())
    .map((e, i) => {
      cumPips += e.result === 'WIN' ? (parseFloat(e.pips) || 0) : -(parseFloat(e.pips) || 0);
      return { trade: i + 1, pips: parseFloat(cumPips.toFixed(1)) };
    });

  const emotionMap: Record<string, { wins: number; total: number }> = {};
  entries.forEach(e => {
    const em = e.emotion_before;
    if (!em || !e.result) return;
    if (!emotionMap[em]) emotionMap[em] = { wins: 0, total: 0 };
    emotionMap[em].total++;
    if (e.result === 'WIN') emotionMap[em].wins++;
  });
  const emotionData = Object.entries(emotionMap)
    .map(([em, d]) => ({ emotion: em, rate: Math.round((d.wins / d.total) * 100), total: d.total }))
    .sort((a, b) => b.rate - a.rate);

  if (entries.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 opacity-30">
      <BarChart2 className="w-12 h-12 text-white mx-auto mb-2" />
      <p className="text-white text-sm">No data yet. Log some trades to see charts.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-black text-sm mb-3">📊 Weekly Win/Loss</p>
        {weeklyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 11 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="wins" fill="#22c55e" radius={[4, 4, 0, 0]} name="Wins" />
              <Bar dataKey="losses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Losses" />
              <Bar dataKey="be" fill="#6b7280" radius={[4, 4, 0, 0]} name="B/E" />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-white/30 text-xs text-center py-4">Need more data with results</p>}
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-black text-sm mb-3">📈 Cumulative Pips</p>
        {cumulativeData.length > 1 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="trade" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 11 }} formatter={(val: number) => [`${val >= 0 ? '+' : ''}${val} pips`, 'Cumulative']} />
              <Line type="monotone" dataKey="pips" stroke="#FF1493" strokeWidth={2} dot={{ fill: '#FF1493', r: 2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-white/30 text-xs text-center py-4">Need more resolved trades to show trend</p>}
        {cumulativeData.length > 0 && (
          <div className="mt-2 flex items-center justify-between px-2">
            <span className="text-white/40 text-xs">Start: 0 pips</span>
            <span className={`font-black text-sm ${cumulativeData[cumulativeData.length - 1]?.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Current: {cumulativeData[cumulativeData.length - 1]?.pips >= 0 ? '+' : ''}{cumulativeData[cumulativeData.length - 1]?.pips} pips
            </span>
          </div>
        )}
      </div>

      {emotionData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white font-black text-sm mb-3">🧠 Emotion → Win Rate</p>
          <div className="space-y-2">
            {emotionData.map(em => (
              <div key={em.emotion} className="flex items-center gap-3">
                <div className="w-20 flex-shrink-0">
                  <p className="text-white/70 text-xs truncate">{em.emotion}</p>
                  <p className="text-white/30 text-[9px]">{em.total} trades</p>
                </div>
                <div className="flex-1 h-4 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${em.rate}%`, background: em.rate >= 60 ? '#22c55e' : em.rate >= 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className={`text-xs font-black w-10 text-right flex-shrink-0 ${em.rate >= 60 ? 'text-green-400' : em.rate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{em.rate}%</span>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-[10px] mt-3 text-center">💡 Trade more when you feel "{emotionData[0]?.emotion}" — {emotionData[0]?.rate}% win rate</p>
        </div>
      )}
    </div>
  );
}

// ── PDF Print Export ───────────────────────────────────────────
function exportPDF(entries: TradeEntry[], stats: { total: number; wins: number; losses: number; breakeven: number; winRate: number; netPips: number }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return toast.error('Allow pop-ups to export PDF');

  const rows = entries.map(e => `
    <tr>
      <td>${e.date || (e.created_at ? new Date(e.created_at).toLocaleDateString() : '')}</td>
      <td><b>${e.pair}</b></td>
      <td style="color:${e.direction === 'BUY' ? '#16a34a' : '#dc2626'}">${e.direction}</td>
      <td>${e.entry || '—'}</td>
      <td>${e.stop_loss || '—'}</td>
      <td>${e.take_profit || '—'}</td>
      <td style="color:${e.result === 'WIN' ? '#16a34a' : e.result === 'LOSS' ? '#dc2626' : '#6b7280'}">${e.result || '—'}</td>
      <td>${e.pips || '—'}</td>
      <td>${e.session || '—'}</td>
      <td>${e.emotion_before || '—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.notes || '—'}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html><html>
    <head>
      <title>Trading Journal — ${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 16px; font-size: 11px; }
        .stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat { background: #f3f4f6; border-radius: 8px; padding: 10px 16px; text-align: center; }
        .stat-val { font-size: 18px; font-weight: 900; }
        .stat-lbl { font-size: 10px; color: #666; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #111; color: white; padding: 8px 6px; text-align: left; font-size: 11px; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { body { margin: 10px; } }
      </style>
    </head>
    <body>
      <h1>📈 Trading Journal Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleString()} · VISION AVAX FOREX</div>
      <div class="stats">
        <div class="stat"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Total Trades</div></div>
        <div class="stat"><div class="stat-val" style="color:#16a34a">${stats.wins}</div><div class="stat-lbl">Wins</div></div>
        <div class="stat"><div class="stat-val" style="color:#dc2626">${stats.losses}</div><div class="stat-lbl">Losses</div></div>
        <div class="stat"><div class="stat-val" style="color:#f59e0b">${stats.winRate}%</div><div class="stat-lbl">Win Rate</div></div>
        <div class="stat"><div class="stat-val" style="color:${stats.netPips >= 0 ? '#16a34a' : '#dc2626'}">${stats.netPips >= 0 ? '+' : ''}${stats.netPips.toFixed(1)}</div><div class="stat-lbl">Net Pips</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Entry</th><th>SL</th><th>TP</th><th>Result</th><th>Pips</th><th>Session</th><th>Emotion</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>
  `);
  printWindow.document.close();
}

// ── Upload Result Modal ───────────────────────────────────────
function UploadResultModal({ entry, userId, onSave, onClose }: {
  entry: TradeEntry; userId: string;
  onSave: (result: string, pips: string, resultImageUrl: string, emotionAfter: string) => void;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<'WIN' | 'LOSS' | 'BREAKEVEN' | ''>(entry.result || '');
  const [pips, setPips] = useState(entry.pips || '');
  const [resultImageUrl, setResultImageUrl] = useState(entry.result_image_url || '');
  const [emotion, setEmotion] = useState(entry.emotion_after || '');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const url = await uploadFile('media', `journal_result_${userId}_${Date.now()}`, file);
    setResultImageUrl(url);
    setUploading(false);
    setAnalyzing(true);
    try {
      const parsed = await analyzeImage(url, 'result');
      console.log('Result AI parsed:', parsed);
      if (parsed?.result) {
        const r = String(parsed.result).toLowerCase();
        const mappedResult: 'WIN' | 'LOSS' | 'BREAKEVEN' = r === 'win' ? 'WIN' : r === 'loss' ? 'LOSS' : 'BREAKEVEN';
        setResult(mappedResult);
      }
      if (parsed?.pips) {
        const pipVal = Math.abs(parseFloat(String(parsed.pips)));
        if (!isNaN(pipVal) && pipVal > 0) setPips(pipVal.toString());
      }
      if (parsed?.result || parsed?.pips) {
        toast.success('AI auto-filled result! Tap Save to confirm.');
      } else {
        toast.info('AI analyzed — please fill result manually');
      }
    } catch (err) {
      console.error('Result analyze failed:', err);
      toast.info('Image uploaded — fill result manually');
    }
    setAnalyzing(false);
    e.target.value = '';
  }

  return (
    <div className="fixed inset-0 z-[500] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-t-3xl overflow-auto max-h-[85vh] p-5 space-y-4" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <p className="text-white font-black text-base">Upload Result</p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press"><X className="w-5 h-5 text-white/70" /></button>
        </div>
        <label className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer press" style={{ background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.25)' }}>
          {(uploading || analyzing) ? <Loader2 className="w-5 h-5 text-orange-400 animate-spin" /> : <Camera className="w-5 h-5 text-orange-400" />}
          <div>
            <p className="text-orange-400 font-bold text-sm">{uploading ? 'Uploading...' : analyzing ? 'AI Analyzing...' : resultImageUrl ? '✓ Image uploaded — tap to change' : 'Upload Result Chart'}</p>
            <p className="text-white/40 text-xs">AI will auto-fill win/loss & pips</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
        {resultImageUrl && <img src={resultImageUrl} alt="Result" className="w-full h-36 object-cover rounded-2xl" />}
        <div>
          <p className="text-white/50 text-xs mb-2">Result</p>
          <div className="grid grid-cols-3 gap-2">
            {(['WIN', 'LOSS', 'BREAKEVEN'] as const).map(r => (
              <button key={r} onClick={() => setResult(r)}
                className={`py-3 rounded-xl text-sm font-bold press ${result === r ? (r === 'WIN' ? 'bg-green-500 text-white' : r === 'LOSS' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white') : 'bg-white/5 text-white/50'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white/50 text-xs mb-1">Pips</p>
          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" value={pips} onChange={e => setPips(e.target.value)} placeholder="e.g. 45" type="number" />
        </div>
        <div>
          <p className="text-white/50 text-xs mb-2">Emotion After</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map(em => (
              <button key={em} onClick={() => setEmotion(em)}
                className={`px-2.5 py-1 rounded-full text-xs press ${emotion === em ? 'bg-primary text-white' : 'bg-white/5 text-white/50'}`}>
                {em}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { onSave(result, pips, resultImageUrl, emotion); onClose(); }} disabled={!result}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 press disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)' }}>
          <Save className="w-4 h-4 text-white" /><span className="text-white font-bold">Save Result</span>
        </button>
      </div>
    </div>
  );
}

// ── Add Trade Sheet ───────────────────────────────────────────
function AddTradeSheet({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: (entry: TradeEntry) => void }) {
  const [mode, setMode] = useState<'choose' | 'manual' | 'ai_uploading' | 'ai_reviewing'>('choose');
  const [form, setForm] = useState<Omit<TradeEntry, 'id'>>({ ...EMPTY_TRADE });
  const [customPair, setCustomPair] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { listening, toggle } = useVoice((t) => setForm(p => ({ ...p, notes: p.notes + ' ' + t })));

  function saveManual() {
    if (!form.pair && !customPair) return toast.error('Pair is required');
    if (!form.entry) return toast.error('Entry price is required');
    onSaved({ ...form, id: Date.now().toString(), pair: customPair || form.pair, created_at: new Date().toISOString(), ai_mode: false });
  }

  async function handleSetupUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setMode('ai_uploading');
    setUploading(true);
    const url = await uploadFile('media', `journal_setup_${userId}_${Date.now()}`, file);
    setUploading(false);
    setAnalyzing(true);
    try {
      const parsed = await analyzeImage(url, 'setup');
      console.log('Setup AI parsed:', parsed);
      setForm(prev => ({
        ...prev, setup_image_url: url,
        pair: parsed.pair || prev.pair,
        direction: parsed.direction === 'SELL' ? 'SELL' : (parsed.direction === 'BUY' ? 'BUY' : prev.direction),
        entry: parsed.entry || prev.entry,
        stop_loss: parsed.stop_loss || prev.stop_loss,
        take_profit: parsed.take_profit || prev.take_profit,
        notes: parsed.notes || prev.notes,
        date: new Date().toISOString().split('T')[0],
      }));
      if (parsed.pair || parsed.entry) {
        toast.success('AI analyzed your setup!');
      } else {
        toast.info('Chart uploaded — fill details manually');
        setForm(prev => ({ ...prev, setup_image_url: url }));
      }
    } catch (err) {
      console.error('Setup analyze failed:', err);
      setForm(prev => ({ ...prev, setup_image_url: url }));
      toast.info('Image uploaded — fill details manually');
    }
    setAnalyzing(false);
    setMode('ai_reviewing');
    e.target.value = '';
  }

  function saveAI() {
    onSaved({ ...form, id: Date.now().toString(), pair: form.pair || customPair, created_at: new Date().toISOString(), ai_mode: true });
  }

  return (
    <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-t-3xl overflow-auto max-h-[92vh]" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
          {mode !== 'choose' && (
            <button onClick={() => setMode('choose')} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press">
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
          )}
          {mode === 'choose' && <div />}
          <p className="text-white font-black text-base">
            {mode === 'choose' ? 'Add Trade' : mode === 'manual' ? 'Manual Entry' : mode === 'ai_reviewing' ? 'AI Analysis' : 'AI Mode'}
          </p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {mode === 'choose' && (
            <div className="space-y-3">
              <button onClick={() => setMode('manual')} className="w-full p-4 rounded-2xl text-left press" style={{ background: 'rgba(33,150,243,0.12)', border: '1px solid rgba(33,150,243,0.25)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(33,150,243,0.2)' }}>
                    <BookOpen className="w-6 h-6 text-blue-400" />
                  </div>
                  <div><p className="text-white font-black text-sm">Manual Entry</p><p className="text-white/50 text-xs">Fill all trade details yourself</p></div>
                </div>
              </button>
              <label className="w-full p-4 rounded-2xl text-left press cursor-pointer block" style={{ background: 'rgba(255,20,147,0.12)', border: '1px solid rgba(255,20,147,0.25)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,20,147,0.2)' }}>
                    <Brain className="w-6 h-6 text-pink-400" />
                  </div>
                  <div><p className="text-white font-black text-sm">AI Mode ✨</p><p className="text-white/50 text-xs">Upload chart — AI fills everything</p></div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleSetupUpload} />
              </label>
            </div>
          )}
          {(mode === 'ai_uploading') && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-pink-400 animate-spin" />
              <p className="text-white font-bold">{uploading ? 'Uploading chart...' : 'AI analyzing...'}</p>
              <p className="text-white/40 text-sm text-center">AI is extracting pair, direction, entry, SL, TP</p>
            </div>
          )}
          {mode === 'manual' && (
            <div className="space-y-4">
              <div>
                <p className="text-white/50 text-xs mb-2">Pair</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PAIRS.map(p => (
                    <button key={p} onClick={() => { setForm(f => ({ ...f, pair: p })); setCustomPair(''); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold press ${form.pair === p ? 'gradient-pink text-white' : 'bg-white/5 text-white/60'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, pair: '' }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold press ${!PAIRS.includes(form.pair) && !form.pair ? 'gradient-pink text-white' : 'bg-white/5 text-white/60'}`}>
                    Custom
                  </button>
                </div>
                {!PAIRS.includes(form.pair) && (
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
                    placeholder="Custom pair (e.g. EURJPY)" value={customPair} onChange={e => setCustomPair(e.target.value.toUpperCase())} />
                )}
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Direction</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['BUY', 'SELL'] as const).map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, direction: d }))}
                      className={`py-3 rounded-xl font-bold text-sm press ${form.direction === d ? (d === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-white/5 text-white/50'}`}>
                      {d === 'BUY' ? '↑ BUY' : '↓ SELL'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ label: 'Entry', key: 'entry' }, { label: 'Stop Loss', key: 'stop_loss' }, { label: 'Take Profit', key: 'take_profit' }].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-white/50 text-[10px] mb-1">{label}</p>
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
                      value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Session</p>
                <div className="flex gap-2 flex-wrap">
                  {SESSIONS.map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, session: s }))}
                      className={`px-3 py-1.5 rounded-full text-xs press ${form.session === s ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Emotion Before</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONS.map(em => (
                    <button key={em} onClick={() => setForm(f => ({ ...f, emotion_before: em }))}
                      className={`px-2.5 py-1 rounded-full text-xs press ${form.emotion_before === em ? 'bg-primary text-white' : 'bg-white/5 text-white/50'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Notes</p>
                <div className="flex gap-2">
                  <textarea className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" rows={3}
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Trade notes..." />
                  <button onClick={toggle} className="w-10 h-10 self-end rounded-full flex items-center justify-center press flex-shrink-0"
                    style={{ background: listening ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.1)' }}>
                    {listening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white/70" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Date</p>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <button onClick={saveManual} className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 press"
                style={{ background: 'linear-gradient(135deg, #2196F3, #21CBF3)' }}>
                <Save className="w-4 h-4 text-white" /><span className="text-white font-bold">Save Trade</span>
              </button>
            </div>
          )}
          {mode === 'ai_reviewing' && (
            <div className="space-y-4">
              {form.setup_image_url && <img src={form.setup_image_url} alt="Setup" className="w-full h-40 object-cover rounded-2xl" />}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.2)' }}>
                <p className="text-blue-400 text-xs font-bold flex items-center gap-2"><Brain className="w-4 h-4" /> AI Extracted Data — Edit if needed</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Pair', key: 'pair' }, { label: 'Entry', key: 'entry' }, { label: 'Stop Loss', key: 'stop_loss' }, { label: 'Take Profit', key: 'take_profit' }].map(({ label, key }) => (
                    <div key={key}>
                      <p className="text-white/50 text-[10px] mb-1">{label}</p>
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
                        value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-white/50 text-[10px] mb-1">Direction</p>
                  <div className="flex gap-2">
                    {(['BUY', 'SELL'] as const).map(d => (
                      <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold press ${form.direction === d ? (d === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-white/5 text-white/50'}`}>
                        {d === 'BUY' ? '↑ BUY' : '↓ SELL'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Session</p>
                <div className="flex gap-2 flex-wrap">
                  {SESSIONS.map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, session: s }))}
                      className={`px-3 py-1.5 rounded-full text-xs press ${form.session === s ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-2">Emotion Before</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONS.map(em => (
                    <button key={em} onClick={() => setForm(p => ({ ...p, emotion_before: em }))}
                      className={`px-2.5 py-1 rounded-full text-xs press ${form.emotion_before === em ? 'bg-primary text-white' : 'bg-white/5 text-white/50'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={saveAI} className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 press"
                style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)' }}>
                <Save className="w-4 h-4 text-white" /><span className="text-white font-bold">Save to Journal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Entry Card ────────────────────────────────────────────────
function EntryCard({ entry, onUpdateResult }: { entry: TradeEntry; onUpdateResult: (id: string, result: string, pips: string, resultImageUrl: string, emotionAfter: string) => void }) {
  const [showResult, setShowResult] = useState(false);
  const { user } = useAuth();

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${entry.direction === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {entry.direction === 'BUY' ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
          </div>
          {entry.ai_mode && <span className="text-[8px] text-pink-400 font-bold bg-pink-500/10 px-1.5 py-0.5 rounded-full">AI</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-white font-black text-base">{entry.pair}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.direction === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{entry.direction}</span>
            {entry.result && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.result === 'WIN' ? 'bg-green-500/20 text-green-400' : entry.result === 'LOSS' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {entry.result} {entry.pips ? `• ${entry.pips}p` : ''}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs text-white/50 mb-2">
            <span>E: <span className="text-white/80">{entry.entry || '—'}</span></span>
            <span>SL: <span className="text-red-400">{entry.stop_loss || '—'}</span></span>
            <span>TP: <span className="text-green-400">{entry.take_profit || '—'}</span></span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <span>{entry.session}</span><span>•</span>
            <span>{entry.date || (entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '')}</span>
            {entry.emotion_before && <><span>•</span><span>{entry.emotion_before}</span></>}
          </div>
          {entry.notes && <p className="text-white/40 text-xs mt-2 italic line-clamp-2">"{entry.notes}"</p>}
        </div>
        {entry.setup_image_url && <img src={entry.setup_image_url} alt="Setup" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
      </div>
      {entry.result_image_url ? (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <img src={entry.result_image_url} alt="Result" className="w-16 h-12 rounded-xl object-cover" />
            <div>
              <p className="text-white/50 text-[10px] mb-1">Result</p>
              <div className="flex items-center gap-2">
                {entry.result && <span className={`text-sm font-black ${entry.result === 'WIN' ? 'text-green-400' : entry.result === 'LOSS' ? 'text-red-400' : 'text-gray-400'}`}>{entry.result}</span>}
                {entry.pips && <span className={`text-sm font-bold ${entry.result === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>• {entry.pips} pips</span>}
                {entry.emotion_after && <span className="text-white/40 text-xs">• {entry.emotion_after}</span>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5">
          <button onClick={() => setShowResult(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl press"
            style={{ background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.2)' }}>
            <Upload className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 text-sm font-bold">Upload Result</span>
          </button>
        </div>
      )}
      {showResult && user && (
        <UploadResultModal entry={entry} userId={user.id}
          onSave={(result, pips, resultImageUrl, emotionAfter) => { onUpdateResult(entry.id, result, pips, resultImageUrl, emotionAfter); }}
          onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}

// ── Main Journal Page ─────────────────────────────────────────
export default function TradingJournal() {
  const navigate = useNavigate();
  const { isAdmin, profile, user } = useAuth();
  const [entries, setEntries] = useState<TradeEntry[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'charts'>('journal');
  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  useEffect(() => { if (user) fetchEntries(); else setLoadingData(false); }, [user]);

  // Daily reminder — check if no trades logged in 24h
  useEffect(() => {
    if (!user || !entries.length) return;
    const lastEntry = entries[0];
    const lastDate = new Date(lastEntry.created_at || lastEntry.date);
    const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
    const reminderKey = `journal_reminder_${user.id}_${new Date().toDateString()}`;
    if (hoursSince > 24 && !localStorage.getItem(reminderKey)) {
      localStorage.setItem(reminderKey, '1');
      showBrowserNotification('📓 Trading Journal Reminder', {
        body: `You haven't logged a trade in ${Math.floor(hoursSince)} hours. Keep your journal consistent for better analysis!`,
        tag: 'journal_reminder',
        data: { url: '/trading-journal' },
      });
    }
  }, [entries, user]);

  async function fetchEntries() {
    if (!user) return;
    setLoadingData(true);
    const { data } = await supabase
      .from('trade_journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setEntries(data.map(row => ({
        id: row.id,
        pair: row.pair,
        direction: row.direction,
        entry: row.entry || '',
        stop_loss: row.stop_loss || '',
        take_profit: row.take_profit || '',
        result: row.result || '',
        pips: row.pips || '',
        emotion_before: row.emotion_before || '',
        emotion_after: row.emotion_after || '',
        setup_image_url: row.setup_image_url || '',
        result_image_url: row.result_image_url || '',
        notes: row.notes || '',
        session: row.session || 'London',
        date: row.trade_date || new Date(row.created_at).toISOString().split('T')[0],
        ai_mode: row.ai_mode,
        created_at: row.created_at,
      })));
    }
    setLoadingData(false);
  }

  async function handleSaved(entry: TradeEntry) {
    if (!user) return;
    const { error } = await supabase.from('trade_journal_entries').insert({
      user_id: user.id,
      pair: entry.pair,
      direction: entry.direction,
      entry: entry.entry,
      stop_loss: entry.stop_loss,
      take_profit: entry.take_profit,
      result: entry.result || null,
      pips: entry.pips || null,
      emotion_before: entry.emotion_before || null,
      emotion_after: entry.emotion_after || null,
      setup_image_url: entry.setup_image_url || null,
      result_image_url: entry.result_image_url || null,
      notes: entry.notes || null,
      session: entry.session,
      trade_date: entry.date,
      ai_mode: entry.ai_mode || false,
    });
    if (error) { toast.error('Failed to save: ' + error.message); return; }
    setShowAddSheet(false);
    toast.success('Trade saved to journal!');
    fetchEntries();
  }

  async function handleUpdateResult(id: string, result: string, pips: string, resultImageUrl: string, emotionAfter: string) {
    const { error } = await supabase.from('trade_journal_entries')
      .update({ result: result || null, pips: pips || null, result_image_url: resultImageUrl || null, emotion_after: emotionAfter || null })
      .eq('id', id);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    toast.success('Result saved!');
    fetchEntries();
  }

  function handleAdd() {
    if (!hasVIP) { setShowVIPSelector(true); return; }
    setShowAddSheet(true);
  }

  const total = entries.length;
  const wins = entries.filter(e => e.result === 'WIN').length;
  const losses = entries.filter(e => e.result === 'LOSS').length;
  const breakeven = entries.filter(e => e.result === 'BREAKEVEN').length;
  const netPips = entries.reduce((sum, e) => {
    if (e.result === 'WIN') return sum + (parseFloat(e.pips) || 0);
    if (e.result === 'LOSS') return sum - (parseFloat(e.pips) || 0);
    return sum;
  }, 0);
  const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const streaks = calcStreaks(entries);

  const statsObj = { total, wins, losses, breakeven, winRate, netPips };

  return (
    <div className="fixed inset-0 z-[290] flex flex-col" style={{ background: 'linear-gradient(160deg, #080c14 0%, #0a1628 100%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full flex items-center justify-center press" style={{ background: 'rgba(255,255,255,0.10)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <BookOpen className="w-4 h-4 text-blue-400" />
            <p className="text-white font-bold text-sm">Trading Journal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button onClick={() => exportPDF(entries, statsObj)}
              className="w-10 h-10 rounded-full flex items-center justify-center press"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              title="Export PDF">
              <FileText className="w-4 h-4 text-white/70" />
            </button>
          )}
          <button onClick={handleAdd} className="w-10 h-10 rounded-full flex items-center justify-center press gradient-pink pink-glow-sm">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: 'Trades', value: total, color: 'text-blue-400' },
            { label: 'Wins', value: wins, color: 'text-green-400' },
            { label: 'Losses', value: losses, color: 'text-red-400' },
            { label: 'B/E', value: breakeven, color: 'text-gray-400' },
            { label: 'Win%', value: `${winRate}%`, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="text-center py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className={`font-black text-sm ${s.color}`}>{s.value}</p>
              <p className="text-white/40 text-[9px]">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-white/40 text-xs">Net Pips</span>
          <span className={`font-black text-sm ${netPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netPips >= 0 ? '+' : ''}{netPips.toFixed(1)}
          </span>
        </div>

        {/* Streak Badges */}
        {entries.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {/* Current streak */}
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${streaks.currentStreak > 0 ? 'bg-green-500/15 text-green-400 border border-green-500/25' : streaks.currentStreak < 0 ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-white/5 text-white/40 border border-white/10'}`}>
              <Flame className="w-3 h-3" />
              {streaks.currentStreak > 0 ? `${streaks.currentStreak} Win Streak` : streaks.currentStreak < 0 ? `${Math.abs(streaks.currentStreak)} Loss Streak` : 'No streak'}
            </div>
            {/* Longest win streak */}
            {streaks.longestWin > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                <Award className="w-3 h-3" />
                Best: {streaks.longestWin}W
              </div>
            )}
            {/* Max loss streak */}
            {streaks.maxLossStreak > 1 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/25">
                <AlertCircle className="w-3 h-3" />
                Worst: {streaks.maxLossStreak}L
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
        {[
          { key: 'journal' as const, icon: BookOpen, label: 'Trades' },
          { key: 'charts' as const, icon: BarChart2, label: 'Analytics' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold press transition-all ${activeTab === t.key ? 'gradient-pink text-white' : 'text-white/50'}`}
            style={activeTab !== t.key ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : {}}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-white/40 text-sm">Loading journal...</p>
          </div>
        ) : !user ? (
          <div className="text-center py-16 text-white/20">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-base font-bold mb-1">Sign in required</p>
            <p className="text-sm">Log in to access your trading journal</p>
          </div>
        ) : activeTab === 'charts' ? (
          <PerformanceCharts entries={entries} />
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-white/20">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-base font-bold mb-1">No trades yet</p>
            <p className="text-sm">Tap the + button to log your first trade</p>
          </div>
        ) : (
          entries.map(entry => (
            <EntryCard key={entry.id} entry={entry} onUpdateResult={handleUpdateResult} />
          ))
        )}
      </div>

      {showAddSheet && user && (
        <AddTradeSheet userId={user.id} onClose={() => setShowAddSheet(false)} onSaved={handleSaved} />
      )}
      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
