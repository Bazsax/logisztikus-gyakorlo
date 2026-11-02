// Logisztikus vizsgagyakorló – fő alkalmazás (nézetek, útválasztás).
import { h, clear, copyText, download, toast, modal, fmt } from './util.js';
import { settings, saveSettings, stats, saveStats, recordQuestion, recordSession, resetStats, loadSession, saveSession, clearSession, exportAll, importAll, applyTheme, DEFAULT_SETTINGS } from './store.js';
import { loadBank, BANK, BANK_BY_ID, TOPICS, createSession, questionOf, practiceOf, itemScore, sumScores, grade, sectionOf } from './session.js';
import { renderTheory, hints as theoryHints, solutionText, aiAnswerText, isAnswered, TYPE_LABEL, maxPoints } from './theory.js';
import { renderPractice, renderBlocks, practiceSolutionText } from './practiceView.js';
import { GENERATORS } from './practice/index.js';
import { helpPrompt, solvePrompt, essayPrompt, importAi, aiAgreement } from './ai.js';

const app = document.getElementById('app');
let S = loadSession();
let saveTimer;
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveSession(S), 250); };

// ---------------- Ikonok ----------------
const svg = (path, size = 20) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = path;
  return s;
};
const I = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12v5M8 16h2M12 16h2"/>',
  mix: '<path d="M4 7h11M4 17h7"/><path d="M15 4l3 3-3 3M11 14l3 3-3 3"/><path d="M18 7h2M14 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  redo: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  logo: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
};

// ---------------- Fejléc ----------------
function header() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0] || '';
  const link = (href, label, key) => h('a', { href, class: route === key ? 'active' : '' }, label);
  const themeIcon = settings.theme === 'dark' ? I.moon : settings.theme === 'light' ? I.sun : I.auto;
  const themeLabel = { system: 'Téma: rendszer', light: 'Téma: világos', dark: 'Téma: sötét' }[settings.theme];
  return h('header', { class: 'topbar' }, h('div', { class: 'topbar-in' },
    h('a', { class: 'brand', href: '#/' }, svg(I.logo, 24), h('span', null, 'Logisztikus gyakorló')),
    h('nav', { class: 'nav' },
      link('#/', 'Kezdőlap', ''),
      S ? link('#/session', 'Feladatok', 'session') : null,
      link('#/stats', 'Statisztika', 'stats'),
      link('#/settings', 'Beállítások', 'settings')),
    h('button', {
      class: 'icon-btn', title: themeLabel, 'aria-label': themeLabel,
      onclick: () => { settings.theme = { system: 'light', light: 'dark', dark: 'system' }[settings.theme]; saveSettings(); applyTheme(); render(); toast({ system: 'Téma: rendszer szerint', light: 'Világos téma', dark: 'Sötét téma' }[settings.theme]); },
    }, svg(themeIcon))));
}

// ---------------- Kezdőlap ----------------
const MODES = [
  { key: 'theory', icon: I.book, title: 'Elméleti feladatok', desc: 'Választós, igaz-hamis, párosítás, csoportosítás, sorrend és kifejtős kérdések.' },
  { key: 'practice', icon: I.calc, title: 'Gyakorlati feladatok', desc: 'DRP, MRP, EOQ, beszállítóértékelés, Johnson, forgási mutatók, körjárat – végtelen új adattal.' },
  { key: 'mixed', icon: I.mix, title: 'Vegyes', desc: 'Elméleti és gyakorlati feladatok egy sorban.' },
  { key: 'exam', icon: I.clock, title: 'Vizsgaszimuláció', desc: 'Írásbeli (60 perc, 30%) és projektfeladat (120 perc, 70%), érdemjeggyel.' },
  { key: 'review', icon: I.redo, title: 'Hibás kérdések', desc: 'A korábban elrontott elméleti kérdések újragyakorlása.' },
];
let homeMode = 'theory';
const homeOpts = { count: settings.theoryCount, topics: null, kinds: null, preset: 'random', pCount: settings.mixedPractice };

function viewHome() {
  const topics = TOPICS();
  if (!homeOpts.topics) homeOpts.topics = topics.slice();
  if (!homeOpts.kinds) homeOpts.kinds = GENERATORS.filter((g) => g.meta.exam).map((g) => g.meta.kind);
  const wrap = h('div', { class: 'narrow' });
  wrap.appendChild(h('section', { class: 'hero' },
    h('h1', null, 'Felkészülés a logisztikus állami vizsgára'),
    h('p', null, `${BANK.filter((q) => q.type !== 'essay').length} ellenőrzött elméleti kérdés, ${BANK.filter((q) => q.type === 'essay').length} kifejtős kérdés és ${GENERATORS.length} gyakorlati feladattípus, amely minden indításkor új számokkal dolgozik.`)));

  if (S && !S.submitted) {
    const done = S.items.filter((_, i) => answered(i)).length;
    wrap.appendChild(h('div', { class: 'callout row' },
      h('div', { class: 'spacer' }, h('strong', null, 'Folyamatban: '), `${S.title} – ${done}/${S.items.length} feladat megkezdve`),
      h('a', { class: 'btn primary sm', href: '#/session' }, 'Folytatás')));
  }

  const modes = h('div', { class: 'modes', role: 'list' }, MODES.map((m) => h('button', {
    class: 'mode' + (homeMode === m.key ? ' selected' : ''), type: 'button', role: 'listitem',
    onclick: () => { homeMode = m.key; render(); setTimeout(() => document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30); },
  }, h('div', { class: 'ico' }, svg(m.icon)), h('h3', null, m.title), h('p', null, m.desc))));
  wrap.appendChild(modes);

  const setup = h('div', { class: 'card card-pad setup', id: 'setup' });
  const m = MODES.find((x) => x.key === homeMode);
  setup.appendChild(h('h2', null, m.title));

  const chipSet = (all, sel, labelOf, onToggle) => h('div', { class: 'chips' }, all.map((v) => h('span', {
    class: 'chip' + (sel.includes(v) ? ' on' : ''), role: 'checkbox', tabindex: 0, 'aria-checked': String(sel.includes(v)),
    onclick: () => { onToggle(v); render(); }, onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(v); render(); } },
  }, labelOf(v))));
  const toggleIn = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
  const numField = (label, key, min, max) => h('div', { class: 'field' }, h('label', null, label), (() => {
    const inp = h('input', { type: 'number', min, max, value: homeOpts[key], style: { width: '110px' } });
    inp.addEventListener('change', () => { homeOpts[key] = Math.max(min, Math.min(max, Number(inp.value) || min)); inp.value = homeOpts[key]; });
    return inp;
  })());
  const topicField = () => h('div', { class: 'field' },
    h('div', { class: 'lbl row' }, 'Témakörök', h('button', { class: 'btn ghost sm', onclick: () => { homeOpts.topics = homeOpts.topics.length === topics.length ? [] : topics.slice(); render(); } }, homeOpts.topics.length === topics.length ? 'Egyik sem' : 'Mind')),
    chipSet(topics, homeOpts.topics, (t) => `${t} (${BANK.filter((q) => q.topic === t).length})`, (t) => toggleIn(homeOpts.topics, t)));
  const essayToggle = () => h('label', { class: 'switch field' }, h('input', {
    type: 'checkbox', checked: settings.essays, onchange: (e) => { settings.essays = e.target.checked; saveSettings(); },
  }), 'Kifejtős (definíciós) feladatok is legyenek');
  const kindField = (exclusive) => h('div', { class: 'field' },
    h('div', { class: 'lbl' }, 'Feladattípusok'),
    chipSet(GENERATORS.filter((g) => !exclusive || g.meta.exam).map((g) => g.meta.kind), homeOpts.kinds,
      (k) => { const g = GENERATORS.find((x) => x.meta.kind === k).meta; return `${g.order <= 8 ? g.order + '. ' : ''}${g.title}${g.exam ? '' : ' (extra)'}`; },
      (k) => toggleIn(homeOpts.kinds, k)));
  const presetField = () => h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Adatok'),
    chipSet(['random', 'vizsga', 'v23'], [homeOpts.preset], (v) => ({ random: 'Véletlen új adatok', vizsga: 'Gamer székes mintavizsga', v23: '23-as feladatlap (a vizsgához legközelebb)' }[v]), (v) => { homeOpts.preset = v; }));

  if (homeMode === 'theory') setup.append(numField('Kérdések száma', 'count', 1, BANK.length), topicField(), essayToggle());
  if (homeMode === 'practice') setup.append(kindField(false), presetField(), h('p', { class: 'small muted' }, 'A táblázatos feladatoknál a cellák közvetlenül kitölthetők (Enter: következő mező). Tizedesvessző és -pont is jó.'));
  if (homeMode === 'mixed') setup.append(numField('Elméleti kérdések', 'count', 1, 60), numField('Gyakorlati feladatok', 'pCount', 1, 9), topicField(), kindField(false), essayToggle());
  if (homeMode === 'exam') {
    setup.append(
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('div', { class: 'small muted' }, 'Írásbeli'), h('div', { class: 'v' }, `${settings.examWrittenMin} perc`), h('div', { class: 'small' }, `${settings.examTheory} elméleti kérdés${settings.essays ? `, ebből ${settings.examEssays} kifejtős` : ''} · súly ${settings.weightWritten}%`)),
        h('div', { class: 'stat' }, h('div', { class: 'small muted' }, 'Projektfeladat'), h('div', { class: 'v' }, `${settings.examProjectMin} perc`), h('div', { class: 'small' }, `8 gyakorlati feladat, 36 pont · súly ${settings.weightProject}%`))),
      h('p', { class: 'small muted', style: { marginTop: '12px' } }, `Sikeres vizsga: mindkét részből legalább ${settings.passPct}%. Érdemjegy: 50–69% elégséges, 70–79% közepes, 80–89% jó, 90% felett jeles. (A paraméterek a Beállításokban módosíthatók.)`),
      presetField(), essayToggle());
  }
  if (homeMode === 'review') {
    const weak = Object.entries(stats.q).filter(([id, v]) => BANK_BY_ID[id] && v.last < 1).length;
    setup.append(h('p', null, weak ? `${weak} kérdésnél nem volt hibátlan az utolsó válaszod. A leggyengébbekkel kezdünk.` : 'Még nincs hibás kérdésed – előbb gyakorolj egy kicsit az elméleti részen!'), numField('Legfeljebb ennyi kérdés', 'count', 1, 100));
  }

  setup.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary lg', onclick: start }, 'Indítás')));
  wrap.appendChild(setup);

  wrap.appendChild(h('div', { class: 'card card-pad', style: { marginTop: '18px' } },
    h('h3', null, 'Így használd az AI-gombokat'),
    h('ol', { class: 'small', style: { paddingLeft: '20px', margin: 0 } },
      h('li', null, h('strong', null, 'AI segítség: '), 'kimásolja a feladatot (és a válaszodat) egy magyarázatot kérő prompttal. Illeszd be egy AI-chatbe.'),
      h('li', null, h('strong', null, 'AI megoldás fájlba: '), 'olyan promptot másol, amelyre az AI egy betölthető .json fájlt ad vissza. Töltsd le, majd a feladatlapon az „AI-fájl betöltése” gombbal töltsd be: az AI válaszai megjelennek a beépített megoldás mellett, eltéréssel együtt.'),
      h('li', null, h('strong', null, 'Kifejtős ellenőrzés: '), 'a kifejtős válaszaidat a kulcselemekkel együtt küldi az AI-nak. Az AI pontszámai ugyanígy visszatölthetők, vagy beírhatod őket kézzel.'))));
  return wrap;
}

function start() {
  const o = { mode: homeMode, count: homeOpts.count, topics: homeOpts.topics, kinds: homeOpts.kinds, preset: homeOpts.preset, pCount: homeOpts.pCount };
  if ((homeMode === 'theory' || homeMode === 'mixed') && !o.topics.length) return toast('Válassz legalább egy témakört!');
  if ((homeMode === 'practice' || homeMode === 'mixed') && !o.kinds.length) return toast('Válassz legalább egy feladattípust!');
  if (S && !S.submitted && S.items.some((_, i) => answered(i)) && !confirm('Van egy befejezetlen gyakorlásod. Elveted, és újat kezdesz?')) return;
  const s = createSession(o);
  if (!s.items.length) return toast(homeMode === 'review' ? 'Nincs még hibás kérdés.' : 'Nincs a feltételeknek megfelelő feladat.');
  S = s; saveSession(S);
  location.hash = '#/session';
}

// ---------------- Munkamenet ----------------
function answered(i) {
  const it = S.items[i];
  if (it.k === 't') return isAnswered(BANK_BY_ID[it.id], S.ans[i]);
  return Object.entries(S.ans[i] || {}).some(([k, v]) => !k.startsWith('calc:') && String(v).trim() !== '');
}

let timerInt;
function viewSession() {
  if (!S) { location.hash = '#/'; return h('div'); }
  const wrap = h('div');
  const sec = S.sections ? (S.timer?.section ?? 0) : null;
  const range = S.sections ? [S.sections[sec].from, S.sections[sec].to] : [0, S.items.length];

  // Felső sáv
  const done = S.items.slice(range[0], range[1]).filter((_, k) => answered(range[0] + k)).length;
  const total = range[1] - range[0];
  const bar = h('div', { class: 'sess-bar' },
    h('div', { class: 'row' },
      h('h2', { style: { margin: 0, fontSize: '1.15rem' } }, S.title),
      h('span', { class: 'badge' }, S.id),
      S.submitted ? h('span', { class: 'badge ok' }, 'Beadva') : null,
      h('span', { class: 'spacer' }),
      S.sections ? timerEl() : null),
    S.sections ? h('div', { class: 'tabs', style: { marginTop: '8px' } }, S.sections.map((x, k) => h('button', {
      class: 'tab' + (k === sec ? ' on' : ''),
      onclick: () => { S.timer.section = k; if (!S.timer.sectionStart[k]) S.timer.sectionStart[k] = Date.now(); persist(); render(); scrollTo(0, 0); },
    }, x.name))) : null,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('div', { class: 'progress', title: `${done}/${total} megkezdve` }, h('i', { style: { width: `${(done / Math.max(1, total)) * 100}%` } })),
      h('span', { class: 'small muted' }, `${done}/${total}`)),
    h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } },
      h('button', { class: 'btn sm' + (allOn('revealed') ? ' on' : ''), onclick: () => toggleAll('revealed') }, svg(I.eye, 16), allOn('revealed') ? 'Megoldások elrejtése' : 'Összes megoldás'),
      h('button', { class: 'btn sm' + (allOn('expl') ? ' on' : ''), onclick: () => toggleAll('expl') }, svg(I.info, 16), allOn('expl') ? 'Magyarázatok elrejtése' : 'Összes magyarázat'),
      h('button', { class: 'btn sm', onclick: () => fillAll() }, 'Összes kitöltése'),
      h('button', { class: 'btn sm', onclick: () => aiMenu() }, svg(I.spark, 16), 'AI'),
      h('span', { class: 'spacer' }),
      S.submitted ? h('a', { class: 'btn primary sm', href: '#/results' }, 'Eredmény') : h('button', { class: 'btn primary sm', onclick: submit }, svg(I.check, 16), 'Beadás')));
  wrap.appendChild(bar);

  for (let i = range[0]; i < range[1]; i++) wrap.appendChild(card(i));
  wrap.appendChild(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '20px' } },
    S.sections && sec === 0 ? h('button', { class: 'btn lg', onclick: () => { S.timer.section = 1; if (!S.timer.sectionStart[1]) S.timer.sectionStart[1] = Date.now(); persist(); render(); scrollTo(0, 0); } }, 'Tovább a projektfeladathoz →') : null,
    S.submitted ? h('a', { class: 'btn primary lg', href: '#/results' }, 'Eredmény megtekintése') : h('button', { class: 'btn primary lg', onclick: submit }, 'Beadás és kiértékelés')));
  return wrap;
}

function timerEl() {
  const el = h('span', { class: 'timer', 'aria-live': 'off' });
  const upd = () => {
    if (!S?.sections) return;
    const k = S.timer.section;
    const startT = S.timer.sectionStart[k] || Date.now();
    const left = S.sections[k].minutes * 60 - Math.floor((Date.now() - startT) / 1000);
    const a = Math.abs(left);
    el.textContent = `${left < 0 ? '−' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
    el.classList.toggle('low', left < 300);
    el.title = left < 0 ? 'Lejárt az idő' : 'Hátralévő idő';
  };
  upd(); clearInterval(timerInt); if (!S.submitted) timerInt = setInterval(upd, 1000);
  return el;
}

const inRange = () => {
  if (!S.sections) return S.items.map((_, i) => i);
  const x = S.sections[S.timer.section]; return Array.from({ length: x.to - x.from }, (_, k) => x.from + k);
};
const allOn = (key) => inRange().every((i) => S[key][i]);
function toggleAll(key) { const v = !allOn(key); inRange().forEach((i) => { S[key][i] = v; }); persist(); render(); }
function fillAll() {
  if (!confirm('A megoldással kitöltöd az összes (aktuális) feladatot? A saját válaszaid felülíródnak.')) return;
  inRange().forEach(fillItem); persist(); render();
}
function fillItem(i) {
  const it = S.items[i];
  if (it.k === 't') {
    const q = BANK_BY_ID[it.id];
    const a = { single: q.answer, multi: q.answer, truefalse: q.statements?.map((x) => x[1]), group: q.items?.map((x) => x[1]), match: q.pairs?.map((_, k) => k), order: q.items?.map((_, k) => k) }[q.type];
    if (q.type === 'essay') S.ans[i] = { ...S.ans[i], text: q.model, ticks: q.keyPoints.map(() => true) };
    else S.ans[i] = Array.isArray(a) ? a.slice() : a;
  } else {
    const t = practiceOf(it);
    const a = { ...S.ans[i] };
    for (const [fid, f] of Object.entries(t.fields)) a[fid] = f.expect === null ? '' : typeof f.expect === 'number' ? fmt(f.expect).replace(/\s/g, '') : f.expect;
    S.ans[i] = a;
  }
  S.revealed[i] = true; S.filled = { ...(S.filled || {}), [i]: true };
}

function card(i) {
  const it = S.items[i];
  const isT = it.k === 't';
  const q = questionOf(it);
  const el = h('article', { class: 'card card-pad item', id: `item-${i}` });
  const refresh = () => { const n = card(i); el.replaceWith(n); };
  const checked = S.checked[i] || S.submitted;
  const sc = itemScore(S, i);
  const hl = S.hint[i] || 0;

  // Fej
  el.appendChild(h('div', { class: 'item-head' },
    h('span', { class: 'item-no' }, `${i + 1}.`),
    h('span', { class: 'badge' }, isT ? TYPE_LABEL[q.type] : 'Gyakorlati'),
    h('span', { class: 'badge info' }, isT ? q.topic : q.title),
    isT && settings.showSourceBadge ? (q.source === 'redmenta' ? h('span', { class: 'badge ok', title: 'A megoldás a Redmenta javítókulcsán alapul' }, 'Redmenta-kulcs') : q.source === 'vizsga' ? h('span', { class: 'badge ok', title: 'Korábbi vizsgafeladatsor megoldókulcsa alapján' }, 'Vizsgakulcs') : h('span', { class: 'badge warn', title: 'A megoldást Claude készítette – nincs hozzá javítókulcs' }, 'Saját megoldás')) : null,
    !isT && it.ref.preset ? h('span', { class: 'badge accent' }, { vizsga: 'Gamer-mintavizsga', v23: '23-as feladatlap', v23b: '23-as feladatlap – bónusz' }[it.ref.preset]) : null,
    S.filled?.[i] ? h('span', { class: 'badge warn' }, 'Kitöltve a megoldással') : null,
    h('span', { class: 'item-score' }, checked ? (sc.excluded ? 'nem pontozott' : `${fmt(sc.got)} / ${fmt(sc.max)} p`) : `${fmt(isT ? maxPoints(q) : q.points)} p`)));

  if (isT) el.appendChild(h('div', { class: 'prompt' }, q.prompt));

  // Törzs
  const change = (v, re = true) => { S.ans[i] = v; persist(); if (re) refresh(); };
  if (isT) {
    el.appendChild(renderTheory(q, { ans: S.ans[i], view: it.view, checked, revealed: S.revealed[i] }, { change }));
  } else {
    el.appendChild(renderPractice(q, { ans: S.ans[i], checked, revealed: S.revealed[i], ai: S.ai[i] }, {
      change: (fid, v, re = true) => { S.ans[i] = { ...S.ans[i], [fid]: v }; persist(); if (re && checked) refresh(); },
    }));
  }

  // Panelek
  if (hl > 0) {
    const hs = isT ? theoryHints(q, it.view) : q.hints;
    el.appendChild(h('div', { class: 'panel hint' }, h('h4', null, `Tipp (${hl}/3)`), h('ol', null, hs.slice(0, hl).map((x) => h('li', null, x)))));
  }
  if (S.revealed[i] && isT && q.type !== 'essay') {
    el.appendChild(h('div', { class: 'panel sol' }, h('h4', null, 'Megoldás'), h('div', { style: { whiteSpace: 'pre-line' } }, solutionText(q))));
  }
  if (S.revealed[i] && !isT) el.appendChild(h('div', { class: 'panel sol' }, h('h4', null, 'Megoldás'), h('div', { class: 'small' }, 'A helyes értékek a cellák alatt zölddel látszanak.')));
  if (S.expl[i]) {
    el.appendChild(h('div', { class: 'panel expl' }, h('h4', null, 'Magyarázat'),
      isT ? h('div', null, q.explanation || 'Ehhez a kérdéshez nincs külön magyarázat.', q.type !== 'essay' ? h('div', { class: 'small', style: { marginTop: '6px', whiteSpace: 'pre-line' } }, h('strong', null, 'Helyes válasz: '), solutionText(q)) : null)
        : h('div', { class: 'statement' }, renderBlocks(q.solution))));
  }
  if (S.ai[i] !== undefined) {
    const ag = aiAgreement(S, i);
    el.appendChild(h('div', { class: 'panel ai' },
      h('h4', null, 'AI válasza ', ag ? h('span', { class: 'badge ' + (ag.match ? 'ok' : 'bad') }, ag.match ? 'egyezik a beépített megoldással' : `eltér (${ag.detail})`) : null),
      isT ? h('div', { style: { whiteSpace: 'pre-line' } }, aiAnswerText(q, S.ai[i])) : h('div', { class: 'small' }, 'Az AI értékei a cellák alatt narancssárgával látszanak (✓ = egyezik, ✗ = eltér a beépített megoldástól).')));
  }

  // Műveletek
  const hintBtn = h('button', { class: 'btn sm', disabled: hl >= 3, onclick: () => { S.hint[i] = Math.min(3, hl + 1); persist(); refresh(); } }, svg(I.bulb, 16), 'Tipp', h('span', { class: 'count' }, `${hl}/3`));
  el.appendChild(h('div', { class: 'item-actions' },
    hintBtn,
    h('button', { class: 'btn sm' + (S.checked[i] ? ' on' : ''), onclick: () => { S.checked[i] = !S.checked[i]; if (isT && q.type === 'essay' && S.checked[i]) S.revealed[i] = true; persist(); refresh(); } }, svg(I.check, 16), S.checked[i] ? 'Ellenőrzés ki' : 'Ellenőrzés'),
    h('button', { class: 'btn sm' + (S.revealed[i] ? ' on' : ''), onclick: () => { S.revealed[i] = !S.revealed[i]; persist(); refresh(); } }, svg(I.eye, 16), 'Megoldás'),
    h('button', { class: 'btn sm' + (S.expl[i] ? ' on' : ''), onclick: () => { S.expl[i] = !S.expl[i]; persist(); refresh(); } }, svg(I.info, 16), 'Magyarázat'),
    h('button', { class: 'btn sm ghost', title: 'Feladat kitöltése a megoldással', onclick: () => { fillItem(i); persist(); refresh(); } }, 'Kitöltés'),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn sm ghost', title: 'Magyarázatot kérő prompt másolása', onclick: () => copyText(helpPrompt(S, [i])) }, svg(I.copy, 16), 'AI segítség'),
    h('button', { class: 'btn sm ghost', title: 'Megoldó prompt másolása – az AI betölthető fájlt ad vissza', onclick: () => copyText(solvePrompt(S, [i])) }, svg(I.spark, 16), 'AI megoldás fájlba'),
    isT && q.type === 'essay' ? h('button', { class: 'btn sm ghost', onclick: () => { if (!S.ans[i]?.text?.trim()) return toast('Előbb írd meg a válaszod!'); copyText(essayPrompt(S, [i])); } }, 'AI értékelés') : null));
  return el;
}

function aiMenu() {
  const idxs = inRange();
  const essays = idxs.filter((i) => S.items[i].k === 't' && BANK_BY_ID[S.items[i].id].type === 'essay');
  const fileInput = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hide' });
  const ta = h('textarea', { placeholder: 'Ide is beillesztheted az AI válaszát (a JSON-t vagy az egész üzenetet)…', style: { minHeight: '110px' } });
  const doImport = (text) => {
    try {
      const r = importAi(S, text);
      persist(); render();
      toast(`${r.ok} feladat AI-válasza betöltve${r.errors.length ? `, ${r.errors.length} hiba` : ''}`);
      if (r.errors.length) modal('Betöltési figyelmeztetések', h('ul', null, r.errors.map((e) => h('li', null, e))));
      return true;
    } catch (e) { toast(e.message); return false; }
  };
  fileInput.addEventListener('change', async () => { const f = fileInput.files[0]; if (f && doImport(await f.text())) close(); });
  const close = modal('AI-eszközök', h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, `Az alábbi gombok ${S.sections ? 'az aktuális vizsgarész' : 'a munkamenet'} ${idxs.length} feladatára vonatkoznak. Munkamenet-azonosító: ${S.id}.`),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => copyText(helpPrompt(S, idxs)) }, svg(I.copy, 16), 'Segítő prompt (összes)'),
      h('button', { class: 'btn', onclick: () => copyText(solvePrompt(S, idxs)) }, svg(I.spark, 16), 'Megoldó prompt + fájl (összes)'),
      essays.length ? h('button', { class: 'btn', onclick: () => copyText(essayPrompt(S, essays)) }, `Kifejtős válaszok értékelése (${essays.length})`) : null),
    h('hr', { style: { border: 0, borderTop: '1px solid var(--border)' } }),
    h('div', { class: 'lbl', style: { fontWeight: 600 } }, 'AI válaszfájl betöltése'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => fileInput.click() }, svg(I.upload, 16), 'Fájl kiválasztása'), fileInput),
    ta,
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { if (doImport(ta.value)) close(); } }, 'Beillesztett szöveg betöltése'),
      Object.keys(S.ai).length ? h('button', { class: 'btn ghost', onclick: () => { S.ai = {}; persist(); render(); close(); toast('AI-válaszok törölve'); } }, 'AI-válaszok törlése') : null)));
}

function submit() {
  const empty = S.items.filter((_, i) => !answered(i)).length;
  if (empty && !confirm(`${empty} feladat még üres. Biztosan beadod?`)) return;
  S.submitted = true; S.submittedAt = Date.now();
  // Statisztika
  S.items.forEach((it, i) => {
    if (it.k !== 't' || S.filled?.[i]) return;
    const r = itemScore(S, i);
    if (!r.excluded && r.max) recordQuestion(it.id, r.got / r.max);
  });
  const tot = sumScores(S);
  const entry = { date: Date.now(), mode: S.mode, title: S.title, pct: Math.round(tot.pct * 10) / 10, n: S.items.length };
  if (S.sections) entry.parts = S.sections.map((x) => Math.round(sumScores(S, x.from, x.to).pct * 10) / 10);
  recordSession(entry);
  saveSession(S); clearInterval(timerInt);
  location.hash = '#/results';
}

// ---------------- Eredmény ----------------
function viewResults() {
  if (!S) { location.hash = '#/'; return h('div'); }
  const wrap = h('div', { class: 'narrow stack' });
  const tot = sumScores(S);
  const head = h('div', { class: 'card card-pad' });
  if (S.sections) {
    const parts = S.sections.map((x) => ({ ...x, r: sumScores(S, x.from, x.to) }));
    const final = parts.reduce((a, p) => a + p.r.pct * p.weight / 100, 0);
    const passed = parts.every((p) => p.r.pct >= settings.passPct);
    const g = passed ? grade(final) : { t: 'Elégtelen (1) – valamelyik részvizsga 50% alatt' };
    head.append(h('h2', null, 'Vizsgaeredmény'),
      h('div', { class: 'row' }, h('div', { class: 'score-big' }, `${fmt(Math.round(final * 10) / 10)}%`), h('div', { class: 'grade', style: { color: passed ? 'var(--ok)' : 'var(--bad)' } }, g.t)),
      h('div', { class: 'stat-grid', style: { marginTop: '14px' } }, parts.map((p) => h('div', { class: 'stat' },
        h('div', { class: 'small muted' }, `${p.name} · súly ${p.weight}%`),
        h('div', { class: 'v', style: { color: p.r.pct >= settings.passPct ? 'var(--ok)' : 'var(--bad)' } }, `${fmt(Math.round(p.r.pct * 10) / 10)}%`),
        h('div', { class: 'small' }, `${fmt(p.r.got)} / ${fmt(p.r.max)} pont`),
        h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: `${p.r.pct}%` } }))))));
  } else {
    head.append(h('h2', null, 'Eredmény'),
      h('div', { class: 'row' }, h('div', { class: 'score-big' }, `${fmt(Math.round(tot.pct * 10) / 10)}%`), h('div', { class: 'grade muted' }, `${fmt(tot.got)} / ${fmt(tot.max)} pont · ${grade(tot.pct).t}`)));
  }
  const essaysEx = S.items.filter((it, i) => it.k === 't' && BANK_BY_ID[it.id].type === 'essay' && itemScore(S, i).excluded).length;
  if (essaysEx) head.appendChild(h('p', { class: 'small muted', style: { marginTop: '10px' } }, `${essaysEx} kifejtős feladat nem számít bele (kihagyva vagy kikapcsolva).`));
  head.appendChild(h('div', { class: 'row', style: { marginTop: '14px' } },
    h('a', { class: 'btn', href: '#/session' }, 'Feladatok és megoldások'),
    h('button', { class: 'btn', onclick: retryWrong }, 'Hibásak újra'),
    h('a', { class: 'btn primary', href: '#/', onclick: () => { homeMode = S.mode === 'ids' || S.mode === 'review' ? 'theory' : S.mode; } }, 'Új gyakorlás')));
  wrap.appendChild(head);

  const list = h('div', { class: 'res-list' });
  S.items.forEach((it, i) => {
    const q = questionOf(it); const r = itemScore(S, i);
    const pct = r.max ? r.got / r.max : 0;
    list.appendChild(h('div', { class: 'res-row', onclick: () => { if (S.sections) S.timer.section = sectionOf(S, i); location.hash = '#/session'; setTimeout(() => document.getElementById(`item-${i}`)?.scrollIntoView({ block: 'start' }), 60); } },
      h('span', { class: 'badge ' + (r.excluded ? '' : pct === 1 ? 'ok' : pct > 0 ? 'warn' : 'bad') }, r.excluded ? '—' : `${fmt(r.got)}/${fmt(r.max)}`),
      h('span', { class: 't' }, `${i + 1}. ${it.k === 't' ? q.prompt : q.title}`)));
  });
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Feladatonként'), list));
  return wrap;
}

function retryWrong() {
  const ids = S.items.map((it, i) => ({ it, r: itemScore(S, i) })).filter((x) => x.it.k === 't' && !x.r.excluded && x.r.got < x.r.max).map((x) => x.it.id);
  if (!ids.length) return toast('Nincs hibás elméleti kérdés – szép munka!');
  S = createSession({ mode: 'ids', ids, title: 'Hibás kérdések újra' }); saveSession(S); location.hash = '#/session';
}

// ---------------- Statisztika ----------------
function viewStats() {
  const wrap = h('div', { class: 'narrow stack' });
  wrap.appendChild(h('h1', null, 'Statisztika'));
  const byTopic = {};
  for (const [id, v] of Object.entries(stats.q)) {
    const q = BANK_BY_ID[id]; if (!q) continue;
    const t = byTopic[q.topic] || (byTopic[q.topic] = { n: 0, sum: 0, total: BANK.filter((x) => x.topic === q.topic).length });
    t.n += 1; t.sum += v.sum / v.seen;
  }
  const seen = Object.keys(stats.q).length;
  wrap.appendChild(h('div', { class: 'stat-grid' },
    h('div', { class: 'stat' }, h('div', { class: 'small muted' }, 'Megoldott kérdések'), h('div', { class: 'v' }, `${seen} / ${BANK.length}`)),
    h('div', { class: 'stat' }, h('div', { class: 'small muted' }, 'Gyakorlások'), h('div', { class: 'v' }, stats.history.length)),
    h('div', { class: 'stat' }, h('div', { class: 'small muted' }, 'Átlag (utolsó 10)'), h('div', { class: 'v' }, stats.history.length ? `${fmt(Math.round(stats.history.slice(0, 10).reduce((a, x) => a + x.pct, 0) / Math.min(10, stats.history.length) * 10) / 10)}%` : '–'))));
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Témakörök'),
    Object.keys(byTopic).length ? h('div', { class: 'stack' }, Object.entries(byTopic).sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n).map(([t, v]) => {
      const pct = (v.sum / v.n) * 100;
      return h('div', null, h('div', { class: 'row small' }, h('span', { class: 'spacer' }, t), h('span', { class: 'muted' }, `${v.n}/${v.total} kérdés · ${fmt(Math.round(pct))}%`)), h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } })));
    })) : h('p', { class: 'muted' }, 'Még nincs adat. Adj be egy gyakorlást!')));
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Előzmények'),
    stats.history.length ? h('div', { class: 'res-list' }, stats.history.slice(0, 30).map((e) => h('div', { class: 'res-row', style: { cursor: 'default' } },
      h('span', { class: 'badge ' + (e.pct >= 80 ? 'ok' : e.pct >= 50 ? 'warn' : 'bad') }, `${fmt(e.pct)}%`),
      h('span', { class: 't' }, `${e.title} · ${e.n} feladat${e.parts ? ` · írásbeli ${fmt(e.parts[0])}%, projekt ${fmt(e.parts[1])}%` : ''}`),
      h('span', { class: 'tiny muted' }, new Date(e.date).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }))))) : h('p', { class: 'muted' }, 'Még nincs beadott gyakorlás.')));
  return wrap;
}

// ---------------- Beállítások ----------------
function viewSettings() {
  const wrap = h('div', { class: 'narrow stack' });
  wrap.appendChild(h('h1', null, 'Beállítások'));
  const sel = (label, key, opts) => h('div', { class: 'field' }, h('label', null, label), h('select', {
    onchange: (e) => { settings[key] = e.target.value; saveSettings(); applyTheme(); render(); },
  }, opts.map(([v, t]) => h('option', { value: v, selected: settings[key] === v }, t))));
  const num = (label, key, min, max, suffix = '') => h('div', { class: 'row field', style: { justifyContent: 'space-between' } }, h('label', null, label), h('span', { class: 'row' }, (() => {
    const inp = h('input', { type: 'number', min, max, value: settings[key], style: { width: '90px' } });
    inp.addEventListener('change', () => { settings[key] = Math.max(min, Math.min(max, Number(inp.value) || min)); inp.value = settings[key]; saveSettings(); });
    return inp;
  })(), suffix));
  const sw = (label, key) => h('label', { class: 'switch field' }, h('input', { type: 'checkbox', checked: settings[key], onchange: (e) => { settings[key] = e.target.checked; saveSettings(); } }), label);

  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Megjelenés'),
    sel('Téma', 'theme', [['system', 'Rendszer szerint'], ['light', 'Világos'], ['dark', 'Sötét']]),
    sw('Forrásjelölés a kérdéseknél (Redmenta-kulcs / saját megoldás)', 'showSourceBadge')));
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Kifejtős feladatok'),
    sw('Kifejtős feladatok bekapcsolva', 'essays'),
    sel('Pontozás', 'essayScoring', [['self', 'Beleszámít (kulcselemek kipipálása vagy kézi/AI-pont)'], ['exclude', 'Nem számít bele az eredménybe']]),
    h('p', { class: 'small muted' }, 'Kifejtős válasznál az „Ellenőrzés” megmutatja a mintaválaszt és a kulcselemeket. Pipáld ki, ami szerepel a válaszodban, vagy kérj AI-értékelést, és írd be (vagy töltsd vissza) a pontszámot.')));
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Vizsgaszimuláció'),
    num('Elméleti kérdések száma', 'examTheory', 5, 80), num('Ebből kifejtős', 'examEssays', 0, 10),
    num('Írásbeli időtartama', 'examWrittenMin', 10, 240, 'perc'), num('Projektfeladat időtartama', 'examProjectMin', 10, 300, 'perc'),
    num('Írásbeli súlya', 'weightWritten', 0, 100, '%'), num('Projektfeladat súlya', 'weightProject', 0, 100, '%'),
    num('Sikeresség küszöbe részenként', 'passPct', 0, 100, '%'),
    h('p', { class: 'small muted' }, 'Az alapértékek a 10415006-os programkövetelmény vizsgaleírásán alapulnak (írásbeli 60 perc / 30%, projektfeladat 120 perc / 70%, részenként legalább 50%). Ha a vizsgán mást mondanak, itt átírhatod.'),
    h('button', { class: 'btn sm', onclick: () => { ['examTheory', 'examEssays', 'examWrittenMin', 'examProjectMin', 'weightWritten', 'weightProject', 'passPct'].forEach((k) => { settings[k] = DEFAULT_SETTINGS[k]; }); saveSettings(); render(); } }, 'Alapértékek visszaállítása')));
  const fileIn = h('input', { type: 'file', accept: '.json', class: 'hide' });
  fileIn.addEventListener('change', async () => { try { importAll(await fileIn.files[0].text()); S = loadSession(); applyTheme(); toast('Mentés visszatöltve'); render(); } catch (e) { toast('Hiba: ' + e.message); } });
  wrap.appendChild(h('div', { class: 'card card-pad' }, h('h3', null, 'Adatok'),
    h('p', { class: 'small muted' }, 'Minden adat csak ebben a böngészőben tárolódik. Másik eszközre a mentésfájllal viheted át.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => download(`logisztikus-mentes-${new Date().toISOString().slice(0, 10)}.json`, exportAll()) }, 'Mentés letöltése'),
      h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Mentés betöltése'), fileIn,
      h('button', { class: 'btn ghost', onclick: () => { if (confirm('Biztosan törlöd a statisztikát?')) { resetStats(); toast('Statisztika törölve'); } } }, 'Statisztika törlése'),
      S ? h('button', { class: 'btn ghost', onclick: () => { if (confirm('Elveted az aktuális gyakorlást?')) { S = null; clearSession(); render(); } } }, 'Aktuális gyakorlás elvetése') : null)));
  wrap.appendChild(h('p', { class: 'tiny muted' }, `Kérdésbank: ${BANK.length} kérdés (${BANK.filter((q) => q.source === 'redmenta').length} Redmenta-kulccsal ellenőrzött). Gyakorlati generátorok: ${GENERATORS.map((g) => g.meta.title).join(', ')}.`));
  return wrap;
}

// ---------------- Útválasztás ----------------
function render() {
  document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
  clear(app);
  const route = location.hash.replace(/^#\/?/, '').split('/')[0] || '';
  if (route !== 'session') clearInterval(timerInt);
  app.appendChild(header());
  const main = h('main');
  const views = { '': viewHome, session: viewSession, results: viewResults, stats: viewStats, settings: viewSettings };
  main.appendChild((views[route] || viewHome)());
  app.appendChild(main);
  app.appendChild(h('footer', { class: 'footer' }, 'Gyakorló alkalmazás a logisztikus (10415006) állami vizsgához · nem hivatalos'));
}

window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

(async function init() {
  applyTheme();
  try { await loadBank(); } catch (e) { app.textContent = 'Nem sikerült betölteni a kérdésbankot: ' + e.message; return; }
  if (S && S.items.some((it) => it.k === 't' && !BANK_BY_ID[it.id])) { S = null; clearSession(); }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}());

// Hibakereséshez / teszteléshez
window.__lg = { get S() { return S; }, saveStats };
