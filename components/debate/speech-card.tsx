import type { Character } from "@/lib/characters";
import { Portrait } from "@/components/characters/portrait";

const roundNames = {
  opening: "Opening",
  rebuttal: "Rebuttal",
  closing: "Closing",
} as const;

export function SpeechCard({
  name,
  characterId,
  model,
  side,
  round,
  text,
}: {
  name: string;
  characterId: Character["id"];
  model: string;
  side: "For" | "Against";
  round: keyof typeof roundNames;
  text: string;
}) {
  const tone = side === "For" ? "border-for text-for" : "border-against text-against";
  return (
    <article
      className={`min-w-0 border-2 bg-surface-raised p-4 motion-safe:animate-[speech-in_200ms_ease-out] ${tone}`}
    >
      <div className="flex items-center gap-3">
        <Portrait className="size-14 shrink-0" id={characterId} />
        <p className="font-medium text-foreground">
          <span className="font-display text-2xl tracking-wide uppercase">{name}</span>{" "}
          <span>{model}</span> <span>{side}</span> <span>{roundNames[round]}</span>
        </p>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-foreground">{text}</p>
    </article>
  );
}
