import { useState, useEffect } from 'react';
import { Bell, Send, Trash2, Plus, Users, Clock, CheckCircle2, Timer, Crown, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Notification, UserProfile } from '@/types';
import { toast } from 'sonner';

interface QueuedNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  target: string;
  target_user_id: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
}

function Countdown({ scheduledAt }: { scheduledAt: string }) {
  const [diff, setDiff] = useState('');
  useEffect(() => {
    const update = () => {
      const ms = new Date(scheduledAt).getTime() - Date.now();
      if (ms <= 0) { setDiff('Sending...'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setDiff(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [scheduledAt]);
  return <span className="text-[10px] text-orange-400 font-bold">{diff}</span>;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'scheduled'>('history');
  const [form, setForm] = useState({
    title: '', body: '', type: 'general', target: 'all', targetUserId: '',
    isScheduled: false, scheduledAt: '',
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vipCount, setVipCount] = useState(0);
  const [checkingExpiry, setCheckingExpiry] = useState(false);
  const [expiringCount, setExpiringCount] = useState(0);
  const [lastStats, setLastStats] = useState<{ title: string; total: number; breakdown: { label: string; count: number; color: string }[]; sentAt: string } | null>(null);

  useEffect(() => {
    fetchAll();
    supabase.from('user_profiles').select('id,username,email,avatar_url,is_vip').then(({ data }) => {
      if (data) {
        setUsers(data as unknown as UserProfile[]);
        setVipCount(data.filter((u: any) => u.is_vip).length);
      }
    });
    processScheduledQueue();
    checkExpiringVIP();
    const interval = setInterval(processScheduledQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkExpiringVIP() {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, email, vip_expires_at')
      .eq('is_vip', true)
      .lte('vip_expires_at', threeDaysFromNow)
      .gte('vip_expires_at', now);
    setExpiringCount(data?.length || 0);
    return data || [];
  }

  async function sendExpiryReminders() {
    setCheckingExpiry(true);
    const expiringUsers = await checkExpiringVIP();
    if (expiringUsers.length === 0) {
      toast.info('No VIP members expiring in the next 3 days');
      setCheckingExpiry(false);
      return;
    }
    await Promise.all(expiringUsers.map(async (u: any) => {
      const daysLeft = Math.ceil((new Date(u.vip_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const title = '⚠️ VIP Membership Expiring Soon';
      const body = `Hi ${u.username || 'Member'}, your VIP membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now to keep access to premium signals & VIP Room!`;
      return supabase.from('notifications').insert({ title, body, type: 'vip', target_user_id: u.id });
    }));
    toast.success(`Expiry reminders sent to ${expiringUsers.length} VIP member${expiringUsers.length !== 1 ? 's' : ''}!`);
    fetchAll();
    setCheckingExpiry(false);
  }

  async function fetchAll() {
    setLoading(true);
    const [notifRes, queueRes] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('notifications_queue').select('*').order('created_at', { ascending: false }),
    ]);
    if (notifRes.data) setNotifications(notifRes.data as Notification[]);
    if (queueRes.data) setQueue(queueRes.data as QueuedNotification[]);
    setLoading(false);
  }

  async function processScheduledQueue() {
    const now = new Date().toISOString();
    const { data: pending } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now);
    if (!pending || pending.length === 0) return;

    for (const item of pending) {
      if (item.target === 'all') {
        await supabase.from('notifications').insert({ title: item.title, body: item.body, type: item.type, target_user_id: null });
      } else if (item.target === 'vip') {
        const { data: vipUsers } = await supabase.from('user_profiles').select('id').eq('is_vip', true);
        if (vipUsers) {
          await Promise.all(vipUsers.map(u =>
            supabase.from('notifications').insert({ title: item.title, body: item.body, type: item.type, target_user_id: u.id })
          ));
        }
      } else if (item.target === 'free') {
        const { data: freeUsers } = await supabase.from('user_profiles').select('id').eq('is_vip', false);
        if (freeUsers) {
          await Promise.all(freeUsers.map(u =>
            supabase.from('notifications').insert({ title: item.title, body: item.body, type: item.type, target_user_id: u.id })
          ));
        }
      } else if (item.target === 'user' && item.target_user_id) {
        await supabase.from('notifications').insert({ title: item.title, body: item.body, type: item.type, target_user_id: item.target_user_id });
      }
      await supabase.from('notifications_queue').update({ status: 'sent' }).eq('id', item.id);
    }
    if (pending.length > 0) fetchAll();
  }

  // ── ONE-CLICK BULK SEND TO ALL VIP ──
  async function bulkSendToVIP() {
    if (!confirm(`Send a bulk VIP notification to all ${vipCount} VIP members now?`)) return;
    setBulkSending(true);
    const { data: vipUsers } = await supabase.from('user_profiles').select('id').eq('is_vip', true);
    if (!vipUsers || vipUsers.length === 0) {
      toast.error('No VIP users found');
      setBulkSending(false);
      return;
    }
    const title = '👑 VIP Exclusive Alert';
    const body = 'New premium content is available for VIP members. Check your dashboard now!';
    await Promise.all(vipUsers.map(u =>
      supabase.from('notifications').insert({ title, body, type: 'vip', target_user_id: u.id })
    ));
    toast.success(`Bulk VIP notification sent to ${vipUsers.length} members!`);
    fetchAll();
    setBulkSending(false);
  }

  async function sendNotification() {
    if (!form.title || !form.body) return toast.error('Fill title and message');
    setSending(true);
    let totalSent = 0;
    let vipSent = 0;
    let freeSent = 0;

    if (form.isScheduled && form.scheduledAt) {
      await supabase.from('notifications_queue').insert({
        title: form.title, body: form.body, type: form.type,
        target: form.target,
        target_user_id: form.target === 'user' ? form.targetUserId || null : null,
        scheduled_at: new Date(form.scheduledAt).toISOString(),
        status: 'pending',
      });
      toast.success(`Notification scheduled for ${new Date(form.scheduledAt).toLocaleString()}!`);
    } else {
      if (form.target === 'all') {
        await supabase.from('notifications').insert({ title: form.title, body: form.body, type: form.type, target_user_id: null });
        totalSent = 1;
        toast.success('Notification sent to all members!');
      } else if (form.target === 'vip') {
        const { data: vipUsers } = await supabase.from('user_profiles').select('id').eq('is_vip', true);
        if (vipUsers) {
          await Promise.all(vipUsers.map(u =>
            supabase.from('notifications').insert({ title: form.title, body: form.body, type: form.type, target_user_id: u.id })
          ));
          totalSent = vipUsers.length;
          vipSent = vipUsers.length;
          toast.success(`Sent to ${vipUsers.length} VIP members!`);
        }
      } else if (form.target === 'free') {
        const { data: freeUsers } = await supabase.from('user_profiles').select('id').eq('is_vip', false);
        if (freeUsers) {
          await Promise.all(freeUsers.map(u =>
            supabase.from('notifications').insert({ title: form.title, body: form.body, type: form.type, target_user_id: u.id })
          ));
          totalSent = freeUsers.length;
          freeSent = freeUsers.length;
          toast.success(`Sent to ${freeUsers.length} free members!`);
        }
      } else if (form.target === 'user' && form.targetUserId) {
        await supabase.from('notifications').insert({ title: form.title, body: form.body, type: form.type, target_user_id: form.targetUserId });
        totalSent = 1;
        toast.success('Notification sent to user!');
      }

      // Show delivery stats
      const breakdown = [];
      if (form.target === 'all') breakdown.push({ label: 'Broadcast (All)', count: users.length, color: 'text-blue-400' });
      if (vipSent > 0) breakdown.push({ label: 'VIP Members', count: vipSent, color: 'text-primary' });
      if (freeSent > 0) breakdown.push({ label: 'Free Members', count: freeSent, color: 'text-green-400' });
      if (form.target === 'user') breakdown.push({ label: 'Specific User', count: 1, color: 'text-purple-400' });
      setLastStats({
        title: form.title,
        total: totalSent || users.length,
        breakdown,
        sentAt: new Date().toLocaleString(),
      });
    }

    setShowForm(false);
    setForm({ title: '', body: '', type: 'general', target: 'all', targetUserId: '', isScheduled: false, scheduledAt: '' });
    fetchAll();
    setSending(false);
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    fetchAll();
    toast.success('Deleted');
  }

  async function deleteQueued(id: string) {
    await supabase.from('notifications_queue').delete().eq('id', id);
    fetchAll();
    toast.success('Scheduled notification cancelled');
  }

  const typeColors: Record<string, string> = {
    general: 'bg-blue-500/15 text-blue-400',
    signal: 'bg-green-500/15 text-green-400',
    vip: 'bg-primary/15 text-primary',
    update: 'bg-orange-500/15 text-orange-400',
    announcement: 'bg-yellow-500/15 text-yellow-400',
  };

  const pendingQueue = queue.filter(q => q.status === 'pending');
  const sentQueue = queue.filter(q => q.status === 'sent');
  const nowLocal = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Sent', value: notifications.length, icon: Bell, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Scheduled', value: pendingQueue.length, icon: Timer, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Broadcast', value: notifications.filter(n => !n.target_user_id).length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className={`text-sm font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ── VIP EXPIRY REMINDERS ── */}
      <div className="bg-gradient-to-r from-orange-500/10 to-orange-500/5 border border-orange-500/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-foreground text-sm">VIP Expiry Reminders</p>
            <p className="text-xs text-muted-foreground">Auto-notify members expiring in ≤3 days</p>
          </div>
          {expiringCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-bold flex-shrink-0">{expiringCount} expiring</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Sends a personalized reminder to each VIP member whose membership expires within 3 days, urging them to renew.
        </p>
        <button
          onClick={sendExpiryReminders}
          disabled={checkingExpiry}
          className="w-full py-3 bg-orange-500 hover:bg-orange-500/90 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press disabled:opacity-50"
        >
          {checkingExpiry
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking & Sending...</>
            : <><Bell className="w-4 h-4" /> Send Expiry Reminders{expiringCount > 0 ? ` (${expiringCount})` : ''}</>
          }
        </button>
      </div>

      {/* ── ONE-CLICK BULK VIP SEND ── */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0 pink-glow-xs">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-black text-foreground text-sm">Bulk VIP Notification</p>
            <p className="text-xs text-muted-foreground">{vipCount} active VIP members will receive it</p>
          </div>
          <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full font-bold flex-shrink-0">{vipCount} VIPs</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Sends a pre-built "VIP Exclusive Alert" notification to every active VIP member in one click.
        </p>
        <button
          onClick={bulkSendToVIP}
          disabled={bulkSending || vipCount === 0}
          className="w-full py-3 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press pink-glow-xs disabled:opacity-50"
        >
          {bulkSending
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending to {vipCount} VIPs...</>
            : <><Zap className="w-4 h-4" /> Send to All {vipCount} VIP Members</>
          }
        </button>
      </div>

      {/* ── DELIVERY STATS CARD ── */}
      {lastStats && (
        <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/25 rounded-2xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="font-black text-foreground text-sm">Delivery Stats</p>
            </div>
            <button onClick={() => setLastStats(null)} className="p-1 rounded-lg hover:bg-muted press"><span className="text-xs text-muted-foreground">✕</span></button>
          </div>
          <p className="text-xs text-muted-foreground truncate mb-3">"{lastStats.title}" · {lastStats.sentAt}</p>
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-2xl font-black text-green-400">{lastStats.total.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total delivered</p>
            </div>
          </div>
          {lastStats.breakdown.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {lastStats.breakdown.map(b => (
                <div key={b.label} className="bg-card/50 rounded-xl p-2 text-center">
                  <p className={`text-base font-black ${b.color}`}>{b.count.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">{b.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send Notification Form */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notifications
          </h3>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press pink-glow-xs">
            <Plus className="w-3.5 h-3.5" /> Send / Schedule
          </button>
        </div>

        {showForm && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-xl mb-4 animate-slide-up">
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
              placeholder="Notification title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
              placeholder="Notification message..." rows={3} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
                  value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="signal">Signal</option>
                  <option value="vip">VIP</option>
                  <option value="update">Update</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Target</label>
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
                  value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))}>
                  <option value="all">All Members</option>
                  <option value="vip">VIP Only</option>
                  <option value="free">Free Members Only</option>
                  <option value="user">Specific User</option>
                </select>
              </div>
            </div>
            {form.target === 'user' && (
              <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
                value={form.targetUserId} onChange={e => setForm(p => ({ ...p, targetUserId: e.target.value }))}>
                <option value="">Select user...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username || u.email}</option>)}
              </select>
            )}

            {/* Schedule toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-bold text-foreground">Schedule for Later</p>
                  <p className="text-xs text-muted-foreground">Set a future date/time</p>
                </div>
              </div>
              <button onClick={() => setForm(p => ({ ...p, isScheduled: !p.isScheduled }))}
                className={`w-10 h-5 rounded-full transition-all relative ${form.isScheduled ? 'bg-primary' : 'bg-muted border border-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${form.isScheduled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {form.isScheduled && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Send At (Date & Time)</label>
                <input
                  type="datetime-local"
                  min={nowLocal}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
                  value={form.scheduledAt}
                  onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                />
              </div>
            )}

            <button onClick={sendNotification} disabled={sending || (form.isScheduled && !form.scheduledAt)}
              className="w-full py-3 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press">
              {form.isScheduled ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {sending ? 'Processing...' : form.isScheduled ? 'Schedule Notification' : 'Send Now'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'history', label: 'History' },
            { key: 'scheduled', label: `Scheduled (${pendingQueue.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all press ${activeTab === key ? 'gradient-pink text-white' : 'bg-muted text-muted-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'history' && (
          loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No notifications sent yet</p>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-3 p-3 bg-muted/20 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-bold text-foreground text-xs">{n.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${typeColors[n.type] || 'bg-muted text-muted-foreground'}`}>{n.type.toUpperCase()}</span>
                      {!n.target_user_id && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded font-bold">ALL</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => deleteNotification(n.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all press flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'scheduled' && (
          pendingQueue.length === 0 ? (
            <div className="text-center py-8">
              <Timer className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No scheduled notifications</p>
              <p className="text-xs text-muted-foreground">Use "Schedule for Later" when creating a notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingQueue.map(q => (
                <div key={q.id} className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <div className="flex items-start gap-2 mb-2">
                    <Timer className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-xs">{q.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{q.body}</p>
                    </div>
                    <button onClick={() => deleteQueued(q.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 press flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      {q.scheduled_at ? new Date(q.scheduled_at).toLocaleString() : 'Pending'}
                    </p>
                    <div className="flex items-center gap-1">
                      {q.scheduled_at && <Countdown scheduledAt={q.scheduled_at} />}
                    </div>
                  </div>
                </div>
              ))}
              {sentQueue.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2 font-bold uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-400" /> Sent from Queue ({sentQueue.length})
                  </p>
                  {sentQueue.slice(0, 5).map(q => (
                    <div key={q.id} className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground text-xs">{q.title}</p>
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-bold">SENT</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{q.scheduled_at ? new Date(q.scheduled_at).toLocaleString() : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
