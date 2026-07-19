import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Load API key: check DB first, fall back to env
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: settingsData } = await supabaseAdmin
      .from('site_settings')
      .select('api_keys')
      .eq('id', 'main')
      .single();
    const dbGroqKey = (settingsData?.api_keys?.groq) ?? '';
    const dbOpenRouterKey = (settingsData?.api_keys?.openrouter) ?? '';
    const groqKey = dbGroqKey || (Deno.env.get('GROQ_API_KEY') ?? '');
    const openRouterKey = dbOpenRouterKey || (Deno.env.get('OPENROUTER_API_KEY') ?? '');

    const { imageUrl, mode } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SYSTEM PROMPTS ──────────────────────────────────────────────
    const systemPrompt = mode === 'result'
      ? `You are a professional forex trade result analyst. Analyze this trading result screenshot.

EXTRACT:
- result: "win" if profit/green, "loss" if loss/red
- pips: exact pips with sign (e.g. "+45" or "-20"). Calculate from price difference if not shown.
- notes: One sentence describing what happened (max 12 words)

Respond ONLY with this exact JSON format — no extra text, no markdown:
{"result":"win","pips":"+45","notes":"TP hit at resistance, clean breakout entry"}

RULES:
- result must be exactly "win" or "loss"
- pips must include "+" for win, "-" for loss
- If values are unclear, use empty string ""`

      : `You are an expert TradingView chart signal extractor. Analyze this forex/gold/crypto chart screenshot.

EXTRACT ALL signal parameters with maximum accuracy.

DIRECTION DETECTION (CRITICAL):
- Green/up arrow OR "Long" OR "Buy" label = "BUY"
- Red/down arrow OR "Short" OR "Sell" label = "SELL"
- If stop_loss > entry → SELL (price must go DOWN to hit SL above entry)
- If stop_loss < entry → BUY (price must go UP, SL is below)
- Double-check: BUY means entry < take_profit, SELL means entry > take_profit

EXTRACT:
- pair: exact trading pair (e.g. "EUR/USD", "XAU/USD", "BTC/USDT")
- direction: "BUY" or "SELL"
- type: "forex" for currencies, "gold" for XAU/GOLD, "crypto" for BTC/ETH/etc
- entry: entry price as string number
- stop_loss: stop loss price as string number
- take_profit: take profit price as string number (first TP if multiple)
- notes: brief analysis in max 12 words

Respond ONLY with this exact JSON format — no extra text, no markdown:
{"pair":"XAU/USD","direction":"BUY","type":"gold","entry":"2315.50","stop_loss":"2298.00","take_profit":"2345.00","notes":"Bullish OB entry, strong momentum above key level"}

RULES:
- NEVER add text outside the JSON
- If a value is not visible, use empty string ""`;

    const userMsg = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: mode === 'result'
            ? 'Analyze this trade result screenshot and extract the outcome:'
            : 'Analyze this TradingView chart and extract all signal parameters:',
        },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    };

    let rawText = '';
    let usedProvider = 'groq';

    // ── Try OpenRouter first (Gemini 2.5 Flash — best vision accuracy) ──
    if (openRouterKey) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://visionavaxforex.onspace.app',
            'X-Title': 'VISION AVAX FOREX',
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile"
            messages: [{ role: 'system', content: systemPrompt }, userMsg],
            temperature: 0.05,
            max_tokens: 300,
          }),
        });
        if (orRes.ok) {
          const orData = await orRes.json();
          rawText = orData.choices?.[0]?.message?.content ?? '';
          usedProvider = 'openrouter';
          console.log('analyze-signal: used OpenRouter Gemini 2.5 Flash');
        } else {
          const errTxt = await orRes.text().catch(() => '');
          console.warn('OpenRouter failed, falling back to Groq:', orRes.status, errTxt.slice(0, 150));
        }
      } catch (orErr) {
        console.warn('OpenRouter error, falling back to Groq:', String(orErr));
      }
    }

    // ── Fallback to Groq (Llama 4 Scout — vision capable) ──
    if (!rawText) {
      if (!groqKey) {
        return new Response(JSON.stringify({ error: 'No API key configured. Add Groq or OpenRouter key in Admin → API Keys.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
          'HTTP-Referer': 'https://visionavaxforex.onspace.app',
          'X-Title': 'VISION AVAX FOREX',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'system', content: systemPrompt }, userMsg],
          temperature: 0.05,
          max_tokens: 256,
        }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text().catch(() => 'Unknown');
        console.error('Groq error:', aiRes.status, errText);
        return new Response(JSON.stringify({ error: `Groq: ${aiRes.status} — ${errText.slice(0, 200)}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const aiData = await aiRes.json();
      rawText = aiData.choices?.[0]?.message?.content ?? '';
      usedProvider = 'groq';
      console.log('analyze-signal: used Groq Llama 4 Scout');
    }

    // Parse JSON from response
    let parsed: Record<string, string> = {};
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || rawText.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

        // Normalize direction
        if (parsed.direction) {
          const d = parsed.direction.toUpperCase().trim();
          parsed.direction = (d === 'SELL' || d === 'SHORT' || d === 'S') ? 'SELL' : 'BUY';
        }

        // Auto-correct direction based on SL vs entry logic
        if (parsed.entry && parsed.stop_loss) {
          const entry = parseFloat(parsed.entry);
          const sl = parseFloat(parsed.stop_loss);
          if (!isNaN(entry) && !isNaN(sl)) {
            if (sl > entry && parsed.direction === 'BUY') parsed.direction = 'SELL';
            else if (sl < entry && parsed.direction === 'SELL') parsed.direction = 'BUY';
          }
        }

        // Auto-detect type from pair
        if (parsed.pair) {
          const p = parsed.pair.toUpperCase();
          if (p.includes('XAU') || p.includes('GOLD')) parsed.type = 'gold';
          else if (['BTC', 'ETH', 'USDT', 'DOGE', 'SOL', 'BNB', 'XRP'].some(c => p.includes(c))) parsed.type = 'crypto';
          else if (!parsed.type) parsed.type = 'forex';
        }
      }
    } catch (e) {
      console.error('JSON parse error:', e, 'raw text:', rawText.slice(0, 300));
      parsed = {};
    }

    return new Response(JSON.stringify({ success: true, data: parsed, provider: usedProvider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('analyze-signal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
