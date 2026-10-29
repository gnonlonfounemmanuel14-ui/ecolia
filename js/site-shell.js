import { contactConfig } from './contact-config.js';

// Libellés et tracés SVG utilisés pour rendre les moyens de contact configurés.
const labels = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  phone: 'Téléphone',
};
const contactIcons = {
  whatsapp:
    'M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z M9 8.5c.6 2.7 2.3 4.4 5 5l1-1.2-1.8-1-1 .8a5 5 0 0 1-1.8-1.8l.8-1-1-1.8L9 8.5Z',
  email: 'M3 5h18v14H3z M3 6l9 7 9-7',
  facebook:
    'M13 21v-8h2.7l.4-3H13V8.1c0-.9.3-1.6 1.6-1.6h1.6V4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7v3h2.5v8H13Z',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M17.5 6.5h.01',
  tiktok: 'M14 3v11a4 4 0 1 1-3-3.87 M14 3c.5 3 2.5 5 5 5',
  youtube: 'M22 12s0-4-1-5-9-1-9-1-8 0-9 1-1 5-1 5 0 4 1 5 9 1 9 1 8 0 9-1 1-5 1-5ZM10 9l5 3-5 3z',
  linkedin: 'M5 9v10 M5 5v.01 M9 19v-6a4 4 0 0 1 8 0v6 M9 10v9',
  phone:
    'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-6-6l2-2-2-5Z',
};

// Valide la destination selon son type avant de créer un lien cliquable.
function safeContactUrl(type, value) {
  if (!value) return null;
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
  if (type === 'phone') return /^\+[1-9]\d{6,14}$/.test(value) ? `tel:${value}` : null;
  if (type === 'whatsapp') return /^https:\/\/wa\.me\/[1-9]\d{6,14}$/.test(value) ? value : null;
  try {
    const url = new URL(value);
    const domains = {
      facebook: 'facebook.com',
      instagram: 'instagram.com',
      tiktok: 'tiktok.com',
      youtube: 'youtube.com',
      linkedin: 'linkedin.com',
    };
    return url.protocol === 'https:' &&
      domains[type] &&
      (url.hostname === domains[type] || url.hostname.endsWith(`.${domains[type]}`))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// Construit les liens uniquement à partir de coordonnées officielles valides.
function contactLinks(container, config = contactConfig) {
  const fragment = document.createDocumentFragment();
  Object.entries(config).forEach(([type, value]) => {
    const href = safeContactUrl(type, value);
    if (!href) return;
    const link = document.createElement('a');
    link.dataset.contact = type;
    link.href = href;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add('contact-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', contactIcons[type]);
    icon.append(path);
    link.append(icon);
    link.append(document.createTextNode(labels[type]));
    if (['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'].includes(type)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    fragment.append(link);
  });
  if (fragment.childNodes.length) {
    container.replaceChildren(fragment);
    container.hidden = false;
    if (container.closest('[data-contact-column]'))
      container.closest('.footer-top')?.classList.add('has-contact');
    if (container.closest('[data-social-column]'))
      container.closest('.footer-top')?.classList.add('has-social');
    container
      .closest('[data-contact-column], [data-contact-panel], [data-social-column]')
      ?.removeAttribute('hidden');
  }
}

// Monte un fragment partagé lorsque la page contient un emplacement prévu à cet effet.
async function mountPartial(slot, partialName) {
  const base = slot.dataset.base || './';
  const response = await fetch(`${base}partials/${partialName}.html`);
  if (!response.ok) throw new Error(`Unable to load ${partialName}`);
  const html = (await response.text()).replaceAll('{{base}}', base);
  const template = document.createElement('template');
  template.innerHTML = html;
  slot.replaceWith(template.content);
}

// Monte les fragments éventuels, définit la navigation active et les contacts visibles.
await Promise.all(
  [...document.querySelectorAll('[data-site-header], [data-site-footer]')].map(async (slot) => {
    const isHeader = slot.hasAttribute('data-site-header');
    await mountPartial(slot, isHeader ? 'site-header' : 'site-footer');
    if (isHeader) {
      const active = slot.dataset.page;
      const link = document.querySelector(`[data-nav="${active}"]`);
      if (link) link.setAttribute('aria-current', 'page');
    }
  })
);

// Une session Supabase est mémorisée par le navigateur : on propose « Mon espace » à la place de la connexion.
function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(key)) {
        const value = JSON.parse(localStorage.getItem(key));
        if (value && (value.refresh_token || value.access_token)) return true;
      }
    }
  } catch {
    // Stockage indisponible : on garde les liens de connexion.
  }
  return false;
}
const brandLink = document.querySelector('.site-header .brand');
if (brandLink && hasStoredSession()) {
  const base = brandLink.getAttribute('href').replace(/index\.html$/, '');
  document.querySelectorAll('.site-header .nav-ctas').forEach((box) => {
    const link = document.createElement('a');
    link.className = 'btn green small';
    link.href = `${base}pages/mon-espace.html`;
    link.textContent = 'Mon espace';
    box.replaceChildren(link);
  });
  const mobile = [...document.querySelectorAll('.site-header .mobile-nav-auth')];
  if (mobile[0]) {
    mobile[0].href = `${base}pages/mon-espace.html`;
    mobile[0].textContent = 'Mon espace';
  }
  mobile.slice(1).forEach((el) => el.remove());
}

document.querySelectorAll('[data-contact-list]').forEach(contactLinks);
document.querySelectorAll('[data-social-list]').forEach((socials) => {
  const allowed = Object.fromEntries(
    Object.entries(contactConfig).filter(([key]) =>
      ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'].includes(key)
    )
  );
  contactLinks(socials, allowed);
  if (!socials.childNodes.length) socials.closest('[data-social-column]')?.remove();
});

document.dispatchEvent(new CustomEvent('ecolia:shell-ready'));
