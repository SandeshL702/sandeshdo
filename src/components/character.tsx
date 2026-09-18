import { rankIdFromLevel, rankMark } from "@/lib/game";
import { cn } from "@/lib/utils";

export type HeroPose = "idle" | "win" | "down";

export function HeroFigure({
  level,
  hp,
  energyPct = 0,
  pose = "idle",
  size = 168,
  showRing = true,
}: {
  level: number;
  hp: number;
  energyPct?: number;
  pose?: HeroPose;
  size?: number;
  showRing?: boolean;
}) {
  const mark = rankMark(level);
  const rank = rankIdFromLevel(level);
  const life = Math.max(0.2, Math.min(1, hp / 100));
  const energy = Math.max(0.04, Math.min(1, energyPct / 100));
  const ring = 2 * Math.PI * 86;
  const gid = `hero-${pose}-${size}-${mark}`;

  return (
    <div
      className={cn(
        "sd-stage relative mx-auto",
        pose === "idle" && "sd-hero-bob",
        pose === "win" && "sd-hero-win",
        pose === "down" && "sd-hero-down",
      )}
      style={{ width: size, height: Math.round(size * 1.28), opacity: 0.58 + life * 0.42 }}
      aria-label={rank}
    >
      <svg viewBox="0 0 200 256" width={size} height={Math.round(size * 1.28)} className="overflow-visible">
        <defs>
          <radialGradient id={`${gid}-glow`} cx="50%" cy="38%" r="52%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${gid}-body`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.78" />
          </linearGradient>
        </defs>

        {mark >= 3 && <ellipse cx="100" cy="112" rx="88" ry="100" fill={`url(#${gid}-glow)`} />}

        <ellipse className="sd-hero-shadow" cx="100" cy="244" rx="48" ry="8" fill="currentColor" fillOpacity="0.22" />

        {showRing && (
          <>
            <circle cx="100" cy="114" r="86" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="5" />
            <circle
              cx="100"
              cy="114"
              r="86"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${energy * ring} ${ring}`}
              transform="rotate(-90 100 114)"
            />
          </>
        )}

        {mark >= 2 && (
          <g className="sd-cape" fill="currentColor" fillOpacity="0.38">
            <path d="M70 108 C42 148 38 200 64 232 C86 210 90 164 86 122 Z" />
            <path d="M130 108 C158 148 162 200 136 232 C114 210 110 164 114 122 Z" />
          </g>
        )}

        <g fill={`url(#${gid}-body)`}>
          <rect x="76" y="172" width="18" height="50" rx="9" />
          <rect x="106" y="172" width="18" height="50" rx="9" />
        </g>
        <ellipse cx="85" cy="224" rx="14" ry="8" fill="currentColor" />
        <ellipse cx="115" cy="224" rx="14" ry="8" fill="currentColor" />
        <ellipse cx="80" cy="224" rx="4" ry="3" fill="var(--sd-fg)" fillOpacity="0.35" />
        <ellipse cx="120" cy="224" rx="4" ry="3" fill="var(--sd-fg)" fillOpacity="0.35" />

        <path
          d="M64 108 C64 94 78 88 100 88 C122 88 136 94 136 108 L132 172 C132 186 118 196 100 196 C82 196 68 186 68 172 Z"
          fill={`url(#${gid}-body)`}
        />
        <path
          d="M84 148 C88 162 112 162 116 148 C110 158 90 158 84 148 Z"
          fill="var(--sd-fg)"
          fillOpacity="0.12"
        />

        <rect x="52" y="112" width="16" height="48" rx="8" fill="currentColor" fillOpacity="0.92" />
        <rect x="132" y="112" width="16" height="48" rx="8" fill="currentColor" fillOpacity="0.92" />
        <circle cx="60" cy="162" r="10" fill="currentColor" />
        <circle cx="140" cy="162" r="10" fill="currentColor" />

        <rect x="90" y="84" width="20" height="14" rx="6" fill="currentColor" fillOpacity="0.85" />

        <circle cx="100" cy="58" r="34" fill="currentColor" />
        <path
          d="M68 54 C72 24 88 16 100 16 C118 16 134 28 134 54 C126 40 112 38 100 40 C84 38 74 44 68 54 Z"
          fill="currentColor"
        />
        <path d="M70 48 C74 38 84 34 92 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M130 48 C126 38 116 34 108 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />

        {mark >= 4 && (
          <g fill="currentColor">
            <polygon points="100,8 110,32 90,32" />
            <polygon points="76,22 84,36 68,36" fillOpacity="0.8" />
            <polygon points="124,22 132,36 116,36" fillOpacity="0.8" />
          </g>
        )}

        <ellipse cx="100" cy="64" rx="26" ry="22" fill="var(--sd-fg)" fillOpacity="0.14" />
        <ellipse cx="86" cy="62" rx="9" ry="11" fill="var(--sd-fg)" />
        <ellipse cx="114" cy="62" rx="9" ry="11" fill="var(--sd-fg)" />
        <circle cx="88.5" cy="63.5" r="3.6" fill="currentColor" />
        <circle cx="116.5" cy="63.5" r="3.6" fill="currentColor" />
        <circle cx="90.2" cy="61.2" r="1.3" fill="var(--sd-fg)" fillOpacity="0.35" />
        <circle cx="118.2" cy="61.2" r="1.3" fill="var(--sd-fg)" fillOpacity="0.35" />
        <ellipse cx="80" cy="74" rx="6" ry="3.5" fill="var(--sd-fg)" fillOpacity="0.16" />
        <ellipse cx="120" cy="74" rx="6" ry="3.5" fill="var(--sd-fg)" fillOpacity="0.16" />
        <path
          d={`M90 78 Q100 ${pose === "down" ? 76 : pose === "win" ? 86 : 84} 110 78`}
          fill="none"
          stroke="var(--sd-fg)"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity={pose === "down" ? 0.4 : 0.9}
        />

        <circle cx="100" cy="136" r={5 + mark} fill="currentColor" fillOpacity="0.32" />
        {mark >= 5 && (
          <g fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5">
            <circle cx="100" cy="58" r="44" />
            <circle cx="100" cy="58" r="54" strokeOpacity="0.18" />
          </g>
        )}
      </svg>
      <span className="sr-only">{rank}</span>
    </div>
  );
}