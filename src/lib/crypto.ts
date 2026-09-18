const enc = new TextEncoder();
const dec = new TextDecoder();
const VAULT_KEY = "sandeshdo-vault-dek";
const PREFIX = "enc:v1:";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string): Promise<string> {
  return sha256Hex(`sandeshdo-pin:${pin.trim()}`);
}

export async function pinMatches(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  const next = await hashPin(pin);
  return next === hash;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function vaultKey(): Promise<CryptoKey> {
  let raw = "";
  try {
    raw = localStorage.getItem(VAULT_KEY) ?? "";
  } catch {
    raw = "";
  }
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = bytesToB64(bytes);
    try {
      localStorage.setItem(VAULT_KEY, raw);
    } catch {
      /* private */
    }
  }
  return crypto.subtle.importKey("raw", b64ToBytes(raw) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain || plain.startsWith(PREFIX)) return plain;
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  const out = new Uint8Array(iv.length + packed.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(packed), iv.length);
  return PREFIX + bytesToB64(out);
}

export async function decryptSecret(value: string): Promise<string> {
  if (!value || !value.startsWith(PREFIX)) return value;
  try {
    const key = await vaultKey();
    const all = b64ToBytes(value.slice(PREFIX.length));
    const iv = all.slice(0, 12);
    const data = all.slice(12);
    const packed = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return dec.decode(packed);
  } catch {
    return "";
  }
}

export async function encryptVaultItems<T extends { secret: string }>(items: T[]): Promise<T[]> {
  return Promise.all(items.map(async (item) => ({ ...item, secret: await encryptSecret(item.secret) })));
}

export async function decryptVaultItems<T extends { secret: string }>(items: T[]): Promise<T[]> {
  return Promise.all(items.map(async (item) => ({ ...item, secret: await decryptSecret(item.secret) })));
}
