/** Browser-safe Gemini caller used by the server proxy and /api/gemini. */

export type GeminiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; code?: number };

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

let cachedModel: string | null = null;

export function sanitizeGeminiKey(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:Bearer|x-goog-api-key)\s*[:=\s]+/i, "")
    .replace(/\s+/g, "")
    .trim();
}

export function friendlyGeminiError(raw: string): string {
  const m = String(raw ?? "").replace(/^ERR:/i, "");
  if (/missing key/i.test(m)) return "Gemini key khali hai. Settings mein paste karo.";
  if (/403|401|API_KEY|invalid|not valid|PERMISSION_DENIED|API key/i.test(m)) {
    return "Gemini key galat hai. Google AI Studio se nayi key lo.";
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(m)) return "Gemini quota khatam. Thodi der baad try karo.";
  if (/Failed to fetch|network|ENOTFOUND|timeout|ECONN|ERR:net|internet/i.test(m)) {
    return "Internet Gemini tak nahi pahuncha.";
  }
  return "Gemini nahi mila. Settings mein Test dabao, ya local bolo: “kal 5 baje dentist”.";
}

export function extractGeminiText(payload: unknown): string {
  const texts: string[] = [];
  walkText(payload, texts, false);
  const clean = texts.map((t) => t.trim()).filter((t) => t.length > 0 && t !== "[object Object]");
  if (!clean.length) return "";
  return clean[clean.length - 1] ?? "";
}

function walkText(node: unknown, into: string[], thought: boolean) {
  if (node == null) return;
  if (typeof node === "string") {
    if (!thought) into.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkText(item, into, thought);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) {
    into.push(o.output_text);
    return;
  }
  const isThought =
    thought ||
    o.thought === true ||
    o.type === "thought" ||
    o.kind === "thought" ||
    o.category === "thought";
  if (typeof o.text === "string" && o.text.trim() && !isThought) into.push(o.text);
  if (o.parts) walkText(o.parts, into, isThought || thought);
  if (o.candidates) walkText(o.candidates, into, false);
  if (o.content) walkText(o.content, into, isThought || thought);
  if (o.outputs) walkText(o.outputs, into, false);
  if (o.steps) walkText(o.steps, into, false);
  if (o.response) walkText(o.response, into, false);
  if (o.result) walkText(o.result, into, false);
}

function readError(
  status: number,
  json: unknown,
  raw: string,
  opts?: { treat401?: boolean },
): { message: string; fatal: boolean } {
  let message = `Gemini ${status}`;
  const bag = Array.isArray(json) ? json[0] : json;
  const err =
    bag && typeof bag === "object" && "error" in bag
      ? (bag as { error?: { message?: string; status?: string; code?: number } }).error
      : undefined;
  if (err?.message) message = err.message;
  else if (raw && raw.length < 280 && !raw.trim().startsWith("<")) message = raw.trim();
  const blob = `${message} ${err?.status ?? ""} ${raw}`;
  const keyBad = /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(blob);
  const treat401 = opts?.treat401 !== false;
  const fatal =
    status === 403 ||
    status === 429 ||
    (treat401 && status === 401) ||
    /RESOURCE_EXHAUSTED/i.test(blob) ||
    (keyBad && status !== 503);
  return { message, fatal };
}

async function postJson(
  url: string,
  key: string,
  body: unknown,
): Promise<{ status: number; json: unknown; raw: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  return { status: res.status, json, raw };
}

async function listPreferred(key: string): Promise<string[] | GeminiCallResult> {
  const order = cachedModel
    ? [cachedModel, ...GEMINI_MODELS.filter((m) => m !== cachedModel)]
    : [...GEMINI_MODELS];
  try {
    const res = await fetch(`${BASE}/models?pageSize=80`, {
      headers: { Accept: "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(8_000),
    });
    const raw = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    if (!res.ok) {
      const { message, fatal } = readError(res.status, json, raw);
      if (fatal) return { ok: false, error: message, code: res.status };
      return order;
    }
    const models = (json as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }).models ?? [];
    const names = models
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n && !/image|tts|live|audio|vision|robotics|transcribe/i.test(n));
    const preferred = order.filter((m) => names.includes(m));
    const extra = names.filter((n) => /flash/i.test(n) && !preferred.includes(n)).slice(0, 4);
    const list = [...preferred, ...extra];
    return list.length ? list : order;
  } catch {
    return order;
  }
}

function generateBody(prompt: string, extra?: Record<string, unknown>) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      ...extra,
    },
  };
}

async function tryGenerate(key: string, model: string, prompt: string): Promise<GeminiCallResult | "next"> {
  const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const attempts = [
    generateBody(prompt, { thinkingConfig: { thinkingBudget: 0 } }),
    generateBody(prompt),
  ];
  let last: GeminiCallResult | "next" = "next";
  for (const body of attempts) {
    const { status, json, raw } = await postJson(url, key, body);
    if (status === 404) {
      last = "next";
      continue;
    }
    if (status < 200 || status >= 300) {
      const { message, fatal } = readError(status, json, raw, { treat401: false });
      if (fatal) return { ok: false, error: message, code: status };
      last = "next";
      continue;
    }
    const text = extractGeminiText(json);
    if (text) return { ok: true, text, model };
    last = "next";
  }
  return last;
}

async function tryInteractions(key: string, model: string, prompt: string): Promise<GeminiCallResult | "next"> {
  const bodies = [
    { model, input: prompt, generation_config: { thinking_level: "low" } },
    { model, input: prompt },
  ];
  for (const body of bodies) {
    const { status, json, raw } = await postJson(`${BASE}/interactions`, key, body);
    if (status === 404) continue;
    if (status < 200 || status >= 300) {
      const { message, fatal } = readError(status, json, raw, { treat401: true });
      if (fatal && status !== 400) return { ok: false, error: message, code: status };
      continue;
    }
    const text = extractGeminiText(json);
    if (text) return { ok: true, text, model };
  }
  return "next";
}

export async function generateWithGemini(key: string, prompt: string): Promise<GeminiCallResult> {
  const k = sanitizeGeminiKey(key);
  if (!k) return { ok: false, error: "missing key", code: 400 };
  if (!prompt.trim()) return { ok: false, error: "missing prompt", code: 400 };

  const listed = await listPreferred(k);
  const models = Array.isArray(listed) ? listed : GEMINI_MODELS;
  if (!Array.isArray(listed) && !listed.ok) {
    if (listed.code === 400 || listed.code === 403 || listed.code === 429) return listed;
  }

  let last = "no model";
  for (const model of models.slice(0, 4)) {
    try {
      const result = await tryInteractions(k, model, prompt);
      if (result !== "next") {
        if (result.ok) cachedModel = result.model;
        return result;
      }
    } catch (err) {
      last = err instanceof Error ? err.message : "network";
    }
  }

  for (const model of models) {
    try {
      const result = await tryGenerate(k, model, prompt);
      if (result !== "next") {
        if (result.ok) cachedModel = result.model;
        return result;
      }
    } catch (err) {
      last = err instanceof Error ? err.message : "network";
    }
  }

  return { ok: false, error: last };
}

export async function pingGemini(key: string): Promise<GeminiCallResult> {
  return generateWithGemini(key, 'Reply with JSON only, no markdown: {"say":"Sandy ready","actions":[]}');
}
