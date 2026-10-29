# Ressources visuelles

Ce dossier sépare les pistes d'images des ressources utilisables dans le site. Aucune photographie n'est téléchargée dans ce projet.

## Méthode

1. Rechercher une photographie sur sa plateforme d'origine et conserver l'URL de sa page (pas une miniature de moteur de recherche).
2. Ouvrir la page originale, vérifier l'image, le photographe et les conditions/licence applicables à cette ressource. Noter la date réelle du contrôle.
3. Évaluer séparément l'adéquation éditoriale, la dignité des personnes et, lorsqu'il s'agit d'enfants, le contexte et les droits à l'image.
4. Placer les candidates dans `image-sources.json` et `images-a-valider.md`. Ne renseigner une URL directe qu'après l'avoir constatée sur la page source. La validation humaine éditoriale est distincte du contrôle technique et de licence.
5. Après validation, transférer la ressource dans `images-approuvees.json`, puis l'exposer dans `js/data/images.js`. Le site référence l'identifiant stable, jamais une URL de photo inscrite dans une page.

Les licences générales d'Unsplash et de Pexels ne remplacent pas la vérification de la page et des droits de personnes, marques ou œuvres visibles dans une image. Les sources de licence consultées sont indiquées dans la documentation des candidates.

## En cas d'indisponibilité

Marquer la ressource `Indisponible`, consigner la date et le résultat, puis retirer son entrée du catalogue approuvé. Le composant doit revenir à son fond CSS neutre; ne pas lui substituer une photographie non approuvée. Ne pas supprimer l'historique de source.

## Statuts

- **À vérifier** : page, contenu ou licence non contrôlés.
- **Vérifiée, à valider** : page originale et licence consultées; décision éditoriale encore attendue.
- **Approuvée** : contrôles documentés et validation éditoriale obtenue.
- **Rejetée** : ne pas intégrer.
- **Indisponible** : source inaccessible ou ressource retirée.

Le catalogue approuvé est actuellement vide. Les pages utilisent uniquement des illustrations et fonds CSS originaux.
