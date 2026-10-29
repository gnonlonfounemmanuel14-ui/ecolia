import { h, q, fetchAll, fcfa, today, formDialog, toast, describeError, emptyState, dateFr } from '../ui.js';
import { loadLookups, classOptions, METHODS } from '../data.js';
import { printReceipt } from '../print.js';
import { openStudentDetail } from './students.js';

export async function render(root, ctx) {
  const { supabase, schoolId: sid } = ctx;
  const [{ classes }, students, balances, payments] = await Promise.all([
    loadLookups(ctx),
    fetchAll(() => supabase.from('students').select('*').eq('school_id', sid).order('full_name')),
    fetchAll(() => supabase.from('student_balances').select('*').eq('school_id', sid).order('student_id')),
    q(supabase.from('student_payments').select('*').eq('school_id', sid).order('paid_at', { ascending: false }).limit(25)),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const byId = new Map(students.map((s) => [s.id, s]));
  const balance = new Map(balances.map((b) => [b.student_id, b]));
  const active = students.filter((s) => s.status === 'active');
  const total = balances.reduce((t, b) => ({ due: t.due + Number(b.due_fcfa), paid: t.paid + Number(b.paid_fcfa), rest: t.rest + Number(b.remaining_fcfa) }), { due: 0, paid: 0, rest: 0 });

  let classFilter = '';
  let onlyUnpaid = true;
  const tbody = h('tbody');

  function paint() {
    const list = active
      .filter((s) => (!classFilter || s.class_id === classFilter) && (!onlyUnpaid || Number((balance.get(s.id) || {}).remaining_fcfa) > 0))
      .sort((a, b) => Number((balance.get(b.id) || {}).remaining_fcfa || 0) - Number((balance.get(a.id) || {}).remaining_fcfa || 0));
    tbody.replaceChildren(
      ...list.map((s) => {
        const b = balance.get(s.id) || { due_fcfa: 0, paid_fcfa: 0, remaining_fcfa: 0 };
        return h('tr', {}, h('td', {}, h('button', { class: 'link-btn', type: 'button', text: s.full_name, onclick: () => openStudentDetail(ctx, s, classes) })), h('td', { text: className.get(s.class_id) || '—' }),
          h('td', { class: 'right', text: fcfa(b.due_fcfa) }), h('td', { class: 'right', text: fcfa(b.paid_fcfa) }), h('td', { class: 'right', text: fcfa(b.remaining_fcfa) }));
      })
    );
    if (!list.length) tbody.append(h('tr', {}, h('td', { colspan: 5 }, emptyState(onlyUnpaid ? 'Aucun solde impayé.' : 'Aucun élève.'))));
  }

  const classFees = () =>
    formDialog({
      title: 'Frais pour toute une classe',
      intro: 'Le même montant est ajouté pour chaque élève actif de la classe.',
      fields: [
        { name: 'class_id', label: 'Classe', type: 'select', required: true, options: classes.map((c) => ({ value: c.id, label: c.name })) },
        { name: 'label', label: 'Intitulé', required: true, maxlength: 120, placeholder: 'Scolarité 1er trimestre' },
        { name: 'amount', label: 'Montant par élève (FCFA)', type: 'number', required: true, min: 0, step: 1 },
      ],
      onSubmit: async (v) => {
        const targets = active.filter((s) => s.class_id === v.class_id);
        if (!targets.length) throw Object.assign(new Error('empty'), { userMessage: 'Cette classe n’a aucun élève actif.' });
        const rows = targets.map((s) => ({ school_id: sid, student_id: s.id, label: v.label, amount_due_fcfa: Math.round(Number(v.amount)) }));
        for (let i = 0; i < rows.length; i += 300) await q(supabase.from('student_fees').insert(rows.slice(i, i + 300)));
      },
    }).then((saved) => saved && (toast('Frais ajoutés à la classe.'), ctx.refresh()));

  const pay = () =>
    formDialog({
      title: 'Enregistrer un paiement',
      fields: [
        { name: 'student_id', label: 'Élève', type: 'select', required: true, options: active.map((s) => ({ value: s.id, label: `${s.full_name}${s.class_id ? ` — ${className.get(s.class_id)}` : ''}` })) },
        { name: 'amount', label: 'Montant reçu (FCFA)', type: 'number', required: true, min: 1, step: 1 },
        { name: 'method', label: 'Mode de paiement', type: 'select', value: 'cash', options: Object.entries(METHODS).map(([value, label]) => ({ value, label })) },
        { name: 'paid_at', label: 'Date', type: 'date', required: true, value: today() },
      ],
      onSubmit: async (v) => {
        const created = await q(
          supabase.from('student_payments').insert({ school_id: sid, student_id: v.student_id, amount_fcfa: Math.round(Number(v.amount)), method: v.method, paid_at: new Date(`${v.paid_at}T12:00:00`).toISOString(), recorded_by: ctx.user.id, status: 'approved' }).select().single()
        );
        toast(`Paiement enregistré${created.receipt_no ? ` — reçu ${created.receipt_no}` : ''}.`);
      },
    }).then((saved) => saved && ctx.refresh());

  const stat = (label, value) => h('div', { class: 'kpi card' }, h('span', { class: 'kpi-label', text: label }), h('strong', { class: 'kpi-value', text: value }));
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Finances' }), h('p', { class: 'muted', text: 'Frais de scolarité, paiements et reçus.' })),
      h('div', { class: 'row-actions is-wrap' }, h('button', { class: 'btn secondary', type: 'button', text: 'Frais pour une classe', onclick: classFees }), h('button', { class: 'btn green', type: 'button', text: 'Enregistrer un paiement', onclick: pay }))),
    h('div', { class: 'kpi-grid' }, stat('Total dû', fcfa(total.due)), stat('Total encaissé', fcfa(total.paid)), stat('Reste à encaisser', fcfa(total.rest))),
    h('section', { class: 'card table-card' },
      h('div', { class: 'toolbar' }, h('h2', { text: 'Soldes par élève' }),
        h('select', { 'aria-label': 'Filtrer par classe', onchange: (e) => ((classFilter = e.target.value), paint()) }, classOptions(classes, 'Toutes les classes').map((o) => h('option', { value: o.value, text: o.label }))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => ((onlyUnpaid = e.target.checked), paint()) }), ' Seulement les impayés')),
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Élève', 'Classe', 'Dû', 'Payé', 'Reste'].map((t, i) => h('th', { class: i >= 2 ? 'right' : '', text: t })))), tbody)),
    h('section', { class: 'card table-card' }, h('h2', { text: 'Derniers paiements' }),
      payments.length
        ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Date', 'Élève', 'Mode', 'Reçu', 'Montant', ''].map((t, i) => h('th', { class: i >= 4 ? 'right' : '', text: t })))),
            h('tbody', {}, payments.map((p) => { const s = byId.get(p.student_id); return h('tr', {}, h('td', { text: dateFr(p.paid_at) }), h('td', { text: s ? s.full_name : '—' }), h('td', { text: METHODS[p.method] || p.method }), h('td', { text: p.receipt_no || '—' }), h('td', { class: 'right', text: fcfa(p.amount_fcfa) }),
              h('td', { class: 'right' }, p.status === 'approved' && s && h('button', { class: 'btn secondary small', type: 'button', text: 'Reçu', onclick: () => printReceipt(ctx, p, s, className.get(s.class_id)) }))); })))
        : emptyState('Aucun paiement enregistré.'))
  );
  paint();
}
