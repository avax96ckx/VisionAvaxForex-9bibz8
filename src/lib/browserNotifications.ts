/**
 * Browser Push Notifications utility
 * Shows native OS notifications from the browser for:
 * - General notifications (signals, announcements, VIP, courses)
 * - Direct messages (Messenger)
 * - VIP Room messages
 * - New signals posted
 * - App version updates
 */

const PERM_KEY = 'vaf_notif_perm_asked';
const SITE_NAME = 'VISION AVAX FOREX';

// ── Check if the dismissed-forever flag is set ──
export function isNotificationPermanentlyDismissed(): boolean {
  return localStorage.getItem('vaf_notif_perm_dismissed') === '1';
}

// ── Should we show the permission banner? ──
export function shouldShowPermissionBanner(): boolean {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return false;
  if (Notification.permission === 'denied') return false;
  if (isNotificationPermanentlyDismissed()) return false;
  const dismissedUntil = parseInt(localStorage.getItem('vaf_notif_perm_dismissed_until') || '0', 10);
  if (Date.now() < dismissedUntil) return false;
  return true;
}

// ── Icons for different notification types ──
const ICONS: Record<string, string> = {
  signal:   '📊',
  message:  '💬',
  vip:      '👑',
  viproom:  '🏆',
  course:   '🎓',
  announcement: '📢',
  update:   '📱',
  general:  '🔔',
};

// ── Request notification permission ──
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  sessionStorage.setItem(PERM_KEY, result);
  return result === 'granted';
}

// ── Check if notifications are available & permitted ──
export function canShowBrowserNotification(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

// ── Service Worker Registration for background push notifications ──
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Register main SW
    const reg = await navigator.serviceWorker.register('/sw.js');
    // Also register Firebase messaging SW for AppMint/AppMySite compatibility
    // This enables push notifications in converted apps
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });
    } catch {
      // Firebase SW optional — fail silently if not needed
    }
    return reg;
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

// ── Core show function (works even when tab is focused — shows in browser chrome) ──
export function showBrowserNotification(
  title: string,
  options: {
    body?: string;
    icon?: string;
    tag?: string;
    badge?: string;
    silent?: boolean;
    data?: Record<string, any>;
    url?: string;
  } = {}
): void {
  if (!canShowBrowserNotification()) return;

  try {
    // Try service worker notification first (works even when page is closed)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: {
          body: options.body || '',
          icon: options.icon || '/favicon.ico',
          badge: options.badge || '/favicon.ico',
          tag: options.tag || `vaf_${Date.now()}`,
          data: { url: options.url || '/', ...options.data },
          vibrate: [200, 100, 200],
        },
      });
      return;
    }

    // Fallback: direct Notification API (shows even when tab is visible)
    const n = new Notification(title, {
      body: options.body || '',
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag || `vaf_${Date.now()}`,
      silent: options.silent ?? false,
      data: options.data,
    });

    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000);

    // Focus window when clicked
    n.onclick = () => {
      window.focus();
      if (options.url) window.location.href = options.url;
      n.close();
    };
  } catch (e) {
    console.warn('Browser notification error:', e);
  }
}

// ── Typed helper: General notification (Bell icon) ──
export function notifyGeneral(title: string, body: string, type: string = 'general'): void {
  const emoji = ICONS[type] || ICONS.general;
  showBrowserNotification(`${emoji} ${title}`, {
    body,
    tag: `notif_general_${Date.now()}`,
  });
}

// ── Typed helper: New signal ──
export function notifyNewSignal(pair: string, direction: string, type: string = 'forex'): void {
  const typeEmoji = type === 'gold' ? '🥇' : type === 'crypto' ? '₿' : '💱';
  const dirEmoji = direction === 'BUY' ? '📈' : '📉';
  showBrowserNotification(`${typeEmoji} New Signal: ${pair}`, {
    body: `${dirEmoji} ${direction} signal just posted — tap to view`,
    tag: `signal_${pair}_${Date.now()}`,
  });
}

// ── Typed helper: Direct message ──
export function notifyDirectMessage(senderName: string, preview: string): void {
  showBrowserNotification(`💬 ${senderName}`, {
    body: preview.length > 80 ? preview.slice(0, 80) + '…' : preview,
    tag: `dm_${senderName}`,
  });
}

// ── Typed helper: VIP Room message ──
export function notifyVIPRoomMessage(senderName: string, preview: string): void {
  showBrowserNotification(`👑 VIP Room — ${senderName}`, {
    body: preview.length > 80 ? preview.slice(0, 80) + '…' : preview,
    tag: 'viproom_msg',
  });
}

// ── Typed helper: VIP expiry / upgrade ──
export function notifyVIPStatus(title: string, body: string): void {
  showBrowserNotification(`👑 ${title}`, {
    body,
    tag: 'vip_status',
  });
}

// ── Typed helper: App update ──
export function notifyAppUpdate(version: string): void {
  showBrowserNotification(`📱 App Update Available`, {
    body: `Version ${version} is ready to download`,
    tag: 'app_update',
  });
}

// ── Typed helper: Announcement ──
export function notifyAnnouncement(title: string, body: string): void {
  showBrowserNotification(`📢 ${title}`, {
    body,
    tag: 'announcement',
  });
}

// ── Typed helper: Course update ──
export function notifyCourseUpdate(title: string, body: string): void {
  showBrowserNotification(`🎓 ${title}`, {
    body,
    tag: 'course_update',
  });
}

// ── Typed helper: New referral reward ──
export function notifyReferralReward(body: string): void {
  showBrowserNotification(`🎁 Referral Reward!`, {
    body,
    tag: 'referral_reward',
  });
}
