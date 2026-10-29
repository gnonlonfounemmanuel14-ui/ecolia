import './site-shell.js';
// Menu principal responsive et fermeture après sélection d’un lien.
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-navigation');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    }
  });
}

// Révèle progressivement les sections, sauf lorsque l’utilisateur réduit les animations.
const revealItems = document.querySelectorAll('.reveal');
if (
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealItems.forEach((item) => observer.observe(item));
} else revealItems.forEach((item) => item.classList.add('is-visible'));

// Contrôle accessible de visibilité des mots de passe.
document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    if (!input) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? 'Masquer' : 'Afficher';
    button.setAttribute('aria-pressed', String(reveal));
  });
});

// Validation locale des formulaires ; l’envoi au serveur est géré par forms-api.js et auth-reset.js.
document.querySelectorAll('[data-local-form]').forEach((form) => {
  const password = form.querySelector('#password');
  const confirmation = form.querySelector('#confirm');
  if (password && confirmation) {
    const confirmationError = document.querySelector('#confirm-help');
    const matchPassword = () => {
      const mismatch = Boolean(confirmation.value) && password.value !== confirmation.value;
      confirmation.setCustomValidity(
        mismatch ? 'Les deux mots de passe ne correspondent pas.' : ''
      );
      if (confirmationError && confirmation.dataset.touched === 'true') {
        confirmationError.textContent = mismatch ? 'Les mots de passe ne correspondent pas.' : '';
        confirmation.setAttribute('aria-invalid', String(mismatch));
      }
    };
    password.addEventListener('input', matchPassword);
    confirmation.addEventListener('input', () => {
      confirmation.dataset.touched = 'true';
      matchPassword();
    });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const firstInvalid = [...form.elements].find(
      (control) => control.willValidate && !control.validity.valid
    );
    if (firstInvalid) {
      if (firstInvalid.id === 'confirm') {
        firstInvalid.dataset.touched = 'true';
        const error = document.querySelector('#confirm-help');
        if (error) error.textContent = firstInvalid.validationMessage;
        firstInvalid.setAttribute('aria-invalid', 'true');
      }
      firstInvalid.focus();
      firstInvalid.reportValidity();
    }
  });
  form.addEventListener('input', () => {
    const message = form.querySelector('[data-auth-submit-message]');
    if (message) message.hidden = true;
  });
});

// Préremplit uniquement le sujet du formulaire Contact lorsqu’il a été demandé.
const contactSubject = new URLSearchParams(location.search).get('subject');
if (contactSubject === 'mot-de-passe') {
  const subject = document.querySelector('#topic');
  if (subject) subject.value = 'Récupération de mot de passe';
}

