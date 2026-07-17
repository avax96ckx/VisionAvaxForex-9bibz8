import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ADMIN_EMAIL = 'visionavaxforex@gmail.com';
    const ADMIN_PASSWORD = 'avax1975';

    // Get user by email
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error('List users failed: ' + listErr.message);

    const adminUser = users.find(u => u.email === ADMIN_EMAIL);

    let userId: string;

    if (adminUser) {
      // User exists — update password and confirm email
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (updateErr) throw new Error('Update failed: ' + updateErr.message);
      userId = adminUser.id;
    } else {
      // Create user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw new Error('Create failed: ' + createErr.message);
      userId = created.user!.id;
    }

    // Ensure user_profiles record exists
    const { error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        email: ADMIN_EMAIL,
        username: 'Admin',
        full_name: 'AVAX Admin',
        is_vip: true,
        blue_tick: true,
        vip_expires_at: '2099-12-31T00:00:00Z',
      }, { onConflict: 'id' });

    if (profileErr) console.warn('Profile upsert warning:', profileErr.message);

    return new Response(
      JSON.stringify({ success: true, userId, message: 'Admin password set successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('set-admin-password error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
