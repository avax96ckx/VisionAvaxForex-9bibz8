import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PASSWORD = 'avax1975';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Load API key: check DB first, fall back to env
  const { data: settingsForKey } = await supabaseAdmin.from('site_settings').select('api_keys').eq('id', 'main').single();
  const dbApiKey = (settingsForKey?.api_keys?.groq) ?? '';
  const apiKey = dbApiKey || (Deno.env.get('GROQ_API_KEY') ?? '');
  const baseUrl = 'https://api.groq.com/openai/v1';

  // Fetch live data
  const [settingsRes, versionRes, signalsRes] = await Promise.all([
    supabaseAdmin.from('site_settings').select('*').eq('id', 'main').single(),
    supabaseAdmin.from('app_versions').select('*').eq('is_latest', true).maybeSingle(),
    supabaseAdmin.from('signals').select('pair,direction,type,status,entry,take_profit,stop_loss').eq('status', 'active').limit(8),
  ]);

  const settings = settingsRes.data;
  const latestVersion = versionRes.data;
  const activeSignals = signalsRes.data || [];

  const websiteName = settings?.website_name || 'VISION AVAX FOREX';
  const whatsappNumber = settings?.whatsapp_number || '+255746715235';
  const paymentName = settings?.payment_name || 'LAURENT MATABAZI';
  const paymentNumber = settings?.payment_number || '+255746715235';
  const paymentNetwork = settings?.payment_network || 'M-Pesa';
  const agentName = settings?.agent_name || 'AVAX Support';
  const heroTitle = settings?.hero_title || 'Trade Smart. Live Better.';
  const heroSub = settings?.hero_subtitle || 'Professional Forex Signals & Premium Trading Education';
  const customInstructions = settings?.ai_support_instructions || '';
  const socialLinks = settings?.social_links || {};
  const plans: any[] = settings?.vip_plans || [];
  const appVersion = latestVersion?.version_name || '';
  const appUrl = latestVersion?.apk_url || '';

  const plansText = plans.length > 0
    ? plans.map((p: any) => `• ${p.name} (${p.duration}): $${p.price} USD`).join('\n')
    : '• Daily: $2\n• Weekly: $10\n• Monthly: $30\n• 3 Months: $75\n• 6 Months: $130\n• Yearly: $200\n• Lifetime: $350';

  const signalsText = activeSignals.length > 0
    ? activeSignals.map((s: any) => `${s.pair} ${s.direction} @ ${s.entry} | TP: ${s.take_profit} | SL: ${s.stop_loss}`).join('\n')
    : 'No active signals right now';

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { messages, isAdmin: isAdminMode, adminVerified, passwordAttempt } = body;

  // Password verification endpoint
  if (passwordAttempt !== undefined) {
    return new Response(JSON.stringify({ passwordCorrect: String(passwordAttempt).trim() === ADMIN_PASSWORD }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const isEffectiveAdmin = isAdminMode && adminVerified;

  // ── SYSTEM PROMPTS ──────────────────────────────────────────────
  const systemPrompt = isEffectiveAdmin
    ? `You are the AI Admin Assistant for ${websiteName} — an intelligent admin control panel.

## LIVE WEBSITE DATA (as of right now):
- Website Name: ${websiteName}
- Hero Title: "${heroTitle}"
- Hero Subtitle: "${heroSub}"
- Agent Name: ${agentName}
- WhatsApp: ${whatsappNumber}
- Payment: ${paymentName} | ${paymentNumber} | ${paymentNetwork}
- App: ${appVersion ? `v${appVersion} — ${appUrl}` : 'Not configured'}
- Social: Telegram: ${socialLinks?.telegram || 'N/A'} | YouTube: ${socialLinks?.youtube || 'N/A'} | Instagram: ${socialLinks?.instagram || 'N/A'}
- VIP Plans:
${plansText}
- Active Signals (${activeSignals.length}):
${signalsText}

## DATABASE UPDATE CAPABILITIES:
Embed this exact tag in your response to save changes:
<!-- DB:update:site_settings:{"field":"value"} -->

Supported fields: whatsapp_number, hero_title, hero_subtitle, payment_name, payment_number, payment_network, website_name, agent_name, ai_support_instructions, primary_color, secondary_color

Example:
- User: "Badilisha WhatsApp kuwa +255712345678"
  → Your response: "✅ WhatsApp imebadilishwa!\n<!-- DB:update:site_settings:{"whatsapp_number":"+255712345678"} -->"

## RULES:
1. Always embed DB command when user asks to change data
2. Be concise and direct — no long explanations
3. Confirm changes with ✅ and the exact new value
4. Respond in the same language as the user (Swahili/English)
5. For tasks you can't do (e.g. upload images, add signals): guide admin to the relevant admin panel section
6. You can read all platform stats and provide summaries on request`

    : `You are ${agentName} — the AI support assistant for ${websiteName}, a professional forex trading signals platform.

## YOUR LIVE DATA (ONLY use these values — never invent anything):
- WhatsApp: ${whatsappNumber}
- WhatsApp Link: https://wa.me/${whatsappNumber.replace(/\D/g, '')}
- Pay to: ${paymentName} | ${paymentNumber} | via ${paymentNetwork}
${appVersion ? `- App: v${appVersion}` : ''}${appUrl ? `\n- App Download: ${appUrl}` : ''}
${socialLinks?.telegram ? `- Telegram: ${socialLinks.telegram}` : ''}
${socialLinks?.youtube ? `- YouTube: ${socialLinks.youtube}` : ''}
${socialLinks?.instagram ? `- Instagram: ${socialLinks.instagram}` : ''}

## VIP MEMBERSHIP PLANS (exact current prices):
${plansText}

## ACTIVE SIGNALS RIGHT NOW:
${signalsText}
${customInstructions ? `\n## CUSTOM INSTRUCTIONS:\n${customInstructions}\n` : ''}

## RULES:
1. NEVER make up phone numbers, links, prices, or data not listed above
2. Keep answers short and helpful — max 3-4 lines unless a detailed explanation is asked
3. Payment instructions: always give EXACTLY "${paymentName}, ${paymentNumber}, ${paymentNetwork}"
4. Always use exact prices from VIP Plans above
5. WhatsApp link: https://wa.me/${whatsappNumber.replace(/\D/g, '')}
6. Respond in the user's language (Swahili or English)
7. Don't re-introduce yourself every message — only when directly asked "who are you"
8. If user asks about signals: share current active signals from the list above`;

  // Call Groq Cloud AI
  const aiRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://visionavaxforex.onspace.app',
      'X-Title': 'VISION AVAX FOREX',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...(messages || []).slice(-20),
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => 'Unknown error');
    console.error('Groq Cloud error:', aiRes.status, errText);
    return new Response(JSON.stringify({ error: `Groq Cloud: ${aiRes.status} — ${errText.slice(0, 200)}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const aiData = await aiRes.json();
  const rawText: string = aiData.choices?.[0]?.message?.content ?? '';

  // Execute DB update commands
  const dbChanges: string[] = [];
  const dbPattern = /<!--\s*DB:update:(\w+):(\{[\s\S]*?\})\s*-->/g;
  let m: RegExpExecArray | null;

  while ((m = dbPattern.exec(rawText)) !== null) {
    const [, table, json] = m;
    try {
      const parsed = JSON.parse(json);
      if (table === 'site_settings') {
        const { error } = await supabaseAdmin.from('site_settings').update(parsed).eq('id', 'main');
        if (!error) dbChanges.push(Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join(', '));
        else console.error('DB update error:', error.message);
      }
    } catch (e) { console.error('DB parse error:', e); }
  }

  // Handle DB insert commands
  const insertPattern = /<!--\s*DB:insert:(\w+):(\{[\s\S]*?\})\s*-->/g;
  while ((m = insertPattern.exec(rawText)) !== null) {
    const [, table, json] = m;
    try {
      const parsed = JSON.parse(json);
      const { error } = await supabaseAdmin.from(table).insert(parsed);
      if (!error) dbChanges.push(`inserted:${table}`);
      else console.error('DB insert error:', error.message);
    } catch (e) { console.error('DB insert parse error:', e); }
  }

  const cleanText = rawText.replace(/<!--\s*DB:[\s\S]*?-->/g, '').trim();

  return new Response(JSON.stringify({ text: cleanText, dbChanged: dbChanges.length > 0, dbChanges }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
