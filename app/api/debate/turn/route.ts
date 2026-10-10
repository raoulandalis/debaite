import { connection } from "next/server";
import { z } from "zod";
import { buildTurnMessages, getCharacter, statementsForSpeaker } from "@/lib/characters";
import { getExpectedTurn, restoreDebate, validateRoster } from "@/lib/debate";
import { validateModelChoice } from "@/lib/debate/roster";
import type { DebateState, SpeakerSlot } from "@/lib/debate";
import { generate, listInstalledModels } from "@/lib/ollama/client";

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

const turnRequestSchema = z.object({
  topic: z.string(),
  debaterAId: z.string(),
  debaterBId: z.string(),
  debaterAModel: z.string(),
  debaterBModel: z.string(),
  judgeModel: z.string(),
  round: z.enum(["opening", "rebuttal", "closing"]),
  speaker: z.enum(["a", "b"]),
  transcript: z.array(turnSchema),
});

export async function POST(request: Request) {
  await connection();

  const body = await readBody(request);
  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", "The turn request is invalid.");
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

  const expected = getExpectedTurn(restored.value);
  if (
    expected === null ||
    expected.round !== parsed.data.round ||
    expected.speaker !== parsed.data.speaker
  ) {
    return errorResponse("DEBATE_STATE_CONFLICT", "That speech is not the next legal turn.");
  }

  const choice = validateModelChoice(restored.value);
  if (!choice.ok) {
    return errorResponse(choice.code, choice.message);
  }

  const catalog = await listInstalledModels();
  if (!catalog.ok) {
    return errorResponse(catalog.code, catalog.message);
  }
  const roster = validateRoster(catalog.models, restored.value);
  if (!roster.ok) {
    return errorResponse(roster.code, roster.message);
  }

  const speaker = parsed.data.speaker;
  const character = getCharacter(speakerId(restored.value, speaker));
  if (character === null) {
    return errorResponse("INVALID_INPUT", "Choose two different characters.");
  }

  const statements = statementsForSpeaker(restored.value.turns, speaker);
  const generated = await generate({
    messages: buildTurnMessages(character, {
      topic: restored.value.topic,
      side: speaker === "a" ? "affirmative" : "negative",
      round: parsed.data.round,
      ownStatements: statements.ownStatements,
      opponentStatements: statements.opponentStatements,
    }),
    model: speaker === "a" ? restored.value.debaterAModel : restored.value.debaterBModel,
    temperature: 0.8,
    numPredict: parsed.data.round === "closing" ? 240 : 320,
  });
  if (!generated.ok) {
    return errorResponse(generated.code, generated.message);
  }

  const text = generated.text.trim();
  if (text.length < 1 || text.length > 4000) {
    return errorResponse("INVALID_MODEL_OUTPUT", "The speech was empty or too long.");
  }

  return Response.json({ round: parsed.data.round, speaker, text });
}

function speakerId(debate: DebateState, speaker: SpeakerSlot): string {
  return speaker === "a" ? debate.debaterAId : debate.debaterBId;
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function errorResponse(code: ErrorCode, message: string) {
  return Response.json({ error: { code, message } }, { status: HTTP_STATUS[code] });
}
