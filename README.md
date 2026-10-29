# Ecolia — site public

Site vitrine statique en HTML5, CSS3 et JavaScript natif (modules ES). Les pages publiques intègrent leur header et footer HTML; lancer un serveur HTTP local à la racine du dossier pour les afficher.

## Pages

- `index.html` : présentation du projet.
- `pages/features.html`, `about.html`, `pricing.html`, `faq.html`, `contact.html` : pages publiques.
- `pages/login.html`, `register-school.html` : formulaires préparés pour une future intégration d'authentification; aucun compte n'est créé sans service serveur.
- `pages/forgot-password.html`, `reset-password.html` : interfaces de récupération sans envoi ni changement réel.
- `pages/app.html?role=...` : maquettes responsives partagées des espaces administration Ecolia, direction, personnel administratif, enseignant, parent, élève et communauté. `module` choisit un écran, `action=list|detail|create|edit|archive` son état, et `view` une rubrique financière. Contenus vides, aucune persistance; le rôle en URL ne constitue pas une autorisation.
- `docs/frontend-functional-map.md` : arborescence fonctionnelle et frontières explicites avec les services backend à venir.
- `partials/site-header.html`, `site-footer.html` : navigation et pied de page communs à l'ensemble des pages.
- `js/contact-config.js` : coordonnées officielles à renseigner; les entrées vides ou invalides restent masquées.
- Les formulaires de connexion, contact et inscription n'ont pas encore de point d'accès serveur configuré. Ils empêchent l'envoi par défaut, valident les champs côté navigateur et n'affichent pas de confirmation d'opération.

Les écrans d’espace utilisateur, formulaires de récupération et formulaires marketing ne sont pas connectés à des services. Authentification, OAuth, e-mail, sauvegarde, recherche réelle, droits d’accès et opérations métier demandent une API/configuration serveur. Le dossier fourni ne contient pas de dépôt Git (`git status` indique que le dossier n’est pas un dépôt); aucun historique de versions local n’était disponible pour restauration.

## Identité et code

- Couleurs de marque centralisées dans `css/site.css`; bleu profond `#163A5F`, vert `#16A085`, bleu clair `#EAF3FA`, gris clair `#F4F6F8`, texte `#1F2937`, orange `#F59E0B`, erreur `#DC2626`.
- Logos SVG originaux dans `assets/logos/`; icône compacte également utilisée comme favicon.
- Le site emploie DM Sans et Manrope depuis Google Fonts avec des polices système de remplacement. En mode hors connexion, le site reste lisible sans les polices externes.
- Le menu mobile, le bouton d'affichage du mot de passe, la validation locale des formulaires et les animations de révélation se trouvent dans `js/main.js`.
- `js/site-shell.js` charge les fragments partagés, rend les coordonnées configurées et n'affiche que des liens directs validés.
- Le catalogue d'images approuvées est vide; l'interface utilise des formes CSS originales. Voir `assets/images/README.md` pour le processus de recherche, vérification, licence et validation. Les formulaires sont des démonstrations et ne conservent ni ne transmettent les données.

## Inscription et authentification

Le formulaire d'inscription demande quatre champs: email, mot de passe, confirmation et nom de l'etablissement. Les valeurs sont validees dans le navigateur, mais aucun compte ni etablissement n'est cree et aucune donnee n'est envoyee: aucun endpoint ou service d'authentification n'est configure.

Les boutons Google et GitHub sont des points d'entrée d'interface seulement. Ils affichent une erreur claire tant qu'aucun adaptateur d'authentification n'est branché. La connexion par e-mail et le formulaire d'inscription ne transmettent pas de données. Pour activer ces parcours, choisir et configurer un backend (par exemple Supabase Auth), fournir son URL et sa clé publique via la configuration de déploiement, créer les utilisateurs côté serveur et définir les URL de redirection autorisées. Dans Google Cloud, créer un client OAuth web et ajouter l'URL de callback fournie par le backend aux URI de redirection autorisés; dans GitHub, créer une OAuth App et saisir le callback exact du backend. Ne jamais mettre de clé secrète OAuth dans le navigateur. Configurer aussi les fournisseurs Google/GitHub côté backend et le lien des identités par compte vérifié. Aucun endpoint, projet, secret ou URL de callback n'est actuellement configuré.

La recuperation de mot de passe ouvre la page Contact avec le sujet prerempli; aucun mecanisme de reinitialisation reelle n'existe encore.

Les coordonnées sociales Facebook, Instagram, TikTok, YouTube et LinkedIn restent volontairement vides dans `js/contact-config.js`; renseigner uniquement les URLs officielles vérifiées pour les afficher dans la colonne Réseaux sociaux.

## Multilinguisme et paramètres pays

Le français est la seule langue actuellement rendue dans les pages. `locales/fr.json` et `locales/en.json` amorcent une structure de traduction; la version anglaise est incomplète et n'est pas présentée comme traduction vérifiée. Un sélecteur de langue sera pertinent une fois l'ensemble des pages traduit et relu. Les paramètres de système scolaire, calendrier et monnaie restent à spécifier par pays.

## Vérification locale

Le projet n'a pas de dépendances ou de scripts npm. Pour les contrôles statiques, vérifier les chemins relatifs, charger le site via un serveur local et tester les largeurs 360, 768, 1024 et 1440 px, les interactions clavier et le mode `prefers-reduced-motion`. Les coordonnées, conditions d'utilisation et politique de confidentialité restent à fournir avant leur publication.
