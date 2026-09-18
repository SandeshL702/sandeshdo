/** Route any common free key: Gemini, Groq, OpenRouter, OpenAI. */

import { extractGeminiText, generateWithGemini, sanitizeGeminiKey, type GeminiCallResult } from "./gemini-client";

export type LlmCallResult = GeminiCallResult;

export type LlmProvider = "gemini" | "groq" | "openrouter" | "openai";

export function detectLlmProvider(raw: string): LlmProvider {
  const k = sanitizeGeminiKey(raw);
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (/^sk-[A-Za-z0-9]/.test(k) && !k.startsWith("sk-or-")) return "openai";
  return "gemini";
}

export function friendlyLlmError(raw: string): string {
  const m = String(raw ?? "").replace(/^ERR:/i, "");
  if (/missing key/i.test(m)) return "AI key khali hai. Settings mein paste karo.";
  if (/403|401|API_KEY|invalid|not valid|PERMISSION_DENIED|incorrect api key|invalid_api_key/i.test(m)) {
    return "AI key galat hai. Gemini / Groq / OpenRouter / OpenAI — koi bhi free key chalega.";
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate_limit/i.test(m)) return "AI quota khatam. Thodi der baad try karo.";
  if (/Failed to fetch|network|ENOTFOUND|timeout|ECONN|ERR:net|internet/i.test(m)) {
    return "Internet AI tak nahi pahuncha.";
  }
  return "Sandy AI se baat nahi kar paya. Settings mein Test dabao — local Hinglish phir bhi chalta hai.";
}

const OPENAI_CHAT = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"],
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-7b-instruct:free",
    ],
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
  },
} as const;

function extractOpenAiText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const choices = o.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as { message?: { content?: unknown } }).message;
    const content = msg?.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const bits = content
        .map((p) => (p && typeof p === "object" && typeof (p as { text?: string }).text === "string" ? (p as { text: string }).text : ""))
        .filter(Boolean);
      if (bits.length) return bits.join("\n").trim();
    }
  }
  return extractGeminiText(json);
}

async function postOpenAi(
  url: string,
  key: string,
  model: string,
  prompt: string,
  extraHeaders?: Record<string, string>,
): Promise<LlmCallResult | "next"> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: "You are Sandy, a male assistant. Reply with JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  if (res.status === 404) return "next";
  if (res.status < 200 || res.status >= 300) {
    const err =
      json && typeof json === "object"
        ? (json as { error?: { message?: string } }).error?.message
        : undefined;
    const message = err || raw.slice(0, 220) || `AI ${res.status}`;
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { ok: false, error: message, code: res.status };
    }
    return "next";
  }
  const text = extractOpenAiText(json);
  if (text) return { ok: true, text, model };
  return "next";
}

async function generateOpenAiCompat(provider: Exclude<LlmProvider, "gemini">, key: string, prompt: string): Promise<LlmCallResult> {
  const spec = OPENAI_CHAT[provider];
  let last = "no model";
  const extra =
    provider === "openrouter"
      ? { "HTTP-Referer": "https://sandeshdo.app", "X-Title": "SandeshDo" }
      : undefined;
  for (const model of spec.models) {
    try {
      const result = await postOpenAi(spec.url, key, model, prompt, extra);
      if (result !== "next") return result;
    } catch (err) {
      last = err instanceof Error ? err.message : "network";
    }
  }
  return { ok: false, error: last };
}

export function openAiRequest(provider: Exclude<LlmProvider, "gemini">, key: string, prompt: string) {
  const spec = OPENAI_CHAT[provider];
  return {
    url: spec.url,
    model: spec.models[0],
    authorization: `Bearer ${key}`,
    body: JSON.stringify({
      model: spec.models[0],
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        { role: "system", content: "You are Sandy, a male assistant. Reply with JSON only, no markdown." },
        { role: "user", content: prompt },
      ],
    }),
  };
}

export function extractAnyLlmText(raw: string): string {
  const t = raw.trim();
  if (!t || t.startsWith("ERR:")) return t;
  try {
    const json = JSON.parse(t) as unknown;
    return extractOpenAiText(json) || extractGeminiText(json) || t;
  } catch {
    return t;
  }
}

export async function generateWithLlm(key: string, prompt: string): Promise<LlmCallResult> {
  const k = sanitizeGeminiKey(key);
  if (!k) return { ok: false, error: "missing key", code: 400 };
  const provider = detectLlmProvider(k);
  if (provider === "gemini") return generateWithGemini(k, prompt);
  return generateOpenAiCompat(provider, k, prompt);
}

export async function pingLlm(key: string): Promise<LlmCallResult> {
  return generateWithLlm(key, 'Reply with JSON only, no markdown: {"say":"Sandy ready","actions":[]}');
}
