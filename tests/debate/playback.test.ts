import { expect, test } from "vitest";
import {
  canStart,
  initialSession,
  playbackReducer,
} from "@/lib/debate";
import type { GameSession, PlaybackEvent } from "@/lib/debate";
import type { Turn } from "@/lib/debate";

const catalog = [
  { name: "mistral:7b", parameterBillions: 7.2 },
  { name: "qwen2.5:7b", parameterBillions: 7.6 },
  { name: "llama3.1:8b", parameterBillions: 8 },
  { name: "gemma2:9b", parameterBillions: 9.2 },
  { name: "llama3.2:latest", parameterBillions: 3.2 },
];

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

function readySession(): GameSession {
  return playbackReducer(initialSession(), {
    type: "edit_setup",
    patch: {
      topicDraft: "Should AI replace human teachers?",
      debaterAId: "rex",
      debaterBId: "athena",
      debaterAModel: "mistral:7b",
      debaterBModel: "llama3.1:8b",
    },
  });
}

function speech(index: number): Turn {
  const step = order[index];
  return { round: step.round, speaker: step.speaker, text: `Speech ${index + 1}` };
}

function apply(state: GameSession, event: PlaybackEvent): GameSession {
  return playbackReducer(state, event);
}

test("start with Rex versus Athena sets pending to opening A", () => {
  const next = apply(readySession(), { type: "start" });
  expect(next.phase).toBe("debate");
  expect(next.playback).toBe("running");
  expect(next.pending).toEqual({ kind: "turn", round: "opening", speaker: "a" });
  expect(next.debate?.judgeModel).toBe("gemma2:9b");
  expect(next.judgment).toBeNull();
});

test("a short topic does not leave setup", () => {
  const session = apply(initialSession(), {
    type: "edit_setup",
    patch: {
      topicDraft: "1234567",
      debaterAId: "rex",
      debaterBId: "athena",
      debaterAModel: "mistral:7b",
      debaterBModel: "llama3.1:8b",
    },
  });
  const next = apply(session, { type: "start" });
  expect(next.phase).toBe("setup");
  expect(next.debate).toBeNull();
  expect(next.error?.code).toBe("INVALID_INPUT");
});

test("canStart follows the roster and the installed judge", () => {
  const base = {
    topic: "Should AI replace human teachers?",
    debaterAId: "rex",
    debaterBId: "athena",
    debaterAModel: "mistral:7b",
    debaterBModel: "llama3.1:8b",
    judgeModel: null,
    models: catalog,
  };
  expect(canStart({ ...base, topic: "1234567" })).toBe(false);
  expect(canStart({ ...base, debaterAModel: "llama3.2:latest" })).toBe(false);
  expect(
    canStart({
      ...base,
      models: catalog.filter((model) => model.name !== "gemma2:9b"),
    }),
  ).toBe(false);
  expect(canStart(base)).toBe(true);
});

test("turn_succeeded appends and waits instead of starting the next speech", () => {
  const started = apply(readySession(), { type: "start" });
  const next = apply(started, { type: "turn_succeeded", turn: speech(0) });
  expect(next.debate?.turns).toEqual([speech(0)]);
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.error).toBeNull();
});

test("resume after a speech requests the next turn", () => {
  const started = apply(readySession(), { type: "start" });
  const held = apply(started, { type: "turn_succeeded", turn: speech(0) });
  const next = apply(held, { type: "resume" });
  expect(next.playback).toBe("running");
  expect(next.pending).toEqual({ kind: "turn", round: "opening", speaker: "b" });
});

test("turn_succeeded while paused appends and leaves pending null", () => {
  const started = apply(readySession(), { type: "start" });
  const paused = apply(started, { type: "pause" });
  const next = apply(paused, { type: "turn_succeeded", turn: speech(0) });
  expect(next.debate?.turns).toEqual([speech(0)]);
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
});

test("a mismatched turn_succeeded does not change turns", () => {
  const started = apply(readySession(), { type: "start" });
  const next = apply(started, { type: "turn_succeeded", turn: speech(1) });
  expect(next.debate?.turns).toEqual([]);
  expect(next.pending).toEqual(started.pending);
});

test("turn_failed does not add a turn", () => {
  const started = apply(readySession(), { type: "start" });
  const next = apply(started, {
    type: "turn_failed",
    error: { code: "OLLAMA_TIMEOUT", message: "Ollama took too long to respond." },
  });
  expect(next.debate?.turns).toEqual([]);
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.error?.code).toBe("OLLAMA_TIMEOUT");
});

test("six successes leave the debate paused for the judge", () => {
  let state = apply(readySession(), { type: "start" });
  for (let index = 0; index < 6; index += 1) {
    if (index > 0) {
      state = apply(state, { type: "resume" });
    }
    state = apply(state, { type: "turn_succeeded", turn: speech(index) });
  }
  expect(state.debate?.status).toBe("awaiting_judge");
  expect(state.debate?.turns).toHaveLength(6);
  expect(state.pending).toBeNull();
  expect(state.playback).toBe("paused");
  expect(state.phase).toBe("debate");
  expect(state.judgment).toBeNull();
});

test("cancel clears pending without appending", () => {
  const started = apply(readySession(), { type: "start" });
  const next = apply(started, { type: "cancel" });
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.debate?.turns).toEqual([]);
});
