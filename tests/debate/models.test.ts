import { expect, test } from "vitest";
import { sameSizeBand, validateRoster } from "@/lib/debate";
import type { InstalledModel } from "@/lib/ollama/health";

test("accepts model sizes within a 1.5 ratio", () => {
  expect(sameSizeBand(7, 8)).toBe(true);
  expect(sameSizeBand(3.2, 4)).toBe(true);
});

test("rejects model sizes outside the band or unusable", () => {
  expect(sameSizeBand(7, 14)).toBe(false);
  expect(sameSizeBand(3, 8)).toBe(false);
  expect(sameSizeBand(0, 7)).toBe(false);
  expect(sameSizeBand(-1, 7)).toBe(false);
  expect(sameSizeBand(Number.NaN, 7)).toBe(false);
  expect(sameSizeBand(Number.POSITIVE_INFINITY, 7)).toBe(false);
});

const speakers = {
  debaterAModel: "small:latest",
  debaterBModel: "near:latest",
  judgeModel: "judge:latest",
};

function catalog(
  sizes: { small: number | null; near: number | null; judge: number | null },
): InstalledModel[] {
  return [
    { name: "small:latest", parameterBillions: sizes.small },
    { name: "near:latest", parameterBillions: sizes.near },
    { name: "judge:latest", parameterBillions: sizes.judge },
  ];
}

test("rejects speaker models outside the size band", () => {
  expect(
    validateRoster(catalog({ small: 7, near: 14, judge: 9 }), {
      ...speakers,
      debaterBModel: "near:latest",
    }),
  ).toEqual({
    ok: false,
    code: "INVALID_INPUT",
    message: "Speaker models must be a similar size.",
  });
});

test("rejects a model that is missing from the catalog", () => {
  expect(
    validateRoster(catalog({ small: 7, near: 8, judge: 9 }), {
      ...speakers,
      judgeModel: "missing:latest",
    }),
  ).toEqual({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
    message: "The configured model is missing.",
  });
});

test("rejects a speaker model with no parameter size", () => {
  expect(
    validateRoster(catalog({ small: null, near: 8, judge: 9 }), speakers),
  ).toEqual({
    ok: false,
    code: "INVALID_INPUT",
    message: "Speaker models must be a similar size.",
  });
});

test("allows a judge model with no parameter size when speakers match", () => {
  expect(validateRoster(catalog({ small: 7, near: 8, judge: null }), speakers)).toEqual({
    ok: true,
  });
});

test("matches catalog names exactly", () => {
  expect(
    validateRoster(catalog({ small: 7, near: 8, judge: 9 }), {
      ...speakers,
      debaterAModel: "small",
    }).ok,
  ).toBe(false);
});
