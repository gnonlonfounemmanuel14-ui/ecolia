// Connexion, inscription, contact et connexion Google, reliés à Supabase.
import {
  supabase,
  isConfigured,
  absoluteUrl,
  errorCode,
  rememberEmail,
  getUser,
  getState,
  destinationFor,
} from './auth-shared.js';

const unavailable = 'Le service est momentanément indisponible. Réessayez plus tard.';
const notConfigured = 'Le service n’est pas encore configuré.';
const tooMany = 'Trop de tentatives. Réessayez dans quelques minutes.';
const exists = 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.';

const clean = (value) => value.trim().replace(/\s+/g, ' ');
const isRateLimited = (error) =>
  error && (error.status === 429 || /rate_limit/.test(errorCode(error)));

// Branche un formulaire : validation, blocage du bouton, message d’état.
function bind(form, handler) {
  const submit = form.querySelector('button[type="submit"]');
  const message = form.querySelector('[data-auth-submit-message]');
  const show = (text, isError = false) => {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle('is-error', isError);
    message.hidden = false;
  };
  form.addEventListener('submit', async () => {
    if (!form.checkValidity()) return;
    if (!isConfigured) {
      show(notConfigured, true);
      return;
    }
    submit.disabled = true;
    try {
      await handler(show);
    } catch {
      show('Connexion impossible. Vérifiez votre réseau et réessayez.', true);
    }
    submit.disabled = false;
  });
}

// Connexion par e-mail et mot de passe.
const loginForm = document.querySelector('[data-login-form]');
const registerFormEl = document.querySelector('[data-register-form]');

// Déjà connecté : inutile de montrer la connexion ou l'inscription, on envoie vers l'espace de la personne.
if ((loginForm || registerFormEl) && isConfigured) {
  getUser()
    .then(async (user) => {
      if (user) location.replace(destinationFor(await getState()));
    })
    .catch(() => {});
}

if (loginForm) {
  bind(loginForm, async (show) => {
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginForm.elements.password.value,
    });
    if (!error) {
      location.assign(destinationFor(await getState()));
      return;
    }
    if (errorCode(error) === 'email_not_confirmed') {
      rememberEmail(email);
      location.assign('verify-email.html');
    } else if (isRateLimited(error)) {
      show(tooMany, true);
    } else if (errorCode(error) === 'invalid_credentials' || error.status === 400) {
      show('Adresse e-mail ou mot de passe incorrect.', true);
    } else {
      show(unavailable, true);
    }
  });
}

// Inscription d’un établissement.
const registerForm = document.querySelector('[data-register-form]');
if (registerForm) {
  bind(registerForm, async (show) => {
    const email = registerForm.elements.email.value.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: registerForm.elements.password.value,
      options: {
        data: { school_name: clean(registerForm.elements.school.value) },
        emailRedirectTo: absoluteUrl('choose-plan.html'),
      },
    });
    if (error) {
      const code = errorCode(error);
      if (code === 'weak_password') {
        show('Mot de passe trop faible. Choisissez-en un plus long et plus varié.', true);
      } else if (code === 'user_already_exists' || code === 'email_exists') {
        show(exists, true);
      } else if (isRateLimited(error)) {
        show(tooMany, true);
      } else if (error.status === 400 || error.status === 422) {
        show('Vérifiez les informations saisies et réessayez.', true);
      } else {
        show(unavailable, true);
      }
      return;
    }
    // Compte déjà existant : Supabase ne renvoie pas d’erreur mais une liste d’identités vide.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      show(exists, true);
      return;
    }
    if (data.session) {
      location.assign(destinationFor(await getState()));
      return;
    }
    rememberEmail(email);
    location.assign('verify-email.html');
  });
}

// Formulaire de contact : le message est enregistré dans la table contact_messages.
const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  bind(contactForm, async (show) => {
    const { error } = await supabase.from('contact_messages').insert({
      name: clean(contactForm.elements.name.value),
      email: contactForm.elements.email.value.trim().toLowerCase(),
      school: clean(contactForm.elements.school.value),
      topic: contactForm.elements.topic.value,
      message: contactForm.elements.message.value.trim(),
    });
    if (error) {
      show(isRateLimited(error) ? 'Trop de messages envoyés. Réessayez dans quelques minutes.' : unavailable, true);
      return;
    }
    show('Merci, votre message a bien été envoyé. Nous reviendrons vers vous.');
    contactForm.reset();
  });
}

// Connexion et inscription avec Google : Supabase gère tout l’échange avec Google.
document.querySelectorAll('[data-provider="google"]').forEach((button) =>
  button.addEventListener('click', async () => {
    const message = document.querySelector('[data-auth-message]');
    const fail = (text) => {
      if (message) {
        message.textContent = text;
        message.hidden = false;
      }
    };
    if (!isConfigured) {
      fail(notConfigured);
      return;
    }
    button.disabled = true;
    try {
      // La page choose-plan.html sert d’aiguillage : elle redirige selon l’état du compte.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: absoluteUrl('choose-plan.html') },
      });
      if (!error) return;
    } catch {
      // Message affiché ci-dessous.
    }
    fail('La connexion avec Google est momentanément indisponible. Utilisez votre adresse e-mail.');
    button.disabled = false;
  })
);