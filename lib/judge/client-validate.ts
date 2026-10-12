import { JUDGMENT_DISCLAIMER, scoreSide } from "@/lib/judge/score";
import type { Judgment } from "@/lib/judge/schema";

const invalid = { ok: false as const, code: "INVALID_MODEL_OUTPUT" as const };

export function validateClientJudgment(
  body: unknown,
): { ok: true; judgment: Judgment } | { ok: false; code: "INVALID_MODEL_OUTPUT" } {
  if (!isRecord(body)) {
    return invalid;
  }
  if (body.disclaimer !== JUDGMENT_DISCLAIMER) {
    return invalid;
  }
  if (body.winner !== "a" && body.winner !== "b" && body.winner !== "tie") {
    return invalid;
  }
  if (!nonEmpty(body.verdict)) {
    return invalid;
  }
  if (!isRecord(body.strongest) || !nonEmpty(body.strongest.a) || !nonEmpty(body.strongest.b)) {
    return invalid;
  }
  if (!isRecord(body.weakness) || !nonEmpty(body.weakness.a) || !nonEmpty(body.weakness.b)) {
    return invalid;
  }
  if (!isRecord(body.scores) || !validSide(body.scores.a) || !validSide(body.scores.b)) {
    return invalid;
  }
  return { ok: true, judgment: body as Judgment };
}

function validSide(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const reasoning = readScore(value.reasoning);
  const rebuttal = readScore(value.rebuttal);
  const evidence = readScore(value.evidence);
  const clarity = readScore(value.clarity);
  if (reasoning === null || rebuttal === null || evidence === null || clarity === null) {
    return false;
  }
  if (typeof value.weightedUnits !== "number" || !Number.isInteger(value.weightedUnits)) {
    return false;
  }
  if (typeof value.weightedDisplay !== "string") {
    return false;
  }
  const scored = scoreSide({ reasoning, rebuttal, evidence, clarity });
  return (
    value.weightedUnits === scored.weightedUnits &&
    value.weightedDisplay === scored.weightedDisplay
  );
}

function readScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    return null;
  }
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
