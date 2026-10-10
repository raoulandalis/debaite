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
    const payload: unknown = await response.json();
    if (isErrorBody(payload)) {
      return { ok: false, code: payload.error.code, message: payload.error.message };
    }
    if (isSpeech(payload)) {
      return { ok: true, round: payload.round, speaker: payload.speaker, text: payload.text };
    }
    return failed;
  } catch (error) {
    if (isAbort(error)) {
      return { ok: false, aborted: true };
    }
    return failed;
  }
}

function isErrorBody(
  value: unknown,
): value is { error: { code: string; message: string } } {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = value.error;
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return (
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
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
