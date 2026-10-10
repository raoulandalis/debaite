import { judgeModelOutputSchema, type JudgeModelOutput } from "@/lib/judge/schema";

const FENCE = /^```json\s*([\s\S]*?)\s*```$/;

export function parseJudgeOutput(raw: string): JudgeModelOutput | null {
  let text = raw.replace(/^\uFEFF/, "");
  const fenced = text.match(FENCE);
  if (fenced?.[1] !== undefined) {
    text = fenced[1];
  }

  const parsed = tryJson(text) ?? tryJson(sliceObject(text));
  if (parsed === null) {
    return null;
  }
  const result = judgeModelOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

function tryJson(text: string | null): unknown | null {
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sliceObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}
