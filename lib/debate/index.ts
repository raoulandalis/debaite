export { createDebate, getExpectedTurn, appendTurn, restoreDebate, markJudged } from "@/lib/debate/engine";
export { sameSizeBand, validateRoster } from "@/lib/debate/models";
export type { RosterResult } from "@/lib/debate/models";
export { canStart, initialSession, playbackReducer } from "@/lib/debate/playback";
export type { GameSession, PlaybackEvent, SetupPatch } from "@/lib/debate/playback";
export { DEBATER_MODELS, JUDGE_MODEL, isDebaterModel, validateModelChoice } from "@/lib/debate/roster";
export type { DebaterModel } from "@/lib/debate/roster";
export type {
  DebateState,
  DebateStatus,
  RoundId,
  SpeakerSlot,
  StepResult,
  Turn,
} from "@/lib/debate/types";
export { validateTopic } from "@/lib/debate/validation";
