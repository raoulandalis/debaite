import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Home from "@/app/page";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("home page shows DebAIte", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        modelReady: true,
        modelName: "llama3.2",
      }),
    ),
  );
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "DebAIte" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("Local model ready.")).toBeInTheDocument();
  expect(screen.queryByText("The arena")).not.toBeInTheDocument();
  expect(screen.queryByText("Opening")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "How to play" }));
  expect(
    screen.getByText(
      "Write a topic. Pick two characters and two models. They argue for three rounds, then Nubi judges.",
    ),
  ).toBeInTheDocument();
});
