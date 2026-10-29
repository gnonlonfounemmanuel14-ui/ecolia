// Edge Function « fedapay-webhook » : reçoit les notifications de FedaPay.
// IMPORTANT : désactiver « Verify JWT » pour cette fonction (FedaPay n'envoie pas de jeton Supabase).
// Sécurité : on ne croit jamais le contenu reçu. On retrouve NOTRE paiement, puis on redemande
// l'état réel de la transaction à FedaPay avec la clé secrète, et on compare le montant.
import { createClient } from 'npm:@supabase/supabase-js@2.108.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FEDAPAY_KEY = Deno.env.get('FEDAPAY_SECRET_KEY')!;
const API = Deno.env.get('FEDAPAY_ENV') === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';

const ok = () => new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function mapStatus(status: unknown): 'approved' | 'declined' | 'canceled' | 'pending' {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved' || s === 'transferred') return 'approved';
  if (s === 'declined' || s === 'expired') return 'declined';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'pending';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const event = await req.json().catch(() => null);
  const name = String(event?.name ?? event?.type ?? '');
  if (!name.startsWith('transaction.')) return ok();

  const rawId = event?.entity?.id ?? (typeof event?.object === 'object' ? event.object?.id : undefined) ?? event?.data?.id;
  const txId = String(rawId ?? '');
  if (!/^\d+$/.test(txId)) return ok();

  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) Est-ce l'un de NOS paiements ? Sinon on ignore (aucun appel externe).
  const { data: subscription } = await service.from('payments').select('id, amount_fcfa').eq('provider_ref', txId).maybeSingle();
  let fees: { amount_fcfa: number }[] = [];
  if (!subscription) {
    const { data } = await service.from('student_payments').select('amount_fcfa').eq('provider_ref', txId);
    fees = data ?? [];
    if (fees.length === 0) return ok();
  }

  // 2) La vérité vient de l'API FedaPay, pas du message reçu.
  const response = await fetch(`${API}/transactions/${txId}`, { headers: { Authorization: `Bearer ${FEDAPAY_KEY}` } });
  if (!response.ok) return new Response('provider_unavailable', { status: 502 }); // FedaPay réessaiera
  const data = await response.json().catch(() => null);
  const tx = data?.['v1/transaction'] ?? data?.transaction ?? data;
  const status = mapStatus(tx?.status);
  if (status === 'pending') return ok();

  // 3) Le montant payé doit correspondre exactement à ce que nous avons demandé.
  const expected = subscription ? subscription.amount_fcfa : fees.reduce((sum, row) => sum + row.amount_fcfa, 0);
  if (status === 'approved' && Number(tx?.amount) !== Number(expected)) {
    console.error('Montant inattendu', { txId, expected, received: tx?.amount });
    return ok();
  }

  const { error } = subscription
    ? await service.rpc('apply_subscription_payment', { p_payment: subscription.id, p_status: status })
    : await service.rpc('apply_fee_payment', { p_ref: txId, p_status: status });
  if (error) {
    console.error('apply payment', error);
    return new Response('server_error', { status: 500 }); // FedaPay réessaiera
  }
  return ok();
});
