// Datumshilfen und Statistik. Gerechnet wird nur mit lokalen 'YYYY-MM-DD'-Strings, nie mit UTC.
const pad = n => String(n).padStart(2, '0');

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function hasContent(entry) {
  if (!entry) return false;
  if (entry.mood) return true;
  return Object.values(entry.answers || {}).some(v => String(v ?? '').trim() !== '');
}

export function computeStats(entries, today = todayStr()) {
  const byDate = new Map();
  for (const e of entries) {
    if (!hasContent(e)) continue;
    const day = byDate.get(e.entry_date) || { morning: false, evening: false, mood: null };
    day[e.kind] = true;
    if (e.kind === 'evening' && e.mood) day.mood = e.mood;
    byDate.set(e.entry_date, day);
  }

  // Aktueller Streak: zählt ab heute, oder ab gestern, wenn heute noch nichts geschrieben wurde.
  let cursor = byDate.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (byDate.has(cursor)) { current++; cursor = addDays(cursor, -1); }

  const dates = [...byDate.keys()].sort();
  let longest = 0, run = 0, prev = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // Quoten der letzten 30 Tage
  let morning30 = 0, evening30 = 0, active30 = 0;
  for (let i = 0; i < 30; i++) {
    const day = byDate.get(addDays(today, -i));
    if (day) active30++;
    if (day?.morning) morning30++;
    if (day?.evening) evening30++;
  }

  // Heatmap: 12 Wochen, Spalten = Wochen (Mo–So)
  const todayDate = parseYmd(today);
  const weekday = (todayDate.getDay() + 6) % 7; // Mo = 0
  const start = addDays(today, -(7 * 11 + weekday));
  const heat = [];
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i);
    const day = byDate.get(d);
    heat.push({ date: d, level: day ? (day.morning && day.evening ? 2 : 1) : 0, future: d > today });
  }

  const moods = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    moods.push({ date: d, mood: byDate.get(d)?.mood ?? null });
  }

  return { current, longest, total: byDate.size, morning30, evening30, active30, heat, moods };
}
