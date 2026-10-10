import type { HealthResponse } from "@/lib/ollama/errors";

export type InstalledModel = {
  name: string;
  parameterBillions: number | null;
};

const PARAMETER_SIZE = /^(\d+(?:\.\d+)?)B$/;

export function matchModel(tagNames: string[], modelName: string): boolean {
  const prefix = `${modelName}:`;
  return tagNames.some((name) => name === modelName || name.startsWith(prefix));
}

export function healthFromTags(
  tagNames: string[] | null,
  modelName: string | null,
): HealthResponse {
  if (tagNames === null) {
    return { ok: false, modelReady: false, modelName };
  }
  return {
    ok: true,
    modelReady: modelName !== null && matchModel(tagNames, modelName),
    modelName,
  };
}

export function parseTagNames(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || !("models" in body)) {
    return null;
  }
  const models = body.models;
  if (!Array.isArray(models)) {
    return null;
  }
  const names: string[] = [];
  for (const model of models) {
    if (typeof model !== "object" || model === null || !("name" in model)) {
      return null;
    }
    if (typeof model.name !== "string") {
      return null;
    }
    names.push(model.name);
  }
  return names;
}

export function parseInstalledModels(body: unknown): InstalledModel[] | null {
  if (typeof body !== "object" || body === null || !("models" in body)) {
    return null;
  }
  if (!Array.isArray(body.models)) {
    return null;
  }

  const models: InstalledModel[] = [];
  for (const model of body.models) {
    if (typeof model !== "object" || model === null || !("name" in model)) {
      continue;
    }
    if (typeof model.name !== "string") {
      continue;
    }
    models.push({
      name: model.name,
      parameterBillions: readParameterBillions(model),
    });
  }
  return models;
}

function readParameterBillions(model: object): number | null {
  if (!("details" in model) || typeof model.details !== "object" || model.details === null) {
    return null;
  }
  if (!("parameter_size" in model.details) || typeof model.details.parameter_size !== "string") {
    return null;
  }
  const match = model.details.parameter_size.trim().match(PARAMETER_SIZE);
  if (match?.[1] === undefined) {
    return null;
  }
  return Number(match[1]);
}
