import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft, TrendingUp, TrendingDown, Target, Shield, Activity,
  Brain, Image as ImageIcon, Lock, Crown, Loader2, ChevronRight,
  Pin, Clock, CheckCircle2, XCircle, Share2
} from 'lucide-react';
import { supabase, isVIPActive } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Signal } from '@/types';
import GlobalMediaViewer from '@/components/features/GlobalMediaViewer';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-green-500/15 border border-green-500/30 rounded-full text-green-400 text-[11px] font-black">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active
    </span>
  );
  if (status === 'pending') return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-full text-yellow-400 text-[11px] font-black">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-muted border border-border rounded-full text-muted-foreground text-[11px] font-black">
      <CheckCircle2 className="w-3 h-3" /> Closed
    </span>
  );
}

function ResultBadge({ result }: { result?: string }) {
  if (!result) return null;
  const isWin = result.toLowerCase().includes('win') || result.toLowerCase().includes('tp');
  const isLoss = result.toLowerCase().includes('loss') || result.toLowerCase().includes('sl');
  if (isWin) return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-green-500/15 border border-green-500/30 rounded-full text-green-400 text-[11px] font-black">
      <CheckCircle2 className="w-3 h-3" /> {result}
    </span>
  );
  if (isLoss) return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-full text-red-400 text-[11px] font-black">
      <XCircle className="w-3 h-3" /> {result}
    </span>
  );
  return (
    <span className="px-2.5 py-1 bg-muted border border-border rounded-full text-foreground text-[11px] font-bold">{result}</span>
  );
}

function LevelRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
  );
}

export default function SignalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaViewer, setMediaViewer] = useState<{ items: { url: string; type: 'image' | 'video' }[]; index: number } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showVIP, setShowVIP] = useState(false);

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  async function shareSignal() {
    if (!signal) return;
    const sig = signal as any;
    const shareText = `📊 ${signal.pair} ${signal.direction}\n${sig.result ? `Result: ${sig.result}` : ''}${sig.pips ? ` • ${sig.pips} pips` : ''}\n\nVISION AVAX FOREX — Premium Signals\n${window.location.href}`;

    // Try canvas-based image share for closed signals with setup image
    if (signal.status === 'closed' && navigator.canShare) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d')!;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 800, 450);
        grad.addColorStop(0, '#0a0010');
        grad.addColorStop(1, '#1a0028');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 450);

        // Decorative accent bar
        ctx.fillStyle = '#FF1493';
        ctx.fillRect(0, 0, 6, 450);

        // Brand name
        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('VISION AVAX FOREX', 30, 45);

        // Pair + Direction
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px Arial';
        ctx.fillText(signal.pair, 30, 130);

        const isBuy = signal.direction === 'BUY';
        ctx.fillStyle = isBuy ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 40px Arial';
        ctx.fillText(signal.direction, 30, 185);

        // Result
        if (sig.result) {
          const isWin = sig.result.toLowerCase().includes('win') || sig.result.toLowerCase().includes('tp');
          ctx.fillStyle = isWin ? '#22c55e' : '#ef4444';
          ctx.font = 'bold 48px Arial';
          ctx.fillText(sig.result.toUpperCase(), 30, 270);
        }

        // Pips
        if (sig.pips) {
          ctx.fillStyle = '#FF1493';
          ctx.font = 'bold 36px Arial';
          ctx.fillText(`${sig.pips} PIPS`, 30, 330);
        }

        // Entry/SL/TP labels
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '18px Arial';
        ctx.fillText(`Entry: ${signal.entry}  |  SL: ${signal.stop_loss}${signal.take_profit ? '  |  TP: ' + signal.take_profit : ''}`, 30, 390);

        // Date
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '16px Arial';
        ctx.fillText(new Date(signal.created_at).toLocaleDateString(), 30, 425);

        // Try to share as image file
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
        if (blob) {
          const file = new File([blob], `${signal.pair}_signal.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: `${signal.pair} ${signal.direction} Signal`, text: shareText });
            return;
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        // fall through to text share
      }
    }

    // Text-only share fallback
    if (navigator.share) {
      try {
        await navigator.share({ title: `${signal.pair} ${signal.direction} Signal`, text: shareText, url: window.location.href });
      } catch (e: any) {
        if (e.name !== 'AbortError') { navigator.clipboard.writeText(shareText); toast.success('Signal info copied!'); }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Signal info copied to clipboard!');
    }
  }

  useEffect(() => {
    if (!id) return;
    supabase.from('signals').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setSignal(data);
      setLoading(false);
    });
  }, [id]);

  async function runAIAnalysis() {
    if (!signal) return;
    if (!hasVIP) { setShowVIP(true); return; }
    setAiLoading(true);
    setAiAnalysis(null);

    const systemPrompt = `You are an elite forex signal analyst with 20+ years of experience. Analyze this trading signal thoroughly and provide deep insights.

SIGNAL DATA:
- Pair: ${signal.pair}
- Direction: ${signal.direction}
- Entry: ${signal.entry}
- Stop Loss: ${signal.stop_loss}
- Take Profit: ${(signal as any).take_profit || 'Not set'}
- Status: ${signal.status}
- Type: ${(signal as any).type || 'FOREX'}
${(signal as any).notes ? '- Notes: ' + (signal as any).notes : ''}
${(signal as any).result ? '- Result: ' + (signal as any).result : ''}
${(signal as any).pips ? '- Pips: ' + (signal as any).pips : ''}

Provide a COMPREHENSIVE analysis covering:
1. 📊 Signal Overview — explain the setup in simple terms
2. 📐 Risk/Reward Analysis — calculate R:R ratio, evaluate if it's worth taking
3. 🎯 Entry Analysis — evaluate the entry price quality
4. 🛡️ Risk Assessment — evaluate SL placement, hidden risks
5. 🏆 Take Profit Potential — assess TP feasibility, suggest alternatives if needed
6. 📈 Market Context — what market conditions favor/oppose this signal
7. ⚠️ Key Risks — what could invalidate this trade
8. 💡 Professional Opinion — overall verdict with confidence level (1-10)

Be specific, accurate, and educational. Use emojis for clarity.`;

    const { data, error } = await supabase.functions.invoke('avax-ai', {
      body: {
        aiId: 'signal_analysis',
        messages: [{ role: 'user', content: `Please analyze this ${signal.pair} ${signal.direction} signal in detail.` }],
        customSystemPrompt: systemPrompt,
        topicName: `${signal.pair} Signal Analysis`,
      }
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { const t = await error.context?.text(); msg = t || msg; } catch {}
      }
      toast.error('Analysis failed: ' + msg);
      setAiAnalysis(null);
    } else {
      setAiAnalysis(data?.text || 'Analysis complete.');
    }
    setAiLoading(false);
  }

  // Auto-run analysis when component mounts for VIP users
  useEffect(() => {
    if (signal && hasVIP && !aiAnalysis && !aiLoading) {
      runAIAnalysis();
    }
  }, [signal, hasVIP]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  if (!signal) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Activity className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
      <p className="text-foreground font-bold mb-1">Signal Not Found</p>
      <p className="text-xs text-muted-foreground mb-5">This signal may have been removed.</p>
      <button onClick={() => navigate('/signals')} className="px-5 py-2.5 gradient-pink rounded-xl text-white font-bold press">← Back to Signals</button>
    </div>
  );

  const sig = signal as any;
  const isBuy = signal.direction === 'BUY';
  const dirColor = isBuy ? 'text-green-400' : 'text-red-400';
  const dirBg = isBuy ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';
  const canView = isAdmin || !signal.is_vip || signal.status === 'closed' || hasVIP;

  return (
    <>
      {mediaViewer && <GlobalMediaViewer items={mediaViewer.items} initialIndex={mediaViewer.index} onClose={() => setMediaViewer(null)} />}
      {showVIP && <VIPPlanSelector onClose={() => setShowVIP(false)} />}

      {/* Dynamic OG meta tags for signal sharing */}
      {signal && (
        <Helmet>
          <title>{signal.pair} {signal.direction} Signal — VISION AVAX FOREX</title>
          <meta property="og:title" content={`${signal.pair} ${signal.direction}${sig.result ? ' — ' + sig.result : ''}${sig.pips ? ' (+' + sig.pips + ' pips)' : ''} | VISION AVAX FOREX`} />
          <meta property="og:description" content={`Entry: ${signal.entry} | SL: ${signal.stop_loss}${signal.take_profit ? ' | TP: ' + signal.take_profit : ''}${sig.notes ? ' | ' + sig.notes : ''} — Premium Forex Signal`} />
          {sig.setup_image_url && <meta property="og:image" content={sig.setup_image_url} />}
          {sig.result_image_url && signal.status === 'closed' && <meta property="og:image" content={sig.result_image_url} />}
          <meta property="og:url" content={window.location.href} />
          <meta property="og:type" content="article" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${signal.pair} ${signal.direction} Signal — VISION AVAX FOREX`} />
          {sig.setup_image_url && <meta name="twitter:image" content={sig.setup_image_url} />}
        </Helmet>
      )}

      <div className="min-h-screen pb-28 animate-fade-in" style={{ paddingTop: '0' }}>
        {/* Header */}
        <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <button onClick={() => navigate('/signals')} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center press">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-foreground truncate">{signal.pair}</h1>
              <StatusBadge status={signal.status} />
              {signal.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
              {signal.is_vip && <span className="px-2 py-0.5 gradient-pink rounded-full text-white text-[10px] font-black">VIP</span>}
            </div>
          </div>
          <ResultBadge result={sig.result} />
          {signal.status === 'closed' && (
            <button onClick={shareSignal}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center press hover:bg-muted/80 transition-all"
              title="Share Signal">
              <Share2 className="w-4 h-4 text-foreground" />
            </button>
          )}
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Signal Hero */}
          <div className={`rounded-3xl border p-5 ${dirBg}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-2xl font-black text-foreground">{signal.pair}</p>
                <p className="text-xs text-muted-foreground">{sig.type || 'FOREX'} · {new Date(signal.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {isBuy
                  ? <TrendingUp className="w-8 h-8 text-green-400 mb-0.5" />
                  : <TrendingDown className="w-8 h-8 text-red-400 mb-0.5" />
                }
                <span className={`text-sm font-black ${dirColor}`}>{signal.direction}</span>
              </div>
            </div>

            {!canView ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <Lock className="w-8 h-8 text-primary" />
                <p className="text-sm font-bold text-foreground">VIP Signal</p>
                <p className="text-xs text-muted-foreground text-center">Upgrade to VIP to see entry, SL & TP levels</p>
                <button onClick={() => setShowVIP(true)} className="mt-1 px-4 py-2 gradient-pink rounded-xl text-white text-xs font-bold press pink-glow-xs flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" /> Get VIP Access
                </button>
              </div>
            ) : (
              <div className="bg-card/50 rounded-2xl px-4 py-1">
                <LevelRow label="Entry" value={signal.entry} color="text-foreground" />
                <LevelRow label="Stop Loss" value={signal.stop_loss} color="text-red-400" />
                {signal.take_profit && <LevelRow label="Take Profit" value={signal.take_profit} color="text-green-400" />}
                {sig.pips && <LevelRow label="Pips" value={`${sig.pips} pips`} color="text-primary" />}
              </div>
            )}
          </div>

          {/* Setup Image */}
          {sig.setup_image_url && canView && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-primary" /> Chart Setup
              </p>
              <button
                onClick={() => setMediaViewer({ items: [{ url: sig.setup_image_url, type: 'image' }], index: 0 })}
                className="w-full rounded-2xl overflow-hidden border border-border press hover:border-primary/30 transition-all relative"
                style={{ aspectRatio: '16/9' }}
              >
                <img src={sig.setup_image_url} alt="Setup" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded-lg text-[10px] text-white font-bold">
                  Tap to zoom
                </div>
              </button>
            </div>
          )}

          {/* Result Image */}
          {sig.result_image_url && signal.status === 'closed' && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Trade Result
              </p>
              <button
                onClick={() => setMediaViewer({ items: [{ url: sig.result_image_url, type: 'image' }], index: 0 })}
                className="w-full rounded-2xl overflow-hidden border border-border press hover:border-primary/30 transition-all relative"
                style={{ aspectRatio: '16/9' }}
              >
                <img src={sig.result_image_url} alt="Result" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded-lg text-[10px] text-white font-bold">
                  Tap to zoom
                </div>
              </button>
            </div>
          )}

          {/* Notes */}
          {sig.notes && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-primary" /> Analysis Notes
              </p>
              <p className="text-sm text-foreground leading-relaxed">{sig.notes}</p>
            </div>
          )}

          {/* Signal locked for non-VIP */}
          {!canView && (
            <div className="bg-card border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-8 h-8 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-foreground text-sm mb-1">VIP Signal — Full Details Locked</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  This is a premium VIP signal. Upgrade to access entry, SL, TP levels, setup chart, AI analysis, and more.
                </p>
                <button onClick={() => setShowVIP(true)} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold press pink-glow-xs flex items-center justify-center gap-2">
                  <Crown className="w-4 h-4" /> Upgrade to VIP
                </button>
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {canView && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border/60">
                <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm">AI Signal Analysis</p>
                  <p className="text-xs text-muted-foreground">Get deep insights powered by AI</p>
                </div>
                {!aiAnalysis && !aiLoading && (
                  <button onClick={runAIAnalysis} className="flex items-center gap-1.5 px-3 py-2 gradient-pink rounded-xl text-white text-xs font-bold press pink-glow-xs">
                    <Brain className="w-3.5 h-3.5" /> Analyze
                  </button>
                )}
              </div>
              {aiLoading && (
                <div className="flex items-center gap-3 p-5">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">AI is analyzing this signal...</p>
                    <p className="text-xs text-muted-foreground">Reviewing entry, SL/TP, risk/reward & market conditions</p>
                  </div>
                </div>
              )}
              {aiAnalysis && (
                <div className="p-4">
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
                  <button onClick={runAIAnalysis} className="mt-3 text-xs text-primary font-bold press hover:underline flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Re-analyze
                  </button>
                </div>
              )}
              {!aiLoading && !aiAnalysis && hasVIP && (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Click "Analyze" to get AI-powered insights on this signal</p>
                </div>
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Signal Info</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Type</span>
                <span className="text-xs font-bold text-foreground uppercase">{sig.type || 'FOREX'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Posted</span>
                <span className="text-xs font-bold text-foreground">{new Date(signal.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {sig.updated_at && sig.updated_at !== signal.created_at && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Updated</span>
                  <span className="text-xs font-bold text-foreground">{new Date(sig.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {sig.pips && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Result Pips</span>
                  <span className="text-xs font-black text-primary">{sig.pips} pips</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
