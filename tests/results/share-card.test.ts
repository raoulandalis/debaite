import { expect, test } from "vitest";
import { toJudgment } from "@/lib/judge";
import type { JudgeModelOutput } from "@/lib/judge";
import { buildShareCard } from "@/lib/results/share-card";

const worked = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 };
const clearer = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 };

function output(
  debaterA: JudgeModelOutput["scores"]["debaterA"],
  debaterB: JudgeModelOutput["scores"]["debaterB"],
): JudgeModelOutput {
  return {
    scores: { debaterA, debaterB },
    verdict: "Debater A buried the transcript here.",
    strongestArgument: {
      debaterA: "Debater A landed the cleanest example.",
      debaterB: "B best point.",
    },
    biggestWeakness: { debaterA: "A largest hole.", debaterB: "B largest hole." },
  };
}

test("a share card names the matchup and hides the verdict and transcript", () => {
  const card = buildShareCard({
    topic: "  Is a hot dog a sandwich?  ",
    debaterA: "Rex",
    debaterB: "Athena",
    debaterAModel: "mistral:7b",
    debaterBModel: "llama3.1:8b",
    judgment: toJudgment(output(clearer, worked)),
  });

  expect(card).toBe(
    [
      "DebAIte",
      "",
      "Is a hot dog a sandwich?",
      "",
      "Rex · mistral:7b",
      "vs",
      "Athena · llama3.1:8b",
      "",
      "Rex wins",
      "",
      "Most compelling",
      "Rex: Rex landed the cleanest example.",
    ].join("\n"),
  );
  expect(card).not.toContain("buried the transcript");
  expect(card).not.toContain("largest hole");
});
