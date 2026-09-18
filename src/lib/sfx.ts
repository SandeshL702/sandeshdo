let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!window.__sdCuesArmed) return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    audioCtx = audioCtx ?? new AC();
    void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.05,
  type: OscillatorType = "sine",
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playCompleteSfx(combo = 1): void {
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    tone(c, 140, now, 0.09, 0.07, "triangle");
    const notes = combo >= 4 ? [523.25, 659.25, 783.99, 1046.5] : combo >= 2 ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    notes.forEach((f, i) => tone(c, f, now + 0.04 + i * 0.05, 0.26, 0.05));
  } catch {
    /* autoplay */
  }
}

export function playLevelUpSfx(): void {
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    tone(c, 196, now, 0.12, 0.06, "triangle");
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, now + 0.06 + i * 0.07, 0.38, 0.06));
  } catch {
    /* autoplay */
  }
}

export function playCoinSfx(): void {
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    tone(c, 880, now, 0.12, 0.03, "triangle");
    tone(c, 1320, now + 0.08, 0.16, 0.028, "triangle");
  } catch {
    /* autoplay */
  }
}

export function playDamageSfx(): void {
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    tone(c, 196, now, 0.32, 0.04, "triangle");
    tone(c, 146.83, now + 0.12, 0.4, 0.035, "sine");
  } catch {
    /* autoplay */
  }
}

export function playHealSfx(): void {
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    tone(c, 523.25, now, 0.2, 0.035);
    tone(c, 783.99, now + 0.1, 0.28, 0.04);
  } catch {
    /* autoplay */
  }
}
