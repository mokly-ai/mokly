import { validAccessToken, type AccessToken } from "./channel.js";

const STORE = "tokens";
const KEY = "current";
const DATABASE = "mokly-frame-access";
let opened: Promise<IDBDatabase> | undefined;

function openTokenDatabase(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    opened = undefined;
    throw error;
  });
  return opened;
}

export async function readToken(): Promise<AccessToken | undefined> {
  const database = await openTokenDatabase();
  const transaction = database.transaction(STORE, "readonly");
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => {
      const value: unknown = request.result;
      resolve(validAccessToken(value) ? value : undefined);
    };
    transaction.onabort = () => reject(transaction.error);
  });
}

async function updateToken(
  update: (current: unknown, store: IDBObjectStore) => void,
): Promise<void> {
  const database = await openTokenDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  return new Promise((resolve, reject) => {
    const request = store.get(KEY);
    request.onsuccess = () => update(request.result, store);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

export function storeToken(value: AccessToken): Promise<void> {
  return updateToken((current, store) => {
    if (!validAccessToken(current) || value.expiresAt > current.expiresAt)
      store.put({ token: value.token, expiresAt: value.expiresAt }, KEY);
  });
}

export function deleteTokenIfCurrent(token: string): Promise<void> {
  return updateToken((current, store) => {
    if (
      typeof current === "object" &&
      current !== null &&
      "token" in current &&
      current.token === token
    )
      store.delete(KEY);
  });
}
