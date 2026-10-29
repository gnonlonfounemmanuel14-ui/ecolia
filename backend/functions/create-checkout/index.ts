// Edge Function « create-checkout » : paiement de l'abonnement d'une école avec FedaPay.
// Appelée par le site : supabase.functions.invoke('create-checkout', { body: { plan } })
// Secrets à définir : FEDAPAY_SECRET_KEY, FEDAPAY_ENV (sandbox ou live), SITE_URL.
import { createClient } from 'npm:@supabase/supabase-js@2.108.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FEDAPAY_KEY = Deno.env.get('FEDAPAY_SECRET_KEY')!;
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');
const API = Deno.env.get('FEDAPAY_ENV') === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function fedapay(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${FEDAPAY_KEY}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  let body: { plan?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  // Le prix et les règles (capacité, doublon) sont décidés par la base.
  const { data: prep, error: prepError } = await userClient.rpc('prepare_checkout', { p_plan: String(body?.plan ?? '') });
  if (prepError) {
    const reason = `${prepError.message}`;
    if (reason.includes('capacity_exceeded')) return json({ error: 'capacity_exceeded' }, 422);
    if (reason.includes('already_active') || reason.includes('downgrade_not_allowed')) return json({ error: reason }, 409);
    if (reason.includes('invalid_plan')) return json({ error: 'invalid_plan' }, 400);
    if (reason.includes('no_school')) return json({ error: 'no_school' }, 403);
    console.error('prepare_checkout', prepError);
    return json({ error: 'server_error' }, 500);
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cancel = () => service.from('payments').update({ status: 'canceled' }).eq('id', prep.payment_id);

  const fullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim();
  const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const created = await fedapay('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      description: `Ecolia ${prep.plan_name} - ${prep.school_name}`,
      amount: prep.amount,
      currency: { iso: 'XOF' },
      callback_url: `${SITE_URL}/pages/payment-result.html`,
      customer: { firstname: first || 'Directeur', lastname: rest.join(' ') || prep.school_name, email: user.email },
    }),
  });
  const tx = created.data?.['v1/transaction'] ?? created.data?.transaction ?? created.data;
  if (!created.ok || !tx?.id) {
    console.error('fedapay create', created.data);
    await cancel();
    return json({ error: 'provider_error' }, 502);
  }

  const token = await fedapay(`/transactions/${tx.id}/token`, { method: 'POST' });
  const url = token.data?.url ?? token.data?.['v1/token']?.url ?? token.data?.token?.url;
  if (!token.ok || typeof url !== 'string' || !url.startsWith('https://')) {
    console.error('fedapay token', token.data);
    await cancel();
    return json({ error: 'provider_error' }, 502);
  }

  await service.from('payments').update({ provider_ref: String(tx.id) }).eq('id', prep.payment_id);
  return json({ checkoutUrl: url });
});
