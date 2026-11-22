// Lokaler Speicher (IndexedDB). Alles wird zuerst hier geschrieben, dann synchronisiert.
const DB_NAME = 'stoic-journal';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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

export const getEntry = (date, kind) => run('entries', 'readonly', s => s.get(keyOf(date, kind)));
export const putEntry = entry => run('entries', 'readwrite', s => s.put({ ...entry, key: keyOf(entry.entry_date, entry.kind) }));
export const allEntries = () => run('entries', 'readonly', s => s.getAll());
export const dirtyEntries = async () => (await allEntries()).filter(e => e.dirty);

export const getMeta = key => run('meta', 'readonly', s => s.get(key));
export const setMeta = (key, value) => run('meta', 'readwrite', s => s.put(value, key));

export async function clearAll() {
  await run('entries', 'readwrite', s => s.clear());
  await run('meta', 'readwrite', s => s.clear());
}
