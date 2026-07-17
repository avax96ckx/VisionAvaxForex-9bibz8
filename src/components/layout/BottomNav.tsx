import { useNavigate, useLocation } from 'react-router-dom';
import { Home, TrendingUp, GraduationCap, Crown, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isVIPActive } from '@/lib/supabase';

const DEFAULT_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: TrendingUp, label: 'Signals', path: '/signals' },
  { icon: GraduationCap, label: 'Courses', path: '/courses' },
  { icon: Crown, label: 'VIP', path: '/vip' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const LS_KEYS = {
  vipMsgCount: 'vaf_vip_seen_count',
  coursesCount: 'vaf_courses_seen_count',
  signalsCount: 'vaf_signals_seen_count',
};

function getStoredNum(key: string) { return parseInt(localStorage.getItem(key) || '0', 10); }
function setStoredNum(key: string, val: number) { localStorage.setItem(key, String(val)); }

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, user, profile, isAdmin } = useAuth();
  const [vipBadge, setVipBadge] = useState(0);
  const [coursesBadge, setCoursesBadge] = useState(0);
  const [signalsBadge, setSignalsBadge] = useState(0);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [navStyle, setNavStyle] = useState('default');

  useEffect(() => {
    supabase.from('site_settings').select('show_bottom_nav,nav_style').eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setShowBottomNav((data as any).show_bottom_nav !== false);
          setNavStyle((data as any).nav_style || 'default');
        }
      });
  }, []);

  useEffect(() => {
    if (location.pathname === '/vip') {
      supabase.from('vip_messages').select('*', { count: 'exact', head: true }).eq('is_deleted', false).then(({ count }) => {
        setStoredNum(LS_KEYS.vipMsgCount, count || 0); setVipBadge(0);
      });
    }
    if (location.pathname === '/courses' || location.pathname.startsWith('/courses/')) {
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true).then(({ count }) => {
        setStoredNum(LS_KEYS.coursesCount, count || 0); setCoursesBadge(0);
      });
    }
    if (location.pathname === '/signals') {
      supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'active').then(({ count }) => {
        setStoredNum(LS_KEYS.signalsCount, count || 0); setSignalsBadge(0);
      });
    }
  }, [location.pathname]);

  useEffect(() => {
    async function checkBadges() {
      const { count: vipCount } = await supabase.from('vip_messages').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
      const seenVip = getStoredNum(LS_KEYS.vipMsgCount);
      if (location.pathname !== '/vip') setVipBadge(Math.max(0, (vipCount || 0) - seenVip));
      const { count: cCount } = await supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true);
      const seenCourses = getStoredNum(LS_KEYS.coursesCount);
      if (!location.pathname.startsWith('/courses')) setCoursesBadge(Math.max(0, (cCount || 0) - seenCourses));
      const { count: sCount } = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const seenSignals = getStoredNum(LS_KEYS.signalsCount);
      if (location.pathname !== '/signals') setSignalsBadge(Math.max(0, (sCount || 0) - seenSignals));
    }
    checkBadges();
    const iv = setInterval(checkBadges, 20000);
    return () => clearInterval(iv);
  }, [location.pathname]);

  if (
    location.pathname === '/vip' ||
    location.pathname.startsWith('/courses/') ||
    location.pathname === '/messenger' ||
    location.pathname === '/auth' ||
    !showBottomNav
  ) return null;

  const isFloat = navStyle === 'float';
  const isTelegram = navStyle === 'telegram';
  const isIconsOnly = navStyle === 'icons_only';
  const isLabelsOnly = navStyle === 'labels_only';
  const isPill = navStyle === 'pill';
  const isFlat = navStyle === 'flat';

  const navBg = theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(9,10,17,0.97)';
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.06)';

  // ── FLOATING PILL style (like the image) ──
  if (isFloat) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))', pointerEvents: 'none' }}>
        <div className="flex items-center gap-1 px-3 rounded-3xl shadow-2xl"
          style={{
            background: theme === 'light' ? 'rgba(255,255,255,0.98)' : 'rgba(18,18,28,0.98)',
            border: `1px solid ${borderColor}`,
            backdropFilter: 'blur(24px)',
            height: 60,
            pointerEvents: 'all',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}>
          {DEFAULT_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path || (path === '/courses' && location.pathname.startsWith('/courses'));
            const badge = path === '/vip' ? vipBadge : path === '/courses' ? coursesBadge : path === '/signals' ? signalsBadge : 0;
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-2xl transition-all press min-h-[44px] min-w-[44px] ${active ? 'gradient-pink text-white pink-glow-xs' : 'text-muted-foreground hover:bg-muted/50'}`}>
                <Icon className="w-4 h-4" />
                {active && <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ── ROUNDED PILL DARK style (like the image provided) — default ──
  // Dark pill container, active item in pink
  if (navStyle === 'default' || navStyle === 'pill') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <div className="mx-3 w-full max-w-lg"
          style={{
            background: theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(13,13,22,0.97)',
            borderRadius: 40,
            border: theme === 'light' ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: theme === 'light' ? '0 4px 24px rgba(0,0,0,0.10)' : '0 4px 32px rgba(0,0,0,0.5)',
          }}>
          <div className="flex items-center justify-around px-2 h-[60px]">
            {DEFAULT_ITEMS.map(({ icon: Icon, label, path }) => {
              const active = location.pathname === path || (path === '/courses' && location.pathname.startsWith('/courses'));
              const badge = path === '/vip' ? vipBadge : path === '/courses' ? coursesBadge : path === '/signals' ? signalsBadge : 0;
              return (
                <button key={path} onClick={() => navigate(path)}
                  className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full press min-h-[44px] min-w-[44px] transition-all duration-200">
                  <div className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${active ? 'scale-105' : 'scale-100'}`}>
                    <Icon className={`w-5 h-5 transition-colors duration-200 ${active ? 'text-primary' : theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}
                      strokeWidth={active ? 2.5 : 1.8} />
                    <span className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${active ? 'text-primary' : theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </div>
                  {badge > 0 && (
                    <span className="absolute top-1.5 right-[18%] min-w-[16px] h-4 px-0.5 gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center z-20">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  // ── TELEGRAM style ──
  if (isTelegram) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50"
        style={{ background: 'transparent', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch justify-around max-w-lg mx-auto"
          style={{
            background: theme === 'light' ? 'rgba(255,255,255,0.98)' : 'rgba(9,10,17,0.98)',
            borderTop: `1px solid ${borderColor}`,
            height: 60,
          }}>
          {DEFAULT_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path || (path === '/courses' && location.pathname.startsWith('/courses'));
            const badge = path === '/vip' ? vipBadge : path === '/courses' ? coursesBadge : path === '/signals' ? signalsBadge : 0;
            return (
              <button key={path} onClick={() => navigate(path)}
                className="relative flex flex-col items-center justify-center flex-1 h-full press min-h-[44px]">
                {active && <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-xl bg-primary/15" />}
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-[9px] font-semibold leading-none ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                </div>
                {badge > 0 && (
                  <span className="absolute top-1.5 right-[18%] min-w-[16px] h-4 px-0.5 gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center z-20">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ── FLAT / ICONS_ONLY / LABELS_ONLY fallback ──
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: isFlat ? 'transparent' : navBg,
        backdropFilter: isFlat ? 'none' : 'blur(24px)',
        borderTop: isFlat ? 'none' : `1px solid ${borderColor}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto" style={{ height: 60 }}>
        {DEFAULT_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path === '/courses' && location.pathname.startsWith('/courses'));
          const badge = path === '/vip' ? vipBadge : path === '/courses' ? coursesBadge : path === '/signals' ? signalsBadge : 0;
          return (
            <button key={path} onClick={() => navigate(path)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full press min-h-[44px] min-w-[44px]">
              {!isLabelsOnly && (
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
              )}
              {!isIconsOnly && (
                <span className={`text-[10px] font-semibold leading-none ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
