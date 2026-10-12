"use client";

import { getCharacter } from "@/lib/characters";
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
  const activeSpeaker = active?.speaker ?? "a";

  return (
    <section className="mt-6 flex min-w-0 flex-col gap-4">
      <ol aria-label="Rounds" className="flex flex-wrap gap-3">
        {rounds.map((round) => (
          <li key={round.id}>
            <span>{round.label}</span>
            {active?.round === round.id && !awaitingJudge ? <span>Current</span> : null}
          </li>
        ))}
      </ol>
      <StatusLine session={session} debate={debate} />
      <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-2">
        <div className="order-first min-w-0 lg:hidden">
          <h2 className="text-sm font-medium">Last argument</h2>
          <p>{lastArgument(debate, activeSpeaker) ?? "No argument yet."}</p>
        </div>
        <SpeakerColumn
          debate={debate}
          speaker="a"
          className={activeSpeaker === "b" ? "order-2 lg:order-1" : "order-1"}
        />
        <SpeakerColumn
          debate={debate}
          speaker="b"
          className={activeSpeaker === "b" ? "order-1 lg:order-2" : "order-2"}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {session.playback === "running" && !awaitingJudge ? (
          <Button type="button" onClick={() => onEvent({ type: "pause" })}>
            Pause
          </Button>
        ) : null}
        {session.playback === "paused" && !awaitingJudge && getExpectedTurn(debate) !== null ? (
          <Button type="button" onClick={() => onEvent({ type: "resume" })}>
            Resume
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
    </section>
  );
}

function StatusLine({ session, debate }: { session: GameSession; debate: DebateState }) {
  if (session.pending?.kind === "judge") {
    return <p aria-live="polite">The judge is scoring the debate.</p>;
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
    return <p>The debate is ready for the judge.</p>;
  }
  if (session.pending?.kind === "turn") {
    const name = speakerName(debate, session.pending.speaker);
    return (
      <p aria-live="polite">
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
    return <p>Paused.</p>;
  }
  return null;
}

function SpeakerColumn({
  debate,
  speaker,
  className,
}: {
  debate: DebateState;
  speaker: SpeakerSlot;
  className: string;
}) {
  const character = getCharacter(speaker === "a" ? debate.debaterAId : debate.debaterBId);
  const turns = debate.turns.filter((turn) => turn.speaker === speaker);
  if (character === null) {
    return null;
  }
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${className}`}>
      {turns.map((turn) => (
        <SpeechCard
          key={`${turn.round}-${turn.speaker}`}
          accent={character.accentToken}
          model={speaker === "a" ? debate.debaterAModel : debate.debaterBModel}
          monogram={character.monogram}
          name={character.name}
          round={turn.round}
          side={speaker === "a" ? "For" : "Against"}
          text={turn.text}
        />
      ))}
    </div>
  );
}

function activeTurn(
  session: GameSession,
  debate: DebateState,
): { round: RoundId; speaker: SpeakerSlot } | null {
  if (session.pending?.kind === "turn") {
    return session.pending;
  }
  return getExpectedTurn(debate);
}

function speakerName(debate: DebateState, speaker: SpeakerSlot): string {
  const character = getCharacter(speaker === "a" ? debate.debaterAId : debate.debaterBId);
  return character?.name ?? "The debater";
}

function lastArgument(debate: DebateState, activeSpeaker: SpeakerSlot): string | null {
  const opponent = [...debate.turns].reverse().find((turn) => turn.speaker !== activeSpeaker);
  return opponent?.text ?? null;
}
