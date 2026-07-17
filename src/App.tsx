import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Signals from "./pages/Signals";
import Courses from "./pages/Courses";
import VIPRoom from "./pages/VIPRoom";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Messenger from "./pages/Messenger";
import CoursePlayer from "./pages/CoursePlayer";
import Profile from "./pages/Profile";
import SignalDetail from "./pages/SignalDetail";
import TradingChallenge from "./pages/TradingChallenge";
import AVAXAIHub from "./pages/AVAXAIHub";
import SmartMarket from "./pages/SmartMarket";
import TradingJournal from "./pages/TradingJournal";
import Economic from './pages/Economic';
import CoursesAIMentor from './pages/CoursesAIMentor';
import NotFound from './pages/NotFound';
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import AdminSetup from "@/components/features/AdminSetup";
import { GlobalCallListener } from "@/components/features/WebRTCCall";
import { supabase } from "@/lib/supabase";
import { showBrowserNotification, shouldShowPermissionBanner } from "@/lib/browserNotifications";
import { playNotificationSound, playMessageSound, playVIPRoomSound, playSignalSound } from "@/lib/notificationSound";
import NotificationPermissionBanner from "@/components/features/NotificationPermissionBanner";

const queryClient = new QueryClient();

// ── Global background polling for notifications, signals, messages ──
function BackgroundPoller() {
  const { user } = useAuth();
  const lastSignalIdRef = useRef<string | null>(null);
  const lastMsgCountRef = useRef<number>(-1);
  const lastNotifIdRef = useRef<string | null>(null);
  const lastVipMsgIdRef = useRef<string | null>(null);
  const lastMeetingIdRef = useRef<string | null>(null);
  const lastChallengeIdRef = useRef<string | null>(null);
  const lastChallengeStatusRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  // Track already-notified IDs to prevent duplicates
  const notifiedDmRef = useRef<Set<string>>(new Set());
  const notifiedVipRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    async function poll() {
      // ── 1. New signals ──
      const { data: latestSignal } = await supabase
        .from('signals')
        .select('id, title, pair, direction')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestSignal) {
        if (!initializedRef.current) {
          lastSignalIdRef.current = latestSignal.id;
        } else if (latestSignal.id !== lastSignalIdRef.current) {
          lastSignalIdRef.current = latestSignal.id;
          const title = `📈 New Signal: ${latestSignal.pair}`;
          const body = `${latestSignal.direction} — ${latestSignal.title}`;
          showBrowserNotification(title, { body, tag: `signal_${latestSignal.id}`, data: { url: '/signals' } });
          playSignalSound();
        }
      }

      // ── 2. Unread DMs ──
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);

      if (convs && convs.length > 0) {
        // Check if messenger page is currently open to avoid duplicate notifications
        const messengerOpen = window.location.pathname === '/messenger';

        const { data: newDms } = await supabase
          .from('direct_messages')
          .select('id, sender_id, message')
          .in('conversation_id', convs.map((c: any) => c.id))
          .neq('sender_id', user.id)
          .eq('is_read', false)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(10);

        const total = newDms?.length || 0;
        if (!initializedRef.current) {
          lastMsgCountRef.current = total;
          // Initialize notified set with existing unread IDs
          newDms?.forEach(m => notifiedDmRef.current.add(m.id));
        } else if (total > lastMsgCountRef.current && !messengerOpen) {
          // Find truly new unread messages not yet notified
          const newOnes = (newDms || []).filter(m => !notifiedDmRef.current.has(m.id));
          if (newOnes.length > 0) {
            newOnes.forEach(m => notifiedDmRef.current.add(m.id));
            showBrowserNotification(`💬 ${newOnes.length} New Message${newOnes.length > 1 ? 's' : ''}`, {
              body: 'You have unread messages in your inbox',
              tag: `dm_${newOnes[0].id}`,
              data: { url: '/messenger' },
            });
            playMessageSound();
          }
          lastMsgCountRef.current = total;
        } else {
          lastMsgCountRef.current = total;
          // Add current IDs to notified set so they don't re-trigger
          newDms?.forEach(m => notifiedDmRef.current.add(m.id));
        }
      }

      // ── 3. New notifications ──
      const { data: latestNotif } = await supabase
        .from('notifications')
        .select('id, title, body')
        .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestNotif) {
        if (!initializedRef.current) {
          lastNotifIdRef.current = latestNotif.id;
        } else if (latestNotif.id !== lastNotifIdRef.current) {
          lastNotifIdRef.current = latestNotif.id;
          showBrowserNotification(latestNotif.title || '🔔 New Notification', {
            body: latestNotif.body || '',
            tag: `notif_${latestNotif.id}`,
            data: { url: '/settings' },
          });
          playNotificationSound();
        }
      }

      // ── 4. New VIP Room messages ──
      const { data: latestVip } = await supabase
        .from('vip_messages')
        .select('id, message, user_profiles(username)')
        .eq('is_deleted', false)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const vipOpen = window.location.pathname === '/vip';
      if (latestVip) {
        if (!initializedRef.current) {
          lastVipMsgIdRef.current = latestVip.id;
          notifiedVipRef.current.add(latestVip.id);
        } else if (latestVip.id !== lastVipMsgIdRef.current && !notifiedVipRef.current.has(latestVip.id) && !vipOpen) {
          lastVipMsgIdRef.current = latestVip.id;
          notifiedVipRef.current.add(latestVip.id);
          const sender = (latestVip as any).user_profiles?.username || 'VIP Member';
          const preview = latestVip.message || '📎 Media';
          showBrowserNotification(`👑 VIP Room: ${sender}`, {
            body: preview,
            tag: `vip_${latestVip.id}`,
            data: { url: '/vip' },
          });
          playVIPRoomSound();
        } else {
          lastVipMsgIdRef.current = latestVip.id;
        }
      }

      // ── 5. New meeting started in VIP Room ──
      const { data: latestMeeting } = await supabase
        .from('meetings')
        .select('id, title, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestMeeting) {
        if (!initializedRef.current) {
          lastMeetingIdRef.current = latestMeeting.id;
        } else if (latestMeeting.id !== lastMeetingIdRef.current) {
          lastMeetingIdRef.current = latestMeeting.id;
          showBrowserNotification(`🎥 Meeting Started: ${latestMeeting.title}`, {
            body: 'A live meeting is happening in the VIP Room. Tap to join!',
            tag: `meeting_${latestMeeting.id}`,
            data: { url: '/vip' },
          });
        }
      }

      // ── 6. Trading Challenge started or results published ──
      const { data: latestChallenge } = await supabase
        .from('trading_challenges')
        .select('id, title, status, is_published, prize_value')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestChallenge) {
        if (!initializedRef.current) {
          lastChallengeIdRef.current = latestChallenge.id;
          lastChallengeStatusRef.current = latestChallenge.status;
        } else {
          // New challenge published
          if (latestChallenge.id !== lastChallengeIdRef.current) {
            lastChallengeIdRef.current = latestChallenge.id;
            lastChallengeStatusRef.current = latestChallenge.status;
            showBrowserNotification(`🏆 New Trading Challenge!`, {
              body: `${latestChallenge.title} — Prize: ${latestChallenge.prize_value}. Join now and compete!`,
              tag: `challenge_${latestChallenge.id}`,
              data: { url: '/challenge' },
            });
          }
          // Challenge ended (results published)
          else if (latestChallenge.status === 'ended' && lastChallengeStatusRef.current !== 'ended') {
            lastChallengeStatusRef.current = 'ended';
            showBrowserNotification(`🏆 Challenge Results Are In!`, {
              body: `${latestChallenge.title} has ended. Check the leaderboard to see who won!`,
              tag: `challenge_ended_${latestChallenge.id}`,
              data: { url: '/challenge' },
            });
          }
        }
      }

      initializedRef.current = true;
    }

    // Initial call to set baselines (no notifications)
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return null;
}

function NotificationBannerWrapper() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Delay check — let page render first
    const t = setTimeout(() => {
      setShowBanner(shouldShowPermissionBanner());
    }, 3000);
    return () => clearTimeout(t);
  }, [user]);

  if (!showBanner) return null;
  return <NotificationPermissionBanner onDone={() => setShowBanner(false)} />;
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <BackgroundPoller />
      <GlobalCallListener />
      <NotificationBannerWrapper />
      <Header />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/signals/:id" element={<SignalDetail />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CoursePlayer />} />
        <Route path="/vip" element={<VIPRoom />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/messenger" element={<Messenger />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/challenge" element={<TradingChallenge />} />
        <Route path="/avax-ai" element={<AVAXAIHub />} />
        <Route path="/smart-market" element={<SmartMarket />} />
        <Route path="/trading-journal" element={<TradingJournal />} />
        <Route path="/economic" element={<Economic />} />
        <Route path="/courses-ai" element={<CoursesAIMentor />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
      <WhatsAppButton />
    </div>
  );
}

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <AdminSetup />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
