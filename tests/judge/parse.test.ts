import { expect, test } from "vitest";
import { parseJudgeOutput } from "@/lib/judge";

const scores = {
  debaterA: { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 },
  debaterB: { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 },
};

const prose = {
  verdict: "B answered the other side more directly.",
  strongestArgument: { debaterA: "A best point.", debaterB: "B best point." },
  biggestWeakness: { debaterA: "A largest hole.", debaterB: "B largest hole." },
};

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    scores,
    ...prose,
    ...overrides,
  };
}

test("parses a valid score sheet", () => {
  expect(parseJudgeOutput(JSON.stringify(sheet()))).toEqual(sheet());
});

test.each([
  ["zero", { reasoning: 0 }],
  ["eleven", { reasoning: 11 }],
  ["decimal", { reasoning: 8.5 }],
  ["string digit", { reasoning: "8" }],
])("rejects a %s reasoning score", (_label, debaterA) => {
  const body = sheet({
    scores: {
      debaterA: { ...scores.debaterA, ...debaterA },
      debaterB: scores.debaterB,
    },
  });
  expect(parseJudgeOutput(JSON.stringify(body))).toBeNull();
});

test("accepts a single surrounding json fence", () => {
  const raw = "```json\n" + JSON.stringify(sheet()) + "\n```";
  expect(parseJudgeOutput(raw)).toEqual(sheet());
});

test("extracts a JSON object from surrounding prose", () => {
  const raw = "Here is the sheet:\n" + JSON.stringify(sheet()) + "\nThanks.";
  expect(parseJudgeOutput(raw)).toEqual(sheet());
});

test("strips a leading BOM before parsing", () => {
  expect(parseJudgeOutput("\uFEFF" + JSON.stringify(sheet()))).toEqual(sheet());
});

test("accepts an extra winner key and drops it", () => {
  const raw = JSON.stringify({ ...sheet(), winner: "debaterA" });
  expect(parseJudgeOutput(raw)).toEqual(sheet());
});

test("rejects an empty verdict", () => {
  expect(parseJudgeOutput(JSON.stringify(sheet({ verdict: "   " })))).toBeNull();
});

test("rejects a verdict longer than 600 characters after trim", () => {
  expect(parseJudgeOutput(JSON.stringify(sheet({ verdict: "x".repeat(601) })))).toBeNull();
});

test("trims prose before applying the length cap", () => {
  const parsed = parseJudgeOutput(JSON.stringify(sheet({ verdict: "  hello  " })));
  expect(parsed?.verdict).toBe("hello");
});
