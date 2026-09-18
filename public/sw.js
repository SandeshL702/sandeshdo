/* SandeshDo — notification worker. Does not intercept page fetches. */
const DB_NAME = "sandeshdo-alarms";
const DB_VERSION = 1;
const LIGHT_VIBRATE = [36, 54, 36, 54, 48];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "SYNC_ALARMS") {
    event.waitUntil(syncAlarms(data.alarms || []));
  }
  if (data.type === "SHOW") {
    event.waitUntil(showNow(data.payload));
  }
  if (data.type === "TEST") {
    event.waitUntil(showNow(testPayload()));
  }
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const taskId = data.taskId || null;
  event.notification.close();
  event.waitUntil(handleClick(event.action, taskId));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sandeshdo-tick") {
    event.waitUntil(fireDue());
  }
});

function testPayload() {
  return {
    title: "SandeshDo",
    body: "Lock-screen alert · gentle tone + vibrate",
    tag: "sandeshdo-test",
    taskId: null,
    overdue: false,
    requireInteraction: true,
  };
}

async function handleClick(action, taskId) {
  if (action === "complete" && taskId) {
    await pushAction({ type: "complete", taskId });
    await messageClients({ type: "COMPLETE", taskId });
    return;
  }
  if (action === "snooze" && taskId) {
    await pushAction({ type: "snooze", taskId, minutes: 10 });
    await messageClients({ type: "SNOOZE", taskId, minutes: 10 });
    return;
  }
  const url = taskId ? `/?task=${encodeURIComponent(taskId)}` : "/";
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("focus" in client) {
      await client.focus();
      client.postMessage({ type: "OPEN", taskId });
      return;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(url);
}

async function messageClients(msg) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) client.postMessage(msg);
}

async function syncAlarms(alarms) {
  const db = await openDb();
  const tx = db.transaction("alarms", "readwrite");
  tx.objectStore("alarms").clear();
  for (const alarm of alarms) tx.objectStore("alarms").put(alarm);
  await txDone(tx);
  db.close();
  await fireDue();
  await scheduleFuture(alarms);
}

async function fireDue() {
  const now = Date.now();
  const alarms = await getAlarms();
  const due = alarms.filter((a) => a.triggerAt <= now + 1500);
  for (const alarm of due) {
    await showNow({
      title: alarm.overdue ? `Still pending · ${alarm.title}` : `Task due · ${alarm.title}`,
      body: alarm.body,
      tag: `sandeshdo-${alarm.taskId}`,
      taskId: alarm.taskId,
      overdue: alarm.overdue,
      requireInteraction: true,
    });
  }
}

async function scheduleFuture(alarms) {
  const Trigger = self.TimestampTrigger;
  if (typeof Trigger !== "function") return;
  const now = Date.now();
  const upcoming = alarms.filter((a) => a.triggerAt > now + 1500).slice(0, 32);
  for (const alarm of upcoming) {
    try {
      await self.registration.showNotification(
        alarm.overdue ? `Still pending · ${alarm.title}` : `Task due · ${alarm.title}`,
        notificationOptions({
          body: alarm.body,
          tag: `sandeshdo-${alarm.taskId}`,
          taskId: alarm.taskId,
          overdue: alarm.overdue,
          requireInteraction: true,
          showTrigger: new Trigger(alarm.triggerAt),
        }),
      );
    } catch {
      /* TimestampTrigger unsupported or quota */
    }
  }
}

async function showNow(payload) {
  if (!payload) return;
  const existing = await self.registration.getNotifications({ tag: payload.tag });
  for (const n of existing) {
    if (!n.showTrigger) n.close();
  }
  await self.registration.showNotification(payload.title, notificationOptions(payload));
}

function notificationOptions(payload) {
  return {
    body: payload.body,
    tag: payload.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: LIGHT_VIBRATE,
    silent: false,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    timestamp: Date.now(),
    data: { taskId: payload.taskId || null, url: payload.taskId ? `/?task=${payload.taskId}` : "/" },
    actions: payload.taskId
      ? [
          { action: "complete", title: "Done" },
          { action: "snooze", title: "10 min" },
        ]
      : [],
    showTrigger: payload.showTrigger,
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("alarms")) db.createObjectStore("alarms", { keyPath: "id" });
      if (!db.objectStoreNames.contains("actions")) db.createObjectStore("actions", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAlarms() {
  const db = await openDb();
  const tx = db.transaction("alarms", "readonly");
  const req = tx.objectStore("alarms").getAll();
  const rows = await reqAs(req);
  db.close();
  return rows;
}

async function pushAction(action) {
  const db = await openDb();
  const tx = db.transaction("actions", "readwrite");
  tx.objectStore("actions").add({ ...action, at: Date.now() });
  await txDone(tx);
  db.close();
}

function reqAs(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
