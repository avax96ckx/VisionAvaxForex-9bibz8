import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Bell, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationCenter from '@/components/features/NotificationCenter';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import VIPBadge from '@/components/features/VIPBadge';
import type { BadgeStyle } from '@/types';
import { isVIPActive, supabase } from '@/lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '@/lib/notificationSound';
import { requestBrowserNotificationPermission, notifyGeneral, notifyDirectMessage } from '@/lib/browserNotifications';

// ── Persist read DM conversations so badge doesn't bounce back ──
const LS_DM_READ_KEY = 'vaf_dm_read_conv_map';
function getDMReadMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_DM_READ_KEY) || '{}'); } catch { return {}; }
}
function setDMReadMap(map: Record<string, number>) {
  try { localStorage.setItem(LS_DM_READ_KEY, JSON.stringify(map)); } catch {}
}
export function markConversationRead(convId: string) {
  const map = getDMReadMap();
  map[convId] = Date.now();
  setDMReadMap(map);
}

// ── Notification badge: persist "cleared at" timestamp so it stays 0 after viewing ──
const LS_NOTIF_CLEARED = 'vaf_notif_cleared_at';
function getNotifClearedAt(): number {
  return parseInt(localStorage.getItem(LS_NOTIF_CLEARED) || '0', 10);
}

export default function Header() {
  const { user, profile, isAdmin, theme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [headerConfig, setHeaderConfig] = useState<any>({
    logoFontSize: '13',
    logoFontStyle: 'gradient',
    logoPosition: 'center',
    showMessengerIcon: true,
    showBellIcon: true,
    memberNameSize: 'sm',
    badgeSpacing: 'normal',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [siteName, setSiteName] = useState('VISION AVAX FOREX');
  const prevCount = useRef(0);
  const prevDMs = useRef(0);
  const prevNotifDataRef = useRef<{id:string;title:string;body:string}[]>([]);
  const prevDMSendersRef = useRef<Record<string,string>>({});
  // Track whether notification panel is currently open
  const notifOpenRef = useRef(false);

  useEffect(() => {
    supabase.from('site_settings').select('show_header,header_config,logo_url,website_name').eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setShowHeader((data as any).show_header !== false);
          if ((data as any).header_config) {
            setHeaderConfig((prev: any) => ({ ...prev, ...(data as any).header_config }));
          }
          if ((data as any).logo_url) setLogoUrl((data as any).logo_url);
          if ((data as any).website_name) setSiteName((data as any).website_name);
        }
      });
  }, []);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (user) {
      requestBrowserNotificationPermission();
    }
  }, [user]);

  // Online members count
  useEffect(() => {
    const fetchOnline = async () => {
      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_online', true);
      setOnlineCount(count || 0);
    };
    fetchOnline();
    const iv = setInterval(fetchOnline, 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Notification badge: only count notifications created AFTER last cleared ──
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      // If notification panel is open, always show 0
      if (notifOpenRef.current) { setUnreadCount(0); return; }

      const clearedAt = getNotifClearedAt();
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
        .gt('created_at', new Date(clearedAt).toISOString());

      const n = count || 0;
      // Play sound + browser notification when new notifications arrive
      if (n > prevCount.current && prevCount.current >= 0 && !notifOpenRef.current) {
        playNotificationSound();
        // Fetch the new notifications to show browser popup
        const { data: newNotifs } = await supabase
          .from('notifications')
          .select('id,title,body,type')
          .eq('is_read', false)
          .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
          .gt('created_at', new Date(getNotifClearedAt()).toISOString())
          .order('created_at', { ascending: false })
          .limit(3);
        if (newNotifs) {
          const knownIds = new Set(prevNotifDataRef.current.map(x => x.id));
          newNotifs.filter(nn => !knownIds.has(nn.id)).forEach(nn => {
            notifyGeneral(nn.title, nn.body, nn.type || 'general');
          });
          prevNotifDataRef.current = newNotifs;
        }
      }
      prevCount.current = n;
      setUnreadCount(n);
    };
    check();
    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // DM badge
  useEffect(() => {
    if (!user) return;
    const checkDMs = async () => {
      if (location.pathname === '/messenger') {
        setUnreadDMs(0);
        prevDMs.current = 0;
        return;
      }
      const { data: convs } = await supabase
        .from('conversations').select('id,last_message_at')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);
      if (!convs) return;

      const readMap = getDMReadMap();
      let total = 0;

      await Promise.all(convs.map(async (c) => {
        const lastRead = readMap[c.id] || 0;
        const lastMsgAt = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
        if (lastRead >= lastMsgAt) return;

        const { count } = await supabase.from('direct_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', user.id)
          .eq('is_read', false)
          .eq('is_deleted', false);
        if ((count || 0) > 0) total += count || 0;
      }));

      if (total > prevDMs.current && prevDMs.current >= 0) {
        playNotificationSound();
        // Browser notification for new DM
        // Find conversations with new messages to show sender name
        for (const c of convs) {
          const lastRead = readMap[c.id] || 0;
          const lastMsgAt = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
          if (lastRead >= lastMsgAt) continue;
          const { data: latestMsg } = await supabase
            .from('direct_messages')
            .select('message, media_type, sender_id, user_profiles(username)')
            .eq('conversation_id', c.id)
            .neq('sender_id', user.id)
            .eq('is_read', false)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (latestMsg) {
            const senderName = (latestMsg as any).user_profiles?.username || 'Member';
            const preview = latestMsg.message || (latestMsg.media_type === 'audio' ? '🎤 Voice note' : '📎 Media');
            notifyDirectMessage(senderName, preview);
          }
        }
      }
      prevDMs.current = total;
      setUnreadDMs(total);
    };
    checkDMs();
    const interval = setInterval(checkDMs, 20000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // Mark all DMs read when navigating to messenger
  useEffect(() => {
    if (location.pathname === '/messenger' && user) {
      setUnreadDMs(0);
      prevDMs.current = 0;
      supabase.from('conversations')
        .select('id,last_message_at')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .then(({ data }) => {
          if (!data) return;
          const map = getDMReadMap();
          const nowTs = Date.now() + 5000;
          data.forEach(c => { map[c.id] = nowTs; });
          setDMReadMap(map);
        });
    }
  }, [location.pathname, user]);

  function handleOpenNotifications() {
    notifOpenRef.current = true;
    setUnreadCount(0);
    prevCount.current = 0;
    // Save cleared timestamp so next poll starts from now
    localStorage.setItem(LS_NOTIF_CLEARED, String(Date.now()));
    setShowNotifications(true);
  }

  function handleCloseNotifications() {
    notifOpenRef.current = false;
    setShowNotifications(false);
    setUnreadCount(0);
    prevCount.current = 0;
    // Refresh cleared timestamp on close too
    localStorage.setItem(LS_NOTIF_CLEARED, String(Date.now()));
  }

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);
  const hasBlueTick = isAdmin || profile?.blue_tick || hasVIP;
  const displayName = profile?.full_name || profile?.username || user?.username || '';

  if (
    location.pathname === '/vip' ||
    location.pathname === '/messenger' ||
    location.pathname.startsWith('/courses/') ||
    location.pathname.startsWith('/profile/') ||
    !showHeader
  ) return null;

  const headerBg = theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(8,9,14,0.97)';
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: headerBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${borderColor}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center px-3 h-14 max-w-lg mx-auto gap-2">

          {/* LEFT: Bell */}
          {user && headerConfig.showBellIcon !== false && (
            <button
              onClick={handleOpenNotifications}
              className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center press"
            >
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-0 right-0 min-w-[18px] h-[18px] gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center px-1 pink-glow-xs"
                  style={{ transform: 'translate(25%, -25%)' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}
          {!user && (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-muted/70 border border-border rounded-xl text-foreground text-xs font-bold press flex-shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span>LOGIN</span>
            </button>
          )}

          {/* CENTER: Brand name + optional logo image */}
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-2 min-w-0 press"
          >

            {/* Brand name — styled exactly like image */}
            <span
              className="font-black tracking-tight leading-none whitespace-nowrap"
              style={{
                fontSize: `${headerConfig.logoFontSize || 13}px`,
                ...(headerConfig.logoFontStyle === 'gradient' ? {
                  background: `linear-gradient(90deg, #ffffff 0%, #ffffff 25%, hsl(var(--primary) / 0.85) 55%, hsl(var(--primary)) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 6px hsl(var(--primary) / 0.3))`,
                } : headerConfig.logoFontStyle === 'solid_pink' ? {
                  color: 'hsl(var(--primary))',
                } : headerConfig.logoFontStyle === 'white' ? {
                  color: '#ffffff',
                } : headerConfig.logoFontStyle === 'gold' ? {
                  background: 'linear-gradient(90deg, #f5d020 0%, #f6d365 50%, #fda085 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                } : headerConfig.logoFontStyle === 'neon' ? {
                  background: 'linear-gradient(90deg, #00f5d4 0%, #00bbf9 50%, #f15bb5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 8px rgba(0,245,212,0.5))',
                } : headerConfig.logoFontStyle === 'telegram_blue' ? {
                  background: 'linear-gradient(90deg, #2AABEE 0%, #229ED9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                } : headerConfig.logoFontStyle === 'rainbow' ? {
                  background: 'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                } : headerConfig.logoFontStyle === 'fire' ? {
                  background: 'linear-gradient(90deg, #f12711 0%, #f5af19 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                } : {
                  background: `linear-gradient(90deg, #ffffff 0%, #ffffff 25%, hsl(var(--primary) / 0.85) 55%, hsl(var(--primary)) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }),
                letterSpacing: '-0.02em',
              }}
            >
              {siteName}
            </span>

            {/* Online count indicator */}
            {onlineCount > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/15 border border-green-500/25 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-400 font-bold">{onlineCount}</span>
              </span>
            )}
          </Link>

          {/* RIGHT: Messenger icon + Admin + Profile avatar */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {user && headerConfig.showMessengerIcon !== false && (
              <button
                onClick={() => {
                  if (!hasVIP) { setShowVIPSelector(true); }
                  else { navigate('/messenger'); }
                }}
                className="relative w-9 h-9 flex items-center justify-center press"
              >
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
                {unreadDMs > 0 && (
                  <span
                    className="absolute top-0 right-0 min-w-[18px] h-[18px] gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center px-1 pink-glow-xs"
                    style={{ transform: 'translate(25%, -25%)' }}
                  >
                    {unreadDMs > 99 ? '99+' : unreadDMs}
                  </span>
                )}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center hover:bg-primary/25 transition-all press"
                title="Admin Dashboard"
              >
                <Shield className="w-4 h-4 text-primary" />
              </button>
            )}

            {/* Profile avatar (right side — matches image) */}
            {user && (
              <button
                onClick={() => navigate('/settings')}
                className="relative flex-shrink-0 press"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden gradient-pink flex items-center justify-center ring-2 ring-primary/40">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-black">
                        {(displayName || user.email)?.[0]?.toUpperCase()}
                      </span>
                  }
                </div>
                {/* VIP Badge on avatar */}
                {hasBlueTick && (
                  <span className="absolute bottom-0 right-0" style={{ transform: 'translate(25%, 25%)' }}>
                    <VIPBadge size="xs" badgeStyle={((profile as any)?.badge_style as BadgeStyle) || 'blue_burst'} />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {showNotifications && (
        <NotificationCenter
          onClose={handleCloseNotifications}
          onBadgeReset={() => {
            setUnreadCount(0);
            prevCount.current = 0;
          }}
        />
      )}
      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </>
  );
}
