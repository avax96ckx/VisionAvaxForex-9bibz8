/**
 * NotificationPermissionBanner
 * Shows a bottom-sheet style prompt asking the user to enable browser push notifications.
 * Appears once per session after login if permission hasn't been granted yet.
 */

import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Check } from 'lucide-react';
import { requestBrowserNotificationPermission, canShowBrowserNotification, registerServiceWorker } from '@/lib/browserNotifications';

const DISMISSED_KEY = 'vaf_notif_perm_dismissed';
const DISMISSED_UNTIL_KEY = 'vaf_notif_perm_dismissed_until';

function wasDismissedRecently(): boolean {
  const until = parseInt(localStorage.getItem(DISMISSED_UNTIL_KEY) || '0', 10);
  return Date.now() < until;
}

interface Props {
  onDone?: () => void;
}

export default function NotificationPermissionBanner({ onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    // Don't show if already granted or dismissed recently
    if (!('Notification' in window)) return;
    if (canShowBrowserNotification()) return; // already granted
    if (Notification.permission === 'denied') return; // permanently denied
    if (wasDismissedRecently()) return;

    // Show after a short delay so user can see the page first
    const t = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(t);
  }, []);

  async function handleAllow() {
    setState('requesting');
    const granted = await requestBrowserNotificationPermission();
    if (granted) {
      await registerServiceWorker();
      setState('granted');
      // Show a test notification after 1s
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification('🔔 Notifications Enabled!', {
            body: 'You will now receive signals, messages, and VIP alerts.',
            icon: '/favicon.ico',
            tag: 'perm_granted',
          });
          setTimeout(() => n.close(), 4000);
        }
      }, 1000);
      setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 2000);
    } else {
      setState('denied');
      setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 2000);
    }
  }

  function handleDismiss() {
    // Remind again in 3 days
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setVisible(false);
    onDone?.();
  }

  function handleNeverAgain() {
    localStorage.setItem(DISMISSED_KEY, '1');
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
    setVisible(false);
    onDone?.();
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9991] animate-slide-up"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div
          className="mx-3 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0d0d1a 0%, #1a0030 100%)',
            border: '1px solid rgba(255,20,147,0.25)',
            boxShadow: '0 -8px 48px rgba(255,20,147,0.15), 0 -2px 16px rgba(0,0,0,0.6)',
          }}
        >
          {/* Top gradient line */}
          <div className="h-1 gradient-pink" />

          <div className="p-5">
            {/* Dismiss X */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center press"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>

            {/* Icon + Title */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FF1493,#FF69B4)', boxShadow: '0 4px 16px rgba(255,20,147,0.4)' }}
              >
                {state === 'granted' ? (
                  <Check className="w-7 h-7 text-white" />
                ) : state === 'denied' ? (
                  <BellOff className="w-7 h-7 text-white" />
                ) : (
                  <Bell className="w-7 h-7 text-white" />
                )}
              </div>

              <div className="flex-1 pr-8">
                <h3 className="font-black text-white text-base leading-tight mb-1">
                  {state === 'granted' ? '✅ Notifications Enabled!' :
                   state === 'denied' ? '❌ Permission Denied' :
                   'Enable Push Notifications'}
                </h3>
                <p className="text-white/55 text-xs leading-relaxed">
                  {state === 'granted' ? "You'll receive real-time signals, messages & VIP alerts." :
                   state === 'denied' ? 'You can enable them later in browser settings.' :
                   'Get instant alerts for new signals, messages, VIP room activity & more.'}
                </p>
              </div>
            </div>

            {/* Feature pills */}
            {state === 'idle' && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { emoji: '📈', label: 'New Signals' },
                  { emoji: '💬', label: 'Messages' },
                  { emoji: '👑', label: 'VIP Room' },
                  { emoji: '🔔', label: 'Announcements' },
                ].map(f => (
                  <div
                    key={f.label}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-white/70 font-medium"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span>{f.emoji}</span>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            {state === 'idle' && (
              <div className="space-y-2">
                <button
                  onClick={handleAllow}
                  className="w-full py-3.5 gradient-pink rounded-2xl text-white font-black text-sm press pink-glow flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Allow Notifications
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 rounded-2xl text-white/50 text-xs font-medium press transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Remind me later
                  </button>
                  <button
                    onClick={handleNeverAgain}
                    className="flex-1 py-2.5 rounded-2xl text-white/35 text-xs font-medium press transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}

            {state === 'requesting' && (
              <div className="flex items-center justify-center gap-3 py-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-white/60 text-sm">Waiting for your response...</span>
              </div>
            )}

            {state === 'granted' && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-green-400 font-bold text-sm">All set! Notifications are enabled.</span>
              </div>
            )}

            {state === 'denied' && (
              <div className="text-center py-2">
                <p className="text-white/50 text-xs">To enable later: browser address bar → 🔒 → Notifications → Allow</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
