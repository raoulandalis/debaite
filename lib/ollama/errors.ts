export const GATEWAY_ERROR_CODES = [
  "OLLAMA_UNAVAILABLE",
  "OLLAMA_TIMEOUT",
  "MODEL_ERROR",
  "INVALID_MODEL_OUTPUT",
] as const;

export type GatewayErrorCode = (typeof GATEWAY_ERROR_CODES)[number];

export type GenerateInput = {
  messages: { role: "system" | "user"; content: string }[];
  temperature: number;
  numPredict: number;
  json?: boolean;
  model?: string;
};

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; code: GatewayErrorCode; message: string };

export type HealthStatus = {
  ok: boolean;
  modelReady: boolean;
  modelName: string | null;
};

export type HealthResponse = HealthStatus & {
  models: { name: string; parameterBillions: number | null }[];
};

export const gatewayMessages = {
  unavailable: "Ollama is not reachable.",
  missingModel: "The configured model is missing.",
  timeout: "Ollama took too long to respond.",
  modelError: "Ollama returned an unexpected response.",
  emptyOutput: "The model returned empty text.",
} as const;
