// Elméleti feladattípusok: nézet (keverés), megjelenítés, pontozás, tippek, AI-formátum.
import { h, LETTERS } from './util.js';

export const TYPE_LABEL = {
  single: 'Egyszeres választás', multi: 'Többszörös választás', truefalse: 'Igaz – hamis', group: 'Csoportosítás',
  match: 'Párosítás', order: 'Sorrendbe rendezés', essay: 'Kifejtős',
};

/** Megjelenítési sorrendek (keverés) egy kérdéshez. */
export function makeView(q, r) {
  const idx = (n) => Array.from({ length: n }, (_, i) => i);
  switch (q.type) {
    case 'single': case 'multi': return { opt: r.shuffle(idx(q.options.length)) };
    case 'truefalse': return { st: r.shuffle(idx(q.statements.length)) };
    case 'group': return { it: r.shuffle(idx(q.items.length)) };
    case 'match': return { l: r.shuffle(idx(q.pairs.length)), r: r.shuffle(idx(q.pairs.length)) };
    case 'order': {
      let o = r.shuffle(idx(q.items.length));
      if (o.every((v, i) => v === i)) o = o.reverse();
      return { start: o };
    }
    default: return {};
  }
}

export function emptyAnswer(q, view) {
  switch (q.type) {
    case 'single': return null;
    case 'multi': return [];
    case 'truefalse': return q.statements.map(() => null);
    case 'group': return q.items.map(() => null);
    case 'match': return q.pairs.map(() => null);
    case 'order': return view.start.slice();
    case 'essay': return { text: '', ticks: q.keyPoints.map(() => false), aiScore: null, exclude: false };
    default: return null;
  }
}

export function maxPoints(q) {
  switch (q.type) {
    case 'single': return 1;
    case 'multi': return q.answer.length;
    case 'truefalse': return q.statements.length;
    case 'group': return q.items.length;
    case 'match': return q.pairs.length;
    case 'order': return q.items.length;
    case 'essay': return q.keyPoints.length;
    default: return 1;
  }
}

/** Pontszám. Kifejtősnél null, ha ki van hagyva a pontozásból. */
export function scoreTheory(q, a, settings) {
  const max = maxPoints(q);
  let got = 0;
  switch (q.type) {
    case 'single': got = a === q.answer ? 1 : 0; break;
    case 'multi': {
      const sel = a || [];
      const good = sel.filter((i) => q.answer.includes(i)).length;
      const wrong = sel.length - good;
      got = Math.max(0, good - wrong); break;
    }
    case 'truefalse': got = q.statements.filter((s, i) => a?.[i] === s[1]).length; break;
    case 'group': got = q.items.filter((it, i) => a?.[i] === it[1]).length; break;
    case 'match': got = q.pairs.filter((_, i) => a?.[i] === i).length; break;
    case 'order': got = (a || []).filter((v, i) => v === i).length; break;
    case 'essay': {
      if (!settings.essays || a?.exclude || settings.essayScoring === 'exclude') return { got: 0, max: 0, excluded: true };
      got = a?.aiScore !== null && a?.aiScore !== undefined && a?.aiScore !== '' ? Math.min(max, Number(a.aiScore) || 0) : (a?.ticks || []).filter(Boolean).length;
      break;
    }
    default: break;
  }
  return { got, max };
}

export function isAnswered(q, a) {
  switch (q.type) {
    case 'single': return a !== null && a !== undefined;
    case 'multi': return (a || []).length > 0;
    case 'truefalse': case 'group': case 'match': return (a || []).some((v) => v !== null && v !== undefined);
    case 'order': return true;
    case 'essay': return !!a?.text?.trim();
    default: return false;
  }
}

// ---------- Tippek (3 fokozat, automatikusan a megoldásból) ----------
export function hints(q, view) {
  const quote = (s) => `„${s}”`;
  switch (q.type) {
    case 'single': {
      const wrong = view.opt.filter((i) => i !== q.answer);
      const half = wrong.slice(0, Math.max(1, Math.floor(wrong.length / 2)));
      const keep = wrong.find((i) => !half.includes(i));
      return [
        `Témakör: ${q.topic}. Zárd ki a szélsőséges („kizárólag”, „mindig”, „csak”) megfogalmazású válaszokat.`,
        `Biztosan nem helyes: ${half.map((i) => quote(q.options[i])).join('; ')}.`,
        keep !== undefined ? `A helyes válasz e kettő közül való: ${quote(q.options[q.answer])} vagy ${quote(q.options[keep])}.` : `A helyes válasz: ${quote(q.options[q.answer])}.`,
      ];
    }
    case 'multi': {
      const wrong = view.opt.filter((i) => !q.answer.includes(i));
      return [
        `${q.answer.length} helyes válasz van a(z) ${q.options.length} közül.`,
        wrong.length ? `Biztosan nem helyes: ${wrong.slice(0, Math.ceil(wrong.length / 2)).map((i) => quote(q.options[i])).join('; ')}.` : 'Minden opció helyes lehet – gondold végig mindet!',
        `Egy biztos helyes válasz: ${quote(q.options[q.answer[0]])}${q.answer.length > 2 ? `, és ${quote(q.options[q.answer[1]])}` : ''}.`,
      ];
    }
    case 'truefalse': {
      const t = q.statements.filter((s) => s[1]).length;
      const order = view.st;
      const show = (n) => order.slice(0, n).map((i) => `${quote(q.statements[i][0])} → ${q.statements[i][1] ? 'IGAZ' : 'HAMIS'}`).join('; ');
      return [
        `${t} igaz és ${q.statements.length - t} hamis állítás van. Figyelj a „kizárólag”, „mindig”, „nem kell” típusú szavakra!`,
        show(Math.max(1, Math.round(q.statements.length / 3))),
        show(Math.max(2, Math.round(q.statements.length * 2 / 3))),
      ];
    }
    case 'group': {
      const sizes = q.groups.map((g, gi) => `${g}: ${q.items.filter((it) => it[1] === gi).length} db`).join(', ');
      const show = (n) => view.it.slice(0, n).map((i) => `${quote(q.items[i][0])} → ${q.groups[q.items[i][1]]}`).join('; ');
      return [`Csoportméretek: ${sizes}.`, show(Math.max(1, Math.round(q.items.length / 3))), show(Math.max(2, Math.round(q.items.length * 2 / 3)))];
    }
    case 'match': {
      const show = (n) => view.l.slice(0, n).map((i) => `${quote(q.pairs[i][0])} → ${quote(q.pairs[i][1])}`).join('; ');
      return [show(1), show(Math.max(2, Math.round(q.pairs.length / 2))), show(Math.max(2, q.pairs.length - 2))];
    }
    case 'order': {
      const n = q.items.length;
      return [
        `Az első elem: ${quote(q.items[0])}.`,
        `Az első: ${quote(q.items[0])}, az utolsó: ${quote(q.items[n - 1])}.`,
        `A sorrend eleje: ${q.items.slice(0, Math.max(2, n - 2)).map(quote).join(' → ')} …`,
      ];
    }
    case 'essay': {
      const k = q.keyPoints;
      return [
        `${k.length} kulcselemet érdemes érinteni. Az első: ${k[0]}.`,
        `Kulcselemek: ${k.slice(0, Math.ceil(k.length / 2)).join('; ')} …`,
        `Minden kulcselem: ${k.join('; ')}.`,
      ];
    }
    default: return ['', '', ''];
  }
}

/** Megoldás szövegesen (prompt, magyarázat, AI-összevetés). */
export function solutionText(q) {
  switch (q.type) {
    case 'single': return q.options[q.answer];
    case 'multi': return q.answer.map((i) => q.options[i]).join('; ');
    case 'truefalse': return q.statements.map((s) => `${s[0]} → ${s[1] ? 'Igaz' : 'Hamis'}`).join('\n');
    case 'group': return q.groups.map((g, gi) => `${g}: ${q.items.filter((it) => it[1] === gi).map((it) => it[0]).join('; ')}`).join('\n');
    case 'match': return q.pairs.map((p) => `${p[0]} → ${p[1]}`).join('\n');
    case 'order': return q.items.map((t, i) => `${i + 1}. ${t}`).join('\n');
    case 'essay': return q.model;
    default: return '';
  }
}

// ---------- Megjelenítés ----------
/**
 * st: {ans, view, checked, revealed, ai}
 * on: {change(newAns, rerender=true)}
 */
export function renderTheory(q, st, on) {
  const { ans, view } = st;
  const showRes = st.checked || st.revealed;
  switch (q.type) {
    case 'single': case 'multi': {
      const multi = q.type === 'multi';
      return h('div', { class: 'opts', role: multi ? 'group' : 'radiogroup' }, view.opt.map((oi) => {
        const sel = multi ? (ans || []).includes(oi) : ans === oi;
        const correct = multi ? q.answer.includes(oi) : q.answer === oi;
        let cls = 'opt' + (multi ? ' multi' : '') + (sel ? ' sel' : '');
        if (st.checked) { if (sel && correct) cls += ' ok'; else if (sel && !correct) cls += ' bad'; else if (!sel && correct) cls += ' missed'; }
        if (st.revealed && correct) cls += ' ok';
        return h('button', {
          class: cls, type: 'button', role: multi ? 'checkbox' : 'radio', 'aria-checked': String(sel),
          onclick: () => {
            if (multi) { const s = new Set(ans || []); s.has(oi) ? s.delete(oi) : s.add(oi); on.change([...s]); }
            else on.change(sel ? null : oi);
          },
        }, h('span', { class: 'mark' }), h('span', null, q.options[oi]));
      }));
    }
    case 'truefalse':
      return h('div', { class: 'tf' }, view.st.map((si) => {
        const [text, truth] = q.statements[si];
        const v = ans?.[si];
        let cls = 'tf-row';
        if (st.checked && v !== null && v !== undefined) cls += v === truth ? ' ok' : ' bad';
        const set = (b) => { const a = ans.slice(); a[si] = a[si] === b ? null : b; on.change(a); };
        return h('div', { class: cls },
          h('span', null, text, st.revealed ? h('strong', { style: { color: 'var(--ok)', marginLeft: '6px' } }, truth ? '(Igaz)' : '(Hamis)') : null),
          h('span', { class: 'seg' },
            h('button', { type: 'button', class: v === true ? 'on' : '', onclick: () => set(true) }, 'Igaz'),
            h('button', { type: 'button', class: v === false ? 'on' : '', onclick: () => set(false) }, 'Hamis')));
      }));
    case 'group':
      return h('div', { class: 'groups' },
        h('div', { class: 'tiny muted' }, 'Válaszd ki minden elemnél, melyik csoportba tartozik.'),
        h('div', { class: 'bucket-items' }, view.it.map((ii) => {
          const [text, g] = q.items[ii];
          const v = ans?.[ii];
          let cls = 'gitem';
          if (st.checked && v !== null && v !== undefined) cls += v === g ? ' ok' : ' bad';
          return h('div', { class: cls },
            h('span', null, text, st.revealed ? h('strong', { style: { color: 'var(--ok)', marginLeft: '6px' } }, `(${q.groups[g]})`) : null),
            h('span', { class: 'gpick' }, q.groups.map((gn, gi) => h('button', {
              type: 'button', class: v === gi ? 'on' : '',
              onclick: () => { const a = ans.slice(); a[ii] = a[ii] === gi ? null : gi; on.change(a); },
            }, gn))));
        })));
    case 'match':
      return h('div', { class: 'pairs' }, view.l.map((li) => {
        const v = ans?.[li];
        let cls = 'pair';
        if (st.checked && v !== null && v !== undefined) cls += v === li ? ' ok' : ' bad';
        const sel = h('select', {
          'aria-label': q.pairs[li][0],
          onchange: (e) => { const a = ans.slice(); a[li] = e.target.value === '' ? null : Number(e.target.value); on.change(a); },
        }, h('option', { value: '' }, '— válassz —'), view.r.map((ri, k) => h('option', { value: ri, selected: v === ri }, `${LETTERS[k]}) ${q.pairs[ri][1]}`)));
        return h('div', { class: cls },
          h('div', { class: 'l' }, q.pairs[li][0]),
          h('div', null, sel, st.revealed ? h('div', { class: 'tiny', style: { color: 'var(--ok)', marginTop: '3px' } }, '✓ ' + q.pairs[li][1]) : null));
      }));
    case 'order': {
      const list = h('div', { class: 'order' });
      const a = ans || view.start;
      a.forEach((ci, pos) => {
        let cls = 'oitem';
        if (st.checked) cls += ci === pos ? ' ok' : ' bad';
        const move = (d) => { const b = a.slice(); const t = pos + d; if (t < 0 || t >= b.length) return; [b[pos], b[t]] = [b[t], b[pos]]; on.change(b); };
        const row = h('div', { class: cls, draggable: 'true' },
          h('span', { class: 'txt' }, q.items[ci], st.revealed && ci !== pos ? h('span', { class: 'tiny', style: { color: 'var(--ok)', marginLeft: '6px' } }, `(helyesen: ${ci + 1}.)`) : null),
          h('span', { class: 'mv' },
            h('button', { type: 'button', 'aria-label': 'Fel', onclick: () => move(-1) }, '↑'),
            h('button', { type: 'button', 'aria-label': 'Le', onclick: () => move(1) }, '↓')));
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(pos)); row.classList.add('dragging'); });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData('text/plain'));
          if (Number.isNaN(from) || from === pos) return;
          const b = a.slice(); const [x] = b.splice(from, 1); b.splice(pos, 0, x); on.change(b);
        });
        list.appendChild(row);
      });
      return list;
    }
    case 'essay': {
      const a = ans;
      const ta = h('textarea', { placeholder: 'Írd ide a válaszod…', 'aria-label': 'Válasz' });
      ta.value = a.text || '';
      ta.addEventListener('input', () => on.change({ ...a, text: ta.value }, false));
      const box = h('div', { class: 'essay-box' }, ta);
      if (showRes) {
        box.appendChild(h('div', { class: 'panel sol' }, h('h4', null, 'Mintaválasz'), h('div', null, q.model)));
        box.appendChild(h('div', { class: 'kp' },
          h('div', { class: 'small', style: { fontWeight: 600 } }, 'Önértékelés – pipáld ki, mely kulcselemek szerepelnek a válaszodban:'),
          q.keyPoints.map((k, i) => h('label', null, h('input', {
            type: 'checkbox', checked: a.ticks[i],
            onchange: (e) => { const t = a.ticks.slice(); t[i] = e.target.checked; on.change({ ...a, ticks: t }); },
          }), h('span', null, k))),
          h('div', { class: 'row small', style: { marginTop: '6px' } },
            h('span', null, 'Vagy pontszám kézzel (pl. AI-értékelés alapján):'),
            (() => {
              const inp = h('input', { type: 'number', min: 0, max: q.keyPoints.length, step: 0.5, style: { width: '80px' }, value: a.aiScore ?? '' });
              inp.addEventListener('change', () => on.change({ ...a, aiScore: inp.value === '' ? null : Number(inp.value) }));
              return inp;
            })(),
            h('span', { class: 'muted' }, `/ ${q.keyPoints.length}`)),
          h('label', { class: 'switch small' }, h('input', {
            type: 'checkbox', checked: a.exclude, onchange: (e) => on.change({ ...a, exclude: e.target.checked }),
          }), 'Kihagyom a pontozásból')));
      }
      return box;
    }
    default: return h('div', null, 'Ismeretlen feladattípus');
  }
}

// ---------- AI-formátum ----------
/** Feladat szövege a promptba (a megjelenítési sorrend szerint, betűjelekkel). */
export function aiText(q, view) {
  const L = LETTERS;
  switch (q.type) {
    case 'single': case 'multi':
      return `${q.prompt}\n${view.opt.map((oi, k) => `  ${L[k]}) ${q.options[oi]}`).join('\n')}`;
    case 'truefalse':
      return `${q.prompt}\n${view.st.map((si, k) => `  ${k + 1}. ${q.statements[si][0]}`).join('\n')}`;
    case 'group':
      return `${q.prompt}\nCsoportok: ${q.groups.map((g, k) => `${L[k]}) ${g}`).join(', ')}\nElemek:\n${view.it.map((ii, k) => `  ${k + 1}. ${q.items[ii][0]}`).join('\n')}`;
    case 'match':
      return `${q.prompt}\nBal oldal:\n${view.l.map((li, k) => `  ${k + 1}. ${q.pairs[li][0]}`).join('\n')}\nJobb oldal:\n${view.r.map((ri, k) => `  ${L[k]}) ${q.pairs[ri][1]}`).join('\n')}`;
    case 'order':
      return `${q.prompt}\nElemek (összekeverve):\n${view.start.map((ci, k) => `  ${L[k]}) ${q.items[ci]}`).join('\n')}`;
    case 'essay':
      return `${q.prompt} (kifejtős)`;
    default: return q.prompt;
  }
}

/** A várt AI-válasz formátumának leírása + üres sablon. */
export function aiFormat(q, view) {
  switch (q.type) {
    case 'single': return { desc: 'egyetlen betűjel, pl. "B"', tpl: null };
    case 'multi': return { desc: 'a helyes betűjelek tömbje, pl. ["A","C"]', tpl: [] };
    case 'truefalse': return { desc: `${q.statements.length} elemű tömb a számozás sorrendjében, true = igaz, false = hamis`, tpl: q.statements.map(() => null) };
    case 'group': return { desc: `${q.items.length} elemű tömb: minden elemhez a csoport betűjele`, tpl: q.items.map(() => null) };
    case 'match': return { desc: `${q.pairs.length} elemű tömb: a bal oldali 1., 2., … elemhez tartozó jobb oldali betűjel`, tpl: q.pairs.map(() => null) };
    case 'order': return { desc: 'az elemek betűjelei a helyes sorrendben, pl. ["C","A","B"]', tpl: [] };
    case 'essay': return { desc: 'objektum: {"answer": "<mintaválasz>"} – ha a felhasználó válaszát értékeled: {"score": <pont>, "max": <pont>, "feedback": "<rövid indoklás>"}', tpl: { answer: null } };
    default: return { desc: '', tpl: null };
  }
}

const li = (c) => LETTERS.indexOf(String(c).trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1));

/** AI-válasz átalakítása belső formátumra. Hiba esetén kivételt dob. */
export function parseAi(q, view, raw) {
  switch (q.type) {
    case 'single': { const k = li(raw); if (k < 0 || k >= view.opt.length) throw new Error('érvénytelen betűjel'); return view.opt[k]; }
    case 'multi': return (Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/)).map(li).filter((k) => k >= 0 && k < view.opt.length).map((k) => view.opt[k]);
    case 'truefalse': {
      const a = q.statements.map(() => null);
      (raw || []).forEach((v, k) => { if (k < view.st.length) a[view.st[k]] = v === true || /^(igaz|true|i)$/i.test(String(v)) ? true : v === false || /^(hamis|false|h)$/i.test(String(v)) ? false : null; });
      return a;
    }
    case 'group': {
      const a = q.items.map(() => null);
      (raw || []).forEach((v, k) => { const g = li(v); if (k < view.it.length && g >= 0 && g < q.groups.length) a[view.it[k]] = g; });
      return a;
    }
    case 'match': {
      const a = q.pairs.map(() => null);
      (raw || []).forEach((v, k) => { const r = li(v); if (k < view.l.length && r >= 0 && r < view.r.length) a[view.l[k]] = view.r[r]; });
      return a;
    }
    case 'order': {
      const a = (raw || []).map(li).filter((k) => k >= 0 && k < view.start.length).map((k) => view.start[k]);
      if (new Set(a).size !== q.items.length) throw new Error('hiányos sorrend');
      return a;
    }
    case 'essay': {
      if (typeof raw === 'string') return { answer: raw };
      return { answer: raw?.answer ?? null, score: raw?.score ?? null, max: raw?.max ?? null, feedback: raw?.feedback ?? '' };
    }
    default: return raw;
  }
}

/** Az AI-válasz rövid szöveges megjelenítése. */
export function aiAnswerText(q, a) {
  if (a === null || a === undefined) return '—';
  switch (q.type) {
    case 'single': return q.options[a] ?? '—';
    case 'multi': return a.map((i) => q.options[i]).join('; ') || '—';
    case 'truefalse': return q.statements.map((s, i) => `${s[0]} → ${a[i] === null ? '?' : a[i] ? 'Igaz' : 'Hamis'}`).join('\n');
    case 'group': return q.items.map((it, i) => `${it[0]} → ${a[i] === null ? '?' : q.groups[a[i]]}`).join('\n');
    case 'match': return q.pairs.map((p, i) => `${p[0]} → ${a[i] === null ? '?' : q.pairs[a[i]][1]}`).join('\n');
    case 'order': return a.map((ci, i) => `${i + 1}. ${q.items[ci]}`).join('\n');
    case 'essay': return [a.answer, a.score !== null && a.score !== undefined ? `AI-pontszám: ${a.score}/${a.max ?? q.keyPoints.length}` : '', a.feedback].filter(Boolean).join('\n');
    default: return JSON.stringify(a);
  }
}
