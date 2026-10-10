import { appendTurn, createDebate, getExpectedTurn } from "@/lib/debate/engine";
import { sameSizeBand } from "@/lib/debate/models";
import { isDebaterModel, JUDGE_MODEL } from "@/lib/debate/roster";
import type { DebateState, RoundId, SpeakerSlot, Turn } from "@/lib/debate/types";
import { validateTopic } from "@/lib/debate/validation";

export type GameSession = {
  phase: "setup" | "debate" | "results";
  topicDraft: string;
  debaterAId: string | null;
  debaterBId: string | null;
  debaterAModel: string | null;
  debaterBModel: string | null;
  judgeModel: string | null;
  debate: DebateState | null;
  judgment: null;
  playback: "running" | "paused";
  pending: null | { kind: "turn"; round: RoundId; speaker: SpeakerSlot };
  error: null | { code: string; message: string };
};

export type SetupPatch = {
  topicDraft?: string;
  debaterAId?: string | null;
  debaterBId?: string | null;
  debaterAModel?: string | null;
  debaterBModel?: string | null;
};

export type PlaybackEvent =
  | { type: "edit_setup"; patch: SetupPatch }
  | { type: "start" }
  | { type: "turn_succeeded"; turn: Turn }
  | { type: "turn_failed"; error: { code: string; message: string } }
  | { type: "pause" }
  | { type: "cancel" }
  | { type: "resume" }
  | { type: "retry" };

type CatalogModel = { name: string; parameterBillions: number | null };

export function initialSession(): GameSession {
  return {
    phase: "setup",
    topicDraft: "",
    debaterAId: null,
    debaterBId: null,
    debaterAModel: null,
    debaterBModel: null,
    judgeModel: null,
    debate: null,
    judgment: null,
    playback: "paused",
    pending: null,
    error: null,
  };
}

export function canStart(input: {
  topic: string;
  debaterAId: string | null;
  debaterBId: string | null;
  debaterAModel: string | null;
  debaterBModel: string | null;
  judgeModel: string | null;
  models: CatalogModel[];
}): boolean {
  if (!validateTopic(input.topic).ok) {
    return false;
  }
  if (
    input.debaterAId === null ||
    input.debaterBId === null ||
    input.debaterAId === input.debaterBId
  ) {
    return false;
  }
  if (
    input.debaterAModel === null ||
    input.debaterBModel === null ||
    input.debaterAModel === input.debaterBModel ||
    !isDebaterModel(input.debaterAModel) ||
    !isDebaterModel(input.debaterBModel)
  ) {
    return false;
  }
  const left = speakerSize(input.models, input.debaterAModel);
  const right = speakerSize(input.models, input.debaterBModel);
  if (left === null || right === null || !sameSizeBand(left, right)) {
    return false;
  }
  return input.models.some((model) => model.name === JUDGE_MODEL);
}

export function playbackReducer(state: GameSession, event: PlaybackEvent): GameSession {
  switch (event.type) {
    case "edit_setup":
      return editSetup(state, event.patch);
    case "start":
      return startDebate(state);
    case "turn_succeeded":
      return succeedTurn(state, event.turn);
    case "turn_failed":
      return {
        ...state,
        pending: null,
        playback: "paused",
        error: event.error,
      };
    case "pause":
      return { ...state, playback: "paused" };
    case "cancel":
      return { ...state, pending: null, playback: "paused" };
    case "resume":
    case "retry":
      return requestExpected(state);
    default:
      return state;
  }
}

function editSetup(state: GameSession, patch: SetupPatch): GameSession {
  if (state.phase !== "setup") {
    return state;
  }
  const next: GameSession = { ...state, ...patch };
  if (
    next.judgeModel !== null &&
    (next.judgeModel === next.debaterAModel || next.judgeModel === next.debaterBModel)
  ) {
    next.judgeModel = null;
  }
  return next;
}

function startDebate(state: GameSession): GameSession {
  if (state.phase !== "setup" || state.pending !== null) {
    return state;
  }
  if (
    state.debaterAId === null ||
    state.debaterBId === null ||
    state.debaterAModel === null ||
    state.debaterBModel === null
  ) {
    return {
      ...state,
      error: { code: "INVALID_INPUT", message: "Choose two different characters and models." },
    };
  }
  const created = createDebate({
    topic: state.topicDraft,
    debaterAId: state.debaterAId,
    debaterBId: state.debaterBId,
    debaterAModel: state.debaterAModel,
    debaterBModel: state.debaterBModel,
    judgeModel: JUDGE_MODEL,
  });
  if (!created.ok) {
    return { ...state, error: { code: created.code, message: created.message } };
  }
  return {
    ...state,
    phase: "debate",
    judgeModel: JUDGE_MODEL,
    debate: created.value,
    judgment: null,
    playback: "running",
    pending: { kind: "turn", round: "opening", speaker: "a" },
    error: null,
  };
}

function succeedTurn(state: GameSession, turn: Turn): GameSession {
  if (
    state.pending?.kind !== "turn" ||
    state.pending.round !== turn.round ||
    state.pending.speaker !== turn.speaker ||
    state.debate === null
  ) {
    return state;
  }
  const appended = appendTurn(state.debate, turn);
  if (!appended.ok) {
    return state;
  }
  const debate = appended.value;
  if (debate.status === "awaiting_judge" || state.playback !== "running") {
    return { ...state, debate, error: null, pending: null };
  }
  const expected = getExpectedTurn(debate);
  if (expected === null) {
    return { ...state, debate, error: null, pending: null };
  }
  return {
    ...state,
    debate,
    error: null,
    pending: { kind: "turn", round: expected.round, speaker: expected.speaker },
  };
}

function requestExpected(state: GameSession): GameSession {
  if (state.pending !== null || state.debate === null) {
    return state;
  }
  const expected = getExpectedTurn(state.debate);
  if (expected === null) {
    return state;
  }
  return {
    ...state,
    playback: "running",
    error: null,
    pending: { kind: "turn", round: expected.round, speaker: expected.speaker },
  };
}

function speakerSize(models: CatalogModel[], name: string): number | null {
  const found = models.find((model) => model.name === name);
  if (
    found === undefined ||
    found.parameterBillions === null ||
    found.parameterBillions <= 0
  ) {
    return null;
  }
  return found.parameterBillions;
}
