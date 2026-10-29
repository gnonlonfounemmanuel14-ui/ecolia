import { plans, formatPlanPrice } from './plans.js';

const grid = document.querySelector('[data-plan-grid]');

// Texte du bouton de chaque formule : modifiez-le librement.
const cta = {
  free: 'Profiter de l’offre gratuite',
  standard: 'Choisir Standard',
  professional: 'Choisir Professionnelle',
  unlimited: 'Choisir Illimitée',
};

if (grid) {
  grid.innerHTML = plans
    .map((plan) => {
      const buttonClass = plan.monthlyPrice === 0 ? 'is-ghost' : 'is-light';
      return `<article class="plan-card" data-plan-id="${plan.id}">
        <h2 class="plan-name">${plan.name}</h2>
        <p class="plan-price"><sup>FCFA</sup><strong>${formatPlanPrice(plan.monthlyPrice)}</strong><span>/ mois</span></p>
        <p class="plan-limit">${plan.capacityLabel}</p>
        <a class="plan-btn ${buttonClass}" href="register-school.html?plan=${plan.id}">${cta[plan.id]}</a>
      </article>`;
    })
    .join('');
}