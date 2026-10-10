"use client";

import { CHARACTERS } from "@/lib/characters";
import { canStart, DEBATER_MODELS, JUDGE_MODEL } from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const startHelper =
  "Enter a topic of at least 8 characters, choose two different characters, and choose two installed debater models.";

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
      className="mt-6 flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          onEvent({ type: "start" });
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="debate-topic">Debate topic</Label>
        <Textarea
          id="debate-topic"
          value={session.topicDraft}
          onChange={(event) =>
            onEvent({ type: "edit_setup", patch: { topicDraft: event.target.value } })
          }
        />
        <p className="text-sm text-muted">
          Yes/no and &quot;Should&quot; questions work well. The topic does not need one correct
          answer.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DebaterSlot
          title="Debater A · For"
          modelLabel="Model for Debater A"
          modelId="model-a"
          characters={characters}
          selectedId={session.debaterAId}
          otherId={session.debaterBId}
          selectedModel={session.debaterAModel}
          otherModel={session.debaterBModel}
          models={models}
          onCharacter={(id) => onEvent({ type: "edit_setup", patch: { debaterAId: id } })}
          onModel={(model) => onEvent({ type: "edit_setup", patch: { debaterAModel: model } })}
        />
        <DebaterSlot
          title="Debater B · Against"
          modelLabel="Model for Debater B"
          modelId="model-b"
          characters={characters}
          selectedId={session.debaterBId}
          otherId={session.debaterAId}
          selectedModel={session.debaterBModel}
          otherModel={session.debaterAModel}
          models={models}
          onCharacter={(id) => onEvent({ type: "edit_setup", patch: { debaterBId: id } })}
          onModel={(model) => onEvent({ type: "edit_setup", patch: { debaterBModel: model } })}
        />
      </div>
      <p>
        <span className="font-medium">Judge model</span> {judgeText(models)}
      </p>
      <div className="flex flex-col gap-2">
        <Button disabled={!ready} type="submit">
          Start debate
        </Button>
        {ready ? null : <p className="text-sm text-muted">{startHelper}</p>}
      </div>
    </form>
  );
}

function DebaterSlot({
  title,
  modelLabel,
  modelId,
  characters: roster,
  selectedId,
  otherId,
  selectedModel,
  otherModel,
  models,
  onCharacter,
  onModel,
}: {
  title: string;
  modelLabel: string;
  modelId: string;
  characters: (typeof characters)[number][];
  selectedId: string | null;
  otherId: string | null;
  selectedModel: string | null;
  otherModel: string | null;
  models: CatalogModel[];
  onCharacter: (id: string) => void;
  onModel: (model: string | null) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
        <div className="flex flex-col gap-2">
          {roster.map((character) => {
            const taken = otherId === character.id;
            const selected = selectedId === character.id;
            return (
              <Button
                key={character.id}
                aria-label={taken ? `${character.name}, Already chosen` : undefined}
                aria-pressed={selected}
                disabled={taken}
                type="button"
                className="h-auto w-full whitespace-normal px-3 py-3"
                variant={selected ? "default" : "outline"}
                onClick={() => onCharacter(character.id)}
              >
                <span className="flex flex-col items-start gap-1 text-left">
                  <span>{character.name}</span>
                  {selected ? <span>Selected</span> : null}
                  <span className="text-xs">{character.title}</span>
                  <span className="text-xs font-normal">{character.summary}</span>
                </span>
              </Button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={modelId}>Model</Label>
          <select
            aria-label={modelLabel}
            className="h-9 w-full min-w-0 rounded-sm border border-border bg-surface-raised px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header"
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
      </CardContent>
    </Card>
  );
}

function optionState(tag: string, models: CatalogModel[], otherModel: string | null) {
  const installed = models.find((model) => model.name === tag);
  const missing = installed === undefined;
  const taken = otherModel === tag;
  const size = installed?.parameterBillions;
  const base =
    size !== null && size !== undefined && size > 0 ? `${tag} (${size}B)` : tag;
  const notes = [
    taken ? "Already chosen" : null,
    missing ? "Not installed" : null,
  ].filter((note) => note !== null);
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
