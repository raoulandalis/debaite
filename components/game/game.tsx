"use client";

import { useEffect, useReducer, useState } from "react";
import { DebateScreen } from "@/components/debate/debate-screen";
import { ResultsScreen } from "@/components/results/results-screen";
import { ModelStatus } from "@/components/setup/model-status";
import { SetupForm } from "@/components/setup/setup-form";
import { getCharacter } from "@/lib/characters";
import { Badge } from "@/components/ui/badge";
import { initialSession, playbackReducer } from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";
import { requestJudge } from "@/lib/debate/judge-client";
import { requestTurn } from "@/lib/debate/turn-client";

const rounds = ["Opening", "Rebuttal", "Closing"] as const;

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
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">DebAIte</h1>
          <ul aria-label="Match shape" className="flex flex-wrap gap-2">
            {rounds.map((round) => (
              <li key={round}>
                <Badge
                  className="rounded-sm border-header-foreground/70 bg-transparent font-mono text-xs tracking-wide text-header-foreground uppercase"
                  variant="outline"
                >
                  {round}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10" id="main">
        {session.phase === "setup" ? (
          <>
            <ModelStatus />
            <SetupForm models={models} session={session} onEvent={dispatch} />
          </>
        ) : (
          <DebatePhase session={session} onEvent={dispatch} />
        )}
      </main>
    </>
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
