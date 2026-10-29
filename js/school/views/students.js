import { h, q, fetchAll, fcfa, dateFr, today, confirmDialog, formDialog, panelDialog, toast, describeError, emptyState, field } from '../ui.js';
import { loadLookups, classOptions, METHODS, KINDS, callFunction } from '../data.js';
import { computeReport, loadReportData, printBulletin, printReceipt } from '../print.js';
import { showSetupLink } from '../invite.js';

const blank = (v) => (v === '' || v === undefined ? null : v);

function studentFields(classes, s = {}) {
  return [
    { name: 'full_name', label: 'Nom et prénoms', required: true, maxlength: 120, value: s.full_name },
    { name: 'class_id', label: 'Classe', type: 'select', value: s.class_id || '', options: classOptions(classes) },
    { name: 'birth_date', label: 'Date de naissance', type: 'date', value: s.birth_date || '' },
    { name: 'phone', label: 'Téléphone', type: 'tel', maxlength: 30, value: s.phone || '' },
    { name: 'address', label: 'Adresse', maxlength: 200, value: s.address || '' },
  ];
}
const studentRow = (v) => ({ full_name: v.full_name, class_id: blank(v.class_id), birth_date: blank(v.birth_date), phone: blank(v.phone), address: blank(v.address) });

export async function render(root, ctx) {
  const { supabase, schoolId: sid } = ctx;
  const [{ classes }, students, balances] = await Promise.all([
    loadLookups(ctx),
    fetchAll(() => supabase.from('students').select('*').eq('school_id', sid).order('full_name')),
    fetchAll(() => supabase.from('student_balances').select('*').eq('school_id', sid).order('student_id')),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const balance = new Map(balances.map((b) => [b.student_id, b]));
  let search = '';
  let classFilter = '';
  let archived = false;

  const tbody = h('tbody');
  const count = h('p', { class: 'muted' });

  function paint() {
    const needle = search.trim().toLowerCase();
    const list = students.filter(
      (s) => (archived ? s.status === 'archived' : s.status === 'active') && (!classFilter || s.class_id === classFilter) && (!needle || s.full_name.toLowerCase().includes(needle))
    );
    count.textContent = `${list.length} élève${list.length > 1 ? 's' : ''}`;
    tbody.replaceChildren(
      ...list.map((s) => {
        const b = balance.get(s.id);
        return h(
          'tr',
          {},
          h('td', {}, h('button', { class: 'link-btn', type: 'button', text: s.full_name, onclick: () => openStudentDetail(ctx, s, classes) })),
          h('td', { text: className.get(s.class_id) || '—' }),
          h('td', { text: s.phone || '—' }),
          h('td', { class: 'right', text: b ? fcfa(b.remaining_fcfa) : '—' }),
          h(
            'td',
            { class: 'right' },
            h('span', { class: 'row-actions' },
              h('button', { class: 'btn secondary small', type: 'button', text: 'Modifier', onclick: () => edit(s) }),
              h('button', { class: `btn secondary small ${s.status === 'active' ? 'danger-text' : ''}`, type: 'button', text: s.status === 'active' ? 'Archiver' : 'Réactiver', onclick: () => toggle(s) }))
          )
        );
      })
    );
    if (!list.length) tbody.append(h('tr', {}, h('td', { colspan: 5 }, emptyState(archived ? 'Aucun élève archivé.' : 'Aucun élève ne correspond.'))));
  }

  const add = () =>
    formDialog({
      title: 'Ajouter un élève',
      fields: studentFields(classes),
      onSubmit: (v) => q(supabase.from('students').insert({ school_id: sid, ...studentRow(v) })),
    }).then((saved) => saved && (toast('Élève ajouté.'), ctx.refresh()));

  const edit = (s) =>
    formDialog({
      title: 'Modifier l’élève',
      fields: studentFields(classes, s),
      onSubmit: (v) => q(supabase.from('students').update(studentRow(v)).eq('id', s.id).eq('school_id', sid)),
    }).then((saved) => saved && (toast('Élève modifié.'), ctx.refresh()));

  const toggle = async (s) => {
    const archive = s.status === 'active';
    if (archive && !(await confirmDialog(`Archiver ${s.full_name} ? L’élève ne comptera plus dans la limite de votre formule.`, { confirmLabel: 'Archiver', danger: true }))) return;
    try {
      await q(supabase.from('students').update({ status: archive ? 'archived' : 'active' }).eq('id', s.id).eq('school_id', sid));
      toast(archive ? 'Élève archivé.' : 'Élève réactivé.');
      ctx.refresh();
    } catch (error) {
      toast(describeError(error), 'error');
    }
  };

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Élèves' }), count), h('button', { class: 'btn green', type: 'button', text: 'Ajouter un élève', onclick: add })),
    h(
      'div',
      { class: 'toolbar' },
      h('input', { type: 'search', placeholder: 'Rechercher un élève…', 'aria-label': 'Rechercher un élève', oninput: (e) => ((search = e.target.value), paint()) }),
      h('select', { 'aria-label': 'Filtrer par classe', onchange: (e) => ((classFilter = e.target.value), paint()) }, classOptions(classes, 'Toutes les classes').map((o) => h('option', { value: o.value, text: o.label }))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => ((archived = e.target.checked), paint()) }), ' Voir les archivés')
    ),
    h('div', { class: 'card table-card' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Élève', 'Classe', 'Téléphone', 'Reste à payer', ''].map((t, i) => h('th', { class: i >= 3 ? 'right' : '', text: t })))), tbody))
  );
  paint();
}

// Fiche complète d'un élève : informations, notes, bulletin, finances, parents.
export async function openStudentDetail(ctx, student, classes) {
  const { supabase, schoolId: sid } = ctx;
  const className = (classes.find((c) => c.id === student.class_id) || {}).name || '';
  const panel = panelDialog(student.full_name);
  let term = '';

  async function paint() {
    panel.body.replaceChildren(h('p', { class: 'loading', text: 'Chargement…' }));
    const [report, fees, payments, balanceRows] = await Promise.all([
      loadReportData(ctx, student.id),
      q(supabase.from('student_fees').select('*').eq('student_id', student.id).order('created_at')),
      q(supabase.from('student_payments').select('*').eq('student_id', student.id).order('paid_at', { ascending: false })),
      q(supabase.from('student_balances').select('*').eq('student_id', student.id)),
    ]);
    let guardians = null;
    try {
      guardians = await q(supabase.rpc('student_guardians_info', { p_student: student.id }));
    } catch {
      guardians = null;
    }
    const balance = balanceRows[0] || { due_fcfa: 0, paid_fcfa: 0, remaining_fcfa: 0 };
    const terms = [...new Set(report.assessments.map((a) => a.term).filter(Boolean))];
    const rep = computeReport(report.grades, report.assessments, report.subjects, term);
    const fmt = (n) => (n === null ? '—' : (Math.round(n * 100) / 100).toString().replace('.', ','));
    const done = (message) => async () => {
      toast(message);
      await paint();
      ctx.refresh();
    };

    const addFee = () =>
      formDialog({
        title: 'Ajouter des frais',
        fields: [
          { name: 'label', label: 'Intitulé', required: true, maxlength: 120, placeholder: 'Scolarité 1er trimestre' },
          { name: 'amount', label: 'Montant (FCFA)', type: 'number', required: true, min: 0, step: 1 },
        ],
        onSubmit: (v) => q(supabase.from('student_fees').insert({ school_id: sid, student_id: student.id, label: v.label, amount_due_fcfa: Math.round(Number(v.amount)) })),
      }).then((saved) => saved && done('Frais ajoutés.')());

    const addPayment = () =>
      formDialog({
        title: 'Enregistrer un paiement',
        intro: `Reste à payer : ${fcfa(balance.remaining_fcfa)}`,
        fields: [
          { name: 'amount', label: 'Montant reçu (FCFA)', type: 'number', required: true, min: 1, step: 1 },
          { name: 'method', label: 'Mode de paiement', type: 'select', value: 'cash', options: Object.entries(METHODS).map(([value, label]) => ({ value, label })) },
          { name: 'paid_at', label: 'Date', type: 'date', required: true, value: today() },
        ],
        onSubmit: async (v) => {
          const created = await q(
            supabase.from('student_payments').insert({
              school_id: sid,
              student_id: student.id,
              amount_fcfa: Math.round(Number(v.amount)),
              method: v.method,
              paid_at: new Date(`${v.paid_at}T12:00:00`).toISOString(),
              recorded_by: ctx.user.id,
              status: 'approved',
            }).select().single()
          );
          toast(`Paiement enregistré${created.receipt_no ? ` — reçu ${created.receipt_no}` : ''}.`);
        },
      }).then((saved) => saved && done('Paiement enregistré.')());

    const inviteParent = () => {
      let phone = '';
      return formDialog({
        title: 'Inviter un parent',
        intro: 'Un lien sera créé : le parent y choisit lui-même son mot de passe.',
        fields: [
          { name: 'fullName', label: 'Nom du parent', required: true, maxlength: 120 },
          { name: 'email', label: 'Adresse e-mail', type: 'email', required: true },
          { name: 'phone', label: 'Numéro WhatsApp (avec indicatif)', type: 'tel', placeholder: '22997000000', hint: 'Facultatif : sert à envoyer le lien par WhatsApp.' },
          { name: 'relation', label: 'Lien avec l’élève', maxlength: 40, placeholder: 'Mère, père, tuteur…' },
        ],
        onSubmit: async (v) => {
          phone = v.phone;
          const result = await callFunction(supabase, 'invite-user', { kind: 'parent', email: v.email, fullName: v.fullName, studentIds: [student.id], relation: v.relation });
          showSetupLink({ name: v.fullName, phone, result });
        },
      }).then((saved) => saved && done('Parent ajouté.')());
    };

    const unlink = async (g) => {
      if (!(await confirmDialog(`Retirer ${g.full_name || g.email} de cet élève ?`, { confirmLabel: 'Retirer', danger: true }))) return;
      try {
        await q(supabase.from('student_guardians').delete().eq('student_id', student.id).eq('parent_user_id', g.parent_user_id));
        done('Parent retiré.')();
      } catch (error) {
        toast(describeError(error), 'error');
      }
    };

    const sec = (title, ...children) => h('section', { class: 'sub-card' }, h('h3', { text: title }), children);
    panel.body.replaceChildren(
      sec('Informations', h('dl', { class: 'kv-grid' }, field('Classe', className), field('Date de naissance', dateFr(student.birth_date)), field('Téléphone', student.phone), field('Adresse', student.address), field('Statut', student.status === 'active' ? 'Actif' : 'Archivé'))),
      sec(
        'Notes et bulletin',
        h(
          'div',
          { class: 'toolbar' },
          h('select', { 'aria-label': 'Période', onchange: (e) => ((term = e.target.value), paint()) }, [{ v: '', t: 'Toutes les périodes' }, ...terms.map((t) => ({ v: t, t }))].map((o) => h('option', { value: o.v, selected: o.v === term, text: o.t }))),
          h('button', { class: 'btn secondary', type: 'button', text: 'Imprimer le bulletin', onclick: () => printBulletin(ctx, student, className, term) })
        ),
        rep.subjects.length
          ? [
              h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Matière', 'Évaluations', 'Moyenne /20'].map((t, i) => h('th', { class: i === 2 ? 'right' : '', text: t })))),
                h('tbody', {}, rep.subjects.map((s) => h('tr', {}, h('td', { text: s.name }), h('td', { text: s.items.map((i) => `${i.title} (${KINDS[i.kind] || i.kind}) : ${fmt(i.score)}/${fmt(i.max)}`).join(' · ') }), h('td', { class: 'right', text: fmt(s.average) }))))),
              h('p', { class: 'total', text: `Moyenne générale : ${fmt(rep.general)} / 20` }),
            ]
          : emptyState('Aucune note enregistrée.')
      ),
      sec(
        'Frais et paiements',
        h('p', { class: 'total', text: `Dû ${fcfa(balance.due_fcfa)} · Payé ${fcfa(balance.paid_fcfa)} · Reste ${fcfa(balance.remaining_fcfa)}` }),
        h('div', { class: 'toolbar' }, h('button', { class: 'btn secondary', type: 'button', text: 'Ajouter des frais', onclick: addFee }), h('button', { class: 'btn green', type: 'button', text: 'Enregistrer un paiement', onclick: addPayment })),
        fees.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', { text: 'Frais' }), h('th', { class: 'right', text: 'Montant' }))), h('tbody', {}, fees.map((f) => h('tr', {}, h('td', { text: f.label }), h('td', { class: 'right', text: fcfa(f.amount_due_fcfa) }))))) : emptyState('Aucun frais défini.'),
        payments.length
          ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Date', 'Mode', 'Reçu', 'Statut', 'Montant', ''].map((t, i) => h('th', { class: i >= 4 ? 'right' : '', text: t })))),
              h('tbody', {}, payments.map((p) => h('tr', {}, h('td', { text: dateFr(p.paid_at) }), h('td', { text: METHODS[p.method] || p.method }), h('td', { text: p.receipt_no || '—' }), h('td', { text: { approved: 'Payé', pending: 'En attente', declined: 'Refusé', canceled: 'Annulé' }[p.status] || p.status }), h('td', { class: 'right', text: fcfa(p.amount_fcfa) }),
                h('td', { class: 'right' }, p.status === 'approved' && h('button', { class: 'btn secondary small', type: 'button', text: 'Reçu', onclick: () => printReceipt(ctx, p, student, className) }))))))
          : emptyState('Aucun paiement enregistré.')
      ),
      sec(
        'Parents',
        h('div', { class: 'toolbar' }, h('button', { class: 'btn secondary', type: 'button', text: 'Inviter un parent', onclick: inviteParent })),
        guardians === null
          ? emptyState('La liste des parents est indisponible (script 07 non exécuté ?).')
          : guardians.length
            ? h('ul', { class: 'plain-list' }, guardians.map((g) => h('li', {}, h('span', {}, h('b', { text: g.full_name || '—' }), ' ', h('span', { class: 'muted', text: `${g.email || ''}${g.relation ? ` · ${g.relation}` : ''}` })), h('button', { class: 'btn secondary small danger-text', type: 'button', text: 'Retirer', onclick: () => unlink(g) }))))
            : emptyState('Aucun parent rattaché.')
      )
    );
  }

  try {
    await paint();
  } catch (error) {
    panel.body.replaceChildren(h('p', { class: 'dlg-error', text: describeError(error) }));
  }
  return panel;
}
