import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DebateScreen } from "@/components/debate/debate-screen";
import { initialSession, playbackReducer } from "@/lib/debate";
import type { GameSession, Turn } from "@/lib/debate";

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

function started(): GameSession {
  let session = playbackReducer(initialSession(), {
    type: "edit_setup",
    patch: {
      topicDraft: "Should AI replace human teachers?",
      debaterAId: "rex",
      debaterBId: "athena",
      debaterAModel: "mistral:7b",
      debaterBModel: "llama3.1:8b",
    },
  });
  session = playbackReducer(session, { type: "start" });
  return session;
}

function speech(index: number, text = `Speech ${index + 1}`): Turn {
  const step = order[index];
  return { round: step.round, speaker: step.speaker, text };
}

test("a stored opening shows the speaker, model, side, and round", () => {
  const session = playbackReducer(playbackReducer(started(), { type: "pause" }), {
    type: "turn_succeeded",
    turn: speech(0, "Schools need teachers."),
  });
  render(<DebateScreen session={session} onEvent={vi.fn()} />);

  expect(screen.getByText("Rex")).toBeInTheDocument();
  expect(screen.getByText("mistral:7b")).toBeInTheDocument();
  expect(screen.getByText("For")).toBeInTheDocument();
  expect(screen.getAllByText("Opening").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Schools need teachers.").length).toBeGreaterThan(0);
});

test("pending opening B announces Athena", () => {
  let session = started();
  session = playbackReducer(session, { type: "turn_succeeded", turn: speech(0) });
  render(<DebateScreen session={session} onEvent={vi.fn()} />);

  expect(screen.getByText("Athena is making the opening argument.")).toBeInTheDocument();
});

test("an error offers retry and does not show a score or winner", () => {
  const session = playbackReducer(started(), {
    type: "turn_failed",
    error: { code: "OLLAMA_TIMEOUT", message: "Ollama took too long to respond." },
  });
  const onEvent = vi.fn();
  render(<DebateScreen session={session} onEvent={onEvent} />);

  expect(screen.getByText("Ollama took too long to respond.")).toBeInTheDocument();
  expect(screen.getByText("Something went wrong. You can retry this turn.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry turn" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "retry" });
  expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/winner/i)).not.toBeInTheDocument();
});

test("six speeches are ready for the judge", () => {
  let session = started();
  for (let index = 0; index < 6; index += 1) {
    session = playbackReducer(session, { type: "turn_succeeded", turn: speech(index) });
  }
  render(<DebateScreen session={session} onEvent={vi.fn()} />);

  expect(screen.getByText("The debate is ready for the judge.")).toBeInTheDocument();
  expect(screen.queryByText("Current")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry turn" })).not.toBeInTheDocument();
});
