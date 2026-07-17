import { useState, useEffect } from 'react';
import { Users, Search, CheckCircle, XCircle, Crown, Trash2, Volume2, VolumeX, Calendar, X, Clock, Wifi } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import VIPBadge from '@/components/features/VIPBadge';
import { toast } from 'sonner';

// ── VIP Expiry Date Picker Modal ──
function VIPExpiryModal({ user, onClose, onSaved }: {
  user: UserProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at).toISOString().slice(0, 16) : '';
  const [expiryDate, setExpiryDate] = useState(currentExpiry);
  const [saving, setSaving] = useState(false);

  // Quick presets: add N days from NOW
  function addDays(days: number) {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setExpiryDate(d.toISOString().slice(0, 16));
  }

  // Quick presets: add N days from current expiry (extend)
  function extendFromCurrent(days: number) {
    const base = user.vip_expires_at ? new Date(user.vip_expires_at) : new Date();
    const d = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    setExpiryDate(d.toISOString().slice(0, 16));
  }

  async function save() {
    if (!expiryDate) return toast.error('Please select an expiry date');
    setSaving(true);
    const isoDate = new Date(expiryDate).toISOString();
    const isExpired = new Date(isoDate) < new Date();
    const { error } = await supabase.from('user_profiles').update({
      vip_expires_at: isoDate,
      is_vip: !isExpired,
      blue_tick: !isExpired ? (user.blue_tick || true) : user.blue_tick,
    } as any).eq('id', user.id);
    if (error) {
      toast.error('Failed to update: ' + error.message);
    } else {
      toast.success(`VIP expiry set to ${new Date(isoDate).toLocaleDateString()}${isExpired ? ' (expired — VIP removed)' : ''}`);
      onSaved();
      onClose();
    }
    setSaving(false);
  }

  const minDate = new Date().toISOString().slice(0, 16);
  const currentExpiryDate = user.vip_expires_at ? new Date(user.vip_expires_at) : null;
  const isCurrentlyExpired = currentExpiryDate ? currentExpiryDate < new Date() : true;
  const daysLeft = currentExpiryDate ? Math.ceil((currentExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="fixed inset-0 z-[500] bg-black/70 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-3xl p-5 animate-slide-up"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <h3 className="font-black text-foreground">VIP Expiry Date</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl mb-4">
          <div className="w-9 h-9 rounded-full gradient-pink flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(user.username || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{user.username || 'No username'}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {user.is_vip && !isCurrentlyExpired ? (
              <p className="text-xs font-bold text-primary">{daysLeft > 0 ? `${daysLeft}d left` : 'Expiring'}</p>
            ) : (
              <p className="text-xs font-bold text-muted-foreground">No VIP</p>
            )}
            {currentExpiryDate && (
              <p className="text-[10px] text-muted-foreground">
                {isCurrentlyExpired ? '⚠️ Expired' : currentExpiryDate.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Date/Time picker */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Set New Expiry Date & Time
          </label>
          <input
            type="datetime-local"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
          />
        </div>

        {/* Quick presets */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">Quick Set (from now)</p>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {[
              { label: '1 Day', days: 1 },
              { label: '7 Days', days: 7 },
              { label: '30 Days', days: 30 },
              { label: '90 Days', days: 90 },
            ].map(({ label, days }) => (
              <button
                key={days}
                onClick={() => addDays(days)}
                className="py-2 bg-muted border border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary press transition-all"
              >
                {label}
              </button>
            ))}
          </div>
          {user.vip_expires_at && !isCurrentlyExpired && (
            <>
              <p className="text-xs text-muted-foreground font-medium mb-2">Extend from current expiry</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '+7d', days: 7 },
                  { label: '+30d', days: 30 },
                  { label: '+90d', days: 90 },
                  { label: '+1yr', days: 365 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => extendFromCurrent(days)}
                    className="py-2 bg-primary/10 border border-primary/25 rounded-xl text-xs font-bold text-primary hover:bg-primary/20 press transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving || !expiryDate}
          className="w-full py-3 gradient-pink rounded-xl text-white font-bold press pink-glow-xs disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
            : <><Calendar className="w-4 h-4" /> Save VIP Expiry Date</>
          }
        </button>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vipExpiryUser, setVipExpiryUser] = useState<UserProfile | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'online' | 'vip' | 'banned'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('joined_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function toggleVIP(user: UserProfile) {
    const expires = user.is_vip ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('user_profiles').update({
      is_vip: !user.is_vip,
      vip_expires_at: expires,
      blue_tick: !user.is_vip,
      badge_style: !user.is_vip ? 'blue_burst' : (user as any).badge_style
    } as any).eq('id', user.id);
    toast.success(`VIP ${user.is_vip ? 'removed' : 'activated (30 days)'}`);
    fetchUsers();
  }

  async function toggleBlueTick(user: UserProfile) {
    await supabase.from('user_profiles').update({ blue_tick: !user.blue_tick }).eq('id', user.id);
    toast.success(`Blue tick ${user.blue_tick ? 'removed' : 'added'}`);
    fetchUsers();
  }

  async function toggleBan(user: UserProfile) {
    await supabase.from('user_profiles').update({ is_banned: !user.is_banned }).eq('id', user.id);
    toast.success(`User ${user.is_banned ? 'unbanned' : 'banned'}`);
    fetchUsers();
  }

  async function toggleMute(user: UserProfile) {
    await supabase.from('user_profiles').update({ is_muted: !user.is_muted }).eq('id', user.id);
    toast.success(`User ${user.is_muted ? 'unmuted' : 'muted'}`);
    fetchUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await supabase.from('user_profiles').delete().eq('id', id);
    toast.success('User deleted');
    fetchUsers();
  }

  const filterByTab = (list: UserProfile[]) => {
    switch (filterTab) {
      case 'online': return list.filter(u => u.is_online);
      case 'vip': return list.filter(u => u.is_vip);
      case 'banned': return list.filter(u => u.is_banned);
      default: return list;
    }
  };

  const filtered = filterByTab(users).filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  function getVIPStatus(u: UserProfile) {
    if (!u.is_vip) return null;
    if (!u.vip_expires_at) return { label: 'VIP', color: 'text-primary', bg: 'bg-primary/20' };
    const exp = new Date(u.vip_expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (exp < now) return { label: 'Expired', color: 'text-red-400', bg: 'bg-red-500/15' };
    if (daysLeft <= 3) return { label: `${daysLeft}d left`, color: 'text-orange-400', bg: 'bg-orange-500/15' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
    return { label: `${daysLeft}d left`, color: 'text-primary', bg: 'bg-primary/15' };
  }

  return (
    <>
      {vipExpiryUser && (
        <VIPExpiryModal
          user={vipExpiryUser}
          onClose={() => setVipExpiryUser(null)}
          onSaved={fetchUsers}
        />
      )}

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> All Users ({users.length})
            </h3>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2 text-white text-sm outline-none focus:border-primary"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-0.5">
            {[
              { key: 'all', label: `All (${users.length})`, icon: Users },
              { key: 'online', label: `Online (${users.filter(u => u.is_online).length})`, icon: Wifi },
              { key: 'vip', label: `VIP (${users.filter(u => u.is_vip).length})`, icon: Crown },
              { key: 'banned', label: `Banned (${users.filter(u => u.is_banned).length})`, icon: XCircle },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key as any)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all press ${
                  filterTab === key
                    ? 'gradient-pink text-white'
                    : 'bg-muted border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-muted/50 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-white">{users.length}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-primary">{users.filter(u => u.is_vip).length}</p>
              <p className="text-[10px] text-muted-foreground">VIP</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-red-400">{users.filter(u => u.is_banned).length}</p>
              <p className="text-[10px] text-muted-foreground">Banned</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(u => {
                const vipStatus = getVIPStatus(u);
                return (
                  <div key={u.id} className={`p-3 rounded-xl border ${u.is_banned ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/20'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full gradient-pink flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (u.username || u.email || '?')[0].toUpperCase()
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white truncate">{u.username || 'No username'}</p>
                          {u.blue_tick && (
                            <VIPBadge size="xs" badgeStyle={((u as any).badge_style as import('@/types').BadgeStyle) || 'blue_burst'} />
                          )}
                          {u.is_vip && <Crown className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        {/* VIP expiry info */}
                        {u.vip_expires_at && (
                          <p className={`text-[10px] mt-0.5 font-medium ${vipStatus?.color || 'text-muted-foreground'}`}>
                            Expires: {new Date(u.vip_expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {u.is_banned ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-bold">BANNED</span>
                        ) : vipStatus ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${vipStatus.bg} ${vipStatus.color}`}>
                            {vipStatus.label}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => toggleVIP(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all press ${u.is_vip ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-white'}`}
                      >
                        <Crown className="w-3 h-3" />{u.is_vip ? 'Remove VIP' : 'Give VIP'}
                      </button>

                      {/* VIP Date Picker button */}
                      <button
                        onClick={() => setVipExpiryUser(u)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all press"
                        title="Set VIP expiry date"
                      >
                        <Calendar className="w-3 h-3" /> Set Expiry
                      </button>

                      <button
                        onClick={() => toggleBlueTick(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 press ${u.blue_tick ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground hover:text-white'}`}
                      >
                        <CheckCircle className="w-3 h-3" />{u.blue_tick ? 'Remove ✓' : 'Add ✓'}
                      </button>
                      <button
                        onClick={() => toggleMute(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 press ${u.is_muted ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground hover:text-white'}`}
                      >
                        {u.is_muted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                        {u.is_muted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={() => toggleBan(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 press ${u.is_banned ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        <XCircle className="w-3 h-3" />{u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-400 flex items-center gap-1 hover:bg-red-500/20 press"
                      >
                        <Trash2 className="w-3 h-3" />Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
