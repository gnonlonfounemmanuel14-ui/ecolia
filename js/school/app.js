// Tableau de bord de l'école (direction et personnel administratif).
import { supabase, isConfigured, getUser, getState, destinationFor } from '../auth-shared.js';
import { h, describeError } from './ui.js';
import * as home from './views/home.js';
import * as students from './views/students.js';
import * as classes from './views/classes.js';
import * as staff from './views/staff.js';
import * as finance from './views/finance.js';
import * as announcements from './views/announcements.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { id: 'accueil', label: 'Tableau de bord', view: home },
  { id: 'eleves', label: 'Élèves', view: students },
  { id: 'classes', label: 'Classes et matières', view: classes },
  { id: 'personnel', label: 'Personnel', view: staff },
  { id: 'finances', label: 'Finances', view: finance },
  { id: 'annonces', label: 'Annonces', view: announcements },
  { id: 'parametres', label: 'Paramètres', view: settings },
];

const view = document.querySelector('[data-view]');
const nav = document.querySelector('[data-nav]');
let ctx = null;
let token = 0;

function message(title, text, actions = []) {
  view.replaceChildren(h('div', { class: 'card notice-card' }, h('h1', { text: title }), h('p', { text }), h('div', { class: 'dlg-actions' }, actions)));
}

async function show() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0] || 'accueil';
  const route = ROUTES.find((r) => r.id === id) || ROUTES[0];
  const mine = ++token;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.route === route.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  view.replaceChildren(h('p', { class: 'loading', text: 'Chargement…' }));
  try {
    const content = h('div', { class: 'view-content' });
    await route.view.render(content, ctx);
    if (mine !== token) return;
    view.replaceChildren(content);
    view.focus({ preventScroll: true });
  } catch (error) {
    if (mine !== token) return;
    console.error(error);
    view.replaceChildren(
      h('p', { class: 'dlg-error', role: 'alert', text: describeError(error) }),
      h('button', { class: 'btn secondary', type: 'button', text: 'Réessayer', onclick: show })
    );
  }
}

async function boot() {
  try {
    if (!isConfigured) throw new Error('not-configured');
    const user = await getUser();
    if (!user) return location.replace('login.html');
    const state = await getState();
    if (state.platformAdmin || !state.hasSchool || !['director', 'admin'].includes(state.role)) {
      return location.replace(destinationFor(state));
    }
    if (state.schoolStatus === 'suspended') {
      return message('Établissement suspendu', 'L’accès de votre établissement est suspendu. Contactez l’équipe Ecolia pour le réactiver.', [
        h('a', { class: 'btn secondary', href: 'contact.html', text: 'Nous contacter' }),
      ]);
    }
    if (!state.plan) {
      if (state.role === 'director') return location.replace('choose-plan.html');
      return message('Abonnement non activé', 'Le directeur doit choisir la formule de l’établissement avant l’ouverture du tableau de bord.');
    }
    ctx = { supabase, state, user, schoolId: state.schoolId, refresh: show };
    document.querySelector('[data-school-name]').textContent = state.schoolName || 'Mon établissement';
    document.querySelector('[data-user-name]').textContent = state.name || user.email || '';
    nav.append(...ROUTES.map((r) => h('a', { href: `#/${r.id}`, dataset: { route: r.id }, text: r.label })));
    document.querySelector('[data-logout]').addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.assign('login.html');
    });
    window.addEventListener('hashchange', show);
    await show();
  } catch (error) {
    console.error(error);
    message('Service indisponible', 'Le tableau de bord ne peut pas se charger pour le moment. Réessayez plus tard.', [
      h('button', { class: 'btn secondary', type: 'button', text: 'Réessayer', onclick: () => location.reload() }),
    ]);
  }
}

boot();
