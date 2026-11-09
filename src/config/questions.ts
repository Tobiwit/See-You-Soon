/**
 * Daily "get to know each other" questions.
 *
 * Adding questions: append new entries at the END of QUESTIONS with a new, unique `id`.
 * Never change or remove the `id` of a question that has already been asked: answers point
 * to it, and removing one would shift which question belongs to which day.
 * Toby can reorder the upcoming questions in Settings.
 *
 * `choice` questions take at most MAX_CHOICES options; everything else is a free answer.
 */

export type DailyQuestion =
  | { id: string; text: string; kind: "free" }
  | { id: string; text: string; kind: "choice"; choices: string[] };

/** First question day (Vietnam time). Each day from here gets the next question in the order. */
export const DAILY_START = "2026-11-10";

export const MAX_CHOICES = 6;

export const QUESTIONS: DailyQuestion[] = [
  { id: "move-anywhere", text: "If you could move anywhere to live (if money was no issue), where would you choose?", kind: "free" },
  {
    id: "appreciated",
    text: "What makes you feel most appreciated?",
    kind: "choice",
    choices: ["Words", "Physical affection", "Quality time", "Thoughtful gestures", "Practical support"],
  },
  { id: "small-thing", text: "What's a small thing that can instantly improve your day?", kind: "free" },
  {
    id: "intimacy",
    text: "What's your favourite kind of intimacy that isn't necessarily sexual?",
    kind: "choice",
    choices: [
      "Falling asleep together",
      "Long conversations",
      "Cooking together",
      "Showering together",
      "Quietly doing your own things next to each other",
    ],
  },
  { id: "envy", text: "What's something you envy in other people, even if you don't particularly want to admit it?", kind: "free" },
  {
    id: "films",
    text: "How do you watch films?",
    kind: "choice",
    choices: ["Always in German", "Always in English", "Original with German subtitles", "Original with English subtitles"],
  },
  {
    id: "opposites",
    text: "Do you think opposites attract, or do similar people make better couples?",
    kind: "choice",
    choices: ["Opposites", "Similarities", "A mixture"],
  },
  { id: "unexpectedly-attractive", text: "What's something you find unexpectedly attractive in another person?", kind: "free" },
  { id: "perfect-sunday", text: "What would your perfect ordinary Sunday look like?", kind: "free" },
  {
    id: "position",
    text: "What's your favourite sex position?",
    kind: "choice",
    choices: ["Missionary", "Doggy style", "Spooning", "Riding / on top", "Standing"],
  },
  { id: "misunderstood", text: "What's one thing people often misunderstand about you?", kind: "free" },
  { id: "dessert", text: "What's your favourite dessert?", kind: "free" },
  { id: "honest-question", text: "If you could ask me one question and had to receive a completely honest answer, what would you ask?", kind: "free" },
  {
    id: "travel-style",
    text: "What's more important to you when travelling: seeing as much as possible or experiencing a place slowly?",
    kind: "choice",
    choices: ["See everything", "Slow travel", "Depends on the destination"],
  },
  { id: "wish-better", text: "What is something you wish you were better at, but rarely make time for?", kind: "free" },
  { id: "best-gift", text: "What's the best gift you've ever received, and what made it special?", kind: "free" },
  { id: "curious", text: "What's a sexual or romantic thing you've always been curious about but haven't tried?", kind: "free" },
  { id: "teach-skill", text: "What's a skill you'd love someone to teach you?", kind: "free" },
  { id: "body-part", text: "Most attractive body part (not dick)?", kind: "free" },
  {
    id: "olives",
    text: "Are olives delicious or absolutely disgusting?",
    kind: "choice",
    choices: ["Delicious", "Okay", "Disgusting"],
  },
];
