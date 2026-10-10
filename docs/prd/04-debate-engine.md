# PRD 04 — Debate Engine and Round Orchestration

## 1. Purpose

Decide, in plain TypeScript, whether a debate can start, whose speech is next, and when the transcript is ready for the judge. This module must be testable with no UI and no model.

## 2. User stories

- D-US-1. As a player, I get a debate only when the topic and the two characters are valid.
- D-US-2. As a player, speeches happen in a fixed order, and a failed generation does not skip someone.
- D-US-3. As a developer, I can simulate a full six-speech transcript in a unit test.

## 3. Scope

### Included

- Debate state, `createDebate`, `restoreDebate`, `getExpectedTurn`, `appendTurn`, and `markJudged`.
- Topic validation and character-pair validation.
- Protection against skipped, repeated, and out-of-order speeches.
- Unit tests for those transitions.

### Excluded

- Calling Ollama, building personality prompts, and scoring. PRD 03 builds prompts. PRD 02 calls the model. PRD 05 judges.
- Pause, cancel, and the in-flight lock. Those are UI concerns in PRD 06. This engine only changes when `appendTurn` is called.
- Persisting the debate.

## 4. Requirements

- D-1. Implement the `DebateState` and `Turn` shapes from PRD 00 in `lib/debate/types.ts`.
- D-2. `createDebate({ topic, debaterAId, debaterBId, debaterAModel, debaterBModel, judgeModel })` returns a result object, not a thrown error:

  ```ts
  type StepResult<T> =
    | { ok: true; value: T }
    | { ok: false; code: "INVALID_INPUT" | "DEBATE_STATE_CONFLICT"; message: string };
  ```

  Success status is `in_progress` and `turns` is empty.
- D-3. Topic validation trims ends, then accepts 8 to 240 characters. Reject an empty result, a shorter string, a longer string, and any string that contains a NUL character. Internal spaces remain.
- D-4. `debaterAId` and `debaterBId` must both exist in `getCharacter` and must differ. Compare ids with exact case. `rex` is valid. `Rex` is not.
- D-4a. Trim each model name. Reject an empty result, a name longer than 200 characters, and any name that contains a NUL. `debaterAModel` and `debaterBModel` must differ as exact strings. `judgeModel` must differ from both. Store the trimmed names. This module does not check the size band or the installed catalog. PRDs 05 and 06 do that before calling Ollama.
- D-5. Slot A is affirmative and slot B is negative. The engine does not store a separate side field. Callers derive side from the slot.
- D-6. `getExpectedTurn` returns the next speech from the table in PRD 00 while status is `in_progress`. It returns `null` when status is `awaiting_judge` or `complete`.
- D-7. `appendTurn(state, turn)` succeeds only when `turn.round` and `turn.speaker` equal `getExpectedTurn(state)`, and `turn.text` trims to 1–4,000 characters. Stored text is the trimmed text. Text that is empty or too long is `INVALID_INPUT`. A well-formed speech at the wrong time is `DEBATE_STATE_CONFLICT`.
- D-8. After the sixth successful append, status is `awaiting_judge` and `getExpectedTurn` is `null`.
- D-9. A seventh append, an append during `awaiting_judge` or `complete`, or an append with the wrong round or speaker returns `DEBATE_STATE_CONFLICT` and does not change the previous state. Functions return a new state on success. They do not mutate the input.
- D-10. `restoreDebate({ topic, debaterAId, debaterBId, debaterAModel, debaterBModel, judgeModel, turns })` validates the setup, then appends each turn in order through the same rules as `appendTurn`. Any illegal turn fails the whole restore. A zero-length list is `in_progress`. A legal six-turn list is `awaiting_judge`.
- D-11. `markJudged(state)` moves `awaiting_judge` to `complete`. Any other status returns `DEBATE_STATE_CONFLICT`. It does not accept or invent scores.
- D-12. The legal order is fixed: opening A, opening B, rebuttal A, rebuttal B, closing A, closing B. Tests must fail if someone reorders this.
- D-13. This module does not import `lib/ollama/`. It may import `getCharacter` from `lib/characters/`.
- D-14. Duplicate protection at this layer means a second append of the speech that was just stored fails, because that speech is no longer expected. The HTTP `409` and the client in-flight lock are specified in PRDs 00 and 06. `restoreDebate` is how the route checks the transcript the client sent.

## 5. Technical approach

Files:

```text
lib/debate/types.ts
lib/debate/validation.ts
lib/debate/models.ts
lib/debate/engine.ts
lib/debate/index.ts
tests/debate/engine.test.ts
tests/debate/models.test.ts
```

Keep validation separate from transition functions so the route and the UI can share `validateTopic`.

Recommended exports:

```ts
function validateTopic(topic: string): StepResult<string>;
function sameSizeBand(leftBillions: number, rightBillions: number): boolean;
function createDebate(input: {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
}): StepResult<DebateState>;
function getExpectedTurn(state: DebateState): { round: RoundId; speaker: SpeakerSlot } | null;
function appendTurn(state: DebateState, turn: Turn): StepResult<DebateState>;
function restoreDebate(input: {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
  turns: Turn[];
}): StepResult<DebateState>;
function markJudged(state: DebateState): StepResult<DebateState>;
```

`createDebate` stores the trimmed topic and the trimmed model names.

`sameSizeBand` implements the PRD 00 rule: both arguments are finite and greater than 0, and the larger divided by the smaller is at most `1.5`. The engine does not call it. The UI and the turn and judge routes do, after they read `parameterBillions` from the catalog.

Do not add a `phase` field. UI phases (`setup`, `debate`, `results`) stay in PRD 06 and PRD 07.

Cancellation and retry, specified here so the UI PRD has a single rule:

- If generation fails or the player cancels, the caller must not call `appendTurn`. The expected speech stays the same, so a retry is another attempt at `getExpectedTurn`.
- If the player pauses, the caller finishes the current request only when it was not aborted, appends that speech if it matches, and does not start the following speech. The engine has no pause flag.

Prompt construction stays in `buildTurnMessages`. The engine does not format prompts. The turn route in PRD 06 is the composer: `restoreDebate` to authorize the request, then `buildTurnMessages` for the expected speaker.

## 6. Dependencies

- PRD 00 for the order, status names, and length limits.
- PRD 03 for `getCharacter` and the shared turn types.
- Does not require PRD 02, the UI, or the judge.
- PRD 05 and PRD 06 depend on `restoreDebate` and `getExpectedTurn`.

## 7. Error and edge cases

| Case | Result |
| --- | --- |
| Topic `"  hello  "` (5 chars after trim) | `INVALID_INPUT` |
| Topic of 8 spaces | `INVALID_INPUT` after trim |
| Topic of 8 non-space characters | `ok` |
| Topic of 240 characters | `ok` |
| Topic of 241 characters | `INVALID_INPUT` |
| Topic with a NUL | `INVALID_INPUT` |
| Same character in both slots | `INVALID_INPUT` |
| Same model on both speakers | `INVALID_INPUT` |
| Judge model equal to either speaker | `INVALID_INPUT` |
| Blank or 201-character model name | `INVALID_INPUT` |
| Unknown id | `INVALID_INPUT` |
| Append B while A should speak | `DEBATE_STATE_CONFLICT` |
| Append opening when rebuttal is next | `DEBATE_STATE_CONFLICT` |
| Empty or whitespace speech | `INVALID_INPUT` | 
| Speech of 4,001 characters after trim | `INVALID_INPUT` |
| Restore with turns swapped | `DEBATE_STATE_CONFLICT` at the first bad turn |
| `markJudged` before six speeches | `DEBATE_STATE_CONFLICT` |
| `markJudged` twice | `DEBATE_STATE_CONFLICT` |

Use `INVALID_INPUT` when the speech text itself is unusable. Use `DEBATE_STATE_CONFLICT` when the text is fine but it is not the next legal speech.

The engine does not retry a model call and does not time out. Those stay in the gateway.

## 8. Testing strategy

All tests are deterministic. No mocks of Ollama and no jsdom.

Required cases:

- Create with Rex versus Athena, a valid topic, empty turns, status `in_progress`, expected turn opening A.
- Reject short, long, blank, and NUL topics.
- Reject identical ids and an unknown id.
- Reject identical speaker models, a judge model equal to a speaker, and a blank model name.
- `sameSizeBand(7, 8)` and `sameSizeBand(3.2, 4)` are true. `sameSizeBand(7, 14)` and `sameSizeBand(3, 8)` are false.
- Append six scripted speeches and assert the expected turn before each append.
- After the sixth, status is `awaiting_judge` and the next turn is `null`.
- The state object passed into `appendTurn` is unchanged after a successful append (new object returned).
- Wrong speaker, wrong round, seventh speech, and append after `markJudged` fail.
- Empty text fails with `INVALID_INPUT` and leaves the original state usable for a later successful append.
- `restoreDebate` of the same six speeches equals a debate built with six appends, comparing status, topic, ids, model names, and turn text.
- `restoreDebate` of five speeches is still `in_progress` and expects closing B.
- `markJudged` succeeds only from `awaiting_judge`.

Use a fixture topic `Should AI replace human teachers?`, ids `rex` and `athena`, speaker models `llama3.2:latest` and `qwen2.5:7b`, and judge model `gemma2:9b`. Those strings are fixtures. This PRD does not contact Ollama to prove they are installed.

## 9. Acceptance criteria

- AC-D-1. A test-only script can create a debate and reach `awaiting_judge` without importing React or the Ollama client.
- AC-D-2. The six-step order in D-12 is asserted in a test.
- AC-D-3. Illegal appends do not mutate the prior state.
- AC-D-4. `npm test` covers the cases in section 8 and passes with Ollama stopped.
- AC-D-5. No route handler is required for this PRD. Adding one is deferred to PRD 05 (judge) and PRD 06 (turn).

## 10. Implementation tasks

1. Add or extend `lib/debate/types.ts` without changing the PRD 00 field names.
2. Implement topic validation and the engine functions.
3. Write the transition tests listed in section 8.
4. Run `npm test` and `npm run lint`.
5. Do not wire the debate page yet.

## 11. Open questions

None. Turn order and side assignment are fixed in PRD 00.
