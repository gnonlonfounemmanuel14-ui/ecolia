# Ecolia · Backend Supabase (phases 2 à 6)

Contenu : 3 scripts SQL, 4 fonctions serveur (Edge Functions).

## Ordre d'installation

### 1. Scripts SQL (SQL Editor, un par un, CHACUN UNE SEULE FOIS)
Prérequis déjà faits : phase 1, phase 1b, étape B1 et B2 (tables de l'école).

1. `sql/04_paiements.sql`
2. `sql/05_stockage.sql`
3. `sql/06_tableaux_de_bord.sql`

Chaque script doit afficher « Success ». En cas d'erreur, copiez le message exact.

### 2. Secrets des fonctions (Edge Functions > Secrets)
| Nom | Valeur |
|---|---|
| `FEDAPAY_SECRET_KEY` | clé secrète du compte FedaPay en mode sandbox (test) |
| `FEDAPAY_ENV` | `sandbox` (puis `live` au lancement) |
| `SITE_URL` | `http://localhost:5500` en test, la vraie adresse au lancement |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement
aux fonctions par Supabase : ne les saisissez pas.

### 3. Déployer les 4 fonctions (Edge Functions > Deploy a new function > Via Editor)
Pour chaque dossier de `functions/`, créez une fonction du MÊME NOM et collez le contenu de `index.ts` :
`create-checkout`, `fedapay-webhook`, `pay-fees`, `invite-user`.

Pour `fedapay-webhook` UNIQUEMENT : désactivez la vérification du jeton (option « Verify JWT » /
« Enforce JWT Verification » dans les réglages de la fonction). FedaPay n'envoie pas de jeton Supabase.
Les trois autres gardent cette vérification activée.

### 4. FedaPay
1. Compte FedaPay en mode test (sandbox) : récupérez la clé API secrète.
2. FedaPay > Webhooks > nouveau webhook :
   - adresse : `https://VOTRE-REF.supabase.co/functions/v1/fedapay-webhook`
   - événements : `transaction.approved`, `transaction.declined`, `transaction.canceled`
3. Les paiements de test se font avec les moyens de test fournis par FedaPay (voir sa documentation).

## Sécurité : ce qui est garanti
- Les prix viennent de la table `plans`. Le navigateur n'envoie que le nom de la formule.
- Le webhook ne croit jamais le message reçu : il retrouve NOTRE paiement, redemande l'état réel
  de la transaction à FedaPay avec la clé secrète, et vérifie que le montant est exact.
- Un paiement ne peut activer une formule qu'une seule fois (opération idempotente).
- Le directeur ne peut inviter que dans SON école, ne peut pas changer le rôle d'un membre existant,
  et ne voit jamais de mot de passe : la personne invitée reçoit un lien et choisit le sien.
- Une école suspendue perd immédiatement l'accès de tous ses membres.

## Points ouverts (à décider avant le lancement réel)
1. **Reversement aux écoles** : `pay-fees` encaisse la scolarité sur le compte FedaPay d'Ecolia.
   Rien ne reverse l'argent aux écoles. Deux options : un compte FedaPay par école, ou des
   virements de votre compte vers les écoles. Verifiez aussi le cadre légal.
2. **Expiration des abonnements** : la date de fin est enregistrée (`current_period_end`) mais aucune
   tâche automatique ne repasse une école expirée en formule gratuite ou bloquée.
3. **Signature du webhook** : non utilisée, car la vérification auprès de l'API FedaPay la rend
   inutile ; vous pourrez l'ajouter en plus.
4. **Retour à la formule Gratuite** depuis une formule payante : non géré.
