// Une seule interface est réutilisée; les rôles et modules ici ne sont qu'une maquette UX.
// Le contexte école et toute permission devront être résolus et contrôlés par l'API.
const roleInfo = {
  platform: {
    label: 'Administration Ecolia',
    home: 'Vue globale',
    items: [
      ['overview', 'Tableau de bord'],
      ['schools', 'Établissements'],
      ['accounts', 'Comptes utilisateurs'],
      ['plans', 'Abonnements SaaS'],
      ['support', 'Assistance'],
      ['settings', 'Paramètres plateforme'],
      ['activity', 'Journal d’activité'],
    ],
  },
  director: {
    label: 'Direction d’établissement',
    home: 'Tableau de bord de l’école',
    items: [
      ['overview', 'Tableau de bord'],
      ['onboarding', 'Configuration initiale'],
      ['school', 'Établissement et paramètres'],
      ['years', 'Années scolaires'],
      ['levels', 'Niveaux'],
      ['students', 'Élèves'],
      ['staff', 'Enseignants et personnel'],
      ['classes', 'Classes'],
      ['subjects', 'Matières'],
      ['assignments', 'Affectations'],
      ['grades', 'Évaluations et notes'],
      ['bulletins', 'Moyennes et bulletins'],
      ['attendance', 'Présences et absences'],
      ['finance', 'Frais, paiements et soldes'],
      ['timetable', 'Emplois du temps'],
      ['announcements', 'Annonces et communications'],
      ['reports', 'Rapports et statistiques'],
      ['access', 'Utilisateurs, invitations et rôles'],
    ],
  },
  admin: {
    label: 'Personnel administratif',
    home: 'Tableau de bord administratif',
    items: [
      ['overview', 'Tableau de bord'],
      ['admissions', 'Inscriptions et dossiers'],
      ['students', 'Listes d’élèves'],
      ['classes', 'Classes et affectations autorisées'],
      ['staff', 'Personnel'],
      ['documents', 'Documents'],
      ['attendance', 'Présences et absences'],
      ['finance', 'Finances — lecture si autorisée'],
      ['announcements', 'Annonces'],
    ],
  },
  teacher: {
    label: 'Espace enseignant',
    home: 'Tableau de bord enseignant',
    items: [
      ['overview', 'Tableau de bord'],
      ['classes', 'Mes classes'],
      ['subjects', 'Mes matières'],
      ['students', 'Listes d’élèves affectés'],
      ['attendance', 'Présences'],
      ['grades', 'Évaluations et notes'],
      ['bulletins', 'Résultats et bulletins'],
      ['timetable', 'Emploi du temps'],
      ['announcements', 'Annonces'],
      ['notifications', 'Notifications'],
    ],
  },
  parent: {
    label: 'Espace parent ou tuteur',
    home: 'Tableau de bord familial',
    items: [
      ['overview', 'Tableau de bord'],
      ['children', 'Enfants associés'],
      ['results', 'Résultats publiés'],
      ['bulletins', 'Bulletins'],
      ['timetable', 'Emploi du temps'],
      ['attendance', 'Absences'],
      ['announcements', 'Annonces'],
      ['notifications', 'Notifications'],
      ['finance', 'Situation des frais autorisée'],
    ],
  },
  student: {
    label: 'Espace élève',
    home: 'Tableau de bord élève',
    items: [
      ['overview', 'Tableau de bord'],
      ['profile', 'Mon profil'],
      ['timetable', 'Emploi du temps'],
      ['results', 'Résultats publiés'],
      ['bulletins', 'Bulletins'],
      ['attendance', 'Mes absences'],
      ['announcements', 'Annonces'],
      ['notifications', 'Notifications'],
    ],
  },
  community: {
    label: 'Communauté scolaire',
    home: 'Espace communautaire',
    items: [
      ['overview', 'Accueil'],
      ['announcements', 'Annonces'],
      ['notifications', 'Notifications'],
      ['events', 'Événements'],
      ['help', 'Aide'],
      ['profile', 'Profil'],
      ['preferences', 'Préférences'],
      ['security', 'Sécurité du compte'],
    ],
  },
};
// Descriptions visibles par module; les droits réels seront vérifiés par le serveur.
const moduleDescriptions = {
  schools:
    'Répertoire global des établissements, recherche et consultation. Les indicateurs restent vides tant qu’aucune source n’est connectée.',
  students:
    'Dossiers consultables selon le rôle et les affectations autorisées. Recherche, détail, création, modification et archivage sont des interfaces seulement.',
  assignments:
    'Affectations des enseignants, matières, classes et périodes selon l’organisation de l’établissement.',
  grades:
    'Évaluations et notes. Les règles de calcul, coefficients, périodes et arrondis dépendront du système scolaire configuré.',
  bulletins:
    'Moyennes et bulletins avec modèles et périodes à définir par établissement et système scolaire.',
  finance:
    'Frais attendus, encaissements, reçus, soldes, recettes et dépenses. Aucun paiement ni montant réel n’est affiché.',
  announcements:
    'Création, aperçu, destinataires et état de publication des communications propres à l’école.',
  access:
    'Comptes, invitations, rôles et permissions de l’établissement; la maquette ne donne ni ne vérifie de droits.',
  onboarding:
    'Étapes prévues après vérification du compte : rattacher le créateur comme direction, configurer l’école, les années et niveaux, puis ouvrir le tableau de bord du tenant vérifié.',
  attendance: 'Présences, absences et retards par période et classe, sans dossier réel chargé.',
};
const params = new URLSearchParams(location.search);
const roleKey = roleInfo[params.get('role')] ? params.get('role') : 'director';
const role = roleInfo[roleKey];
const requestedModule = params.get('module') || 'overview';
const item = role.items.find(([key]) => key === requestedModule) || role.items[0];
const moduleKey = item[0];
const financeViews = [
  ['fees', 'Frais scolaires'],
  ['payments', 'Paiements'],
  ['receipts', 'Reçus'],
  ['balances', 'Soldes'],
  ['revenues', 'Recettes'],
  ['expenses', 'Dépenses'],
];
const financeView = financeViews.some(([key]) => key === params.get('view'))
  ? params.get('view')
  : 'fees';
const validActions = ['list', 'detail', 'create', 'edit', 'archive'];
const manageModules = {
  platform: ['schools', 'accounts', 'plans', 'support', 'settings'],
  director: [
    'school',
    'years',
    'levels',
    'students',
    'staff',
    'classes',
    'subjects',
    'assignments',
    'grades',
    'bulletins',
    'attendance',
    'finance',
    'timetable',
    'announcements',
    'access',
    'settings',
  ],
  admin: ['admissions', 'students', 'classes', 'staff', 'documents', 'attendance', 'announcements'],
  teacher: ['attendance', 'grades', 'announcements'],
};
const canManage = (manageModules[roleKey] || []).includes(moduleKey);
const requestedAction = validActions.includes(params.get('action')) ? params.get('action') : 'list';
const action =
  (['create', 'edit'].includes(requestedAction) && !canManage) ||
  (requestedAction === 'archive' && !(roleKey === 'director' || roleKey === 'admin'))
    ? 'list'
    : requestedAction;
const titles = {
  list: item[1],
  detail: `Détail — ${item[1].toLowerCase()}`,
  create: `Préparer — ${item[1].toLowerCase()}`,
  edit: `Modifier — ${item[1].toLowerCase()}`,
  archive: `Archiver — ${item[1].toLowerCase()}`,
};
const content = document.querySelector('[data-workspace-content]');
document.title = `${action === 'list' && moduleKey === 'overview' ? role.home : titles[action]} — ${role.label} — Ecolia`;
document.querySelector('[data-role-label]').textContent = role.label;
document.querySelector('[data-dashboard-link]').href = `app.html?role=${roleKey}`;
// Génère la navigation partagée selon le rôle affiché dans cette maquette.
const nav = document.querySelector('[data-workspace-nav]');
role.items.forEach(([key, label]) => {
  const link = document.createElement('a');
  link.href =
    key === 'overview' ? `app.html?role=${roleKey}` : `app.html?role=${roleKey}&module=${key}`;
  link.textContent = label;
  if (key === moduleKey) link.setAttribute('aria-current', 'page');
  nav.append(link);
});
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
const moduleLink = `app.html?role=${roleKey}&module=${encodeURIComponent(moduleKey)}${moduleKey === 'finance' ? `&view=${financeView}` : ''}`;
const sectionLink = (next) => `${moduleLink}&action=${next}`;
const note = `<p class="workspace-note"><strong>Maquette sans connexion.</strong> Aucun établissement, compte ou dossier réel n’est chargé. Le contexte école doit être fourni par le serveur après contrôle des accès; il n’est jamais déduit de cette URL. Les formulaires et aperçus ne sont pas enregistrés et ne déclenchent aucune opération.</p>`;
const description = esc(
  moduleDescriptions[moduleKey] ||
    'Espace de préparation. Les informations seront affichées selon le contexte établissement et les autorisations confirmées par le service connecté.'
);

// Définitions documentées des indicateurs; aucune valeur de démonstration n’est injectée.
const schoolMetrics = [
  ['Élèves inscrits', 'Nombre de dossiers actifs dans l’année scolaire sélectionnée.'],
  ['Personnel', 'Nombre de comptes du personnel rattachés à l’établissement.'],
  ['Répartition par classe', 'Effectifs actifs regroupés par classe et année.'],
  ['Présences et absences', 'Présences et absences enregistrées sur la période choisie.'],
  ['Frais attendus', 'Somme des frais appelés pour la période de référence.'],
  ['Paiements enregistrés', 'Somme des règlements effectivement enregistrés.'],
  ['Soldes restant dus', 'Frais attendus moins règlements et ajustements validés.'],
  ['Recettes et dépenses', 'Totaux séparés si la comptabilité des deux flux est activée.'],
  ['Résultats et bulletins', 'Évaluations saisies et bulletins publiés pour la période.'],
  ['Annonces récentes', 'Communications publiées et visibles à ce rôle.'],
];
const platformMetrics = [
  ['Établissements', 'Nombre d’écoles actives et état de leur configuration.'],
  ['Comptes', 'Comptes et statuts de vérification, selon les permissions support.'],
  [
    'Abonnements',
    'Offres et états contractuels configurés. Aucun tarif n’est défini dans cette maquette.',
  ],
  ['Demandes assistance', 'Demandes ouvertes par état de traitement.'],
];
function dashboard() {
  const metrics =
    roleKey === 'director' ? schoolMetrics : roleKey === 'platform' ? platformMetrics : [];
  const metricMarkup = metrics.length
    ? `<div class="workspace-metrics">${metrics.map(([label, definition]) => `<article class="workspace-metric"><span>${esc(label)}</span><strong>—</strong><p>${esc(definition)}</p><small>Non calculé — source de données absente</small></article>`).join('')}</div>`
    : '';
  const shortcuts = role.items.filter(([key]) => key !== 'overview');
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">${esc(role.label)}</span><h1>${esc(role.home)}</h1><p>${roleKey === 'director' ? 'Contexte établissement : fourni par le service après vérification de l’accès. Aucun établissement n’est choisi depuis cette URL.' : 'Vue de préparation. Les données et permissions viendront du service Ecolia.'}</p></div></div>
    ${roleKey === 'director' ? '<p class="workspace-scope">Année scolaire et établissement actifs : non renseignés dans cette maquette.</p>' : ''}${metricMarkup}
    <div class="workspace-card"><div class="workspace-card-head"><h2>Modules accessibles dans cette maquette</h2><span class="demo-badge">Menus d’illustration par rôle</span></div><div class="workspace-tiles">${shortcuts.map(([key, label]) => `<a class="workspace-tile" href="app.html?role=${roleKey}&module=${encodeURIComponent(key)}"><strong>${esc(label)}</strong><span>Ouvrir l’espace →</span></a>`).join('')}</div></div>
    <div class="workspace-card workspace-recent"><h2>Activité récente</h2><div class="workspace-empty"><p>Aucune annonce ou activité de démonstration n’est injectée.</p><a href="app.html?role=${roleKey}&module=${role.items.some(([key]) => key === 'announcements') ? 'announcements' : role.items.some(([key]) => key === 'activity') ? 'activity' : 'overview'}">Consulter les annonces ou l’activité</a></div></div>`;
}

// Parcours attendu après authentification; les étapes sont descriptives et non persistées.
function onboardingView() {
  const steps = [
    [
      '1',
      'Inscription et validation',
      'Compte vérifié par le service d’authentification; cette maquette n’envoie aucun e-mail.',
    ],
    [
      '2',
      'Rattachement du créateur',
      'L’API rattache le compte à cette école avec le rôle initial Direction.',
    ],
    [
      '3',
      'Configuration de l’école',
      'Renseigner l’identité, l’année scolaire, les niveaux, classes et règles locales.',
    ],
    [
      '4',
      'Tableau de bord établissement',
      'Après vérification de l’adhésion, ouvrir le dashboard de cette école; jamais celui de l’administration Ecolia.',
    ],
  ];
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">Parcours d’établissement</span><h1>Configuration initiale</h1><p>Aperçu des étapes prévues. Aucune étape n’est validée ou persistée dans le navigateur.</p></div></div><ol class="onboarding-steps">${steps.map(([number, title, body]) => `<li><span>${number}</span><div><h2>${title}</h2><p>${body}</p></div><small>À connecter</small></li>`).join('')}</ol><div class="workspace-card"><h2>Écrans préparés ensuite</h2><div class="workspace-form-actions"><a class="btn secondary" href="app.html?role=director&module=school&action=create">Profil école</a><a class="btn secondary" href="app.html?role=director&module=years&action=create">Année scolaire</a><a class="btn secondary" href="app.html?role=director&module=levels&action=create">Niveaux</a><a class="btn green" href="app.html?role=director">Aperçu du tableau de bord</a></div></div>`;
}
// Construit des formulaires partagés dont les choix réels dépendront de données autorisées.
function fieldsForModule() {
  const common = {
    students: [
      ['Nom', 'text'],
      ['Prénom', 'text'],
      ['Date de naissance', 'date'],
      ['Classe', 'select'],
      ['Responsable légal', 'text'],
    ],
    staff: [
      ['Nom complet', 'text'],
      ['Adresse e-mail professionnelle', 'email'],
      ['Fonction', 'text'],
      ['Matières ou responsabilités', 'textarea'],
    ],
    classes: [
      ['Nom de la classe', 'text'],
      ['Niveau', 'text'],
      ['Année scolaire', 'select'],
      ['Matières', 'textarea'],
    ],
    years: [
      ['Libellé de l’année', 'text'],
      ['Date de début', 'date'],
      ['Date de fin', 'date'],
      ['Niveaux concernés', 'textarea'],
    ],
    assignments: [
      ['Personnel enseignant', 'select'],
      ['Matière', 'select'],
      ['Classe ou groupe', 'select'],
      ['Période', 'text'],
    ],
    grades: [
      ['Classe', 'select'],
      ['Matière', 'select'],
      ['Intitulé de l’évaluation', 'text'],
      ['Période', 'text'],
      ['Coefficient', 'number'],
    ],
    bulletins: [
      ['Année scolaire', 'select'],
      ['Classe', 'select'],
      ['Période', 'text'],
      ['Modèle de bulletin', 'select'],
    ],
    attendance: [
      ['Date', 'date'],
      ['Classe', 'select'],
      ['Période ou séance', 'text'],
      ['Élève', 'select'],
      ['Statut de présence', 'select'],
    ],
    finance: [
      ['Libellé', 'text'],
      ['Catégorie', 'select'],
      ['Période', 'text'],
      ['Montant', 'number'],
      ['Date d’opération', 'date'],
    ],
    timetable: [
      ['Classe', 'select'],
      ['Matière', 'select'],
      ['Enseignant', 'select'],
      ['Jour et créneau', 'text'],
      ['Salle', 'text'],
    ],
    access: [
      ['Nom complet', 'text'],
      ['Adresse e-mail', 'email'],
      ['Rôle proposé', 'select'],
      ['Périmètre d’accès', 'select'],
    ],
    announcements: [
      ['Titre', 'text'],
      ['Catégorie', 'select'],
      ['Destinataires', 'select'],
      ['Classe ou groupe autorisé', 'text'],
      ['Date de publication', 'datetime-local'],
      ['Date d’expiration (facultative)', 'datetime-local'],
      ['Contenu', 'textarea'],
    ],
    schools: [
      ['Nom de l’établissement', 'text'],
      ['Pays', 'text'],
      ['Ville', 'text'],
      ['État du dossier', 'select'],
    ],
    profile: [
      ['Nom complet', 'text'],
      ['Adresse e-mail', 'email'],
    ],
    settings: [
      ['Nom du paramètre', 'text'],
      ['Description', 'textarea'],
    ],
    default: [
      ['Nom ou intitulé', 'text'],
      ['Description', 'textarea'],
      ['Date', 'date'],
    ],
  };
  if (moduleKey === 'finance') {
    const financeFields = {
      fees: [
        ['Libellé des frais', 'text'],
        ['Classe ou périmètre', 'select'],
        ['Montant attendu', 'number'],
        ['Échéance', 'date'],
      ],
      payments: [
        ['Élève ou référence autorisée', 'select'],
        ['Montant reçu', 'number'],
        ['Date du règlement', 'date'],
        ['Mode de règlement', 'select'],
      ],
      receipts: [
        ['Paiement concerné', 'select'],
        ['Date d’émission', 'date'],
        ['Note', 'textarea'],
      ],
      balances: [
        ['Élève ou classe', 'select'],
        ['Période', 'text'],
        ['Date de situation', 'date'],
      ],
      revenues: [
        ['Libellé de recette', 'text'],
        ['Montant', 'number'],
        ['Date', 'date'],
        ['Catégorie', 'select'],
      ],
      expenses: [
        ['Libellé de dépense', 'text'],
        ['Montant', 'number'],
        ['Date', 'date'],
        ['Catégorie', 'select'],
      ],
    };
    return financeFields[financeView];
  }
  return common[moduleKey] || common.default;
}
function inputFor([label, type], index) {
  const id = `field-${index}`;
  const groupAttribute =
    moduleKey === 'announcements' && label === 'Classe ou groupe autorisé'
      ? ' data-announcement-group'
      : '';
  const announcementRequired =
    moduleKey === 'announcements' &&
    ['Catégorie', 'Destinataires', 'Date de publication', 'Contenu'].includes(label);
  if (type === 'textarea')
    return `<label for="${id}">${esc(label)}<textarea id="${id}" name="field-${index}" rows="4" ${index === 0 || announcementRequired ? 'required' : ''}${groupAttribute} placeholder="Saisir ${esc(label.toLowerCase())}"></textarea></label>`;
  if (type === 'select') {
    const options =
      label === 'Catégorie'
        ? ['Devoir', 'Communiqué', 'Réunion', 'Événement', 'Information générale']
        : label === 'Destinataires'
          ? ['École entière', 'Personnel', 'Parents et tuteurs', 'Classe', 'Groupe autorisé']
          : label === 'Rôle proposé'
            ? ['Direction', 'Personnel administratif', 'Enseignant', 'Parent ou tuteur', 'Élève']
            : label === 'Périmètre d’accès'
              ? ['À définir selon la politique de permissions']
              : label === 'État du dossier'
                ? ['À vérifier', 'En attente', 'Actif']
                : label === 'Statut de présence'
                  ? ['Présent', 'Absent', 'Retard', 'À justifier']
                  : ['Options disponibles après connexion des données'];
    const audienceAttribute =
      moduleKey === 'announcements' && label === 'Destinataires'
        ? ' data-announcement-audience'
        : '';
    return `<label for="${id}">${esc(label)}<select id="${id}" name="field-${index}" ${index === 0 ? 'required' : ''}${audienceAttribute}><option value="">Choisir</option>${options.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`;
  }
  const required = index === 0 || announcementRequired;
  const min = label === 'Coefficient' ? ' min="0.01"' : '';
  return `<label for="${id}">${esc(label)}<input id="${id}" name="field-${index}" type="${type}" ${required ? 'required' : ''}${groupAttribute}${min} placeholder="${type === 'text' ? 'Saisir ' + esc(label.toLowerCase()) : ''}"></label>`;
}
// Aperçu réactif dans le navigateur; la sélection d’un état ne publie pas l’annonce.
function announcementPreview() {
  return `<aside class="announcement-preview" aria-labelledby="announcement-preview-title"><span class="eyebrow">Aperçu local uniquement</span><span class="demo-badge" data-preview-state>Brouillon — non enregistré</span><h2 id="announcement-preview-title" data-preview-title>Votre annonce</h2><p><strong data-preview-category>Catégorie à choisir</strong> · <span data-preview-audience>Destinataires à choisir</span></p><p data-preview-body>Le texte saisi apparaîtra ici. Aucun destinataire ne sera notifié.</p><p class="announcement-preview-date" data-preview-date>Publication : non définie</p><p class="announcement-preview-date" data-preview-expiry>Expiration : non définie</p><p class="workspace-note">L’aperçu est calculé dans votre navigateur; rien n’est publié ou conservé.</p></aside>`;
}
function formView() {
  const announcement = moduleKey === 'announcements';
  const fields = fieldsForModule();
  const saveLabel = action === 'edit' ? 'Vérifier la modification' : 'Valider les champs';
  const financeTitle =
    moduleKey === 'finance' ? financeViews.find(([key]) => key === financeView)[1] : item[1];
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">${esc(item[1])}</span><h1>${esc(action === 'edit' ? `Modifier — ${financeTitle.toLowerCase()}` : `Préparer — ${financeTitle.toLowerCase()}`)}</h1><p>${description} Rien ne sera envoyé ni sauvegardé.</p></div></div>
  ${announcement ? `<div class="announcement-state"><span class="demo-badge">Brouillon/Publication : choix de maquette uniquement</span><p>Catégories : devoir, communiqué, réunion, événement ou information générale. Cible : école, personnel, parents, classe ou groupe autorisé.</p></div>` : ''}
  <form class="workspace-form-layout" data-workspace-form><div class="workspace-card workspace-form">${fields.map(inputFor).join('')}${announcement ? `<label for="publication-state">État envisagé<select id="publication-state"><option value="draft">Brouillon</option><option value="published">Publié — aperçu seulement</option></select></label><p class="help">Le choix « Publié » n’envoie ni ne rend visible l’annonce; la publication réelle attend le backend.</p>` : ''}${moduleKey === 'access' ? '<p class="workspace-note">Une invitation réelle enverrait un e-mail et attribuerait des droits : aucune invitation n’est envoyée par cette maquette.</p>' : ''}<div class="workspace-form-actions"><button class="btn green" type="submit">${saveLabel}</button><a class="btn secondary" href="${moduleLink}">Annuler</a></div><p class="workspace-feedback" role="status" aria-live="polite" tabindex="-1" hidden></p></div>${announcement ? announcementPreview() : ''}</form>`;
}
function detailView() {
  if (moduleKey === 'announcements')
    return `${note}<div class="workspace-heading"><div><span class="eyebrow">${esc(item[1])}</span><h1>Aperçu d’annonce</h1><p>Aucun enregistrement n’a été sélectionné.</p></div></div><div class="workspace-card workspace-empty"><h2>Aucune annonce disponible</h2><p>Une annonce réelle ne sera affichée qu’après connexion et vérification de son établissement et de ses destinataires.</p><a class="btn secondary" href="app.html?role=${roleKey}&module=announcements">Retour à la liste</a></div>`;
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">${esc(item[1])}</span><h1>${esc(titles.detail)}</h1></div></div><div class="workspace-card workspace-empty"><h2>Aucun élément sélectionné</h2><p>${description} Le détail nécessite un dossier chargé par le service et autorisé pour ce rôle.</p><a class="btn secondary" href="app.html?role=${roleKey}&module=${encodeURIComponent(moduleKey)}">Retour à la liste</a></div>`;
}
function archiveView() {
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">Dossiers élèves</span><h1>Préparer un archivage</h1></div></div><form class="workspace-card workspace-form" data-archive-form><p>Aucun élève n’est sélectionné. L’archivage d’un dossier réel devra préserver son historique scolaire et être autorisé par le serveur.</p><label class="workspace-confirm"><input type="checkbox" required> Je comprends qu’aucun archivage réel ne sera réalisé depuis cette maquette.</label><button class="btn secondary" type="submit">Vérifier la confirmation</button><p class="workspace-feedback" role="status" aria-live="polite" tabindex="-1" hidden></p><a href="app.html?role=${roleKey}&module=students">Annuler et revenir aux élèves</a></form>`;
}
function listView() {
  const isAnnouncements = moduleKey === 'announcements';
  const isSchools = roleKey === 'platform' && moduleKey === 'schools';
  const isStudents = moduleKey === 'students';
  const title =
    moduleKey === 'finance' ? financeViews.find(([key]) => key === financeView)[1] : item[1];
  const columns =
    moduleKey === 'finance'
      ? financeView === 'fees'
        ? ['Frais', 'Période', 'Montant attendu', 'État']
        : financeView === 'payments'
          ? ['Référence', 'Date', 'Montant reçu', 'Mode']
          : financeView === 'receipts'
            ? ['Référence paiement', 'Date d’émission', 'État']
            : financeView === 'balances'
              ? ['Périmètre', 'Période', 'Solde']
              : ['Libellé', 'Catégorie', 'Date', 'Montant']
      : isStudents
        ? ['Nom de l’élève', 'Classe', 'Responsable', 'Statut']
        : isAnnouncements
          ? ['Titre', 'Catégorie', 'Destinataires', 'Publication', 'État']
          : isSchools
            ? ['Établissement', 'Pays / ville', 'État du dossier']
            : [];
  const financeNav =
    moduleKey === 'finance'
      ? `<nav class="workspace-subnav" aria-label="Rubriques financières">${financeViews.map(([key, label]) => `<a href="app.html?role=${roleKey}&module=finance&view=${key}" ${financeView === key ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>`
      : '';
  return `${note}<div class="workspace-heading"><div><span class="eyebrow">${esc(role.label)}</span><h1>${esc(title)}</h1><p>${description}</p></div>${canManage ? `<a class="btn green" href="${sectionLink('create')}">${isAnnouncements ? 'Créer une annonce' : moduleKey === 'finance' ? `Préparer : ${esc(title.toLowerCase())}` : 'Préparer un formulaire'}</a>` : ''}</div>
    ${financeNav}
    <div class="workspace-card"><div class="workspace-card-head"><h2>Liste — ${esc(item[1])}</h2><span class="demo-badge">Aucune donnée chargée</span></div>
    ${isStudents || isSchools || isAnnouncements || moduleKey === 'finance' ? `<label class="workspace-search" for="workspace-search">Rechercher<input id="workspace-search" type="search" placeholder="Rechercher ${isStudents ? 'un élève' : isSchools ? 'un établissement' : isAnnouncements ? 'une annonce' : esc(title.toLowerCase())}" data-workspace-search><span class="help" data-search-status>Aucun résultat car aucun dossier n’est chargé.</span></label>` : ''}
    ${columns.length ? `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}<th scope="col">Actions</th></tr></thead><tbody></tbody></table></div>` : ''}
    <div class="workspace-empty"><span aria-hidden="true">▤</span><h2>${isAnnouncements ? 'Aucune annonce à consulter' : isStudents ? 'Aucun élève à afficher' : isSchools ? 'Aucun établissement à afficher' : 'Aucun élément à afficher'}</h2><p>La liste restera vide jusqu’à ce que le service connecté fournisse des données accessibles à ce rôle. Aucun montant financier n’est affiché sans données chargées.</p><div class="workspace-form-actions workspace-preview-actions"><a class="btn secondary" href="${sectionLink('detail')}">Aperçu du détail</a>${isStudents && (roleKey === 'director' || roleKey === 'admin') ? `<a class="btn secondary" href="${sectionLink('archive')}">Aperçu de l’archivage</a>` : ''}${canManage ? `<a class="btn secondary" href="${sectionLink('edit')}">Aperçu de la modification</a><a class="btn green" href="${sectionLink('create')}">${isAnnouncements ? 'Préparer une annonce' : moduleKey === 'finance' ? `Préparer : ${esc(title.toLowerCase())}` : 'Préparer un formulaire'}</a>` : ''}</div></div></div>`;
}
// Choisit l’écran demandé parmi les modules partagés et leurs états de maquette.
content.innerHTML =
  moduleKey === 'onboarding'
    ? onboardingView()
    : action === 'create' || action === 'edit'
      ? formView()
      : action === 'detail'
        ? detailView()
        : action === 'archive'
          ? archiveView()
          : moduleKey === 'overview'
            ? dashboard()
            : listView();
// Interactions de navigation, validation de formulaires et aperçus locaux.
const workspace = document.querySelector('.workspace');
const menuButton = document.querySelector('.workspace-menu');
const sidebar = document.querySelector('#workspace-sidebar');
const closeWorkspaceMenu = () => {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Ouvrir le menu de navigation');
  workspace.classList.remove('nav-open');
};
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.setAttribute(
    'aria-label',
    open ? 'Ouvrir le menu de navigation' : 'Fermer le menu de navigation'
  );
  workspace.classList.toggle('nav-open', !open);
});
sidebar.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeWorkspaceMenu();
});
workspace.addEventListener('click', (event) => {
  if (event.target === workspace && workspace.classList.contains('nav-open')) {
    closeWorkspaceMenu();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && workspace.classList.contains('nav-open')) {
    closeWorkspaceMenu();
    menuButton.focus();
  }
});
document.querySelector('[data-workspace-form]')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (moduleKey === 'announcements') {
    const audience = form.querySelector('[data-announcement-audience]');
    const group = form.querySelector('[data-announcement-group]');
    const publication = form.querySelector('#field-4');
    const expiry = form.querySelector('#field-5');
    const needsGroup = ['Classe', 'Groupe autorisé'].includes(audience.value);
    group.required = needsGroup;
    group.setCustomValidity(
      needsGroup && !group.value.trim() ? 'Précisez la classe ou le groupe autorisé.' : ''
    );
    expiry.setCustomValidity(
      publication.value && expiry.value && expiry.value < publication.value
        ? 'La date d’expiration doit suivre la date de publication.'
        : ''
    );
  }
  if (!form.reportValidity()) return;
  const feedback = form.querySelector('.workspace-feedback');
  const state = form.querySelector('#publication-state')?.value;
  feedback.textContent =
    state === 'published'
      ? 'Champs valides. L’annonce n’a pas été publiée; la publication exige le service Ecolia.'
      : 'Champs valides dans ce navigateur uniquement. Aucune donnée n’a été enregistrée.';
  feedback.hidden = false;
  feedback.focus();
});
document.querySelector('[data-archive-form]')?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const feedback = event.currentTarget.querySelector('.workspace-feedback');
  feedback.textContent = 'Confirmation comprise. Aucun dossier n’a été archivé.';
  feedback.hidden = false;
  feedback.focus();
});
const search = document.querySelector('[data-workspace-search]');
search?.addEventListener('input', () => {
  const status = document.querySelector('[data-search-status]');
  status.textContent = search.value.trim()
    ? 'Aucun élément ne correspond : aucun dossier n’est chargé pour effectuer cette recherche.'
    : 'Aucun résultat car aucun dossier n’est chargé.';
});
if (moduleKey === 'announcements' && (action === 'create' || action === 'edit')) {
  const form = document.querySelector('[data-workspace-form]');
  const fields = [...form.querySelectorAll('input,select,textarea')];
  const updatePreview = () => {
    const values = fields.map((field) => field.value.trim());
    document.querySelector('[data-preview-title]').textContent = values[0] || 'Votre annonce';
    document.querySelector('[data-preview-category]').textContent =
      values[1] || 'Catégorie à choisir';
    document.querySelector('[data-preview-audience]').textContent =
      values[2] || 'Destinataires à choisir';
    document.querySelector('[data-preview-body]').textContent =
      values[6] || 'Le texte saisi apparaîtra ici. Aucun destinataire ne sera notifié.';
    document.querySelector('[data-preview-date]').textContent = values[4]
      ? `Publication prévue : ${values[4]}`
      : 'Publication : non définie';
    document.querySelector('[data-preview-expiry]').textContent = values[5]
      ? `Expiration prévue : ${values[5]}`
      : 'Expiration : non définie';
    document.querySelector('[data-preview-state]').textContent =
      form.querySelector('#publication-state').value === 'published'
        ? 'Aperçu « publié » — non diffusé'
        : 'Brouillon — non enregistré';
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
}
