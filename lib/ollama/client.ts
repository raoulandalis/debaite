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

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatPayload(input, model, false)),
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

export type GenerateStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; code: GatewayErrorCode; message: string };

export async function* generateStream(
  input: GenerateInput,
): AsyncGenerator<GenerateStreamEvent> {
  const config = loadOllamaConfig();
  const model = chosenModel(input.model, config.model);
  if (config.baseUrl === null) {
    yield streamFailure("OLLAMA_UNAVAILABLE", gatewayMessages.unavailable);
    return;
  }
  if (model === null) {
    yield streamFailure("OLLAMA_UNAVAILABLE", gatewayMessages.missingModel);
    return;
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatPayload(input, model, true)),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      console.error({ code: "OLLAMA_TIMEOUT" });
      yield streamFailure("OLLAMA_TIMEOUT", gatewayMessages.timeout);
      return;
    }
    console.error({ code: "OLLAMA_UNAVAILABLE" });
    yield streamFailure("OLLAMA_UNAVAILABLE", gatewayMessages.unavailable);
    return;
  }

  if (response.status === 404) {
    console.error({ code: "OLLAMA_UNAVAILABLE", status: response.status });
    yield streamFailure("OLLAMA_UNAVAILABLE", gatewayMessages.missingModel);
    return;
  }
  if (!response.ok || response.body === null) {
    console.error({ code: "MODEL_ERROR", status: response.status });
    yield streamFailure("MODEL_ERROR", gatewayMessages.modelError);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let combined = "";
  let failed = false;

  const consume = function* (lines: string[]): Generator<GenerateStreamEvent, boolean> {
    for (const line of lines) {
      const parsed = parseChatLine(line);
      if (parsed.kind === "blank") {
        continue;
      }
      if (parsed.kind === "bad") {
        console.error({ code: "MODEL_ERROR", status: response.status });
        failed = true;
        yield streamFailure("MODEL_ERROR", gatewayMessages.modelError);
        return true;
      }
      if (parsed.text !== "") {
        combined += parsed.text;
        yield { type: "delta", text: parsed.text };
      }
      if (parsed.done) {
        return true;
      }
    }
    return false;
  };

  while (!failed) {
    let read: ReadableStreamReadResult<Uint8Array>;
    try {
      read = await reader.read();
    } catch (error) {
      if (isTimeout(error)) {
        console.error({ code: "OLLAMA_TIMEOUT" });
        yield streamFailure("OLLAMA_TIMEOUT", gatewayMessages.timeout);
        return;
      }
      console.error({ code: "OLLAMA_UNAVAILABLE" });
      yield streamFailure("OLLAMA_UNAVAILABLE", gatewayMessages.unavailable);
      return;
    }

    if (read.done) {
      pending += decoder.decode();
      yield* consume(splitLines(pending, true).lines);
      break;
    }

    pending += decoder.decode(read.value, { stream: true });
    const split = splitLines(pending, false);
    pending = split.rest;
    const halted = yield* consume(split.lines);
    if (failed) {
      return;
    }
    if (halted) {
      await reader.cancel();
      break;
    }
  }

  if (failed) {
    return;
  }
  yield { type: "done", text: combined.trim() };
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
  const down = (): HealthResponse => ({
    ...healthFromTags(null, config.model),
    models: [],
  });
  if (config.baseUrl === null) {
    return down();
  }
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return down();
    }
    const body: unknown = await response.json();
    return {
      ...healthFromTags(parseTagNames(body), config.model),
      models: parseInstalledModels(body) ?? [],
    };
  } catch {
    return down();
  }
}

function chatPayload(input: GenerateInput, model: string, stream: boolean) {
  return {
    model,
    messages: input.messages,
    stream,
    options: {
      temperature: input.temperature,
      num_predict: input.numPredict,
    },
    ...(input.json ? { format: "json" as const } : {}),
  };
}

function splitLines(buffer: string, flush: boolean): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  if (!flush) {
    const rest = parts.pop() ?? "";
    return { lines: parts, rest };
  }
  return { lines: parts, rest: "" };
}

function parseChatLine(
  line: string,
): { kind: "blank" } | { kind: "bad" } | { kind: "chunk"; text: string; done: boolean } {
  const trimmed = line.trim();
  if (trimmed === "") {
    return { kind: "blank" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return { kind: "bad" };
  }
  const content = readContent(payload);
  if (content === null) {
    return { kind: "bad" };
  }
  const done =
    typeof payload === "object" &&
    payload !== null &&
    "done" in payload &&
    payload.done === true;
  return { kind: "chunk", text: content, done };
}

function streamFailure(code: GatewayErrorCode, message: string): GenerateStreamEvent {
  return { type: "error", code, message };
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
