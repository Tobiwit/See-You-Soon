"use client";

import { useEffect, useId, useState } from "react";
import { PEOPLE, partnerOf } from "@/config/app";
import { DAILY_START, type DailyQuestion } from "@/config/questions";
import { answerDaily, cachedDailyAnswer, fetchDailyAnswer, markDailySeen } from "@/lib/actions";
import { guessedRight, useDaily, type DailyDay } from "@/lib/daily";
import { formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import type { DailyAnswer } from "@/lib/types";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./daily.module.css";

const dayLabel = (day: string) => formatDay(day, { weekday: "short", day: "numeric", month: "short" });

/* ------------------------------------------------------------------ */
/* Memories block                                                      */
/* ------------------------------------------------------------------ */

/** The daily question card under the postcards, plus a discreet archive link. */
export function DailyBlock() {
  const { open } = useUI();
  const { partner } = useMe();
  const daily = useDaily();
  const focus = (daily.banner && daily.byDay.get(daily.banner.day)) || daily.days[daily.days.length - 1] || null;

  let status = "";
  let cta = "";
  if (focus) {
    if (!focus.mine) {
      status = focus.partnerDone ? `${partner.name} already answered` : focus.day === daily.today ? "New today" : "Still open";
      cta = "Answer";
    } else if (!focus.partnerDone) {
      status = `Waiting for ${partner.name}`;
      cta = "Your answer";
    } else {
      status = focus.mine.resultSeenAt ? "You both answered" : "The results are in";
      cta = "See results";
    }
  }

  return (
    <div className={s.block}>
      <div className={s.titleRow}>
        <h3 className={s.h3}>Daily question</h3>
      </div>
      {focus ? (
        <button type="button" className={s.card} onClick={() => open({ kind: "daily", day: focus.day })}>
          <span className={s.cardMeta}>
            {focus.day === daily.today ? "Today" : dayLabel(focus.day)} · {status}
          </span>
          <span className={s.cardQ}>{focus.question.text}</span>
          <span className={s.cardCta}>
            {cta} <span aria-hidden>→</span>
          </span>
        </button>
      ) : (
        <p className={s.empty}>
          {daily.todayIndex < 0
            ? `The first question arrives on ${formatDay(DAILY_START, { day: "numeric", month: "long" })}.`
            : "No new question today — more are on the way."}
        </p>
      )}
      {daily.days.length > 0 && (
        <button type="button" className={s.archiveLink} onClick={() => open({ kind: "daily-archive" })}>
          Show archive
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

export function DailySheet({ day }: { day?: string }) {
  const { close } = useUI();
  const daily = useDaily();
  const target = day ?? daily.banner?.day ?? daily.days[daily.days.length - 1]?.day;
  const d = target ? daily.byDay.get(target) : undefined;

  return (
    <Sheet title="Daily question" onClose={close} full>
      {!d ? (
        <p className={s.note}>There’s no question for this day.</p>
      ) : !d.mine ? (
        <AnswerFlow key={d.day} d={d} />
      ) : d.partnerDone ? (
        <Results key={d.day} d={d} mine={d.mine} />
      ) : (
        <Waiting d={d} mine={d.mine} />
      )}
    </Sheet>
  );
}

function Head({ d, step }: { d: DailyDay; step?: string }) {
  const { today } = useDaily();
  return (
    <header className={s.head}>
      <p className="eyebrow">
        Question of the day · {d.day === today ? "Today" : dayLabel(d.day)}
        {step && <span className={s.step}> · {step}</span>}
      </p>
      <h3 className={s.q}>{d.question.text}</h3>
    </header>
  );
}

/** Answer for yourself, then guess the other person's answer. */
function AnswerFlow({ d }: { d: DailyDay }) {
  const { key: me, partner } = useMe();
  const { sync } = useSpace();
  const { toast } = useUI();
  const [step, setStep] = useState<"self" | "guess">("self");
  const [answer, setAnswer] = useState("");
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const value = step === "self" ? answer : guess;
  const setValue = step === "self" ? setAnswer : setGuess;

  async function submit() {
    setBusy(true);
    if (sync === "offline") toast("Offline — it will send when you're back.");
    try {
      await answerDaily(me, d.day, d.question.id, answer, guess, d.partnerDone);
      // The sheet switches to the results / waiting view by itself once the answer is saved.
    } catch {
      toast("Couldn't save your answer. Try again.", "error");
      setBusy(false);
    }
  }

  return (
    <div className={s.flow}>
      <Head d={d} step={step === "self" ? "1 of 2" : "2 of 2"} />
      <p className={s.prompt} data-guess={step === "guess" || undefined}>
        {step === "self" ? "Your answer" : `What would ${partner.name} say?`}
      </p>
      <AnswerInput key={step} q={d.question} value={value} onChange={setValue} />
      <div className={s.actions}>
        {step === "self" ? (
          <button type="button" className="btn btn-primary btn-block" disabled={!answer.trim()} onClick={() => setStep("guess")}>
            Now guess for {partner.name} <span aria-hidden>→</span>
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-block" disabled={!guess.trim() || busy} onClick={() => void submit()}>
              {busy && <span className="spinner" />}
              Send
            </button>
            <button type="button" className="link-btn" onClick={() => setStep("self")} disabled={busy}>
              ← Back to your answer
            </button>
          </>
        )}
      </div>
      {d.partnerDone && step === "self" && <p className={s.note}>{partner.name} has already answered. Their answer shows once you’ve sent yours.</p>}
    </div>
  );
}

function AnswerInput({ q, value, onChange }: { q: DailyQuestion; value: string; onChange: (v: string) => void }) {
  const id = useId();
  if (q.kind === "free") {
    return (
      <textarea
        id={id}
        className="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="Type here…"
        aria-label="Answer"
      />
    );
  }
  return (
    <div className={s.choices} role="radiogroup" aria-label="Choose one">
      {q.choices.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={s.choice} onClick={() => onChange(c)}>
          <span className={s.radio} aria-hidden />
          {c}
        </button>
      ))}
    </div>
  );
}

function NextButton({ after }: { after: string }) {
  const { replace, close } = useUI();
  const { next } = useDaily();
  const target = next && next.day !== after ? next : null;
  return target ? (
    <button type="button" className="btn btn-primary btn-block" onClick={() => replace({ kind: "daily", day: target.day })}>
      Next question <span aria-hidden>→</span>
    </button>
  ) : (
    <button type="button" className="btn btn-block" onClick={close}>
      Done
    </button>
  );
}

function Waiting({ d, mine }: { d: DailyDay; mine: DailyAnswer }) {
  const { partner } = useMe();
  return (
    <div className={s.flow}>
      <Head d={d} />
      <div className={s.cards}>
        <section className={s.result}>
          <p className={s.who}>You said</p>
          <p className={s.answer}>{mine.answer}</p>
          <p className={s.guessLine}>
            Your guess for {partner.name}: <strong>{mine.guess}</strong>
          </p>
        </section>
      </div>
      <p className={s.wait}>
        Waiting for {partner.name}. You’ll see both answers as soon as they’ve answered too.
      </p>
      <div className={s.actions}>
        <NextButton after={d.day} />
      </div>
    </div>
  );
}

function usePartnerAnswer(day: string) {
  const { key: me } = useMe();
  const partner = partnerOf(me);
  const [state, setState] = useState<{ answer: DailyAnswer | null; failed: boolean }>(() => ({
    answer: cachedDailyAnswer(day, partner),
    failed: false,
  }));
  useEffect(() => {
    if (state.answer) return;
    let alive = true;
    fetchDailyAnswer(day, partner)
      .then((a) => alive && setState({ answer: a, failed: !a }))
      .catch(() => alive && setState({ answer: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [day, partner, state.answer]);
  return state;
}

function Results({ d, mine }: { d: DailyDay; mine: DailyAnswer }) {
  const { key: me, partner } = useMe();
  const { answer: theirs, failed } = usePartnerAnswer(d.day);

  // Viewing the results clears the "see the result" line on the cover.
  useEffect(() => {
    if (theirs && !mine.resultSeenAt) void markDailySeen(me, d.day).catch(() => {});
  }, [theirs, mine.resultSeenAt, me, d.day]);

  if (!theirs) {
    return (
      <div className={s.flow}>
        <Head d={d} />
        <p className={s.note}>{failed ? `Couldn't load ${partner.name}'s answer. Check your connection.` : "Opening the results…"}</p>
      </div>
    );
  }

  const theyKnowMe = guessedRight(d.question, theirs.guess, mine.answer);
  const iKnowThem = guessedRight(d.question, mine.guess, theirs.answer);
  const score = theyKnowMe === null || iKnowThem === null ? null : Number(theyKnowMe) + Number(iKnowThem);

  return (
    <div className={s.flow}>
      <Head d={d} />
      {score !== null && (
        <p className={s.score} data-score={score}>
          {score === 2 ? "You know each other perfectly." : score === 1 ? "One of you got it right." : "Something new to learn about each other."}
        </p>
      )}
      <div className={s.cards}>
        <ResultCard who="You said" answer={mine.answer} guesser={partner.name} guess={theirs.guess} right={theyKnowMe} />
        <ResultCard who={`${PEOPLE[theirs.by].name} said`} answer={theirs.answer} guesser="You" guess={mine.guess} right={iKnowThem} />
      </div>
      <div className={s.actions}>
        <NextButton after={d.day} />
      </div>
    </div>
  );
}

function ResultCard({ who, answer, guesser, guess, right }: { who: string; answer: string; guesser: string; guess: string; right: boolean | null }) {
  return (
    <section className={s.result}>
      <p className={s.who}>{who}</p>
      <p className={s.answer}>{answer}</p>
      <p className={s.guessLine}>
        {guesser} guessed: <strong>{guess}</strong>
        {right !== null && (
          <span className={s.mark} data-right={right || undefined}>
            {right ? "✓ Right" : "✗ Not quite"}
          </span>
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Archive                                                             */
/* ------------------------------------------------------------------ */

export function DailyArchive() {
  const { close, open, toast } = useUI();
  const daily = useDaily();
  const [day, setDay] = useState(daily.today);

  function show() {
    if (!daily.byDay.has(day)) {
      toast("There's no question for that day.");
      return;
    }
    open({ kind: "daily", day });
  }

  return (
    <Sheet title="Archive" onClose={close}>
      <div className={s.archive}>
        <p className="eyebrow">Daily question archive</p>
        <div className="field">
          <label htmlFor="daily-day">Pick a day</label>
          <input
            id="daily-day"
            type="date"
            className="input"
            min={DAILY_START}
            max={daily.today}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={show} disabled={!day}>
          Show
        </button>
      </div>
    </Sheet>
  );
}
