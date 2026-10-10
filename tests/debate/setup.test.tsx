import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SetupForm } from "@/components/setup/setup-form";
import { initialSession, playbackReducer } from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";

const catalog = [
  { name: "mistral:7b", parameterBillions: 7.2 },
  { name: "qwen2.5:7b", parameterBillions: 7.6 },
  { name: "llama3.1:8b", parameterBillions: 8 },
  { name: "gemma2:9b", parameterBillions: 9.2 },
  { name: "llama3.2:latest", parameterBillions: 3.2 },
];

const helper =
  "Enter a topic of at least 8 characters, choose two different characters, and choose two installed debater models.";

function renderForm(
  session: GameSession = initialSession(),
  models = catalog,
  onEvent: (event: PlaybackEvent) => void = vi.fn(),
) {
  render(<SetupForm session={session} models={models} onEvent={onEvent} />);
  return onEvent;
}

function choose(session: GameSession, patch: PlaybackEvent & { type: "edit_setup" }) {
  return playbackReducer(session, patch);
}

test("lists only the debater roster and keeps start disabled for a short topic", () => {
  const session = playbackReducer(initialSession(), {
    type: "edit_setup",
    patch: { topicDraft: "1234567" },
  });
  renderForm(session);

  expect(screen.getByLabelText("Debate topic")).toHaveValue("1234567");
  expect(screen.getByText(/Yes\/no and "Should" questions work well/)).toBeInTheDocument();
  expect(screen.getAllByRole("option", { name: "mistral:7b (7.2B)" })).toHaveLength(2);
  expect(screen.getAllByRole("option", { name: "qwen2.5:7b (7.6B)" })).toHaveLength(2);
  expect(screen.getAllByRole("option", { name: "llama3.1:8b (8B)" })).toHaveLength(2);
  expect(screen.queryByRole("option", { name: /llama3\.2/ })).not.toBeInTheDocument();
  expect(screen.getByText(/gemma2:9b \(9\.2B\)/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start debate" })).toBeDisabled();
  expect(screen.getByText(helper)).toBeInTheDocument();
  expect(screen.queryByText(/You are Rex/)).not.toBeInTheDocument();
});

test("enables start for a valid topic, characters, and two installed debaters", () => {
  let session = initialSession();
  session = choose(session, {
    type: "edit_setup",
    patch: { topicDraft: "Should AI replace human teachers?" },
  });
  session = choose(session, { type: "edit_setup", patch: { debaterAId: "rex" } });
  session = choose(session, { type: "edit_setup", patch: { debaterBId: "athena" } });
  session = choose(session, { type: "edit_setup", patch: { debaterAModel: "mistral:7b" } });
  session = choose(session, { type: "edit_setup", patch: { debaterBModel: "llama3.1:8b" } });
  const onEvent = renderForm(session);

  const start = screen.getByRole("button", { name: "Start debate" });
  expect(start).toBeEnabled();
  expect(screen.queryByText(helper)).not.toBeInTheDocument();
  fireEvent.click(start);
  expect(onEvent).toHaveBeenCalledWith({ type: "start" });
});

test("disables a character or model that the other slot already chose", () => {
  let session = initialSession();
  session = choose(session, { type: "edit_setup", patch: { debaterAId: "rex" } });
  session = choose(session, { type: "edit_setup", patch: { debaterAModel: "mistral:7b" } });
  renderForm(session);

  expect(screen.getByRole("button", { name: "Rex, Already chosen" })).toBeDisabled();
  expect(screen.getAllByText("Selected").length).toBeGreaterThan(0);
  expect(screen.getByRole("option", { name: /mistral:7b \(7\.2B\), Already chosen/ })).toBeDisabled();
});

test("keeps start disabled when a chosen debater or the judge is not installed", () => {
  let session = initialSession();
  session = choose(session, {
    type: "edit_setup",
    patch: {
      topicDraft: "Should AI replace human teachers?",
      debaterAId: "rex",
      debaterBId: "athena",
      debaterAModel: "mistral:7b",
      debaterBModel: "llama3.1:8b",
    },
  });

  const { unmount } = render(
    <SetupForm
      session={session}
      models={catalog.filter((model) => model.name !== "mistral:7b")}
      onEvent={vi.fn()}
    />,
  );
  expect(screen.getByRole("option", { name: /mistral:7b, Not installed/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Start debate" })).toBeDisabled();
  unmount();

  render(
    <SetupForm
      session={session}
      models={catalog.filter((model) => model.name !== "gemma2:9b")}
      onEvent={vi.fn()}
    />,
  );
  expect(screen.getByText(/gemma2:9b, Not installed/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start debate" })).toBeDisabled();
});
