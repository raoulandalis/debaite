import { connection } from "next/server";
import { z } from "zod";
import { restoreDebate, validateRoster } from "@/lib/debate";
import type { DebateState } from "@/lib/debate";
import { buildJudgeMessages, parseJudgeOutput, toJudgment } from "@/lib/judge";
import { generate, listInstalledModels } from "@/lib/ollama/client";
import type { GenerateResult } from "@/lib/ollama/errors";

const HTTP_STATUS = {
  INVALID_INPUT: 400,
  DEBATE_STATE_CONFLICT: 409,
  OLLAMA_UNAVAILABLE: 502,
  OLLAMA_TIMEOUT: 504,
  MODEL_ERROR: 502,
  INVALID_MODEL_OUTPUT: 502,
} as const;

type ErrorCode = keyof typeof HTTP_STATUS;

const turnSchema = z.object({
  round: z.enum(["opening", "rebuttal", "closing"]),
  speaker: z.enum(["a", "b"]),
  text: z.string(),
});

const judgeRequestSchema = z.object({
  topic: z.string(),
  debaterAId: z.string(),
  debaterBId: z.string(),
  debaterAModel: z.string(),
  debaterBModel: z.string(),
  judgeModel: z.string(),
  transcript: z.array(turnSchema),
});

export async function POST(request: Request) {
  await connection();

  const body = await readBody(request);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("INVALID_INPUT", "The judge request is invalid.");
  }

  const parsed = judgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", "The judge request is invalid.");
  }

  const restored = restoreDebate({
    topic: parsed.data.topic,
    debaterAId: parsed.data.debaterAId,
    debaterBId: parsed.data.debaterBId,
    debaterAModel: parsed.data.debaterAModel,
    debaterBModel: parsed.data.debaterBModel,
    judgeModel: parsed.data.judgeModel,
    turns: parsed.data.transcript,
  });
  if (!restored.ok) {
    return errorResponse(restored.code, restored.message);
  }
  if (restored.value.status !== "awaiting_judge") {
    return errorResponse("DEBATE_STATE_CONFLICT", "The debate is not ready for the judge.");
  }

  const catalog = await listInstalledModels();
  if (!catalog.ok) {
    return errorResponse(catalog.code, catalog.message);
  }
  const roster = validateRoster(catalog.models, restored.value);
  if (!roster.ok) {
    return errorResponse(roster.code, roster.message);
  }

  const messages = buildJudgeMessages(restored.value);
  const first = await generateJudgment(restored.value, messages);
  if (!first.ok) {
    return errorResponse(first.code, first.message);
  }

  const firstOutput = parseJudgeOutput(first.text);
  if (firstOutput) {
    return Response.json(toJudgment(firstOutput));
  }

  const second = await generateJudgment(restored.value, messages);
  if (!second.ok) {
    return errorResponse(second.code, second.message);
  }
  const secondOutput = parseJudgeOutput(second.text);
  if (!secondOutput) {
    return errorResponse(
      "INVALID_MODEL_OUTPUT",
      "The judge response was not valid scoring JSON.",
    );
  }
  return Response.json(toJudgment(secondOutput));
}

async function readBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function generateJudgment(
  debate: DebateState,
  messages: ReturnType<typeof buildJudgeMessages>,
): Promise<GenerateResult> {
  return generate({
    messages,
    model: debate.judgeModel,
    json: true,
    temperature: 0.3,
    numPredict: 900,
  });
}

function errorResponse(code: ErrorCode, message: string) {
  return Response.json(
    { error: { code, message } },
    { status: HTTP_STATUS[code] },
  );
}
