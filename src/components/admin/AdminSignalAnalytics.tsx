import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, Target, Award, AlertTriangle, Sparkles, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Signal } from '@/types';

const COLORS = {
  win: '#4ADE80',
  loss: '#F87171',
  active: '#FBBF24',
  forex: '#4DAEFF',
  gold: '#FFD700',
  crypto: '#FF6B6B',
};

interface Stats {
  totalSignals: number;
  wins: number;
  losses: number;
  active: number;
  winRate: number;
  totalPips: number;
  avgPips: number;
  longestWinStreak: number;
  longestLossStreak: number;
  byCategory: { name: string; win: number; loss: number; active: number; wr: number }[];
  pieData: { name: string; value: number; color: string }[];
  monthlyTrend: { month: string; win: number; loss: number; wr: number }[];
  directionBreakdown: { direction: string; win: number; loss: number }[];
}

function buildStats(signals: Signal[]): Stats {
  const wins = signals.filter(s => s.result === 'win').length;
  const losses = signals.filter(s => s.result === 'loss').length;
  const active = signals.filter(s => s.status === 'active').length;
  const closed = wins + losses;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;

  const totalPips = signals.reduce((sum, s) => {
    const p = parseFloat((s as any).pips || '0');
    return sum + (isNaN(p) ? 0 : p);
  }, 0);
  const avgPips = closed > 0 ? parseFloat((totalPips / closed).toFixed(1)) : 0;

  // Streak calculation
  const closed_signals = signals.filter(s => s.result === 'win' || s.result === 'loss');
  let maxWin = 0, curWin = 0, maxLoss = 0, curLoss = 0;
  closed_signals.forEach(s => {
    if (s.result === 'win') { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
    else { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
  });

  const cats = ['forex', 'gold', 'crypto'] as const;
  const byCategory = cats.map(cat => {
    const w = signals.filter(s => s.type === cat && s.result === 'win').length;
    const l = signals.filter(s => s.type === cat && s.result === 'loss').length;
    const a = signals.filter(s => s.type === cat && s.status === 'active').length;
    return {
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      win: w, loss: l, active: a,
      wr: (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0,
    };
  });

  // Monthly trend (last 6 months)
  const now = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString('default', { month: 'short' });
    const yr = d.getFullYear(), mo = d.getMonth();
    const mSigs = signals.filter(s => {
      const sd = new Date(s.created_at);
      return sd.getFullYear() === yr && sd.getMonth() === mo;
    });
    const mW = mSigs.filter(s => s.result === 'win').length;
    const mL = mSigs.filter(s => s.result === 'loss').length;
    const mC = mW + mL;
    return { month: label, win: mW, loss: mL, wr: mC > 0 ? Math.round((mW / mC) * 100) : 0 };
  });

  // Direction breakdown
  const directionBreakdown = ['BUY', 'SELL'].map(dir => ({
    direction: dir,
    win: signals.filter(s => s.direction === dir && s.result === 'win').length,
    loss: signals.filter(s => s.direction === dir && s.result === 'loss').length,
  }));

  return {
    totalSignals: signals.length, wins, losses, active, winRate,
    totalPips, avgPips, longestWinStreak: maxWin, longestLossStreak: maxLoss,
    byCategory,
    pieData: [
      { name: 'Win', value: wins, color: COLORS.win },
      { name: 'Loss', value: losses, color: COLORS.loss },
      { name: 'Active', value: active, color: COLORS.active },
    ].filter(d => d.value > 0),
    monthlyTrend,
    directionBreakdown,
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-xs shadow-2xl">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill || p.stroke }}>
          {p.name}: <strong>{p.value}{p.name === 'Win Rate' ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  );
};

// ── AI Insights Panel ──
function AIInsightsPanel({ signals, stats }: { signals: Signal[]; stats: Stats }) {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function generateInsights() {
    setLoading(true);
    setExpanded(true);

    const summary = `
Trading Performance Summary:
- Total Signals: ${stats.totalSignals}
- Win Rate: ${stats.winRate}%
- Wins: ${stats.wins}, Losses: ${stats.losses}, Active: ${stats.active}
- Total Pips: ${stats.totalPips > 0 ? '+' : ''}${stats.totalPips.toFixed(0)}
- Avg Pips/trade: ${stats.avgPips}
- Longest Win Streak: ${stats.longestWinStreak}
- Longest Loss Streak: ${stats.longestLossStreak}
- By Category: ${stats.byCategory.map(c => `${c.name}: ${c.wr}% WR (${c.win}W/${c.loss}L)`).join(', ')}
- Direction: BUY ${stats.directionBreakdown.find(d => d.direction === 'BUY')?.win || 0}W/${stats.directionBreakdown.find(d => d.direction === 'BUY')?.loss || 0}L | SELL ${stats.directionBreakdown.find(d => d.direction === 'SELL')?.win || 0}W/${stats.directionBreakdown.find(d => d.direction === 'SELL')?.loss || 0}L
- Monthly Trend: ${stats.monthlyTrend.map(m => `${m.month}: ${m.wr}%`).join(', ')}
    `.trim();

    try {
      const { data, error } = await supabase.functions.invoke('live-agent', {
        body: {
          messages: [
            {
              role: 'user',
              content: `You are a professional forex trading performance analyst. Analyze this trading performance data and provide actionable insights for a forex signal provider.\n\nData:\n${summary}\n\nProvide:\n1. Overall performance assessment (2-3 sentences)\n2. Key strengths (bullet points)\n3. Areas to improve (bullet points)\n4. Top recommendation for next week (1 sentence)\n\nBe concise, specific, and professional. Respond in English.`,
            },
          ],
          isAdmin: true,
          adminVerified: true,
        },
      });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const raw = await error.context?.text?.().catch(() => '');
          throw new Error(raw || error.message);
        }
        throw error;
      }

      setInsight(data?.text || 'Could not generate insights. Please try again.');
    } catch (e: any) {
      console.error('AI insights error:', e);
      setInsight('⚠️ AI insights unavailable. Please try again in a moment.');
    }

    setLoading(false);
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={expanded ? () => setExpanded(false) : generateInsights}
        className="w-full flex items-center justify-between p-4 press"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-pink flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-foreground text-sm">AI Performance Insights</p>
            <p className="text-[10px] text-muted-foreground">Powered by Gemini 3</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!expanded && (
            <span className="text-[10px] px-2 py-1 bg-primary/15 text-primary rounded-full font-bold">Analyze</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 animate-slide-up">
          {loading ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">AI inachambua data yako...</span>
            </div>
          ) : insight ? (
            <div className="pt-3">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{insight}</p>
              <button
                onClick={generateInsights}
                className="mt-3 flex items-center gap-1.5 text-xs text-primary press"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Analysis
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminSignalAnalytics() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => { fetchSignals(); }, [period]);

  async function fetchSignals() {
    setLoading(true);
    let query = supabase.from('signals').select('*').order('created_at', { ascending: false });
    if (period !== 'all') {
      const days = period === '7d' ? 7 : 30;
      query = query.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());
    }
    const { data } = await query;
    if (data) setSignals(data);
    setLoading(false);
  }

  const stats = buildStats(signals);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Period filter */}
      <div className="flex gap-2">
        {(['7d', '30d', 'all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all press ${period === p ? 'gradient-pink text-white' : 'bg-muted text-muted-foreground'}`}>
            {p === 'all' ? 'All Time' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
          </button>
        ))}
      </div>

      {/* ── AI Insights ── */}
      <AIInsightsPanel signals={signals} stats={stats} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-green-400" /><p className="text-xs text-muted-foreground">Win Rate</p></div>
          <p className="text-2xl font-black text-green-400">{stats.winRate}%</p>
          <p className="text-[10px] text-muted-foreground">{stats.wins}W · {stats.losses}L</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Total Pips</p></div>
          <p className={`text-2xl font-black ${stats.totalPips >= 0 ? 'text-primary' : 'text-red-400'}`}>
            {stats.totalPips >= 0 ? '+' : ''}{stats.totalPips.toFixed(0)}
          </p>
          <p className="text-[10px] text-muted-foreground">Avg {stats.avgPips >= 0 ? '+' : ''}{stats.avgPips}/trade</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-yellow-400" /><p className="text-xs text-muted-foreground">Streaks</p></div>
          <p className="text-2xl font-black text-yellow-400">{stats.longestWinStreak}</p>
          <p className="text-[10px] text-muted-foreground">Best win streak</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total Signals</p></div>
          <p className="text-2xl font-black text-foreground">{stats.totalSignals}</p>
          <p className="text-[10px] text-muted-foreground">{stats.active} active now</p>
        </div>
      </div>

      {/* Win Rate Pie */}
      {stats.pieData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground mb-3 text-sm">Signal Outcomes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" strokeWidth={0}
                label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {stats.pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(val, entry: any) => <span style={{ color: entry.color, fontSize: 11 }}>{val}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-sm text-muted-foreground -mt-1">
            Win rate: <span className="font-black text-green-400">{stats.winRate}%</span>
          </p>
        </div>
      )}

      {/* Monthly Win Rate Trend */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 text-sm">Monthly Win Rate Trend</h3>
        {stats.monthlyTrend.every(m => m.wr === 0) ? (
          <p className="text-center py-6 text-muted-foreground text-sm">Not enough data for trend</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.monthlyTrend}>
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="wr" name="Win Rate" stroke="hsl(var(--primary))"
                strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category Performance Bar Chart */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 text-sm">Performance by Category</h3>
        {stats.byCategory.every(c => c.win + c.loss + c.active === 0) ? (
          <p className="text-center py-6 text-muted-foreground text-sm">No signal data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.byCategory} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="win" name="Win" fill={COLORS.win} radius={[4, 4, 0, 0]} />
              <Bar dataKey="loss" name="Loss" fill={COLORS.loss} radius={[4, 4, 0, 0]} />
              <Bar dataKey="active" name="Active" fill={COLORS.active} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Direction Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 text-sm">BUY vs SELL Performance</h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.directionBreakdown.map(d => {
            const total = d.win + d.loss;
            const wr = total > 0 ? Math.round((d.win / total) * 100) : 0;
            const color = d.direction === 'BUY' ? '#4ADE80' : '#F87171';
            return (
              <div key={d.direction} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${d.direction === 'BUY' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {d.direction}
                  </span>
                  <span className="text-sm font-black" style={{ color }}>{wr}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                  <div className="h-full rounded-full" style={{ width: `${wr}%`, background: color }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{d.win}W · {d.loss}L · {total} total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category win rate bars */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-3 text-sm">Category Win Rates</h3>
        <div className="space-y-3">
          {stats.byCategory.map(cat => {
            const catColor = cat.name === 'Forex' ? COLORS.forex : cat.name === 'Gold' ? COLORS.gold : COLORS.crypto;
            return (
              <div key={cat.name} className="flex items-center gap-3">
                <div className="w-16 flex-shrink-0">
                  <p className="text-xs font-bold text-foreground">{cat.name}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.win}W · {cat.loss}L</p>
                </div>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${cat.wr}%`, background: catColor }} />
                </div>
                <p className="text-xs font-black w-10 text-right" style={{ color: catColor }}>{cat.wr}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
