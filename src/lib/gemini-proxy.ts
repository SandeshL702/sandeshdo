import { createServerFn } from "@tanstack/react-start";

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];

export const proxyGemini = createServerFn({ method: "POST" })
  .validator((input: { key: string; prompt: string }) => input)
  .handler(async ({ data }) => {
    const key = data.key.trim();
    if (!key) return { ok: false as const, error: "missing key" };
    let last = "no model";
    for (const model of MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: data.prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
            }),
          },
        );
        if (!res.ok) {
          last = `Gemini ${res.status}`;
          continue;
        }
        const body = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) return { ok: true as const, text };
      } catch (err) {
        last = err instanceof Error ? err.message : "network";
      }
    }
    return { ok: false as const, error: last };
  });
