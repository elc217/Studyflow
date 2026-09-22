import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Unauthorized' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || profile?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const { action, userId, email, password, displayName } = await request.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (action === 'list_confirmation_status') {
    const users = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) return json({ error: error.message }, 500);
      users.push(...data.users);
      if (data.users.length < perPage) break;
      page += 1;
    }
    return json({ users: users.map((account) => ({
      id: account.id,
      emailConfirmedAt: account.email_confirmed_at,
    })) });
  }

  if (action === 'confirm_user' && typeof userId === 'string') {
    if (userId === user.id) return json({ error: 'No puedes modificar tu propia confirmación.' }, 400);
    const { error } = await adminClient.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === 'create_user') {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const temporaryPassword = typeof password === 'string' ? password : '';
    const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return json({ error: 'Indica un email válido.' }, 400);
    if (temporaryPassword.length < 10) return json({ error: 'La contraseña provisional debe tener al menos 10 caracteres.' }, 400);

    const { data, error } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: normalizedDisplayName ? { full_name: normalizedDisplayName } : {},
    });
    if (error || !data.user) return json({ error: error?.message || 'No se pudo crear la cuenta.' }, 500);

    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({
        display_name: normalizedDisplayName || null,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.user.id);
    if (profileUpdateError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      return json({ error: profileUpdateError.message }, 500);
    }
    return json({ id: data.user.id, email: normalizedEmail });
  }

    return json({ error: 'Invalid action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno no identificado.';
    console.error('Error en admin-user-management:', error);
    return json({ error: `Error interno de administración: ${message}` }, 500);
  }
});