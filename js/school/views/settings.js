import { h, q, toast, describeError, num } from '../ui.js';

const WA = /^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//;

export async function render(root, ctx) {
  const { supabase, schoolId: sid, state } = ctx;
  const rows = await q(supabase.from('schools').select('*').eq('id', sid));
  const school = rows[0];
  if (!school) throw new Error('school_missing');
  const message = h('p', { class: 'dlg-text', role: 'status', hidden: true });

  const name = h('input', { id: 's-name', name: 'name', required: true, minlength: 2, maxlength: 120, value: school.name });
  const wa = h('input', { id: 's-wa', name: 'wa', type: 'url', placeholder: 'https://chat.whatsapp.com/…', value: school.parent_whatsapp_url || '' });
  const submit = h('button', { class: 'btn green', type: 'submit', text: 'Enregistrer' });

  const form = h('form', { class: 'card settings-form', onsubmit: async (e) => {
    e.preventDefault();
    message.hidden = true;
    const url = wa.value.trim();
    if (url && !WA.test(url)) {
      message.textContent = 'Le lien doit être un lien WhatsApp (chat.whatsapp.com ou wa.me).';
      message.className = 'dlg-error';
      message.hidden = false;
      return;
    }
    submit.disabled = true;
    try {
      await q(supabase.from('schools').update({ name: name.value.trim(), parent_whatsapp_url: url || null }).eq('id', sid));
      document.querySelector('[data-school-name]').textContent = name.value.trim();
      toast('Paramètres enregistrés.');
    } catch (error) {
      message.textContent = describeError(error);
      message.className = 'dlg-error';
      message.hidden = false;
    }
    submit.disabled = false;
  } },
    h('h2', { text: 'Établissement' }),
    h('div', { class: 'field' }, h('label', { for: 's-name', text: 'Nom de l’établissement *' }), name),
    h('div', { class: 'field' }, h('label', { for: 's-wa', text: 'Lien du groupe ou de la communauté WhatsApp des parents' }), wa, h('small', { class: 'field-hint', text: 'Facultatif. Les parents pourront le rejoindre pour échanger.' })),
    message, submit);

  const plan = await q(supabase.from('subscriptions').select('*').eq('school_id', sid));
  const planInfo = plan[0];
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Paramètres' }))),
    form,
    h('section', { class: 'card' }, h('h2', { text: 'Abonnement' }),
      h('p', { text: planInfo ? `Formule actuelle : ${state.plan}${planInfo.current_period_end ? ` (jusqu’au ${new Date(planInfo.current_period_end).toLocaleDateString('fr-FR')})` : ''}.` : 'Aucune formule active.' }),
      h('a', { class: 'btn secondary', href: 'choose-plan.html?change=1', text: 'Changer de formule' })),
    h('section', { class: 'card' }, h('h2', { text: 'Mon compte' }), h('p', { text: `${state.name || ''} ${state.email ? `— ${state.email}` : ''}` }), h('p', { class: 'muted', text: 'Pour changer votre mot de passe, utilisez « Mot de passe oublié » sur la page de connexion.' }))
  );
}
