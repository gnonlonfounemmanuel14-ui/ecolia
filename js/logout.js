// Boutons « Se déconnecter » des écrans de connexion, d'abonnement et de la maquette.
import { supabase } from './auth-shared.js';

document.querySelectorAll('[data-logout]').forEach((el) =>
  el.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await supabase.auth.signOut();
    } catch {
      // Même en cas d'erreur réseau, on revient à la connexion.
    }
    location.assign('login.html');
  })
);
