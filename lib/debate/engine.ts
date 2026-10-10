import { getCharacter } from "@/lib/characters";
import type {
  DebateState,
  RoundId,
  SpeakerSlot,
  StepResult,
  Turn,
} from "@/lib/debate/types";
import { validateTopic } from "@/lib/debate/validation";

const ORDER = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const satisfies readonly { round: RoundId; speaker: SpeakerSlot }[];

function invalid(message: string): StepResult<never> {
  return { ok: false, code: "INVALID_INPUT", message };
}

function conflict(message: string): StepResult<never> {
  return { ok: false, code: "DEBATE_STATE_CONFLICT", message };
}

function validateModelName(name: string): StepResult<string> {
  const value = name.trim();
  if (value.length < 1 || value.length > 200 || value.includes("\0")) {
    return invalid("Model name must be 1 to 200 characters.");
  }
  return { ok: true, value };
}

export function getExpectedTurn(
  state: DebateState,
): { round: RoundId; speaker: SpeakerSlot } | null {
  if (state.status !== "in_progress") {
    return null;
  }
  return ORDER[state.turns.length] ?? null;
}

export function appendTurn(state: DebateState, turn: Turn): StepResult<DebateState> {
  const text = turn.text.trim();
  if (text.length < 1 || text.length > 4000) {
    return invalid("Speech text must be 1 to 4000 characters.");
  }

  const expected = getExpectedTurn(state);
  if (
    expected === null ||
    expected.round !== turn.round ||
    expected.speaker !== turn.speaker
  ) {
    return conflict("That speech is not the next legal turn.");
  }

  const turns = [
    ...state.turns,
    { round: turn.round, speaker: turn.speaker, text },
  ];
  return {
    ok: true,
    value: {
      ...state,
      turns,
      status: turns.length === 6 ? "awaiting_judge" : "in_progress",
    },
  };
}

export function restoreDebate(input: {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  turns: Turn[];
}): StepResult<DebateState> {
  const created = createDebate(input);
  if (!created.ok) {
    return created;
  }

  let state = created.value;
  for (const turn of input.turns) {
    const next = appendTurn(state, turn);
    if (!next.ok) {
      return next;
    }
    state = next.value;
  }
  return { ok: true, value: state };
}

export function markJudged(state: DebateState): StepResult<DebateState> {
  if (state.status !== "awaiting_judge") {
    return conflict("The debate is not ready to be judged.");
  }
  return {
    ok: true,
    value: {
      ...state,
      status: "complete",
      turns: [...state.turns],
    },
  };
}

export function createDebate(input: {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
}): StepResult<DebateState> {
  const topic = validateTopic(input.topic);
  if (!topic.ok) {
    return topic;
  }

  if (
    input.debaterAId === input.debaterBId ||
    getCharacter(input.debaterAId) === null ||
    getCharacter(input.debaterBId) === null
  ) {
    return invalid("Choose two different characters.");
  }

  const debaterAModel = validateModelName(input.debaterAModel);
  if (!debaterAModel.ok) {
    return debaterAModel;
  }
  const debaterBModel = validateModelName(input.debaterBModel);
  if (!debaterBModel.ok) {
    return debaterBModel;
  }
  const judgeModel = validateModelName(input.judgeModel);
  if (!judgeModel.ok) {
    return judgeModel;
  }

  if (
    debaterAModel.value === debaterBModel.value ||
    judgeModel.value === debaterAModel.value ||
    judgeModel.value === debaterBModel.value
  ) {
    return invalid("Speaker and judge models must all differ.");
  }

  return {
    ok: true,
    value: {
      topic: topic.value,
      debaterAId: input.debaterAId,
      debaterBId: input.debaterBId,
      debaterAModel: debaterAModel.value,
      debaterBModel: debaterBModel.value,
      judgeModel: judgeModel.value,
      status: "in_progress",
      turns: [],
    },
  };
}
