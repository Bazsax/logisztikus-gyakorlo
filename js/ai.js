// AI-promptok összeállítása és az AI által visszaadott válaszfájl betöltése.
import { BANK_BY_ID, practiceOf } from './session.js';
import { aiText, aiFormat, parseAi, scoreTheory, TYPE_LABEL } from './theory.js';
import { practiceAiText, fieldLabels } from './practiceView.js';
import { checkField } from './practice/common.js';
import { settings } from './store.js';

export const FORMAT = 'logisztikus-gyakorlo/ai-answers@1';

const INTRO = 'Logisztikus szakképesítés (programkövetelmény: 10415006) állami vizsgájára készülök, magyar nyelvű tananyagból.';

function itemTitle(s, i) {
  const it = s.items[i];
  if (it.k === 't') { const q = BANK_BY_ID[it.id]; return `${i + 1}. feladat – ${TYPE_LABEL[q.type]} (${q.topic})`; }
  const t = practiceOf(it);
  return `${i + 1}. feladat – Gyakorlati: ${t.title} (${t.points} pont)`;
}

function itemBody(s, i, { withFields }) {
  const it = s.items[i];
  if (it.k === 't') return aiText(BANK_BY_ID[it.id], it.view);
  const t = practiceOf(it);
  let txt = `${t.title}\n${practiceAiText(t)}`;
  if (withFields) txt += '\n\nKitöltendő mezők (azonosító – jelentés):\n' + fieldLabels(t).map((x) => `  ${x.fid} – ${x.label}`).join('\n');
  else txt += '\n\nKitöltendő:\n' + [...new Set(t.parts.map((p) => (p.title ? `- ${p.title}: ` : '- ') + p.rows.map((r) => r.label).filter(Boolean).join(', ')))].join('\n');
  return txt;
}

function userAnswerText(s, i) {
  const it = s.items[i];
  const a = s.ans[i];
  if (it.k === 't') {
    const q = BANK_BY_ID[it.id];
    if (q.type === 'essay') return a?.text?.trim() ? a.text.trim() : null;
    return null;
  }
  const t = practiceOf(it);
  const filled = fieldLabels(t).filter((x) => a?.[x.fid]);
  return filled.length ? filled.map((x) => `${x.label}: ${a[x.fid]}`).join('\n') : null;
}

/** 1) Segítő prompt: lépésről lépésre magyarázat. */
export function helpPrompt(s, idxs) {
  const parts = idxs.map((i) => {
    const ua = userAnswerText(s, i);
    return `### ${itemTitle(s, i)}\n${itemBody(s, i, { withFields: false })}${ua ? `\n\nAz én eddigi válaszom:\n${ua}` : ''}`;
  });
  return `${INTRO}
Segíts megérteni és megoldani az alábbi ${idxs.length > 1 ? `${idxs.length} feladatot` : 'feladatot'}!
- Magyarázd el a gondolatmenetet lépésről lépésre, a használt képletekkel és fogalmakkal.
- A feladatban megadott kerekítési szabályokat kövesd.
- Ha megadtam a saját válaszomat, mondd meg, hol hibáztam és miért.
- Ha egy kérdésnek több elfogadott tankönyvi értelmezése van, jelezd.

${parts.join('\n\n')}`;
}

/** 2) Megoldó prompt: az AI betölthető JSON-fájlt ad vissza. */
export function solvePrompt(s, idxs) {
  const answers = {};
  const parts = idxs.map((i) => {
    const it = s.items[i];
    let fmtDesc;
    if (it.k === 't') {
      const q = BANK_BY_ID[it.id];
      const f = aiFormat(q, it.view);
      fmtDesc = f.desc;
      answers[i + 1] = f.tpl;
    } else {
      const t = practiceOf(it);
      fmtDesc = 'objektum: minden mezőazonosítóhoz egy szám (vagy a megadott választható szöveg); az üresen hagyandó cellák értéke null';
      answers[i + 1] = Object.fromEntries(fieldLabels(t).map((x) => [x.fid, null]));
    }
    return `### ${itemTitle(s, i)}\n${itemBody(s, i, { withFields: true })}\n→ Válasz formátuma a fájlban: ${fmtDesc}`;
  });
  // Tömör sablon: a feladatonkénti válasz egy sorban, hogy a prompt rövid maradjon
  const template = `{\n "format": "${FORMAT}",\n "session": "${s.id}",\n "answers": {\n${Object.entries(answers).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`).join(',\n')}\n }\n}`;
  return `${INTRO}
Oldd meg az alábbi feladatokat, majd add vissza a megoldásokat EGY letölthető .json fájlban (fájlnév: logisztikus-ai-valaszok.json). Ha nem tudsz fájlt létrehozni, akkor egyetlen \`\`\`json kódblokkban add meg a fájl teljes tartalmát.

Szabályok:
- Pontosan az alábbi sablon szerkezetét töltsd ki: a "format" és a "session" mezőt ne módosítsd, az "answers" kulcsai a feladatok sorszámai.
- Választós feladatoknál a megadott betűjeleket / sorszámokat használd (a felsorolás sorrendje számít).
- Számoknál JSON-számot adj meg tizedesponttal (pl. 94.5), ezres elválasztó és mértékegység nélkül; a feladatban megadott kerekítést kövesd.
- A táblázatok azon celláinál, amelyek a megoldásban üresek maradnak, null szerepeljen.
- A JSON-fájlon kívül röviden, feladatonként egy-két mondatban indokolhatod a megoldást.

${parts.join('\n\n')}

Kitöltendő sablon:
\`\`\`json
${template}
\`\`\``;
}

/** 3) Kifejtős válaszok ellenőrzése AI-val (pontszám visszatöltéssel). */
export function essayPrompt(s, idxs) {
  const answers = {};
  const parts = idxs.map((i) => {
    const q = BANK_BY_ID[s.items[i].id];
    answers[i + 1] = { score: null, max: q.keyPoints.length, feedback: null };
    return `### ${i + 1}. kérdés: ${q.prompt}
Értékelési szempontok (kulcselemenként 1 pont, összesen ${q.keyPoints.length}):
${q.keyPoints.map((k, n) => `  ${n + 1}. ${k}`).join('\n')}
Az én válaszom:
"""
${s.ans[i]?.text?.trim() || '(nem válaszoltam)'}
"""`;
  });
  return `${INTRO}
Az állami vizsgán kifejtős (definíciós) kérdések is lesznek. Értékeld szigorúan, de igazságosan az alábbi válaszaimat a megadott szempontok szerint! Egy kulcselem akkor ér pontot, ha tartalmilag szerepel (nem kell szó szerint egyeznie); részpont (0,5) adható. Feladatonként írd le röviden, mi hiányzott, és adj egy javított, vizsgán elfogadható mintaválaszt.

${parts.join('\n\n')}

A végén add vissza a pontszámokat egy letölthető .json fájlban (vagy ha nem megy, egy \`\`\`json kódblokkban) pontosan ebben a szerkezetben:
\`\`\`json
${JSON.stringify({ format: FORMAT, session: s.id, answers }, null, 1)}
\`\`\``;
}

/** Szöveg (vagy fájltartalom) feldolgozása → s.ai feltöltése. */
export function importAi(s, text) {
  let src = String(text).trim();
  const fence = src.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) src = fence[1];
  const a = src.indexOf('{'); const b = src.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Nem találok JSON-objektumot a szövegben.');
  let data;
  try { data = JSON.parse(src.slice(a, b + 1)); } catch (e) { throw new Error('Hibás JSON: ' + e.message); }
  if (data.format !== FORMAT) throw new Error('Ismeretlen formátum (a "format" mező nem egyezik).');
  if (data.session && data.session !== s.id) throw new Error(`Ez a fájl egy másik munkamenethez készült (${data.session}). Az aktuális: ${s.id}.`);
  const errors = []; let ok = 0;
  for (const [key, raw] of Object.entries(data.answers || {})) {
    const i = Number(key) - 1;
    const it = s.items[i];
    if (!it) { errors.push(`${key}: nincs ilyen feladat`); continue; }
    if (raw === null || raw === undefined) continue;
    try {
      if (it.k === 't') {
        const q = BANK_BY_ID[it.id];
        const parsed = parseAi(q, it.view, raw);
        s.ai[i] = parsed;
        if (q.type === 'essay' && parsed.score !== null && parsed.score !== undefined && s.ans[i]) {
          s.ans[i] = { ...s.ans[i], aiScore: Math.min(q.keyPoints.length, Number(parsed.score) || 0) };
          s.revealed[i] = true;
        }
      } else {
        const t = practiceOf(it);
        const vals = {};
        for (const [fid, v] of Object.entries(raw)) if (t.fields[fid] && v !== null && v !== '') vals[fid] = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
        s.ai[i] = vals;
      }
      ok++;
    } catch (e) { errors.push(`${key}. feladat: ${e.message}`); }
  }
  return { ok, errors };
}

/** Egyezik-e az AI válasza a beépített megoldással? */
export function aiAgreement(s, i) {
  const it = s.items[i];
  const ai = s.ai[i];
  if (ai === undefined || ai === null) return null;
  if (it.k === 't') {
    const q = BANK_BY_ID[it.id];
    if (q.type === 'essay') return null;
    const r = scoreTheory(q, ai, settings);
    return { match: r.got === r.max, detail: `${r.got}/${r.max}` };
  }
  const t = practiceOf(it);
  const fids = Object.keys(t.fields).filter((f) => t.fields[f].expect !== null);
  const okN = fids.filter((f) => checkField(t.fields[f], ai[f]) === 'ok').length;
  return { match: okN === fids.length, detail: `${okN}/${fids.length} mező egyezik` };
}
