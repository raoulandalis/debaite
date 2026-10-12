import { expect, test } from "vitest";
import { initialSession, playbackReducer } from "@/lib/debate";
import type { GameSession, PlaybackEvent, Turn } from "@/lib/debate";
import { JUDGMENT_DISCLAIMER, toJudgment } from "@/lib/judge";
import type { JudgeModelOutput, Judgment } from "@/lib/judge";

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

const worked = { reasoning: 8, rebuttal: 6, evidence: 5, clarity: 7 };

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

function output(
  debaterA: JudgeModelOutput["scores"]["debaterA"],
  debaterB: JudgeModelOutput["scores"]["debaterB"],
): JudgeModelOutput {
  return {
    scores: { debaterA, debaterB },
    verdict: "The stronger case answered the other side.",
    strongestArgument: { debaterA: "A best point.", debaterB: "B best point." },
    biggestWeakness: { debaterA: "A largest hole.", debaterB: "B largest hole." },
  };
}

function throughFive(): GameSession {
  let state = apply(readySession(), { type: "start" });
  for (let index = 0; index < 5; index += 1) {
    state = apply(state, { type: "turn_succeeded", turn: speech(index) });
    state = apply(state, { type: "resume" });
  }
  return state;
}

function awaitingJudge(): GameSession {
  return apply(throughFive(), { type: "turn_succeeded", turn: speech(5) });
}

function judging(): GameSession {
  return apply(awaitingJudge(), { type: "judge_started" });
}

test("a paused sixth speech leaves pending null", () => {
  const paused = apply(throughFive(), { type: "pause" });
  const next = apply(paused, { type: "turn_succeeded", turn: speech(5) });
  expect(next.debate?.status).toBe("awaiting_judge");
  expect(next.debate?.turns).toHaveLength(6);
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.phase).toBe("debate");
});

test("judge_succeeded with the worked example stores 66.50 and phase results", () => {
  const body = toJudgment(output(worked, worked));
  const next = apply(judging(), { type: "judge_succeeded", body });
  expect(next.phase).toBe("results");
  expect(next.judgment?.scores.a.weightedDisplay).toBe("66.50");
  expect(next.judgment?.scores.b.weightedDisplay).toBe("66.50");
  expect(next.judgment?.disclaimer).toBe(JUDGMENT_DISCLAIMER);
  expect(next.debate?.status).toBe("complete");
  expect(next.pending).toBeNull();
  expect(next.error).toBeNull();
});

test("judge_succeeded with mismatched weightedUnits stays on debate", () => {
  const body = toJudgment(output(worked, worked));
  body.scores.a.weightedUnits = 666;
  const next = apply(judging(), { type: "judge_succeeded", body });
  expect(next.phase).toBe("debate");
  expect(next.judgment).toBeNull();
  expect(next.debate?.turns).toHaveLength(6);
  expect(next.debate?.status).toBe("awaiting_judge");
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.error?.message).toBe("The judge response could not be verified. You can retry.");
});

test("judge_failed keeps six turns and a null judgment", () => {
  const next = apply(judging(), {
    type: "judge_failed",
    error: { code: "OLLAMA_TIMEOUT", message: "Ollama took too long to respond." },
  });
  expect(next.phase).toBe("debate");
  expect(next.judgment).toBeNull();
  expect(next.debate?.turns).toHaveLength(6);
  expect(next.pending).toBeNull();
  expect(next.playback).toBe("paused");
  expect(next.error?.message).toBe("Ollama took too long to respond.");
});

test("a turn_succeeded while judging does not append", () => {
  const next = apply(judging(), { type: "turn_succeeded", turn: speech(0) });
  expect(next.debate?.turns).toHaveLength(6);
  expect(next.pending).toEqual({ kind: "judge" });
  expect(next.judgment).toBeNull();
});

test("play again produces an empty in-progress debate and pending opening A", () => {
  const judged = apply(judging(), {
    type: "judge_succeeded",
    body: toJudgment(output(worked, worked)),
  });
  const next = apply(judged, { type: "play_again" });
  expect(next.phase).toBe("debate");
  expect(next.judgment).toBeNull();
  expect(next.playback).toBe("running");
  expect(next.pending).toEqual({ kind: "turn", round: "opening", speaker: "a" });
  expect(next.debate?.status).toBe("in_progress");
  expect(next.debate?.turns).toEqual([]);
  expect(next.debate?.topic).toBe("Should AI replace human teachers?");
  expect(next.debate?.debaterAId).toBe("rex");
  expect(next.debate?.debaterBId).toBe("athena");
  expect(next.debate?.debaterAModel).toBe("mistral:7b");
  expect(next.debate?.debaterBModel).toBe("llama3.1:8b");
  expect(next.debate?.judgeModel).toBe("gemma2:9b");
});

test("new debate keeps the draft topic, ids, and model choices and clears debate", () => {
  const judged = apply(judging(), {
    type: "judge_succeeded",
    body: toJudgment(output(worked, worked)),
  });
  const next = apply(judged, { type: "new_debate" });
  expect(next.phase).toBe("setup");
  expect(next.debate).toBeNull();
  expect(next.judgment).toBeNull();
  expect(next.pending).toBeNull();
  expect(next.topicDraft).toBe("Should AI replace human teachers?");
  expect(next.debaterAId).toBe("rex");
  expect(next.debaterBId).toBe("athena");
  expect(next.debaterAModel).toBe("mistral:7b");
  expect(next.debaterBModel).toBe("llama3.1:8b");
  expect(next.judgeModel).toBe("gemma2:9b");
});

test("judge_succeeded is ignored unless pending is a judge", () => {
  const early = throughFive();
  const body: Judgment = toJudgment(output(worked, worked));
  const next = apply(early, { type: "judge_succeeded", body });
  expect(next.phase).toBe("debate");
  expect(next.judgment).toBeNull();
  expect(next.debate?.turns).toHaveLength(5);
});
