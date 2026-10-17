// Review history in IndexedDB (results + reviewer decisions survive reloads).
// Video blobs are kept in memory only; after a reload the reviewer can
// re-attach the same file to replay it.
const DB = 'argus', STORE = 'jobs';
let dbp;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}
export const putJob = (job) => tx('readwrite', (s) => s.put(stripRuntime(job))).catch(() => {});
export const deleteJob = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
export const clearJobs = () => tx('readwrite', (s) => s.clear()).catch(() => {});
export const allJobs = () => tx('readonly', (s) => s.getAll()).catch(() => []);

function stripRuntime(job) {
  const { file, url, abort, logs, _nt, ...rest } = job;
  return rest;
}
