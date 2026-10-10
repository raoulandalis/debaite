import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ModelStatus } from "@/components/setup/model-status";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows the ready state", async () => {
  mockHealth({ ok: true, modelReady: true, modelName: "llama3.2" });
  render(<ModelStatus />);
  expect(await screen.findByText("Local model ready.")).toBeInTheDocument();
});

test("shows a missing model without the base URL", async () => {
  mockHealth({ ok: true, modelReady: false, modelName: "llama3.2" });
  render(<ModelStatus />);
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent(".env.example");
  expect(status).not.toHaveTextContent("Checking the local model…");
  expect(status.textContent).not.toContain("http");
  expect(status.textContent).not.toContain("11434");
});

test("leaves checking when Ollama is unreachable", async () => {
  mockHealth({ ok: false, modelReady: false, modelName: "llama3.2" });
  render(<ModelStatus />);
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Ollama is unreachable.");
  expect(status).toHaveTextContent(".env.example");
  expect(status.textContent).not.toContain("http");
  expect(status.textContent).not.toContain("11434");
});

test("leaves checking when the health fetch throws", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  render(<ModelStatus />);
  expect(await screen.findByText(/Ollama is unreachable/)).toBeInTheDocument();
  expect(screen.queryByText("Checking the local model…")).not.toBeInTheDocument();
});

test("leaves checking when the health body is not JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("nope", { status: 200 })),
  );
  render(<ModelStatus />);
  expect(await screen.findByText(/Ollama is unreachable/)).toBeInTheDocument();
});

function mockHealth(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
}
