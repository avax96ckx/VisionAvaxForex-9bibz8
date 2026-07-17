import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, TrendingUp, ChevronRight, Users, Award, Zap, Star, BookOpen, Shield, Download, Trophy, Bot, BarChart2, Globe, Brain } from 'lucide-react';
import { supabase, isVIPActive } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Signal, Course, Testimonial, SiteSettings, VIPPlan } from '@/types';
import type { BadgeStyle } from '@/types';
import SignalCard from '@/components/features/SignalCard';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import APKSection from '@/components/features/APKSection';
import VIPBadge from '@/components/features/VIPBadge';
import heroBanner from '@/assets/hero-banner.jpg';

type SectionKey = 'profile_pill' | 'hero' | 'stats' | 'signals' | 'courses' | 'fst_section' | 'challenge' | 'apk' | 'vip' | 'testimonials';

const DEFAULT_LAYOUT: SectionKey[] = ['profile_pill', 'hero', 'stats', 'signals', 'courses', 'fst_section', 'challenge', 'apk', 'vip', 'testimonials'];

export default function Index() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [homeLayout, setHomeLayout] = useState<SectionKey[]>(DEFAULT_LAYOUT);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeChallenge, setActiveChallenge] = useState<any>(null);
  const [challengeTop3, setChallengeTop3] = useState<any[]>([]);

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  useEffect(() => {
    Promise.all([
      supabase.from('signals').select('*').eq('status', 'active').order('is_pinned', { ascending: false }).limit(3),
      supabase.from('courses').select('*').eq('is_published', true).order('order_index').limit(4),
      supabase.from('testimonials').select('*').eq('is_published', true).order('order_index'),
      supabase.from('site_settings').select('*').eq('id', 'main').single(),
    ]).then(([s, c, t, st]) => {
      if (s.data) setSignals(s.data);
      if (c.data) setCourses(c.data);
      if (t.data) setTestimonials(t.data);
      if (st.data) {
        setSettings(st.data);
        if ((st.data as any).home_layout && Array.isArray((st.data as any).home_layout)) {
          // Merge stored layout with default to ensure new sections (like 'challenge') always appear
          const stored: SectionKey[] = (st.data as any).home_layout;
          const merged = [...stored];
          // Add any missing sections from DEFAULT_LAYOUT that aren't in stored
          DEFAULT_LAYOUT.forEach((key, idx) => {
            if (!merged.includes(key)) {
              // Insert at the position it appears in DEFAULT_LAYOUT relative to surrounding items
              const insertAfter = DEFAULT_LAYOUT[idx - 1];
              const insertPos = insertAfter ? merged.indexOf(insertAfter) + 1 : idx;
              merged.splice(Math.max(0, insertPos), 0, key);
            }
          });
          setHomeLayout(merged);
        }
      }
      setLoading(false);
    });
    // Fetch active challenge and top 3
    supabase.from('trading_challenges').select('*').eq('is_published', true).in('status', ['active', 'ended']).order('created_at', { ascending: false }).limit(1).single()
      .then(async ({ data: ch }) => {
        if (!ch) return;
        setActiveChallenge(ch);
        const { data: parts } = await supabase
          .from('challenge_participants')
          .select('*, user_profiles(username,avatar_url,is_vip,blue_tick)')
          .eq('challenge_id', ch.id)
          .order('total_pips', { ascending: false })
          .limit(3);
        if (parts) setChallengeTop3(parts);
      });
  }, []);

  const vipPlans: VIPPlan[] = settings?.vip_plans || [];
  const categoryEmoji: Record<string, string> = {
    Basics: '📚', Technical: '📊', Advanced: '🚀', Strategies: '⚡', Psychology: '🧠', Risk: '🛡️',
  };

  const displayName = profile?.full_name || profile?.username || user?.username || '';
  const badgeStyle = ((profile as any)?.badge_style as BadgeStyle) || 'blue_burst';
  const hasBadge = profile?.blue_tick || isAdmin || hasVIP;

  // ── Section renderers ──
  const sectionMap: Record<SectionKey, JSX.Element | null> = {
    profile_pill: user ? (
      <div key="profile_pill" className="mx-3 mt-3 mb-3">
        <div
          className="flex items-center gap-4 px-4 py-3 rounded-[28px] border border-primary/30 cursor-pointer hover:border-primary/50 transition-all press"
          style={{ background: 'linear-gradient(90deg,rgba(61,0,51,0.7) 0%,rgba(20,0,25,0.85) 100%)', boxShadow: '0 2px 24px rgba(255,20,147,0.18)' }}
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          <div className="rounded-full p-[2.5px] flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF1493,#FF69B4,#FF1493)', boxShadow: '0 0 0 2px #0d0d1a' }}>
            <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-white">{displayName[0]?.toUpperCase() || '?'}</span>
              }
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-white truncate" style={{ letterSpacing: '-0.3px' }}>{displayName || 'Member'}</span>
              {hasBadge && <VIPBadge size="md" badgeStyle={badgeStyle} animate />}
            </div>
            {hasVIP && <span className="text-[11px] text-primary font-semibold">{isAdmin ? '⚡ Super Admin' : '👑 VIP Member'}</span>}
          </div>
        </div>
      </div>
    ) : null,

    hero: (
      <section key="hero" className="relative mx-3 mt-1 mb-5 rounded-3xl overflow-hidden" style={{ minHeight: 220 }}>
        <img src={settings?.hero_banner_url || heroBanner} alt="hero" className="w-full h-56 object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/5" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-semibold">Live Markets</span>
          </div>
          <h1 className="leading-tight mb-1"
            style={{
              color: (settings as any)?.hero_title_color || '#ffffff',
              fontSize: (settings as any)?.hero_title_size === '3xl' ? '24px' : (settings as any)?.hero_title_size === '4xl' ? '28px' : (settings as any)?.hero_title_size === 'xl' ? '18px' : (settings as any)?.hero_title_size === 'lg' ? '16px' : '22px',
              fontStyle: (settings as any)?.hero_title_style === 'italic' ? 'italic' : 'normal',
              fontWeight: (settings as any)?.hero_title_style === 'thin' ? 300 : 900,
            }}>{settings?.hero_title || 'Trade Smart. Live Better.'} 🔥</h1>
          <p className="text-xs mb-4 leading-relaxed"
            style={{ color: (settings as any)?.hero_subtitle_color || 'rgba(255,255,255,0.6)', fontStyle: (settings as any)?.hero_subtitle_style === 'italic' ? 'italic' : 'normal', fontWeight: (settings as any)?.hero_subtitle_style === 'thin' ? 300 : 400 }}>{settings?.hero_subtitle || 'Professional Forex Signals & Premium Trading Education'}</p>
          <div className="flex gap-2.5">
            <button onClick={() => navigate('/avax-ai')} className="px-5 py-2.5 gradient-pink rounded-2xl text-white text-sm font-bold pink-glow-sm flex items-center gap-1.5 press" style={{ borderRadius: 20 }}>
              <Bot className="w-4 h-4" /> AVAX AI
            </button>
            <button onClick={() => setShowVIPSelector(true)} className="px-5 py-2.5 rounded-2xl text-white text-sm font-bold flex items-center gap-1.5 press border border-white/20" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', borderRadius: 20 }}>
              <Crown className="w-4 h-4 text-yellow-400" /> Join VIP
            </button>
          </div>
        </div>
      </section>
    ),

    stats: (
      <section key="stats" className="mx-3 mb-5 grid grid-cols-3 gap-2.5">
        {[
          { icon: Users, value: '5,000+', label: 'Members', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
          { icon: TrendingUp, value: '89%', label: 'Win Rate', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/15' },
          { icon: Award, value: '3+ Yrs', label: 'Experience', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/15' },
        ].map(({ icon: Icon, value, label, color, bg }) => (
          <div key={label} className={`${bg} border rounded-2xl p-3 text-center card-hover`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className="text-sm font-black text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>
    ),

    signals: (
      <section key="signals" className="mb-6">
        <div className="flex items-center justify-between px-3 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-[15px] font-black text-foreground">Live Signals</h2>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <button onClick={() => navigate('/signals')} className="text-primary text-xs font-semibold flex items-center gap-0.5 press">View All <ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="px-3 space-y-2.5">
          {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
            : signals.map(s => <SignalCard key={s.id} signal={s} hasAccess={hasVIP} />)
          }
        </div>
      </section>
    ),

    courses: (
      <section key="courses" className="mb-6">
        <div className="flex items-center justify-between px-3 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-[15px] font-black text-foreground">Trading Courses</h2>
          </div>
          <button onClick={() => navigate('/courses')} className="text-primary text-xs font-semibold flex items-center gap-0.5 press">View All <ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="px-3 grid grid-cols-2 gap-2.5">
          {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)
            : courses.map(c => (
              <button key={c.id} onClick={() => navigate('/courses')} className="bg-card border border-border rounded-2xl p-3 text-left card-hover press overflow-hidden">
                <div className="w-full h-20 rounded-xl overflow-hidden mb-2.5 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  {c.thumbnail_url ? <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" /> : <span className="text-3xl">{categoryEmoji[c.category] || '📈'}</span>}
                </div>
                <p className="text-xs font-bold text-foreground line-clamp-2 mb-1.5 leading-tight">{c.title}</p>
                <span className={`text-xs font-black ${c.is_free ? 'text-green-400' : 'text-primary'}`}>{c.is_free ? '🆓 FREE' : `$${c.price_usd}`}</span>
              </button>
            ))
          }
        </div>
      </section>
    ),

    fst_section: (
      <section key="fst_section" className="mb-6 px-3">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h2 className="text-[15px] font-black text-foreground">Future Successful Traders</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              label: '📈 Trading Journal',
              desc: 'Track trades, analyze performance & win rate',
              path: '/trading-journal',
              color: '#2196F3',
              bg: 'rgba(33,150,243,0.12)',
              border: 'rgba(33,150,243,0.25)',
              Icon: BookOpen,
            },
            {
              label: '🏆 Challenges',
              desc: 'Weekly competitions & leaderboards',
              path: '/challenge',
              color: '#FFC107',
              bg: 'rgba(255,193,7,0.12)',
              border: 'rgba(255,193,7,0.25)',
              Icon: Trophy,
            },
            {
              label: '🌎 Economic',
              desc: 'AI economic calendar & news analysis',
              path: '/economic',
              color: '#9C27B0',
              bg: 'rgba(156,39,176,0.12)',
              border: 'rgba(156,39,176,0.25)',
              Icon: Globe,
            },
            {
              label: '📊 Smart Market',
              desc: 'Live data, AI analysis & trading education',
              path: '/smart-market',
              color: '#4CAF50',
              bg: 'rgba(76,175,80,0.12)',
              border: 'rgba(76,175,80,0.25)',
              Icon: BarChart2,
            },
          ].map(({ label, desc, path, color, bg, border, Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="relative text-left rounded-2xl p-4 press transition-all group overflow-hidden"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity rounded-2xl" style={{ background: `radial-gradient(circle at center, ${color}25 0%, transparent 70%)` }} />
              <div className="w-10 h-10 flex items-center justify-center mb-3">
                <Icon className="w-7 h-7" style={{ color }} />
              </div>
              <p className="text-white font-black text-xs leading-tight mb-1">{label}</p>
              <p className="text-white/45 text-[10px] leading-tight line-clamp-2">{desc}</p>
              <div className="absolute top-3 right-3">
                <ChevronRight className="w-3.5 h-3.5 text-white/20" />
              </div>
            </button>
          ))}
        </div>
      </section>
    ),

    challenge: activeChallenge ? (
      <section key="challenge" className="mb-6 px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <h2 className="text-[15px] font-black text-foreground">Trading Challenge</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeChallenge.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>{activeChallenge.status === 'active' ? '🟢 LIVE' : '🔴 ENDED'}</span>
          </div>
        </div>
        <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#1a0a00,#3d2c00)', border: '1px solid rgba(255,215,0,0.25)' }}>
          {/* Top 3 podium */}
          {challengeTop3.length > 0 && (
            <div className="px-4 pt-4 pb-3">
              <p className="text-yellow-400/70 text-[10px] uppercase font-black tracking-wide mb-3 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Top Traders
              </p>
              <div className="flex gap-2">
                {challengeTop3.map((p, idx) => {
                  const medals = ['🥇','🥈','🥉'];
                  return (
                    <div key={p.id} className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-2xl" style={{ background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.15)' }}>
                      <div className="w-10 h-10 rounded-full overflow-hidden gradient-pink flex items-center justify-center flex-shrink-0">
                        {p.user_profiles?.avatar_url ? <img src={p.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(p.user_profiles?.username || '?')[0].toUpperCase()}</span>}
                      </div>
                      <span className="text-base">{medals[idx]}</span>
                      <p className="text-white text-[10px] font-bold truncate w-full text-center">{p.user_profiles?.username || 'Trader'}</p>
                      <p className="text-yellow-400 text-xs font-black">{parseFloat(p.total_pips || 0).toFixed(0)} pips</p>
                    </div>
                  );
                })}
                {challengeTop3.length < 3 && Array.from({ length: 3 - challengeTop3.length }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <span className="text-white/20 text-2xl">{['🥇','🥈','🥉'][challengeTop3.length + i]}</span>
                    <p className="text-white/20 text-[10px]">TBD</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Prize info */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 py-2 border-t border-yellow-500/15">
              <span className="text-yellow-400 text-lg">🎁</span>
              <div className="flex-1">
                <p className="text-white/60 text-[10px] uppercase font-bold">Prize</p>
                <p className="text-yellow-400 font-black text-sm">{activeChallenge.prize_value || '1 Month VIP'}</p>
              </div>
              {activeChallenge.week_end && activeChallenge.status === 'active' && (
                <div className="text-right">
                  <p className="text-white/40 text-[10px]">Ends</p>
                  <p className="text-white text-[10px] font-bold">{new Date(activeChallenge.week_end).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                </div>
              )}
            </div>
          </div>
          {/* Join button */}
          <button
            onClick={() => navigate('/challenge')}
            className="w-full py-3.5 flex items-center justify-center gap-2 font-black text-sm text-white press"
            style={{ background: 'linear-gradient(90deg,#FF1493,#FF69B4)' }}
          >
            <Trophy className="w-4 h-4" /> Join Challenge Now
          </button>
        </div>
      </section>
    ) : null,

    apk: (
      <section key="apk" className="px-3 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-primary" />
          <h2 className="text-[15px] font-black text-foreground">Mobile App</h2>
        </div>
        <APKSection minimal />
      </section>
    ),

    vip: (
      <section key="vip" id="vip-section" className="mb-6 px-3">
        {hasVIP ? (
          <div className="gradient-pink-dark rounded-3xl p-5 pink-glow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-black text-white">{isAdmin ? 'Admin Access' : 'VIP Member'}</p>
                  <Shield className="w-4 h-4 text-white/70" />
                </div>
                <p className="text-xs text-white/70 mb-3">Full access to all premium content</p>
                <button onClick={() => navigate('/vip')} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white text-xs font-bold transition-all press">Enter VIP Room →</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/25 rounded-full mb-2">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-bold">VIP Membership</span>
              </div>
              <h2 className="text-xl font-black text-foreground mb-1">Unlock Premium Access</h2>
              <p className="text-sm text-muted-foreground">Premium signals, all courses & exclusive community</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-2">
                {['Premium Signals', 'All Courses', 'VIP Chat Room', 'Expert Analysis', 'Blue Tick Badge', 'Priority Support'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-foreground">
                    <span className="text-primary font-bold">✓</span><span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {vipPlans.slice(0, 6).map(plan => (
                <button key={plan.id} onClick={() => setShowVIPSelector(true)}
                  className={`bg-card border rounded-2xl p-4 text-left transition-all press card-hover ${plan.id === 'monthly' ? 'border-primary/50 pink-glow-xs' : 'border-border'}`}>
                  {plan.id === 'monthly' && <span className="text-[9px] px-2 py-0.5 gradient-pink rounded-full text-white font-bold mb-2 inline-block">POPULAR</span>}
                  <p className="font-black text-foreground text-sm">{plan.name}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">{plan.duration}</p>
                  <p className="text-xl font-black text-gradient-pink">${plan.price}</p>
                </button>
              ))}
            </div>
            {vipPlans.slice(6).map(plan => (
              <button key={plan.id} onClick={() => setShowVIPSelector(true)} className="mt-2.5 w-full bg-card border border-primary/25 rounded-2xl p-4 flex items-center justify-between card-hover press">
                <div><p className="font-black text-foreground">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.duration}</p></div>
                <p className="text-2xl font-black text-gradient-pink">${plan.price}</p>
              </button>
            ))}
          </>
        )}
      </section>
    ),

    testimonials: testimonials.length > 0 ? (
      <section key="testimonials" className="mb-8 px-3">
        <h2 className="text-[15px] font-black text-foreground mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Member Reviews
        </h2>
        <div className="space-y-2.5">
          {testimonials.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-2xl p-4 card-hover">
              <div className="flex items-start gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-full gradient-pink flex items-center justify-center text-white font-black text-sm flex-shrink-0 overflow-hidden">
                  {t.avatar_url ? <img src={t.avatar_url} alt={t.name} className="w-full h-full object-cover" /> : t.name[0]}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{t.name}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic">"{t.content}"</p>
            </div>
          ))}
        </div>
      </section>
    ) : null,
  };

  return (
    <div className="min-h-screen pb-24 animate-fade-in" style={{ paddingTop: '70px' }}>
      {/* Render sections in order from home_layout */}
      {homeLayout.map(key => sectionMap[key] || null)}

      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
    </div>
  );
}
