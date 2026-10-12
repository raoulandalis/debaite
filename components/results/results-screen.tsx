"use client";

import { useEffect, useRef, useState } from "react";
import { Portrait } from "@/components/characters/portrait";
import { SpeechCard } from "@/components/debate/speech-card";
import { Button } from "@/components/ui/button";
import type { Character } from "@/lib/characters";
import type { PlaybackEvent, Turn } from "@/lib/debate";
import type { Judgment } from "@/lib/judge";
import { buildShareCard } from "@/lib/results/share-card";

const criteria = [
  { label: "Reasoning and logical consistency", weight: "35%", key: "reasoning" },
  { label: "Rebuttals and engagement with the opponent", weight: "30%", key: "rebuttal" },
  { label: "Evidence, examples, and supporting arguments", weight: "20%", key: "evidence" },
  { label: "Clarity and persuasiveness", weight: "15%", key: "clarity" },
] as const;

export function ResultsScreen({
  topic,
  judgment,
  debaterA,
  debaterB,
  debaterAModel,
  debaterBModel,
  judgeModel,
  turns,
  onEvent,
}: {
  topic: string;
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
  const [notice, setNotice] = useState<null | { token: number; kind: "copied" | "failed" }>(null);
  const outcome =
    judgment.winner === "tie"
      ? "Tie"
      : judgment.winner === "a"
        ? `${debaterA.name} wins`
        : `${debaterB.name} wins`;
  const winner = judgment.winner === "b" ? debaterB : debaterA;
  const winnerSide = judgment.winner === "b" ? "Against" : "For";
  const victoryTone = judgment.winner === "tie" ? "text-foreground" : winnerSide === "For" ? "text-for" : "text-against";
  const cards =
    judgment.winner === "b"
      ? [
          { character: debaterB, model: debaterBModel, side: "Against" as const, score: judgment.scores.b.weightedDisplay },
          { character: debaterA, model: debaterAModel, side: "For" as const, score: judgment.scores.a.weightedDisplay },
        ]
      : judgment.winner === "a"
        ? [
            { character: debaterA, model: debaterAModel, side: "For" as const, score: judgment.scores.a.weightedDisplay },
            { character: debaterB, model: debaterBModel, side: "Against" as const, score: judgment.scores.b.weightedDisplay },
          ]
        : [
            { character: debaterA, model: debaterAModel, side: "For" as const, score: judgment.scores.a.weightedDisplay },
            { character: debaterB, model: debaterBModel, side: "Against" as const, score: judgment.scores.b.weightedDisplay },
          ];

  useEffect(() => {
    outcomeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      <Portrait
        className={`h-64 w-full sm:h-80 ${victoryTone}`}
        id={judgment.winner === "tie" ? "victory-tie" : `victory-${winner.id}`}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <SideSummary
            key={card.character.id}
            character={card.character}
            model={card.model}
            side={card.side}
            weightedDisplay={card.score}
          />
        ))}
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
        <p className="whitespace-pre-wrap">{namedVerdict(judgment.verdict, debaterA.name, debaterB.name)}</p>
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
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const card = buildShareCard({
                topic,
                debaterA: debaterA.name,
                debaterB: debaterB.name,
                debaterAModel,
                debaterBModel,
                judgment,
              });
              void navigator.clipboard.writeText(card).then(
                () => setNotice({ token: Date.now(), kind: "copied" }),
                () => setNotice({ token: Date.now(), kind: "failed" }),
              );
            }}
          >
            Share
          </Button>
          <Button type="button" onClick={() => onEvent({ type: "play_again" })}>
            Play again
          </Button>
          <Button type="button" variant="outline" onClick={() => onEvent({ type: "new_debate" })}>
            New debate
          </Button>
        </div>
      </div>
      {notice !== null ? (
        <p
          className="fixed top-6 left-1/2 z-50 -translate-x-1/2 border border-border bg-surface-raised px-4 py-2 text-sm text-foreground motion-safe:animate-[speech-in_200ms_ease-out]"
          role="status"
        >
          {notice.kind === "copied" ? "Copied to clipboard." : "Couldn’t copy. Try again."}
        </p>
      ) : null}
    </section>
  );
}

function namedVerdict(verdict: string, debaterA: string, debaterB: string): string {
  return verdict.replace(/debater a/gi, debaterA).replace(/debater b/gi, debaterB);
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
