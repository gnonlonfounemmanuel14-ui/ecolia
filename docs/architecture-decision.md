# Ecolia — dossier de décision d’architecture

**Statut :** proposition à examiner; aucune décision n’est considérée comme validée.  
**Sources et prix consultés le :** 20 octobre 2026. Les prix changent et ne constituent pas un devis.  
**Périmètre :** conception uniquement. Aucun backend, schéma ou migration n’est créé.

## 1. Résumé et objectifs

Le dépôt actuel est une vitrine statique HTML, CSS et JavaScript. Il n’a ni API, ni base de données, ni comptes opérationnels. Le frontend doit être conservé.

La cible recommandée est un monolithe modulaire : frontend statique existant, API Node.js/TypeScript avec NestJS, PostgreSQL, Prisma ORM et fournisseur d’identité géré. Le navigateur parlera à l’API sous le même domaine, et l’API sera responsable des permissions et du contexte établissement. Les données métier seront isolées par tenant dans l’API, les contraintes relationnelles et, en défense supplémentaire, PostgreSQL Row-Level Security (RLS).

Les pays de lancement, la résidence des données, le budget, la région d’hébergement et le fournisseur d’identité restent à décider.

## 2. Architecture actuelle et cible

### Faits vérifiés

- Pages HTML : index.html et sept pages dans pages/.
- CSS : css/site.css. JavaScript natif : js/main.js et js/site-shell.js.
- Le menu, le masquage des mots de passe et certaines validations fonctionnent côté navigateur.
- Connexion, inscription et contact n’envoient aucune donnée. Google/GitHub sont des boutons d’interface non configurés.
- Aucun backend, base, schéma, migration, test applicatif, manifeste npm ou configuration d’environnement n’a été trouvé.
- Le chargeur de fragments HTML existe, mais les pages contiennent actuellement leur propre header/footer.

### Architecture cible proposée

    Navigateur
      ├─ site public HTML/CSS/JS conservé
      └─ appels same-origin /api/*
                ↓
       API NestJS — monolithe modulaire
       identité, sessions, permissions, services métier
                ↓ Prisma
       PostgreSQL managé
                ↓
       stockage privé uniquement si un cas d’usage l’exige

Le frontend n’est pas converti en framework. Le même domaine pour le site et l’API simplifie cookies et CORS. Les secrets restent côté serveur.

## 3. Comparaison des technologies

| Domaine          | Option                                 | Avantages                                                                                               | Coûts et limites                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API              | NestJS + TypeScript                    | Modules, injection et guards cohérents pour un domaine métier croissant; frontend indépendant.          | Build et conventions supplémentaires par rapport à Node minimal. Garder un monolithe; éviter les microservices au début.                                                                                                                                                                                      |
| API              | Node/Express minimal                   | Démarrage et liberté simples.                                                                           | Validation, organisation, erreurs et permissions davantage à construire et maintenir.                                                                                                                                                                                                                         |
| Base             | PostgreSQL                             | Transactions, relations, contraintes et RLS bien adaptés aux liens école/personnes/années.              | Nécessite migrations, sauvegardes, supervision et pratiques d’accès disciplinées.                                                                                                                                                                                                                             |
| ORM              | Prisma ORM                             | Requêtes typées et migrations relisibles. Compatible PostgreSQL.                                        | L’ORM ne donne pas l’autorisation tenant; RLS et contraintes composites nécessitent SQL et tests spécifiques.                                                                                                                                                                                                 |
| Version Prisma   | Prisma ORM 7                           | Version stable à retenir pour un premier prototype.                                                     | Épingler les versions et vérifier les migrations aux montées de version.                                                                                                                                                                                                                                      |
| Version Prisma   | Prisma ORM 8                           | Nouvelle conception de migrations dans la documentation actuelle.                                       | La documentation consultée annonce Prisma ORM 8 comme release candidate; attendre une version stable avant production. [Statut officiel](https://www.prisma.io/docs/orm).                                                                                                                                     |
| Authentification | Supabase Auth derrière un BFF NestJS   | Email vérifié, récupération, OAuth et gestion d’identité gérés; réduit le code de sécurité à maintenir. | Dépendance fournisseur et intégration BFF à prototyper. Le SDK JS persiste les sessions dans localStorage par défaut; ne pas utiliser ce stockage pour les jetons d’authentification. [Auth](https://supabase.com/docs/guides/auth), [comportement SDK](https://supabase.com/docs/reference/javascript/auth). |
| Authentification | Auth gérée par Ecolia/Nest             | Contrôle complet et moindre dépendance identité.                                                        | Ecolia prend en charge hash de mots de passe, vérification, récupération, révocation, OAuth et anti-abus. Charge sensible pour une petite équipe.                                                                                                                                                             |
| Authentification | Cognito ou fournisseur géré comparable | Délègue l’identité et peut s’intégrer à l’hébergement retenu.                                           | Configuration et tarification propres au fournisseur; disponibilité régionale et callbacks à valider.                                                                                                                                                                                                         |

### Hébergement et coûts

| Fournisseur     | Avantages                                                                                                                                                                                                 | Limites vérifiées                                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase        | PostgreSQL, Auth et stockage disponible dans une même plateforme. Mise en route rapide.                                                                                                                   | Le plan Free peut mettre en pause les projets inactifs; Pro affiché à partir de 25 USD/mois. Les régions consultées ne listent pas l’Afrique du Sud. [Tarifs](https://supabase.com/pricing), [régions](https://supabase.com/docs/guides/platform/regions). |
| AWS             | Région Cape Town (af-south-1) existante; écosystème managé pour Postgres, calcul, identité et fichiers. [Régions AWS](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html). | Mise en œuvre et exploitation plus exigeantes; calculer le coût combiné et confirmer la disponibilité de chacun des services dans la région choisie.                                                                                                       |
| Render          | Déploiement simplifié; service Web annoncé à partir de 7 USD/mois.                                                                                                                                        | Régions listées : Oregon, Ohio, Virginie, Francfort et Singapour; pas de région africaine dans la liste consultée. [Tarifs](https://render.com/pricing), [régions](https://render.com/docs/regions).                                                       |
| Prisma Postgres | Base managée prévue pour s’utiliser avec Prisma. [Documentation](https://www.prisma.io/docs/postgres).                                                                                                    | Service supplémentaire à comparer; le choix de Prisma ORM n’impose pas son hébergement de base.                                                                                                                                                            |

**Recommandation technique :** conserver le frontend; adopter NestJS modulaire, PostgreSQL et Prisma ORM 7 stable; évaluer Supabase Auth derrière une API BFF. Supabase Pro est un choix de pilote si sa région et ses conditions de résidence conviennent. Si le marché pilote ou la résidence impose une région sud-africaine, étudier AWS Cape Town et vérifier la disponibilité de chaque service. Garder API et base dans la même région.

Les tarifs ci-dessus sont des prix d’entrée repérés sur les pages officielles à la date indiquée. Ils n’incluent pas le coût réel du calcul API, trafic, e-mail, sauvegardes, domaine, support, stockage, taxes ou dépassements.

## 4. Modèle multi-établissements

### Isolation obligatoire

1. Chaque donnée métier propre à une école porte un school_id non nul.
2. Le serveur déduit le tenant autorisé depuis l’utilisateur authentifié et une appartenance active. L’identifiant envoyé par le navigateur est un sélecteur, jamais une preuve d’autorisation.
3. Chaque opération read/create/update/delete vérifie l’appartenance et la permission, puis filtre toutes les requêtes avec le tenant autorisé. Aucun accès métier par identifiant seul.
4. Les relations entre lignes tenantées utilisent des clés étrangères composites incluant school_id, pour interdire le lien entre une école A et une classe d’une école B.
5. Une transaction contrôle la cohérence tenantée avant validation. Suppression définitive restreinte; archivage ou désactivation pour les dossiers conservés.
6. Ajouter PostgreSQL RLS en défense additionnelle après un prototype. Activer les politiques sur chaque table, configurer le tenant dans une transaction à portée locale, utiliser un rôle runtime qui n’est ni propriétaire ni BYPASSRLS et séparer le rôle de migration. Tester le refus si le contexte manque. PostgreSQL signale que les propriétaires contournent généralement RLS sauf FORCE ROW LEVEL SECURITY. [Documentation PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
7. Un utilisateur multi-écoles possède une appartenance séparée pour chaque école; le serveur la revérifie à chaque requête et tâche de fond.

Prisma n’applique pas ces règles automatiquement. Le contexte tenant doit être obligatoire dans les services/repositories. Un middleware ORM peut aider à repérer des requêtes non scopées, mais ne remplace pas contrôles serveur, FK composites ou RLS.

### Données globales, tenantées et historique

- Global Ecolia : User, identités externes, vérification de compte, rôle plateforme.
- Tenantées : école, appartenances, invitations, années, niveaux locaux, classes, personnes, élèves, parents/tuteurs, personnel, matières, affectations et futurs modules métier.
- Audit global : acteur, school_id facultatif pour une action opérateur, action et cible; ne pas recopier de dossiers personnels entiers dans les logs.
- Les classes, élèves, affectations, résultats et présences réfèrent l’année scolaire. À la clôture, accès ordinaire en lecture seule; corrections autorisées et auditées. Conserver les snapshots de bulletins pour préserver l’historique et les règles de calcul. Définir durée de conservation/suppression selon pays. Les transferts inter-écoles doivent être explicites et audités.

## 5. Rôles et permissions initiaux

Séparer rôle plateforme Ecolia et rôle de SchoolMembership. Un directeur ne reçoit pas automatiquement un rôle plateforme. Les permissions peuvent être resserrées à une classe ou matière.

| Rôle                             | Portée et données scolaires                                                                                                               | Finances et administration                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Administrateur général Ecolia    | Gère service et écoles clientes; aucun accès ordinaire aux dossiers d’élèves. Accès exceptionnel, motivé, limité dans le temps et audité. | Gère opérations SaaS; pas les finances internes de l’école.                          |
| Directeur/administrateur d’école | Gère son école, membres, années et dossiers selon règles locales. Jamais une autre école par ce rôle.                                     | Peut gérer les finances si habilité; actions auditées.                               |
| Personnel administratif          | Dossiers, inscriptions, classes et documents nécessaires aux tâches attribuées.                                                           | Permissions financières explicites uniquement.                                       |
| Enseignant                       | Classes, matières et périodes affectées; peut saisir présence/notes pour ses groupes.                                                     | Aucun accès par défaut.                                                              |
| Parent/tuteur                    | Consultation des seuls enfants liés et contenus publiés pour eux.                                                                         | Consultation éventuelle des frais de ses enfants; aucune modification des paiements. |
| Élève                            | Son propre horaire, résultats et annonces publiés par l’école.                                                                            | Aucun accès par défaut.                                                              |

Les contrôles sont côté API, non par masquage d’interface. Changement de rôle, invitation, révocation et action support sont audités. L’impersonation support est désactivée par défaut.

## 6. Parcours d’inscription

Champs : e-mail, mot de passe, confirmation et nom de l’établissement. Confirmation sert seulement à détecter une faute de frappe; elle n’est jamais enregistrée ni journalisée.

1. Valider côté serveur e-mail normalisé, mot de passe, taille du nom et appliquer limitation de débit. La validation navigateur n’est pas une autorité.
2. Créer une inscription en attente et idempotente; éviter de révéler si un e-mail existe.
3. Créer l’identité non vérifiée chez le fournisseur géré et envoyer le lien de vérification.
4. Callback HTTPS à destination fixe; vérifier les paramètres de sécurité du flux (state/nonce/PKCE) et code à usage unique.
5. Après vérification, créer dans une transaction DB l’utilisateur Ecolia, l’école, l’appartenance du créateur avec rôle school_admin et la configuration minimale.
6. Ouvrir session uniquement après vérification et transaction réussie; rediriger vers la configuration initiale. Aucun tableau de bord fictif.

L’identité externe et la transaction Postgres ne forment pas une transaction distribuée. Utiliser un état pending, reprise idempotente et compensation : si l’identité externe est créée mais la DB échoue durablement, désactiver/supprimer cette identité ou permettre sa réconciliation; purger les inscriptions expirées. Rejouer le callback ne doit pas créer une deuxième école ou appartenance.

Google/GitHub restent désactivés tant que les applications OAuth ne sont pas créées, les secrets configurés côté serveur, les callbacks HTTPS exacts autorisés, et state/nonce/PKCE testés. Ne jamais placer de secret OAuth dans le frontend. Aucun callback ou client n’est configuré dans le dépôt.

## 7. Schéma relationnel initial proposé

UUID côté serveur; tables tenantées avec unicité (school_id, id) pour les cibles de clés étrangères composites.

| Table                    | Champs structurants                                                                  | Contraintes/index importants                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| users                    | id, email_normalized, email_verified_at, status                                      | PK id; e-mail normalisé unique si une identité globale par e-mail est retenue.                 |
| user_identities          | id, user_id, provider, provider_subject                                              | FK user; unique (provider, provider_subject) pour lier plusieurs identités.                    |
| schools                  | id, name, slug, status, country_code, timezone                                       | PK id; unicité du slug à décider globalement ou par région.                                    |
| school_memberships       | id, school_id, user_id, role, status                                                 | FK école/user; unique (school_id, user_id); index (user_id,status) et (school_id,role,status). |
| school_invitations       | id, school_id, email_normalized, role, token_hash, expires_at, status                | Hash du jeton seulement; index tenant/e-mail/état.                                             |
| academic_years           | id, school_id, name, start_date, end_date, status                                    | Unique (school_id,id), (school_id,name); start < end.                                          |
| school_levels            | id, school_id, name, sort_order, status                                              | Unique tenantée; les niveaux peuvent être locaux.                                              |
| school_people            | id, school_id, user_id nullable, display_name, contact minimal, status               | Profil scolaire tenanté; user_id facultatif.                                                   |
| students                 | id, school_id, person_id, student_number, enrolled_at, status, archived_at           | FK composite same-school; unique (school_id,student_number).                                   |
| guardians                | id, school_id, person_id, user_id nullable                                           | Parent/tuteur peut exister sans compte.                                                        |
| student_guardians        | school_id, student_id, guardian_id, relation, permissions                            | PK composite et FK tenantées; index inverse par guardian.                                      |
| staff_profiles           | id, school_id, person_id, staff_type, status, dates                                  | Sépare fiche de personnel du compte de connexion.                                              |
| subjects                 | id, school_id, name, code, status                                                    | Unique (school_id,code).                                                                       |
| classes                  | id, school_id, academic_year_id, school_level_id, name, status                       | FK composites mêmes tenant; index (school_id,academic_year_id).                                |
| class_students           | school_id, class_id, student_id, dates                                               | PK composite; FK same-school; index (school_id,student_id).                                    |
| teaching_assignments     | id, school_id, staff_profile_id, class_id, subject_id, academic_year_id              | Toutes les FK comportent school_id.                                                            |
| sessions (si BFF Ecolia) | id, user_id, session_hash, expires_at, revoked_at, metadata minimale                 | Cookie brut jamais stocké; index hash unique et (user_id,expires_at).                          |
| audit_events             | id, actor_user_id, school_id nullable, action, target, created_at, metadata minimale | Index tenant/date et actor/date; écriture service audit.                                       |

Notes, présences, frais et paiements seront ajoutés par modules, avec tenant, année et relations composites. Les paiements devront préserver les corrections et reçus comme historique. Les détails métier dépendent des systèmes scolaires et règles comptables des pays cibles. Ne pas modéliser maintenant des PII non nécessaires.

## 8. Sécurité et sessions

### Authentification

- Préférer un fournisseur d’identité géré pour la première version. Si Ecolia gère les mots de passe, utiliser une bibliothèque éprouvée et Argon2id; jamais de texte clair, de chiffrement réversible ou de hash rapide. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Jetons de vérification et récupération : aléatoires, expirables, à usage unique; ne conserver que leur hash. Réinitialisation révoque les sessions.
- Rate limit par compte et source, délais progressifs et messages qui limitent l’énumération.

### Session web proposée

Utiliser un BFF NestJS et une session opaque côté serveur. Cookie \_\_Host-ecolia.sid avec HttpOnly, Secure, Path=/, sans Domain, SameSite=Lax (ou Strict après test des retours OAuth), durée d’inactivité et durée absolue, rotation après login et révocation au logout. Ne pas conserver jetons ou identifiants d’authentification dans localStorage/sessionStorage.

Ajouter jeton CSRF aux requêtes mutantes, contrôle Origin, CORS limité, TLS, validation DTO, CSP, échappement de sortie, limites de taille et rate limiting. SameSite complète mais ne remplace pas la protection CSRF. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Si un client mobile impose des bearer tokens, définir issuer/audience, durée courte, rotation/révocation de refresh tokens et stockage mobile sécurisé séparément.

### Données et exploitation

- Secrets DB, identité, e-mail et stockage dans un secret manager par environnement; aucun secret dans le frontend ou le dépôt. Rôle DB runtime minimal; migrations avec rôle séparé.
- Chiffrement TLS et au repos selon le fournisseur; sauvegardes chiffrées, restauration testée, RPO/RTO décidés.
- Audit des changements de rôles, dossiers, notes, paiements, exports et sessions; minimiser PII dans les logs.
- Fichiers futurs : bucket privé, clés tenantées, URL présignées courtes, limites MIME/taille, antivirus/quarantaine, chiffrement.
- Définir minimisation, conservation, export, suppression et réponse incident avec expertise juridique des pays pilotes; ne revendiquer aucune conformité avant vérification.

## 9. Hébergement et environnements

| Environnement | Usage                                            | Données                                                       |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Local         | API et Postgres jetable                          | Données synthétiques, secrets locaux non commités.            |
| CI            | Tests, lint et migrations                        | Secrets test seulement; aucun accès production.               |
| Staging       | Recette OAuth, e-mail, permissions et migrations | Données synthétiques ou anonymisées.                          |
| Production    | Écoles clientes                                  | Secrets gérés, TLS, backups, alertes et procédure d’incident. |

API et DB dans une seule région; réseau privé et accès DB limité. Le choix de région exprime une décision de résidence et latence, pas une garantie de conformité. Supabase/Render n’ont pas de région africaine dans leurs listes consultées; AWS liste Cape Town, à confirmer service par service.

## 10. Stratégie de tests obligatoire

1. Unitaires : normalisation, validation, politiques de rôles et état d’inscription.
2. Intégration Postgres : contraintes, FK composites, transaction/rollback, migrations depuis base vide et précédente.
3. E2E auth : inscription, doublon, e-mail non vérifié, lien expiré/rejoué, login/logout, révocation, récupération et OAuth callbacks/state.
4. Permissions : matrice par rôle et opération read/create/update/delete par API.
5. Test d’isolation A/B bloquant : user A peut lire/modifier ses données; lire, créer, modifier ou supprimer des lignes de B doit échouer même si l’identifiant B est injecté dans URL/body. Tester relations croisées, utilisateur multi-écoles, absence de tenant et tâches de fond.
6. RLS sous le vrai rôle runtime, pas rôle owner/bypass; vérifier SELECT/INSERT/UPDATE/DELETE et refus de contexte absent.
7. Saga d’inscription : pannes entre fournisseur d’identité et DB, callbacks multiples, reprise et compensation; aucune école orpheline.
8. Sécurité web : CSRF, cookies, CORS, injection, brute force, énumération, payloads et secrets absents du bundle.
9. Restauration : reconstruire dans un environnement isolé et confirmer intégrité et RPO/RTO.

Tester seulement la présence d’un filtre school_id dans le code ne suffit pas : appeler l’API et la DB avec deux tenants et prouver refus de lecture comme d’écriture sur le tenant étranger.

## 11. Risques, coûts et dépendances

| Sujet            | Risque                                                 | Mesure                                                                                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Isolation tenant | Fuite d’informations entre écoles.                     | FK composites, vérification API, RLS optionnel, tests A/B en CI.                                        |
| Région           | Latence ou résidence inadaptée.                        | Choisir pays pilote et vérifier services disponibles avant souscription.                                |
| Auth gérée       | Dépendance et flux BFF plus complexes.                 | Interface IdentityProvider, UUID Ecolia, POC de callbacks et récupération.                              |
| Prisma + RLS     | Rôle DB mal configuré ou contexte perdu avec le pool.  | Transaction SET LOCAL, runtime non-owner, tests du rôle exact.                                          |
| E-mail/OAuth     | Non-délivrabilité, callback mal configuré, usurpation. | SPF/DKIM/DMARC, domaine dédié, redirect allowlist et tests.                                             |
| Mineurs          | Données particulièrement sensibles.                    | Minimisation, rôles serrés, politique de conservation et procédure incident avant pilote réel.          |
| Coûts            | Prix d’entrée ne représente pas le coût production.    | Budget plafond et alertes; compter compute, DB, backups, e-mail, logs, stockage, trafic, taxes/support. |

Sans nombre d’écoles, comptes actifs, fichiers, trafic, région et disponibilité cible, une estimation mensuelle totale serait trompeuse. Supabase Pro affiché à partir de 25 USD/mois plus calcul API/SMTP est un repère de départ. Render Web à partir de 7 USD/mois est un repère de calcul, sans région africaine listée. AWS Cape Town peut répondre à une priorité régionale avec plus de configuration et de coûts multi-services. Faire un chiffrage de scénario avant souscription.

## 12. Plan de mise en œuvre incrémental

1. Valider pays pilote, budget, résidence, identité, rôles et conservation.
2. Prototyper NestJS, PostgreSQL local/managé, endpoint de santé et appel same-origin sans changer le frontend existant.
3. Prouver identité : email, vérification, BFF cookie, logout, récupération et callbacks.
4. Créer migrations de fondation : user, identities, school, membership, rôles, invitations, audit.
5. Implanter contexte tenant, FK composites et RLS si validé.
6. Écrire et faire passer les tests d’isolation A/B avant les données scolaires.
7. Construire l’inscription idempotente et l’onboarding établissement.
8. Ajouter année, niveaux, classes, élèves, tuteurs, personnel et matières.
9. Ajouter finances et pédagogie après validation des règles locales.
10. Ajouter portails, notifications, abonnements, supervision, sauvegarde et revue sécurité avant pilote réel.

## 13. Décisions nécessitant votre accord

1. Quels pays sont prioritaires et y a-t-il une exigence de résidence des données?
2. Le pilote privilégie-t-il la simplicité (Supabase) ou une région AWS Cape Town plus proche de l’Afrique australe?
3. Quel budget mensuel pilote acceptez-vous pour API, DB, e-mail, backups et stockage?
4. Validez-vous Supabase Auth derrière BFF NestJS, ou faut-il comparer Cognito/autre fournisseur?
5. Parents et élèves se connectent-ils au premier pilote, ou uniquement le personnel scolaire?
6. Qui peut voir et modifier finances et dossiers sensibles?
7. Quelles durées de conservation, suppression et accès support sont requises?
8. Google/GitHub sont-ils indispensables au lancement, ou l’e-mail vérifié suffit-il?
9. Quel RPO/RTO de sauvegarde et restauration est attendu?

## 14. Première tâche après validation

POC isolé NestJS + PostgreSQL, API same-origin appelée depuis une page HTML existante, et test démontrant qu’un utilisateur du tenant A ne peut pas lire ni modifier B. Si Supabase Auth est approuvé, inclure inscription e-mail, vérification, cookie BFF HttpOnly et reconnexion. N’utiliser aucune donnée élève.

Mesurer effort, latence et callbacks avant de concevoir le schéma métier complet ou déplacer le frontend.

---

## Sources officielles consultées

- [NestJS — authentification](https://docs.nestjs.com/security/authentication) et [autorisation](https://docs.nestjs.com/security/authorization).
- [Prisma ORM — statut](https://www.prisma.io/docs/orm), [migrations](https://www.prisma.io/docs/orm/migrations/how-migrations-work), [transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
- [Supabase Auth](https://supabase.com/docs/guides/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [tarifs](https://supabase.com/pricing), [régions](https://supabase.com/docs/guides/platform/regions).
- [PostgreSQL — Row Security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
- [OWASP — stockage des mots de passe](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) et [sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [Render — tarifs](https://render.com/pricing) et [régions](https://render.com/docs/regions); [AWS — régions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html).
