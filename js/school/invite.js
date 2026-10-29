// Affiche le lien de création de mot de passe d'une personne invitée, à transmettre par WhatsApp.
import { h, panelDialog, toast, whatsappDigits } from './ui.js';

export function showSetupLink({ name, phone, result }) {
  const panel = panelDialog('Compte créé');
  const { body } = panel;
  if (!result.setupLink) {
    body.append(
      h('p', { text: `${name} avait déjà un compte Ecolia : le compte est maintenant rattaché à votre école. Elle ou il se connecte avec son mot de passe habituel.` }),
      h('div', { class: 'dlg-actions' }, h('button', { class: 'btn green', type: 'button', text: 'Terminer', onclick: () => panel.close() }))
    );
    return panel;
  }
  const message = `Bonjour ${name}, votre compte Ecolia est prêt. Choisissez votre mot de passe avec ce lien : ${result.setupLink}`;
  const digits = whatsappDigits(phone);
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const input = h('input', { class: 'link-box', type: 'text', readonly: true, value: result.setupLink, 'aria-label': 'Lien de création du mot de passe' });
  body.append(
    h('p', { text: `Envoyez ce lien à ${name}. En l’ouvrant, la personne choisit elle-même son mot de passe. Vous ne le connaîtrez jamais.` }),
    input,
    h(
      'div',
      { class: 'dlg-actions' },
      h('button', {
        class: 'btn secondary',
        type: 'button',
        text: 'Copier le lien',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(result.setupLink);
          } catch {
            input.select();
            document.execCommand('copy');
          }
          toast('Lien copié.');
        },
      }),
      h('a', { class: 'btn green', href: waUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Envoyer par WhatsApp' })
    ),
    h('p', { class: 'field-hint', text: 'Ce lien est personnel et valable un temps limité. Ne le publiez pas dans un groupe.' })
  );
  return panel;
}
