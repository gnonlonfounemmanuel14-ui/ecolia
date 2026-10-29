// Seules les images ayant reçu une validation éditoriale et documentaire figurent ici.
// Utiliser imagesById[id] plutôt que des URL de photos écrites dans le HTML.
export const approvedImages = [];
export const imagesById = Object.freeze(
  Object.fromEntries(approvedImages.map((image) => [image.id, image]))
);
