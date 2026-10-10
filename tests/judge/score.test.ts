import { expect, test } from "vitest";
import { JUDGMENT_DISCLAIMER, scoreSide, toJudgment } from "@/lib/judge";
import type { JudgeModelOutput } from "@/lib/judge";

const worked = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 };
const clearer = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 };
const ones = { reasoning: 1, rebuttal: 1, evidence: 1, clarity: 1 };
const tens = { reasoning: 10, rebuttal: 10, evidence: 10, clarity: 10 };

function output(
  debaterA: JudgeModelOutput["scores"]["debaterA"],
  debaterB: JudgeModelOutput["scores"]["debaterB"],
): JudgeModelOutput {
  return {
    scores: { debaterA, debaterB },
    verdict: "The stronger case answered the other side.",
    strongestArgument: { debaterA: "A best point.", debaterB: "B best point." },
    biggestWeakness: { debaterA: "A largest hole.", debaterB: "B largest hole." },
  };
}

test("scores the worked example as 665 and 66.50", () => {
  expect(scoreSide(worked)).toEqual({
    weightedUnits: 665,
    weightedDisplay: "66.50",
  });
});

test("ties when both sides have the same weighted units", () => {
  const judgment = toJudgment(output(worked, worked));
  expect(judgment.scores.a.weightedUnits).toBe(665);
  expect(judgment.scores.b.weightedUnits).toBe(665);
  expect(judgment.winner).toBe("tie");
});

test("picks the side with higher weighted units", () => {
  const judgment = toJudgment(output(worked, clearer));
  expect(judgment.scores.a).toMatchObject({
    ...worked,
    weightedUnits: 665,
    weightedDisplay: "66.50",
  });
  expect(judgment.scores.b).toMatchObject({
    ...clearer,
    weightedUnits: 680,
    weightedDisplay: "68.00",
  });
  expect(judgment.winner).toBe("b");
});

test("scores all ones as 100 and 10.00", () => {
  expect(scoreSide(ones)).toEqual({
    weightedUnits: 100,
    weightedDisplay: "10.00",
  });
});

test("scores all tens as 1000 and 100.00", () => {
  expect(scoreSide(tens)).toEqual({
    weightedUnits: 1000,
    weightedDisplay: "100.00",
  });
});

test("toJudgment maps prose and sets the exact disclaimer", () => {
  const judgment = toJudgment(output(worked, clearer));
  expect(judgment.verdict).toBe("The stronger case answered the other side.");
  expect(judgment.strongest).toEqual({ a: "A best point.", b: "B best point." });
  expect(judgment.weakness).toEqual({ a: "A largest hole.", b: "B largest hole." });
  expect(judgment.disclaimer).toBe(JUDGMENT_DISCLAIMER);
  expect(judgment.disclaimer).toBe(
    "This verdict is an AI-generated evaluation, not an objective ruling.",
  );
});
