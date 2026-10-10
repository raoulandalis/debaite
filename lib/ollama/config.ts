export type OllamaEnv = {
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_TIMEOUT_MS?: string;
  [key: string]: string | undefined;
};

export type OllamaConfig = {
  baseUrl: string | null;
  model: string | null;
  timeoutMs: number;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 120000;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 300000;

export function loadOllamaConfig(env: OllamaEnv = process.env): OllamaConfig {
  return {
    baseUrl: readBaseUrl(env.OLLAMA_BASE_URL),
    model: readModel(env.OLLAMA_MODEL),
    timeoutMs: readTimeout(env.OLLAMA_TIMEOUT_MS),
  };
}

function readModel(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, parsed));
}

function readBaseUrl(value: string | undefined): string | null {
  const raw =
    value === undefined || value.trim() === "" ? DEFAULT_BASE_URL : value.trim();
  const stripped = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  let url: URL;
  try {
    url = new URL(stripped);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return null;
  }
  if (url.search !== "" || url.hash !== "") {
    return null;
  }
  if (url.username !== "" || url.password !== "") {
    return null;
  }
  return url.origin;
}
