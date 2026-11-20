import type { CommuteMode } from "@/lib/types";

/** Little line icons: sleeper train, plane or bus. Older commutes without a type ("other") have none. */
export function CommuteIcon({ mode, size = 16 }: { mode: CommuteMode; size?: number }) {
  if (mode === "train") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <rect x="3" y="1.5" width="10" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 7h10M6 1.5v5.5M10 1.5v5.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="5.8" cy="9.3" r="0.9" fill="currentColor" />
        <circle cx="10.2" cy="9.3" r="0.9" fill="currentColor" />
        <path d="M5 11.5 3.3 14.5M11 11.5l1.7 3M4.2 13.2h7.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (mode === "plane") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <path
          d="M14.6 8.4 9.3 6.2V2.6a1.3 1.3 0 0 0-2.6 0v3.6L1.4 8.4v1.5l5.3-1.3v3l-1.4 1v1.1l2.7-.7 2.7.7v-1.1l-1.4-1v-3l5.3 1.3Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (mode === "bus") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="9.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 7.5h13M5.5 2.5v5M10.5 2.5v5" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="4.5" cy="12.8" r="1.5" fill="var(--paper)" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11.5" cy="12.8" r="1.5" fill="var(--paper)" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return null;
}

/** Choices offered in the form, in order. */
export const COMMUTE_MODES = ["train", "plane", "bus"] as const;

export const MODE_LABEL: Record<CommuteMode, string> = { train: "Sleeper train", plane: "Plane", bus: "Bus", other: "Commute" };
