// Keep large review files out of synchronous localStorage. No server, config file, or API key is involved.
let databasePromise;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('review.storageFailed'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('icedata-video-review', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); databasePromise = undefined; };
        resolve(database);
      };
      request.onerror = () => { databasePromise = undefined; reject(new Error('review.storageFailed')); };
      request.onblocked = () => { databasePromise = undefined; reject(new Error('review.storageFailed')); };
    });
  }
  return databasePromise;
}

async function draftTransaction(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', mode);
    const request = action(transaction.objectStore('drafts'));
    transaction.oncomplete = () => resolve(request.result ?? null);
    transaction.onerror = transaction.onabort = () => reject(new Error('review.storageFailed'));
  });
}

export const readReviewDraft = () => draftTransaction('readonly', store => store.get('current'));
export const saveReviewDraft = draft => draftTransaction('readwrite', store => store.put(draft, 'current'));
