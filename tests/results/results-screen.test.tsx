import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ResultsScreen } from "@/components/results/results-screen";
import { getCharacter } from "@/lib/characters";
import type { Turn } from "@/lib/debate";
import { toJudgment } from "@/lib/judge";
import type { JudgeModelOutput, Judgment } from "@/lib/judge";

const worked = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 };
const clearer = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 };

const turns: Turn[] = [
  { round: "opening", speaker: "a", text: "Schools need teachers." },
  { round: "closing", speaker: "b", text: "Classrooms need judgment." },
];

function output(
  debaterA: JudgeModelOutput["scores"]["debaterA"],
  debaterB: JudgeModelOutput["scores"]["debaterB"],
): JudgeModelOutput {
  return {
    scores: { debaterA, debaterB },
    verdict: "The stronger case answered the other side.",
    strongestArgument: { debaterA: "A best point.", debaterB: "B best point." },
    biggestWeakness: { debaterA: "A largest hole.", debaterB: "B largest hole." },
  };
}

function characters() {
  const rex = getCharacter("rex");
  const athena = getCharacter("athena");
  if (rex === null || athena === null) {
    throw new Error("Missing fixture characters.");
  }
  return { rex, athena };
}

function renderResults(judgment: Judgment) {
  const { rex, athena } = characters();
  const onEvent = vi.fn();
  render(
    <ResultsScreen
      debaterA={rex}
      debaterAModel="mistral:7b"
      debaterB={athena}
      debaterBModel="llama3.1:8b"
      judgeModel="gemma2:9b"
      judgment={judgment}
      turns={turns}
      onEvent={onEvent}
    />,
  );
  return onEvent;
}

test("a Rex win shows the verdict, scores, criteria, and disclaimer", () => {
  const onEvent = renderResults(toJudgment(output(clearer, worked)));

  const outcome = screen.getByRole("heading", { level: 2, name: "Rex wins" });
  expect(outcome).toHaveFocus();
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getAllByText("mistral:7b").length).toBeGreaterThan(0);
  expect(screen.getAllByText("llama3.1:8b").length).toBeGreaterThan(0);
  expect(screen.getByText("Judge model: gemma2:9b")).toBeInTheDocument();
  expect(screen.getByText("68.00")).toBeInTheDocument();
  expect(screen.getByText("66.50")).toBeInTheDocument();
  expect(screen.getAllByText("Weighted score").length).toBe(2);
  expect(screen.getByText("Reasoning and logical consistency")).toBeInTheDocument();
  expect(screen.getByText("Rebuttals and engagement with the opponent")).toBeInTheDocument();
  expect(screen.getByText("Evidence, examples, and supporting arguments")).toBeInTheDocument();
  expect(screen.getByText("Clarity and persuasiveness")).toBeInTheDocument();
  expect(screen.getByText("35%")).toBeInTheDocument();
  expect(screen.getByText("30%")).toBeInTheDocument();
  expect(screen.getByText("20%")).toBeInTheDocument();
  expect(screen.getByText("15%")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Verdict" })).toBeInTheDocument();
  expect(screen.getByText("The stronger case answered the other side.")).toBeInTheDocument();
  expect(screen.getByText("A best point.")).toBeInTheDocument();
  expect(screen.getByText("B best point.")).toBeInTheDocument();
  expect(screen.getByText("A largest hole.")).toBeInTheDocument();
  expect(screen.getByText("B largest hole.")).toBeInTheDocument();
  expect(
    screen.getByText("This verdict is an AI-generated evaluation, not an objective ruling."),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Transcript" })).toBeInTheDocument();
  expect(screen.getByText("Schools need teachers.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Play again" }));
  fireEvent.click(screen.getByRole("button", { name: "New debate" }));
  expect(onEvent).toHaveBeenNthCalledWith(1, { type: "play_again" });
  expect(onEvent).toHaveBeenNthCalledWith(2, { type: "new_debate" });
});

test("a tie heading does not name a winner", () => {
  renderResults(toJudgment(output(worked, worked)));

  expect(screen.getByRole("heading", { level: 2, name: "Tie" })).toBeInTheDocument();
  expect(screen.queryByText(/wins/)).not.toBeInTheDocument();
});
