import type { SpeakerSlot, Turn } from "@/lib/debate/types";
import type { Character, TurnContext } from "@/lib/characters/types";

const sharedRules = [
  "Rules:",
  "- Stay on the topic and on your assigned side for the entire debate.",
  "- Do not switch sides, do not argue both sides, and do not defer to the opponent.",
  "- Do not mention that you are an AI, that a judge is watching, or that you are scored.",
  "- Do not use slurs, threats, or abuse. Wit is allowed only when the argument is still clear.",
  "- Do not repeat one of your earlier speeches. Add a new reason or answer a claim you have not answered.",
  "- In rebuttal and closing, refer to a specific claim the opponent actually made.",
  "- Follow the word limit for this round.",
  "- Output only the spoken argument.",
].join("\n");

const sideInstructions = {
  affirmative:
    "Defend the topic. If it is a question, argue yes. If it is vague, pick one clear reading and defend that reading for the rest of the debate.",
  negative:
    "Oppose the topic. If it is a question, argue no. If the opponent has already chosen a reading, attack that reading instead of changing the subject.",
} as const;

const roundTasks = {
  opening:
    "Present your position and two reasons. If opponent statements exist, you may contrast them in one or two sentences, but this speech is still your opening, not a full rebuttal.",
  rebuttal:
    "Answer at least one specific sentence from the opponent's statements. Say what is wrong with it, then strengthen your own side. Do not give another opening speech.",
  closing:
    "Give the strongest final case for your side using what was already argued. Do not introduce a new major claim that neither side has made. Keep it shorter than your opening.",
} as const;

function wordLimit(round: TurnContext["round"]): string {
  if (round === "closing") {
    return "Word limit: 60 to 100 words.";
  }
  return "Word limit: 80 to 140 words.";
}

function listStatements(statements: string[]): string {
  if (statements.length === 0) {
    return "None yet.";
  }
  return statements.map((text, index) => `${index + 1}. ${text}`).join("\n");
}

export function buildTurnMessages(
  character: Character,
  context: TurnContext,
): { role: "system" | "user"; content: string }[] {
  const system = [character.systemPrompt, sharedRules, wordLimit(context.round)].join(
    "\n\n",
  );
  const user = [
    `Topic: ${context.topic}`,
    `Your side: ${context.side}`,
    `Round: ${context.round}`,
    "",
    "Side instructions:",
    sideInstructions[context.side],
    "",
    "Round task:",
    roundTasks[context.round],
    "",
    "YOUR PREVIOUS STATEMENTS:",
    listStatements(context.ownStatements),
    "",
    "OPPONENT STATEMENTS:",
    listStatements(context.opponentStatements),
    "",
    "Write only your next speech. Do not prefix it with your name.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function statementsForSpeaker(
  turns: Turn[],
  speaker: SpeakerSlot,
): { ownStatements: string[]; opponentStatements: string[] } {
  const ownStatements: string[] = [];
  const opponentStatements: string[] = [];
  for (const turn of turns) {
    if (turn.speaker === speaker) {
      ownStatements.push(turn.text);
    } else {
      opponentStatements.push(turn.text);
    }
  }
  return { ownStatements, opponentStatements };
}
