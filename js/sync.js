// Synchronisation mit Supabase: erst holen (pull), dann senden (push).
// Konflikte: der Eintrag mit dem neueren updated_at gewinnt (last-write-wins).
import * as db from './db.js';

const PAGE = 1000;

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
    try {
      const changed = await this.pull();
      await this.push();
      await db.setMeta('lastSync', new Date().toISOString());
      const pending = (await db.dirtyEntries()).length;
      this.onStatus(pending ? 'pending' : 'synced');
      if (changed.size) this.onRemoteChange(changed);
    } catch (err) {
      console.warn('Sync fehlgeschlagen', err);
      this.onStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.schedule(300); }
    }
  }

  async pull() {
    const changed = new Set();
    let last = await db.getMeta('lastPull');
    for (;;) {
      let q = this.client
        .from('entries')
        .select('entry_date, kind, answers, mood, updated_at, server_updated_at')
        .order('server_updated_at', { ascending: true })
        .limit(PAGE);
      if (last) q = q.gt('server_updated_at', last);
      const { data, error } = await q;
      if (error) throw error;
      for (const row of data) {
        const local = await db.getEntry(row.entry_date, row.kind);
        if (!local || Date.parse(row.updated_at) > Date.parse(local.updated_at)) {
          await db.putEntry({
            entry_date: row.entry_date,
            kind: row.kind,
            answers: row.answers || {},
            mood: row.mood ?? null,
            updated_at: row.updated_at,
            dirty: false,
          });
          changed.add(row.entry_date);
        }
      }
      if (data.length) {
        last = data[data.length - 1].server_updated_at;
        await db.setMeta('lastPull', last);
      }
      if (data.length < PAGE) break;
    }
    return changed;
  }

  async push() {
    const dirty = await db.dirtyEntries();
    if (!dirty.length) return;
    const rows = dirty.map(e => ({
      user_id: this.userId,
      entry_date: e.entry_date,
      kind: e.kind,
      answers: e.answers || {},
      mood: e.mood ?? null,
      updated_at: e.updated_at,
    }));
    const { error } = await this.client.from('entries').upsert(rows, { onConflict: 'user_id,entry_date,kind' });
    if (error) throw error;
    // Nur als sauber markieren, wenn seitdem nicht weitergetippt wurde.
    for (const e of dirty) {
      const cur = await db.getEntry(e.entry_date, e.kind);
      if (cur && cur.updated_at === e.updated_at) await db.putEntry({ ...cur, dirty: false });
    }
  }
}
