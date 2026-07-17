import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Trash2, Pin, Edit2, X, Image, Loader2, Eye } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { Signal } from '@/types';
import { toast } from 'sonner';

const empty = {
  title: '', pair: '', type: 'forex' as const, direction: 'BUY' as const,
  entry: '', stop_loss: '', take_profit: '', is_vip: false, is_pinned: false,
  notes: '', status: 'active' as const, result: '', pips: '',
};

export default function AdminSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [setupImage, setSetupImage] = useState<File | null>(null);
  const [autoShareVIP, setAutoShareVIP] = useState(false);
  const [analyzingSetup, setAnalyzingSetup] = useState(false);
  const [uploadingSetup, setUploadingSetup] = useState(false);
  const [analyzingResult, setAnalyzingResult] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const [viewSetup, setViewSetup] = useState<string | null>(null);
  const [viewResult, setViewResult] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'active' | 'pending' | 'closed'>('active');

  useEffect(() => { fetchSignals(); }, []);

  async function fetchSignals() {
    setLoading(true);
    const { data } = await supabase.from('signals').select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setSignals(data);
    setLoading(false);
  }

  async function handleSetupImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSetupImage(file);
    e.target.value = '';

    setUploadingSetup(true);
    const url = await uploadFile('media', `signal_setup_${Date.now()}`, file);
    setUploadingSetup(false);
    if (!url) { toast.error('Upload failed'); return; }

    // Store URL for saving later
    (window as any).__pendingSetupUrl = url;

    // Analyze with AI — improved prompt for accurate BUY/SELL detection
    setAnalyzingSetup(true);
    try {
      const result = await supabase.functions.invoke('analyze-signal', {
        body: { imageUrl: url, mode: 'setup' }
      });
      if (result.error) {
        // Try to get detailed error message
        let errMsg = 'Analysis failed';
        try {
          const { FunctionsHttpError } = await import('@supabase/supabase-js');
          if (result.error instanceof FunctionsHttpError) {
            const text = await result.error.context?.text?.();
            errMsg = text || result.error.message;
          } else {
            errMsg = String(result.error);
          }
        } catch {}
        console.error('Signal analyze error:', errMsg);
        throw new Error(errMsg);
      }
      if (!result.data?.data) throw new Error('No analysis data returned');
      const d = result.data.data;

      // Validate direction — double-check from notes if ambiguous
      const direction = (d.direction || 'BUY').toUpperCase();
      const validDirection: 'BUY' | 'SELL' = direction === 'SELL' ? 'SELL' : 'BUY';

      setForm(p => ({
        ...p,
        pair: d.pair || p.pair,
        direction: validDirection,
        type: d.type || p.type,
        entry: d.entry || p.entry,
        stop_loss: d.stop_loss || p.stop_loss,
        take_profit: d.take_profit || p.take_profit,
        notes: d.notes || p.notes,
        title: d.pair ? `${d.pair} ${validDirection} Signal` : p.title,
      }));
      toast.success(`✅ AI analyzed: ${d.pair || '?'} ${validDirection} · Entry: ${d.entry || '?'}`);
    } catch {
      toast.error('Could not auto-analyze. Fill fields manually.');
    }
    setAnalyzingSetup(false);
  }

  async function handleResultImageUpload(e: React.ChangeEvent<HTMLInputElement>, signalId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadingResult(true);
    let url: string;
    try {
      url = await uploadFile('media', `signal_result_${Date.now()}`, file);
    } catch (err: any) {
      setUploadingResult(false);
      toast.error(`Upload failed: ${err.message}`);
      e.target.value = '';
      return;
    }
    setUploadingResult(false);

    setAnalyzingResult(true);
    try {
      const result = await supabase.functions.invoke('analyze-signal', {
        body: { imageUrl: url, mode: 'result' }
      });
      if (result.error) {
        let errMsg = 'Result analysis failed';
        try {
          const { FunctionsHttpError } = await import('@supabase/supabase-js');
          if (result.error instanceof FunctionsHttpError) {
            const text = await result.error.context?.text?.();
            errMsg = text || result.error.message;
          } else {
            errMsg = String(result.error);
          }
        } catch {}
        console.error('Result analyze error:', errMsg);
        throw new Error(errMsg);
      }
      if (!result.data?.data) throw new Error('No result data returned');
      const d = result.data.data;

      // Auto-close signal and set result
      await supabase.from('signals').update({
        result: d.result || null,
        pips: d.pips || null,
        notes: d.notes || null,
        result_image_url: url,
        status: 'closed', // always close when result uploaded
        updated_at: new Date().toISOString(),
      } as any).eq('id', signalId);

      toast.success(`✅ Result: ${d.result === 'win' ? '🏆 WIN' : '❌ LOSS'} ${d.pips ? `(${d.pips} pips)` : ''} — Signal closed`);
      fetchSignals();
    } catch {
      toast.error('Could not analyze result. Uploading image only.');
      await supabase.from('signals').update({
        result_image_url: url,
        status: 'closed',
        updated_at: new Date().toISOString(),
      } as any).eq('id', signalId);
      fetchSignals();
    }
    setAnalyzingResult(false);
  }

  async function saveSignal() {
    if (!form.pair || !form.entry) return toast.error('Fill pair and entry fields');
    setSaving(true);

    const setupUrl = (window as any).__pendingSetupUrl;
    delete (window as any).__pendingSetupUrl;

    try {
      if (editId) {
        const { error } = await supabase.from('signals').update({
          ...form,
          ...(setupUrl ? { setup_image_url: setupUrl } : {}),
          updated_at: new Date().toISOString(),
        } as any).eq('id', editId);
        if (error) throw error;

        // Auto-close when result is set
        if (form.result === 'win' || form.result === 'loss') {
          await supabase.from('signals').update({ status: 'closed' } as any).eq('id', editId);
          // Send closed notification
          const isVipSig = form.is_vip;
          await supabase.from('notifications').insert({
            title: `\u2705 Signal Closed: ${form.pair}`,
            body: isVipSig
              ? `A VIP signal for ${form.pair} has been closed. Upgrade to VIP to view the result.`
              : `The ${form.pair} ${form.direction} signal has been closed. Result: ${form.result === 'win' ? '\ud83c\udfc6 WIN' : '\u274c LOSS'}${form.pips ? ` (${form.pips} pips)` : ''}`,
            type: 'signal',
            target_user_id: null,
          });
        }
        toast.success('Signal updated!');
      } else {
        const { data: inserted, error } = await supabase.from('signals').insert({
          ...form,
          title: form.title || `${form.pair} ${form.direction} Signal`,
          ...(setupUrl ? { setup_image_url: setupUrl } : {}),
        } as any).select().single();
        if (error) throw error;

        // Broadcast notification to ALL users
        if (inserted) {
          const isVipSig = form.is_vip;
          await supabase.from('notifications').insert({
            title: `\ud83d\udcca New ${form.type.toUpperCase()} Signal: ${form.pair}`,
            body: isVipSig
              ? `\ud83d\udd12 New VIP-exclusive signal posted for ${form.pair}. Upgrade to VIP to view full details.`
              : `\ud83d\udcc8 ${form.direction} signal for ${form.pair} | Entry: ${form.entry} | SL: ${form.stop_loss} | TP: ${form.take_profit}`,
            type: 'signal',
            target_user_id: null,
          });
          // Auto-share to VIP Room if toggle enabled
          if (autoShareVIP) {
            const arrow = form.direction === 'BUY' ? '\ud83d\udfe2' : '\ud83d\udd34';
            const typeIcon = form.type === 'gold' ? '\ud83e\udd47' : form.type === 'crypto' ? '\u20bf' : '\ud83d\udcb1';
            const vipMsg = [
              `${arrow} *${form.pair}* \u2014 ${form.direction} ${typeIcon}`,
              `\ud83d\udccd Entry: ${form.entry}`,
              `\ud83d\uded1 Stop Loss: ${form.stop_loss}`,
              `\ud83c\udfaf Take Profit: ${form.take_profit}`,
              form.notes ? `\ud83d\udcdd ${form.notes}` : '',
              `_Auto-posted signal_`,
            ].filter(Boolean).join('\n');
            await supabase.from('vip_messages').insert({
              user_id: null,
              message: vipMsg,
              is_announcement: true,
            });
          }
        }
        toast.success('Signal added & notification sent to all members!');
      }
    } catch (err: any) {
      toast.error(`Failed to save signal: ${err?.message || 'Unknown error'}`);
    }

    setForm({ ...empty });
    setSetupImage(null);
    setShowAdd(false);
    setEditId(null);
    setSaving(false);
    fetchSignals();
  }

  async function deleteSignal(id: string) {
    if (!confirm('Delete this signal?')) return;
    await supabase.from('signals').delete().eq('id', id);
    toast.success('Signal deleted');
    fetchSignals();
  }

  async function togglePin(s: Signal) {
    await supabase.from('signals').update({ is_pinned: !s.is_pinned }).eq('id', s.id);
    fetchSignals();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('signals').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    // If closing, send notification — hide details for VIP signals
    if (status === 'closed') {
      const sig = signals.find(s => s.id === id);
      if (sig) {
        await supabase.from('notifications').insert({
          title: `✅ Signal Closed: ${sig.pair}`,
          body: sig.is_vip
            ? `A VIP signal for ${sig.pair} has been closed. Upgrade to VIP to view the result.`
            : `The ${sig.pair} ${sig.direction} signal has been closed.${sig.result ? ` Result: ${sig.result === 'win' ? '🏆 WIN' : '❌ LOSS'}${sig.pips ? ` (${sig.pips} pips)` : ''}` : ''}`,
          type: 'signal',
          target_user_id: null,
        });
      }
    }
    fetchSignals();
    toast.success('Status updated');
  }

  function startEdit(s: Signal) {
    setForm({
      title: s.title, pair: s.pair, type: s.type, direction: s.direction,
      entry: s.entry, stop_loss: s.stop_loss, take_profit: s.take_profit,
      is_vip: s.is_vip, is_pinned: s.is_pinned, notes: s.notes || '',
      status: s.status, result: s.result || '', pips: s.pips || '',
    });
    setEditId(s.id);
    setShowAdd(true);
  }

  const filteredSignals = signals.filter(s => s.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2">
        {[
          { key: 'active', label: '🟢 Active' },
          { key: 'pending', label: '⏳ Pending' },
          { key: 'closed', label: '✅ Closed' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key as any)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all press ${filterStatus === f.key ? 'gradient-pink text-white' : 'bg-card border border-border text-muted-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Signals ({filteredSignals.length})
          </h3>
          <button
            onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ ...empty }); setSetupImage(null); delete (window as any).__pendingSetupUrl; }}
            className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press"
          >
            <Plus className="w-3.5 h-3.5" /> New Signal
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-4 bg-muted/30 rounded-xl space-y-3 animate-slide-up">
            <p className="text-sm font-bold text-foreground">{editId ? 'Edit Signal' : 'New Signal'}</p>

            {/* AI Setup Upload */}
            <div className="border border-dashed border-primary/40 rounded-xl p-3">
              <p className="text-xs font-bold text-primary mb-2">🤖 Upload TradingView Screenshot (AI Auto-Fill)</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`flex-1 flex items-center gap-2 py-2 px-3 bg-muted rounded-xl border ${setupImage ? 'border-green-500/50' : 'border-border'}`}>
                  {uploadingSetup || analyzingSetup
                    ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    : <Image className="w-4 h-4 text-primary" />
                  }
                  <span className="text-xs text-muted-foreground flex-1">
                    {uploadingSetup ? 'Uploading...' : analyzingSetup ? '🤖 AI analyzing chart...' : setupImage ? `✓ ${setupImage.name}` : 'Upload setup screenshot'}
                  </span>
                  {setupImage && !uploadingSetup && !analyzingSetup && (
                    <button type="button" onClick={() => { setSetupImage(null); delete (window as any).__pendingSetupUrl; }} className="text-red-400 text-xs">✕</button>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleSetupImageUpload} disabled={uploadingSetup || analyzingSetup} />
              </label>
              {analyzingSetup && <p className="text-[10px] text-primary mt-1 animate-pulse">Reading pair, direction (BUY/SELL), entry, SL, TP from chart...</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Market Type</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}>
                  <option value="forex">Forex</option>
                  <option value="gold">Gold</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Direction</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as any }))}>
                  <option value="BUY">📈 BUY</option>
                  <option value="SELL">📉 SELL</option>
                </select>
              </div>
            </div>

            <input
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              placeholder="Pair (e.g. EUR/USD, XAU/USD, BTC/USDT) *"
              value={form.pair}
              onChange={e => setForm(p => ({ ...p, pair: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-2">
              <input className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="Entry *" value={form.entry} onChange={e => setForm(p => ({ ...p, entry: e.target.value }))} />
              <input className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-red-500" placeholder="Stop Loss" value={form.stop_loss} onChange={e => setForm(p => ({ ...p, stop_loss: e.target.value }))} />
              <input className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-green-500" placeholder="Take Profit" value={form.take_profit} onChange={e => setForm(p => ({ ...p, take_profit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Result (set to close signal)</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))}>
                  <option value="">Not closed yet</option>
                  <option value="win">✅ Win</option>
                  <option value="loss">❌ Loss</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Pips</label>
                <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="+45 or -20" value={form.pips} onChange={e => setForm(p => ({ ...p, pips: e.target.value }))} />
              </div>
            </div>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none"
              placeholder="Notes (optional)"
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_vip} onChange={e => setForm(p => ({ ...p, is_vip: e.target.checked }))} />
                <span className="text-sm text-foreground">VIP Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(p => ({ ...p, is_pinned: e.target.checked }))} />
                <span className="text-sm text-foreground">Pin Signal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoShareVIP} onChange={e => setAutoShareVIP(e.target.checked)} />
                <span className="text-sm text-foreground">📢 Auto-share VIP Room</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveSignal}
                disabled={saving || analyzingSetup || uploadingSetup}
                className="flex-1 py-2.5 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press"
              >
                {saving ? 'Saving...' : editId ? 'Update Signal' : 'Add Signal'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditId(null); setSetupImage(null); delete (window as any).__pendingSetupUrl; }} className="px-4 py-2.5 bg-muted rounded-xl text-muted-foreground text-sm font-bold press">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : filteredSignals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {filterStatus} signals</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSignals.map(s => (
              <div key={s.id} className={`p-3 rounded-xl border ${s.is_pinned ? 'border-primary/40' : 'border-border'} bg-muted/20`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${s.direction === 'BUY' ? 'buy-badge' : 'sell-badge'}`}>{s.direction}</span>
                      <p className="text-sm font-bold text-foreground">{s.pair}</p>
                      {s.is_pinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
                      {s.is_vip && <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">VIP</span>}
                      {s.result && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${s.result === 'win' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                          {s.result === 'win' ? '✅ Win' : '❌ Loss'}{s.pips ? ` · ${s.pips}p` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Entry: {s.entry} | SL: {s.stop_loss} | TP: {s.take_profit}</p>
                  </div>
                  <select
                    className="bg-muted border border-border rounded-lg px-2 py-1 text-foreground text-xs outline-none flex-shrink-0"
                    value={s.status}
                    onChange={e => updateStatus(s.id, e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => startEdit(s)} className="px-2.5 py-1 bg-muted rounded-lg text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 press">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => togglePin(s)} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 press ${s.is_pinned ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    <Pin className="w-3 h-3" /> {s.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  {(s as any).setup_image_url && (
                    <button onClick={() => setViewSetup((s as any).setup_image_url)} className="px-2.5 py-1 bg-blue-500/10 rounded-lg text-xs text-blue-400 flex items-center gap-1 press">
                      <Eye className="w-3 h-3" /> View Setup
                    </button>
                  )}
                  {/* Upload Result (auto-closes signal) */}
                  <label className="px-2.5 py-1 bg-green-500/10 rounded-lg text-xs text-green-400 flex items-center gap-1 press cursor-pointer">
                    {uploadingResult || analyzingResult ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                    {analyzingResult ? 'Reading...' : 'Upload Result'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleResultImageUpload(e, s.id)} disabled={uploadingResult || analyzingResult} />
                  </label>
                  {(s as any).result_image_url && (
                    <button onClick={() => setViewResult((s as any).result_image_url)} className="px-2.5 py-1 bg-yellow-500/10 rounded-lg text-xs text-yellow-400 flex items-center gap-1 press">
                      <Eye className="w-3 h-3" /> View Result
                    </button>
                  )}
                  <button onClick={() => deleteSignal(s.id)} className="px-2.5 py-1 bg-red-500/10 rounded-lg text-xs text-red-400 flex items-center gap-1 hover:bg-red-500/20 press">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image viewer */}
      {(viewSetup || viewResult) && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col" onClick={() => { setViewSetup(null); setViewResult(null); }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <span className="text-white text-sm font-bold">{viewSetup ? '📊 Signal Setup' : '📈 Signal Result'}</span>
            <button onClick={() => { setViewSetup(null); setViewResult(null); }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <img src={viewSetup || viewResult || ''} alt="Signal" className="max-w-full max-h-full rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
