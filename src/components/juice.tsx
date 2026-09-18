import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

type Burst = {
  id: number;
  xp: number;
  coins: number;
  combo: number;
  levelUp: boolean;
  rank: string;
};

export function JuiceLayer() {
  const event = useApp((s) => s.lastFinish);
  const [burst, setBurst] = useState<Burst | null>(null);

  useEffect(() => {
    if (!event) return;
    const next: Burst = {
      id: event.completedAt,
      xp: event.xpGain,
      coins: event.coinGain,
      combo: event.combo,
      levelUp: event.levelUp,
      rank: event.rank,
    };
    setBurst(next);
    const timer = window.setTimeout(() => setBurst(null), 1400);
    return () => window.clearTimeout(timer);
  }, [event]);

  if (!burst) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[18%] z-[90] flex flex-col items-center" aria-hidden>
      {burst.combo > 1 && (
        <div className="sd-combo-stamp font-display text-4xl font-medium tracking-tight text-primary">
          x{burst.combo}
        </div>
      )}
      <div className="relative mt-3 h-16 w-40">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="sd-spark absolute top-1/2 left-1/2 size-1.5 rounded-full bg-primary"
            style={
              {
                "--dx": `${(i - 4.5) * 14}px`,
                "--dy": `${-18 - (i % 4) * 10}px`,
                animationDelay: `${i * 28}ms`,
              } as { [key: string]: string }
            }
          />
        ))}
      </div>
    </div>
  );
}
