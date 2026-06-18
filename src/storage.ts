import type { AppData } from "./types";

const DB_NAME = "kapital-finance";
const STORE = "documents";
const KEY = "app-data";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readData(): Promise<AppData> {
  const db = await openDb();
  const stored = await new Promise<AppData | null>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(KEY);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
  if (stored) {
    const changed = applyKnownBalances(stored);
    if (changed) await writeData(stored);
    return stored;
  }
  const response = await fetch("/data/app-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Не удалось загрузить данные приложения");
  const data = (await response.json()) as AppData;
  applyKnownBalances(data);
  await writeData(data);
  return data;
}

function applyKnownBalances(data: AppData) {
  const balances: Record<string, number> = {
    Наличные: 0,
    "Плати по миру": 2.38,
    Райфайзенбанк: 2801.44,
  };
  let changed = false;
  for (const account of data.accounts) {
    if (
      account.currentBalance === undefined &&
      balances[account.name] !== undefined
    ) {
      account.currentBalance = balances[account.name];
      changed = true;
    }
  }
  return changed;
}

export async function writeData(data: AppData) {
  const db = await openDb();
  data.updatedAt = new Date().toISOString();
  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put({ id: KEY, value: data });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function resetData() {
  const response = await fetch("/data/app-data.json", { cache: "no-store" });
  const data = (await response.json()) as AppData;
  await writeData(data);
  return data;
}
