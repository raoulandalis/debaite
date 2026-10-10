import { render, screen } from "@testing-library/react";
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
});
