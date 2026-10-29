import { h, q, confirmDialog, formDialog, panelDialog, toast, describeError, emptyState, initials, whatsappDigits } from '../ui.js';
import { loadLookups, callFunction } from '../data.js';
import { showSetupLink } from '../invite.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const KIND_LABEL = { teacher: 'Enseignant(e)', administrative: 'Personnel administratif' };
// Photo avec repli : si l'adresse temporaire a expiré ou échoue, on affiche les initiales.
function avatarImage(url, name) {
  const img = h('img', { class: 'avatar', src: url, alt: `Photo de ${name}` });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: 'avatar avatar-initials', 'aria-hidden': 'true', text: initials(name) })), { once: true });
  return img;
}
const link = (text, href, extra = {}) => h('a', { class: 'btn secondary small', href, text, ...extra });

export async function render(root, ctx) {
  const { supabase, schoolId: sid } = ctx;
  const [{ classes, subjects }, staff, assignments] = await Promise.all([
    loadLookups(ctx),
    q(supabase.from('staff').select('*').eq('school_id', sid).order('full_name')),
    q(supabase.from('teaching_assignments').select('*').eq('school_id', sid)),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  // Adresses temporaires pour afficher les photos (le stockage est privé).
  const photoUrl = new Map();
  const paths = staff.map((s) => s.photo_path).filter(Boolean);
  if (paths.length) {
    const { data } = await supabase.storage.from('staff-photos').createSignedUrls(paths, 3600);
    (data || []).forEach((item) => item.signedUrl && photoUrl.set(item.path, item.signedUrl));
  }

  const invite = () =>
    formDialog({
      title: 'Ajouter un membre du personnel',
      intro: 'Un lien sera créé : la personne y choisit elle-même son mot de passe.',
      fields: [
        { name: 'kind', label: 'Fonction', type: 'select', value: 'teacher', options: [{ value: 'teacher', label: 'Enseignant(e)' }, { value: 'administrative', label: 'Personnel administratif' }] },
        { name: 'fullName', label: 'Nom et prénoms', required: true, maxlength: 120 },
        { name: 'email', label: 'Adresse e-mail', type: 'email', required: true },
        { name: 'phone', label: 'Téléphone', type: 'tel', maxlength: 30 },
        { name: 'whatsapp', label: 'Numéro WhatsApp (avec indicatif)', type: 'tel', maxlength: 30, placeholder: '22997000000' },
        { name: 'bio', label: 'Courte description', type: 'textarea', maxlength: 500, rows: 3 },
      ],
      onSubmit: async (v) => {
        const result = await callFunction(supabase, 'invite-user', { kind: v.kind, email: v.email, fullName: v.fullName, phone: v.phone, whatsapp: v.whatsapp, bio: v.bio });
        showSetupLink({ name: v.fullName, phone: v.whatsapp || v.phone, result });
      },
    }).then((saved) => saved && (toast('Membre du personnel ajouté.'), ctx.refresh()));

  const edit = (s) =>
    formDialog({
      title: 'Modifier la fiche',
      fields: [
        { name: 'full_name', label: 'Nom et prénoms', required: true, maxlength: 120, value: s.full_name },
        { name: 'bio', label: 'Courte description', type: 'textarea', maxlength: 500, rows: 3, value: s.bio || '' },
        { name: 'email', label: 'E-mail de contact', type: 'email', value: s.email || '' },
        { name: 'phone', label: 'Téléphone', type: 'tel', maxlength: 30, value: s.phone || '' },
        { name: 'whatsapp', label: 'WhatsApp (avec indicatif)', type: 'tel', maxlength: 30, value: s.whatsapp || '' },
        { name: 'facebook', label: 'Lien Facebook', type: 'url', value: (s.social_links || {}).facebook || '' },
        { name: 'instagram', label: 'Lien Instagram', type: 'url', value: (s.social_links || {}).instagram || '' },
        { name: 'photo', label: 'Photo d’identité', type: 'file', accept: 'image/jpeg,image/png,image/webp', hint: 'JPEG, PNG ou WebP, 2 Mo maximum.' },
      ],
      onSubmit: async (v) => {
        const patch = {
          full_name: v.full_name,
          bio: v.bio || null,
          email: v.email || null,
          phone: v.phone || null,
          whatsapp: v.whatsapp || null,
          social_links: { ...(v.facebook ? { facebook: v.facebook } : {}), ...(v.instagram ? { instagram: v.instagram } : {}) },
        };
        const file = v.photo[0];
        if (file) {
          const ext = EXT[file.type];
          if (!ext) throw Object.assign(new Error('type'), { userMessage: 'La photo doit être au format JPEG, PNG ou WebP.' });
          if (file.size > 2 * 1024 * 1024) throw Object.assign(new Error('size'), { userMessage: 'La photo dépasse 2 Mo.' });
          const path = `${sid}/${s.id}.${ext}`;
          const up = await supabase.storage.from('staff-photos').upload(path, file, { upsert: true, contentType: file.type });
          if (up.error) throw Object.assign(up.error, { userMessage: 'La photo n’a pas pu être envoyée.' });
          if (s.photo_path && s.photo_path !== path) await supabase.storage.from('staff-photos').remove([s.photo_path]);
          patch.photo_path = path;
        }
        await q(supabase.from('staff').update(patch).eq('id', s.id).eq('school_id', sid));
      },
    }).then((saved) => saved && (toast('Fiche enregistrée.'), ctx.refresh()));

  const toggle = async (s) => {
    const archive = s.status === 'active';
    if (archive && !(await confirmDialog(`Archiver ${s.full_name} ? Elle ou il n’apparaîtra plus dans la liste active.`, { confirmLabel: 'Archiver', danger: true }))) return;
    try {
      await q(supabase.from('staff').update({ status: archive ? 'archived' : 'active' }).eq('id', s.id).eq('school_id', sid));
      toast(archive ? 'Fiche archivée.' : 'Fiche réactivée.');
      ctx.refresh();
    } catch (error) {
      toast(describeError(error), 'error');
    }
  };

  const manageAssignments = async (s) => {
    const panel = panelDialog(`Affectations — ${s.full_name}`);
    const paint = async () => {
      const rows = await q(supabase.from('teaching_assignments').select('*').eq('staff_id', s.id));
      panel.body.replaceChildren(
        h('div', { class: 'toolbar' }, h('button', { class: 'btn green', type: 'button', text: 'Ajouter une affectation', onclick: addAssignment })),
        rows.length
          ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Classe', 'Matière', 'Horaires', ''].map((t) => h('th', { text: t })))),
              h('tbody', {}, rows.map((r) => h('tr', {}, h('td', { text: className.get(r.class_id) || '—' }), h('td', { text: subjectName.get(r.subject_id) || '—' }), h('td', { text: r.weekly_schedule || '—' }),
                h('td', { class: 'right' }, h('button', { class: 'btn secondary small danger-text', type: 'button', text: 'Retirer', onclick: () => remove(r) }))))))
          : emptyState('Aucune classe ni matière affectée. Ajoutez-en pour que cette personne puisse saisir des notes.')
      );
    };
    const addAssignment = () => {
      if (!classes.length || !subjects.length) return toast('Créez d’abord des classes et des matières.', 'error');
      return formDialog({
        title: 'Nouvelle affectation',
        fields: [
          { name: 'class_id', label: 'Classe', type: 'select', required: true, options: classes.map((c) => ({ value: c.id, label: c.name })) },
          { name: 'subject_id', label: 'Matière', type: 'select', required: true, options: subjects.map((m) => ({ value: m.id, label: m.name })) },
          { name: 'schedule', label: 'Horaires', maxlength: 300, placeholder: 'Lundi 8h-10h, mercredi 10h-12h' },
        ],
        onSubmit: (v) => q(supabase.from('teaching_assignments').insert({ school_id: sid, staff_id: s.id, class_id: v.class_id, subject_id: v.subject_id, weekly_schedule: v.schedule || null })),
      }).then((saved) => saved && (toast('Affectation ajoutée.'), paint(), ctx.refresh()));
    };
    const remove = async (r) => {
      try {
        await q(supabase.from('teaching_assignments').delete().eq('staff_id', r.staff_id).eq('class_id', r.class_id).eq('subject_id', r.subject_id));
        toast('Affectation retirée.');
        paint();
        ctx.refresh();
      } catch (error) {
        toast(describeError(error), 'error');
      }
    };
    try {
      await paint();
    } catch (error) {
      panel.body.replaceChildren(h('p', { class: 'dlg-error', text: describeError(error) }));
    }
  };

  const card = (s) => {
    const url = photoUrl.get(s.photo_path);
    const social = s.social_links || {};
    const mine = assignments.filter((a) => a.staff_id === s.id);
    const wa = whatsappDigits(s.whatsapp);
    return h(
      'article',
      { class: `card staff-card${s.status === 'archived' ? ' is-archived' : ''}` },
      h('div', { class: 'staff-top' }, url ? avatarImage(url, s.full_name) : h('span', { class: 'avatar avatar-initials', 'aria-hidden': 'true', text: initials(s.full_name) }),
        h('div', {}, h('h3', { text: s.full_name }), h('p', { class: 'muted', text: KIND_LABEL[s.kind] || s.kind }), s.status === 'archived' && h('span', { class: 'chip', text: 'Archivé' }))),
      s.bio && h('p', { class: 'staff-bio', text: s.bio }),
      mine.length > 0 && h('p', { class: 'muted', text: mine.map((a) => `${subjectName.get(a.subject_id) || ''} · ${className.get(a.class_id) || ''}`).join(' | ') }),
      h('div', { class: 'row-actions is-wrap' },
        s.phone && link('Appeler', `tel:${s.phone.replace(/[^\d+]/g, '')}`),
        wa && link('WhatsApp', `https://wa.me/${wa}`, { target: '_blank', rel: 'noopener noreferrer' }),
        s.email && link('E-mail', `mailto:${s.email}`),
        typeof social.facebook === 'string' && social.facebook.startsWith('https://') && link('Facebook', social.facebook, { target: '_blank', rel: 'noopener noreferrer' }),
        typeof social.instagram === 'string' && social.instagram.startsWith('https://') && link('Instagram', social.instagram, { target: '_blank', rel: 'noopener noreferrer' })),
      h('div', { class: 'row-actions is-wrap card-actions' },
        h('button', { class: 'btn secondary small', type: 'button', text: 'Modifier', onclick: () => edit(s) }),
        s.kind === 'teacher' && h('button', { class: 'btn secondary small', type: 'button', text: 'Affectations', onclick: () => manageAssignments(s) }),
        h('button', { class: `btn secondary small ${s.status === 'active' ? 'danger-text' : ''}`, type: 'button', text: s.status === 'active' ? 'Archiver' : 'Réactiver', onclick: () => toggle(s) }))
    );
  };

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Personnel' }), h('p', { class: 'muted', text: `${staff.filter((s) => s.status === 'active').length} personne(s) active(s)` })), h('button', { class: 'btn green', type: 'button', text: 'Ajouter un membre', onclick: invite })),
    staff.length ? h('div', { class: 'card-grid' }, staff.map(card)) : emptyState('Aucun membre du personnel pour le moment. Ajoutez vos enseignants et votre équipe administrative.')
  );
}
