/**
 * The A+T mark: a geometric heart whose left half is an "A" (arch apex + crossbar)
 * and whose right half is a "T" (the arch is the bar, the stem drops from its crown).
 * Same geometry as scripts/make-icons.mjs.
 */
export const HEART_PATHS = {
  a: "M247 430 L101.9 262.3 A86 86 0 1 1 247 174.4 L247 430 Z",
  aBar: "M155 292 L247 292",
  t: "M265 174.4 A86 86 0 1 1 410.1 262.3 L265 430 Z",
  tStem: "M345 120 L345 318",
};

export function HeartMark({
  size = 24,
  a = "var(--cobalt)",
  t = "var(--blush-ink)",
  stroke,
  title,
}: {
  size?: number;
  a?: string;
  t?: string;
  /** In 512-unit space; heavier by default at small sizes so it stays legible. */
  stroke?: number;
  title?: string;
}) {
  const w = stroke ?? (size < 40 ? 42 : 30);
  return (
    <svg width={size} height={size} viewBox="70 90 372 372" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <g fill="none" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
        <path d={HEART_PATHS.a} stroke={a} />
        <path d={HEART_PATHS.aBar} stroke={a} />
        <path d={HEART_PATHS.t} stroke={t} />
        <path d={HEART_PATHS.tStem} stroke={t} />
      </g>
    </svg>
  );
}
