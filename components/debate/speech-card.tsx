const borders = {
  rex: "border-rex",
  athena: "border-athena",
  jester: "border-jester",
} as const;

const roundNames = {
  opening: "Opening",
  rebuttal: "Rebuttal",
  closing: "Closing",
} as const;

export function SpeechCard({
  name,
  monogram,
  accent,
  model,
  side,
  round,
  text,
}: {
  name: string;
  monogram: string;
  accent: keyof typeof borders;
  model: string;
  side: "For" | "Against";
  round: keyof typeof roundNames;
  text: string;
}) {
  return (
    <article
      className={`min-w-0 rounded-sm border-2 bg-surface-raised p-4 motion-safe:animate-[speech-in_200ms_ease-out] ${borders[accent]}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-current text-sm font-medium"
        >
          {monogram}
        </span>
        <p className="font-medium">
          {name} <span>{model}</span> <span>{side}</span> <span>{roundNames[round]}</span>
        </p>
      </div>
      <p className="mt-3 whitespace-pre-wrap">{text}</p>
    </article>
  );
}
