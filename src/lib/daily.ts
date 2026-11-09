"use client";

import { useMemo } from "react";
import { partnerOf } from "@/config/app";
import { DAILY_START, QUESTIONS, type DailyQuestion } from "@/config/questions";
import { dayKeyInTz, diffDays, eachDay } from "./dates";
import { useMe } from "./session";
import { useNow, useSpace } from "./space";
import type { DailyAnswer } from "./types";

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
export const questionById = (id: string): DailyQuestion | null => BY_ID.get(id) ?? null;

/**
 * The order questions are asked in: Toby's saved order (unknown ids dropped), then any
 * questions from the bank that aren't in it yet, in bank order. Day N gets order[N].
 */
export function effectiveOrder(stored: string[] | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of stored ?? []) {
    if (BY_ID.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const q of QUESTIONS) if (!seen.has(q.id)) out.push(q.id);
  return out;
}

export interface DailyDay {
  day: string;
  index: number;
  question: DailyQuestion;
  mine: DailyAnswer | null;
  partnerDone: boolean;
}

export type DailyBanner = { kind: "result" | "partner-done" | "new"; day: string };

/**
 * Everything about the daily question for the signed-in person. A new question unlocks at
 * midnight in the trip timezone (Vietnam). Missed days stay open and can be answered later.
 */
export function useDaily() {
  const { config, dailyMine, dailyDone, questionOrder } = useSpace();
  const { key: me } = useMe();
  const partner = partnerOf(me);
  const now = useNow(60_000);
  const today = dayKeyInTz(now, config.timezone);

  return useMemo(() => {
    const order = effectiveOrder(questionOrder);
    // Index of today's question (-1 before the start).
    const todayIndex = diffDays(DAILY_START, today);
    const mineByDay = new Map(dailyMine.map((a) => [a.day, a]));
    const partnerDays = new Set(dailyDone.filter((d) => d.by === partner).map((d) => d.day));

    const days: DailyDay[] = [];
    if (todayIndex >= 0) {
      for (const day of eachDay(DAILY_START, today)) {
        const index = diffDays(DAILY_START, day);
        const mine = mineByDay.get(day) ?? null;
        // A day keeps the question that was answered for it, even if the order changes later.
        const question = (mine && questionById(mine.qid)) || (index < order.length ? questionById(order[index]) : null);
        if (!question) continue;
        days.push({ day, index, question, mine, partnerDone: partnerDays.has(day) });
      }
    }

    const next = days.find((d) => !d.mine) ?? null;
    const unseen = days.find((d) => d.mine && d.partnerDone && !d.mine.resultSeenAt) ?? null;
    const banner: DailyBanner | null = unseen
      ? { kind: "result", day: unseen.day }
      : next
        ? { kind: next.partnerDone ? "partner-done" : "new", day: next.day }
        : null;

    return {
      today,
      order,
      todayIndex,
      days,
      byDay: new Map(days.map((d) => [d.day, d])),
      next,
      unseen,
      banner,
      /** Questions not asked yet (after today's). */
      remaining: Math.max(0, order.length - Math.max(0, todayIndex + 1)),
    };
  }, [questionOrder, today, dailyMine, dailyDone, partner]);
}

/** Choice answers can be checked automatically; free answers are shown side by side. */
export const guessedRight = (q: DailyQuestion, guess: string, actual: string) =>
  q.kind === "choice" ? guess === actual : null;
