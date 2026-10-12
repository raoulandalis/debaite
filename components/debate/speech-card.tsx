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
  const affirmative = side === "For";
  const tone = affirmative ? "border-for text-for" : "border-against text-against";
  return (
    <article
      className={`flex w-full min-w-0 items-start gap-3 motion-safe:animate-[speech-in_200ms_ease-out] ${affirmative ? "" : "flex-row-reverse"}`}
      data-round={round}
    >
      <Portrait className={`size-11 shrink-0 ${tone}`} id={characterId} />
      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${affirmative ? "items-start" : "items-end"}`}>
        <p className={`flex w-full items-baseline gap-2 text-sm ${affirmative ? "" : "flex-row-reverse"}`}>
          <span className="font-display text-2xl tracking-wide text-foreground uppercase">{name}</span>
          <span className="text-muted">{model}</span>
          <span className={`font-mono text-xs tracking-widest uppercase ${affirmative ? "ml-auto" : "mr-auto"}`}>
            {side}
          </span>
        </p>
        <div className={`max-w-[42rem] border bg-surface-raised p-4 ${tone}`}>
          <p className="whitespace-pre-wrap text-foreground">{text}</p>
        </div>
      </div>
    </article>
  );
}
