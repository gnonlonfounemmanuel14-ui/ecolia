// Diagnostic : vérifie pas à pas la liaison entre le site et la base Supabase.
// Ce script n'importe rien de façon statique : même si le reste du site est cassé, il fonctionne.
const list = document.querySelector('[data-checks]');
const reportBox = document.querySelector('[data-report]');
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.1/+esm',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2',
];
const ICON = { ok: '✔', warn: '!', fail: '✖', info: 'i' };
const LABEL = { ok: 'OK', warn: 'ATTENTION', fail: 'ÉCHEC', info: 'INFO' };
let lines = [];

function add(status, title, detail, fix) {
  const li = document.createElement('li');
  li.className = `diag-item diag-${status}`;
  const icon = document.createElement('span');
  icon.className = 'diag-icon';
  icon.textContent = ICON[status];
  icon.setAttribute('aria-label', LABEL[status]);
  const body = document.createElement('div');
  const t = document.createElement('p');
  t.className = 'diag-title';
  t.textContent = title;
  body.append(t);
  for (const [cls, text] of [['diag-detail', detail], ['diag-fix', fix && `Que faire : ${fix}`]]) {
    if (!text) continue;
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    body.append(p);
  }
  li.append(icon, body);
  list.append(li);
  lines.push(`[${LABEL[status]}] ${title}${detail ? ` — ${detail}` : ''}${fix ? ` | À faire : ${fix}` : ''}`);
  reportBox.value = lines.join('\n');
}

async function http(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* texte brut */
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

const decodeJwt = (key) => {
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

async function run() {
  list.replaceChildren();
  lines = [`Diagnostic Ecolia — ${new Date().toLocaleString('fr-FR')}`, `Navigateur : ${navigator.userAgent}`];
  reportBox.value = lines.join('\n');

  // 1. Comment le site est ouvert
  if (location.protocol === 'file:') {
    add('fail', 'Le site est ouvert en double-cliquant sur le fichier', `Adresse : ${location.href}`, 'lancez un serveur local (npx serve . -l 5500) puis ouvrez http://localhost:5500/pages/diagnostic.html. Sans serveur, le navigateur bloque les scripts : c’est la cause la plus fréquente d’un bouton qui ne fait rien.');
  } else {
    add('ok', 'Le site est servi par un serveur', `Adresse du site : ${location.origin}`);
    add('info', 'Cette adresse doit être déclarée dans Supabase', `${location.origin}`, 'dans Supabase, Authentication, URL Configuration : Site URL = cette adresse, et Redirect URLs = cette adresse suivie de /** (exactement le même numéro de port).');
  }

  // 2. Configuration
  let url = '';
  let key = '';
  try {
    const config = await import('./supabase-config.js');
    url = String(config.SUPABASE_URL || '');
    key = String(config.SUPABASE_ANON_KEY || '');
  } catch (error) {
    add('fail', 'Le fichier js/supabase-config.js est absent ou invalide', String(error.message || error), 'vérifiez qu’il existe et qu’il contient bien les deux lignes « export const SUPABASE_URL = … » et « export const SUPABASE_ANON_KEY = … », avec des guillemets.');
  }
  let configured = false;
  if (url || key) {
    if (url.includes('VOTRE-PROJET') || key.includes('VOTRE_CLE') || !url || !key) {
      add('fail', 'js/supabase-config.js contient encore les valeurs d’exemple', `Adresse : ${url || '(vide)'}`, 'remplacez-les par l’adresse de votre projet et la clé publique (Supabase, Project Settings, API Keys).');
    } else if (!/^https:\/\/[a-z0-9]{10,}\.supabase\.co\/?$/i.test(url)) {
      add('fail', 'L’adresse du projet n’a pas le bon format', `Valeur : ${url}`, 'elle doit ressembler à https://abcdefghijklmnop.supabase.co (sans /rest/v1 ni espace).');
    } else {
      add('ok', 'L’adresse du projet est bien renseignée', url);
      configured = true;
    }
    const claims = key.split('.').length === 3 ? decodeJwt(key) : null;
    if (key.startsWith('sb_secret_') || (claims && claims.role === 'service_role')) {
      add('fail', 'DANGER : c’est une clé SECRÈTE qui est dans le site', 'Cette clé donne tous les droits sur votre base et ne doit jamais être dans le navigateur.', 'retirez-la immédiatement, régénérez-la dans Supabase (Project Settings, API Keys), puis mettez à la place la clé « publishable » ou « anon ».');
      configured = false;
    } else if (key.startsWith('sb_publishable_')) {
      add('ok', 'La clé publique est de type « publishable »', `${key.slice(0, 18)}…`);
    } else if (claims && claims.role === 'anon') {
      add('ok', 'La clé publique est de type « anon »', `${key.slice(0, 12)}…`);
    } else if (key && configured) {
      add('warn', 'Le type de la clé n’est pas reconnu', `${key.slice(0, 10)}…`, 'vérifiez que vous avez copié la clé « publishable » (ou « anon »), pas une autre valeur.');
    }
  }

  // 3. Bibliothèque Supabase (téléchargée depuis Internet)
  let libraryFrom = null;
  for (const source of SOURCES) {
    try {
      await Promise.race([import(source), new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), 12000))]);
      libraryFrom = source;
      break;
    } catch {
      /* source suivante */
    }
  }
  if (!libraryFrom) {
    add('fail', 'La bibliothèque Supabase ne se télécharge pas', 'Aucun des hébergeurs n’a répondu.', 'vérifiez votre connexion Internet, désactivez un éventuel bloqueur de publicités ou VPN, puis relancez.');
  } else if (libraryFrom !== SOURCES[0]) {
    add('warn', 'La bibliothèque est chargée depuis une source de secours', libraryFrom, 'ce n’est pas bloquant. La version figée du site est peut-être introuvable.');
  } else {
    add('ok', 'La bibliothèque Supabase se télécharge', 'Version 2.108.1');
  }

  // 4. Supabase répond-il ? Les inscriptions sont-elles autorisées ?
  if (configured) {
    const headers = { apikey: key };
    try {
      const auth = await http(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers });
      if (auth.ok && auth.body && typeof auth.body === 'object') {
        add('ok', 'Supabase répond (service de connexion)', `Code ${auth.status}`);
        if (auth.body.disable_signup) add('fail', 'Les inscriptions sont désactivées dans Supabase', '', 'Authentication, Sign In / Providers : activez « Allow new users to sign up ».');
        if (auth.body.external && auth.body.external.email === false) add('fail', 'La connexion par e-mail est désactivée', '', 'Authentication, Sign In / Providers, Email : activez le fournisseur.');
        if (auth.body.mailer_autoconfirm === true) {
          add('ok', 'La confirmation d’e-mail est désactivée (mode test)', 'Une inscription connecte tout de suite la personne.', 'avant le lancement, réactivez-la et branchez un service d’e-mail (SMTP).');
        } else {
          add('warn', 'La confirmation d’e-mail est activée', 'Après l’inscription, la personne doit cliquer sur le lien reçu par e-mail. Le service d’e-mail intégré de Supabase est limité à quelques messages par heure.', 'pour tester sans e-mail : Authentication, Sign In / Providers, Email, désactivez « Confirm email ».');
        }
        add(auth.body.external && auth.body.external.google ? 'ok' : 'info', auth.body.external && auth.body.external.google ? 'Google est activé' : 'Google n’est pas activé (facultatif)', '', auth.body.external && auth.body.external.google ? '' : 'sans lui, le bouton « Continuer avec Google » affichera une erreur.');
      } else if (auth.status === 401 || auth.status === 403) {
        add('fail', 'Supabase refuse la clé', `Code ${auth.status}`, 'la clé ne correspond pas à ce projet, ou elle a été révoquée. Recopiez-la depuis Project Settings, API Keys.');
      } else {
        add('fail', 'Supabase répond mais avec une erreur', `Code ${auth.status}`, 'vérifiez l’adresse du projet et que le projet n’est pas en pause (Restore project).');
      }
    } catch (error) {
      add('fail', 'Impossible de joindre Supabase', String(error.message || error), 'vérifiez l’adresse du projet, votre connexion Internet, et que le projet n’est pas en pause.');
    }

    // 5. La base de données est-elle installée ?
    try {
      const plans = await http(`${url.replace(/\/$/, '')}/rest/v1/plans?select=id,monthly_price_fcfa&order=monthly_price_fcfa`, { headers: { ...headers, Authorization: `Bearer ${key}` } });
      if (plans.ok && Array.isArray(plans.body) && plans.body.length === 4) {
        add('ok', 'La base de données est installée (4 formules trouvées)', plans.body.map((p) => `${p.id} ${p.monthly_price_fcfa}`).join(' · '));
      } else if (plans.ok && Array.isArray(plans.body)) {
        add('warn', 'La table des formules contient un nombre inattendu de lignes', `${plans.body.length} ligne(s)`, 'attendu : 4 (free, standard, professional, unlimited).');
      } else if (plans.status === 404 || (plans.body && /relation|schema cache|PGRST205/i.test(JSON.stringify(plans.body)))) {
        add('fail', 'Les tables n’existent pas dans cette base', `Code ${plans.status}`, 'exécutez le script SQL de la phase 1 dans SQL Editor. Vérifiez aussi que ce projet est bien celui où vous l’avez exécuté.');
      } else {
        add('fail', 'La table des formules est illisible', `Code ${plans.status}`, 'les règles d’accès (RLS) de la phase 1 ne sont peut-être pas installées.');
      }
      const contact = await http(`${url.replace(/\/$/, '')}/rest/v1/contact_messages?select=id&limit=1`, { headers: { ...headers, Authorization: `Bearer ${key}` } });
      add(contact.status === 404 ? 'warn' : 'ok', contact.status === 404 ? 'La table des messages de contact est absente' : 'La table des messages de contact existe', '', contact.status === 404 ? 'exécutez le script « phase1b_contact_et_profils.sql ». Sans lui, le formulaire Contact échoue.' : '');
      const rpc = await http(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_my_state`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}' });
      add(rpc.status === 404 ? 'fail' : 'ok', rpc.status === 404 ? 'Les fonctions de la base sont absentes (get_my_state)' : 'Les fonctions de la base sont installées', '', rpc.status === 404 ? 'le script SQL de la phase 1 n’a pas été exécuté en entier.' : '');
    } catch (error) {
      add('fail', 'Impossible de lire la base de données', String(error.message || error));
    }
  } else {
    add('info', 'Les vérifications de la base sont ignorées', 'La configuration ci-dessus doit d’abord être corrigée.');
  }

  // 6. Les fichiers du site sont-ils à jour ?
  const files = [
    ['register-school.html', ['data-register-form', 'forms-api.js'], 'la page d’inscription'],
    ['login.html', ['data-login-form', 'forms-api.js'], 'la page de connexion'],
    ['../js/forms-api.js', ['signUp(', 'signInWithPassword('], 'js/forms-api.js'],
    ['../js/auth-shared.js', ['get_my_state'], 'js/auth-shared.js'],
    ['../js/supabase-client.js', ['supabase-js'], 'js/supabase-client.js'],
    ['../js/main.js', [], 'js/main.js'],
  ];
  const stale = [];
  const missing = [];
  for (const [path, needles, label] of files) {
    try {
      const res = await http(new URL(path, location.href).href);
      if (!res.ok) missing.push(label);
      else if (needles.some((n) => !String(res.body).includes(n))) stale.push(label);
      else if (path.endsWith('main.js') && /n[’']est pas configur/.test(String(res.body))) stale.push(`${label} (ancienne version)`);
    } catch {
      missing.push(label);
    }
  }
  if (!missing.length && !stale.length) add('ok', 'Les fichiers du site sont à jour', 'Pages et scripts de connexion cohérents.');
  if (missing.length) add('fail', 'Des fichiers sont introuvables', missing.join(', '), 'envoyez-moi ce rapport : je vous donne le code de chacun.');
  if (stale.length) add('fail', 'Des fichiers sont d’une ancienne version', stale.join(', '), 'envoyez-moi ce rapport : je vous donne le code à jour de chacun. C’est une cause fréquente d’un bouton qui ne réagit pas.');

  // 7. Session
  if (libraryFrom && configured) {
    try {
      const { supabase } = await import('./supabase-client.js');
      const { data } = await supabase.auth.getSession();
      add('info', data.session ? `Une session est ouverte (${data.session.user.email})` : 'Aucune session ouverte', data.session ? 'Vous êtes connecté.' : 'Normal avant de vous connecter.');
    } catch (error) {
      add('fail', 'Le client Supabase du site ne démarre pas', String(error.message || error), 'vérifiez js/supabase-client.js et js/supabase-config.js.');
    }
  }
  const fails = lines.filter((l) => l.startsWith('[ÉCHEC]')).length;
  add(fails ? 'fail' : 'ok', fails ? `${fails} problème(s) à corriger` : 'Tout est en ordre : l’inscription doit fonctionner', fails ? 'Corrigez-les dans l’ordre, de haut en bas, puis relancez le diagnostic.' : 'Essayez maintenant l’inscription.');
}

document.querySelector('[data-rerun]').addEventListener('click', run);
document.querySelector('[data-copy]').addEventListener('click', async (event) => {
  try {
    await navigator.clipboard.writeText(reportBox.value);
    event.target.textContent = 'Copié !';
  } catch {
    reportBox.select();
    document.execCommand('copy');
  }
});
run();