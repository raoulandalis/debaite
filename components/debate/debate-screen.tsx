"use client";

import { getCharacter } from "@/lib/characters";
import type { Character } from "@/lib/characters";
import { getExpectedTurn } from "@/lib/debate";
import type { DebateState, GameSession, PlaybackEvent, RoundId, SpeakerSlot } from "@/lib/debate";
import { Button } from "@/components/ui/button";
import { SpeechCard } from "@/components/debate/speech-card";

const rounds: { id: RoundId; label: string }[] = [
  { id: "opening", label: "Opening" },
  { id: "rebuttal", label: "Rebuttal" },
  { id: "closing", label: "Closing" },
];

export function DebateScreen({
  session,
  onEvent,
}: {
  session: GameSession;
  onEvent: (event: PlaybackEvent) => void;
}) {
  const debate = session.debate;
  if (debate === null) {
    return null;
  }

  const active = activeTurn(session, debate);
  const awaitingJudge = debate.status === "awaiting_judge";
  const judging = session.pending?.kind === "judge";
  const debaterA = getCharacter(debate.debaterAId);
  const debaterB = getCharacter(debate.debaterBId);
  if (debaterA === null || debaterB === null) {
    return null;
  }

  return (
    <section className="mt-6 flex min-w-0 flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <h2 className="font-display text-4xl tracking-wide text-foreground uppercase sm:text-5xl">
          {debate.topic}
        </h2>
        <p className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs tracking-widest uppercase">
          <span className="text-for">
            {debaterA.name} <span aria-hidden="true">/</span> For
          </span>
          <span className="font-display text-2xl tracking-wide text-foreground">VS</span>
          <span className="text-against">
            {debaterB.name} <span aria-hidden="true">/</span> Against
          </span>
        </p>
      </header>
      <ol aria-label="Rounds" className="flex flex-wrap justify-center gap-8 font-mono text-xs tracking-widest uppercase">
        {rounds.map((round, index) => {
          const current = active?.round === round.id && !awaitingJudge;
          return (
            <li key={round.id} className="flex flex-col items-center gap-1">
              <span className={current ? "border-b border-foreground pb-1 text-foreground" : "text-muted"}>
                <span>0{index + 1}</span> <span>{round.label}</span>
              </span>
              {current ? <span>Current</span> : null}
            </li>
          );
        })}
      </ol>
      <div className="flex min-w-0 flex-col gap-6">
        <Thread debate={debate} debaterA={debaterA} debaterB={debaterB} />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <StatusLine session={session} debate={debate} />
        <div className="flex flex-wrap justify-center gap-2">
        {session.playback === "running" && !awaitingJudge ? (
          <Button type="button" variant="outline" onClick={() => onEvent({ type: "pause" })}>
            Pause
          </Button>
        ) : null}
        {session.playback === "paused" &&
        session.pending === null &&
        session.error === null &&
        !awaitingJudge &&
        getExpectedTurn(debate) !== null ? (
          <Button type="button" onClick={() => onEvent({ type: "resume" })}>
            Next argument
          </Button>
        ) : null}
        {awaitingJudge && session.pending === null && session.error === null ? (
          <Button type="button" onClick={() => onEvent({ type: "judge_started" })}>
            Judge the debate
          </Button>
        ) : null}
        {judging ? (
          <Button type="button" variant="outline" onClick={() => onEvent({ type: "cancel" })}>
            Cancel judging
          </Button>
        ) : null}
        {session.pending?.kind === "turn" ? (
          <Button type="button" variant="outline" onClick={() => onEvent({ type: "cancel" })}>
            Cancel turn
          </Button>
        ) : null}
        {session.error !== null && awaitingJudge ? (
          <Button type="button" onClick={() => onEvent({ type: "retry" })}>
            Retry judging
          </Button>
        ) : null}
        {session.error !== null && !awaitingJudge ? (
          <Button type="button" onClick={() => onEvent({ type: "retry" })}>
            Retry turn
          </Button>
        ) : null}
        </div>
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <svg aria-hidden="true" className="size-4 motion-safe:animate-spin" fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function StatusLine({ session, debate }: { session: GameSession; debate: DebateState }) {
  if (session.pending?.kind === "judge") {
    return (
      <p aria-live="polite" className="flex items-center justify-center gap-2">
        <Spinner />
        The judge is scoring the debate.
      </p>
    );
  }
  if (debate.status === "awaiting_judge") {
    if (session.error !== null) {
      return (
        <div>
          <p aria-live="polite">Judging failed. You can retry.</p>
          <p>{session.error.message}</p>
        </div>
      );
    }
    return (
      <div>
        <p aria-live="polite">{readyLine(debate)}</p>
        <p>The debate is ready for the judge.</p>
      </div>
    );
  }
  if (session.pending?.kind === "turn") {
    const name = speakerName(debate, session.pending.speaker);
    return (
      <p aria-live="polite" className="flex items-center justify-center gap-2">
        <Spinner />
        {name} is making the {session.pending.round} argument.
      </p>
    );
  }
  if (session.error !== null) {
    return (
      <div>
        <p aria-live="polite">Something went wrong. You can retry this turn.</p>
        <p>{session.error.message}</p>
      </div>
    );
  }
  if (session.playback === "paused") {
    if (debate.turns.length > 0) {
      return <p aria-live="polite">{readyLine(debate)}</p>;
    }
    return <p>Paused.</p>;
  }
  return null;
}

function Thread({
  debate,
  debaterA,
  debaterB,
}: {
  debate: DebateState;
  debaterA: Character;
  debaterB: Character;
}) {
  return (
    <>
      {debate.turns.map((turn, index) => {
        const affirmative = turn.speaker === "a";
        const character = affirmative ? debaterA : debaterB;
        const divider =
          index > 0 && debate.turns[index - 1]?.round === turn.round ? null : (
            <RoundDivider
              index={rounds.findIndex((round) => round.id === turn.round)}
              label={roundLabel(turn.round)}
            />
          );
        return (
          <div key={`${turn.round}-${turn.speaker}`} className="flex flex-col gap-6">
            {divider}
            <SpeechCard
              characterId={character.id}
              model={affirmative ? debate.debaterAModel : debate.debaterBModel}
              name={character.name}
              round={turn.round}
              side={affirmative ? "For" : "Against"}
              text={turn.text}
            />
          </div>
        );
      })}
    </>
  );
}

function RoundDivider({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted uppercase">
      <span className="h-px flex-1 bg-border" />
      <span>
        0{index + 1} / {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function roundLabel(round: RoundId): string {
  return rounds.find((item) => item.id === round)?.label ?? round;
}

function activeTurn(
  session: GameSession,
  debate: DebateState,
): { round: RoundId; speaker: SpeakerSlot } | null {
  if (session.pending?.kind === "turn") {
    return session.pending;
  }
  const latest = debate.turns.at(-1);
  if (
    session.playback === "paused" &&
    session.error === null &&
    latest !== undefined &&
    debate.status !== "awaiting_judge"
  ) {
    return { round: latest.round, speaker: latest.speaker };
  }
  return getExpectedTurn(debate);
}

function readyLine(debate: DebateState): string {
  const latest = debate.turns.at(-1);
  if (latest === undefined) {
    return "";
  }
  return `${speakerName(debate, latest.speaker)}'s ${latest.round} argument is ready.`;
}

function speakerName(debate: DebateState, speaker: SpeakerSlot): string {
  const character = getCharacter(speaker === "a" ? debate.debaterAId : debate.debaterBId);
  return character?.name ?? "The debater";
}
