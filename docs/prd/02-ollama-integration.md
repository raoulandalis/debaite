# PRD 02 — Ollama Integration and Model Gateway

## 1. Purpose

Put every Ollama call behind one server-only gateway. Debate prompts and judge prompts come later. This PRD proves that the Next.js server can reach Ollama, list installed models, time out cleanly, and reject bad model payloads.

The first implementation of this PRD checked a single `OLLAMA_MODEL`. The contract below replaces that. Update the shipped gateway, health route, status panel, and their tests to match. Do not leave the old `{ modelReady, modelName }` response in place.

## 2. User stories

- O-US-1. As a player, I can see whether Ollama is reachable and which models are installed before a debate exists.
- O-US-2. As a player, I get a clear error if Ollama is stopped or too slow, and the page does not stay on an endless loading state.
- O-US-3. As a developer, I can unit-test the gateway with a fake HTTP layer, and optionally send one real prompt when I opt in.

## 3. Scope

### Included

- `lib/ollama/` client, config loader, and error type.
- `GET /api/ollama/health`.
- A generic `generate` function used later by turn and judge routes. No debate route in this PRD.
- `.env.example` and a `.gitignore` exception so that file can be committed.
- A tiny developer-only status panel on the home shell that calls the health route.
- Mocked unit tests, plus an opt-in live test.

### Excluded

- Character prompts, debate turns, judge scoring, and `/api/debate/*`.
- Streaming the judge. `generate` stays non-streaming. `generateStream` is for debate turns.
- The setup controls that assign a debater model. PRD 06 owns those controls and shows only the roster in PRD 00. This PRD still lists every installed model so setup can tell which roster tags are present.
- Downloading or pulling a model from this app. The player pulls models in Ollama.
- Hosted model APIs.
- Exposing a browser route that accepts an arbitrary prompt. The health route is the only new HTTP route. `generate` is a server function, not a public "complete this prompt" API.

## 4. Requirements

- O-1. Add the `server-only` package and import it from the Ollama client module so client components cannot import it.
- O-2. Read configuration only on the server:

  | Variable | Behavior |
  | --- | --- |
  | `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` when unset. Reject a value that is not an `http` or `https` URL. Strip one trailing slash. |
  | `OLLAMA_MODEL` | Optional. `generate` uses it only when the caller omits `model`. Empty or missing then returns `OLLAMA_UNAVAILABLE`. Health does not read it. The live test may set it. |
  | `OLLAMA_TIMEOUT_MS` | Default `120000` when unset or not a number. Clamp to the inclusive range 5,000–300,000. |

- O-3. `.env.example` lists those three variables, with comments that the app does not install models and that `OLLAMA_MODEL` is only a sample for the live test. It must not contain secrets.
- O-4. Change `.gitignore` so `.env*` stays ignored and `!.env.example` is committed. Do not commit a real `.env`.
- O-5. `generate` sends `POST {baseUrl}/api/chat` with `stream: false`, a `model`, a `messages` array, `options.temperature`, and `options.num_predict`. An optional `json: true` argument sets Ollama's `format` to `"json"`. `generateStream` sends that same body with `stream: true` and yields each `message.content` delta. Debate turns use `generateStream`. The judge keeps `generate`.
- O-6. `messages` entries are `{ role: "system" | "user", content: string }` only. The gateway does not accept tool calls or assistant-authored control messages from the browser.
- O-7. The gateway aborts the fetch with `AbortSignal.timeout` or an equivalent `AbortController` at `OLLAMA_TIMEOUT_MS`. A timeout becomes `OLLAMA_TIMEOUT`.
- O-8. Connection refusal, DNS failure, or a network error becomes `OLLAMA_UNAVAILABLE`.
- O-9. An HTTP response that is not OK, or a body that is not the expected chat JSON, becomes `MODEL_ERROR`.
- O-10. A successful chat body must include a string message content. Trim it. Empty content becomes `INVALID_MODEL_OUTPUT`. Return `{ text: string }` and nothing else from the model body.
- O-11. `GET /api/ollama/health` calls Ollama `GET {baseUrl}/api/tags` on every request. It returns:

  ```ts
  type InstalledModel = {
    name: string;
    parameterBillions: number | null;
  };

  type HealthResponse = {
    ok: boolean;
    models: InstalledModel[];
  };
  ```

  `ok` is true when `/api/tags` returns a tag list. `models` contains one entry per tag with a string `name`. `parameterBillions` follows the parse rule in PRD 00. Skip a tag that has no string `name`. Do not drop the rest of the list when one tag has no parameter size. Never return `OLLAMA_BASE_URL`. Do not filter the list by `OLLAMA_MODEL`.
- O-12. The health handler is not statically cached. Do not export `dynamic = "force-static"` and do not use `use cache`. The `/api/tags` fetch must run at request time. Read the Next.js route-handler and caching docs before adding the file, because `cacheComponents` is already on.
- O-13. Health failures still return HTTP 200 with `ok: false` and `models: []`, so the shell can render a status banner. Generation failures use the HTTP codes in PRD 00. This PRD's unit tests cover the gateway error object; they do not need a debate route to assert those HTTP codes.
- O-14. Map gateway failures to the codes in PRD 00: `OLLAMA_UNAVAILABLE`, `OLLAMA_TIMEOUT`, `MODEL_ERROR`, `INVALID_MODEL_OUTPUT`. Do not add new codes.
- O-15. The home shell fetches `/api/ollama/health` from the browser and shows one of these states: checking, `{count} models installed`, no models installed, or Ollama unreachable. The unreachable state tells the player to start Ollama. The empty state tells the player to pull models in Ollama. They do not show the base URL or `.env` values. The panel does not choose debate models.
- O-16. The status request has its own failure path. If the health fetch throws or returns non-JSON, show the unreachable state. Do not leave the label stuck on "checking".
- O-17. `npm test` covers the gateway with a mocked `fetch`. No test in the default run contacts a real Ollama.
- O-18. Add `npm run test:ollama`. It runs only the live test file and exits with a clear skip or failure message unless `OLLAMA_INTEGRATION=1`. When that variable is `1`, the test calls `generate` with a tiny user message and `model` set to `OLLAMA_MODEL`, and asserts a non-empty string. Document the command in a comment at the top of that test file. PRD 08 copies the command into the README.

## 5. Technical approach

Suggested files:

```text
lib/ollama/config.ts
lib/ollama/errors.ts
lib/ollama/client.ts
app/api/ollama/health/route.ts
components/setup/model-status.tsx
.env.example
tests/ollama/config.test.ts
tests/ollama/client.test.ts
tests/ollama/live.test.ts
```

`client.ts` starts with `import "server-only"`. Route handlers import `checkHealth` and, later, `generate`. The status component calls only `/api/ollama/health`.

`generate` signature, used unchanged by PRDs 05 and 06:

```ts
type GenerateInput = {
  messages: { role: "system" | "user"; content: string }[];
  temperature: number;
  numPredict: number;
  json?: boolean;
  model?: string;
};

type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; code: GatewayErrorCode; message: string };
```

When `model` is omitted, use `OLLAMA_MODEL`. PRDs 05 and 06 pass an explicit model and must not rely on this fallback. PRD 03 does not call `generate`.

Parse `/api/chat` defensively. A typical success body has `message.content`. Ignore extra fields. Do not eval the content or treat it as application instructions.

Parse `details.parameter_size` with the PRD 00 rule. `3.2B` is `3.2`, `7B` is `7`, and `8.0B` is `8`. A missing `details` object leaves `parameterBillions` null and still includes the model.

The status panel is part of the existing home page from PRD 01. Keep the DebAIte heading. The panel is informational. It does not block the rest of the shell, because the debate flow does not exist yet.

`.env.example` shape:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=120000
```

Comments above those lines should say: copy to `.env.local`, pull models in Ollama yourself, `OLLAMA_MODEL` is only for the live test, and do not prefix these names with `NEXT_PUBLIC_`.

## 6. Dependencies

- PRD 00 for error codes, env rules, and the health JSON shape.
- PRD 01 for the shell, the test runner, and UI primitives used by the status panel.
- Does not depend on PRDs 03–08.
- Add the `server-only` package. Zod is optional here. Use it if it keeps the chat-body parse obvious; otherwise a small hand-written check is acceptable in this module only. PRD 05 requires Zod for judge JSON. Installing Zod in this PRD is fine so later PRDs can import it.

## 7. Error and edge cases

| Situation | Gateway or health behavior |
| --- | --- |
| Ollama process not running | Health `ok: false`. `generate` returns `OLLAMA_UNAVAILABLE`. |
| Ollama up, no models pulled | Health `ok: true` and `models: []`. |
| `generate` called with a model name | That name is sent as Ollama's `model`. A missing install is Ollama's error and becomes `MODEL_ERROR` or `OLLAMA_UNAVAILABLE` from the chat response. This PRD does not check the catalog inside `generate`. |
| `generate` called without `model`, and `OLLAMA_MODEL` unset | `OLLAMA_UNAVAILABLE`. |
| Request exceeds the timeout | `OLLAMA_TIMEOUT`. Fetch is aborted. |
| Ollama HTTP 500 | `MODEL_ERROR`. |
| Chat content is empty or whitespace | `INVALID_MODEL_OUTPUT`. |
| Health route itself throws | The client panel leaves "checking" and shows unreachable. |
| `OLLAMA_TIMEOUT_MS=1` | Clamp to 5000. |
| `OLLAMA_TIMEOUT_MS=999999` | Clamp to 300000. |
| Base URL `file:///tmp` or a non-URL | Treat configuration as unavailable. Do not request that URL. |

Do not log the full prompt at info level. A server log may include the error code and the HTTP status from Ollama.

## 8. Testing strategy

Default `npm test`:

- Config defaults, clamp, and invalid base URL.
- `generate` success extracts `message.content`.
- Timeout, connection failure, non-OK HTTP, and empty content map to the codes in O-14.
- Health maps a tag list to names and parameter sizes, including a tag with no `parameter_size`.
- Health builder does not put a base URL in the response object. Test the pure mapper if the route handler is thin.

Live test, not part of `npm test`:

```text
OLLAMA_INTEGRATION=1 npm run test:ollama
```

That command may fail when Ollama is down or `OLLAMA_MODEL` is unset. The failure message must say that Ollama and `OLLAMA_MODEL` are required for the live test. `npm test` must still pass in that situation.

Mock `fetch`. Do not mock by starting a real server.

## 9. Acceptance criteria

- AC-O-1. With a valid local Ollama and at least one pulled model, `/api/ollama/health` returns `ok: true` and a `models` array that includes that model's `name`, and the JSON has no URL.
- AC-O-2. With Ollama stopped, the same route returns `ok: false` without hanging, and the home page leaves the checking state.
- AC-O-3. `generate` is only imported from server code. The client status component does not import `lib/ollama/client.ts`.
- AC-O-4. `.env.example` is not ignored by git. A local `.env` or `.env.local` still is.
- AC-O-5. `npm test` passes with the network blocked or with Ollama stopped.
- AC-O-6. No `/api/debate` route exists yet.

## 10. Implementation tasks

1. Read the Next.js route-handler and environment-variable docs in `node_modules/next/dist/docs/`.
2. Add `.gitignore` exception `!.env.example` and create `.env.example`.
3. Implement config, errors, and `generate` with timeout handling.
4. Update the health route and the shell status panel to the catalog in O-11. Remove `modelReady` and `modelName` from the response and the panel.
5. Add mocked unit tests.
6. Add the opt-in live test script.
7. Run `npm test`, `npm run lint`, and `npm run build`.
8. If Ollama is running, call the health route once and record the result. If it is not running, confirm the unreachable state instead. Do not block the PRD on a model pull.

## 11. Open questions

None. Setup offers only the PRD 00 roster. This gateway still lists every installed model and sends the model name it is given.
