import type { DebateState } from "@/lib/debate";

const SYSTEM_MESSAGE = [
  "You are the judge of a debate between Debater A and Debater B.",
  "Score the arguments, not the personalities. You do not know their names.",
  "Ignore humor, confidence, sarcasm, and which side you prefer.",
  "Reward logical consistency, direct answers to the other side, supporting examples, and clear reasoning.",
  "Do not reward insults or claims that were never made.",
  "Return one JSON object and no other text.",
].join("\n");

const LABELS = [
  ["Debater A", "opening"],
  ["Debater B", "opening"],
  ["Debater A", "rebuttal"],
  ["Debater B", "rebuttal"],
  ["Debater A", "closing"],
  ["Debater B", "closing"],
] as const;

const SHAPE_EXAMPLE = `{
  "scores": {
    "debaterA": { "reasoning": 1, "rebuttal": 1, "evidence": 1, "clarity": 1 },
    "debaterB": { "reasoning": 1, "rebuttal": 1, "evidence": 1, "clarity": 1 }
  },
  "verdict": "...",
  "strongestArgument": { "debaterA": "...", "debaterB": "..." },
  "biggestWeakness": { "debaterA": "...", "debaterB": "..." }
}`;

export function buildJudgeMessages(debate: DebateState): [
  { role: "system"; content: string },
  { role: "user"; content: string },
] {
  const speeches = LABELS.map(([side, round], index) => {
    const text = debate.turns[index]?.text ?? "";
    return `${side} (${round}):\n${text}`;
  });

  const user = [
    `Topic: ${debate.topic}`,
    "",
    ...speeches,
    "",
    "Rubric: score each side with an integer from 1 to 10.",
    "Reasoning 35%",
    "Rebuttals 30%",
    "Evidence 20%",
    "Clarity 15%",
    "",
    "verdict explains why the stronger argument won or why it is a dead heat, without announcing a numeric winner.",
    "strongestArgument quotes or paraphrases each side's best point.",
    "biggestWeakness names the largest hole in each case.",
    "",
    "Do not include weighted totals. The application will compute them.",
    "",
    "The following object is a shape example, not a score to copy:",
    SHAPE_EXAMPLE,
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: user },
  ];
}
