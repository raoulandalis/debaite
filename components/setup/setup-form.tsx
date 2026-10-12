"use client";

import { CHARACTERS } from "@/lib/characters";
import { canStart, DEBATER_MODELS, JUDGE_MODEL } from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";
import { Portrait } from "@/components/characters/portrait";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CatalogModel = { name: string; parameterBillions: number | null };

const characters = [CHARACTERS.rex, CHARACTERS.athena, CHARACTERS.jester];

export function SetupForm({
  session,
  models,
  onEvent,
}: {
  session: GameSession;
  models: CatalogModel[];
  onEvent: (event: PlaybackEvent) => void;
}) {
  const ready = canStart({
    topic: session.topicDraft,
    debaterAId: session.debaterAId,
    debaterBId: session.debaterBId,
    debaterAModel: session.debaterAModel,
    debaterBModel: session.debaterBModel,
    judgeModel: session.judgeModel,
    models,
  });

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          onEvent({ type: "start" });
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-5xl tracking-wide text-foreground uppercase">
          Set the match
        </h2>
        <Label className="font-mono text-xs tracking-widest uppercase" htmlFor="debate-topic">
          Debate topic
        </Label>
        <Textarea
          id="debate-topic"
          placeholder="e.g. Is a hot dog a sandwich?"
          value={session.topicDraft}
          onChange={(event) =>
            onEvent({ type: "edit_setup", patch: { topicDraft: event.target.value } })
          }
        />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <SidePanel
          label="For"
          modelId="model-a"
          modelLabel="Model for Debater A"
          models={models}
          otherId={session.debaterBId}
          otherModel={session.debaterBModel}
          player="Player 01"
          selectedId={session.debaterAId}
          selectedModel={session.debaterAModel}
          onCharacter={(id) => onEvent({ type: "edit_setup", patch: { debaterAId: id } })}
          onModel={(model) => onEvent({ type: "edit_setup", patch: { debaterAModel: model } })}
        />
        <div className="flex flex-col items-center gap-4 self-center">
          <p className="text-center font-display text-3xl tracking-wide text-foreground">VS</p>
          <JudgeCard models={models} />
        </div>
        <SidePanel
          label="Against"
          modelId="model-b"
          modelLabel="Model for Debater B"
          models={models}
          otherId={session.debaterAId}
          otherModel={session.debaterAModel}
          player="Player 02"
          selectedId={session.debaterBId}
          selectedModel={session.debaterBModel}
          onCharacter={(id) => onEvent({ type: "edit_setup", patch: { debaterBId: id } })}
          onModel={(model) => onEvent({ type: "edit_setup", patch: { debaterBModel: model } })}
        />
      </div>
      <div className="flex justify-center">
        <Button
          className="h-14 w-full max-w-md font-display text-2xl tracking-wide"
          disabled={!ready}
          type="submit"
        >
          Start debate
        </Button>
      </div>
    </form>
  );
}

function SidePanel({
  label,
  player,
  selectedId,
  otherId,
  modelId,
  modelLabel,
  selectedModel,
  otherModel,
  models,
  onCharacter,
  onModel,
}: {
  label: "For" | "Against";
  player: string;
  selectedId: string | null;
  otherId: string | null;
  modelId: string;
  modelLabel: string;
  selectedModel: string | null;
  otherModel: string | null;
  models: CatalogModel[];
  onCharacter: (id: string | null) => void;
  onModel: (model: string | null) => void;
}) {
  const character = characters.find((item) => item.id === selectedId) ?? null;
  const tone = label === "For" ? "border-for text-for" : "border-against text-against";
  return (
    <article className={`flex min-w-0 flex-col gap-4 border bg-surface p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-widest uppercase">{label}</p>
        <p className="font-mono text-xs tracking-widest text-muted uppercase">{player}</p>
      </div>
      {character ? (
        <button
          aria-label={`Clear ${character.name}, ${label}`}
          className="relative flex h-80 w-full items-end overflow-hidden rounded-sm p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-for"
          type="button"
          onClick={() => onCharacter(null)}
        >
          <Portrait
            className={`absolute inset-0 h-full w-full [mask-size:125%] [-webkit-mask-size:125%] ${tone}`}
            id={character.id}
          />
          <span className="relative z-10">
            <span className="block font-display text-5xl leading-none tracking-wide text-foreground uppercase">
              {character.name}
            </span>
            <span className="mt-2 block font-mono text-xs tracking-widest text-muted uppercase">
              {character.title}
            </span>
            <span className="mt-2 block text-sm text-foreground">{character.tagline}</span>
          </span>
        </button>
      ) : (
        <p className="font-mono text-xs tracking-widest text-muted uppercase">Choose {label}</p>
      )}
      <div aria-label={label} className="grid grid-cols-3 gap-2" role="group">
        {characters.map((item) => {
          const taken = otherId === item.id;
          const selected = selectedId === item.id;
          return (
            <Button
              key={item.id}
              aria-label={taken ? `${item.name}, Already chosen` : undefined}
              aria-pressed={selected}
              className={`relative h-40 items-end justify-end overflow-hidden whitespace-normal p-0 ${selected ? tone : "text-muted"}`}
              disabled={taken}
              type="button"
              variant="outline"
              onClick={() => onCharacter(item.id)}
            >
              <Portrait
                className="pointer-events-none absolute inset-0 h-full w-full [mask-size:145%] [-webkit-mask-size:145%]"
                id={item.id}
              />
              <span className="relative z-10 mt-auto flex w-full items-end justify-between gap-1 bg-surface/80 px-1 py-0.5 text-left text-xs font-normal text-foreground">
                <span>{item.name}</span>
                {selected ? <Check /> : null}
              </span>
              {taken ? (
                <span className="relative z-10 w-full bg-surface/80 px-1 text-left text-xs font-normal text-foreground">
                  Already chosen
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Label className="font-mono text-xs tracking-widest uppercase" htmlFor={modelId}>
          Model
        </Label>
        <select
          aria-label={modelLabel}
          className="h-9 w-full min-w-0 rounded-sm border border-border bg-surface-raised px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-for"
          id={modelId}
          value={selectedModel ?? ""}
          onChange={(event) => onModel(event.target.value === "" ? null : event.target.value)}
        >
          <option value="">Choose a model</option>
          {DEBATER_MODELS.map((tag) => {
            const choice = optionState(tag, models, otherModel);
            return (
              <option key={tag} disabled={choice.disabled} value={tag}>
                {choice.label}
              </option>
            );
          })}
        </select>
      </div>
    </article>
  );
}

function JudgeCard({ models }: { models: CatalogModel[] }) {
  return (
    <article className="flex w-64 flex-col gap-3 border border-border bg-surface p-4 text-foreground">
      <p className="text-center font-mono text-xs tracking-widest text-muted uppercase">Judge</p>
      <div className="relative h-56 overflow-hidden">
        <Portrait
          className="absolute inset-0 h-full w-full text-foreground"
          id="nubi"
        />
      </div>
      <div className="text-center">
        <p className="font-display text-5xl leading-none tracking-wide uppercase">Nubi</p>
        <p className="mt-2 font-mono text-xs tracking-widest text-muted uppercase">The Weigher</p>
        <p className="mt-2 text-sm">Still. Exact. Final.</p>
      </div>
      <p className="text-center text-sm">{judgeText(models)}</p>
      <p className="text-center font-mono text-xs tracking-widest text-muted uppercase">3 rounds</p>
    </article>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 12 12">
      <path d="M2 6.2 4.6 9 10 3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function optionState(tag: string, models: CatalogModel[], otherModel: string | null) {
  const installed = models.find((model) => model.name === tag);
  const missing = installed === undefined;
  const taken = otherModel === tag;
  const size = installed?.parameterBillions;
  const base = size !== null && size !== undefined && size > 0 ? `${tag} (${size}B)` : tag;
  const notes = [taken ? "Already chosen" : null, missing ? "Not installed" : null].filter(
    (note) => note !== null,
  );
  return {
    disabled: missing || taken,
    label: notes.length === 0 ? base : `${base}, ${notes.join(", ")}`,
  };
}

function judgeText(models: CatalogModel[]): string {
  const installed = models.find((model) => model.name === JUDGE_MODEL);
  if (installed === undefined) {
    return `${JUDGE_MODEL}, Not installed`;
  }
  if (installed.parameterBillions !== null && installed.parameterBillions > 0) {
    return `${JUDGE_MODEL} (${installed.parameterBillions}B)`;
  }
  return JUDGE_MODEL;
}
