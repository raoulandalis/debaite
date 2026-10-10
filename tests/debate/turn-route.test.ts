import { beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/debate/turn/route";
import { generate, listInstalledModels } from "@/lib/ollama/client";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("@/lib/ollama/client", () => ({
  generate: vi.fn(),
  listInstalledModels: vi.fn(),
}));

const setup = {
  topic: "Should AI replace human teachers?",
  debaterAId: "rex",
  debaterBId: "athena",
  debaterAModel: "mistral:7b",
  debaterBModel: "llama3.1:8b",
  judgeModel: "gemma2:9b",
};

const catalog = [
  { name: "mistral:7b", parameterBillions: 7.2 },
  { name: "qwen2.5:7b", parameterBillions: 7.6 },
  { name: "llama3.1:8b", parameterBillions: 8 },
  { name: "gemma2:9b", parameterBillions: 9.2 },
];

function turnRequest(body: unknown) {
  return new Request("http://localhost/api/debate/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(generate).mockReset();
  vi.mocked(listInstalledModels).mockReset();
  vi.mocked(listInstalledModels).mockResolvedValue({ ok: true, models: catalog });
});

test("a legal opening returns the speech and calls the speaker model", async () => {
  vi.mocked(generate).mockResolvedValue({ ok: true, text: "  Opening from Rex.  " });

  const response = await POST(
    turnRequest({ ...setup, round: "opening", speaker: "a", transcript: [] }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    round: "opening",
    speaker: "a",
    text: "Opening from Rex.",
  });
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "mistral:7b",
      temperature: 0.8,
      numPredict: 320,
    }),
  );
  const messages = vi.mocked(generate).mock.calls[0]?.[0].messages;
  expect(JSON.stringify(messages)).not.toContain("mistral:7b");
});

test("a speaker model outside the roster does not call generate", async () => {
  const response = await POST(
    turnRequest({
      ...setup,
      debaterAModel: "llama3.2:latest",
      round: "opening",
      speaker: "a",
      transcript: [],
    }),
  );

  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("INVALID_INPUT");
  expect(generate).not.toHaveBeenCalled();
});

test("a rebuttal with an empty transcript does not call generate", async () => {
  const response = await POST(
    turnRequest({ ...setup, round: "rebuttal", speaker: "a", transcript: [] }),
  );

  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe("DEBATE_STATE_CONFLICT");
  expect(generate).not.toHaveBeenCalled();
});

test("empty model text is invalid model output", async () => {
  vi.mocked(generate).mockResolvedValue({ ok: true, text: "   " });

  const response = await POST(
    turnRequest({ ...setup, round: "opening", speaker: "a", transcript: [] }),
  );

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    error: {
      code: "INVALID_MODEL_OUTPUT",
      message: "The speech was empty or too long.",
    },
  });
});

test("a closing request uses the shorter prediction budget", async () => {
  vi.mocked(generate).mockResolvedValue({ ok: true, text: "Closing." });
  const transcript = [
    { round: "opening", speaker: "a", text: "One" },
    { round: "opening", speaker: "b", text: "Two" },
    { round: "rebuttal", speaker: "a", text: "Three" },
    { round: "rebuttal", speaker: "b", text: "Four" },
  ];

  const response = await POST(
    turnRequest({ ...setup, round: "closing", speaker: "a", transcript }),
  );

  expect(response.status).toBe(200);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ model: "mistral:7b", numPredict: 240 }),
  );
});
