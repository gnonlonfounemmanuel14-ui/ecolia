import { plans, formatPlanPrice } from './plans.js';
import {
  supabase,
  isConfigured,
  getUser,
  getState,
  dashboardUrl,
  authLinkError,
} from './auth-shared.js';

const grid = document.querySelector('[data-plan-grid]');
const message = document.querySelector('[data-plan-message]');
const changeMode = new URLSearchParams(location.search).has('change');

const labels = {
  free: 'Pour commencer',
  standard: 'Standard',
  professional: 'Professionnelle',
  unlimited: 'Sans limite d’élèves',
};
const details = {
  free: 'Pour démarrer sans payer et découvrir Ecolia avec votre école.',
  standard: 'Pour les établissements qui accueillent davantage d’élèves.',
  professional: 'Pour les établissements de grande taille.',
  unlimited: 'Pour les établissements sans plafond d’effectif.',
};
const cta = {
  free: 'Profiter de l’offre gratuite',
  standard: 'Choisir Standard',
  professional: 'Choisir Professionnelle',
  unlimited: 'Choisir Illimitée',
};

let busy = false;
let currentPlan = null;
let currentState = null;

const show = (text, isError = false) => {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
  message.hidden = false;
};

function render(currentPlan) {
  grid.innerHTML = plans
    .map((plan) => {
      const isCurrent = plan.id === currentPlan;
      const featured = plan.id === 'professional';
      const style = plan.monthlyPrice === 0 || featured ? 'green' : 'secondary';
      return `<article class="card price-card${featured ? ' price-card-featured' : ''}">
        <span class="label">${labels[plan.id]}</span>
        <h2>${plan.name}</h2>
        <p class="plan-price"><strong>${formatPlanPrice(plan.monthlyPrice)} FCFA</strong> <span>/ mois</span></p>
        <p class="plan-capacity">${plan.capacityLabel}</p>
        <p class="plan-details">${details[plan.id]}</p>
        <button class="btn ${style}" type="button" data-plan="${plan.id}"${isCurrent ? ' data-current disabled' : ''}>
          ${isCurrent ? 'Formule actuelle' : cta[plan.id]}
        </button>
      </article>`;
    })
    .join('');
}

function setButtons(disabled) {
  grid.querySelectorAll('button[data-plan]').forEach((button) => {
    button.disabled = disabled || button.hasAttribute('data-current');
  });
}

async function choose(planId) {
  if (busy) return;
  const free = planId === 'free';
  // Retour à la formule Gratuite depuis une formule payante : pas disponible pour l’instant.
  if (free && currentPlan && currentPlan !== 'free') {
    show('Le retour à la formule Gratuite n’est pas disponible pour le moment.', true);
    return;
  }
  busy = true;
  setButtons(true);
  show(free ? 'Activation de votre formule…' : 'Redirection vers la page de paiement sécurisée…');
  try {
    if (free) {
      const { error } = await supabase.rpc('activate_free_plan');
      if (!error) {
        location.assign(dashboardUrl(currentState));
        return;
      }
      if (error.code === '28000' || error.message === 'not_authenticated') {
        location.replace('login.html');
        return;
      }
      if (error.code === 'P0002' || error.message === 'no_school') {
        location.replace('school-name.html');
        return;
      }
      show('Le service est momentanément indisponible. Réessayez plus tard.', true);
    } else {
      // Fonction serveur « create-checkout » (phase 2) : le prix est calculé côté serveur.
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planId },
      });
      if (!error && data && typeof data.checkoutUrl === 'string') {
        // Sécurité : on n’accepte qu’une adresse HTTPS pour la page de paiement.
        const url = new URL(data.checkoutUrl, location.origin);
        if (url.protocol === 'https:') {
          location.assign(url.href);
          return;
        }
      }
      const status = error && error.context && error.context.status;
      if (status === 409) show('Cette formule est déjà active sur votre compte.', true);
      else if (status === 422)
        show('Votre nombre d’élèves actuel dépasse la capacité de cette formule. Choisissez une formule supérieure.', true);
      else show('Le paiement est momentanément indisponible. Réessayez plus tard ou démarrez avec la formule Gratuite.', true);
    }
  } catch {
    show('Connexion impossible. Vérifiez votre réseau et réessayez.', true);
  }
  busy = false;
  setButtons(false);
}

async function init() {
  try {
    // Lien e-mail expiré ou déjà utilisé : Supabase renvoie l’erreur dans l’adresse.
    if (authLinkError()) {
      location.replace('verify-email.html?status=expired');
      return;
    }
    if (!isConfigured) throw new Error('not-configured');
    const user = await getUser();
    if (!user) {
      location.replace('login.html');
      return;
    }
    const state = await getState();
    currentState = state;
    if (state.platformAdmin) {
      location.replace(dashboardUrl(state));
      return;
    }
    if (!state.hasSchool) {
      location.replace('school-name.html');
      return;
    }
    // Seule la direction choisit l’abonnement ; les autres rôles vont à leur espace.
    if (state.role !== 'director' || (state.plan && !changeMode)) {
      location.replace(dashboardUrl(state));
      return;
    }
    currentPlan = state.plan || null;
    render(currentPlan);
  } catch {
    show('Le service est momentanément indisponible. Réessayez plus tard.', true);
  }
}

if (changeMode) document.querySelector('[data-back-row]')?.removeAttribute('hidden');

if (grid && message) {
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-plan]');
    if (button && !button.disabled) choose(button.dataset.plan);
  });
  init();
}