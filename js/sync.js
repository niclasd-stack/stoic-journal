// Synchronisation mit Supabase: erst holen (pull), dann senden (push).
// Konflikte: der Datensatz mit dem neueren updated_at gewinnt (last-write-wins).
import * as db from './db.js';

const PAGE = 1000;

// Beschreibung der beiden Tabellen: Reflexionen (entries) und freie Gedanken (notes).
const TABLES = {
  entries: {
    columns: 'entry_date, kind, answers, mood, updated_at, server_updated_at',
    conflict: 'user_id,entry_date,kind',
    cursor: 'lastPull',
    getLocal: row => db.getEntry(row.entry_date, row.kind),
    fromRow: row => ({ entry_date: row.entry_date, kind: row.kind, answers: row.answers || {}, mood: row.mood ?? null, updated_at: row.updated_at }),
    put: db.putEntry,
    dirty: db.dirtyEntries,
    toRow: (e, userId) => ({ user_id: userId, entry_date: e.entry_date, kind: e.kind, answers: e.answers || {}, mood: e.mood ?? null, updated_at: e.updated_at }),
  },
  notes: {
    columns: 'id, entry_date, created_at, body, deleted, updated_at, server_updated_at',
    conflict: 'id',
    cursor: 'lastPullNotes',
    getLocal: row => db.getNote(row.id),
    fromRow: row => ({ id: row.id, entry_date: row.entry_date, created_at: row.created_at, body: row.body ?? '', deleted: !!row.deleted, updated_at: row.updated_at }),
    put: db.putNote,
    dirty: db.dirtyNotes,
    toRow: (n, userId) => ({ id: n.id, user_id: userId, entry_date: n.entry_date, created_at: n.created_at, body: n.body ?? '', deleted: !!n.deleted, updated_at: n.updated_at }),
  },
};

export class Sync {
  constructor(client, userId, { onStatus = () => {}, onRemoteChange = () => {} } = {}) {
    this.client = client;
    this.userId = userId;
    this.onStatus = onStatus;
    this.onRemoteChange = onRemoteChange;
    this.timer = null;
    this.running = false;
    this.again = false;
  }

  schedule(ms = 2000) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), ms);
  }

  async run() {
    if (this.running) { this.again = true; return; }
    if (!navigator.onLine) { this.onStatus('offline'); return; }
    this.running = true;
    this.onStatus('syncing');
    const changed = { entries: new Set(), notes: false };
    let failed = false;
    // Jede Tabelle für sich, damit ein Fehler bei einer die andere nicht blockiert.
    for (const name of Object.keys(TABLES)) {
      try {
        const dates = await this.pull(name);
        if (name === 'entries') changed.entries = dates;
        else if (dates.size) changed.notes = true;
        await this.push(name);
      } catch (err) {
        failed = true;
        console.warn(`Sync (${name}) fehlgeschlagen`, err);
      }
    }
    try {
      if (!failed) await db.setMeta('lastSync', new Date().toISOString());
      const pending = (await db.dirtyEntries()).length + (await db.dirtyNotes()).length;
      this.onStatus(failed ? (navigator.onLine ? 'error' : 'offline') : pending ? 'pending' : 'synced');
      if (changed.entries.size || changed.notes) this.onRemoteChange(changed);
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.schedule(300); }
    }
  }

  async pull(name) {
    const t = TABLES[name];
    const changed = new Set();
    let last = await db.getMeta(t.cursor);
    for (;;) {
      let q = this.client.from(name).select(t.columns).order('server_updated_at', { ascending: true }).limit(PAGE);
      if (last) q = q.gt('server_updated_at', last);
      const { data, error } = await q;
      if (error) throw error;
      for (const row of data) {
        const local = await t.getLocal(row);
        if (!local || Date.parse(row.updated_at) > Date.parse(local.updated_at)) {
          await t.put({ ...t.fromRow(row), dirty: false });
          changed.add(row.entry_date);
        }
      }
      if (data.length) {
        last = data[data.length - 1].server_updated_at;
        await db.setMeta(t.cursor, last);
      }
      if (data.length < PAGE) break;
    }
    return changed;
  }

  async push(name) {
    const t = TABLES[name];
    const dirty = await t.dirty();
    if (!dirty.length) return;
    const rows = dirty.map(x => t.toRow(x, this.userId));
    const { error } = await this.client.from(name).upsert(rows, { onConflict: t.conflict });
    if (error) throw error;
    // Nur als sauber markieren, wenn seitdem nicht weiter geändert wurde.
    for (const x of dirty) {
      const cur = await t.getLocal(x);
      if (cur && cur.updated_at === x.updated_at) await t.put({ ...cur, dirty: false });
    }
  }
}
