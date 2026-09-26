import type { LocalRecord } from "./local-record.ts";

export interface LocalPersistence {
  load(): Promise<unknown>;
  save(record: LocalRecord): Promise<void>;
  clear(): Promise<void>;
}

let configured: LocalPersistence | null = null;

export const configureLocalPersistence = (persistence: LocalPersistence): void => {
  configured = persistence;
};

export const getLocalPersistence = (): LocalPersistence | null => configured;

export const LOCAL_DB_NAME = "kunjae-local";
export const LOCAL_DB_STORE = "vault";
export const LOCAL_DB_KEY = "v1";

const LOCAL_DB_VERSION = 1;

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_DB_STORE)) db.createObjectStore(LOCAL_DB_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("indexedDB open failed"));
    };
    request.onblocked = () => {
      reject(new Error("indexedDB open blocked"));
    };
  });

const inTransaction = async <T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDatabase(factory);

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(LOCAL_DB_STORE, mode, { durability: "strict" });
      const request = operate(transaction.objectStore(LOCAL_DB_STORE));

      transaction.oncomplete = () => {
        resolve(request.result);
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("indexedDB transaction failed"));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("indexedDB transaction aborted"));
      };
    });
  } finally {
    db.close();
  }
};

export const createIndexedDbPersistence = (factory: IDBFactory): LocalPersistence => ({
  load: async () => {
    const value = await inTransaction<unknown>(factory, "readonly", (store) => store.get(LOCAL_DB_KEY));
    return value ?? null;
  },
  save: async (record) => {
    await inTransaction(factory, "readwrite", (store) => store.put(record, LOCAL_DB_KEY));
  },
  clear: async () => {
    await inTransaction(factory, "readwrite", (store) => store.delete(LOCAL_DB_KEY));
  },
});

export const createMemoryPersistence = (): LocalPersistence => {
  let stored: string | null = null;

  return {
    load: () => Promise.resolve(stored === null ? null : (JSON.parse(stored) as unknown)),
    save: (record) => {
      stored = JSON.stringify(record);
      return Promise.resolve();
    },
    clear: () => {
      stored = null;
      return Promise.resolve();
    },
  };
};
