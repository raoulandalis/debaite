import { fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(screen.getByLabelText("Debate topic")).toHaveAttribute(
    "placeholder",
    "e.g. Is a hot dog a sandwich?",
  );
  expect(screen.queryByText(/yes\/no|Should/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole("option", { name: "mistral:7b (7.2B)" })).toHaveLength(2);
  expect(screen.getAllByRole("option", { name: "qwen2.5:7b (7.6B)" })).toHaveLength(2);
  expect(screen.getAllByRole("option", { name: "llama3.1:8b (8B)" })).toHaveLength(2);
  expect(screen.queryByRole("option", { name: /llama3\.2/ })).not.toBeInTheDocument();
  expect(screen.getByText(/gemma2:9b \(9\.2B\)/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start debate" })).toBeDisabled();
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
  fireEvent.click(start);
  expect(onEvent).toHaveBeenCalledWith({ type: "start" });
});

test("shows a character tile in each side panel", () => {
  renderForm();

  expect(screen.getByRole("heading", { name: "Set the match" })).toBeInTheDocument();
  expect(screen.getByText("VS")).toBeInTheDocument();
  expect(screen.getByText("Nubi")).toBeInTheDocument();
  expect(screen.getByText("Still. Exact. Final.")).toBeInTheDocument();
  expect(screen.getByText("Choose For")).toBeInTheDocument();
  expect(screen.getByText("Choose Against")).toBeInTheDocument();
  const forSide = within(screen.getByRole("group", { name: "For" }));
  const againstSide = within(screen.getByRole("group", { name: "Against" }));
  expect(forSide.getAllByRole("button")).toHaveLength(3);
  expect(againstSide.getAllByRole("button")).toHaveLength(3);
  expect(forSide.getByRole("button", { name: /Rex/ })).toHaveTextContent("Rex");
  expect(forSide.getByRole("button", { name: /Athena/ })).toHaveTextContent("Athena");
  expect(againstSide.getByRole("button", { name: /Jester/ })).toHaveTextContent("Jester");
});

test("assigns a character from the side it was clicked in", () => {
  const onEvent = renderForm();
  const forSide = within(screen.getByRole("group", { name: "For" }));
  const againstSide = within(screen.getByRole("group", { name: "Against" }));

  fireEvent.click(forSide.getByRole("button", { name: /Rex/ }));
  expect(onEvent).toHaveBeenCalledWith({ type: "edit_setup", patch: { debaterAId: "rex" } });

  fireEvent.click(againstSide.getByRole("button", { name: /Athena/ }));
  expect(onEvent).toHaveBeenCalledWith({ type: "edit_setup", patch: { debaterBId: "athena" } });
});

test("a character chosen on one side is disabled on the other", () => {
  let session = initialSession();
  session = choose(session, { type: "edit_setup", patch: { debaterAId: "rex" } });
  session = choose(session, { type: "edit_setup", patch: { debaterAModel: "mistral:7b" } });
  const onEvent = renderForm(session);
  const forSide = within(screen.getByRole("group", { name: "For" }));
  const againstSide = within(screen.getByRole("group", { name: "Against" }));

  expect(forSide.getByRole("button", { name: /Rex/ })).toHaveAttribute("aria-pressed", "true");
  expect(againstSide.getByRole("button", { name: "Rex, Already chosen" })).toBeDisabled();
  expect(screen.getByText("Sharp. Fearless. Direct.")).toBeInTheDocument();
  expect(screen.queryByText("Selected")).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: /mistral:7b \(7\.2B\), Already chosen/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear Rex, For" }));
  expect(onEvent).toHaveBeenCalledWith({ type: "edit_setup", patch: { debaterAId: null } });
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
