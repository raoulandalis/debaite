import { expect, test } from "vitest";
import { restoreDebate } from "@/lib/debate";
import { buildJudgeMessages } from "@/lib/judge";
import type { Turn } from "@/lib/debate";

const setup = {
  topic: "Should cities ban private cars?",
  debaterAId: "rex",
  debaterBId: "athena",
  debaterAModel: "llama3.2:latest",
  debaterBModel: "qwen2.5:7b",
  judgeModel: "gemma2:9b",
};

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

const SYSTEM = [
  "You are the judge of a debate between Debater A and Debater B.",
  "Score the arguments, not the personalities. You do not know their names.",
  "Ignore humor, confidence, sarcasm, and which side you prefer.",
  "Reward logical consistency, direct answers to the other side, supporting examples, and clear reasoning.",
  "Do not reward insults or claims that were never made.",
  "Return one JSON object and no other text.",
].join("\n");

function transcript(): Turn[] {
  return order.map((step, index) => ({
    round: step.round,
    speaker: step.speaker,
    text: `Claim number ${index + 1} about transit.`,
  }));
}

function debate() {
  const restored = restoreDebate({ ...setup, turns: transcript() });
  if (!restored.ok) {
    throw new Error(restored.message);
  }
  return restored.value;
}

test("builds the exact system message and a user message", () => {
  const [system, user] = buildJudgeMessages(debate());
  expect(system).toEqual({ role: "system", content: SYSTEM });
  expect(user.role).toBe("user");
});

test("labels each side three times and keeps names and models out", () => {
  const messages = buildJudgeMessages(debate());
  const user = messages[1].content;
  const joined = messages.map((message) => message.content).join("\n");

  expect(user.match(/Debater A/g)).toHaveLength(3);
  expect(user.match(/Debater B/g)).toHaveLength(3);
  expect(user).toContain("Topic: Should cities ban private cars?");
  expect(user).toContain("Debater A (opening):\nClaim number 1 about transit.");
  expect(user).toContain("Debater B (closing):\nClaim number 6 about transit.");
  expect(user).toContain("Reasoning 35%");
  expect(user).toContain("Rebuttals 30%");
  expect(user).toContain("Evidence 20%");
  expect(user).toContain("Clarity 15%");
  expect(user).toContain("shape example, not a score to copy");
  expect(user).toContain("Do not include weighted totals.");

  for (const forbidden of [
    "Rex",
    "Athena",
    "Provocateur",
    "Strategist",
    "llama3.2:latest",
    "qwen2.5:7b",
    "gemma2:9b",
    "jester",
  ]) {
    expect(joined).not.toContain(forbidden);
  }
});
