# PRD 02 — Ollama Integration and Model Gateway

## 1. Purpose

Put every Ollama call behind one server-only gateway. Debate prompts and judge prompts come later. This PRD only proves that the Next.js server can reach Ollama, time out cleanly, and reject bad model payloads.

## 2. User stories

- O-US-1. As a player, I can see whether the local model is ready before a debate exists.
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
- Streaming.
- Choosing among multiple models. Callers may pass a model name; the only caller in this PRD uses `OLLAMA_MODEL`.
- Downloading or pulling a model.
- Exposing a browser route that accepts an arbitrary prompt. The health route is the only new HTTP route. `generate` is a server function, not a public "complete this prompt" API.

## 4. Requirements

- O-1. Add the `server-only` package and import it from the Ollama client module so client components cannot import it.
- O-2. Read configuration only on the server:

  | Variable | Behavior |
  | --- | --- |
  | `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` when unset. Reject a value that is not an `http` or `https` URL. Strip one trailing slash. |
  | `OLLAMA_MODEL` | Required for generation and for `modelReady`. Empty or missing means `modelReady: false` and generation returns `OLLAMA_UNAVAILABLE`. |
  | `OLLAMA_TIMEOUT_MS` | Default `120000` when unset or not a number. Clamp to the inclusive range 5,000–300,000. |

- O-3. `.env.example` lists those three variables, with comments that the model is not installed by the app and that the sample name is `llama3.2`. It must not contain secrets.
- O-4. Change `.gitignore` so `.env*` stays ignored and `!.env.example` is committed. Do not commit a real `.env`.
- O-5. `generate` sends `POST {baseUrl}/api/chat` with `stream: false`, a `model`, a `messages` array, `options.temperature`, and `options.num_predict`. An optional `json: true` argument sets Ollama's `format` to `"json"`.
- O-6. `messages` entries are `{ role: "system" | "user", content: string }` only. The gateway does not accept tool calls or assistant-authored control messages from the browser.
- O-7. The gateway aborts the fetch with `AbortSignal.timeout` or an equivalent `AbortController` at `OLLAMA_TIMEOUT_MS`. A timeout becomes `OLLAMA_TIMEOUT`.
- O-8. Connection refusal, DNS failure, or a network error becomes `OLLAMA_UNAVAILABLE`.
- O-9. An HTTP response that is not OK, or a body that is not the expected chat JSON, becomes `MODEL_ERROR`.
- O-10. A successful chat body must include a string message content. Trim it. Empty content becomes `INVALID_MODEL_OUTPUT`. Return `{ text: string }` and nothing else from the model body.
- O-11. `GET /api/ollama/health` calls Ollama `GET {baseUrl}/api/tags` on every request. It returns:

  ```ts
  type HealthResponse = {
    ok: boolean;
    modelReady: boolean;
    modelName: string | null;
  };
  ```

  `ok` is true when `/api/tags` returns a tag list. `modelReady` is true when some tag name equals `OLLAMA_MODEL` or starts with `OLLAMA_MODEL + ":"`. `modelName` is the configured name, or `null` when it is unset. Never return `OLLAMA_BASE_URL`.
- O-12. The health handler is not statically cached. Do not export `dynamic = "force-static"` and do not use `use cache`. The `/api/tags` fetch must run at request time. Read the Next.js route-handler and caching docs before adding the file, because `cacheComponents` is already on.
- O-13. Health failures still return HTTP 200 with `ok: false` and `modelReady: false`, so the shell can render a status banner. Generation failures use the HTTP codes in PRD 00. This PRD's unit tests cover the gateway error object; they do not need a debate route to assert those HTTP codes.
- O-14. Map gateway failures to the codes in PRD 00: `OLLAMA_UNAVAILABLE`, `OLLAMA_TIMEOUT`, `MODEL_ERROR`, `INVALID_MODEL_OUTPUT`. Do not add new codes.
- O-15. The home shell fetches `/api/ollama/health` from the browser and shows one of these states: checking, ready, model missing, Ollama unreachable. The unreachable and missing states tell the player to start Ollama and check `.env.example`. They do not show the base URL.
- O-16. The status request has its own failure path. If the health fetch throws or returns non-JSON, show the unreachable state. Do not leave the label stuck on "checking".
- O-17. `npm test` covers the gateway with a mocked `fetch`. No test in the default run contacts a real Ollama.
- O-18. Add `npm run test:ollama`. It runs only the live test file and exits with a clear skip or failure message unless `OLLAMA_INTEGRATION=1`. When that variable is `1`, the test calls `generate` with a tiny user message and asserts a non-empty string. Document the command in a comment at the top of that test file. PRD 08 copies the command into the README.

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

When `model` is omitted, use `OLLAMA_MODEL`. PRDs 03–07 omit it.

Parse `/api/chat` defensively. A typical success body has `message.content`. Ignore extra fields. Do not eval the content or treat it as application instructions.

Tag matching examples: configured `llama3.2` matches tag `llama3.2` or `llama3.2:latest`. It does not match `llama3.2-vision` unless that whole string is the configured name.

The status panel is part of the existing home page from PRD 01. Keep the DebAIte heading. The panel is informational. It does not block the rest of the shell, because the debate flow does not exist yet.

`.env.example` shape:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=120000
```

Comments above those lines should say: copy to `.env.local`, install the model in Ollama yourself, and do not prefix these names with `NEXT_PUBLIC_`.

## 6. Dependencies

- PRD 00 for error codes, env rules, and the health JSON shape.
- PRD 01 for the shell, the test runner, and UI primitives used by the status panel.
- Does not depend on PRDs 03–08.
- Add the `server-only` package. Zod is optional here. Use it if it keeps the chat-body parse obvious; otherwise a small hand-written check is acceptable in this module only. PRD 05 requires Zod for judge JSON. Installing Zod in this PRD is fine so later PRDs can import it.

## 7. Error and edge cases

| Situation | Gateway or health behavior |
| --- | --- |
| Ollama process not running | Health `ok: false`. `generate` returns `OLLAMA_UNAVAILABLE`. |
| Ollama up, model not pulled | Health `ok: true`, `modelReady: false`. `generate` returns `OLLAMA_UNAVAILABLE` with a message that the configured model is missing. |
| `OLLAMA_MODEL` unset | `modelName: null`, `modelReady: false`. |
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
- Health tag matching for exact name, `:latest`, and a different model.
- Health builder does not put a base URL in the response object. Test the pure mapper if the route handler is thin.

Live test, not part of `npm test`:

```text
OLLAMA_INTEGRATION=1 npm run test:ollama
```

That command may fail when Ollama is down. The failure message must say that Ollama and `OLLAMA_MODEL` are required. `npm test` must still pass in that situation.

Mock `fetch`. Do not mock by starting a real server.

## 9. Acceptance criteria

- AC-O-1. With a valid local Ollama and model, `/api/ollama/health` returns `ok: true`, `modelReady: true`, and the configured `modelName`, and the JSON has no URL.
- AC-O-2. With Ollama stopped, the same route returns `ok: false` without hanging, and the home page leaves the checking state.
- AC-O-3. `generate` is only imported from server code. The client status component does not import `lib/ollama/client.ts`.
- AC-O-4. `.env.example` is not ignored by git. A local `.env` or `.env.local` still is.
- AC-O-5. `npm test` passes with the network blocked or with Ollama stopped.
- AC-O-6. No `/api/debate` route exists yet.

## 10. Implementation tasks

1. Read the Next.js route-handler and environment-variable docs in `node_modules/next/dist/docs/`.
2. Add `.gitignore` exception `!.env.example` and create `.env.example`.
3. Implement config, errors, and `generate` with timeout handling.
4. Add the health route and the shell status panel.
5. Add mocked unit tests.
6. Add the opt-in live test script.
7. Run `npm test`, `npm run lint`, and `npm run build`.
8. If Ollama is running, call the health route once and record the result. If it is not running, confirm the unreachable state instead. Do not block the PRD on a model pull.

## 11. Open questions

None. Model choice stays in `OLLAMA_MODEL`.
