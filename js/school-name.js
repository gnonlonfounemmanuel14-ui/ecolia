// Page « Nom de votre établissement » : affichée après une première connexion avec Google.
import { supabase, isConfigured, errorCode, getUser, getState } from './auth-shared.js';

const form = document.querySelector('[data-school-form]');

if (form) {
  const userLine = form.querySelector('[data-user-line]');
  const field = form.querySelector('[data-school-field]');
  const submit = form.querySelector('[data-school-submit]');
  const message = form.querySelector('[data-auth-submit-message]');
  const input = form.elements.school;
  const unavailable = 'Le service est momentanément indisponible. Réessayez plus tard.';

  const show = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
    message.hidden = false;
  };

  // Vérifie la session et affiche le formulaire seulement si l’école n’est pas encore créée.
  async function init() {
    try {
      if (!isConfigured) throw new Error('not-configured');
      const user = await getUser();
      if (!user) {
        location.replace('login.html');
        return;
      }
      const state = await getState();
      if (state.hasSchool || state.platformAdmin) {
        location.replace('choose-plan.html');
        return;
      }
      // textContent : le nom vient de Google, il ne doit jamais être injecté en HTML.
      userLine.textContent = state.name
        ? `Bienvenue ${state.name}. Indiquez le nom de votre établissement pour continuer.`
        : 'Indiquez le nom de votre établissement pour continuer.';
      field.hidden = false;
      submit.disabled = false;
      input.focus();
    } catch {
      userLine.textContent = '';
      show(unavailable, true);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      show('Indiquez le nom complet de votre établissement.', true);
      return;
    }
    submit.disabled = true;
    try {
      const { error } = await supabase.rpc('create_school', { p_name: name });
      if (!error) {
        location.assign('choose-plan.html');
        return;
      }
      const code = errorCode(error);
      if (code === '28000' || error.message === 'not_authenticated') {
        location.replace('login.html');
        return;
      }
      show(
        code === '22023' || error.message === 'invalid_name'
          ? 'Ce nom n’est pas valide. Vérifiez-le et réessayez.'
          : unavailable,
        true
      );
    } catch {
      show('Connexion impossible. Vérifiez votre réseau et réessayez.', true);
    }
    submit.disabled = false;
  });

  init();
}
