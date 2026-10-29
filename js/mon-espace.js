// Aiguillage « Mon espace » : envoie la personne connectée vers son tableau de bord.
import { isConfigured, getUser, getState, destinationFor } from './auth-shared.js';

const text = document.querySelector('[data-redirect-text]');

(async () => {
  try {
    if (!isConfigured) throw new Error('not-configured');
    const user = await getUser();
    if (!user) return location.replace('login.html');
    location.replace(destinationFor(await getState()));
  } catch {
    if (text) text.textContent = 'Impossible de charger votre espace pour le moment. Réessayez plus tard.';
  }
})();
