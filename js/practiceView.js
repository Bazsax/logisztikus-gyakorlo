// Gyakorlati feladatok megjelenítése (táblázatos kitöltés), ellenőrzés, AI-formátum.
import { h, fmt } from './util.js';
import { checkField, expectText } from './practice/common.js';

export function renderBlocks(blocks) {
  return blocks.map((b) => {
    if (b.type === 'p') return h('p', null, b.text);
    if (b.type === 'ul') return h('ul', null, b.items.map((x) => h('li', null, x)));
    if (b.type === 'note') return h('div', { class: 'note' }, b.text);
    if (b.type === 'table') {
      return h('div', { class: 'tbl-wrap' }, h('table', null,
        h('thead', null, h('tr', null, b.head.map((c) => h('th', null, c)))),
        h('tbody', null, b.rows.map((r) => h('tr', null, r.map((c) => h('td', null, String(c))))))));
    }
    return null;
  });
}

/**
 * st: {ans: {fid: string, 'calc:<fid>': string}, checked, revealed, ai: {fid: value}|null}
 * on: {change(fid, value)}
 */
export function renderPractice(t, st, on) {
  const wrap = h('div', null, h('div', { class: 'statement' }, renderBlocks(t.statement)));
  const ans = st.ans || {};
  const inputs = [];

  const fieldEl = (fid) => {
    const f = t.fields[fid];
    const res = st.checked ? checkField(f, ans[fid]) : null;
    const cls = res === 'ok' ? ' ok' : res === 'bad' || (res === 'empty') ? ' bad' : res === 'extra' ? ' extra' : '';
    let el;
    if (f.type === 'select') {
      el = h('select', { class: cls.trim(), 'data-fid': fid, onchange: (e) => on.change(fid, e.target.value) },
        h('option', { value: '' }, '—'), f.options.map((o) => h('option', { value: o, selected: ans[fid] === o }, o)));
    } else {
      el = h('input', { class: 'num' + cls, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-fid': fid, value: ans[fid] ?? '' });
      el.addEventListener('input', () => on.change(fid, el.value, false));
      el.addEventListener('change', () => on.change(fid, el.value));
    }
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const i = inputs.indexOf(el); if (inputs[i + 1]) inputs[i + 1].focus(); }
    });
    inputs.push(el);
    const extra = [];
    if (st.revealed && f.expect !== null) extra.push(h('span', { class: 'exp' }, '✓ ' + expectText(f)));
    if (st.ai && st.ai[fid] !== undefined && st.ai[fid] !== null && st.ai[fid] !== '') {
      const ok = checkField(f, String(st.ai[fid])) === 'ok' || (f.expect === null && checkField(f, String(st.ai[fid])) === 'blank');
      extra.push(h('span', { class: 'exp ai', title: 'AI válasza' }, `AI: ${f.type === 'num' && typeof st.ai[fid] === 'number' ? fmt(st.ai[fid]) : st.ai[fid]} ${ok ? '✓' : '✗'}`));
    }
    return h('div', null, el, extra);
  };

  for (const part of t.parts) {
    const box = h('div', { class: 'part' });
    if (part.title) box.appendChild(h('h4', null, part.title));
    if (part.type === 'grid') {
      box.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'grid-tbl' },
        h('thead', null, h('tr', null, h('th', { class: 'lbl' }, ''), part.cols.map((c) => h('th', null, c)), h('th', { class: 'pts' }, 'Pont'))),
        h('tbody', null, part.rows.map((row) => h('tr', null,
          h('td', { class: 'lbl' }, row.label),
          row.fids.map((fid) => h('td', { class: 'cell' }, fieldEl(fid))),
          h('td', { class: 'pts' }, row.ptsLabel)))))));
    } else {
      const hasCalc = part.rows.some((r) => r.calc);
      const resHead = part.head.slice(1);
      box.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'form-tbl' },
        h('thead', null, h('tr', null, h('th', null, part.head[0]), hasCalc ? h('th', null, 'Mellékszámítás') : null, resHead.map((c) => h('th', null, c)), h('th', { class: 'pts' }, 'Pont'))),
        h('tbody', null, part.rows.map((row) => {
          let calc = null;
          if (hasCalc) {
            if (row.calc) {
              const ta = h('textarea', { class: 'calc', placeholder: 'mellékszámítás (nem pontozott)', 'aria-label': 'Mellékszámítás' });
              ta.value = ans['calc:' + row.fids[0]] || '';
              ta.addEventListener('input', () => on.change('calc:' + row.fids[0], ta.value, false));
              calc = h('td', null, ta);
            } else calc = h('td', null);
          }
          return h('tr', null,
            h('td', null, row.label),
            calc,
            row.fids.map((fid) => h('td', { class: 'res' }, fieldEl(fid))),
            h('td', { class: 'pts' }, row.ptsLabel));
        })))));
    }
    wrap.appendChild(box);
  }
  if (st.checked) {
    const extra = Object.keys(t.fields).filter((fid) => checkField(t.fields[fid], ans[fid]) === 'extra');
    if (extra.length) wrap.appendChild(h('div', { class: 'note' }, `Sárga cellák: a hivatalos megoldásban ezek üresek (${extra.length} db). Nem vonnak le pontot, de a vizsgán feleslegesek.`));
  }
  return wrap;
}

/** Mezők emberi olvasható címkéi (AI-prompthoz). */
export function fieldLabels(t) {
  const out = [];
  for (const part of t.parts) {
    for (const row of part.rows) {
      row.fids.forEach((fid, c) => {
        let label;
        if (part.type === 'grid') label = `${part.title} / ${row.label} / ${part.cols[c]}`;
        else {
          const colName = part.head.slice(1)[c] || 'Eredmény';
          label = [part.title, row.label || `${part.rows.indexOf(row) + 1}. sor`, row.fids.length > 1 ? colName : null].filter(Boolean).join(' / ');
        }
        const f = t.fields[fid];
        if (f.type === 'select') label += ` (választható: ${f.options.join(' | ')})`;
        out.push({ fid, label, field: f });
      });
    }
  }
  return out;
}

export function practiceAiText(t) {
  const lines = [];
  for (const b of t.statement) {
    if (b.type === 'p' || b.type === 'note') lines.push(b.text);
    if (b.type === 'ul') b.items.forEach((x) => lines.push(`- ${x}`));
    if (b.type === 'table') {
      lines.push('| ' + b.head.join(' | ') + ' |', '|' + b.head.map(() => '---').join('|') + '|');
      b.rows.forEach((r) => lines.push('| ' + r.join(' | ') + ' |'));
    }
  }
  return lines.join('\n');
}

export function practiceSolutionText(t) {
  return fieldLabels(t).filter((x) => x.field.expect !== null).map((x) => `${x.label}: ${expectText(x.field)}`).join('\n');
}
