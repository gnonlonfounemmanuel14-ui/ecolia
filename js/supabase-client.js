// Client Supabase unique pour tout le site.
// L’adresse du fragment (#...) est lue AVANT la création du client : Supabase la nettoie ensuite,
// et les pages de lien e-mail (mot de passe, confirmation) en ont besoin.
export const initialHash = location.hash;

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

// La bibliothèque est chargée depuis Internet. Si la version figée est introuvable ou bloquée,
// on essaie la dernière version 2.x, puis un second hébergeur.
export const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.1/+esm',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2',
];
let createClient = null;
let loadedFrom = null;
for (const source of SOURCES) {
  try {
    ({ createClient } = await import(source));
    loadedFrom = source;
    break;
  } catch (error) {
    console.warn('Ecolia : chargement de Supabase impossible depuis', source, error);
  }
}

export const isConfigured =
  !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_ANON_KEY.includes('VOTRE_CLE');
export const libraryError = !createClient;
export const libraryUrl = loadedFrom;
window.__ecoliaLibError = libraryError;

// Sans bibliothèque, tout appel échoue proprement (les pages affichent alors un message d'erreur).
const unavailable = new Proxy(
  {},
  {
    get() {
      throw new Error('supabase-js indisponible');
    },
  }
);

export const supabase = createClient
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : unavailable;