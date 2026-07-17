/**
 * AdminSetup — runs once silently in the background to ensure
 * the admin account (visionavaxforex@gmail.com / avax1975) is ready.
 * Calls the set-admin-password edge function on first app load.
 * Safe to keep: it only runs when the setup hasn't been done yet.
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SETUP_KEY = 'vaf_admin_setup_done_v2';

export default function AdminSetup() {
  useEffect(() => {
    // Only run once per browser
    if (localStorage.getItem(SETUP_KEY)) return;

    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('set-admin-password', {
          body: {},
        });
        if (!error && data?.success) {
          localStorage.setItem(SETUP_KEY, '1');
          console.log('[AdminSetup] Admin account ready:', data.userId);
        } else {
          console.warn('[AdminSetup] Setup issue:', error || data?.error);
        }
      } catch (e) {
        console.warn('[AdminSetup] Error:', e);
      }
    };

    // Slight delay to not block initial render
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, []);

  return null; // No UI
}
