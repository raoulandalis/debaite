import type { Judgment } from "@/lib/judge";

export function buildShareCard(input: {
  topic: string;
  debaterA: string;
  debaterB: string;
  debaterAModel: string;
  debaterBModel: string;
  judgment: Judgment;
}): string {
  const outcome =
    input.judgment.winner === "tie"
      ? "Tie"
      : input.judgment.winner === "a"
        ? `${input.debaterA} wins`
        : `${input.debaterB} wins`;
  const compelling =
    input.judgment.winner === "b"
      ? line(input.debaterB, input.judgment.strongest.b, input.debaterA, input.debaterB)
      : input.judgment.winner === "a"
        ? line(input.debaterA, input.judgment.strongest.a, input.debaterA, input.debaterB)
        : [
            line(input.debaterA, input.judgment.strongest.a, input.debaterA, input.debaterB),
            line(input.debaterB, input.judgment.strongest.b, input.debaterA, input.debaterB),
          ].join("\n");

  return [
    "DebAIte",
    "",
    input.topic.trim(),
    "",
    `${input.debaterA} · ${input.debaterAModel}`,
    "vs",
    `${input.debaterB} · ${input.debaterBModel}`,
    "",
    outcome,
    "",
    "Most compelling",
    compelling,
  ].join("\n");
}

function line(name: string, text: string, debaterA: string, debaterB: string): string {
  const named = text.replace(/debater a/gi, debaterA).replace(/debater b/gi, debaterB);
  const compact = named.replace(/\s+/g, " ").trim();
  const clipped = compact.length > 140 ? `${compact.slice(0, 139).trimEnd()}…` : compact;
  return `${name}: ${clipped}`;
}
