import { Lock, Pin, TrendingUp, TrendingDown, Crown, Eye, Image as ImageIcon, Share2, Copy, CheckCircle, Send } from 'lucide-react';
import { Signal } from '@/types';
import { useNavigate } from 'react-router-dom';
import VIPPlanSelector from './VIPPlanSelector';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  signal: Signal;
  hasAccess: boolean;
  onViewSetup?: () => void;
  onViewResult?: () => void;
  forceShowClosed?: boolean; // show even VIP-locked if closed
}

function formatSignalMessage(signal: Signal): string {
  const arrow = signal.direction === 'BUY' ? '🟢' : '🔴';
  const typeIcon = signal.type === 'gold' ? '🥇' : signal.type === 'crypto' ? '₿' : '💱';
  return [
    `${arrow} *${signal.pair}* — ${signal.direction} ${typeIcon}`,
    '',
    `📍 Entry: \`${signal.entry}\``,
    `🛑 Stop Loss: \`${signal.stop_loss}\``,
    `🎯 Take Profit: \`${signal.take_profit}\``,
    signal.notes ? `\n📝 ${signal.notes}` : '',
    '',
    `_Shared from VISION AVAX FOREX_`,
  ].filter(l => l !== undefined).join('\n');
}

export default function SignalCard({ signal, hasAccess, onViewSetup, onViewResult, forceShowClosed }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const isBuy = signal.direction === 'BUY';
  const hasSetup = !!(signal as any).setup_image_url;
  const hasResult = !!(signal as any).result_image_url;

  // Closed VIP signals are visible to everyone (to entice non-VIP to join)
  const isVIPLocked = signal.is_vip && !hasAccess && !forceShowClosed && signal.status !== 'closed';

  const typeBadge = {
    forex: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20', label: '💱 FOREX' },
    gold: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/20', label: '🥇 GOLD' },
    crypto: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20', label: '₿ CRYPTO' },
  }[signal.type] || { bg: 'bg-muted', text: 'text-foreground', border: 'border-border', label: signal.type?.toUpperCase() };

  const statusDot = {
    active: 'bg-green-400 animate-pulse',
    closed: 'bg-muted-foreground',
    pending: 'bg-yellow-400 animate-pulse',
  }[signal.status] || 'bg-muted-foreground';

  if (isVIPLocked) {
    return (
      <>
        {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
        <div className="relative bg-card border border-border rounded-2xl overflow-hidden">
          <div className="blur-[3px] pointer-events-none p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>{typeBadge.label}</span>
              <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${isBuy ? 'buy-badge' : 'sell-badge'}`}>{signal.direction}</span>
            </div>
            <p className="font-black text-xl text-foreground mb-3">{signal.pair}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-xl p-2 text-center"><p className="text-[9px] text-muted-foreground">ENTRY</p><p className="text-xs font-bold text-foreground">{signal.entry}</p></div>
              <div className="bg-red-500/10 rounded-xl p-2 text-center"><p className="text-[9px] text-red-400">STOP LOSS</p><p className="text-xs font-bold text-red-400">{signal.stop_loss}</p></div>
              <div className="bg-green-500/10 rounded-xl p-2 text-center"><p className="text-[9px] text-green-400">TARGET</p><p className="text-xs font-bold text-green-400">{signal.take_profit}</p></div>
            </div>
          </div>
          <div className="absolute inset-0 vip-lock rounded-2xl flex flex-col items-center justify-center gap-2 p-4">
            <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center pink-glow-xs mb-1">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-black text-white">VIP Signal</p>
            <p className="text-xs text-white/60 text-center">Upgrade to VIP to view this signal</p>
            <button onClick={() => setShowVIPSelector(true)} className="mt-1 px-5 py-2 gradient-pink rounded-xl text-white text-xs font-bold pink-glow-xs press">
              <Crown className="w-3.5 h-3.5 inline mr-1" /> Get VIP
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`bg-card border rounded-2xl p-4 transition-all card-hover ${signal.is_pinned ? 'border-primary/40 pink-glow-xs' : 'border-border'}`}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>{typeBadge.label}</span>
          {signal.is_pinned && <Pin className="w-3.5 h-3.5 text-primary fill-primary" />}
          {signal.is_vip && <span className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary rounded-full font-bold border border-primary/20">VIP</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[10px] text-muted-foreground capitalize">{signal.status}</span>
          </div>
          <span className={`text-sm font-black px-3 py-1.5 rounded-xl flex items-center gap-1 ${isBuy ? 'buy-badge' : 'sell-badge'}`}>
            {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {signal.direction}
          </span>
        </div>
      </div>

      <p className="font-black text-2xl text-foreground mb-3 tracking-tight">{signal.pair}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/40 border border-border/50 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground font-medium mb-0.5 uppercase tracking-wide">Entry</p>
          <p className="text-sm font-black text-foreground">{signal.entry}</p>
        </div>
        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-red-400 font-medium mb-0.5 uppercase tracking-wide">Stop Loss</p>
          <p className="text-sm font-black text-red-400">{signal.stop_loss}</p>
        </div>
        <div className="bg-green-500/8 border border-green-500/15 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-green-400 font-medium mb-0.5 uppercase tracking-wide">Target</p>
          <p className="text-sm font-black text-green-400">{signal.take_profit}</p>
        </div>
      </div>

      {/* Result/pips for closed signals */}
      {(signal as any).result && signal.status === 'closed' && (
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${(signal as any).result === 'win' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {(signal as any).result === 'win' ? '✅ WIN' : '❌ LOSS'}
          </span>
          {(signal as any).pips && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${(signal as any).result === 'win' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {(signal as any).result === 'win' ? '+' : ''}{(signal as any).pips} pips
            </span>
          )}
        </div>
      )}

      {signal.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2.5 mb-2">{signal.notes}</p>
      )}

      {/* View Setup / View Result buttons — Setup first, then Result */}
      {(hasSetup || hasResult) && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
          {hasSetup && onViewSetup && (
            <button
              onClick={onViewSetup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/25 rounded-xl text-blue-400 text-xs font-bold press hover:bg-blue-500/20 transition-all"
            >
              <ImageIcon className="w-3 h-3" /> View Setup
            </button>
          )}
          {hasResult && signal.status === 'closed' && onViewResult && (
            <button
              onClick={onViewResult}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/25 rounded-xl text-green-400 text-xs font-bold press hover:bg-green-500/20 transition-all"
            >
              <Eye className="w-3 h-3" /> View Result
            </button>
          )}
        </div>
      )}

      {/* View Full Details link */}
      <button
        onClick={() => navigate(`/signals/${signal.id}`)}
        className="flex items-center gap-1 text-[11px] text-primary font-bold mt-2 press hover:underline"
      >
        View Full Details →
      </button>

      {/* Share / Forward row — only for active signals and VIP members */}
      {signal.status === 'active' && hasAccess && (
        <div className="mt-2 pt-2 border-t border-border/30 relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-muted-foreground text-xs font-bold press hover:border-primary/30 hover:text-foreground transition-all"
          >
            <Share2 className="w-3 h-3" /> Share Signal
          </button>

          {showShareMenu && (
            <div
              className="absolute bottom-full left-0 mb-2 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden min-w-[200px] animate-fade-in"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            >
              {/* Forward to VIP Room */}
              <button
                disabled={forwarding}
                onClick={async () => {
                  if (!user) { toast.error('Please login first'); return; }
                  setForwarding(true);
                  setShowShareMenu(false);
                  const msg = [
                    signal.direction === 'BUY' ? '🟢' : '🔴',
                    ` **${signal.pair}** — ${signal.direction}`,
                    signal.type === 'gold' ? ' 🥇' : signal.type === 'crypto' ? ' ₿' : ' 💱',
                    `\n📍 Entry: ${signal.entry}`,
                    `\n🛑 Stop Loss: ${signal.stop_loss}`,
                    `\n🎯 Take Profit: ${signal.take_profit}`,
                    signal.notes ? `\n📝 ${signal.notes}` : '',
                    `\n\n_Forwarded signal_`,
                  ].join('');
                  const { error } = await supabase.from('vip_messages').insert({
                    user_id: user.id,
                    message: msg,
                  });
                  setForwarding(false);
                  if (!error) {
                    toast.success('Signal forwarded to VIP Room!');
                  } else {
                    toast.error('Failed to forward signal');
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all press text-left border-b border-border/40 disabled:opacity-50"
              >
                {forwarding
                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4 text-primary" />
                }
                <div>
                  <p className="text-xs font-bold text-foreground">Forward to VIP Room</p>
                  <p className="text-[10px] text-muted-foreground">Post in group chat</p>
                </div>
              </button>

              {/* Copy to clipboard */}
              <button
                onClick={() => {
                  const text = [
                    `${signal.direction === 'BUY' ? '🟢' : '🔴'} ${signal.pair} — ${signal.direction}`,
                    `Entry: ${signal.entry}`,
                    `Stop Loss: ${signal.stop_loss}`,
                    `Take Profit: ${signal.take_profit}`,
                    signal.notes || '',
                    'Source: VISION AVAX FOREX',
                  ].filter(Boolean).join('\n');
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setShowShareMenu(false);
                  toast.success('Copied to clipboard!');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all press text-left"
              >
                {copied
                  ? <CheckCircle className="w-4 h-4 text-green-400" />
                  : <Copy className="w-4 h-4 text-muted-foreground" />
                }
                <div>
                  <p className="text-xs font-bold text-foreground">Copy to Clipboard</p>
                  <p className="text-[10px] text-muted-foreground">Text format with all details</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
