export type RoundId = "opening" | "rebuttal" | "closing";

export type SpeakerSlot = "a" | "b";

export type Turn = {
  round: RoundId;
  speaker: SpeakerSlot;
  text: string;
};
