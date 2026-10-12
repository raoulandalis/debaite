import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    verdict: "Debater A answered Debater B.",
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
      topic="Is a hot dog a sandwich?"
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

test("a Rex win shows the verdict, scores, criteria, and disclaimer", async () => {
  const onEvent = renderResults(toJudgment(output(clearer, worked)));

  const outcome = screen.getByRole("heading", { level: 2, name: "Rex wins" });
  expect(outcome).toHaveFocus();
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getAllByText("mistral:7b").length).toBeGreaterThan(0);
  expect(screen.getAllByText("llama3.1:8b").length).toBeGreaterThan(0);
  expect(screen.getByText("Judge model: gemma2:9b")).toBeInTheDocument();
  expect(screen.queryByText("Nubi")).not.toBeInTheDocument();
  expect(screen.queryByText("The Weigher")).not.toBeInTheDocument();
  const rex = screen.getByRole("heading", { level: 3, name: "Rex" });
  const athena = screen.getByRole("heading", { level: 3, name: "Athena" });
  expect(rex.compareDocumentPosition(athena) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
  expect(screen.getByText("Rex answered Athena.")).toBeInTheDocument();
  expect(screen.queryByText(/Debater [AB]/)).not.toBeInTheDocument();
  expect(screen.getByText("A best point.")).toBeInTheDocument();
  expect(screen.getByText("B best point.")).toBeInTheDocument();
  expect(screen.getByText("A largest hole.")).toBeInTheDocument();
  expect(screen.getByText("B largest hole.")).toBeInTheDocument();
  expect(
    screen.getByText("This verdict is an AI-generated evaluation, not an objective ruling."),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Transcript" })).toBeInTheDocument();
  expect(screen.getByText("Schools need teachers.")).toBeInTheDocument();

  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  const shared = String(writeText.mock.calls[0]?.[0]);
  expect(shared).toContain("Is a hot dog a sandwich?");
  expect(shared).toContain("Rex · mistral:7b");
  expect(shared).toContain("Athena · llama3.1:8b");
  expect(shared).not.toContain("Schools need teachers.");
  expect(await screen.findByRole("status")).toHaveTextContent("Copied to clipboard.");

  fireEvent.click(screen.getByRole("button", { name: "Play again" }));
  fireEvent.click(screen.getByRole("button", { name: "New debate" }));
  expect(onEvent).toHaveBeenNthCalledWith(1, { type: "play_again" });
  expect(onEvent).toHaveBeenNthCalledWith(2, { type: "new_debate" });
});

test("a tie heading does not name a winner", () => {
  renderResults(toJudgment(output(worked, worked)));

  expect(screen.getByRole("heading", { level: 2, name: "Tie" })).toBeInTheDocument();
  expect(screen.queryByText("Nubi")).not.toBeInTheDocument();
  expect(screen.queryByText(/wins/)).not.toBeInTheDocument();
});

test("the winner's card comes before the other fighter", () => {
  renderResults(toJudgment(output(worked, clearer)));

  const athena = screen.getByRole("heading", { level: 3, name: "Athena" });
  const rex = screen.getByRole("heading", { level: 3, name: "Rex" });
  expect(athena.compareDocumentPosition(rex) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
