// Outils d'interface du tableau de bord : construction sûre du DOM, fenêtres, graphiques.
// Aucune donnée n'est jamais injectée en HTML : tout passe par textContent.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const fcfa = (n) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0))} FCFA`;
export const num = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
export const dateFr = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');
export const today = () => new Date().toISOString().slice(0, 10);

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthLabel = (yyyyMm) => {
  const [y, m] = String(yyyyMm).split('-');
  return `${MONTHS[Number(m) - 1] || m} ${String(y).slice(2)}`;
};

// Résultat d'une requête Supabase : renvoie les données ou lève l'erreur.
export async function q(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

// Lit toutes les lignes (Supabase limite chaque requête à 1000 lignes).
export async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await q(buildQuery().range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export function describeError(error) {
  const text = `${(error && (error.message || error.error)) || error || ''}`;
  const code = (error && error.code) || '';
  if (text.includes('student_limit_reached'))
    return 'La limite d’élèves de votre formule est atteinte. Passez à la formule supérieure pour en ajouter.';
  if (text.includes('no_active_plan')) return 'Aucune formule active : choisissez une formule pour ajouter des élèves.';
  if (text.includes('student_not_in_class')) return 'Cet élève n’appartient pas à la classe de cette évaluation.';
  if (text.includes('score_above_max')) return 'La note dépasse la note maximale de l’évaluation.';
  if (text.includes('role_conflict')) return 'Cette personne a déjà un autre rôle dans votre école.';
  if (code === '23505') return 'Cet élément existe déjà.';
  if (code === '23503') return 'Cet élément est utilisé ailleurs : supprimez d’abord ce qui en dépend.';
  if (code === '42501' || text.includes('forbidden')) return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (code === '23514') return 'Une valeur saisie n’est pas valide. Vérifiez le formulaire.';
  return 'Une erreur est survenue. Réessayez.';
}

export function toast(message, type = 'info') {
  const host = document.querySelector('[data-toasts]');
  if (!host) return;
  const item = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status', text: message });
  host.append(item);
  setTimeout(() => item.remove(), type === 'error' ? 7000 : 3500);
}

function openDialog(dialog) {
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

// Fenêtre de confirmation. Renvoie true si l'utilisateur confirme.
export function confirmDialog(message, { confirmLabel = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    let answer = false;
    const dialog = h(
      'dialog',
      { class: 'dlg dlg-small' },
      h('p', { class: 'dlg-text', text: message }),
      h(
        'div',
        { class: 'dlg-actions' },
        h('button', { class: 'btn secondary', type: 'button', text: 'Annuler', onclick: () => dialog.close() }),
        h('button', {
          class: `btn ${danger ? 'danger' : 'green'}`,
          type: 'button',
          text: confirmLabel,
          onclick: () => {
            answer = true;
            dialog.close();
          },
        })
      )
    );
    dialog.addEventListener('close', () => resolve(answer));
    openDialog(dialog);
  });
}

// Formulaire dans une fenêtre. fields : { name, label, type, required, options, value, placeholder, accept, multiple, maxlength, hint }
// onSubmit(values) peut lever une erreur : elle s'affiche dans la fenêtre. Renvoie true si enregistré.
export function formDialog({ title, intro, fields, submitLabel = 'Enregistrer', onSubmit }) {
  return new Promise((resolve) => {
    let saved = false;
    const error = h('p', { class: 'dlg-error', role: 'alert', hidden: true });
    const inputs = {};
    const rows = fields.map((f) => {
      const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
      let input;
      if (f.type === 'select') {
        input = h(
          'select',
          { id, name: f.name, required: f.required },
          (f.options || []).map((o) => h('option', { value: o.value, selected: String(o.value) === String(f.value ?? '') }, o.label))
        );
      } else if (f.type === 'textarea') {
        input = h('textarea', { id, name: f.name, rows: f.rows || 4, required: f.required, maxlength: f.maxlength, placeholder: f.placeholder });
        input.value = f.value ?? '';
      } else {
        input = h('input', {
          id,
          name: f.name,
          type: f.type || 'text',
          required: f.required,
          maxlength: f.maxlength,
          placeholder: f.placeholder,
          accept: f.accept,
          multiple: f.multiple,
          min: f.min,
          step: f.step,
        });
        if (f.type !== 'file') input.value = f.value ?? '';
      }
      inputs[f.name] = input;
      return h('div', { class: 'field' }, h('label', { for: id, text: f.label + (f.required ? ' *' : '') }), input, f.hint && h('small', { class: 'field-hint', text: f.hint }));
    });
    const submit = h('button', { class: 'btn green', type: 'submit', text: submitLabel });
    const form = h(
      'form',
      { class: 'dlg-form', novalidate: false },
      h('h2', { text: title }),
      intro && h('p', { class: 'dlg-text', text: intro }),
      rows,
      error,
      h('div', { class: 'dlg-actions' }, h('button', { class: 'btn secondary', type: 'button', text: 'Annuler', onclick: () => dialog.close() }), submit)
    );
    const dialog = h('dialog', { class: 'dlg' }, form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = {};
      for (const f of fields) {
        const el = inputs[f.name];
        if (f.type === 'file') values[f.name] = [...el.files];
        else values[f.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
      }
      submit.disabled = true;
      error.hidden = true;
      try {
        await onSubmit(values);
        saved = true;
        dialog.close();
      } catch (err) {
        error.textContent = err && err.userMessage ? err.userMessage : describeError(err);
        error.hidden = false;
        submit.disabled = false;
      }
    });
    dialog.addEventListener('close', () => resolve(saved));
    openDialog(dialog);
    const first = form.querySelector('input,select,textarea');
    if (first) first.focus();
  });
}

// Grande fenêtre de consultation (fiche élève, affectations...). Renvoie { dialog, body, close }.
export function panelDialog(title) {
  const body = h('div', { class: 'panel-body' });
  const dialog = h(
    'dialog',
    { class: 'dlg dlg-wide' },
    h('div', { class: 'panel-head' }, h('h2', { text: title }), h('button', { class: 'btn secondary', type: 'button', text: 'Fermer', onclick: () => dialog.close() })),
    body
  );
  const closed = new Promise((resolve) => dialog.addEventListener('close', resolve));
  openDialog(dialog);
  return { dialog, body, closed, close: () => dialog.close() };
}

export const emptyState = (text) => h('p', { class: 'empty', text });

export function field(label, value) {
  return h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', { text: value || '—' }));
}

// Graphique en barres en SVG (aucune bibliothèque externe).
export function barChart(data, { format = num, color = 'var(--green)', emptyText = 'Aucune donnée à afficher.' } = {}) {
  if (!data.length || data.every((d) => !d.value)) return emptyState(emptyText);
  const crowded = data.length > 7;
  const W = 440;
  const H = crowded ? 270 : 230;
  const pad = { l: 8, r: 8, t: 26, b: crowded ? 84 : 46 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = (W - pad.l - pad.r) / data.length;
  const barW = Math.min(44, slot * 0.62);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('aria-label', data.map((d) => `${d.label} : ${format(d.value)}`).join(', '));
  const add = (name, attrs, text) => {
    const el = document.createElementNS(svgNS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    svg.append(el);
    return el;
  };
  add('line', { x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b, stroke: 'currentColor', 'stroke-opacity': '0.25' });
  data.forEach((d, i) => {
    const bh = ((H - pad.t - pad.b) * d.value) / max;
    const x = pad.l + slot * i + (slot - barW) / 2;
    const y = H - pad.b - bh;
    const cx = x + barW / 2;
    add('rect', { x, y, width: barW, height: Math.max(bh, d.value ? 2 : 0), rx: 4, fill: color, class: 'bar' });
    add('text', { x: cx, y: y - 7, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'currentColor', class: 'bar-value' }, format(d.value));
    const label = d.label.length > (crowded ? 16 : 10) ? `${d.label.slice(0, crowded ? 15 : 9)}…` : d.label;
    const attrs = { x: cx, y: H - pad.b + 18, 'text-anchor': crowded ? 'end' : 'middle', 'font-size': 13, fill: 'currentColor', 'fill-opacity': '0.8' };
    if (crowded) attrs.transform = `rotate(-40 ${cx} ${H - pad.b + 18})`;
    add('text', attrs, label);
  });
  return h('div', { class: 'chart-wrap' }, svg);
}

export function progress(value, max) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: `width:${pct}%` }), h('b', { text: `${pct} %` }));
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Numéro pour wa.me : uniquement des chiffres (avec l'indicatif du pays).
export const whatsappDigits = (value) => String(value || '').replace(/\D/g, '');

// Ouvre une fenêtre d'impression (à appeler directement dans le clic, avant tout chargement).
export function openPrintWindow(title) {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.title = title;
  const style = w.document.createElement('style');
  style.textContent = `
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;max-width:780px}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px}
    table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border:1px solid #999;padding:6px 8px;text-align:left;font-size:13px}
    th{background:#eee} .right{text-align:right} .muted{color:#555;font-size:13px} .total{font-weight:bold}
    .head{border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
    .sign{margin-top:48px;display:flex;justify-content:space-between;font-size:13px}
    @media print{.noprint{display:none}}`;
  w.document.head.append(style);
  w.document.body.textContent = 'Chargement…';
  return w;
}
