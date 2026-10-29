import { h, q, fetchAll, confirmDialog, formDialog, toast, describeError, emptyState, dateFr } from '../ui.js';
import { loadLookups } from '../data.js';

export async function render(root, ctx) {
  const { supabase, schoolId: sid } = ctx;
  const { classes, subjects, years } = await loadLookups(ctx);
  const active = await fetchAll(() => supabase.from('students').select('id,class_id').eq('school_id', sid).eq('status', 'active').order('id'));
  const countByClass = new Map();
  active.forEach((s) => s.class_id && countByClass.set(s.class_id, (countByClass.get(s.class_id) || 0) + 1));
  const yearName = new Map(years.map((y) => [y.id, y.name]));

  const run = async (work, success) => {
    try {
      await work();
      toast(success);
      ctx.refresh();
    } catch (error) {
      toast(describeError(error), 'error');
    }
  };
  const remove = (table, id, label) => async () => {
    if (await confirmDialog(`Supprimer « ${label} » ?`, { confirmLabel: 'Supprimer', danger: true })) {
      run(async () => q(supabase.from(table).delete().eq('id', id).eq('school_id', sid)), 'Supprimé.');
    }
  };

  const addYear = () =>
    formDialog({
      title: 'Nouvelle année scolaire',
      fields: [
        { name: 'name', label: 'Nom', required: true, maxlength: 40, placeholder: '2025-2026' },
        { name: 'starts_on', label: 'Début', type: 'date' },
        { name: 'ends_on', label: 'Fin', type: 'date' },
        { name: 'current', label: 'Année en cours ?', type: 'select', options: [{ value: 'no', label: 'Non' }, { value: 'yes', label: 'Oui' }], value: years.length ? 'no' : 'yes' },
      ],
      onSubmit: async (v) => {
        if (v.current === 'yes') await q(supabase.from('academic_years').update({ is_current: false }).eq('school_id', sid).eq('is_current', true));
        await q(supabase.from('academic_years').insert({ school_id: sid, name: v.name, starts_on: v.starts_on || null, ends_on: v.ends_on || null, is_current: v.current === 'yes' }));
      },
    }).then((saved) => saved && (toast('Année ajoutée.'), ctx.refresh()));

  const setCurrent = (year) => run(async () => {
    await q(supabase.from('academic_years').update({ is_current: false }).eq('school_id', sid).eq('is_current', true));
    await q(supabase.from('academic_years').update({ is_current: true }).eq('id', year.id).eq('school_id', sid));
  }, 'Année en cours mise à jour.');

  const addClass = () => {
    const current = years.find((y) => y.is_current);
    return formDialog({
      title: 'Nouvelle classe',
      fields: [
        { name: 'name', label: 'Nom de la classe', required: true, maxlength: 60, placeholder: '6ème A' },
        { name: 'year', label: 'Année scolaire', type: 'select', value: current ? current.id : '', options: [{ value: '', label: 'Aucune' }, ...years.map((y) => ({ value: y.id, label: y.name }))] },
      ],
      onSubmit: (v) => q(supabase.from('classes').insert({ school_id: sid, name: v.name, academic_year_id: v.year || null })),
    }).then((saved) => saved && (toast('Classe ajoutée.'), ctx.refresh()));
  };

  const addSubject = () =>
    formDialog({
      title: 'Nouvelle matière',
      fields: [{ name: 'name', label: 'Nom de la matière', required: true, maxlength: 80, placeholder: 'Français' }],
      onSubmit: (v) => q(supabase.from('subjects').insert({ school_id: sid, name: v.name })),
    }).then((saved) => saved && (toast('Matière ajoutée.'), ctx.refresh()));

  const section = (title, button, content) => h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: title }), button), content);
  const addBtn = (text, onclick) => h('button', { class: 'btn green', type: 'button', text, onclick });
  const rowBtn = (text, onclick, extra = '') => h('button', { class: `btn secondary small ${extra}`, type: 'button', text, onclick });

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Classes et matières' }), h('p', { class: 'muted', text: 'Organisez les années scolaires, les classes et les matières de votre établissement.' }))),
    section(
      'Années scolaires',
      addBtn('Ajouter une année', addYear),
      years.length
        ? h('ul', { class: 'plain-list' }, years.map((y) =>
            h('li', {}, h('span', {}, h('b', { text: y.name }), ' ', y.starts_on && h('span', { class: 'muted', text: `${dateFr(y.starts_on)} – ${dateFr(y.ends_on)}` }), ' ', y.is_current && h('span', { class: 'chip', text: 'En cours' })),
              h('span', { class: 'row-actions' }, !y.is_current && rowBtn('Définir en cours', () => setCurrent(y)), rowBtn('Supprimer', remove('academic_years', y.id, y.name), 'danger-text'))))
          )
        : emptyState('Aucune année scolaire. Commencez par en créer une.')
    ),
    section(
      'Classes',
      addBtn('Ajouter une classe', addClass),
      classes.length
        ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Classe', 'Année', 'Élèves', ''].map((t) => h('th', { text: t })))),
            h('tbody', {}, classes.map((c) => h('tr', {}, h('td', { text: c.name }), h('td', { text: yearName.get(c.academic_year_id) || '—' }), h('td', { text: String(countByClass.get(c.id) || 0) }), h('td', { class: 'right' }, rowBtn('Supprimer', remove('classes', c.id, c.name), 'danger-text'))))))
        : emptyState('Aucune classe pour le moment.')
    ),
    section(
      'Matières',
      addBtn('Ajouter une matière', addSubject),
      subjects.length
        ? h('ul', { class: 'plain-list' }, subjects.map((s) => h('li', {}, h('b', { text: s.name }), rowBtn('Supprimer', remove('subjects', s.id, s.name), 'danger-text'))))
        : emptyState('Aucune matière pour le moment.')
    )
  );
}
