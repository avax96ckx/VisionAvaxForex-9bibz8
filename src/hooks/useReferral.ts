import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useReferral() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;

    // Store referral code
    sessionStorage.setItem('referral_code', ref);

    // Track click
    supabase.from('referral_events').insert({ referral_code: ref, event_type: 'click' });

    // Update click count
    supabase.rpc('increment_referral_clicks', { code: ref }).catch(() => {
      supabase.from('referral_links').select('clicks').eq('code', ref).single().then(({ data }) => {
        if (data) supabase.from('referral_links').update({ clicks: (data.clicks || 0) + 1 }).eq('code', ref);
      });
    });
  }, []);
}
