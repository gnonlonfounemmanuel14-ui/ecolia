// Page « Votre paiement » : lit l’état du paiement dans la base (jamais dans l’adresse de la page).
// Le statut passe à « approuvé » uniquement lorsque FedaPay le confirme au serveur (phase 2).
import { plans } from './plans.js';
import { supabase, isConfigured, getUser, getState, dashboardUrl } from './auth-shared.js';

const POLL_MS = 3000;
const MAX_TRIES = 20; // environ une minute de vérification

const title = document.querySelector('[data-result-title]');
const text = document.querySelector('[data-result-text]');
const actions = document.querySelector('[data-result-actions]');

if (title && text && actions) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Retourne { status: 'pending' | 'active' | 'failed', plan?, state? }.
  async function readStatus() {
    const state = await getState();
    const { data, error } = await supabase
      .from('payments')
      .select('status, plan_id')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const last = data && data[0];
    if (!last) return state.plan ? { status: 'active', plan: state.plan, state } : { status: 'failed', state };
    if (last.status === 'pending') return { status: 'pending', state };
    if (last.status === 'approved') {
      return state.plan === last.plan_id
        ? { status: 'active', plan: last.plan_id, state }
        : { status: 'pending', state };
    }
    return { status: 'failed', state };
  }

  function link(label, href, style) {
    const a = document.createElement('a');
    a.className = `btn ${style}`;
    a.href = href;
    a.textContent = label;
    return a;
  }

  function button(label, style, onClick) {
    const b = document.createElement('button');
    b.className = `btn ${style}`;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function render(heading, message, buttons = []) {
    title.textContent = heading;
    text.textContent = message;
    actions.replaceChildren(...buttons);
  }

  async function check() {
    render('Vérification du paiement…', 'Veuillez patienter quelques instants. Ne fermez pas cette page.');
    try {
      if (!isConfigured) throw new Error('not-configured');
      if (!(await getUser())) {
        location.replace('login.html');
        return;
      }
    } catch {
      render('Service indisponible', 'Le service est momentanément indisponible. Réessayez plus tard.', [
        link('Nous contacter', 'contact.html', 'secondary'),
      ]);
      return;
    }
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      try {
        const result = await readStatus();
        if (result.status === 'active') {
          const plan = plans.find((p) => p.id === result.plan);
          render(
            'Paiement confirmé',
            plan
              ? `Votre abonnement ${plan.name} est activé. Vous pouvez accéder à votre tableau de bord.`
              : 'Votre abonnement est activé. Vous pouvez accéder à votre tableau de bord.',
            [link('Accéder à mon tableau de bord', dashboardUrl(result.state), 'green')]
          );
          return;
        }
        if (result.status === 'failed') {
          render(
            'Paiement non abouti',
            'Votre paiement n’a pas abouti. Si une somme a été débitée, contactez-nous en indiquant la référence de votre transaction.',
            [
              link('Choisir une formule', 'choose-plan.html?change=1', 'green'),
              link('Nous contacter', 'contact.html', 'secondary'),
            ]
          );
          return;
        }
      } catch {
        // Erreur réseau passagère : on réessaie au prochain tour.
      }
      await sleep(POLL_MS);
    }
    render(
      'Paiement en cours de vérification',
      'La confirmation peut prendre quelques minutes. Votre abonnement s’activera automatiquement dès qu’elle arrive : vous pouvez aussi revenir plus tard.',
      [button('Vérifier à nouveau', 'green', check), link('Nous contacter', 'contact.html', 'secondary')]
    );
  }

  check();
}
