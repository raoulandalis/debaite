import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { checkHealth, generate, listInstalledModels } from "@/lib/ollama/client";
import { healthFromTags, matchModel, parseInstalledModels } from "@/lib/ollama/health";

const envKeys = ["OLLAMA_BASE_URL", "OLLAMA_MODEL", "OLLAMA_TIMEOUT_MS"] as const;
const previousEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
  }
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
  process.env.OLLAMA_MODEL = "llama3.2";
  process.env.OLLAMA_TIMEOUT_MS = "120000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  for (const key of envKeys) {
    const previous = previousEnv.get(key);
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("matches an exact tag and a tag suffix, and ignores a different model", () => {
  expect(matchModel(["llama3.2"], "llama3.2")).toBe(true);
  expect(matchModel(["llama3.2:latest"], "llama3.2")).toBe(true);
  expect(matchModel(["llama3.2-vision"], "llama3.2")).toBe(false);
});

test("maps a missing tag list to an unreachable health result", () => {
  expect(healthFromTags(null, "llama3.2")).toEqual({
    ok: false,
    modelReady: false,
    modelName: "llama3.2",
  });
});

test("maps installed tags without putting a base URL in the result", () => {
  expect(healthFromTags(["llama3.2:latest"], "llama3.2")).toEqual({
    ok: true,
    modelReady: true,
    modelName: "llama3.2",
  });
  expect(healthFromTags(["llama3.2"], "llama3.2")).toEqual({
    ok: true,
    modelReady: true,
    modelName: "llama3.2",
  });
  const different = healthFromTags(["llama3.2-vision"], "llama3.2");
  expect(different).toEqual({
    ok: true,
    modelReady: false,
    modelName: "llama3.2",
  });
  expect(different).not.toHaveProperty("baseUrl");
  expect(JSON.stringify(different)).not.toContain("11434");
});

test("reports an unset model as not ready", () => {
  expect(healthFromTags(["llama3.2"], null)).toEqual({
    ok: true,
    modelReady: false,
    modelName: null,
  });
});

test("extracts and trims chat content", async () => {
  mockJson({ message: { content: "  hello  " }, extra: true });
  const result = await generate({
    messages: [{ role: "user", content: "Hi" }],
    temperature: 0.8,
    numPredict: 32,
  });
  expect(result).toEqual({ ok: true, text: "hello" });
  const [url, init] = fetchCall();
  expect(url).toBe("http://127.0.0.1:11434/api/chat");
  const body = JSON.parse(String(init.body));
  expect(body).toEqual({
    model: "llama3.2",
    messages: [{ role: "user", content: "Hi" }],
    stream: false,
    options: { temperature: 0.8, num_predict: 32 },
  });
  expect(body.format).toBeUndefined();
  expect(init.signal).toBeInstanceOf(AbortSignal);
});

test("sends json format and an explicit model when asked", async () => {
  mockJson({ message: { content: "ok" } });
  await generate({
    messages: [{ role: "system", content: "Be brief" }],
    temperature: 0.3,
    numPredict: 16,
    json: true,
    model: "other",
  });
  const body = JSON.parse(String(fetchCall()[1].body));
  expect(body.format).toBe("json");
  expect(body.model).toBe("other");
});

test("rejects empty and missing chat content", async () => {
  mockJson({ message: { content: "   " } });
  await expect(
    generate({
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0,
      numPredict: 8,
    }),
  ).resolves.toEqual({
    ok: false,
    code: "INVALID_MODEL_OUTPUT",
    message: "The model returned empty text.",
  });

  mockJson({ message: {} });
  await expect(
    generate({
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0,
      numPredict: 8,
    }),
  ).resolves.toEqual({
    ok: false,
    code: "INVALID_MODEL_OUTPUT",
    message: "The model returned empty text.",
  });
});

test("maps a timeout abort to OLLAMA_TIMEOUT", async () => {
  vi.mocked(fetch).mockRejectedValue(new DOMException("timed out", "TimeoutError"));
  await expect(sampleGenerate()).resolves.toEqual({
    ok: false,
    code: "OLLAMA_TIMEOUT",
    message: "Ollama took too long to respond.",
  });

  vi.mocked(fetch).mockRejectedValue(
    Object.assign(new TypeError("timed out"), { cause: { name: "TimeoutError" } }),
  );
  await expect(sampleGenerate()).resolves.toMatchObject({
    ok: false,
    code: "OLLAMA_TIMEOUT",
  });
});

test("maps connection failure to OLLAMA_UNAVAILABLE", async () => {
  vi.mocked(fetch).mockRejectedValue(
    Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
  );
  await expect(sampleGenerate()).resolves.toEqual({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
    message: "Ollama is not reachable.",
  });
});

test("maps HTTP 500 to MODEL_ERROR and HTTP 404 to a missing model", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
  await expect(sampleGenerate()).resolves.toEqual({
    ok: false,
    code: "MODEL_ERROR",
    message: "Ollama returned an unexpected response.",
  });

  vi.mocked(fetch).mockResolvedValue(new Response("missing", { status: 404 }));
  await expect(sampleGenerate()).resolves.toEqual({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
    message: "The configured model is missing.",
  });
});

test("does not call fetch for a rejected base URL or a blank model", async () => {
  process.env.OLLAMA_BASE_URL = "file:///tmp";
  await expect(sampleGenerate()).resolves.toMatchObject({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
  });
  delete process.env.OLLAMA_MODEL;
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
  await expect(sampleGenerate()).resolves.toEqual({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
    message: "The configured model is missing.",
  });
  expect(fetch).not.toHaveBeenCalled();
});

test("checkHealth reads tags and reports the configured model", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ models: [{ name: "llama3.2:latest" }] }),
  );
  await expect(checkHealth()).resolves.toEqual({
    ok: true,
    modelReady: true,
    modelName: "llama3.2",
  });
  expect(fetchCall()[0]).toBe("http://127.0.0.1:11434/api/tags");
  expect(await checkHealth()).not.toHaveProperty("baseUrl");
});

test("parseInstalledModels keeps sizes and skips nameless tags", () => {
  expect(
    parseInstalledModels({
      models: [
        { name: "a:latest", details: { parameter_size: "3.2B" } },
        { name: "b:latest", details: { parameter_size: " 7B " } },
        { name: "c:latest", details: { parameter_size: "8.0B" } },
        { name: "d:latest", details: { parameter_size: "7M" } },
        { name: "e:latest" },
        { details: { parameter_size: "7B" } },
      ],
    }),
  ).toEqual([
    { name: "a:latest", parameterBillions: 3.2 },
    { name: "b:latest", parameterBillions: 7 },
    { name: "c:latest", parameterBillions: 8 },
    { name: "d:latest", parameterBillions: null },
    { name: "e:latest", parameterBillions: null },
  ]);
  expect(parseInstalledModels({ models: "nope" })).toBeNull();
});

test("listInstalledModels returns the catalog from tags", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      models: [{ name: "gemma2:9b", details: { parameter_size: "9B" } }],
    }),
  );
  await expect(listInstalledModels()).resolves.toEqual({
    ok: true,
    models: [{ name: "gemma2:9b", parameterBillions: 9 }],
  });
  expect(fetchCall()[0]).toBe("http://127.0.0.1:11434/api/tags");
});

test("listInstalledModels reports an unreachable Ollama", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
  await expect(listInstalledModels()).resolves.toEqual({
    ok: false,
    code: "OLLAMA_UNAVAILABLE",
    message: "Ollama is not reachable.",
  });
});

test("checkHealth stays down when tags cannot be fetched", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
  await expect(checkHealth()).resolves.toEqual({
    ok: false,
    modelReady: false,
    modelName: "llama3.2",
  });
});

function mockJson(body: unknown) {
  vi.mocked(fetch).mockResolvedValue(Response.json(body));
}

function fetchCall(): [string, RequestInit] {
  const call = vi.mocked(fetch).mock.calls.at(-1);
  if (!call) {
    throw new Error("fetch was not called");
  }
  return [String(call[0]), (call[1] ?? {}) as RequestInit];
}

function sampleGenerate() {
  return generate({
    messages: [{ role: "user", content: "Hi" }],
    temperature: 0.2,
    numPredict: 8,
  });
}
