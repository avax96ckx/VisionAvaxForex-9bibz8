import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Lang } from '@/lib/i18n';
import { User } from '@supabase/supabase-js';
import { supabase, ADMIN_EMAIL } from '@/lib/supabase';
import { AuthUser, UserProfile } from '@/types';
import { registerServiceWorker } from '@/lib/browserNotifications';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  theme: 'dark',
  toggleTheme: () => {},
  lang: 'en',
  setLang: () => {},
  login: () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

function mapUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url,
    is_admin: user.email === ADMIN_EMAIL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vaf_theme') as 'dark' | 'light') || 'dark';
  });
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('vaf_lang') as Lang) || 'en';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('vaf_lang', l);
  };

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('vaf_theme', theme);
  }, [theme]);

  // Load and apply primary color + font from DB on startup
  useEffect(() => {
    // First try cached values from localStorage for instant apply
    const cachedColor = localStorage.getItem('vaf_primary_color');
    const cachedFont = localStorage.getItem('vaf_font_family');
    const cachedScope = localStorage.getItem('vaf_font_scope');

    function hexToHslStr(hex: string): string {
      const h = hex.replace('#', '');
      if (h.length !== 6) return '';
      const r = parseInt(h.substring(0, 2), 16) / 255;
      const g = parseInt(h.substring(2, 4), 16) / 255;
      const b = parseInt(h.substring(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let hue = 0, sat = 0;
      const lit = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) hue = ((b - r) / d + 2) / 6;
        else hue = ((r - g) / d + 4) / 6;
      }
      return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lit * 100)}%`;
    }

    const FONT_MAP: Record<string, string> = {
      inter: '"Inter", sans-serif', roboto: '"Roboto", sans-serif',
      poppins: '"Poppins", sans-serif', nunito: '"Nunito", sans-serif',
      ubuntu: '"Ubuntu", sans-serif', oswald: '"Oswald", sans-serif',
      mono: '"Courier New", monospace', serif: '"Georgia", serif',
      playfair: '"Playfair Display", serif', cursive: 'cursive',
      italic: 'italic "Inter", sans-serif', fantasy: 'fantasy',
      thin: '100 "Inter", sans-serif',
    };

    if (cachedColor) {
      const hsl = hexToHslStr(cachedColor);
      if (hsl) document.documentElement.style.setProperty('--primary', hsl);
    }
    // Apply saved website style vars
    try {
      const savedStyle = localStorage.getItem('vaf_website_style');
      if (savedStyle) {
        const vars = JSON.parse(savedStyle);
        Object.entries(vars).forEach(([key, value]) => {
          document.documentElement.style.setProperty(key, value as string);
        });
      }
    } catch {}
    if (cachedFont && cachedFont !== 'default' && cachedScope === 'all') {
      const ff = FONT_MAP[cachedFont];
      if (ff) document.body.style.fontFamily = ff;
    }

    // Then fetch fresh from DB
    import('@/lib/supabase').then(({ supabase: sb }) => {
      sb.from('site_settings').select('primary_color, chat_font_family, font_scope').eq('id', 'main').single().then(({ data }) => {
        if (!data) return;
        if (data.primary_color) {
          const hsl = hexToHslStr(data.primary_color);
          if (hsl) {
            document.documentElement.style.setProperty('--primary', hsl);
            document.documentElement.style.setProperty('--ring', hsl);
            document.documentElement.style.setProperty('--accent', hsl);
          }
          localStorage.setItem('vaf_primary_color', data.primary_color);
        }
        const fontKey = data.chat_font_family;
        const fontScope = (data as any).font_scope || 'all';
        localStorage.setItem('vaf_font_family', fontKey || 'default');
        localStorage.setItem('vaf_font_scope', fontScope);
        if (fontKey && fontKey !== 'default' && fontScope === 'all') {
          const ff = FONT_MAP[fontKey];
          if (ff) document.body.style.fontFamily = ff;
        } else if (!fontKey || fontKey === 'default') {
          document.body.style.removeProperty('font-family');
        }
      });
    });
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  }, []);

  // Poll profile every 10s to keep badge_style, VIP status, etc. in sync for all users
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchProfile(user.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [user, fetchProfile]);

  // Real online/offline tracking — updates DB on visibility change and heartbeat
  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    // Mark online immediately
    supabase.from('user_profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', uid);

    // Visibility change handler
    const onVisibility = () => {
      const online = !document.hidden;
      supabase.from('user_profiles').update({ is_online: online, last_seen: new Date().toISOString() }).eq('id', uid);
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Heartbeat every 45s while tab is visible
    const heartbeat = setInterval(() => {
      if (!document.hidden) {
        supabase.from('user_profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', uid);
      }
    }, 45000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(heartbeat);
      // Set offline on unmount/logout
      supabase.from('user_profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', uid);
    };
  }, [user?.id]);

  const login = (authUser: AuthUser) => setUser(authUser);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // Register service worker for background notifications
    registerServiceWorker();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) {
        setUser(mapUser(session.user));
        fetchProfile(session.user.id);
        // Permission is requested via NotificationPermissionBanner in App.tsx
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(mapUser(session.user));
        fetchProfile(session.user.id);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(mapUser(session.user));
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: user?.is_admin ?? false, theme, toggleTheme, lang, setLang, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
