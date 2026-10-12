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

test("a finished speech waits until Next argument", () => {
  const session = playbackReducer(started(), {
    type: "turn_succeeded",
    turn: speech(0, "Schools need teachers."),
  });
  const onEvent = vi.fn();
  render(<DebateScreen session={session} onEvent={onEvent} />);

  expect(screen.getByText("Rex's opening argument is ready.")).toBeInTheDocument();
  expect(screen.queryByText("Athena is making the opening argument.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next argument" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "resume" });
});

test("pending opening B announces Athena", () => {
  let session = started();
  session = playbackReducer(session, { type: "turn_succeeded", turn: speech(0) });
  session = playbackReducer(session, { type: "resume" });
  render(<DebateScreen session={session} onEvent={vi.fn()} />);

  expect(screen.getByText("Athena is making the opening argument.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Next argument" })).not.toBeInTheDocument();
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

test("a paused sixth speech offers Judge the debate", () => {
  let session = started();
  for (let index = 0; index < 5; index += 1) {
    session = playbackReducer(session, { type: "turn_succeeded", turn: speech(index) });
    session = playbackReducer(session, { type: "resume" });
  }
  session = playbackReducer(session, { type: "pause" });
  session = playbackReducer(session, { type: "turn_succeeded", turn: speech(5) });
  const onEvent = vi.fn();
  render(<DebateScreen session={session} onEvent={onEvent} />);

  expect(screen.getByText("Athena's closing argument is ready.")).toBeInTheDocument();
  expect(screen.getByText("The debate is ready for the judge.")).toBeInTheDocument();
  expect(screen.queryByText("Current")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry turn" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Judge the debate" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "judge_started" });
  expect(screen.queryByText("Weighted score")).not.toBeInTheDocument();
  expect(
    screen.queryByText("This verdict is an AI-generated evaluation, not an objective ruling."),
  ).not.toBeInTheDocument();
});

test("judge pending shows the scoring line and no scores", () => {
  let session = started();
  for (let index = 0; index < 6; index += 1) {
    if (index > 0) {
      session = playbackReducer(session, { type: "resume" });
    }
    session = playbackReducer(session, { type: "turn_succeeded", turn: speech(index) });
  }
  session = playbackReducer(session, { type: "judge_started" });
  const onEvent = vi.fn();
  render(<DebateScreen session={session} onEvent={onEvent} />);

  expect(screen.getByText("The judge is scoring the debate.")).toBeInTheDocument();
  expect(screen.queryByText("Weighted score")).not.toBeInTheDocument();
  expect(
    screen.queryByText("This verdict is an AI-generated evaluation, not an objective ruling."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel judging" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "cancel" });
  expect(screen.queryByRole("button", { name: "Cancel turn" })).not.toBeInTheDocument();
});

test("a judging failure keeps the speeches and offers retry", () => {
  let session = started();
  for (let index = 0; index < 6; index += 1) {
    if (index > 0) {
      session = playbackReducer(session, { type: "resume" });
    }
    session = playbackReducer(session, { type: "turn_succeeded", turn: speech(index) });
  }
  session = playbackReducer(session, { type: "judge_started" });
  session = playbackReducer(session, {
    type: "judge_failed",
    error: { code: "OLLAMA_TIMEOUT", message: "Ollama took too long to respond." },
  });
  const onEvent = vi.fn();
  render(<DebateScreen session={session} onEvent={onEvent} />);

  expect(screen.getAllByText("Speech 1").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Speech 6").length).toBeGreaterThan(0);
  expect(screen.getByText("Ollama took too long to respond.")).toBeInTheDocument();
  expect(screen.getByText("Judging failed. You can retry.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry judging" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "retry" });
  expect(screen.queryByRole("button", { name: "Retry turn" })).not.toBeInTheDocument();
  expect(screen.queryByText("Weighted score")).not.toBeInTheDocument();
});
