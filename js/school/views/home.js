import { h, fcfa, num, barChart, progress, monthLabel } from '../ui.js';

export async function render(root, ctx) {
  const { data, error } = await ctx.supabase.rpc('director_dashboard');
  if (error) throw error;
  const d = data;
  const limit = d.plan && d.plan.limit;
  const students = Number(d.counts.students);
  const nearLimit = limit && students >= limit * 0.8;

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('h1', { text: d.school.name }), h('p', { class: 'muted', text: 'Vue d’ensemble de votre établissement' })),
      d.plan && h('span', { class: 'chip', text: `Formule ${d.plan.name}` })
    )
  );

  if (nearLimit) {
    root.append(
      h(
        'div',
        { class: 'banner banner-warn', role: 'status' },
        h('span', { text: students >= limit ? `Vous avez atteint la limite de ${num(limit)} élèves de votre formule.` : `Vous approchez de la limite de ${num(limit)} élèves de votre formule (${num(students)} inscrits).` }),
        h('a', { class: 'btn secondary', href: 'choose-plan.html?change=1', text: 'Changer de formule' })
      )
    );
  }

  const kpi = (label, value, note) => h('div', { class: 'kpi card' }, h('span', { class: 'kpi-label', text: label }), h('strong', { class: 'kpi-value', text: value }), note && h('span', { class: 'kpi-note', text: note }));
  root.append(
    h(
      'div',
      { class: 'kpi-grid' },
      kpi('Élèves', limit ? `${num(students)} / ${num(limit)}` : num(students), limit ? 'selon votre formule' : 'sans limite'),
      kpi('Personnel', num(d.counts.staff)),
      kpi('Classes', num(d.counts.classes)),
      kpi('Reste à encaisser', fcfa(d.finance.remaining), `sur ${fcfa(d.finance.due)} dus`)
    )
  );

  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', { text: 'Scolarité encaissée' }),
      h('p', { class: 'muted', text: `${fcfa(d.finance.paid)} encaissés sur ${fcfa(d.finance.due)}` }),
      progress(Number(d.finance.paid), Number(d.finance.due))
    )
  );

  root.append(
    h(
      'div',
      { class: 'two-col' },
      h('section', { class: 'card' }, h('h2', { text: 'Élèves par classe' }), barChart(d.studentsByClass.map((c) => ({ label: c.class, value: Number(c.count) })), { emptyText: 'Créez des classes et ajoutez des élèves pour voir ce graphique.' })),
      h(
        'section',
        { class: 'card' },
        h('h2', { text: 'Encaissements des 6 derniers mois' }),
        barChart(d.paymentsByMonth.map((m) => ({ label: monthLabel(m.month), value: Number(m.total) })), { format: (n) => num(n), color: 'var(--navy)', emptyText: 'Aucun paiement enregistré pour le moment.' })
      )
    )
  );

  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', { text: 'Groupe WhatsApp des parents' }),
      d.school.whatsapp
        ? h('p', {}, 'Lien configuré : ', h('a', { href: d.school.whatsapp, target: '_blank', rel: 'noopener noreferrer', text: 'ouvrir le groupe' }))
        : h('p', {}, 'Aucun lien configuré. ', h('a', { href: '#/parametres', text: 'Ajouter le lien du groupe' }))
    )
  );
}
