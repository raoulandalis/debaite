"use client";

import { useEffect, useReducer, useState } from "react";
import { DebateScreen } from "@/components/debate/debate-screen";
import { ResultsScreen } from "@/components/results/results-screen";
import { ModelStatus } from "@/components/setup/model-status";
import { SetupForm } from "@/components/setup/setup-form";
import { getCharacter } from "@/lib/characters";
import { Button } from "@/components/ui/button";
import { initialSession, playbackReducer } from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";
import { requestJudge } from "@/lib/debate/judge-client";
import { requestTurn } from "@/lib/debate/turn-client";

const howToPlay =
  "Write a topic. Pick two characters and two models. They argue for three rounds, then Nubi judges.";

type CatalogModel = { name: string; parameterBillions: number | null };

export function Game() {
  const [session, dispatch] = useReducer(playbackReducer, initialSession());
  const [models, setModels] = useState<CatalogModel[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/ollama/health");
        const body: unknown = await response.json();
        if (!cancelled) {
          setModels(readModels(body));
        }
      } catch {
        if (!cancelled) {
          setModels([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pending = session.pending;
    const debate = session.debate;
    if (pending?.kind !== "turn" || debate === null) {
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    void (async () => {
      let shown = "";
      const result = await requestTurn(
        {
          topic: debate.topic,
          debaterAId: debate.debaterAId,
          debaterBId: debate.debaterBId,
          debaterAModel: debate.debaterAModel,
          debaterBModel: debate.debaterBModel,
          judgeModel: debate.judgeModel,
          round: pending.round,
          speaker: pending.speaker,
          transcript: debate.turns,
        },
        controller.signal,
        (delta) => {
          if (ignore) {
            return;
          }
          shown += delta;
          dispatch({ type: "turn_progress", text: shown });
        },
      );
      if (ignore || !result.ok && "aborted" in result) {
        return;
      }
      if (!result.ok) {
        dispatch({
          type: "turn_failed",
          error: { code: result.code, message: result.message },
        });
        return;
      }
      dispatch({
        type: "turn_succeeded",
        turn: { round: result.round, speaker: result.speaker, text: result.text },
      });
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [session.pending, session.debate]);

  useEffect(() => {
    const pending = session.pending;
    const debate = session.debate;
    if (pending?.kind !== "judge" || debate === null) {
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    void (async () => {
      const result = await requestJudge(
        {
          topic: debate.topic,
          debaterAId: debate.debaterAId,
          debaterBId: debate.debaterBId,
          debaterAModel: debate.debaterAModel,
          debaterBModel: debate.debaterBModel,
          judgeModel: debate.judgeModel,
          transcript: debate.turns,
        },
        controller.signal,
      );
      if (ignore || (!result.ok && "aborted" in result)) {
        return;
      }
      if (!result.ok) {
        dispatch({
          type: "judge_failed",
          error: { code: result.code, message: result.message },
        });
        return;
      }
      dispatch({ type: "judge_succeeded", body: result.body });
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [session.pending, session.debate]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="border-b border-border bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 aria-label="DebAIte" className="font-display text-4xl tracking-wide uppercase">
            <button
              aria-label="DebAIte"
              className="cursor-pointer border-0 bg-transparent p-0 font-display text-4xl tracking-wide uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-for"
              type="button"
              onClick={() => dispatch({ type: "home" })}
            >
              Deb<span className="mr-[0.18em] text-foreground/30 italic">AI</span>te
            </button>
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <ModelStatus />
            <HowToPlay />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10" id="main">
        {session.phase === "setup" ? (
          <SetupForm models={models} session={session} onEvent={dispatch} />
        ) : (
          <DebatePhase session={session} onEvent={dispatch} />
        )}
      </main>
    </>
  );
}

function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        aria-controls="how-to-play"
        aria-expanded={open}
        aria-label="How to play"
        size="icon"
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7.2V11" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="5" r="0.8" fill="currentColor" />
        </svg>
      </Button>
      {open ? (
        <p
          className="absolute right-0 z-10 mt-2 w-64 border border-border bg-surface p-3 text-left text-sm text-foreground"
          id="how-to-play"
        >
          {howToPlay}
        </p>
      ) : null}
    </div>
  );
}

function DebatePhase({
  session,
  onEvent,
}: {
  session: GameSession;
  onEvent: (event: PlaybackEvent) => void;
}) {
  const debate = session.debate;
  const judgment = session.judgment;
  if (session.phase === "results" && debate !== null && judgment !== null) {
    const debaterA = getCharacter(debate.debaterAId);
    const debaterB = getCharacter(debate.debaterBId);
    if (debaterA !== null && debaterB !== null) {
      return (
        <ResultsScreen
          topic={debate.topic}
          debaterA={debaterA}
          debaterAModel={debate.debaterAModel}
          debaterB={debaterB}
          debaterBModel={debate.debaterBModel}
          judgeModel={debate.judgeModel}
          judgment={judgment}
          turns={debate.turns}
          onEvent={onEvent}
        />
      );
    }
  }
  return <DebateScreen session={session} onEvent={onEvent} />;
}

function readModels(body: unknown): CatalogModel[] {
  if (typeof body !== "object" || body === null || !("ok" in body) || body.ok !== true) {
    return [];
  }
  if (!("models" in body) || !Array.isArray(body.models)) {
    return [];
  }
  const models: CatalogModel[] = [];
  for (const model of body.models) {
    if (typeof model !== "object" || model === null || !("name" in model)) {
      continue;
    }
    if (typeof model.name !== "string") {
      continue;
    }
    const size =
      "parameterBillions" in model && typeof model.parameterBillions === "number"
        ? model.parameterBillions
        : null;
    models.push({ name: model.name, parameterBillions: size });
  }
  return models;
}
