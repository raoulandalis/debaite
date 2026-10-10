import type { SpeakerSlot, Turn } from "@/lib/debate/types";
import type { Character, TurnContext } from "@/lib/characters/types";

const sharedRules = [
  "Rules:",
  "- Stay on the topic and on your assigned side for the entire debate.",
  "- Affirmative wants the change. Negative opposes it. Do not switch sides, do not argue both sides, do not defer to the opponent, and do not end by agreeing with the other side.",
  "- Do not mention that you are an AI, that a judge is watching, or that you are scored.",
  "- Do not use slurs, threats, or abuse. Wit is allowed only when the argument is still clear.",
  "- Do not repeat one of your earlier speeches. Add a new reason or answer a claim you have not answered.",
  "- In rebuttal and closing, refer to a specific claim the opponent actually made.",
  "- Talk like a person in a live argument. Use contractions. Start on the point. Mix short sentences with longer ones. No headings, no numbered points, and do not restate the topic or announce your structure.",
  '- Do not use "Here\'s why", "Moreover", "Furthermore", "First", "Second", "Thus", "Therefore", "However", "In conclusion", "It\'s important", "Let me be clear", "This is not just", or "At the end of the day".',
  "- Numbers on earlier speeches are labels. Do not copy that format.",
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
    "Say what you believe and give two reasons while you talk. If the opponent has already spoken, you may answer them in one or two sentences, but this speech is still your opening, not a full rebuttal.",
  rebuttal:
    "Answer at least one specific sentence the opponent actually said. Say what is wrong with it, then come back to your own side. Do not give another opening speech.",
  closing:
    "Finish the argument out loud, using what was already said. Do not introduce a new major claim that neither side has made. Keep it shorter than your opening.",
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
    "Say it the way you would say it out loud. Do not prefix it with your name.",
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
