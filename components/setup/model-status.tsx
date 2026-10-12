"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ready" | "missing" | "unreachable";

type HealthBody = {
  ok: boolean;
  modelReady: boolean;
  modelName: string | null;
};

export function ModelStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/ollama/health");
        const body: unknown = await response.json();
        if (cancelled) {
          return;
        }
        if (!isHealth(body) || !body.ok) {
          setStatus("unreachable");
          return;
        }
        setStatus(body.modelReady ? "ready" : "missing");
      } catch {
        if (!cancelled) {
          setStatus("unreachable");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const text =
    status === "checking"
      ? "Checking the local model…"
      : status === "ready"
        ? "Local model ready."
        : status === "missing"
          ? "The configured model is not ready. Start Ollama and check .env.example."
          : "Ollama is unreachable. Start Ollama and check .env.example.";

  const tone =
    status === "ready" ? "text-success" : status === "checking" ? undefined : "text-danger";

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-2 font-mono text-xs tracking-widest uppercase ${tone ?? ""}`}
      role="status"
    >
      {status === "ready" ? (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" />
      ) : null}
      {text}
    </p>
  );
}

function isHealth(value: unknown): value is HealthBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("ok" in value) || !("modelReady" in value) || !("modelName" in value)) {
    return false;
  }
  return (
    typeof value.ok === "boolean" &&
    typeof value.modelReady === "boolean" &&
    (value.modelName === null || typeof value.modelName === "string")
  );
}
