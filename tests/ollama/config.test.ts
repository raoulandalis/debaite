import { expect, test } from "vitest";
import { loadOllamaConfig } from "@/lib/ollama/config";

test("uses the default base URL when it is unset", () => {
  expect(loadOllamaConfig({}).baseUrl).toBe("http://127.0.0.1:11434");
});

test("strips one trailing slash from the base URL", () => {
  expect(
    loadOllamaConfig({ OLLAMA_BASE_URL: "http://127.0.0.1:11434/" }).baseUrl,
  ).toBe("http://127.0.0.1:11434");
});

test("rejects a base URL that is not an http or https origin", () => {
  expect(loadOllamaConfig({ OLLAMA_BASE_URL: "file:///tmp" }).baseUrl).toBe(
    null,
  );
  expect(loadOllamaConfig({ OLLAMA_BASE_URL: "notaurl" }).baseUrl).toBe(null);
  expect(
    loadOllamaConfig({ OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1" }).baseUrl,
  ).toBe(null);
  expect(
    loadOllamaConfig({
      OLLAMA_BASE_URL: "http://127.0.0.1:11434?x=1",
    }).baseUrl,
  ).toBe(null);
  expect(
    loadOllamaConfig({ OLLAMA_BASE_URL: "http://127.0.0.1:11434#frag" })
      .baseUrl,
  ).toBe(null);
});

test("treats a missing or blank model as unset", () => {
  expect(loadOllamaConfig({}).model).toBe(null);
  expect(loadOllamaConfig({ OLLAMA_MODEL: "" }).model).toBe(null);
  expect(loadOllamaConfig({ OLLAMA_MODEL: "   " }).model).toBe(null);
});

test("trims the configured model name", () => {
  expect(loadOllamaConfig({ OLLAMA_MODEL: "  llama3.2  " }).model).toBe(
    "llama3.2",
  );
});

test("defaults and clamps the timeout", () => {
  expect(loadOllamaConfig({}).timeoutMs).toBe(120000);
  expect(loadOllamaConfig({ OLLAMA_TIMEOUT_MS: "" }).timeoutMs).toBe(120000);
  expect(loadOllamaConfig({ OLLAMA_TIMEOUT_MS: "abc" }).timeoutMs).toBe(120000);
  expect(loadOllamaConfig({ OLLAMA_TIMEOUT_MS: "1" }).timeoutMs).toBe(5000);
  expect(loadOllamaConfig({ OLLAMA_TIMEOUT_MS: "999999" }).timeoutMs).toBe(
    300000,
  );
  expect(loadOllamaConfig({ OLLAMA_TIMEOUT_MS: "120000" }).timeoutMs).toBe(
    120000,
  );
});
