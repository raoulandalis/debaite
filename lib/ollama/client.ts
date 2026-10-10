import "server-only";

import { loadOllamaConfig } from "@/lib/ollama/config";
import {
  gatewayMessages,
  type GatewayErrorCode,
  type GenerateInput,
  type GenerateResult,
  type HealthResponse,
} from "@/lib/ollama/errors";
import { healthFromTags, parseInstalledModels, parseTagNames } from "@/lib/ollama/health";
import type { InstalledModel } from "@/lib/ollama/health";

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const config = loadOllamaConfig();
  const model = chosenModel(input.model, config.model);
  if (config.baseUrl === null) {
    return failure("OLLAMA_UNAVAILABLE", gatewayMessages.unavailable);
  }
  if (model === null) {
    return failure("OLLAMA_UNAVAILABLE", gatewayMessages.missingModel);
  }

  const body = {
    model,
    messages: input.messages,
    stream: false as const,
    options: {
      temperature: input.temperature,
      num_predict: input.numPredict,
    },
    ...(input.json ? { format: "json" as const } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      console.error({ code: "OLLAMA_TIMEOUT" });
      return failure("OLLAMA_TIMEOUT", gatewayMessages.timeout);
    }
    console.error({ code: "OLLAMA_UNAVAILABLE" });
    return failure("OLLAMA_UNAVAILABLE", gatewayMessages.unavailable);
  }

  if (response.status === 404) {
    console.error({ code: "OLLAMA_UNAVAILABLE", status: response.status });
    return failure("OLLAMA_UNAVAILABLE", gatewayMessages.missingModel);
  }
  if (!response.ok) {
    console.error({ code: "MODEL_ERROR", status: response.status });
    return failure("MODEL_ERROR", gatewayMessages.modelError);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error({ code: "MODEL_ERROR", status: response.status });
    return failure("MODEL_ERROR", gatewayMessages.modelError);
  }

  const content = readContent(payload);
  if (content === null) {
    console.error({ code: "INVALID_MODEL_OUTPUT", status: response.status });
    return failure("INVALID_MODEL_OUTPUT", gatewayMessages.emptyOutput);
  }
  const text = content.trim();
  if (text === "") {
    console.error({ code: "INVALID_MODEL_OUTPUT", status: response.status });
    return failure("INVALID_MODEL_OUTPUT", gatewayMessages.emptyOutput);
  }
  return { ok: true, text };
}

export async function listInstalledModels(): Promise<
  | { ok: true; models: InstalledModel[] }
  | { ok: false; code: "OLLAMA_UNAVAILABLE"; message: string }
> {
  const config = loadOllamaConfig();
  if (config.baseUrl === null) {
    return { ok: false, code: "OLLAMA_UNAVAILABLE", message: gatewayMessages.unavailable };
  }
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, code: "OLLAMA_UNAVAILABLE", message: gatewayMessages.unavailable };
    }
    const models = parseInstalledModels(await response.json());
    if (models === null) {
      return { ok: false, code: "OLLAMA_UNAVAILABLE", message: gatewayMessages.unavailable };
    }
    return { ok: true, models };
  } catch {
    return { ok: false, code: "OLLAMA_UNAVAILABLE", message: gatewayMessages.unavailable };
  }
}

export async function checkHealth(): Promise<HealthResponse> {
  const config = loadOllamaConfig();
  if (config.baseUrl === null) {
    return healthFromTags(null, config.model);
  }
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return healthFromTags(null, config.model);
    }
    const names = parseTagNames(await response.json());
    return healthFromTags(names, config.model);
  } catch {
    return healthFromTags(null, config.model);
  }
}

function chosenModel(
  override: string | undefined,
  configured: string | null,
): string | null {
  if (override === undefined) {
    return configured;
  }
  const trimmed = override.trim();
  return trimmed === "" ? null : trimmed;
}

function readContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("message" in payload)) {
    return null;
  }
  const message = payload.message;
  if (typeof message !== "object" || message === null || !("content" in message)) {
    return null;
  }
  return typeof message.content === "string" ? message.content : null;
}

function isTimeout(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("name" in error && error.name === "TimeoutError") {
    return true;
  }
  if (!("cause" in error) || typeof error.cause !== "object" || error.cause === null) {
    return false;
  }
  return "name" in error.cause && error.cause.name === "TimeoutError";
}

function failure(code: GatewayErrorCode, message: string): GenerateResult {
  return { ok: false, code, message };
}
