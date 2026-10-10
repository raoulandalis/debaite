# PRD 05 — AI Judge and Scoring System

## 1. Purpose

After six speeches, a judge model rates argument quality, and the application turns those ratings into a winner. The model never has the last word on the math.

## 2. User stories

- J-US-1. As a player, I get a winner, a tie, or a visible judging error, never a made-up score.
- J-US-2. As a player, I can read why the winner was chosen and what each side did best and worst.
- J-US-3. As a developer, I can test the rubric math and the JSON parser without a live model.

## 3. Scope

### Included

- Judge prompt using `Debater A` and `Debater B`.
- Zod schema for the model JSON.
- Integer weighted scores, winner, and tie rule from PRD 00.
- `POST /api/debate/judge`.
- One automatic regeneration when the model output is invalid, then a hard error.
- The disclaimer sentence on every successful judgment.

### Excluded

- The debate screen and the results layout (PRDs 06 and 07).
- Streaming.
- A second judge, or a retry that switches to another model. The judge model is the fixed `gemma2:9b` tag from PRD 00.
- Server-side storage of the verdict.
- Any path that substitutes fallback scores, averages, or a coin flip.

## 4. Requirements

- J-1. Criterion weights are reasoning 35, rebuttal 30, evidence 20, and clarity 15. Each model score is an integer from 1 to 10 inclusive.
- J-2. For one side:

  ```text
  weightedUnits = 35*reasoning + 30*rebuttal + 20*evidence + 15*clarity
  weightedDisplay = (weightedUnits / 10).toFixed(2)
  ```

  `weightedUnits` is an integer from 100 to 1000. `weightedDisplay` is a string from `"10.00"` to `"100.00"`.
- J-3. Compare `weightedUnits` only. The higher side wins. Equal units set `winner` to `"tie"`. Do not use character name, slot order, temperature, or prose length as a tiebreak.
- J-4. The model JSON matches `JudgeModelOutput` in PRD 00. Parse it with Zod. Reject missing fields, extra required-field types that are wrong, non-integers, values outside 1–10, and prose that is empty or longer than 600 characters after trim. Do not clamp numbers into range.
- J-5. If the model also sends `winner`, `weightedUnits`, or a character name field, ignore those keys. Do not fail a valid score sheet only because an extra winner key is present.
- J-6. Before parsing, strip a leading BOM and a single surrounding ` ```json ` fence if present. Then `JSON.parse`. If that throws, take the substring from the first `{` through the last `}` and parse that. If that still fails, the output is invalid.
- J-7. `buildJudgeMessages(debate)` returns one system message and one user message. The user message contains the topic and six speeches labeled `Debater A` or `Debater B` in order. It contains the rubric and a JSON example using `debaterA` and `debaterB`.
- J-8. The judge messages must not include character names, titles, monograms, personality prompts, accent colors, or model names. The topic and speech text are included as the debaters wrote them, so a topic that happens to contain the word "Rex" may still appear. The builder must not look up `getCharacter` to insert a display name.
- J-9. The system message tells the judge to score argument quality only: logic, engagement with the other side, support, and clarity. It tells the judge not to reward humor, confidence, sarcasm, or a preferred side, and not to identify the speakers.
- J-10. `toJudgment(modelOutput)` maps `debaterA` to `scores.a` and `debaterB` to `scores.b`, fills `weightedUnits`, `weightedDisplay`, `winner`, `strongest`, `weakness`, and sets `disclaimer` to exactly:

  ```text
  This verdict is an AI-generated evaluation, not an objective ruling.
  ```

- J-11. `POST /api/debate/judge` accepts `topic`, `debaterAId`, `debaterBId`, and `transcript`. It runs `restoreDebate`. If the result is not `ok` or the status is not `awaiting_judge`, return the matching error from PRD 00 (`400` or `409`) and do not call Ollama.
- J-12. A ready transcript calls `generate` with the judge messages, `model` set to `judgeModel`, `json: true`, temperature `0.3`, and `numPredict: 900`. Do not omit `model` and do not fall back to `OLLAMA_MODEL`. Before that call, reject the roster with the model rules in PRD 00. A speaker model outside `DEBATER_MODELS`, a judge model other than `gemma2:9b`, a judge model equal to either speaker, or speaker models outside the size band is `INVALID_INPUT` and does not call Ollama. A roster name missing from the catalog is `OLLAMA_UNAVAILABLE`. PRD 06 adds this allowlist to the judge route and updates the route fixture from `llama3.2:latest` to a debater-roster pair.
- J-13. If parsing fails, call `generate` one more time with the same messages. If the second output also fails, return `502` with `INVALID_MODEL_OUTPUT`. Do not return partial scores.
- J-14. Gateway errors from the first call are returned immediately. Do not spend the parse retry on `OLLAMA_UNAVAILABLE`, `OLLAMA_TIMEOUT`, or `MODEL_ERROR`.
- J-15. Success returns the `Judgment` object from PRD 00 and HTTP 200. The route does not call `markJudged`; the browser does that after it accepts the body.
- J-16. Error bodies use `{ error: { code, message } }`. Messages are one sentence. They do not include the raw model text, the prompt, or the Ollama URL.
- J-17. Scoring and parsing functions do not import the Ollama client. Only the route handler does.

## 5. Technical approach

Files:

```text
lib/judge/schema.ts
lib/judge/score.ts
lib/judge/prompt.ts
lib/judge/parse.ts
lib/judge/index.ts
app/api/debate/judge/route.ts
tests/judge/score.test.ts
tests/judge/parse.test.ts
tests/judge/prompt.test.ts
tests/judge/route.test.ts
```

Export these names from `lib/judge/score.ts` and re-export them from `lib/judge/index.ts`:

```ts
function scoreSide(scores: CriterionScores): {
  weightedUnits: number;
  weightedDisplay: string;
};

const JUDGMENT_DISCLAIMER: "This verdict is an AI-generated evaluation, not an objective ruling.";
```

`toJudgment` must call `scoreSide` for each side. PRD 07 imports `scoreSide` for its client-side check. Do not copy the formula into a component.

### Judge system message

```text
You are the judge of a debate between Debater A and Debater B.
Score the arguments, not the personalities. You do not know their names.
Ignore humor, confidence, sarcasm, and which side you prefer.
Reward logical consistency, direct answers to the other side, supporting examples, and clear reasoning.
Do not reward insults or claims that were never made.
Return one JSON object and no other text.
```

### Judge user message

Include:

- `Topic: ...`
- Speeches in order as `Debater A (opening):` and `Debater B (opening):`, then rebuttal, then closing.
- The rubric table: Reasoning 35%, Rebuttals 30%, Evidence 20%, Clarity 15%, each scored with an integer from 1 to 10.
- Field meanings: `verdict` explains why the stronger argument won or why it is a dead heat, without announcing a numeric winner. `strongestArgument` quotes or paraphrases each side's best point. `biggestWeakness` names the largest hole in each case.
- An example object with the keys from `JudgeModelOutput` and placeholder integers. The example is clearly labeled as a shape, not as the score to copy.

Tell the model not to include weighted totals. The application will compute them.

### Worked example the tests must use

Side scores: reasoning 8, rebuttal 6, evidence 5, clarity 7.

```text
35*8 + 30*6 + 20*5 + 15*7 = 280 + 180 + 100 + 105 = 665
weightedDisplay = "66.50"
```

A second side with the same four numbers is a tie. A second side with clarity 8 is `680` and wins.

All ones: `weightedUnits` 100, display `"10.00"`. All tens: `1000` and `"100.00"`.

### Route flow

```text
parse body
-> restoreDebate
-> reject unless awaiting_judge
-> buildJudgeMessages
-> generate
-> parseJudgeOutput
-> on invalid output, generate once more and parse again
-> toJudgment
-> JSON response
```

Read the Next.js route-handler docs before adding `app/api/debate/judge/route.ts`. The handler is dynamic because it reads the request and calls Ollama. Do not cache it.

Validate the request body with Zod as well: six items max is not enough; `restoreDebate` checks order. Reject non-object JSON with `INVALID_INPUT`.

### Neutral mapping

The prompt and `weightedUnits` never use `rex`, `athena`, `jester`, or the model names. The route may read the ids and model names to satisfy `restoreDebate` and to pass `judgeModel` to `generate`. The results UI in PRD 07 is what shows "Rex" and that speaker's model next to `scores.a` when slot A is Rex.

## 6. Dependencies

- PRD 00 for the schema, formula, disclaimer, temperatures, and error codes.
- PRD 02 for `generate` and gateway error codes.
- PRD 03 so character ids in fixtures are real. The judge prompt must not import personality text.
- PRD 04 for `restoreDebate`.
- PRD 07 displays the judgment. It should not recompute weights.

Install Zod by this PRD if PRD 02 did not already install it.

## 7. Error and edge cases

| Case | Behavior |
| --- | --- |
| Fewer or more than six speeches | `409 DEBATE_STATE_CONFLICT`. No model call. |
| Scores `{ reasoning: 0 }` or `11` or `8.5` or `"8"` | Invalid output. One retry, then `INVALID_MODEL_OUTPUT`. |
| JSON wrapped in a markdown fence | Accept when the inner object is valid. |
| Prose verdict only, no JSON | Invalid output, then the same retry rule. |
| First call times out | `OLLAMA_TIMEOUT` immediately. |
| First call returns valid JSON | Do not call the model again. |
| Both calls return invalid JSON | `INVALID_MODEL_OUTPUT`. Transcript is unchanged because the server has no session. |
| Model declares Debater A the winner but units say otherwise | Ignore the declaration. Use the units. |
| Tie | `winner: "tie"`. Verdict text may still explain the deadlock. |
| Ollama down | `OLLAMA_UNAVAILABLE`. |
| Judge model equals a speaker model | `400 INVALID_INPUT`. No model call. |
| Speaker model is outside the debater roster, or judge model is not `gemma2:9b` | `400 INVALID_INPUT`. No model call. |
| Judge model is not in the catalog | `502 OLLAMA_UNAVAILABLE`. No model call. |

The route must not keep a score from the failed attempt and merge it with the retry.

## 8. Testing strategy

Unit tests without Ollama:

- The worked example, the tie, the all-ones case, and the all-tens case.
- Reject `0`, `11`, `8.5`, and a numeric string.
- Fence stripping and a `{ ... }` extract from surrounding text.
- A valid object plus an extra `winner` key still scores from the rubric.
- Empty verdict fails.
- `buildJudgeMessages` on a Rex-versus-Athena debate does not contain `Rex`, `Athena`, `Provocateur`, `Strategist`, or the fixture model names when the topic and speeches avoid those words.
- Labels `Debater A` and `Debater B` each appear three times for a full transcript.
- `toJudgment` sets the exact disclaimer.

Route test with `generate` mocked:

- Valid first response returns `66.50` for the fixture, calls `generate` once with `model` equal to the request's `judgeModel`, and does not call `generate` twice.
- Invalid then valid calls `generate` twice and returns the second judgment.
- Invalid twice returns `502` and a body with no `scores` field.
- Timeout on the first call calls `generate` once and returns `504`.
- Five-turn transcript does not call `generate`.

Do not add the live Ollama judge call to `npm test`.

## 9. Acceptance criteria

- AC-J-1. Given the scores in the worked example, the successful API body shows `"66.50"` and a winner that matches the integer units.
- AC-J-2. A tie fixture returns `winner: "tie"` and does not pick slot A by default.
- AC-J-3. A malformed judge response never returns invented criterion scores.
- AC-J-4. The judge prompt for a neutral fixture contains `Debater A` and does not contain the character names.
- AC-J-5. `npm test` passes with Ollama stopped.
- AC-J-6. Every success body includes the disclaimer sentence from J-10.

## 10. Implementation tasks

1. Add the score function and its tests, including the worked example.
2. Add the Zod schema, fence handling, and parser tests.
3. Add the judge prompt and the neutrality test.
4. Add `POST /api/debate/judge` with the single parse retry.
5. Test the route with a mocked `generate`.
6. Run `npm test`, `npm run lint`, and `npm run build`.

## 11. Open questions

None. The verdict remains an in-game evaluation even when the model writes in a confident tone.
