// Lokaler Speicher (IndexedDB). Alles wird zuerst hier geschrieben, dann synchronisiert.
const DB_NAME = 'stoic-journal';
const DB_VERSION = 2;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Eine neuere Fassung der App (anderer Tab) will die Datenbank aktualisieren → Platz machen.
        db.onversionchange = () => { db.close(); dbPromise = null; location.reload(); };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      // Eine ältere Fassung der App ist noch offen und blockiert das Update.
      req.onblocked = () => window.dispatchEvent(new Event('db-blocked'));
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const keyOf = (date, kind) => `${date}|${kind}`;

// Morgen-/Abendreflexion
export const getEntry = (date, kind) => run('entries', 'readonly', s => s.get(keyOf(date, kind)));
export const putEntry = entry => run('entries', 'readwrite', s => s.put({ ...entry, key: keyOf(entry.entry_date, entry.kind) }));
export const allEntries = () => run('entries', 'readonly', s => s.getAll());
export const dirtyEntries = async () => (await allEntries()).filter(e => e.dirty);

// Freie Gedanken (beliebig viele pro Tag; gelöschte bleiben als deleted:true für den Sync)
export const getNote = id => run('notes', 'readonly', s => s.get(id));
export const putNote = note => run('notes', 'readwrite', s => s.put(note));
export const allNotes = () => run('notes', 'readonly', s => s.getAll());
export const dirtyNotes = async () => (await allNotes()).filter(n => n.dirty);

export const getMeta = key => run('meta', 'readonly', s => s.get(key));
export const setMeta = (key, value) => run('meta', 'readwrite', s => s.put(value, key));

export async function clearAll() {
  for (const store of ['entries', 'notes', 'meta']) await run(store, 'readwrite', s => s.clear());
}
