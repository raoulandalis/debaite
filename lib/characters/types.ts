import type { RoundId } from "@/lib/debate/types";

export type Character = {
  id: "rex" | "athena" | "jester";
  name: string;
  title: string;
  summary: string;
  accentToken: "rex" | "athena" | "jester";
  monogram: "R" | "A" | "J";
  systemPrompt: string;
};

export type TurnContext = {
  topic: string;
  side: "affirmative" | "negative";
  round: RoundId;
  ownStatements: string[];
  opponentStatements: string[];
};
