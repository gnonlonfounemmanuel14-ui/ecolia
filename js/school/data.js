// Accès aux données partagé par les écrans du tableau de bord.
import { q, fetchAll } from './ui.js';

export const METHODS = {
  cash: 'Espèces',
  mobile_money: 'Mobile money',
  card: 'Carte bancaire',
  bank: 'Virement',
  other: 'Autre',
};
export const KINDS = { interro: 'Interrogation', devoir: 'Devoir', examen: 'Examen' };

// Classes, matières et années de l'école (petites listes, chargées d'un coup).
export async function loadLookups(ctx) {
  const sid = ctx.schoolId;
  const [classes, subjects, years] = await Promise.all([
    q(ctx.supabase.from('classes').select('*').eq('school_id', sid).order('name')),
    q(ctx.supabase.from('subjects').select('*').eq('school_id', sid).order('name')),
    q(ctx.supabase.from('academic_years').select('*').eq('school_id', sid).order('name')),
  ]);
  return { classes, subjects, years };
}

export const classOptions = (classes, blank = 'Aucune classe') => [
  { value: '', label: blank },
  ...classes.map((c) => ({ value: c.id, label: c.name })),
];

const FRIENDLY = {
  role_conflict: 'Cette personne a déjà un autre rôle dans votre école.',
  invalid_email: 'Adresse e-mail invalide.',
  invalid_name: 'Nom invalide.',
  invalid_students: 'Élève(s) invalide(s).',
  forbidden: 'Seul le directeur de l’école peut créer des comptes.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
};

// Appelle une fonction serveur et transforme les erreurs en messages compréhensibles.
export async function callFunction(supabase, name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data;
  let reason = '';
  try {
    reason = (await error.context.json()).error || '';
  } catch {
    reason = '';
  }
  const failure = new Error(reason || error.message || 'function_error');
  failure.userMessage = FRIENDLY[reason] || 'Le service est momentanément indisponible. Réessayez plus tard.';
  throw failure;
}

export { fetchAll };
