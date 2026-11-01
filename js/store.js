// Böngészőben tárolt beállítások, statisztika és az aktuális munkamenet.
const P = 'lg1:';

function read(key, def) {
  try { const v = localStorage.getItem(P + key); return v === null ? def : JSON.parse(v); } catch { return def; }
}
function write(key, val) {
  try { localStorage.setItem(P + key, JSON.stringify(val)); return true; } catch { return false; }
}

export const DEFAULT_SETTINGS = {
  theme: 'system',          // system | light | dark
  essays: true,             // kifejtős feladatok be/ki
  essayScoring: 'self',     // self = kulcselemek kipipálása | exclude = kihagyás a pontozásból
  theoryCount: 20,
  mixedTheory: 12,
  mixedPractice: 3,
  examTheory: 25,
  examEssays: 3,
  examWrittenMin: 60,
  examProjectMin: 120,
  weightWritten: 30,
  weightProject: 70,
  passPct: 50,
  showSourceBadge: true,
};

export const settings = { ...DEFAULT_SETTINGS, ...read('settings', {}) };
export function saveSettings() { write('settings', settings); }

// Statisztika kérdésenként: {seen, sum (0..1 arányok összege), last}
export const stats = read('stats', { q: {}, history: [] });
export function saveStats() { write('stats', stats); }
export function recordQuestion(id, ratio) {
  const s = stats.q[id] || (stats.q[id] = { seen: 0, sum: 0, last: 0 });
  s.seen += 1; s.sum += ratio; s.last = ratio;
}
export function recordSession(entry) {
  stats.history.unshift(entry);
  stats.history = stats.history.slice(0, 100);
  saveStats();
}
export function resetStats() { stats.q = {}; stats.history = []; saveStats(); }

export function loadSession() { return read('session', null); }
export function saveSession(s) { write('session', s); }
export function clearSession() { try { localStorage.removeItem(P + 'session'); } catch { /* nincs tárhely */ } }

export function exportAll() {
  return JSON.stringify({ format: 'logisztikus-gyakorlo/backup@1', date: new Date().toISOString(), settings, stats, session: loadSession() }, null, 2);
}
export function importAll(text) {
  const d = JSON.parse(text);
  if (d.format !== 'logisztikus-gyakorlo/backup@1') throw new Error('Ismeretlen fájlformátum');
  Object.assign(settings, d.settings || {}); saveSettings();
  stats.q = d.stats?.q || {}; stats.history = d.stats?.history || []; saveStats();
  if (d.session) saveSession(d.session);
}

export function applyTheme() {
  const t = settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#262624' : '#faf9f5');
}
