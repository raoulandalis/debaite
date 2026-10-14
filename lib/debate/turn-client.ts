import type { RoundId, SpeakerSlot, Turn } from "@/lib/debate/types";

export type TurnRequestBody = {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  round: RoundId;
  speaker: SpeakerSlot;
  transcript: Turn[];
};

const failed = {
  ok: false as const,
  code: "MODEL_ERROR",
  message: "The debate request failed. You can retry this turn.",
};

export async function requestTurn(
  body: TurnRequestBody,
  signal: AbortSignal,
  onDelta?: (text: string) => void,
): Promise<
  | { ok: true; round: RoundId; speaker: SpeakerSlot; text: string }
  | { ok: false; aborted: true }
  | { ok: false; code: string; message: string }
> {
  try {
    const response = await fetch("/api/debate/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("ndjson")) {
      return await readNdjson(response, onDelta);
    }
    const payload: unknown = await readJson(response);
    if (isErrorBody(payload)) {
      return { ok: false, code: payload.error.code, message: payload.error.message };
    }
    if (!response.ok || payload === null || !isSpeech(payload)) {
      return failed;
    }
    return { ok: true, round: payload.round, speaker: payload.speaker, text: payload.text };
  } catch (error) {
    if (isAbort(error)) {
      return { ok: false, aborted: true };
    }
    return failed;
  }
}

async function readNdjson(
  response: Response,
  onDelta?: (text: string) => void,
): Promise<
  | { ok: true; round: RoundId; speaker: SpeakerSlot; text: string }
  | { ok: false; code: string; message: string }
> {
  if (response.body === null) {
    return failed;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const outcome: {
    speech: { round: RoundId; speaker: SpeakerSlot; text: string } | null;
    failure: { ok: false; code: string; message: string } | null;
  } = { speech: null, failure: null };

  const take = (line: string) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      outcome.failure = failed;
      return;
    }
    if (typeof payload !== "object" || payload === null || !("type" in payload)) {
      outcome.failure = failed;
      return;
    }
    if (payload.type === "delta" && "text" in payload && typeof payload.text === "string") {
      onDelta?.(payload.text);
      return;
    }
    if (payload.type === "speech" && isSpeech(payload)) {
      outcome.speech = { round: payload.round, speaker: payload.speaker, text: payload.text };
      return;
    }
    if (payload.type === "error" && "error" in payload && isErrorRecord(payload.error)) {
      outcome.failure = { ok: false, code: payload.error.code, message: payload.error.message };
      return;
    }
    outcome.failure = failed;
  };

  while (outcome.failure === null && outcome.speech === null) {
    const read = await reader.read();
    const chunk = read.done ? decoder.decode() : decoder.decode(read.value, { stream: true });
    pending += chunk;
    const lines = pending.split("\n");
    pending = read.done ? "" : (lines.pop() ?? "");
    const ready = read.done ? lines.concat(pending === "" ? [] : [pending]) : lines;
    if (read.done) {
      pending = "";
    }
    for (const line of ready) {
      take(line);
      if (outcome.failure !== null || outcome.speech !== null) {
        break;
      }
    }
    if (read.done) {
      break;
    }
  }

  if (outcome.failure !== null) {
    return outcome.failure;
  }
  if (outcome.speech !== null) {
    return {
      ok: true,
      round: outcome.speech.round,
      speaker: outcome.speech.speaker,
      text: outcome.speech.text,
    };
  }
  return failed;
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isErrorRecord(value: unknown): value is { code: string; message: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "code" in value &&
    "message" in value &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isErrorBody(
  value: unknown,
): value is { error: { code: string; message: string } } {
  return typeof value === "object" && value !== null && "error" in value && isErrorRecord(value.error);
}

function isSpeech(
  value: unknown,
): value is { round: RoundId; speaker: SpeakerSlot; text: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("round" in value) || !("speaker" in value) || !("text" in value)) {
    return false;
  }
  return (
    (value.round === "opening" || value.round === "rebuttal" || value.round === "closing") &&
    (value.speaker === "a" || value.speaker === "b") &&
    typeof value.text === "string"
  );
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
