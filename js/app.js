import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as db from './db.js';
import * as auth from './auth.js';
import { Sync } from './sync.js';
import { quoteForDate } from './quotes.js';
import { computeStats, todayStr, addDays, parseYmd, hasContent } from './stats.js';

const LOCAL_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const MORNING = [
  { id: 'control', label: 'Was liegt heute in meiner Macht – und was nicht?' },
  { id: 'obstacle', label: 'Welche Schwierigkeit könnte heute kommen?', hint: 'Und wie will ich ihr begegnen? (praemeditatio malorum)' },
  { id: 'virtue', type: 'chips', label: 'Welche Tugend will ich heute üben?', options: ['Weisheit', 'Gerechtigkeit', 'Tapferkeit', 'Mäßigung'] },
  { id: 'intention', label: 'Mein Vorsatz für heute' },
];
const EVENING = [
  { id: 'good', label: 'Was ist mir heute gut gelungen?' },
  { id: 'fell_short', label: 'Wo bin ich hinter meinen Grundsätzen zurückgeblieben?' },
  { id: 'better', label: 'Was mache ich morgen besser?' },
  { id: 'mood', type: 'mood', label: 'Wie gefasst war ich heute?', hint: '1 = aufgewühlt · 5 = gelassen' },
];
const FIELDS = { morning: MORNING, evening: EVENING };

const $view = document.getElementById('view');
const $tabs = document.getElementById('tabs');
const $sync = document.getElementById('sync-status');

const state = { client: null, user: null, sync: null, date: null, status: '' };
const saveTimers = {};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const currentDate = () => state.date || todayStr();

// ---------- Sync-Status ----------
const STATUS_TEXT = {
  synced: 'Synchronisiert', pending: 'Ausstehend', syncing: 'Synchronisiere …',
  offline: 'Offline', error: 'Sync-Fehler', local: 'Nur lokal',
};
function setStatus(s) {
  state.status = s;
  $sync.dataset.state = s;
  $sync.textContent = STATUS_TEXT[s] || '';
}
$sync.addEventListener('click', () => state.sync?.run());

// ---------- Start ----------
async function boot() {
  registerServiceWorker();
  if (LOCAL_MODE) {
    setStatus('local');
    return startApp();
  }
  state.client = auth.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!state.client) {
    // Supabase-Bibliothek nicht geladen (z. B. erster Start offline)
    const lastUser = await db.getMeta('userId');
    if (lastUser) { state.user = { id: lastUser, email: await db.getMeta('email') }; setStatus('offline'); return startApp(); }
    $view.innerHTML = `<div class="auth"><h1>Stoisches Journal</h1><p class="sub">Für den ersten Start wird eine Internetverbindung gebraucht.</p></div>`;
    return;
  }
  state.client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { state.user = null; renderLogin(); }
  });
  let user = null;
  try { user = await auth.currentUser(state.client); } catch { /* offline */ }
  if (!user && !navigator.onLine) {
    const lastUser = await db.getMeta('userId');
    if (lastUser) user = { id: lastUser, email: await db.getMeta('email') };
  }
  if (user) await onSignedIn(user);
  else renderLogin();
}

async function onSignedIn(user) {
  const previous = await db.getMeta('userId');
  if (previous && previous !== user.id) await db.clearAll(); // anderes Konto → lokale Daten verwerfen
  await db.setMeta('userId', user.id);
  if (user.email) await db.setMeta('email', user.email);
  state.user = user;
  state.sync = new Sync(state.client, user.id, {
    onStatus: setStatus,
    onRemoteChange: dates => {
      const route = location.hash.slice(1) || 'heute';
      const typing = document.activeElement?.tagName === 'TEXTAREA';
      if (route === 'heute' && dates.has(currentDate()) && !typing) renderToday();
      else if (route === 'statistik') renderStats();
    },
  });
  startApp();
  state.sync.run();
  window.addEventListener('online', () => state.sync.run());
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') state.sync.run();
  });
}

function startApp() {
  $tabs.hidden = false;
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    // Nach Mitternacht automatisch auf den neuen Tag springen
    if (document.visibilityState === 'visible' && !state.date && (location.hash || '#heute') === '#heute'
        && state.renderedDate !== todayStr()) renderToday();
  });
  if (!location.hash) history.replaceState(null, '', '#heute');
  route();
}

function route() {
  flushSaves();
  const r = location.hash.slice(1) || 'heute';
  for (const a of $tabs.querySelectorAll('a')) {
    if (a.dataset.tab === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (r === 'statistik') renderStats();
  else if (r === 'einstellungen') renderSettings();
  else renderToday();
  window.scrollTo(0, 0);
}

// ---------- Login ----------
function renderLogin() {
  $tabs.hidden = true;
  $sync.textContent = '';
  $view.innerHTML = `
    <div class="auth">
      <h1>Stoisches Journal</h1>
      <p class="sub">Morgens vorbereiten, abends prüfen.</p>
      <form id="login" novalidate>
        <input type="email" name="email" placeholder="E-Mail" autocomplete="email" required>
        <input type="password" name="password" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" required minlength="6">
        <p class="msg" id="msg"></p>
        <div class="btn-row">
          <button class="btn" type="submit" data-action="in">Anmelden</button>
          <button class="btn ghost" type="submit" data-action="up">Konto erstellen</button>
        </div>
      </form>
    </div>`;
  const form = document.getElementById('login');
  const msg = document.getElementById('msg');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const action = ev.submitter?.dataset.action || 'in';
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || password.length < 6) { msg.className = 'msg err'; msg.textContent = 'Bitte E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben.'; return; }
    for (const b of form.querySelectorAll('button')) b.disabled = true;
    msg.className = 'msg'; msg.textContent = 'Einen Moment …';
    try {
      if (action === 'up') {
        const { user, session } = await auth.signUp(state.client, email, password);
        if (!session) { msg.className = 'msg ok'; msg.textContent = 'Fast geschafft: Bestätige deine E-Mail über den Link im Postfach und melde dich dann an.'; return; }
        await onSignedIn(user);
      } else {
        await onSignedIn(await auth.signIn(state.client, email, password));
      }
    } catch (err) {
      msg.className = 'msg err'; msg.textContent = auth.translateError(err);
    } finally {
      for (const b of form.querySelectorAll('button')) b.disabled = false;
    }
  });
}

// ---------- Heute ----------
const fmtLong = s => parseYmd(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
function relLabel(s) {
  const t = todayStr();
  if (s === t) return 'Heute';
  if (s === addDays(t, -1)) return 'Gestern';
  const days = Math.round((parseYmd(t) - parseYmd(s)) / 86400000);
  return `vor ${days} Tagen`;
}

function fieldHtml(kind, f) {
  const id = `${kind}-${f.id}`;
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  if (f.type === 'chips') {
    return `<div class="field"><span class="label">${esc(f.label)}${hint}</span>
      <div class="chips" data-field="${f.id}">${f.options.map(o => `<button type="button" class="chip" data-value="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</div></div>`;
  }
  if (f.type === 'mood') {
    return `<div class="field"><span class="label">${esc(f.label)}${hint}</span>
      <div class="chips mood" data-field="mood">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="chip" data-value="${n}" aria-pressed="false">${n}</button>`).join('')}</div></div>`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}${hint}</label><textarea id="${id}" data-field="${f.id}" rows="3"></textarea></div>`;
}

function cardHtml(kind, entry, open) {
  const title = kind === 'morning' ? ['Morgen', 'Vorbereitung auf den Tag'] : ['Abend', 'Rückschau auf den Tag'];
  return `
    <details class="card" data-kind="${kind}" ${open ? 'open' : ''}>
      <summary>
        <div class="titles"><span class="kicker">${title[0]}</span><h2>${title[1]}</h2></div>
        <span class="done ${hasContent(entry) ? 'on' : ''}" aria-label="${hasContent(entry) ? 'erledigt' : 'offen'}">✓</span>
      </summary>
      <div class="card-body">${FIELDS[kind].map(f => fieldHtml(kind, f)).join('')}</div>
    </details>`;
}

async function renderToday() {
  flushSaves();
  const date = currentDate();
  state.renderedDate = date;
  const today = todayStr();
  const [m, e] = await Promise.all([db.getEntry(date, 'morning'), db.getEntry(date, 'evening')]);
  const q = quoteForDate(date);
  const eveningFirst = date !== today || new Date().getHours() >= 16;
  $view.innerHTML = `
    <section class="daynav">
      <button class="icon-btn" id="prev" aria-label="Vorheriger Tag">‹</button>
      <div><h1>${esc(fmtLong(date))}</h1><p class="sub">${esc(relLabel(date))}</p></div>
      <button class="icon-btn" id="next" aria-label="Nächster Tag" ${date >= today ? 'disabled' : ''}>›</button>
    </section>
    <figure class="quote">
      <blockquote>${esc(q.text)}</blockquote>
      <figcaption>— ${esc(q.author)}, <cite>${esc(q.source)}</cite></figcaption>
    </figure>
    ${cardHtml('morning', m, !eveningFirst)}
    ${cardHtml('evening', e, eveningFirst)}`;

  fill('morning', m);
  fill('evening', e);

  document.getElementById('prev').onclick = () => { state.date = addDays(date, -1); renderToday(); };
  document.getElementById('next').onclick = () => {
    const n = addDays(date, 1);
    state.date = n >= today ? null : n;
    renderToday();
  };

  for (const card of $view.querySelectorAll('.card')) {
    const kind = card.dataset.kind;
    card.addEventListener('input', () => queueSave(date, kind, card));
    card.addEventListener('click', ev => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      const group = chip.parentElement;
      const wasOn = chip.getAttribute('aria-pressed') === 'true';
      for (const c of group.children) c.setAttribute('aria-pressed', 'false');
      if (!wasOn) chip.setAttribute('aria-pressed', 'true');
      queueSave(date, kind, card, 0);
    });
  }
}

function fill(kind, entry) {
  const card = $view.querySelector(`.card[data-kind="${kind}"]`);
  const answers = entry?.answers || {};
  for (const t of card.querySelectorAll('textarea[data-field]')) t.value = answers[t.dataset.field] || '';
  for (const group of card.querySelectorAll('.chips[data-field]')) {
    const val = group.dataset.field === 'mood' ? entry?.mood : answers[group.dataset.field];
    for (const c of group.children) c.setAttribute('aria-pressed', String(val != null && String(val) === c.dataset.value));
  }
}

function collect(card) {
  const answers = {};
  let mood = null;
  for (const t of card.querySelectorAll('textarea[data-field]')) answers[t.dataset.field] = t.value;
  for (const group of card.querySelectorAll('.chips[data-field]')) {
    const on = group.querySelector('[aria-pressed="true"]');
    if (group.dataset.field === 'mood') mood = on ? Number(on.dataset.value) : null;
    else answers[group.dataset.field] = on ? on.dataset.value : '';
  }
  return { answers, mood };
}

// Die Eingaben werden sofort (synchron) aus der Karte gelesen, damit nichts verloren geht,
// auch wenn die Karte inzwischen ersetzt wurde oder Mitternacht vorbei ist.
function queueSave(date, kind, card, delay = 500) {
  const key = `${date}|${kind}`;
  clearTimeout(saveTimers[key]?.timer);
  if (state.status !== 'local') setStatus('pending');
  const job = () => { delete saveTimers[key]; return save(date, kind, collect(card), card); };
  saveTimers[key] = { job, timer: setTimeout(job, delay) };
}

function flushSaves() {
  const jobs = Object.values(saveTimers);
  for (const { job, timer } of jobs) { clearTimeout(timer); job(); }
}

async function save(date, kind, { answers, mood }, card) {
  const entry = { entry_date: date, kind, answers, mood, updated_at: new Date().toISOString(), dirty: true };
  await db.putEntry(entry);
  card.querySelector('.done')?.classList.toggle('on', hasContent(entry));
  state.sync?.schedule();
}

// Ungespeichertes beim Verlassen sofort sichern (pagehide ist auf Android unzuverlässig)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves(); });
window.addEventListener('pagehide', flushSaves);

// ---------- Statistik ----------
async function renderStats() {
  const s = computeStats(await db.allEntries());
  const pct = n => Math.round((n / 30) * 100);
  const heat = s.heat.map(h => `<span data-l="${h.level}" class="${h.future ? 'future' : ''}" title="${h.date}"></span>`).join('');
  $view.innerHTML = `
    <h1>Statistik</h1>
    <div class="tiles">
      <div class="tile"><div class="num">${s.current}</div><div class="lbl">Tage in Folge</div></div>
      <div class="tile"><div class="num">${s.longest}</div><div class="lbl">Längste Serie</div></div>
      <div class="tile"><div class="num">${s.total}</div><div class="lbl">Tage gesamt</div></div>
      <div class="tile"><div class="num">${pct(s.active30)}%</div><div class="lbl">Aktive Tage (30 T.)</div></div>
    </div>
    <section class="panel">
      <h2>Letzte 12 Wochen</h2>
      <div class="heat">${heat}</div>
      <div class="legend"><span><i style="background:var(--heat-0)"></i>nichts</span><span><i style="background:var(--heat-1)"></i>Morgen oder Abend</span><span><i style="background:var(--heat-2)"></i>beides</span></div>
    </section>
    <section class="panel">
      <h2>Letzte 30 Tage</h2>
      <div class="row"><span>Morgenreflexion</span><span>${s.morning30} / 30</span></div>
      <div class="bar"><i style="width:${pct(s.morning30)}%"></i></div>
      <div class="row"><span>Abendreflexion</span><span>${s.evening30} / 30</span></div>
      <div class="bar"><i style="width:${pct(s.evening30)}%"></i></div>
    </section>
    <section class="panel">
      <h2>Gefasstheit</h2>
      ${moodChart(s.moods)}
    </section>`;
}

function moodChart(moods) {
  const pts = moods.map((m, i) => ({ ...m, i })).filter(m => m.mood);
  if (pts.length < 2) return '<p class="empty">Bewerte am Abend, wie gefasst du warst – ab zwei Einträgen erscheint hier der Verlauf.</p>';
  const W = 320, H = 130, L = 18, R = 6, T = 8, B = 20;
  const x = i => L + (i / 29) * (W - L - R);
  const y = v => T + (5 - v) / 4 * (H - T - B);
  const grid = [1, 3, 5].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="2" y="${y(v) + 3}">${v}</text>`).join('');
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.mood).toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle class="pt" cx="${x(p.i).toFixed(1)}" cy="${y(p.mood).toFixed(1)}" r="3"><title>${p.date}: ${p.mood}</title></circle>`).join('');
  const lbl = d => parseYmd(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf der Gefasstheit über 30 Tage">
    ${grid}<path class="line" d="${path}"/>${dots}
    <text x="${L}" y="${H - 4}">${lbl(moods[0].date)}</text>
    <text x="${W - R}" y="${H - 4}" text-anchor="end">heute</text></svg>`;
}

// ---------- Konto / Einstellungen ----------
async function renderSettings() {
  const lastSync = await db.getMeta('lastSync');
  const pending = (await db.dirtyEntries()).length;
  const fmt = iso => iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
  $view.innerHTML = `
    <h1>Konto</h1>
    <section class="panel" style="margin-top:16px">
      ${LOCAL_MODE
        ? `<p class="note">Lokaler Modus: Supabase ist noch nicht eingerichtet (js/config.js). Einträge bleiben nur auf diesem Gerät.</p>`
        : `<div class="kv"><span>Angemeldet als</span><span>${esc(state.user?.email || '')}</span></div>
           <div class="kv"><span>Letzter Sync</span><span>${fmt(lastSync)}</span></div>
           <div class="kv"><span>Ausstehende Änderungen</span><span>${pending}</span></div>`}
    </section>
    <div class="btn-row">
      ${LOCAL_MODE ? '' : '<button class="btn" id="sync-now">Jetzt synchronisieren</button>'}
      <button class="btn ghost" id="export">Backup exportieren</button>
    </div>
    ${LOCAL_MODE ? '' : '<div class="btn-row" style="margin-top:10px"><button class="btn ghost" id="logout">Abmelden</button></div>'}
    <section class="panel" style="margin-top:18px">
      <h2>Als App installieren</h2>
      <p class="note">Android (Chrome): Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.<br>
      Computer (Chrome/Edge): Installieren-Symbol rechts in der Adressleiste.</p>
    </section>`;

  document.getElementById('export').onclick = async () => {
    const entries = (await db.allEntries()).map(({ key, dirty, ...e }) => e)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.kind.localeCompare(b.kind));
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stoisches-journal-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const syncBtn = document.getElementById('sync-now');
  if (syncBtn) syncBtn.onclick = async () => { await state.sync?.run(); renderSettings(); };
  const logout = document.getElementById('logout');
  if (logout) logout.onclick = async () => {
    if ((await db.dirtyEntries()).length && !confirm('Es gibt noch nicht synchronisierte Änderungen. Trotzdem abmelden? Sie gehen dann verloren.')) return;
    await db.clearAll();
    await auth.signOut(state.client);
    location.hash = '';
    location.reload();
  };
}

// ---------- Service Worker ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW-Registrierung fehlgeschlagen', err));
}

boot();
