import { expect, test } from "vitest";
import { JUDGMENT_DISCLAIMER } from "@/lib/judge";
import { validateClientJudgment } from "@/lib/judge/client-validate";
import type { Judgment } from "@/lib/judge";

const worked = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 };
const clearer = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 };

function side(
  scores: typeof worked,
  weightedUnits: number,
  weightedDisplay: string,
) {
  return { ...scores, weightedUnits, weightedDisplay };
}

function judgment(overrides: Partial<Judgment> = {}): Judgment {
  return {
    scores: {
      a: side(worked, 665, "66.50"),
      b: side(worked, 665, "66.50"),
    },
    winner: "tie",
    verdict: "The stronger case answered the other side.",
    strongest: { a: "A best point.", b: "B best point." },
    weakness: { a: "A largest hole.", b: "B largest hole." },
    disclaimer: JUDGMENT_DISCLAIMER,
    ...overrides,
  };
}

test("accepts a matching tie body", () => {
  const body = judgment();
  const result = validateClientJudgment(body);
  expect(result).toEqual({ ok: true, judgment: body });
  if (result.ok) {
    expect(result.judgment.winner).toBe("tie");
  }
});

test("rejects weighted units that do not match scoreSide", () => {
  const body = judgment();
  body.scores.a = side(worked, 666, "66.50");
  expect(validateClientJudgment(body)).toEqual({
    ok: false,
    code: "INVALID_MODEL_OUTPUT",
  });
});

test("rejects a weighted display that does not match scoreSide", () => {
  const body = judgment();
  body.scores.b = side(clearer, 680, "66.51");
  expect(validateClientJudgment(body)).toEqual({
    ok: false,
    code: "INVALID_MODEL_OUTPUT",
  });
});

test("rejects a wrong disclaimer, an empty verdict, or a missing side", () => {
  const wrongDisclaimer = judgment({
    disclaimer: "Not the disclaimer." as Judgment["disclaimer"],
  });
  const emptyVerdict = judgment({ verdict: "   " });
  const missingSide = judgment();
  delete (missingSide.scores as { b?: unknown }).b;

  expect(validateClientJudgment(wrongDisclaimer).ok).toBe(false);
  expect(validateClientJudgment(emptyVerdict).ok).toBe(false);
  expect(validateClientJudgment(missingSide).ok).toBe(false);
});
