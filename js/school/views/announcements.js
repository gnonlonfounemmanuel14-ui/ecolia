import { h, q, confirmDialog, formDialog, toast, describeError, emptyState, dateFr } from '../ui.js';
import { loadLookups, classOptions } from '../data.js';

const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const safeName = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);

export async function render(root, ctx) {
  const { supabase, schoolId: sid } = ctx;
  const [{ classes }, items] = await Promise.all([
    loadLookups(ctx),
    q(supabase.from('announcements').select('*').eq('school_id', sid).order('created_at', { ascending: false }).limit(30)),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const ids = items.map((a) => a.id);
  const files = ids.length ? await q(supabase.from('announcement_files').select('*').in('announcement_id', ids)) : [];

  const publish = () =>
    formDialog({
      title: 'Nouvelle annonce',
      fields: [
        { name: 'title', label: 'Titre', required: true, maxlength: 150 },
        { name: 'body', label: 'Message', type: 'textarea', required: true, maxlength: 5000, rows: 6 },
        { name: 'class_id', label: 'Destinataires', type: 'select', value: '', options: classOptions(classes, 'Toute l’école') },
        { name: 'files', label: 'Fichiers joints', type: 'file', multiple: true, accept: 'application/pdf,image/jpeg,image/png', hint: 'PDF, JPEG ou PNG, 10 Mo maximum chacun.' },
      ],
      submitLabel: 'Publier',
      onSubmit: async (v) => {
        for (const f of v.files) {
          if (!ALLOWED.includes(f.type)) throw Object.assign(new Error('type'), { userMessage: `« ${f.name} » : seuls les PDF, JPEG et PNG sont acceptés.` });
          if (f.size > MAX_FILE) throw Object.assign(new Error('size'), { userMessage: `« ${f.name} » dépasse 10 Mo.` });
        }
        const created = await q(
          supabase.from('announcements').insert({ school_id: sid, author_id: ctx.user.id, author_name: ctx.state.name || ctx.user.email || 'Direction', class_id: v.class_id || null, title: v.title, body: v.body }).select().single()
        );
        for (const f of v.files) {
          const path = `${sid}/${created.id}/${Date.now()}-${safeName(f.name)}`;
          const up = await supabase.storage.from('announcement-files').upload(path, f, { contentType: f.type });
          if (up.error) throw Object.assign(up.error, { userMessage: `« ${f.name} » n’a pas pu être envoyé. L’annonce est publiée sans ce fichier.` });
          await q(supabase.from('announcement_files').insert({ school_id: sid, announcement_id: created.id, storage_path: path, file_name: f.name, size_bytes: f.size }));
        }
      },
    }).then((saved) => saved && (toast('Annonce publiée.'), ctx.refresh()));

  const download = async (file, button) => {
    button.disabled = true;
    const { data, error } = await supabase.storage.from('announcement-files').createSignedUrl(file.storage_path, 300);
    button.disabled = false;
    if (error || !data) return toast('Le fichier est indisponible.', 'error');
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const remove = async (a) => {
    if (!(await confirmDialog(`Supprimer l’annonce « ${a.title} » ?`, { confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      const mine = files.filter((f) => f.announcement_id === a.id).map((f) => f.storage_path);
      if (mine.length) await supabase.storage.from('announcement-files').remove(mine);
      await q(supabase.from('announcements').delete().eq('id', a.id).eq('school_id', sid));
      toast('Annonce supprimée.');
      ctx.refresh();
    } catch (error) {
      toast(describeError(error), 'error');
    }
  };

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Annonces' }), h('p', { class: 'muted', text: 'Informations partagées avec les enseignants, les parents et les élèves.' })), h('button', { class: 'btn green', type: 'button', text: 'Nouvelle annonce', onclick: publish })),
    ...(items.length
      ? items.map((a) =>
          h('article', { class: 'card announce' },
            h('div', { class: 'card-head' }, h('h2', { text: a.title }), h('button', { class: 'btn secondary small danger-text', type: 'button', text: 'Supprimer', onclick: () => remove(a) })),
            h('p', { class: 'muted', text: `${a.author_name} · ${a.class_id ? className.get(a.class_id) || 'Classe' : 'Toute l’école'} · ${dateFr(a.created_at)}` }),
            h('p', { class: 'announce-body', text: a.body }),
            files.filter((f) => f.announcement_id === a.id).length > 0 &&
              h('div', { class: 'row-actions is-wrap' }, files.filter((f) => f.announcement_id === a.id).map((f) => h('button', { class: 'btn secondary small', type: 'button', text: `Télécharger ${f.file_name}`, onclick: (e) => download(f, e.currentTarget) }))))
        )
      : [emptyState('Aucune annonce publiée. Rédigez la première pour informer votre communauté scolaire.')])
  );
}
