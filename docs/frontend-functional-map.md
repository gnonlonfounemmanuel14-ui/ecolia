# Ecolia — arborescence fonctionnelle du frontend

**Périmètre :** interface statique HTML/CSS/JavaScript. Aucun compte, établissement, dossier ou montant n’est chargé ni conservé.

## Organisation des fichiers

```text
index.html                         Accueil public
pages/
  features.html, pricing.html,
  about.html, faq.html, contact.html  Pages publiques existantes
  login.html, register-school.html   Authentification visuelle existante
  forgot-password.html,
  reset-password.html               Formulaires visuels de récupération
  app.html                           Coquille commune et responsive des espaces
js/
  app.js                             Routes rôle/module/action et interactions locales
css/site.css                         Styles publics, auth et espaces de travail
```

Une seule coquille `app.html` sert toutes les écoles et tous les profils. Les paramètres `role`, `module`, `action` et `view` ne sont que des choix d’affichage UX. Le serveur devra résoudre le tenant depuis l’identité et l’adhésion authentifiées, contrôler toutes les permissions, puis retourner les seules données autorisées. Aucun identifiant d’école présent dans l’URL ne doit servir à autoriser un accès.

## Espaces et modules visibles

| Espace                         | Modules dans la navigation                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administration générale Ecolia | Vue globale, établissements, comptes, abonnements SaaS, assistance, paramètres, journal d’activité                                                                                                                                                                                                  |
| Direction                      | Tableau de bord, configuration initiale, établissement, années, niveaux, élèves, personnel, classes, matières, affectations, évaluations/notes, moyennes/bulletins, présences, frais/paiements/reçus/soldes/recettes/dépenses, emplois du temps, annonces, rapports, utilisateurs/invitations/rôles |
| Personnel administratif        | Dossiers/inscriptions, listes d’élèves, classes/affectations autorisées, personnel, documents, présences, finances en lecture selon permission, annonces                                                                                                                                            |
| Enseignant                     | Classes et matières affectées, élèves affectés, présences, notes, résultats/bulletins, emploi du temps, annonces, notifications                                                                                                                                                                     |
| Parent/tuteur                  | Enfants associés, résultats publiés, bulletins, horaires, absences, annonces/notifications, frais si autorisés                                                                                                                                                                                      |
| Élève                          | Profil, emploi du temps, résultats publiés, bulletins, absences, annonces/notifications                                                                                                                                                                                                             |
| Communauté scolaire            | Annonces, notifications, événements, aide, profil, préférences, sécurité du compte                                                                                                                                                                                                                  |

Chaque module réutilise les états `list`, `detail`, `create` et `edit` au moyen de la même route. Les élèves ajoutent un aperçu d’archivage. Les sous-rubriques financières sont frais, paiements, reçus, soldes, recettes et dépenses, chaque rubrique partageant le même composant et l’état vide. Le personnel administratif voit la finance en lecture seulement dans cette maquette. Les états sans dossier sont vides; leur formulaire n’écrit rien. Les boutons de modification sont masqués pour les rôles en consultation. Ce masque UX n’est jamais un contrôle de sécurité.

Le parcours d’onboarding présente successivement la validation du compte, le rattachement du créateur avec le rôle Direction, la configuration de l’école et l’accès au tableau de bord tenanté. Aucune étape ni redirection n’est exécutée côté client.

## Annonces

La maquette permet de parcourir la liste vide, préparer un brouillon visuel, choisir une catégorie (devoir, communiqué, réunion, événement, information générale), une cible (école, personnel, parents, classe, groupe autorisé), une date de publication et une expiration facultative. Le choix d’une classe/groupe requiert une précision; l’expiration doit être après la publication. Un aperçu se met à jour dans le navigateur. Le choix d’état publié ne diffuse rien; les notifications et accusés de lecture ne sont pas simulés. Le backend devra filtrer chaque requête au tenant courant, valider les audiences autorisées, enregistrer le journal de publication et ne notifier que les destinataires du même établissement.

## Indicateurs de tableaux de bord

Le tableau de direction définit l’effectif élève (dossiers actifs pour l’année sélectionnée), l’effectif personnel, répartition par classe, présence/absence pour une période, frais attendus, règlements enregistrés, soldes, recettes et dépenses séparées si comptabilisées, résultats/bulletins par période et annonces visibles au rôle. La vue globale Ecolia définit les établissements, comptes, abonnements et demandes d’assistance. Toutes les valeurs sont volontairement « — / non calculé », sans donnée de démonstration inventée.

Les détails à valider avant le schéma de données incluent pays et calendrier, règles d’année/classe, barèmes, coefficients, périodes, arrondis, modèles de bulletin, devise, états comptables, autorisations par opération, rétention et stratégie de notification.

## À connecter avant la production

- Authentification, adhésion d’un utilisateur à une ou plusieurs écoles, vérification de l’invitation et redirection vers l’école autorisée.
- Autorisations serveur par tenant, rôle et opération, y compris toutes les lectures, exports, tâches de fond et opérations financières.
- Persistance et historique des élèves, personnel, emplois du temps, évaluations, présence, finances et annonces.
- Calcul des indicateurs depuis des définitions validées; pagination/recherche serveur tenantée.
- Publication/idempotence d’annonces, calendrier d’expiration, notifications et éventuel état de lecture.
- Audit, erreurs réseau, chargement réel, pièces jointes, reçus et protection des données personnelles.
