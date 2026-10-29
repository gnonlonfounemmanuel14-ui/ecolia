// Fonctions communes aux pages de connexion, d’inscription et d’abonnement.
import { supabase, isConfigured, initialHash } from './supabase-client.js';

// Signale à js/boot-check.js que les scripts du site se sont bien chargés.
window.__ecoliaReady = true;

export { supabase, isConfigured };

const PENDING_KEY = 'ecolia:pending-email';
const APP_ROLES = ['director', 'admin', 'teacher', 'parent', 'student'];

// Adresse complète d’une page du dossier pages/ (pour les liens envoyés par e-mail).
export const absoluteUrl = (page) => new URL(page, location.href).href;

export const errorCode = (error) => (error && (error.code || error.error_code)) || '';

export function rememberEmail(email) {
  try {
    sessionStorage.setItem(PENDING_KEY, email);
  } catch {
    // Stockage indisponible : la page de vérification demandera l’adresse.
  }
}

// Erreur de lien e-mail (lien expiré ou déjà utilisé), renvoyée par Supabase dans le fragment.
export function authLinkError() {
  const params = new URLSearchParams(initialHash.replace(/^#/, ''));
  if (params.get('error_code')) return params.get('error_code');
  return params.get('error') ? 'error' : null;
}

export const isRecoveryLink = () => /type=recovery/.test(initialHash);

export async function getUser() {
  // getSession attend la fin de l’initialisation (y compris la lecture d’un lien e-mail).
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.user : null;
}

// État du compte, calculé côté base : { name, email, hasSchool, role, plan, platformAdmin }.
export async function getState() {
  const { data, error } = await supabase.rpc('get_my_state');
  if (error) throw error;
  return data || { name: '', email: '', hasSchool: false, role: null, plan: null, platformAdmin: false };
}

export function dashboardUrl(state) {
  if (state && state.platformAdmin) return 'app.html?role=platform'; // espace plateforme : à construire
  // Direction et personnel administratif : le vrai tableau de bord de l’école.
  if (state && (state.role === 'director' || state.role === 'admin')) return 'school.html';
  // Enseignants, parents, élèves : espaces à construire (maquette en attendant).
  return `app.html?role=${state && APP_ROLES.includes(state.role) ? state.role : 'director'}`;
}

// Où envoyer une personne connectée, selon son état.
export function destinationFor(state) {
  if (state && state.platformAdmin) return dashboardUrl(state);
  if (!state || !state.hasSchool) return 'school-name.html';
  if (state.role === 'director' && !state.plan) return 'choose-plan.html';
  return dashboardUrl(state);
}