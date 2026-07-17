
import { useState, useEffect } from 'react';
import { Link, Plus, Copy, Users, MousePointer, CreditCard, Trash2, Gift, Crown, Bell, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ReferralLink } from '@/types';
import { toast } from 'sonner';

interface ReferrerCandidate {
  id: string;
  code: string;
  label: string;
  paying_referrals: number;
  registrations: number;
  owner_user_id: string | null;
  reward_granted: boolean;
  owner?: { username: string; email: string; avatar_url: string; vip_expires_at: string | null };
}

export default function AdminReferrals() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<ReferrerCandidate[]>([]);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const [sendingRewardNotif, setSendingRewardNotif] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [l, e] = await Promise.all([
      supabase.from('referral_links').select('*, user_profiles!referral_links_owner_user_id_fkey(username,email,avatar_url,vip_expires_at)').order('created_at', { ascending: false }),
      supabase.from('referral_events').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (l.data) {
      setLinks(l.data as any);
      // Qualifying: >= 10 paying referrals
      const qual = (l.data as any[]).filter(x => (x.paying_referrals || 0) >= 10);
      setCandidates(qual.map(x => ({ ...x, owner: x.user_profiles })));
    }
    if (e.data) setEvents(e.data);
    setLoading(false);
  }

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createLink() {
    if (!newLabel) return toast.error('Enter a label');
    setSaving(true);
    const code = generateCode();
    await supabase.from('referral_links').insert({ code, label: newLabel });
    toast.success('Referral link created!');
    setNewLabel('');
    fetchData();
    setSaving(false);
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  }

  async function deleteLink(id: string) {
    await supabase.from('referral_links').delete().eq('id', id);
    fetchData();
    toast.success('Link deleted');
  }

  async function grantLifetimeVIP(candidate: ReferrerCandidate) {
    if (!candidate.owner_user_id) { toast.error('No user linked to this referral'); return; }
    setGrantingId(candidate.id);
    try {
      // Grant lifetime VIP
      await supabase.from('user_profiles').update({
        is_vip: true,
        vip_expires_at: '2099-12-31T00:00:00Z',
        blue_tick: true,
      }).eq('id', candidate.owner_user_id);

      // Mark reward as granted
      await supabase.from('referral_links').update({ reward_granted: true }).eq('id', candidate.id);

      // Send notification
      await supabase.from('notifications').insert({
        title: '🎉 Congratulations! Lifetime VIP Unlocked!',
        body: `You've referred 10 paying members! As a reward, you now have FREE Lifetime VIP access. Thank you for growing our community!`,
        type: 'vip',
        target_user_id: candidate.owner_user_id,
      });

      toast.success(`Lifetime VIP granted to ${candidate.owner?.username || 'user'}!`);
      fetchData();
    } catch {
      toast.error('Failed to grant VIP');
    }
    setGrantingId(null);
  }

  async function sendRewardNotification(candidate: ReferrerCandidate) {
    if (!candidate.owner_user_id) return;
    setSendingRewardNotif(candidate.id);
    const remaining = Math.max(0, 10 - (candidate.paying_referrals || 0));
    await supabase.from('notifications').insert({
      title: '🎁 You\'re Almost There! Lifetime VIP Awaits', // Escaped apostrophe
      body: `You've referred ${candidate.paying_referrals || 0} paying members. Just ${remaining} more to earn FREE Lifetime VIP!`,
      type: 'general',
      target_user_id: candidate.owner_user_id,
    });
    toast.success('Reward progress notification sent!');
    setSendingRewardNotif(null);
  }

  const totalClicks = links.reduce((a, l) => a + l.clicks, 0);
  const totalRegs = links.reduce((a, l) => a + l.registrations, 0);
  const totalPays = links.reduce((a, l) => a + l.payments, 0);
  const qualifyingCount = candidates.filter(c => !c.reward_granted).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: MousePointer, val: totalClicks, label: 'Total Clicks', color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { icon: Users, val: totalRegs, label: 'Registrations', color: 'text-green-400', bg: 'bg-green-500/10' },
          { icon: CreditCard, val: totalPays, label: 'Payments', color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ icon: Icon, val, label, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center border border-border`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className={`text-lg font-black ${color}`}>{val}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Reward Candidates Panel ── */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/25 rounded-2xl p-4">
        <button
          className="w-full flex items-center justify-between mb-3"
          onClick={() => setShowCandidates(!showCandidates)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-left">
              <p className="font-black text-foreground text-sm">Lifetime VIP Rewards</p>
              <p className="text-xs text-muted-foreground">Users with ≥ 10 paying referrals</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {qualifyingCount > 0 && (
              <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-bold">{qualifyingCount} pending</span>
            )}
            {showCandidates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {showCandidates && (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-500/10 rounded-xl text-xs text-yellow-300 leading-relaxed">
              🎁 <strong>Reward Rule:</strong> Any member who refers 10 paying VIP members earns <strong>FREE Lifetime VIP</strong>. Grant the reward manually below or it can be automated.
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-4">
                <Gift className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No qualifying referrers yet</p>
                <p className="text-xs text-muted-foreground">(Need ≥ 10 paying referrals)</p>
              </div>
            ) : (
              candidates.map(c => (
                <div key={c.id} className={`p-3 rounded-xl border ${c.reward_granted ? 'border-green-500/25 bg-green-500/8' : 'border-yellow-500/25 bg-yellow-500/8'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink flex-shrink-0">
                      {c.owner?.avatar_url ? <img src={c.owner.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(c.owner?.username || '?')[0].toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{c.owner?.username || c.owner?.email || 'Member'}</p>
                      <p className="text-xs text-muted-foreground">{c.code} · {c.paying_referrals} paying referrals</p>
                    </div>
                    {c.reward_granted && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-bold flex-shrink-0">✅ Granted</span>
                    )}
                  </div>
                  {!c.reward_granted && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => grantLifetimeVIP(c)}
                        disabled={grantingId === c.id}
                        className="flex items-center justify-center gap-1.5 py-2 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50"
                      >
                        {grantingId === c.id
                          ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Crown className="w-3.5 h-3.5" />
                        }
                        Grant Lifetime VIP
                      </button>
                      <button
                        onClick={() => sendRewardNotification(c)}
                        disabled={sendingRewardNotif === c.id}
                        className="flex items-center justify-center gap-1.5 py-2 bg-muted border border-border rounded-xl text-foreground text-xs font-bold press disabled:opacity-50"
                      >
                        {sendingRewardNotif === c.id
                          ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          : <Bell className="w-3.5 h-3.5 text-primary" />
                        }
                        Notify Progress
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create link */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Link className="w-4 h-4 text-primary" /> Create Referral Link</h3>
        <div className="flex gap-2">
          <input className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-primary" placeholder="Label (e.g. Instagram post, WhatsApp)" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <button onClick={createLink} disabled={saving} className="px-4 py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0">
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {/* Links list */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4">All Referral Links ({links.length})</h3>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : links.length === 0 ? (
          <div className="text-center py-8">
            <Link className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No referral links yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link: any) => (
              <div key={link.id} className="p-3 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{link.label}</p>
                      {(link.paying_referrals || 0) >= 10 && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold">⭐ QUALIFIES</span>
                      )}
                    </div>
                    {link.user_profiles && (
                      <p className="text-[10px] text-primary truncate">Owner: {link.user_profiles.username || link.user_profiles.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono truncate">{window.location.origin}?ref={link.code}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => copyLink(link.code)} className="p-1.5 rounded-lg bg-muted hover:bg-muted/80"><Copy className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => deleteLink(link.id)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center bg-blue-500/10 rounded-lg p-1.5">
                    <p className="text-sm font-black text-blue-400">{link.clicks}</p>
                    <p className="text-[10px] text-muted-foreground">Clicks</p>
                  </div>
                  <div className="text-center bg-green-500/10 rounded-lg p-1.5">
                    <p className="text-sm font-black text-green-400">{link.registrations}</p>
                    <p className="text-[10px] text-muted-foreground">Joined</p>
                  </div>
                  <div className="text-center bg-primary/10 rounded-lg p-1.5">
                    <p className="text-sm font-black text-primary">{link.payments}</p>
                    <p className="text-[10px] text-muted-foreground">Paid</p>
                  </div>
                  <div className="text-center bg-yellow-500/10 rounded-lg p-1.5">
                    <p className="text-sm font-black text-yellow-400">{link.paying_referrals || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Paying</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent events */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4">Recent Activity</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/20">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.event_type === 'click' ? 'bg-blue-400' : e.event_type === 'register' ? 'bg-green-400' : 'bg-primary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium capitalize">{e.event_type} — ref: {e.referral_code}</p>
                  {e.user_email && <p className="text-[10px] text-muted-foreground truncate">{e.user_email}</p>}
                </div>
                <p className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(e.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
