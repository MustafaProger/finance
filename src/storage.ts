import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppData, Transaction } from "./types";

const DB_NAME = "kapital-finance";
const STORE = "documents";
const LEGACY_KEY = "app-data";

export type SyncState = "syncing" | "synced" | "offline" | "error";

type CloudData = Omit<AppData, "transactions">;

export function dataErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "permission-denied")
    return "Firestore запретил доступ. Опубликуйте правила безопасности.";
  if (code === "unavailable" || message.includes("client is offline"))
    return "Firestore недоступен. Проверьте, что база (default) создана в Firebase Console.";
  return message || "Не удалось загрузить данные";
}

function openLegacyDb(): Promise<IDBDatabase> {
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

async function readLegacyData(): Promise<AppData | null> {
  const database = await openLegacyDb();
  const stored = await new Promise<AppData | null>((resolve, reject) => {
    const request = database
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(LEGACY_KEY);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (stored) return stored;

  // Исходный JSON доступен только при локальной разработке и нужен для
  // однократного переноса старой версии. В production он не публикуется.
  if (import.meta.env.DEV) {
    const response = await fetch("/data/app-data.json", { cache: "no-store" });
    if (response.ok) return (await response.json()) as AppData;
  }
  return null;
}

function createEmptyData(name = "Пользователь"): AppData {
  const now = new Date().toISOString();
  return {
    version: 2,
    generatedAt: now,
    updatedAt: now,
    profile: { name, currency: "RUB", locale: "ru-RU" },
    accounts: [
      {
        id: `account-${crypto.randomUUID()}`,
        name: "Основной счёт",
        currency: "RUB",
        type: "card",
        color: "#3B82F6",
        openingBalance: 0,
        currentBalance: 0,
      },
    ],
    categories: [
      {
        id: "category-без-категории",
        name: "Без категории",
        type: "mixed",
        icon: "circle",
        color: "#718096",
      },
    ],
    transactions: [],
    budgets: [],
  };
}

function requireDb() {
  if (!db) throw new Error("Firebase не настроен");
  return db;
}

function appRef(userId: string) {
  return doc(requireDb(), "users", userId, "app", "data");
}

function transactionsRef(userId: string) {
  return collection(requireDb(), "users", userId, "transactions");
}

function transactionRef(userId: string, transactionId: string) {
  return doc(transactionsRef(userId), transactionId);
}

function cloudData(data: AppData): CloudData {
  const { transactions: _transactions, ...rest } = data;
  return rest;
}

function sameTransaction(left: Transaction, right: Transaction) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function commitInChunks(
  appDocument: DocumentReference<DocumentData>,
  metadata: CloudData,
  sets: { reference: DocumentReference; value: Transaction }[],
  deletes: DocumentReference[],
) {
  const operations = [
    ...sets.map((item) => ({ type: "set" as const, ...item })),
    ...deletes.map((reference) => ({ type: "delete" as const, reference })),
  ];

  if (!operations.length) {
    await setDoc(appDocument, metadata);
    return;
  }

  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(requireDb());
    if (offset === 0) batch.set(appDocument, metadata);
    for (const operation of operations.slice(offset, offset + 400)) {
      if (operation.type === "set")
        batch.set(operation.reference, operation.value);
      else batch.delete(operation.reference);
    }
    await batch.commit();
  }
}

export async function writeData(
  userId: string,
  nextData: AppData,
  previousData?: AppData | null,
) {
  nextData.updatedAt = new Date().toISOString();
  const previous = new Map(
    (previousData?.transactions || []).map((item) => [item.id, item]),
  );
  const nextIds = new Set(nextData.transactions.map((item) => item.id));
  const sets = nextData.transactions
    .filter((item) => {
      const old = previous.get(item.id);
      return !old || !sameTransaction(old, item);
    })
    .map((value) => ({
      reference: transactionRef(userId, value.id),
      value,
    }));
  const deletes = previousData
    ? previousData.transactions
        .filter((item) => !nextIds.has(item.id))
        .map((item) => transactionRef(userId, item.id))
    : [];

  await commitInChunks(appRef(userId), cloudData(nextData), sets, deletes);
}

export async function connectData(
  userId: string,
  userName: string,
  onData: (data: AppData) => void,
  onState: (state: SyncState) => void,
  onError: (error: Error) => void,
) {
  const metadataReference = appRef(userId);
  const initial = await getDoc(metadataReference);
  if (!initial.exists()) {
    const legacy = (await readLegacyData()) || createEmptyData(userName);
    await writeData(userId, legacy, null);
  }

  let metadata: CloudData | undefined;
  let transactions: Transaction[] | undefined;
  let metadataFromCache = true;
  let transactionsFromCache = true;
  let metadataPending = false;
  let transactionsPending = false;

  const updateState = () => {
    if (metadataPending || transactionsPending) onState("syncing");
    else if (metadataFromCache || transactionsFromCache) onState("offline");
    else onState("synced");
  };
  const emit = () => {
    if (!metadata || !transactions) return;
    onData({ ...metadata, transactions });
    updateState();
  };
  const fail = (error: Error) => {
    onState("error");
    onError(error);
  };

  const unsubscribeMetadata = onSnapshot(
    metadataReference,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists()) return;
      metadata = snapshot.data() as CloudData;
      metadataFromCache = snapshot.metadata.fromCache;
      metadataPending = snapshot.metadata.hasPendingWrites;
      emit();
    },
    fail,
  );
  const unsubscribeTransactions = onSnapshot(
    transactionsRef(userId),
    { includeMetadataChanges: true },
    (snapshot) => {
      transactions = snapshot.docs.map((item) => item.data() as Transaction);
      transactionsFromCache = snapshot.metadata.fromCache;
      transactionsPending = snapshot.metadata.hasPendingWrites;
      emit();
    },
    fail,
  );

  return () => {
    unsubscribeMetadata();
    unsubscribeTransactions();
  };
}

export async function resetData(name?: string) {
  if (import.meta.env.DEV) {
    const response = await fetch("/data/app-data.json", { cache: "no-store" });
    if (response.ok) return (await response.json()) as AppData;
  }
  return createEmptyData(name);
}
