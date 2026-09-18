const enc = new TextEncoder();

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
