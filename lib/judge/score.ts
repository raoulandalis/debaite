import type { CriterionScores, JudgeModelOutput, Judgment, ScoredSide } from "@/lib/judge/schema";

export const JUDGMENT_DISCLAIMER =
  "This verdict is an AI-generated evaluation, not an objective ruling." as const;

export function scoreSide(scores: CriterionScores): {
  weightedUnits: number;
  weightedDisplay: string;
} {
  const weightedUnits =
    35 * scores.reasoning +
    30 * scores.rebuttal +
    20 * scores.evidence +
    15 * scores.clarity;
  return {
    weightedUnits,
    weightedDisplay: (weightedUnits / 10).toFixed(2),
  };
}

function scoredSide(scores: CriterionScores): ScoredSide {
  return { ...scores, ...scoreSide(scores) };
}

export function toJudgment(modelOutput: JudgeModelOutput): Judgment {
  const a = scoredSide(modelOutput.scores.debaterA);
  const b = scoredSide(modelOutput.scores.debaterB);
  const winner = a.weightedUnits === b.weightedUnits ? "tie" : a.weightedUnits > b.weightedUnits ? "a" : "b";
  return {
    scores: { a, b },
    winner,
    verdict: modelOutput.verdict,
    strongest: {
      a: modelOutput.strongestArgument.debaterA,
      b: modelOutput.strongestArgument.debaterB,
    },
    weakness: {
      a: modelOutput.biggestWeakness.debaterA,
      b: modelOutput.biggestWeakness.debaterB,
    },
    disclaimer: JUDGMENT_DISCLAIMER,
  };
}
