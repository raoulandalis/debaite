"use client";

import { useEffect, useRef } from "react";
import { Portrait } from "@/components/characters/portrait";
import { SpeechCard } from "@/components/debate/speech-card";
import { Button } from "@/components/ui/button";
import type { Character } from "@/lib/characters";
import type { PlaybackEvent, Turn } from "@/lib/debate";
import type { Judgment } from "@/lib/judge";

const criteria = [
  { label: "Reasoning and logical consistency", weight: "35%", key: "reasoning" },
  { label: "Rebuttals and engagement with the opponent", weight: "30%", key: "rebuttal" },
  { label: "Evidence, examples, and supporting arguments", weight: "20%", key: "evidence" },
  { label: "Clarity and persuasiveness", weight: "15%", key: "clarity" },
] as const;

export function ResultsScreen({
  judgment,
  debaterA,
  debaterB,
  debaterAModel,
  debaterBModel,
  judgeModel,
  turns,
  onEvent,
}: {
  judgment: Judgment;
  debaterA: Character;
  debaterB: Character;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  turns: Turn[];
  onEvent: (event: PlaybackEvent) => void;
}) {
  const outcomeRef = useRef<HTMLHeadingElement>(null);
  const outcome =
    judgment.winner === "tie"
      ? "Tie"
      : judgment.winner === "a"
        ? `${debaterA.name} wins`
        : `${debaterB.name} wins`;

  useEffect(() => {
    outcomeRef.current?.focus();
  }, []);

  return (
    <section className="mt-6 flex min-w-0 flex-col gap-6">
      <h2
        ref={outcomeRef}
        className="font-display text-5xl tracking-wide uppercase"
        tabIndex={-1}
      >
        {outcome}
      </h2>
      <p>{judgment.disclaimer}</p>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <SideSummary
          character={debaterA}
          model={debaterAModel}
          side="For"
          weightedDisplay={judgment.scores.a.weightedDisplay}
        />
        <SideSummary
          character={debaterB}
          model={debaterBModel}
          side="Against"
          weightedDisplay={judgment.scores.b.weightedDisplay}
        />
      </div>
      <p>Judge model: {judgeModel}</p>
      <div className="flex min-w-0 flex-col gap-3">
        {criteria.map((row) => (
          <div
            key={row.key}
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <p className="min-w-0">
              {row.label} <span>{row.weight}</span>
            </p>
            <p className="flex flex-wrap gap-4">
              <span>
                {debaterA.name} {judgment.scores.a[row.key]}
              </span>
              <span>
                {debaterB.name} {judgment.scores.b[row.key]}
              </span>
            </p>
          </div>
        ))}
      </div>
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-lg font-medium">Verdict</h3>
        <p className="whitespace-pre-wrap">{judgment.verdict}</p>
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-lg font-medium">Strongest argument</h3>
        <p>
          <span className="font-medium">{debaterA.name}: </span>
          <span>{judgment.strongest.a}</span>
        </p>
        <p>
          <span className="font-medium">{debaterB.name}: </span>
          <span>{judgment.strongest.b}</span>
        </p>
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-lg font-medium">Biggest weakness</h3>
        <p>
          <span className="font-medium">{debaterA.name}: </span>
          <span>{judgment.weakness.a}</span>
        </p>
        <p>
          <span className="font-medium">{debaterB.name}: </span>
          <span>{judgment.weakness.b}</span>
        </p>
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="text-lg font-medium">Transcript</h3>
        {turns.map((turn) => {
          const character = turn.speaker === "a" ? debaterA : debaterB;
          return (
            <SpeechCard
              key={`${turn.round}-${turn.speaker}`}
              characterId={character.id}
              model={turn.speaker === "a" ? debaterAModel : debaterBModel}
              name={character.name}
              round={turn.round}
              side={turn.speaker === "a" ? "For" : "Against"}
              text={turn.text}
            />
          );
        })}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onEvent({ type: "play_again" })}>
          Play again
        </Button>
        <Button type="button" variant="outline" onClick={() => onEvent({ type: "new_debate" })}>
          New debate
        </Button>
      </div>
    </section>
  );
}

function SideSummary({
  character,
  model,
  side,
  weightedDisplay,
}: {
  character: Character;
  model: string;
  side: "For" | "Against";
  weightedDisplay: string;
}) {
  const tone = side === "For" ? "border-for text-for" : "border-against text-against";
  return (
    <article className={`min-w-0 border-2 bg-surface-raised p-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <Portrait className="size-16 shrink-0" id={character.id} />
        <div className="min-w-0 text-foreground">
          <h3 className="font-display text-3xl tracking-wide uppercase">{character.name}</h3>
          <p>{model}</p>
          <p>{side}</p>
        </div>
      </div>
      <p className="mt-3 text-foreground">
        Weighted score <span>{weightedDisplay}</span>
      </p>
    </article>
  );
}
