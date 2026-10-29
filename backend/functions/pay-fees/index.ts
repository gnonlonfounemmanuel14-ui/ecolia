// Edge Function « pay-fees » : un parent paie la scolarité d'un ou plusieurs de ses enfants.
// Appelée par le site : supabase.functions.invoke('pay-fees', { body: { studentIds: [...] } })
// ATTENTION : les paiements arrivent sur le compte FedaPay d'Ecolia. Le reversement aux écoles
// n'est pas géré par cette fonction : ne l'activez en mode réel qu'après avoir décidé comment
// les écoles sont payées (voir le README).
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

  let body: { studentIds?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const studentIds = Array.isArray(body?.studentIds) ? (body!.studentIds as unknown[]).map(String) : [];

  // La base calcule les montants restants et vérifie que ces élèves sont bien les enfants du parent.
  const { data: prep, error: prepError } = await userClient.rpc('prepare_fee_checkout', { p_student_ids: studentIds });
  if (prepError) {
    const reason = `${prepError.message}`;
    if (reason.includes('nothing_to_pay')) return json({ error: 'nothing_to_pay' }, 409);
    if (reason.includes('multiple_schools')) return json({ error: 'multiple_schools' }, 422);
    if (reason.includes('invalid_students')) return json({ error: 'invalid_students' }, 400);
    console.error('prepare_fee_checkout', prepError);
    return json({ error: 'server_error' }, 500);
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cancel = () =>
    service.from('student_payments').update({ status: 'canceled' }).eq('provider_ref', prep.temp_ref).eq('status', 'pending');

  const fullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim();
  const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const created = await fedapay('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      description: `Ecolia - scolarite (${prep.students} eleve(s))`,
      amount: prep.amount,
      currency: { iso: 'XOF' },
      callback_url: `${SITE_URL}/pages/payment-result.html?kind=fees`,
      customer: { firstname: first || 'Parent', lastname: rest.join(' ') || 'Ecolia', email: user.email },
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

  // On remplace la référence provisoire par l'identifiant FedaPay, pour que le webhook retrouve ces lignes.
  await service.from('student_payments').update({ provider_ref: String(tx.id) }).eq('provider_ref', prep.temp_ref);
  return json({ checkoutUrl: url });
});
