"use client";

import { useMemo } from "react";
import { dayKeyInTz, eachDay } from "@/lib/dates";
import { useNow, useSpace } from "@/lib/space";

/** Trip days, today's key (in the configured timezone) and the city on each day. */
export function useDayContext() {
  const { config, travel, fixed } = useSpace();
  const now = useNow(60_000);
  const today = dayKeyInTz(now, config.timezone);

  return useMemo(() => {
    const days = eachDay(config.tripStart, config.tripEnd);
    const arrival = fixed.find((f) => f.kind === "arrival");
    const departure = fixed.find((f) => f.kind === "departure");

    // City context: starts at the arrival city; each travel event moves it from its date on.
    // Several moves on one day are applied in creation order (last one wins).
    const cityByDay = new Map<string, string>();
    let city = arrival?.city ?? "";
    for (const d of days) {
      for (const t of travel) if (t.date === d && t.to) city = t.to;
      cityByDay.set(d, city);
    }
    const tripUnderway = today >= config.tripStart && today <= config.tripEnd;
    return { days, today, tripUnderway, cityByDay, arrival, departure };
  }, [config.tripStart, config.tripEnd, travel, fixed, today]);
}
