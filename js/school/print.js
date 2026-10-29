// Bulletins et reçus imprimables.
import { h, q, fetchAll, fcfa, dateFr, num, openPrintWindow, toast, describeError } from './ui.js';
import { METHODS, KINDS } from './data.js';

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n === null || n === undefined ? '—' : String(round2(n)).replace('.', ','));

// Notes d'un élève, regroupées par matière, avec moyennes sur 20 pondérées par coefficient.
export function computeReport(grades, assessments, subjects, term) {
  const byAssessment = new Map(assessments.map((a) => [a.id, a]));
  const groups = new Map();
  for (const g of grades) {
    const a = byAssessment.get(g.assessment_id);
    if (!a) continue;
    if (term && a.term !== term) continue;
    const item = {
      title: a.title,
      kind: a.kind,
      term: a.term,
      date: a.held_on,
      score: Number(g.score),
      max: Number(a.max_score),
      coef: Number(a.coefficient),
    };
    item.on20 = (item.score / item.max) * 20;
    if (!groups.has(a.subject_id)) groups.set(a.subject_id, []);
    groups.get(a.subject_id).push(item);
  }
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const list = [...groups.entries()]
    .map(([id, items]) => {
      const coefs = items.reduce((s, i) => s + i.coef, 0);
      const average = coefs > 0 ? items.reduce((s, i) => s + i.on20 * i.coef, 0) / coefs : null;
      return { id, name: names.get(id) || 'Matière', items, average };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const withAvg = list.filter((s) => s.average !== null);
  const general = withAvg.length ? withAvg.reduce((s, x) => s + x.average, 0) / withAvg.length : null;
  return { subjects: list, general };
}

export async function loadReportData(ctx, studentId) {
  const grades = await fetchAll(() => ctx.supabase.from('grades').select('*').eq('student_id', studentId).order('assessment_id'));
  const ids = [...new Set(grades.map((g) => g.assessment_id))];
  let assessments = [];
  for (let i = 0; i < ids.length; i += 150) {
    assessments = assessments.concat(await q(ctx.supabase.from('assessments').select('*').in('id', ids.slice(i, i + 150))));
  }
  const subjects = await q(ctx.supabase.from('subjects').select('*').eq('school_id', ctx.schoolId));
  return { grades, assessments, subjects };
}

export async function printBulletin(ctx, student, className, term) {
  const w = openPrintWindow(`Bulletin - ${student.full_name}`);
  if (!w) return toast('Autorisez les fenêtres pop-up pour imprimer.', 'error');
  try {
    const { grades, assessments, subjects } = await loadReportData(ctx, student.id);
    const report = computeReport(grades, assessments, subjects, term);
    const rows = report.subjects.map((s) =>
      h('tr', {}, h('td', { text: s.name }), h('td', { text: s.items.map((i) => `${fmt(i.score)}/${fmt(i.max)}`).join('  ·  ') }), h('td', { class: 'right', text: fmt(s.average) }))
    );
    const doc = h(
      'div',
      {},
      h('div', { class: 'head' }, h('h1', { text: ctx.state.schoolName || 'Établissement' }), h('div', { class: 'muted', text: 'Bulletin de notes' })),
      h('p', {}, h('b', { text: 'Élève : ' }), student.full_name, h('br'), h('b', { text: 'Classe : ' }), className || '—', h('br'), h('b', { text: 'Période : ' }), term || 'Toutes les périodes'),
      report.subjects.length
        ? h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Matière' }), h('th', { text: 'Notes' }), h('th', { class: 'right', text: 'Moyenne /20' }))), h('tbody', {}, rows))
        : h('p', { text: 'Aucune note enregistrée pour cette période.' }),
      h('p', { class: 'total', text: `Moyenne générale : ${fmt(report.general)} / 20` }),
      h('div', { class: 'sign' }, h('span', { text: `Édité le ${dateFr(new Date().toISOString())}` }), h('span', { text: 'Signature de la direction' })),
      h('p', { class: 'noprint' }, h('button', { type: 'button', onclick: () => w.print(), text: 'Imprimer' }))
    );
    w.document.body.replaceChildren(doc);
  } catch (error) {
    w.close();
    toast(describeError(error), 'error');
  }
}

export async function printReceipt(ctx, payment, student, className) {
  const w = openPrintWindow(`Reçu ${payment.receipt_no || ''}`);
  if (!w) return toast('Autorisez les fenêtres pop-up pour imprimer.', 'error');
  try {
    const rows = await q(ctx.supabase.from('student_balances').select('*').eq('student_id', student.id));
    const balance = rows[0];
    const doc = h(
      'div',
      {},
      h('div', { class: 'head' }, h('h1', { text: ctx.state.schoolName || 'Établissement' }), h('div', { class: 'muted', text: `Reçu de paiement N° ${payment.receipt_no || '—'}` })),
      h(
        'table',
        {},
        h('tbody', {}, [
          ['Élève', student.full_name],
          ['Classe', className || '—'],
          ['Date du paiement', dateFr(payment.paid_at)],
          ['Mode de paiement', METHODS[payment.method] || payment.method],
          ['Montant reçu', fcfa(payment.amount_fcfa)],
          ['Total dû', balance ? fcfa(balance.due_fcfa) : '—'],
          ['Total payé à ce jour', balance ? fcfa(balance.paid_fcfa) : '—'],
          ['Reste à payer', balance ? fcfa(balance.remaining_fcfa) : '—'],
        ].map(([k, v]) => h('tr', {}, h('th', { text: k }), h('td', { text: v }))))
      ),
      h('div', { class: 'sign' }, h('span', { text: `Édité le ${dateFr(new Date().toISOString())}` }), h('span', { text: 'Cachet et signature' })),
      h('p', { class: 'noprint' }, h('button', { type: 'button', onclick: () => w.print(), text: 'Imprimer' }))
    );
    w.document.body.replaceChildren(doc);
  } catch (error) {
    w.close();
    toast(describeError(error), 'error');
  }
}

export { KINDS, num };
