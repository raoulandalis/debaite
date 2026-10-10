import { expect, test } from "vitest";
import {
  appendTurn,
  createDebate,
  getExpectedTurn,
  markJudged,
  restoreDebate,
  validateTopic,
} from "@/lib/debate";
import type { DebateState, StepResult, Turn } from "@/lib/debate";

const setup = {
  topic: "Should AI replace human teachers?",
  debaterAId: "rex",
  debaterBId: "athena",
  debaterAModel: "llama3.2:latest",
  debaterBModel: "qwen2.5:7b",
  judgeModel: "gemma2:9b",
};

const order = [
  { round: "opening", speaker: "a" },
  { round: "opening", speaker: "b" },
  { round: "rebuttal", speaker: "a" },
  { round: "rebuttal", speaker: "b" },
  { round: "closing", speaker: "a" },
  { round: "closing", speaker: "b" },
] as const;

function speech(index: number, text = `Speech ${index + 1}`): Turn {
  const step = order[index];
  return { round: step.round, speaker: step.speaker, text };
}

function expectInvalid(result: StepResult<unknown>) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("INVALID_INPUT");
  }
}

function expectConflict(result: StepResult<unknown>) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("DEBATE_STATE_CONFLICT");
  }
}

function created(): DebateState {
  const result = createDebate(setup);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

test("accepts a topic and returns it unchanged when it is already trimmed", () => {
  const result = validateTopic("Should AI replace human teachers?");
  expect(result).toEqual({
    ok: true,
    value: "Should AI replace human teachers?",
  });
});

test("trims the ends of a topic and keeps internal spaces", () => {
  expect(validateTopic("  Should AI replace human teachers?  ")).toEqual({
    ok: true,
    value: "Should AI replace human teachers?",
  });
  expect(validateTopic("hello  world!!")).toEqual({
    ok: true,
    value: "hello  world!!",
  });
});

test("accepts a topic of 8 or 240 characters", () => {
  expect(validateTopic("12345678")).toEqual({ ok: true, value: "12345678" });
  expect(validateTopic("a".repeat(240))).toEqual({
    ok: true,
    value: "a".repeat(240),
  });
});

test("rejects a topic that is short, blank, too long, or contains NUL", () => {
  for (const topic of ["  hello  ", "        ", "", "a".repeat(241), "ok\0topic"]) {
    expectInvalid(validateTopic(topic));
  }
});

test("creates an in-progress debate whose next speech is opening A", () => {
  const result = createDebate(setup);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value).toEqual({
    ...setup,
    status: "in_progress",
    turns: [],
  });
  expect(getExpectedTurn(result.value)).toEqual({
    round: "opening",
    speaker: "a",
  });
});

test("stores a trimmed topic and trimmed model names", () => {
  const result = createDebate({
    ...setup,
    topic: "  Should AI replace human teachers?  ",
    debaterAModel: "  llama3.2:latest  ",
    debaterBModel: " qwen2.5:7b ",
    judgeModel: " gemma2:9b ",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.topic).toBe(setup.topic);
  expect(result.value.debaterAModel).toBe(setup.debaterAModel);
  expect(result.value.debaterBModel).toBe(setup.debaterBModel);
  expect(result.value.judgeModel).toBe(setup.judgeModel);
});

test("rejects an invalid topic, character pair, or model name", () => {
  expectInvalid(createDebate({ ...setup, topic: "  hello  " }));
  expectInvalid(createDebate({ ...setup, topic: "a".repeat(241) }));
  expectInvalid(createDebate({ ...setup, topic: "        " }));
  expectInvalid(createDebate({ ...setup, topic: "ok\0topic!!" }));
  expectInvalid(createDebate({ ...setup, debaterBId: "rex" }));
  expectInvalid(createDebate({ ...setup, debaterAId: "Rex" }));
  expectInvalid(createDebate({ ...setup, debaterBId: "unknown" }));
  expectInvalid(
    createDebate({ ...setup, debaterBModel: setup.debaterAModel }),
  );
  expectInvalid(
    createDebate({ ...setup, judgeModel: setup.debaterAModel }),
  );
  expectInvalid(
    createDebate({ ...setup, judgeModel: setup.debaterBModel }),
  );
  expectInvalid(createDebate({ ...setup, debaterAModel: "   " }));
  expectInvalid(createDebate({ ...setup, debaterAModel: "m".repeat(201) }));
  expectInvalid(createDebate({ ...setup, judgeModel: "gemma\0" }));
  expectInvalid(
    createDebate({
      ...setup,
      debaterBModel: "  llama3.2:latest  ",
    }),
  );
});

test("appends six speeches in order and then waits for the judge", () => {
  let state = created();
  for (let index = 0; index < order.length; index += 1) {
    expect(getExpectedTurn(state)).toEqual(order[index]);
    const result = appendTurn(state, speech(index));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    state = result.value;
    if (index < order.length - 1) {
      expect(state.status).toBe("in_progress");
    }
  }
  expect(state.status).toBe("awaiting_judge");
  expect(state.turns.map((turn) => turn.text)).toEqual([
    "Speech 1",
    "Speech 2",
    "Speech 3",
    "Speech 4",
    "Speech 5",
    "Speech 6",
  ]);
  expect(getExpectedTurn(state)).toBeNull();
});

test("returns a new state and stores trimmed speech text", () => {
  const state = created();
  const turns = state.turns;
  const result = appendTurn(state, speech(0, "  Speech 1  "));
  expect(state.turns).toBe(turns);
  expect(state.turns).toEqual([]);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value).not.toBe(state);
  expect(result.value.turns).toEqual([
    { round: "opening", speaker: "a", text: "Speech 1" },
  ]);
});

test("rejects a speech in the wrong slot without changing state", () => {
  const state = created();
  expectConflict(appendTurn(state, speech(1)));
  expectConflict(
    appendTurn(state, { round: "rebuttal", speaker: "a", text: "Too soon" }),
  );
  expect(state.turns).toEqual([]);
  expect(getExpectedTurn(state)).toEqual(order[0]);
});

test("rejects a seventh speech", () => {
  let state = created();
  for (let index = 0; index < order.length; index += 1) {
    const result = appendTurn(state, speech(index));
    if (!result.ok) {
      throw new Error(result.message);
    }
    state = result.value;
  }
  expectConflict(appendTurn(state, speech(0, "One more")));
  expect(state.turns).toHaveLength(6);
  expect(state.status).toBe("awaiting_judge");
});

test("rejects empty or oversized speech text and still accepts the next legal speech", () => {
  const state = created();
  expectInvalid(appendTurn(state, speech(0, "")));
  expectInvalid(appendTurn(state, speech(0, "   \n  ")));
  expectInvalid(appendTurn(state, speech(0, `  ${"a".repeat(4001)}  `)));
  expect(state.turns).toEqual([]);

  const accepted = appendTurn(state, speech(0, "a".repeat(4000)));
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) {
    return;
  }
  expect(accepted.value.turns[0].text).toHaveLength(4000);
});

function played(count: number): DebateState {
  let state = created();
  for (let index = 0; index < count; index += 1) {
    const result = appendTurn(state, speech(index));
    if (!result.ok) {
      throw new Error(result.message);
    }
    state = result.value;
  }
  return state;
}

test("restores the same debate as six successful appends", () => {
  const turns = order.map((_, index) => speech(index));
  const restored = restoreDebate({ ...setup, turns });
  const playedState = played(6);
  expect(restored.ok).toBe(true);
  if (!restored.ok) {
    return;
  }
  expect(restored.value.status).toBe(playedState.status);
  expect(restored.value.topic).toBe(playedState.topic);
  expect(restored.value.debaterAId).toBe(playedState.debaterAId);
  expect(restored.value.debaterBId).toBe(playedState.debaterBId);
  expect(restored.value.debaterAModel).toBe(playedState.debaterAModel);
  expect(restored.value.debaterBModel).toBe(playedState.debaterBModel);
  expect(restored.value.judgeModel).toBe(playedState.judgeModel);
  expect(restored.value.turns.map((turn) => turn.text)).toEqual(
    playedState.turns.map((turn) => turn.text),
  );
});

test("restores a partial transcript on the next legal speech", () => {
  const five = restoreDebate({
    ...setup,
    turns: order.slice(0, 5).map((_, index) => speech(index)),
  });
  expect(five.ok).toBe(true);
  if (!five.ok) {
    return;
  }
  expect(five.value.status).toBe("in_progress");
  expect(getExpectedTurn(five.value)).toEqual({
    round: "closing",
    speaker: "b",
  });

  const none = restoreDebate({ ...setup, turns: [] });
  expect(none.ok).toBe(true);
  if (!none.ok) {
    return;
  }
  expect(none.value.status).toBe("in_progress");
  expect(getExpectedTurn(none.value)).toEqual({
    round: "opening",
    speaker: "a",
  });
});

test("rejects a restored transcript at the first illegal turn", () => {
  expectConflict(
    restoreDebate({
      ...setup,
      turns: [speech(1), speech(0)],
    }),
  );
  expectInvalid(restoreDebate({ ...setup, topic: "no", turns: [] }));
});

test("marks a finished transcript judged once", () => {
  const waiting = played(6);
  const judged = markJudged(waiting);
  expect(judged.ok).toBe(true);
  if (!judged.ok) {
    return;
  }
  expect(judged.value.status).toBe("complete");
  expect(judged.value.turns).toEqual(waiting.turns);
  expect(waiting.status).toBe("awaiting_judge");

  expectConflict(markJudged(judged.value));
  expect(judged.value.status).toBe("complete");

  const early = created();
  expectConflict(markJudged(early));
  expect(early.status).toBe("in_progress");

  expectConflict(appendTurn(judged.value, speech(0, "late")));
  expect(judged.value.status).toBe("complete");
  expect(judged.value.turns).toHaveLength(6);
});
