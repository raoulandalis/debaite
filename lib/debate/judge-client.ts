import type { Turn } from "@/lib/debate/types";

export type JudgeRequestBody = {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  transcript: Turn[];
};

const failed = {
  ok: false as const,
  code: "INVALID_MODEL_OUTPUT",
  message: "The judge response could not be verified. You can retry.",
};

export async function requestJudge(
  body: JudgeRequestBody,
  signal: AbortSignal,
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; aborted: true }
  | { ok: false; code: string; message: string }
> {
  try {
    const response = await fetch("/api/debate/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const payload: unknown = await readJson(response);
    if (payload === null) {
      return failed;
    }
    if (isErrorBody(payload)) {
      return { ok: false, code: payload.error.code, message: payload.error.message };
    }
    if (typeof payload === "object") {
      return { ok: true, body: payload };
    }
    return failed;
  } catch (error) {
    if (isAbort(error)) {
      return { ok: false, aborted: true };
    }
    return failed;
  }
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
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

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
