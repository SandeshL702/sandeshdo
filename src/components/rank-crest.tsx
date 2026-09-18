import { rankIdFromLevel, rankMark } from "@/lib/game";

export function RankCrest({
  level,
  hp,
  size = 72,
}: {
  level: number;
  hp: number;
  size?: number;
}) {
  const mark = rankMark(level);
  const rank = rankIdFromLevel(level);
  const fill = Math.max(0.08, Math.min(1, hp / 100));
  const ring = 2 * Math.PI * 30;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className="shrink-0"
      aria-label={`${rank} seal`}
    >
      <rect x="4" y="4" width="72" height="72" rx="18" fill="currentColor" fillOpacity="0.08" />
      <rect
        x="4"
        y="4"
        width="72"
        height="72"
        rx="18"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="3" />
      <circle
        cx="40"
        cy="40"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray={`${fill * ring} ${ring}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <g fill="currentColor" transform="translate(40 40)">
        {mark === 1 && <polygon points="0,-12 9,0 0,12 -9,0" />}
        {mark === 2 && (
          <>
            <polygon points="0,-14 8,-4 -8,-4" />
            <polygon points="0,4 8,14 -8,14" />
          </>
        )}
        {mark === 3 && (
          <>
            <polygon points="0,-15 11,6 -11,6" />
            <rect x="-10" y="9" width="20" height="3.5" rx="1" />
          </>
        )}
        {mark === 4 && (
          <>
            <polygon points="0,-15 4,-4 15,0 4,4 0,15 -4,4 -15,0 -4,-4" />
          </>
        )}
        {mark >= 5 && (
          <>
            <polygon points="0,-16 5,-5 16,0 5,5 0,16 -5,5 -16,0 -5,-5" />
            <circle r="4.5" fillOpacity="1" />
          </>
        )}
      </g>
    </svg>
  );
}
