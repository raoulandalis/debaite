export type RoundId = "opening" | "rebuttal" | "closing";

export type SpeakerSlot = "a" | "b";

export type Turn = {
  round: RoundId;
  speaker: SpeakerSlot;
  text: string;
};

export type DebateStatus = "in_progress" | "awaiting_judge" | "complete";

export type DebateState = {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  status: DebateStatus;
  turns: Turn[];
};

export type StepResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "INVALID_INPUT" | "DEBATE_STATE_CONFLICT";
      message: string;
    };
