# PRD 06 — Debate Setup and Gameplay Interface

## 1. Purpose

Let a player pick a topic, two characters, a model for each character, and a different judge model, then watch the six speeches appear on a debate screen. Each speech uses that speaker's model. This PRD stops when the transcript is ready for the judge. It does not show scores.

## 2. User stories

- U-US-1. As a player, I can start a debate only when the topic, the two characters, and the three model choices are valid.
- U-US-2. As a player, I can see who is speaking, which round it is, and what the other side already said.
- U-US-3. As a player, I can pause, cancel, or retry without the debate advancing twice or freezing on a spinner.
- U-US-4. As a player using a phone or a keyboard, I can complete setup and follow the debate.

## 3. Scope

### Included

- Setup phase on `/`: topic, two slots, character cards, a model choice for each slot, a judge model, and start.
- `POST /api/debate/turn`.
- A debate screen for openings, rebuttals, and closings.
- Automatic advance, pause, cancel, and retry.
- A pure playback reducer tested without Ollama.
- Loading, error, and "ready for the judge" states.

### Excluded

- Calling `/api/debate/judge`, rendering scores, or moving to a results phase. PRD 07 does that.
- Accounts, history, and streaming.
- A character editor.
- New pages. Setup and debate are phases on `app/page.tsx`.

## 4. Requirements

- U-1. The setup phase keeps the DebAIte `h1` and the model-status panel from PRD 02.
- U-2. The topic control is a labeled textarea, label text `Debate topic`. Helper text: `Yes/no and "Should" questions work well. The topic does not need one correct answer.`
- U-3. Show two slots, `Debater A · For` and `Debater B · Against`. Each slot lists Rex, Athena, and Jester using `name`, `title`, and `summary` from the registry. Do not show `systemPrompt`.
- U-3a. Each slot has a model control labeled `Model`, with accessible name `Model for Debater A` or `Model for Debater B`. Options come from the health `models` list and include only entries whose `parameterBillions` is a positive number. Each option's visible text is the tag name and the size, such as `llama3.2:latest (3.2B)`. A separate control labeled `Judge model` lists every installed model except the two selected speaker models, including a model whose size is null. Its helper text is `The judge must be a different model from both debaters.`
- U-4. A character chosen in one slot is disabled in the other. The disabled control's accessible name includes `Already chosen`. The selected card shows the word `Selected` as text. A model chosen for one speaker is disabled for the other speaker, with the same accessible-name rule.
- U-5. The Start control is a button labeled `Start debate`. It is disabled until `validateTopic` succeeds, the two character ids are non-null and different, the two speaker models are different and `sameSizeBand` is true, and the judge model is non-null and different from both speaker models. Near the button, helper text reads `Enter a topic of at least 8 characters, choose two different characters, choose two models of similar size, and choose a different judge model.` while the button is disabled, and is removed or replaced when it becomes enabled.
- U-6. A failed health check leaves the model lists empty, so Start stays disabled. The warning from PRD 02 stays visible. Do not offer a way to type a model name that is not in the catalog.
- U-7. Starting calls `createDebate`, sets the phase to `debate`, sets playback to `running`, and requests opening A. It does not navigate to another URL.
- U-8. Add `POST /api/debate/turn`. The body is `TurnRequest` from PRD 00. Validate it with Zod, then `restoreDebate`. If restore fails, return `400` or `409` using the engine's code. If the requested `round` and `speaker` are not `getExpectedTurn`, return `409 DEBATE_STATE_CONFLICT` and do not call Ollama.
- U-9. The turn route loads the speaker with `getCharacter`, sets side to affirmative for `a` and negative for `b`, builds messages with `buildTurnMessages`, and calls `generate` with that speaker's model, temperature `0.8`, and `numPredict` 320 for opening and rebuttal or 240 for closing. Before `generate`, apply the model rules in PRD 00. A size-band failure is `400 INVALID_INPUT`. A model missing from the catalog is `502 OLLAMA_UNAVAILABLE`. Do not put the model name in the prompt.
- U-10. The route trims model text and rejects empty text or text longer than 4,000 characters with `INVALID_MODEL_OUTPUT`. Success returns `{ round, speaker, text }` using the requested round and speaker, and the trimmed text. The server does not store the turn.
- U-11. The debate screen shows the three rounds as text: `Opening`, `Rebuttal`, and `Closing`. The active round also has the word `Current`. Completed rounds stay visible.
- U-12. Every stored speech shows the character name, that speaker's model name, `For` or `Against`, the round name, and the speech text. Color may accent the card. The name, model, and side are still present if color is removed.
- U-13. At a viewport of 1024px or wider, slot A is in a left column and slot B is in a right column. Below 1024px, the columns stack. The active speaker's card comes first. Above that card, show the opponent's latest speech under the heading `Last argument`, or `No argument yet.` before the opponent has spoken.
- U-14. While a speech is generating, show `{Name} is making the {round} argument.` and disable Start. Existing speeches remain on screen. The UI does not go blank.
- U-15. A polite live region announces the same generating sentence when a request starts, and announces `Something went wrong. You can retry this turn.` when a turn fails. Do not announce every keystroke.
- U-16. Turn failures show the API `message` and a `Retry turn` button. Retry requests the same `getExpectedTurn` and does not clear speeches already stored. The expected turn does not change, because `appendTurn` was not called.
- U-17. `Pause` sets playback to `paused`. It does not abort the current fetch. When that fetch succeeds, append the speech if it is still the expected one, then do not start another request.
- U-18. `Cancel turn` aborts the current fetch, does not append, sets playback to `paused`, and leaves the same expected turn. `Resume` sets playback to `running` and requests the expected turn when no request is in flight.
- U-19. Only one turn request may be in flight. A second start, retry, or resume while `pending` is set does nothing. When a response arrives, ignore it unless its `round` and `speaker` match the `pending` request and match `getExpectedTurn` at that moment. Then call `appendTurn`.
- U-20. After the sixth speech, status is `awaiting_judge`, `pending` is cleared, and the screen shows `The debate is ready for the judge.` Do not call the judge route and do not display scores or a winner in this PRD. PRD 07 replaces only that end branch: while playback is `running`, the sixth success starts judging instead of stopping. Until PRD 07, stopping is the correct behavior.
- U-21. Reloading `/` returns to setup with an empty topic, no selected characters, and no selected models. Do not write the session to `localStorage` or `sessionStorage`. The model choice is fixed once the debate starts. Playback does not offer a control to change it.
- U-22. At 390px width, the topic field and both slots fit without horizontal scrolling. At 1280px, the debate uses the two columns from U-13 inside the 1120px shell from PRD 01.
- U-23. Setup and playback can be completed with a keyboard: focus styles from PRD 01 remain, cards and buttons are real buttons, and the textarea has its label.
- U-24. New speech appearance may fade in. Under `prefers-reduced-motion: reduce`, show the speech immediately with no fade.

## 5. Technical approach

Files:

```text
lib/debate/playback.ts
lib/debate/turn-client.ts
app/api/debate/turn/route.ts
components/setup/setup-form.tsx
components/debate/debate-screen.tsx
components/debate/speech-card.tsx
tests/debate/playback.test.ts
tests/debate/turn-route.test.ts
tests/debate/setup.test.tsx
tests/debate/debate-screen.test.tsx
```

`app/page.tsx` becomes a thin server page that renders one client `Game` component. The client component holds the session.

### Playback state

```ts
type GameSession = {
  phase: "setup" | "debate" | "results";
  topicDraft: string;
  debaterAId: string | null;
  debaterBId: string | null;
  debaterAModel: string | null;
  debaterBModel: string | null;
  judgeModel: string | null;
  debate: DebateState | null;
  judgment: null;
  playback: "running" | "paused";
  pending: null | { kind: "turn"; round: RoundId; speaker: SpeakerSlot };
  error: null | { code: string; message: string };
};
```

This PRD never sets `phase` to `"results"` and never sets `judgment` to anything but `null`. Use `kind: "turn"` on every pending speech so PRD 07 can add `{ kind: "judge" }` without renaming `pending`. PRD 07 also widens `judgment` from `null` to `Judgment | null`.

Events for the reducer:

| Event | Effect |
| --- | --- |
| `edit_setup` | Updates the draft topic, a character slot, or a model choice while `phase` is `setup`. Ignored during `debate`. |
| `start` | `createDebate`. On success, phase `debate`, playback `running`, `pending` is `{ kind: "turn", round: "opening", speaker: "a" }`. On failure, stay on setup and set `error`. |
| `turn_succeeded` | If `pending` is `{ kind: "turn" }` for that speech and `appendTurn` succeeds, store the next state and clear `error`. If playback is `running` and another turn is expected, set `pending` to `{ kind: "turn", round, speaker }` for it. If the debate is `awaiting_judge`, clear `pending`. If `pending` does not match, ignore the payload. PRD 07 changes the `awaiting_judge` branch so a running playback sets `{ kind: "judge" }`. |
| `turn_failed` | Clear `pending`, set `error`, set playback to `paused`. |
| `pause` | Set playback to `paused`. Leave `pending` as it is. |
| `cancel` | Clear `pending`, set playback to `paused`. |
| `resume` or `retry` | If `pending` is null and a turn is expected, set playback to `running`, clear `error`, and set `pending` to `{ kind: "turn", round, speaker }` for that turn. |

The fetch effect starts a request only when `pending` changes to a speech. Cancel passes an `AbortSignal`. An abort dispatches `cancel` only from the button, not a second time from the abort error if `pending` is already null.

### Debate screen layout

```text
Wordmark
Round tracker: Opening | Rebuttal | Closing
Status line: generating, paused, error, or ready for the judge
Desktop: column A | column B
Narrow: Last argument, then active speech, then the rest of the transcript
Controls: Pause or Resume, Cancel turn while pending, Retry turn while error
```

Use the accent tokens `--rex`, `--athena`, and `--jester` on the speaker's card border. The monogram is the avatar: the character's letter inside a circle. Do not fetch images.

`Last argument` shows the most recent turn whose speaker is not the pending or expected speaker. Before speaker B has talked, A's opening has no last argument yet while A is generating, so the strip says `No argument yet.`

### Turn route

Read the Next.js route-handler docs first. Do not cache the POST.

Map gateway results to the HTTP codes in PRD 00. Reuse the error JSON shape `{ error: { code, message } }`.

There is no automatic second try for a bad speech. The player uses `Retry turn`. The one automatic retry in PRD 05 is only for judge JSON.

## 6. Dependencies

- PRD 00 for the turn contract, order, and error codes.
- PRD 01 for the shell, tokens, primitives, and focus styles.
- PRD 02 for `generate` and the status panel.
- PRD 03 for characters and `buildTurnMessages`.
- PRD 04 for `createDebate`, `restoreDebate`, `appendTurn`, and `getExpectedTurn`.
- Does not depend on PRD 05. Do not import `lib/judge` in this PRD.
- PRD 07 will extend `GameSession` and the debate screen's ready state.

## 7. Error and edge cases

| Case | UI behavior |
| --- | --- |
| Topic too short, one slot empty, or a model choice missing | Start disabled. No request. |
| Player picks Rex in both slots | Second Rex control is disabled. |
| Speaker models are 7B and 14B | Start disabled. `sameSizeBand` is false. |
| Player picks the same model for both speakers | Second control is disabled. |
| Ollama down on the first turn | Error text from `OLLAMA_UNAVAILABLE`, transcript empty, `Retry turn` requests opening A. |
| Timeout | `OLLAMA_TIMEOUT` message, same retry rule. |
| Model returns an empty speech | `INVALID_MODEL_OUTPUT`, no appended turn. |
| Response arrives after Cancel | Ignored because `pending` was cleared. |
| Response arrives for opening A after the UI already moved on | Ignored because it does not match `pending`. |
| Pause during opening A | A's speech still appears if the request succeeds, then the screen waits. B does not start until Resume. |
| Double-click Start | Reducer and disabled button keep a single `pending`. |
| Sixth speech succeeds | Ready-for-judge status. No winner text and no numeric scores. |
| Reload | Setup is empty. |

Do not render a stack trace. If the response is not JSON, show `The debate request failed. You can retry this turn.`

## 8. Testing strategy

Reducer tests, no network:

- Start with a valid Rex-versus-Athena fixture sets `pending` to opening A.
- Short topic does not leave setup. Test the disabled rule through `validateTopic` plus the same condition the button uses.
- `turn_succeeded` appends and advances to opening B while running.
- `turn_succeeded` while paused appends and leaves `pending` null.
- A mismatched `turn_succeeded` does not change `turns`.
- `turn_failed` does not add a turn.
- Six successes reach `awaiting_judge` with `pending` null and `phase` still `debate`.
- `cancel` clears `pending` without appending.

Route test with `generate` mocked:

- Legal opening request returns the mock text and calls `generate` with `model` equal to slot A's model.
- A body that asks for rebuttal with an empty transcript returns `409` and does not call `generate`.
- Empty model text returns `502 INVALID_MODEL_OUTPUT`.

Render tests:

- Setup shows `Debate topic`, disables Start for `Too short`, and enables it for `Should AI replace human teachers?` once two different characters, two models in the same size band, and a different judge model are chosen.
- Rex in slot A makes Rex disabled in slot B. A model selected for slot A is disabled for slot B.
- A catalog containing a 7B model and a 14B model does not enable Start when those are the two speaker models.
- Debate screen fixture with one stored opening shows `Rex`, that speaker's model name, `For`, and `Opening`.
- Pending opening B shows `Athena is making the opening argument.`
- Error fixture shows `Retry turn` and does not show a score.

Manual check after the automated tests: run a real debate only if Ollama is up. Confirm pause and cancel once. If Ollama is down, the mocked tests are enough for this PRD, and the unreachable banner must still be readable.

## 9. Acceptance criteria

- AC-U-1. A player can choose a valid topic, Rex, Athena, two models in the same size band, and a different judge model, and see six speeches in order when those models succeed.
- AC-U-2. The active speaker's name and the current round are visible as text on a 390px viewport and on a desktop viewport.
- AC-U-3. Cancel or a failed turn leaves the next request on the same speech.
- AC-U-4. Two overlapping successes cannot add two copies of the same speech. The reducer test for a mismatched response covers this.
- AC-U-5. The ready state has the full transcript and no winner, score, or disclaimer yet.
- AC-U-6. `npm test` passes with Ollama stopped.
- AC-U-7. The screen is not a pair of unlabeled chat bubbles. Each speech has the speaker name, that speaker's model name, and the side.

## 10. Implementation tasks

1. Read the Next.js route-handler docs, then add `POST /api/debate/turn`.
2. Add the playback reducer and its tests.
3. Build the setup form and character cards.
4. Build the debate screen, status line, and pause, cancel, and retry controls.
5. Wire the client fetch to `pending`, including abort on cancel.
6. Add the route and render tests from section 8.
7. Run `npm test`, `npm run lint`, and `npm run build`.
8. Check the setup and debate screens at about 390px and at desktop width. Click start, pause, and retry in the browser if a model is available. If it is not, still verify the error banner and the disabled Start state in the browser.

## 11. Open questions

None. Judging starts in PRD 07 from the ready state this PRD leaves behind.
