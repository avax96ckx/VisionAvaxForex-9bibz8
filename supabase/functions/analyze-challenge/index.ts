import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { challengeId } = await req.json();
    if (!challengeId) return new Response(JSON.stringify({ error: 'challengeId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load API key: check DB first, fall back to env
    const { data: settingsForKey } = await supabase.from('site_settings').select('api_keys').eq('id', 'main').single();
    const dbApiKey = ((settingsForKey?.api_keys as any)?.groq) ?? '';
    const apiKey = dbApiKey || (Deno.env.get('GROQ_API_KEY') ?? '');
    const baseUrl = 'https://api.groq.com/openai/v1';

    // Get all pairs with result images
    const { data: pairs } = await supabase
      .from('challenge_pairs')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('result_published', true)
      .not('result_image_url', 'is', null);

    if (!pairs || pairs.length === 0) {
      return new Response(JSON.stringify({ error: 'No pairs with results found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get all unprocessed submissions for these pairs
    const pairIds = pairs.map((p: any) => p.id);
    const { data: submissions } = await supabase
      .from('challenge_submissions')
      .select('*, user_profiles(username)')
      .in('pair_id', pairIds)
      .not('analysis_image_url', 'is', null)
      .eq('is_processed', false);

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ message: 'No submissions to process' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process each submission
    let processed = 0;
    for (const sub of submissions) {
      const pair = pairs.find((p: any) => p.id === sub.pair_id);
      if (!pair || !pair.result_image_url || !sub.analysis_image_url) continue;

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://visionavaxforex.onspace.app',
            'X-Title': 'VISION AVAX FOREX',
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              {
                role: 'system',
                content: `You are a Forex trading expert judge for a trading challenge. 
                Your job is to analyze a participant's chart analysis and compare it with the actual result.
                
                Rules:
                - Look at the participant's analysis image (entry, stop loss, take profit levels)
                - Compare with the result image (actual price movement)
                - Determine if the trade would be a WIN or LOSS
                - Estimate pips gained (positive) or lost (negative)
                
                Respond ONLY with a JSON object in this exact format:
                {"is_win": true/false, "pips": 45.5, "reasoning": "Brief explanation"}
                
                For pips calculation:
                - If WIN: positive number (typical forex pip range: 10-200 pips)
                - If LOSS: negative number (typical: -10 to -100 pips)
                - If analysis image is unclear or no clear trade setup: {"is_win": false, "pips": 0, "reasoning": "No clear setup found"}`,
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Pair: ${pair.pair_name}. First image is participant's analysis. Second image is the actual result. Analyze and return JSON.` },
                  { type: 'image_url', image_url: { url: sub.analysis_image_url } },
                  { type: 'image_url', image_url: { url: pair.result_image_url } },
                ],
              },
            ],
            max_tokens: 200,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown');
          console.error('Groq challenge error:', response.status, errText);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        // Parse JSON from AI response
        let result = { is_win: false, pips: 0 };
        try {
          const jsonMatch = content.match(/\{[^}]+\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
        } catch {
          // Default to 0 pips if parsing fails
        }

        // Update submission
        await supabase.from('challenge_submissions').update({
          pips_gained: result.pips || 0,
          is_win: result.is_win || false,
          is_processed: true,
        }).eq('id', sub.id);

        processed++;
      } catch (err) {
        console.error('Error processing submission:', sub.id, err);
      }
    }

    // Recalculate total pips per participant
    const { data: allSubs } = await supabase
      .from('challenge_submissions')
      .select('user_id, pips_gained')
      .eq('challenge_id', challengeId)
      .eq('is_processed', true);

    if (allSubs) {
      const pipsByUser: Record<string, number> = {};
      for (const s of allSubs) {
        pipsByUser[s.user_id] = (pipsByUser[s.user_id] || 0) + (s.pips_gained || 0);
      }

      for (const [userId, totalPips] of Object.entries(pipsByUser)) {
        await supabase.from('challenge_participants').update({ total_pips: totalPips })
          .eq('challenge_id', challengeId).eq('user_id', userId);
      }

      // Calculate and update ranks
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('id, user_id, total_pips')
        .eq('challenge_id', challengeId)
        .order('total_pips', { ascending: false });

      if (participants) {
        for (let i = 0; i < participants.length; i++) {
          await supabase.from('challenge_participants').update({ rank: i + 1 }).eq('id', participants[i].id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('analyze-challenge error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
