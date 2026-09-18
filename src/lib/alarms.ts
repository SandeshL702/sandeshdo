const DB_NAME = "sandeshdo-alarms";
const DB_VERSION = 1;

export interface AlarmRecord {
  id: string;
  taskId: string;
  title: string;
  body: string;
  triggerAt: number;
  overdue: boolean;
  priority: string;
  repeatMin?: number;
}

export interface PendingAction {
  id?: number;
  type: "complete" | "snooze";
  taskId: string;
  minutes?: number;
  at: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("alarms")) db.createObjectStore("alarms", { keyPath: "id" });
      if (!db.objectStoreNames.contains("actions")) {
        db.createObjectStore("actions", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function waitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeAlarms(alarms: AlarmRecord[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction("alarms", "readwrite");
  tx.objectStore("alarms").clear();
  for (const alarm of alarms) tx.objectStore("alarms").put(alarm);
  await waitTx(tx);
  db.close();
}

export async function takePendingActions(): Promise<PendingAction[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const tx = db.transaction("actions", "readwrite");
  const rows = (await waitReq(tx.objectStore("actions").getAll())) as PendingAction[];
  tx.objectStore("actions").clear();
  await waitTx(tx);
  db.close();
  return rows;
}
