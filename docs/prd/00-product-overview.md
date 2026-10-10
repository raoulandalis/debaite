# PRD 00 — Product Overview and Technical Architecture

## 1. Purpose

DebAIte is a local, account-free debate game. A person picks two AI characters, gives them a topic, watches a three-round argument, and reads a scored verdict from a third AI role acting as judge.

This PRD is the shared context for PRDs 01–08. It fixes the product scope, the runtime boundaries, and the contracts those PRDs must not contradict. It does not specify every screen or prompt.

## 2. User stories

- P-US-1. As a player, I can open the app and finish a debate without creating an account.
- P-US-2. As a player, I can tell who is speaking, which round is active, and who won.
- P-US-3. As a player, I can start another debate after I see the result.
- P-US-4. As a developer, I can run the app against Ollama on my own machine and test the game rules without a live model.

## 3. Scope

### Included

- One playable loop: choose a topic and two characters, run three rounds, judge the transcript, show the result, play again.
- Three built-in characters: Rex, Athena, and Jester. Personalities come from system prompts, not from separate models.
- Server-side calls to a local Ollama server.
- Dark, game-like setup, debate, and results screens.
- Deterministic tests for rules that do not need a model.

### Non-goals

- User accounts, authentication, payments, or a database.
- Saved debate history or sharing a debate by URL.
- A character-creation editor.
- Streaming tokens to the browser.
- More than one model in the MVP. The gateway may accept a model name, but every MVP caller passes `OLLAMA_MODEL`.
- Hosting the Next.js app on Vercel, or any setup that assumes a home Ollama server is publicly reachable.
- Claiming the judge is unbiased, objective, or an authority outside the game.

### Target experience

The product should be understandable to someone who does not know how language models work. The fun comes from distinct personalities, short arguments, a clear ending, and a results screen. It should feel like a small competitive game, not a two-column chat app.

## 4. Requirements

- P-1. The first version is complete when a player can run the journey in section 5 on a machine where Ollama is running and the configured model is installed.
- P-2. The browser never calls Ollama and never receives `OLLAMA_BASE_URL`.
- P-3. Debate progress lives in React state in the browser. Reloading the page discards the session.
- P-4. The server does not store debate sessions. Each turn or judge request includes the transcript it needs.
- P-5. Slot A is the affirmative side and speaks first in every round. Slot B is the negative side.
- P-6. A debate has exactly six speeches, in this order: opening A, opening B, rebuttal A, rebuttal B, closing A, closing B. Then the judge runs.
- P-7. The application computes weighted scores and the winner from validated integers. The model does not supply the winner or the weighted total.
- P-8. Invalid judge output never becomes a displayed score. The UI keeps the transcript and offers a way to judge again.
- P-9. Results copy must say that the verdict is an AI-generated evaluation, not an objective ruling. The exact sentence is the disclaimer in section 5.
- P-10. Later PRDs use the error codes, routes, and data shapes in section 5. They do not invent parallel codes for the same failure.

## 5. Technical approach

### Core journey

1. The player opens DebAIte on the setup phase.
2. They enter a topic, such as "Should AI replace human teachers?"
3. They assign two different characters to slot A and slot B.
4. They start the debate. Speeches generate one after another.
5. They can pause before the next speech or cancel the speech that is generating.
6. After the sixth speech, the judge runs.
7. The results phase shows the winner or a tie, the scores, the verdict, the strongest argument, and the biggest weakness for each side.
8. Play again keeps the topic and characters and starts a new transcript. New debate returns to setup with those fields still filled in.

UI phases are `setup`, `debate`, and `results`. The debate engine status values are `in_progress`, `awaiting_judge`, and `complete`. `complete` means a valid judgment is attached. A judging failure stays in the debate phase.

### Stack

Use the repository as it already exists:

- Next.js 16.4 App Router
- React 19
- TypeScript with `strict`
- Tailwind CSS 4
- shadcn/ui where the CLI works with this Next and Tailwind version; otherwise a small local equivalent
- Ollama for local inference
- Zod for runtime validation at API and model boundaries
- Vitest for unit and component tests

Do not add a database client, an auth library, or a hosted model SDK in the MVP.

Leave these existing `next.config.ts` flags in place: `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. Do not re-run `create-next-app`.

Before writing route handlers or other Next.js APIs, read the matching guide under `node_modules/next/dist/docs/`. This Next.js version differs from older App Router examples.

### Components and responsibilities

| Module | Responsibility |
| --- | --- |
| `components/setup/` | Topic, character choice, and start rules |
| `components/debate/` | Round, turn, transcript, pause, cancel, retry |
| `components/results/` | Winner, scores, verdict, rematch |
| `components/ui/` | Button, card, textarea, label, badge |
| `lib/characters/` | Character records and personality prompts |
| `lib/debate/` | State transitions, topic and roster checks, turn prompts |
| `lib/judge/` | Judge prompt, response schema, weighted score, winner |
| `lib/ollama/` | HTTP client, timeout, health check, gateway errors |
| `app/api/debate/turn/route.ts` | Validate a turn request, build the prompt, return one speech |
| `app/api/debate/judge/route.ts` | Validate a finished transcript, judge it, attach scores |
| `app/api/ollama/health/route.ts` | Report whether Ollama and the configured model respond |

The UI may call the pure debate helpers. Only route handlers may import the Ollama client.

### Data flow

```text
Browser session
  -> POST /api/debate/turn  or  POST /api/debate/judge
    -> validate JSON
    -> debate or judge module builds the prompt
    -> lib/ollama calls POST {OLLAMA_BASE_URL}/api/chat
    -> route validates the model output
    -> judge route adds weighted scores and winner
  <- JSON speech or judgment, or { error: { code, message } }
```

Ollama chat requests use `stream: false`. The judge request also sets `format: "json"`.

### Session and transcript shapes

```ts
type RoundId = "opening" | "rebuttal" | "closing";
type SpeakerSlot = "a" | "b";
type DebateStatus = "in_progress" | "awaiting_judge" | "complete";

type Turn = {
  round: RoundId;
  speaker: SpeakerSlot;
  text: string;
};

type DebateState = {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  status: DebateStatus;
  turns: Turn[];
};
```

`getExpectedTurn` maps transcript length to the next speech:

| Turns so far | Next speech |
| ---: | --- |
| 0 | opening, A |
| 1 | opening, B |
| 2 | rebuttal, A |
| 3 | rebuttal, B |
| 4 | closing, A |
| 5 | closing, B |
| 6 | none; status becomes `awaiting_judge` |

### HTTP contracts

Turn request:

```ts
type TurnRequest = {
  topic: string;
  debaterAId: string;
  debaterBId: string;
  round: RoundId;
  speaker: SpeakerSlot;
  transcript: Turn[];
};
```

The server recomputes the legal next speech from `transcript`. If `round` and `speaker` disagree with that speech, respond `409`.

Turn success body: `{ round, speaker, text }`.

Judge request: `topic`, `debaterAId`, `debaterBId`, and a transcript of exactly six legal turns. Reject any other length or order with `409`.

Model JSON, before the app adds scores:

```ts
type JudgeModelOutput = {
  scores: {
    debaterA: CriterionScores;
    debaterB: CriterionScores;
  };
  verdict: string;
  strongestArgument: { debaterA: string; debaterB: string };
  biggestWeakness: { debaterA: string; debaterB: string };
};

type CriterionScores = {
  reasoning: number;
  rebuttal: number;
  evidence: number;
  clarity: number;
};
```

Each criterion score must be an integer from 1 to 10. The server ignores a model-supplied winner or weighted total if one appears.

Judge success body:

```ts
type Judgment = {
  scores: {
    a: ScoredSide;
    b: ScoredSide;
  };
  winner: "a" | "b" | "tie";
  verdict: string;
  strongest: { a: string; b: string };
  weakness: { a: string; b: string };
  disclaimer: "This verdict is an AI-generated evaluation, not an objective ruling.";
};

type ScoredSide = CriterionScores & {
  weightedUnits: number;
  weightedDisplay: string;
};
```

`debaterA` in the model output maps to slot A, and `debaterB` maps to slot B. Character names are applied by the UI after that mapping.

### Scoring

Weights: reasoning 35, rebuttal 30, evidence 20, clarity 15.

```text
weightedUnits = 35*reasoning + 30*rebuttal + 20*evidence + 15*clarity
weightedDisplay = (weightedUnits / 10).toFixed(2)
```

`weightedUnits` is an integer from 100 to 1000. `weightedDisplay` is the string from `"10.00"` to `"100.00"`. Compare `weightedUnits` to pick the winner. Equal units are a tie. Do not clamp an out-of-range score into 1–10; reject the whole judge output.

The floor is 10.00 because every criterion is at least 1. The UI should label the number as a weighted score, not as a raw mark out of 10.

### Validation limits

- Topic: trim whitespace, then require 8 to 240 characters.
- Character ids: two different ids, both present in the character registry.
- Each stored speech: non-empty after trim, at most 4,000 characters.
- At most six turns.
- Judge prose fields: non-empty after trim, at most 600 characters each.

### Errors

Every failed API response uses:

```ts
type ApiError = {
  error: {
    code:
      | "INVALID_INPUT"
      | "DEBATE_STATE_CONFLICT"
      | "OLLAMA_UNAVAILABLE"
      | "OLLAMA_TIMEOUT"
      | "MODEL_ERROR"
      | "INVALID_MODEL_OUTPUT";
    message: string;
  };
};
```

| Code | HTTP | When |
| --- | ---: | --- |
| `INVALID_INPUT` | 400 | Topic, characters, or body shape is invalid |
| `DEBATE_STATE_CONFLICT` | 409 | Requested speech or judge call does not match the transcript |
| `OLLAMA_UNAVAILABLE` | 502 | Connection to Ollama fails, or the configured model is missing |
| `OLLAMA_TIMEOUT` | 504 | The call exceeds the timeout |
| `MODEL_ERROR` | 502 | Ollama returns a non-OK response or an unexpected payload |
| `INVALID_MODEL_OUTPUT` | 502 | The speech or judge JSON fails validation |

`message` is one short sentence for a person. Do not send stack traces, the Ollama base URL, prompt text, or the raw model body to the browser.

`GET /api/ollama/health` is not an error response. When Ollama is down it still returns HTTP 200 and `{ ok: false, modelReady: false, modelName }`. It does not use the codes above. Turn and judge routes do.

### Generation defaults

| Call | Temperature | `num_predict` | Prompt length target |
| --- | ---: | ---: | --- |
| Opening | 0.8 | 320 | 80–140 words |
| Rebuttal | 0.8 | 320 | 80–140 words |
| Closing | 0.8 | 240 | 60–100 words |
| Judge | 0.3 | 900 | Verdict and notes stay inside the 600-character field cap |

If JSON parsing or schema validation fails for a judge call, the route may generate once more with the same input. If that also fails, return `INVALID_MODEL_OUTPUT`. Do not fill in scores.

### Environment

Server-only. Never prefix these with `NEXT_PUBLIC_`.

| Variable | Default | Rule |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | No trailing path beyond the host origin |
| `OLLAMA_MODEL` | none | Required. `.env.example` shows `llama3.2` as a sample, not a promise that it is installed |
| `OLLAMA_TIMEOUT_MS` | `120000` | Use the default when unset. Clamp any set value to 5,000–300,000 |

Health check: `GET /api/ollama/health` returns `{ ok, modelReady, modelName }`. `ok` means Ollama responded. `modelReady` means `modelName` is installed. The body must not include the base URL. The handler must call Ollama on each request. Do not mark it `force-static` and do not wrap it in `use cache`. `cacheComponents` is already enabled; a cached health result would lie after Ollama stops.

### Proposed folder structure

```text
app/
  layout.tsx
  page.tsx
  globals.css
  api/ollama/health/route.ts
  api/debate/turn/route.ts
  api/debate/judge/route.ts
components/
  ui/
  setup/
  debate/
  results/
lib/
  ollama/
  characters/
  debate/
  judge/
docs/prd/
```

`app/page.tsx` owns the phase switch. Do not add a second page for the debate in the MVP. A navigation would drop in-memory state.

### Local development assumptions

- The Next.js server and Ollama run on the same Ubuntu machine unless `OLLAMA_BASE_URL` says otherwise.
- `127.0.0.1:11434` is the default. If the Next.js process cannot reach Ollama at that address, change the env var. Do not hard-code a second address.
- The player installs a model themselves. The app only checks that the configured name is present.
- `npm run dev` remains the development command.
- Unit tests must pass with no Ollama process. A live model check is opt-in through `OLLAMA_INTEGRATION=1`.

### Deployment note

Deploying the frontend to a public host does not expose Ollama running on a home computer. The MVP is a local app. A later version would need Ollama, or another model server, reachable from the Next.js server process. That work is out of scope. Do not add a tunnel, a reverse proxy, or a hosted-model fallback while implementing these PRDs.

### Architectural decisions

- Client-owned state keeps the server stateless and avoids a session store that would be wrong on a future multi-instance host.
- One model plus different prompts is enough for three personalities and a judge.
- Non-streaming responses are easier to validate. Local models can be slow; the UI must show an active generating state instead of a silent spinner with no status text.
- Automatic advance matches "watch the debate." Pause stops the next request only. Cancel aborts the current request and does not append a speech.
- The judge sees `Debater A` and `Debater B` only. Names and personality text stay out of that prompt so the score is about the arguments.
- Integer `weightedUnits` avoid float comparisons when deciding a tie.

### Risks

- Small local models may ignore JSON format or the assigned side. Validation and a single judge retry cover malformed output. They do not guarantee persuasive speeches. Prompt rules live in PRDs 03 and 05.
- Six sequential generations plus judging can take several minutes. Timeouts must end in an error and a retry, not a stuck loading flag.
- `cacheComponents` can prerender a GET that does not touch runtime data. The health route must perform a real Ollama request.
- `.gitignore` currently ignores `.env*`, including `.env.example`, until an exception is added.

### Roadmap

1. PRD 01 — shell, tokens, test runner.
2. PRD 02 — Ollama gateway.
3. PRD 03 — characters and prompts.
4. PRD 04 — debate state machine.
5. PRD 05 — judge and scoring.
6. PRD 06 — setup and debate UI.
7. PRD 07 — results and replay.
8. PRD 08 — cross-cutting acceptance and developer README.

PRDs 02 and 03 can swap places. Nothing else can.

## 6. Dependencies

None. This document is the parent context. PRDs 01–08 depend on it.

## 7. Error and edge cases

- Ollama down: health reports not ready, and turn or judge routes return `OLLAMA_UNAVAILABLE`. The shell still renders.
- Reload mid-debate: the player lands on setup with empty session state. The MVP does not restore it.
- Both players assigned the same character: `INVALID_INPUT`. The debate does not start.
- Model picks a winner inside JSON: discard that field and use `weightedUnits`.
- Tied `weightedUnits`: `winner` is `"tie"`. Do not break the tie by name, slot, or style.
- Subjective topics are valid. The app does not pick a factually correct side before the debate.

## 8. Testing strategy

This PRD produces no code and no automated test. Later PRDs test their own rules. PRD 08 lists the manual path that proves the journey in section 5.

When implementing later PRDs, reject a change that contradicts an ID in this document. Update this PRD in the same change if the contract itself must change.

## 9. Acceptance criteria

- AC-P-1. `docs/prd/00-product-overview.md` states the MVP journey, the non-goals, the module boundaries, and the local-versus-hosted Ollama distinction.
- AC-P-2. Routes, error codes, transcript order, scoring formula, and the disclaimer sentence match the blocks in section 5.
- AC-P-3. No application source file is created or edited for this PRD.

## 10. Implementation tasks

1. Add this file and `docs/prd/README.md`.
2. Do not add application code, dependencies, or env files in this step.

## 11. Open questions

None. The decisions in section 5 are binding for the MVP.
