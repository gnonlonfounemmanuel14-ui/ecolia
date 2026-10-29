// Mot de passe oublié et nouveau mot de passe, reliés à Supabase.
// 1) « Mot de passe oublié » : Supabase envoie un lien à usage unique par e-mail.
// 2) Le lien ouvre « Nouveau mot de passe » : le nouveau mot de passe remplace l’ancien.
import {
  supabase,
  isConfigured,
  absoluteUrl,
  errorCode,
  getUser,
  authLinkError,
  isRecoveryLink,
} from './auth-shared.js';

const form = document.querySelector('[data-api-form]');

if (form) {
  const message = form.querySelector('[data-auth-submit-message]');
  const submit = form.querySelector('button[type="submit"]');
  const submitLabel = submit.textContent;
  const unavailable = 'Le service est momentanément indisponible. Réessayez plus tard.';

  const show = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
    message.hidden = false;
  };

  const showExpired = () => {
    show('Ce lien est invalide ou a expiré. ', true);
    const link = document.createElement('a');
    link.href = 'forgot-password.html';
    link.textContent = 'Demander un nouveau lien';
    message.append(link);
  };

  const isRateLimited = (error) =>
    error && (error.status === 429 || /rate_limit/.test(errorCode(error)));

  // Empêche les demandes répétées : le bouton reste bloqué quelques secondes.
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

  // Page « Mot de passe oublié » : demande de l’e-mail de réinitialisation.
  if (form.hasAttribute('data-reset-request')) {
    form.addEventListener('submit', async () => {
      if (!form.checkValidity()) return;
      if (!isConfigured) {
        show('Le service n’est pas encore configuré.', true);
        return;
      }
      const email = form.elements.email.value.trim().toLowerCase();
      submit.disabled = true;
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: absoluteUrl('reset-password.html'),
        });
        if (isRateLimited(error)) {
          show('Trop de demandes. Réessayez dans quelques minutes.', true);
        } else if (error && error.status >= 500) {
          show(unavailable, true);
        } else {
          // Réponse volontairement identique que le compte existe ou non.
          show(
            'Si un compte existe pour cette adresse, un e-mail vient d’être envoyé. Pensez à vérifier vos courriers indésirables.'
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

  // Page « Nouveau mot de passe » : on attend que Supabase ouvre la session de récupération.
  if (form.hasAttribute('data-reset-confirm')) {
    let ready = false;
    submit.disabled = true;
    const enable = () => {
      ready = true;
      submit.disabled = false;
    };

    if (authLinkError() || !isConfigured) {
      showExpired();
    } else {
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') enable();
      });
      // Délai de grâce : l’événement arrive juste après le chargement de la page.
      setTimeout(async () => {
        if (ready) return;
        const user = await getUser();
        if (user && isRecoveryLink()) enable();
        else showExpired();
      }, 2500);
    }

    form.addEventListener('submit', async () => {
      if (!ready || !form.checkValidity()) return;
      submit.disabled = true;
      try {
        const { error } = await supabase.auth.updateUser({ password: form.elements.password.value });
        if (!error) {
          show('Mot de passe mis à jour. Redirection vers la connexion…');
          // On ferme la session de récupération : la personne se reconnecte avec son nouveau mot de passe.
          await supabase.auth.signOut();
          setTimeout(() => location.assign('login.html'), 2500);
          return;
        }
        const code = errorCode(error);
        if (code === 'same_password') {
          show('Choisissez un mot de passe différent de l’ancien.', true);
        } else if (code === 'weak_password') {
          show('Mot de passe trop faible. Choisissez-en un plus long et plus varié.', true);
        } else if (code === 'session_not_found' || error.status === 401 || error.status === 403) {
          showExpired();
        } else if (isRateLimited(error)) {
          show('Trop de tentatives. Réessayez dans quelques minutes.', true);
        } else {
          show(unavailable, true);
        }
      } catch {
        show('Connexion impossible. Vérifiez votre réseau et réessayez.', true);
      }
      submit.disabled = false;
    });
  }
}
