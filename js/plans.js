// Grille tarifaire de référence Ecolia. Les règles commerciales associées restent à valider.
export const plans = [
  { id: 'free', name: 'Gratuite', monthlyPrice: 0, capacity: 45, capacityLabel: '45 élèves maximum' },
  { id: 'standard', name: 'Standard', monthlyPrice: 10000, capacity: 250, capacityLabel: '250 élèves maximum' },
  { id: 'professional', name: 'Professionnelle', monthlyPrice: 25000, capacity: 1500, capacityLabel: '1 500 élèves maximum' },
  { id: 'unlimited', name: 'Illimitée', monthlyPrice: 45000, capacity: null, capacityLabel: 'Nombre d’élèves illimité' },
];

export const demoCapacity = { planId: 'free', students: 32 };

export function formatPlanPrice(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount);
}
