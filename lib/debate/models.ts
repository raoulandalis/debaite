import type { InstalledModel } from "@/lib/ollama/health";

export type RosterResult =
  | { ok: true }
  | { ok: false; code: "INVALID_INPUT" | "OLLAMA_UNAVAILABLE"; message: string };

export function validateRoster(
  catalog: InstalledModel[],
  roster: { debaterAModel: string; debaterBModel: string; judgeModel: string },
): RosterResult {
  const debaterA = findModel(catalog, roster.debaterAModel);
  const debaterB = findModel(catalog, roster.debaterBModel);
  const judge = findModel(catalog, roster.judgeModel);
  if (debaterA === null || debaterB === null || judge === null) {
    return {
      ok: false,
      code: "OLLAMA_UNAVAILABLE",
      message: "The configured model is missing.",
    };
  }
  if (
    debaterA.parameterBillions === null ||
    debaterB.parameterBillions === null ||
    !sameSizeBand(debaterA.parameterBillions, debaterB.parameterBillions)
  ) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Speaker models must be a similar size.",
    };
  }
  return { ok: true };
}

function findModel(catalog: InstalledModel[], name: string): InstalledModel | null {
  return catalog.find((model) => model.name === name) ?? null;
}

export function sameSizeBand(leftBillions: number, rightBillions: number): boolean {
  if (!Number.isFinite(leftBillions) || !Number.isFinite(rightBillions)) {
    return false;
  }
  if (leftBillions <= 0 || rightBillions <= 0) {
    return false;
  }
  const larger = Math.max(leftBillions, rightBillions);
  const smaller = Math.min(leftBillions, rightBillions);
  return larger / smaller <= 1.5;
}
