// Eszközök közötti szinkronizálás szinkronkóddal (lásd api/sync.js).
// Összefésülés: beállítások és munkamenet – a frissebb nyer; statisztika – egyesítés.
import { settings, stats, stampOf, stamp, onLocalChange, readRaw, writeRaw, loadSession } from './store.js';

const ALPHA = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const LOCAL_ONLY = ['theme']; // a téma eszközönként külön marad

export const syncState = () => readRaw('sync', { code: null, lastAt: 0, err: null });
const setState = (patch) => { const st = { ...syncState(), ...patch }; writeRaw('sync', st); emit(); return st; };

const subs = [];
export function onSyncState(fn) { subs.push(fn); }
function emit() { subs.forEach((fn) => { try { fn(syncState()); } catch { /* */ } }); }

export function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(20));
  const s = [...b].map((x) => ALPHA[x % ALPHA.length]).join('');
  return s.match(/.{5}/g).join('-');
}
export const normCode = (c) => {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 20 ? s.match(/.{5}/g).join('-') : null;
};

async function api(body) {
  const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: body.action === 'put' && JSON.stringify(body).length < 60000 });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = { 'not-configured': 'A szerveren még nincs beállítva az adatbázis (Upstash).', 'bad-code': 'Hibás szinkronkód.', 'too-large': 'Túl nagy az adatmennyiség.' }[j.error] || `Szerverhiba (${r.status}${j.detail ? ': ' + j.detail : ''})`;
    throw new Error(msg);
  }
  return j;
}

function localSnapshot() {
  const s = { ...settings }; LOCAL_ONLY.forEach((k) => delete s[k]);
  return {
    v: 1,
    settings: s, settingsAt: stampOf('settings'),
    stats: { q: stats.q, history: stats.history, resetAt: stats.resetAt || 0 }, statsAt: stampOf('stats'),
    session: loadSession(), sessionAt: stampOf('session'),
  };
}

export function mergeStats(a, b) {
  const resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
  const hist = new Map();
  for (const e of [...(a.history || []), ...(b.history || [])]) if ((e.date || 0) >= resetAt) hist.set(`${e.date}|${e.title}`, e);
  const history = [...hist.values()].sort((x, y) => y.date - x.date).slice(0, 100);
  const qa = (a.resetAt || 0) >= resetAt ? a.q || {} : {};
  const qb = (b.resetAt || 0) >= resetAt ? b.q || {} : {};
  const q = { ...qb };
  for (const [id, v] of Object.entries(qa)) if (!q[id] || v.seen >= q[id].seen) q[id] = v;
  return { q, history, resetAt };
}

/** Egyesíti a távoli adatot a helyivel; visszaadja, változott-e a helyi beállítás / munkamenet. */
function applyRemote(r) {
  const changed = { settings: false, session: false };
  if (!r) return changed;
  if ((r.settingsAt || 0) > stampOf('settings') && r.settings) {
    const keep = Object.fromEntries(LOCAL_ONLY.map((k) => [k, settings[k]]));
    Object.assign(settings, r.settings, keep);
    writeRaw('settings', settings); stamp('settings', r.settingsAt, true); changed.settings = true;
  }
  if ((r.sessionAt || 0) > stampOf('session')) {
    if (r.session) writeRaw('session', r.session); else { try { localStorage.removeItem('lg1:session'); } catch { /* */ } }
    stamp('session', r.sessionAt, true); changed.session = true;
  }
  if (r.stats) {
    const m = mergeStats(stats, r.stats);
    Object.assign(stats, m); writeRaw('stats', stats);
    stamp('stats', Math.max(stampOf('stats'), r.statsAt || 0), true);
  }
  return changed;
}

let busy = null; let again = false;
let onRemote = () => {};
export function onRemoteChange(fn) { onRemote = fn; }

/** Teljes szinkron: letöltés → összefésülés → feltöltés. */
export function syncNow() {
  const { code } = syncState();
  if (!code) return Promise.resolve(null);
  if (busy) { again = true; return busy; }
  busy = (async () => {
    try {
      const { data } = await api({ action: 'get', code });
      const changed = applyRemote(data);
      await api({ action: 'put', code, data: localSnapshot() });
      setState({ lastAt: Date.now(), err: null });
      if (changed.settings || changed.session) onRemote(changed);
      return changed;
    } catch (e) {
      setState({ err: navigator.onLine === false ? 'Nincs internetkapcsolat – később újra próbálom.' : e.message });
      throw e;
    } finally {
      busy = null;
      if (again) { again = false; setTimeout(() => syncNow().catch(() => {}), 500); }
    }
  })();
  return busy;
}

export async function connect(code) {
  setState({ code, lastAt: 0, err: null });
  try { return await syncNow(); } catch (e) { return Promise.reject(e); }
}
export function disconnect() { setState({ code: null, lastAt: 0, err: null }); }

// Automatikus szinkron: indításkor, visszatéréskor, és helyi módosítás után néhány másodperccel
let t;
export function startAutoSync() {
  onLocalChange(() => { if (!syncState().code) return; clearTimeout(t); t = setTimeout(() => syncNow().catch(() => {}), 4000); });
  document.addEventListener('visibilitychange', () => {
    if (!syncState().code) return;
    if (document.visibilityState === 'hidden') { clearTimeout(t); syncNow().catch(() => {}); } else syncNow().catch(() => {});
  });
  addEventListener('online', () => syncState().code && syncNow().catch(() => {}));
  if (syncState().code) syncNow().catch(() => {});
}
