import type { HealthResponse } from "@/lib/ollama/errors";

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
