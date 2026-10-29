// Page « Vérifiez votre e-mail » : instructions et renvoi du lien de confirmation.
// Le formulaire d’inscription mémorise l’adresse dans sessionStorage avant d’ouvrir cette page.
import { supabase, isConfigured, absoluteUrl, errorCode } from './auth-shared.js';

const form = document.querySelector('[data-verify-form]');

if (form) {
  const KEY = 'ecolia:pending-email';
  const title = form.querySelector('[data-verify-title]');
  const intro = form.querySelector('[data-verify-intro]');
  const emailLine = form.querySelector('[data-email-line]');
  const field = form.querySelector('[data-email-field]');
  const input = form.elements.email;
  const submit = form.querySelector('button[type="submit"]');
  const message = form.querySelector('[data-auth-submit-message]');
  const submitLabel = submit.textContent;

  const status = new URLSearchParams(location.search).get('status');
  let email = '';
  try {
    email = sessionStorage.getItem(KEY) || '';
  } catch {
    email = '';
  }

  const show = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
    message.hidden = false;
  };

  if (status === 'expired' || status === 'invalid') {
    title.textContent = 'Lien invalide ou expiré';
    intro.textContent = 'Ce lien de confirmation n’est plus valable. Demandez-en un nouveau ci-dessous.';
  }

  if (email) {
    emailLine.textContent = `Adresse : ${email}`;
    emailLine.hidden = false;
  } else {
    field.hidden = false;
  }

  function cooldown(seconds) {
    let left = seconds;
    submit.disabled = true;
    submit.textContent = `Renvoyer dans ${left} s`;
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        submit.disabled = false;
        submit.textContent = submitLabel;
      } else {
        submit.textContent = `Renvoyer dans ${left} s`;
      }
    }, 1000);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const address = (email || input.value).trim().toLowerCase();
    if (!email && !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    if (!isConfigured) {
      show('Le service n’est pas encore configuré.', true);
      return;
    }
    submit.disabled = true;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: address,
        options: { emailRedirectTo: absoluteUrl('choose-plan.html') },
      });
      if (error && (error.status === 429 || /rate_limit/.test(errorCode(error)))) {
        show('Trop de demandes. Réessayez dans quelques minutes.', true);
      } else if (error && error.status >= 500) {
        show('Le service est momentanément indisponible. Réessayez plus tard.', true);
      } else {
        // Réponse volontairement identique que le compte existe ou non.
        show(
          'Si un compte non confirmé existe pour cette adresse, un nouvel e-mail vient d’être envoyé. Pensez à vérifier vos courriers indésirables.'
        );
        cooldown(60);
        return;
      }
    } catch {
      show('Connexion impossible. Vérifiez votre réseau et réessayez.', true);
    }
    submit.disabled = false;
  });
}
