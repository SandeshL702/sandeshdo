export type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function stopSpeak() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* web */
  }
}

export function speak(text: string, locale: "en" | "hi" = "en") {
  if (typeof window === "undefined") return;
  const clean = text.replace(/[•·]/g, ",").replace(/\s+/g, " ").trim();
  if (!clean || !window.speechSynthesis) return;
  stopSpeak();
  const u = new SpeechSynthesisUtterance(clean.slice(0, 280));
  u.lang = locale === "hi" ? "hi-IN" : "en-IN";
  u.rate = 1.02;
  u.pitch = 0.88;
  const voices = window.speechSynthesis.getVoices();
  const pick =
    voices.find((v) => v.lang.startsWith(locale === "hi" ? "hi" : "en") && /male|ravi|aditya|google/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(locale === "hi" ? "hi" : "en-in")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(locale === "hi" ? "hi" : "en"));
  if (pick) u.voice = pick;
  window.speechSynthesis.speak(u);
}
