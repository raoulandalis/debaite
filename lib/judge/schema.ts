import { z } from "zod";

const criterionScore = z.number().int().min(1).max(10);

const criterionScores = z.object({
  reasoning: criterionScore,
  rebuttal: criterionScore,
  evidence: criterionScore,
  clarity: criterionScore,
});

const prose = z.string().trim().min(1).max(600);

export const judgeModelOutputSchema = z.object({
  scores: z.object({
    debaterA: criterionScores,
    debaterB: criterionScores,
  }),
  verdict: prose,
  strongestArgument: z.object({
    debaterA: prose,
    debaterB: prose,
  }),
  biggestWeakness: z.object({
    debaterA: prose,
    debaterB: prose,
  }),
});

export type CriterionScores = z.infer<typeof criterionScores>;
export type JudgeModelOutput = z.infer<typeof judgeModelOutputSchema>;

export type ScoredSide = CriterionScores & {
  weightedUnits: number;
  weightedDisplay: string;
};

export type Judgment = {
  scores: {
    a: ScoredSide;
    b: ScoredSide;
  };
  winner: "a" | "b" | "tie";
  verdict: string;
  strongest: { a: string; b: string };
  weakness: { a: string; b: string };
  disclaimer: "This verdict is an AI-generated evaluation, not an objective ruling.";
};
