import type { StepResult } from "@/lib/debate/types";

export function validateTopic(topic: string): StepResult<string> {
  const value = topic.trim();
  if (value.length < 8 || value.length > 240 || value.includes("\0")) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Topic must be 8 to 240 characters.",
    };
  }
  return { ok: true, value };
}
