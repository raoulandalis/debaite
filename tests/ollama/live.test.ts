/**
 * Opt-in live check. Not part of `npm test`.
 * Run: OLLAMA_INTEGRATION=1 npm run test:ollama
 * Ollama and OLLAMA_MODEL are required. This file reads unset OLLAMA_* keys from .env.local.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { generate } from "@/lib/ollama/client";

const enabled = process.env.OLLAMA_INTEGRATION === "1";

if (!enabled) {
  console.error(
    "Live Ollama test skipped. Set OLLAMA_INTEGRATION=1. Ollama and OLLAMA_MODEL are required.",
  );
}

test.skipIf(!enabled)("generate returns text from the local model", async () => {
  loadUnsetOllamaEnv();
  const result = await generate({
    messages: [{ role: "user", content: "Reply with the single word pong." }],
    temperature: 0,
    numPredict: 16,
  });
  if (!result.ok || result.text.length === 0) {
    throw new Error(
      "Ollama and OLLAMA_MODEL are required. The live generate call did not return text.",
    );
  }
  expect(result.ok).toBe(true);
  expect(result.text.length).toBeGreaterThan(0);
});

function loadUnsetOllamaEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    if (!key.startsWith("OLLAMA_") || process.env[key]) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
