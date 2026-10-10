# PRD 08 — Reliability, Testing, and MVP Acceptance

## 1. Purpose

Define what "done" means for the MVP after PRDs 01–07 exist. This PRD closes gaps that sit between those features: the developer README, the shared failure behavior, and one checklist. It does not add a new game mode.

## 2. User stories

- A-US-1. As a player, I always get either a valid result or a recoverable error, never a spinner that cannot be dismissed.
- A-US-2. As a player, I can tell the verdict is a game evaluation.
- A-US-3. As a developer, I can run the core tests without Ollama and follow the README to try a live debate.

## 3. Scope

### Included

- A pass over the existing error, validation, loading, and test behavior.
- `README.md` written for DebAIte, replacing the create-next-app text.
- The manual happy path and the edge-case list below.
- Accessibility and performance checks limited to this app.
- Fixes for contradictions found while running that list, when the fix belongs in an earlier PRD's modules.

### Excluded

- Playwright, a CI provider, a database, accounts, streaming, and deployment automation.
- New screens or a new scoring rule.
- Copying every earlier unit test into this document. The checklist points at the suites instead.

## 4. Requirements

- A-1. `npm test` passes with no Ollama process running. It includes the suites from PRDs 01–07: shell, Ollama gateway mocks, character prompts, debate engine, judge math and judge route, playback, turn route, setup, debate screen, and results.
- A-2. `npm run lint` and `npm run build` pass.
- A-3. `npm run test:ollama` is documented and stays out of `npm test`. It runs only when `OLLAMA_INTEGRATION=1`.
- A-4. Every debate and judge error response uses the codes and HTTP statuses in PRD 00. The health route remains the exception from PRD 02: HTTP 200 with `ok: false` when Ollama is down.
- A-5. Topic limits, character ids, transcript order, speech length, and judge field limits are enforced on the server even if the UI already checked them. Confirm this with the existing route tests, and add a missing case only where a limit has no test yet.
- A-6. Model text is stored or displayed as content. It is not evaluated, not interpolated into a route path, and not written into `next.config.ts` or another code file.
- A-7. No client component imports `lib/ollama/client.ts`. No `NEXT_PUBLIC_OLLAMA` variable exists.
- A-8. A turn or judge request that is aborted or that fails clears its pending flag and shows a retry control. There is no path that leaves the status line on `checking`, `is making the`, or `is scoring` after the promise settles.
- A-9. The in-flight rule from PRD 06 still holds after judging is added: one outbound debate request at a time, and a late response that does not match the pending request is ignored.
- A-10. Results render only from a judgment that passed the PRD 07 recompute check. Searching the results component for a hard-coded winning score should find nothing.
- A-11. Replace `README.md` with DebAIte instructions that cover:
  - What the app is, in a few sentences, including that the verdict is an AI evaluation.
  - `npm install`, `npm run dev`, and `http://localhost:3000`.
  - Copy `.env.example` to `.env.local`, then install the chosen model in Ollama yourself. Mention `ollama pull llama3.2` only as an example matching `.env.example`.
  - Ollama must be reachable from the Next.js server at `OLLAMA_BASE_URL`. The default is `http://127.0.0.1:11434`. If the Next.js process runs somewhere that cannot see that host, change the variable. Do not document a tunnel or a public deploy.
  - State that publishing the frontend does not publish a home Ollama server.
  - `npm test`, `npm run lint`, `npm run build`, and `OLLAMA_INTEGRATION=1 npm run test:ollama`.
  - Reload discards the current debate.
- A-12. The README does not tell the player the judge is unbiased or factually authoritative.
- A-13. Perform the manual checks in section 8 before calling the MVP done. Record failures as fixes in the relevant module, then rerun the check.
- A-14. Do not add a dependency unless one of the checks cannot be met with the existing stack. Prefer a test or a small validation fix.

## 5. Technical approach

This PRD is mostly verification and the README. Expected code edits are limited to:

- `README.md`
- A missing test named by A-5
- A bug found during section 8, fixed in the module that owns it

No new `lib/` subsystem.

### Failure behavior to confirm, not reinvent

| Situation | Required outcome |
| --- | --- |
| Ollama stopped before start | Setup still renders. Status says Ollama is unreachable. Model lists are empty, so Start stays disabled. |
| No models installed | Health returns `ok: true` and `models: []`. Start stays disabled. |
| A turn names a model that is not installed | Generation returns `OLLAMA_UNAVAILABLE`. |
| Timeout | Request ends. Retry remains. The same speech or the same judging step is what retries. |
| Invalid judge JSON twice | No scores. Transcript remains. `Retry judging` is shown. |
| Bad topic sent directly to an API | `400 INVALID_INPUT`. |
| Out-of-order turn sent directly to the API | `409` and no model call. |
| Cancel | No new speech and no verdict from that request. |

### Test layers

| Layer | Command | Needs Ollama |
| --- | --- | --- |
| Unit and component | `npm test` | No |
| Production build | `npm run build` | No |
| Live smoke | `OLLAMA_INTEGRATION=1 npm run test:ollama` | Yes |
| Full debate | Manual section 8 | Yes |

Do not add Playwright in this MVP. The manual script is the end-to-end check.

## 6. Dependencies

PRDs 00 through 07. If a module from an earlier PRD is missing, stop and implement that PRD first. Do not fold its feature work into this checklist.

## 7. Error and edge cases

The manual list must include:

- Topic of 7 characters after trim cannot start. Topic of 8 can.
- The same character cannot occupy both slots.
- Two speaker models outside the size band cannot start. The judge model cannot be either speaker's model.
- Cancel during speech 1 leaves the debate on speech 1.
- Pause after a speech waits. Resume continues with the next speaker, not a repeated speech.
- A forced bad judge response, or Ollama stopped after speech 6, does not show a winner.
- Play again clears speeches and keeps both characters and their models.
- New debate keeps the topic text in the form.
- Reload during a debate returns to an empty setup.

Use the browser network panel or a temporary model outage for the failure rows. Do not ship a debug button that fabricates scores.

## 8. Testing strategy

### Automated

Run:

```text
npm test
npm run lint
npm run build
```

All three must pass. Then, with Ollama running and `OLLAMA_MODEL` installed for the live test:

```text
OLLAMA_INTEGRATION=1 npm run test:ollama
```

### Manual happy path

1. Start Ollama and confirm `/api/ollama/health` lists installed models in the UI, without showing a URL. Pull two models in the same size band and a third model for the judge if they are not already installed.
2. Open `/` at a desktop width. Enter `Should AI replace human teachers?`
3. Choose two different characters. Assign each a model in the same size band. Choose a judge model that is neither of those. Confirm slot A says For and slot B says Against.
4. Start. Confirm speeches appear in order, each with a name, a model name, and a side, and that the status names the active speaker.
5. Wait through three rounds and judging.
6. Confirm the results heading, both speaker model names, the judge model, both weighted scores, four criteria, verdict, strongest argument, weakness, transcript, and the sentence `This verdict is an AI-generated evaluation, not an objective ruling.`
7. Play again. Confirm the first speech starts over and the old verdict is gone.
8. After the new debate ends, or by using New debate from results, confirm setup still shows the topic, characters, and model choices.

### Accessibility

- Tab from the skip link through setup and start a debate using the keyboard only.
- Focus is visible on the topic field, character buttons, and results buttons.
- The generating status is announced in the live region. Check this in the browser accessibility tree or a screen reader if one is installed. If no screen reader is installed, verify the element has `aria-live="polite"` and the status text changes there.
- The winner is text, not a color change by itself.
- With `prefers-reduced-motion: reduce`, a new speech appears without a fade.

### Layout

- At about 390px wide, setup, the debate, and results do not scroll horizontally. The active speaker and `Last argument` are both readable during a debate.
- At 1280px, the two debate columns are side by side.

### Performance

- A local model may spend many seconds on one speech. That is acceptable. The status line must name the speaker or the judge during the wait.
- The default timeout remains 120 seconds unless `.env.local` overrides it inside the clamp.
- Do not prefetch a debate or call Ollama during `npm run build`.
- The health request on page load is a single call, not a polling loop. The player can reload to check again. Do not add an interval in this PRD.

## 9. Acceptance criteria

The MVP is accepted when every row below is true.

- AC-A-1. `npm test`, `npm run lint`, and `npm run build` pass with Ollama stopped.
- AC-A-2. The live Ollama test passes when `OLLAMA_INTEGRATION=1` and `OLLAMA_MODEL` is installed.
- AC-A-3. The manual happy path in section 8 was completed in a browser, including Play again and New debate.
- AC-A-4. Cancel, pause and resume, a down-Ollama turn, and a failed or unavailable judge were each tried once. None left an endless loading state or a fake score.
- AC-A-5. Keyboard setup, visible focus, the live region, the 390px layout, and the desktop two-column debate were checked.
- AC-A-6. `README.md` matches A-11 and A-12.
- AC-A-7. The browser bundle does not contain `OLLAMA_BASE_URL`. Confirm by inspecting the client status component and the env prefix rule, not by adding a new scanner dependency.
- AC-A-8. No database, auth, payment, or hosted-model dependency was added.

## 10. Implementation tasks

1. Read PRDs 00–07 and list any contract mismatch before changing code. Fix the docs and the code together if a mismatch is real.
2. Run `npm test`, `npm run lint`, and `npm run build`. Fix failures in the owning module.
3. Add only the missing server-side validation tests required by A-5.
4. Replace `README.md`.
5. Run the manual happy path, the edge cases in section 7, and the accessibility and layout checks.
6. Run the opt-in Ollama test when a model is available.
7. Stop. Do not start a follow-up feature.

## 11. Open questions

None. If a manual check fails because the local model is weak at JSON or at staying on its side, fix validation and prompts only when they violate an earlier PRD. Do not raise the product scope to hide a weak model.
