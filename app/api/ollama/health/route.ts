import { connection } from "next/server";
import { checkHealth } from "@/lib/ollama/client";
import type { HealthResponse } from "@/lib/ollama/errors";

const down = (modelName: string | null): HealthResponse => ({
  ok: false,
  modelReady: false,
  modelName,
  models: [],
});

export async function GET() {
  await connection();
  try {
    return Response.json(await checkHealth());
  } catch {
    return Response.json(down(null));
  }
}
