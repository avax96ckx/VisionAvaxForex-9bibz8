import { useState, useEffect } from 'react';
import { Video, UserCheck, UserX, Crown, Search, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { toast } from 'sonner';

export default function AdminMeetingPermissions() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [permittedIds, setPermittedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [usersRes, permsRes] = await Promise.all([
      supabase.from('user_profiles').select('id,username,email,avatar_url,is_vip,blue_tick').order('username'),
      supabase.from('meeting_permissions').select('user_id'),
    ]);
    if (usersRes.data) setUsers(usersRes.data as UserProfile[]);
    if (permsRes.data) setPermittedIds(new Set(permsRes.data.map((p: any) => p.user_id)));
    setLoading(false);
  }

  async function grantPermission(userId: string) {
    setSaving(userId);
    const { error } = await supabase.from('meeting_permissions').upsert({ user_id: userId }, { onConflict: 'user_id' });
    if (error) toast.error('Failed to grant permission');
    else {
      setPermittedIds(prev => new Set([...prev, userId]));
      toast.success('Meeting permission granted!');
    }
    setSaving(null);
  }

  async function revokePermission(userId: string) {
    setSaving(userId);
    const { error } = await supabase.from('meeting_permissions').delete().eq('user_id', userId);
    if (error) toast.error('Failed to revoke permission');
    else {
      setPermittedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      toast.success('Meeting permission revoked');
    }
    setSaving(null);
  }

  const filtered = users.filter(u =>
    !search || (u.username || u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const permitted = filtered.filter(u => permittedIds.has(u.id));
  const notPermitted = filtered.filter(u => !permittedIds.has(u.id));

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-foreground text-sm">Meeting Permissions</p>
            <p className="text-xs text-muted-foreground">Control who can start meetings in VIP Room</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Members with permission will see the <strong className="text-foreground">Meeting</strong> option when they tap the WhatsApp icon in the VIP Room. Without permission, only the WhatsApp option is shown.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 bg-card rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-primary">{permittedIds.size}</p>
            <p className="text-[10px] text-muted-foreground">Can Start Meetings</p>
          </div>
          <div className="flex-1 bg-card rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-foreground">{users.length - permittedIds.size}</p>
            <p className="text-[10px] text-muted-foreground">No Permission</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {/* Permitted users */}
          {permitted.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-green-500/5 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-green-400" />
                <p className="text-sm font-bold text-foreground">Can Start Meetings ({permitted.length})</p>
              </div>
              <div className="divide-y divide-border/50">
                {permitted.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(u.username || '?')[0].toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{u.username || u.email}</p>
                      <div className="flex items-center gap-1">
                        {u.is_vip && <span className="text-[10px] text-primary font-bold">VIP</span>}
                        {u.blue_tick && <span className="text-[10px] text-blue-400 font-bold">✓</span>}
                      </div>
                    </div>
                    <button onClick={() => revokePermission(u.id)} disabled={saving === u.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-bold press disabled:opacity-50">
                      {saving === u.id ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not permitted */}
          {notPermitted.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <UserX className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">No Meeting Permission ({notPermitted.length})</p>
              </div>
              <div className="divide-y divide-border/50">
                {notPermitted.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(u.username || '?')[0].toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{u.username || u.email}</p>
                      <div className="flex items-center gap-1">
                        {u.is_vip && <span className="text-[10px] text-primary font-bold">VIP</span>}
                      </div>
                    </div>
                    <button onClick={() => grantPermission(u.id)} disabled={saving === u.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50 pink-glow-xs">
                      {saving === u.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Grant
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No members found</p>
          )}
        </div>
      )}
    </div>
  );
}
