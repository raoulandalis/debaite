import { expect, test } from "vitest";
import { sameSizeBand } from "@/lib/debate";

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
