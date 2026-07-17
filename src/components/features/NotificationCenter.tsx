import { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '@/lib/notificationSound';
import { Bell, X, CheckCheck, TrendingUp, Crown, Info, Megaphone, Trash2, BookOpen, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Notification } from '@/types';

// ── Stable read tracking: store read IDs + last-seen timestamp in localStorage
const LS_READ_KEY = 'vaf_notif_read_ids';
const LS_CLEARED_KEY = 'vaf_notif_cleared_at'; // timestamp when user last cleared all

function getReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_READ_KEY) || '[]')); } catch { return new Set(); }
}
function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(LS_READ_KEY, JSON.stringify(Array.from(ids).slice(-1000))); } catch {}
}
function getClearedAt(): number {
  return parseInt(localStorage.getItem(LS_CLEARED_KEY) || '0', 10);
}
function saveClearedAt(ts: number) {
  localStorage.setItem(LS_CLEARED_KEY, String(ts));
}

// Exported so Header can call it to reset badge
export function markAllNotificationsReadLocally() {
  saveClearedAt(Date.now());
}

const typeIcons: Record<string, React.ElementType> = {
  signal: TrendingUp, vip: Crown, announcement: Megaphone,
  update: Info, general: Bell, course: BookOpen,
  message: MessageCircle, referral_reward: Crown,
};

const typeColors: Record<string, string> = {
  signal: 'text-green-400 bg-green-500/15', vip: 'text-primary bg-primary/15',
  announcement: 'text-yellow-400 bg-yellow-500/15', update: 'text-orange-400 bg-orange-500/15',
  general: 'text-blue-400 bg-blue-500/15', course: 'text-purple-400 bg-purple-500/15',
  message: 'text-cyan-400 bg-cyan-500/15', referral_reward: 'text-yellow-400 bg-yellow-500/15',
};

interface Props {
  onClose: () => void;
  /** called by parent to reset badge count after user opens panel */
  onBadgeReset?: () => void;
}

export default function NotificationCenter({ onClose, onBadgeReset }: Props) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // Track IDs we've locally deleted (so they don't reappear before DB confirm)
  const localDeletedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // When panel opens: mark cleared timestamp so badge resets
    saveClearedAt(Date.now());
    onBadgeReset?.();
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      // Filter out locally deleted ones
      const filtered = (data as Notification[]).filter(n => !localDeletedRef.current.has(n.id));
      setNotifications(filtered);
    }
    setLoading(false);
  }

  async function markAllRead() {
    if (!user) return;
    // Mark in DB
    await supabase.from('notifications').update({ is_read: true })
      .eq('target_user_id', user.id).eq('is_read', false);
    // Mark broadcast notifications read locally
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    // Save cleared timestamp
    saveClearedAt(Date.now());
  }

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    localDeletedRef.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }

  async function deleteAllRead() {
    if (!user) return;
    const readItems = notifications.filter(n => n.is_read);
    if (readItems.length === 0) return;
    readItems.forEach(n => localDeletedRef.current.add(n.id));
    setNotifications(prev => prev.filter(n => !n.is_read));
    const readIds = readItems.map(n => n.id);
    await supabase.from('notifications').delete().in('id', readIds);
    saveClearedAt(Date.now());
  }

  async function markRead(n: Notification) {
    if (n.is_read) return;
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    // Save read ID locally too
    const ids = getReadIds();
    ids.add(n.id);
    saveReadIds(ids);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col animate-fade-in"
      style={{ background: 'hsl(var(--background))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-black text-foreground text-lg">Notifications</h2>
          {unreadCount > 0 && (
            <span className="min-w-[22px] h-5 px-1 gradient-pink rounded-full flex items-center justify-center text-[10px] text-white font-black">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-muted rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all press">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button onClick={deleteAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 rounded-xl text-xs text-red-400 hover:bg-red-500/20 transition-all press">
              <Trash2 className="w-3.5 h-3.5" /> Clear read
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-xl bg-muted hover:bg-muted/80 press">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ paddingBottom: 'max(80px, env(safe-area-inset-bottom))' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-foreground font-bold mb-1">No notifications yet</p>
            <p className="text-xs text-muted-foreground">You'll receive signals, VIP updates, and announcements here</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            const colorClass = typeColors[n.type] || 'text-blue-400 bg-blue-500/15';
            return (
              <div key={n.id} onClick={() => markRead(n)}
                className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  n.is_read ? 'bg-card border-border/50 opacity-80' : 'bg-primary/5 border-primary/25 shadow-sm'
                }`}>
                <div className={`w-9 h-9 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight mb-0.5 text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />}
                  <button onClick={e => deleteNotification(n.id, e)}
                    className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-red-500/20 flex items-center justify-center transition-all press">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Export utility for Header badge count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const clearedAt = getClearedAt();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .or(`target_user_id.eq.${userId},target_user_id.is.null`)
    .gt('created_at', new Date(clearedAt).toISOString());
  return count || 0;
}
