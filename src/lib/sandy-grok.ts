export type BrainResult = { ok: true; text: string } | { ok: false; error: string };

export type SandyAsk = { prompt: string; brief: string; history: string; now: string };

function systemPrompt(data: SandyAsk) {
  return `You are Sandy, a young man who runs SandeshDo — a private Hinglish task + money app. You OWN every screen: tasks, calendar, paisa, notes, plans, vault labels, report. Speak short Hinglish, warm, decisive, like a sharp friend. Never dump the user's full sentence as a title.

Now: ${data.now}

RULES
- add_task title = the thing only. Example: "Yash thare ka video aaj sham ko khatam karna hai" → title "Yash thare ka video", dueAt = today 18:00 local as epoch ms.
- Always set dueAt (epoch milliseconds) when they mention aaj, kal, parso, sham, shaam, subah, raat, baje, today, tomorrow, evening, night.
- You can complete, snooze, update, delete, log money, add notes/plans, navigate, and generate a spoken report from the brief.
- If they ask what to do, pick from OPEN TASKS and be specific.
- Reply JSON only, no markdown: {"say":"...","actions":[...]}

Actions:
{"type":"add_task","title":"...","dueAt":epoch_ms_or_null}
{"type":"complete_task","query":"..."}
{"type":"snooze_task","query":"...","minutes":10}
{"type":"update_task","query":"...","title":"...","dueAt":epoch_ms}
{"type":"delete_task","query":"..."}
{"type":"log_money","kind":"income"|"expense","amount":number,"note":"..."}
{"type":"add_note","title":"...","body":"..."}
{"type":"add_plan","title":"...","when":epoch_ms_or_null,"cost":number_or_null}
{"type":"navigate","to":"tasks"|"calendar"|"money"|"settings"|"report"|"notes"|"plans"|"vault"|"more"}
{"type":"report"}

APP STATE
${data.brief}`;
}

export async function runSandyGrok(data: SandyAsk): Promise<BrainResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "no-xai" };

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(data) },
  ];
  if (data.history.trim()) messages.push({ role: "user", content: `Recent chat:\n${data.history}` });
  messages.push({ role: "user", content: data.prompt });

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.25,
        max_tokens: 900,
        messages,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const raw = await res.text();
    if (!res.ok) return { ok: false, error: `xAI ${res.status} ${raw.slice(0, 160)}` };
    let body: { choices?: { message?: { content?: string } }[] } = {};
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return { ok: false, error: "bad json" };
    }
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "empty" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "net" };
  }
}
