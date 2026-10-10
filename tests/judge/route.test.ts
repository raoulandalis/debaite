import { beforeEach, expect, test, vi } from "vitest";
import { generate, listInstalledModels } from "@/lib/ollama/client";
import { POST } from "@/app/api/debate/judge/route";

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

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

const modelOutput = {
  scores: {
    debaterA: { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 },
    debaterB: { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 8 },
  },
  verdict: "B answered more directly.",
  strongestArgument: { debaterA: "A point.", debaterB: "B point." },
  biggestWeakness: { debaterA: "A hole.", debaterB: "B hole." },
};

const catalog = [
  { name: "mistral:7b", parameterBillions: 7.2 },
  { name: "qwen2.5:7b", parameterBillions: 7.6 },
  { name: "llama3.1:8b", parameterBillions: 8 },
  { name: "gemma2:9b", parameterBillions: 9.2 },
];

function transcript(count = 6) {
  return order.slice(0, count).map((step, index) => ({
    round: step.round,
    speaker: step.speaker,
    text: `Speech ${index + 1}`,
  }));
}

function judgeRequest(body: unknown) {
  return new Request("http://localhost/api/debate/judge", {
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

test("returns the weighted judgment from the first valid response", async () => {
  vi.mocked(generate).mockResolvedValue({
    ok: true,
    text: JSON.stringify(modelOutput),
  });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.scores.a.weightedDisplay).toBe("66.50");
  expect(body.scores.b.weightedDisplay).toBe("68.00");
  expect(body.winner).toBe("b");
  expect(body.disclaimer).toBe(
    "This verdict is an AI-generated evaluation, not an objective ruling.",
  );
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "gemma2:9b",
      json: true,
      temperature: 0.3,
      numPredict: 900,
    }),
  );
});

test("retries once when the first judge text cannot be parsed", async () => {
  vi.mocked(generate)
    .mockResolvedValueOnce({ ok: true, text: "not json" })
    .mockResolvedValueOnce({ ok: true, text: JSON.stringify(modelOutput) });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.winner).toBe("b");
  expect(body.scores.a.weightedDisplay).toBe("66.50");
  expect(generate).toHaveBeenCalledTimes(2);
});

test("returns no scores when both judge responses are invalid", async () => {
  vi.mocked(generate).mockResolvedValue({ ok: true, text: "SECRET_MODEL_TEXT" });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );
  const raw = await response.text();
  const body = JSON.parse(raw);

  expect(response.status).toBe(502);
  expect(body).toEqual({
    error: {
      code: "INVALID_MODEL_OUTPUT",
      message: "The judge response was not valid scoring JSON.",
    },
  });
  expect(body).not.toHaveProperty("scores");
  expect(raw).not.toContain("SECRET_MODEL_TEXT");
  expect(generate).toHaveBeenCalledTimes(2);
});

test("returns a timeout without a second generate call", async () => {
  vi.mocked(generate).mockResolvedValue({
    ok: false,
    code: "OLLAMA_TIMEOUT",
    message: "Ollama took too long to respond.",
  });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );

  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({
    error: {
      code: "OLLAMA_TIMEOUT",
      message: "Ollama took too long to respond.",
    },
  });
  expect(generate).toHaveBeenCalledTimes(1);
});

test("does not judge a five-speech transcript", async () => {
  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript(5) }),
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: {
      code: "DEBATE_STATE_CONFLICT",
      message: "The debate is not ready for the judge.",
    },
  });
  expect(generate).not.toHaveBeenCalled();
});

test("rejects a judge model that matches a speaker", async () => {
  const response = await POST(
    judgeRequest({
      ...setup,
      judgeModel: setup.debaterAModel,
      transcript: transcript(),
    }),
  );

  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("INVALID_INPUT");
  expect(generate).not.toHaveBeenCalled();
});

test("rejects a judge model missing from the catalog", async () => {
  vi.mocked(listInstalledModels).mockResolvedValue({
    ok: true,
    models: catalog.filter((model) => model.name !== setup.judgeModel),
  });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    error: {
      code: "OLLAMA_UNAVAILABLE",
      message: "The configured model is missing.",
    },
  });
  expect(generate).not.toHaveBeenCalled();
});

test("rejects speaker models outside the size band", async () => {
  vi.mocked(listInstalledModels).mockResolvedValue({
    ok: true,
    models: [
      { name: "mistral:7b", parameterBillions: 7 },
      { name: "llama3.1:8b", parameterBillions: 14 },
      { name: "gemma2:9b", parameterBillions: 9.2 },
    ],
  });

  const response = await POST(
    judgeRequest({ ...setup, transcript: transcript() }),
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: {
      code: "INVALID_INPUT",
      message: "Speaker models must be a similar size.",
    },
  });
  expect(generate).not.toHaveBeenCalled();
});
