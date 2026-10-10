# PRD 07 — Results Screen and Replay Flow

## 1. Purpose

Turn a finished transcript into a judged result the player can read, then let them run the same matchup again or edit the setup. Scores on this screen come only from a validated judgment.

## 2. User stories

- R-US-1. As a player, I see who won, the weighted scores, and the four criteria.
- R-US-2. As a player, I can read the verdict, the best point, and the biggest weakness for each character.
- R-US-3. As a player, I understand the verdict is an AI evaluation.
- R-US-4. As a player, I can play again or return to setup without being stuck when judging fails.

## 3. Scope

### Included

- Automatic judging when a running debate reaches six speeches.
- A results phase for a win and for a tie.
- Judging loading and failure states that keep the transcript.
- Play again and New debate.
- Tests that render a fixture judgment and tests that refuse to show scores without one.

### Excluded

- Changing the rubric or recomputing weights in the component.
- Saving results.
- Sharing a link to a finished debate.
- Animating a trophy, confetti, or a sound effect.

## 4. Requirements

- R-1. Extend the PRD 06 session with `judgment: Judgment | null`. Add reducer events `judge_started`, `judge_succeeded`, and `judge_failed`. Do not rename the PRD 06 fields.
- R-2. Replace the PRD 06 rule that clears `pending` when the sixth speech finishes. If playback is `running`, set `pending` to `{ kind: "judge" }` instead. If playback is `paused`, leave `pending` null and show a button labeled `Judge the debate`. `resume` while status is `awaiting_judge` uses that same judge start. `resume` while a speech is still expected keeps the PRD 06 behavior.
- R-3. The judge request POSTs the current topic, character ids, and turns to `/api/debate/judge`. Use an `AbortSignal`. `Cancel judging` aborts it, clears the pending judge, sets playback to `paused`, and does not change turns or set `judgment`.
- R-4. Ignore a judge response unless `pending` is `{ kind: "judge" }`. A successful body must satisfy the same shape as `Judgment` before it is stored: both sides, integer criterion scores, integer `weightedUnits`, `winner`, non-empty prose, and the exact disclaimer from PRD 00. Recompute each side with `scoreSide`. If either `weightedUnits` or `weightedDisplay` differs, reject the body and do not display it. Show `The judge response could not be verified. You can retry.` The speeches stay on the debate screen.
- R-5. On an accepted judgment, call `markJudged`, store the judgment, set `phase` to `results`, and clear the error and pending request.
- R-6. On `judge_failed`, stay in phase `debate`, keep all six speeches, leave `judgment` null, and show the API message plus `Retry judging`. Retry sends one new judge request. It does not regenerate speeches.
- R-7. The page `h1` stays `DebAIte` on the results phase. The outcome is an `h2`: `{Character name} wins` when `winner` is `"a"` or `"b"`, and `Tie` when `winner` is `"tie"`. Do not show a winner name in a tie. Do not add a second `h1`.
- R-8. Show both weighted displays beside the character names, labeled `Weighted score`. Also show the four criteria with these labels and weights:

  | Label | Weight text | Score fields |
  | --- | --- | --- |
  | Reasoning and logical consistency | 35% | `reasoning` |
  | Rebuttals and engagement with the opponent | 30% | `rebuttal` |
  | Evidence, examples, and supporting arguments | 20% | `evidence` |
  | Clarity and persuasiveness | 15% | `clarity` |

  Each row shows the integer for A and the integer for B. The component does not multiply those integers again for display. It shows `weightedDisplay` from the validated judgment.
- R-9. Show `verdict` in a section headed `Verdict`. Show `strongest.a` and `strongest.b` under `Strongest argument`, each with the character name. Show `weakness.a` and `weakness.b` under `Biggest weakness`, each with the character name.
- R-10. Show `judgment.disclaimer` as visible text in the results main region, not only as a `title` attribute or an icon with no text.
- R-11. `Play again` creates a new debate with the same topic and character ids, sets `judgment` to null, sets phase to `debate`, sets playback to `running`, and requests opening A. The previous speeches are gone.
- R-12. `New debate` sets phase to `setup`, sets `debate` and `judgment` to null, and keeps `topicDraft`, `debaterAId`, and `debaterBId` so the form is still filled in.
- R-13. While judging, the debate screen stays mounted, the six speeches stay visible, and the status line is `The judge is scoring the debate.` Do not show an empty results page and do not show placeholder scores such as `0`, `--`, or `TBD`.
- R-14. Results use the character accent and monogram for each side. The winner heading does not rely on color alone. A tie shows both names at the same visual level.
- R-15. At 390px, the winner heading, both scores, and the criterion rows are readable without horizontal scrolling. At 1024px and above, the two characters' score columns sit side by side.
- R-16. Results controls are buttons. The disclaimer and verdict are text a screen reader can reach. The live region announces `The judge is scoring the debate.` and, on failure, `Judging failed. You can retry.` On success, move focus to the outcome `h2`. Give that heading `tabIndex={-1}` so the focus move works.
- R-17. There is no results render when `judgment` is null. The ready and judging states from the debate screen cover that period.

## 5. Technical approach

Files:

```text
lib/debate/playback.ts          # extend the PRD 06 reducer
lib/judge/client-validate.ts   # recompute units and check the disclaimer
components/results/results-screen.tsx
tests/debate/playback-judge.test.ts
tests/results/results-screen.test.tsx
```

`client-validate.ts` imports `scoreSide` from `lib/judge/score.ts` rather than copying the formula into the component. It returns the judgment or an error code `INVALID_MODEL_OUTPUT` for a body that does not match.

The results component receives a `Judgment` and the two character records. It does not fetch.

### Reducer additions

| Event | Effect |
| --- | --- |
| `judge_started` | Allowed only when status is `awaiting_judge`, `judgment` is null, and `pending` is null. Sets `pending` to `{ kind: "judge" }`. Clears `error`. |
| `judge_succeeded` | If `pending` is `{ kind: "judge" }` and validation passes, `markJudged`, store judgment, phase `results`, clear pending. If validation fails, treat it as `judge_failed` with message `The judge response could not be verified. You can retry.` |
| `judge_failed` | Clear the judge pending, pause playback, set `error`, leave phase `debate` and `judgment` null. |

Speech `pending` and judge pending must be distinguishable so a late turn response cannot be stored as a verdict.

### Results layout

```text
h1: DebAIte
h2: "{Name} wins" or "Tie"
Disclaimer
Two summaries: monogram, name, side, weighted score
Four criterion rows
Verdict
Strongest argument: A then B
Biggest weakness: A then B
Play again
New debate
```

Keep the debate transcript available below the verdict in a section headed `Transcript`, using the same speech cards as PRD 06. The player should not lose the arguments when the result appears.

Play again and New debate are the only ways back. Do not add a third "rematch with swapped sides" control.

## 6. Dependencies

- PRD 00 for `Judgment`, the formula, and the disclaimer sentence.
- PRD 05 for the judge route, `scoreSide`, `markJudged`'s precondition, and the disclaimer constant.
- PRD 06 for the session, the debate screen, and the six-speech ready state.
- PRD 01 for layout and contrast.

## 7. Error and edge cases

| Case | Behavior |
| --- | --- |
| Judge route returns `INVALID_MODEL_OUTPUT` | Transcript remains. `Retry judging` is visible. No scores. |
| Ollama stops before judging | `OLLAMA_UNAVAILABLE` message. Speeches remain. |
| Judge times out | `OLLAMA_TIMEOUT`. Cancel is also available while the request is in flight. |
| Success payload has scores that do not match `weightedUnits` | Reject it, stay on the debate, show a judging error. |
| Tie | Heading `Tie`. Both weighted displays match. No `wins` heading. |
| Play again while the judge request is in flight | Ignore Play again until results are shown. The button is not on the debate screen. |
| New debate | Setup fields remain. Starting again creates a fresh transcript. |
| Player pauses after speech six | `Judge the debate` instead of an automatic call. |
| Reload on results | Full reset to empty setup. Nothing is restored. |

Do not invent a winner from the longer speech or from slot A when the request fails.

## 8. Testing strategy

Reducer tests:

- Sixth speech while running sets the judge pending and does not set `results`.
- Sixth speech while paused does not set the judge pending.
- `judge_succeeded` with the worked example from PRD 05 stores `66.50` and phase `results`.
- `judge_succeeded` with mismatched `weightedUnits` stays on `debate` and leaves `judgment` null.
- `judge_failed` keeps six turns and a null judgment.
- `Play again` produces an empty `in_progress` debate, the same ids and topic, and pending opening A.
- `New debate` keeps the draft topic and ids and clears `debate`.

Render tests with a fixture, no fetch:

- Winner fixture for Rex shows heading `Rex wins`, both weighted scores, all four criterion labels, the verdict, both strongest lines, both weakness lines, and the disclaimer.
- Tie fixture shows heading `Tie` and does not show `wins`.
- A debate-screen fixture with six turns and null judgment does not show `Weighted score` or the disclaimer.

Manual browser check when a model is available: finish a debate, read the verdict, use Play again, then use New debate and confirm the topic is still in the field. If no model is available, the fixture tests are the completion bar for the visuals, and the manual path remains required in PRD 08 when Ollama is up.

## 9. Acceptance criteria

- AC-R-1. A validated judge response is the only way to reach the results phase.
- AC-R-2. The winner heading, both weighted scores, four criteria, verdict, strongest arguments, weaknesses, and disclaimer are visible.
- AC-R-3. A tie does not name a winner.
- AC-R-4. A judging failure leaves six speeches on the debate screen and shows `Retry judging`.
- AC-R-5. Play again starts opening A with the same topic and characters and an empty transcript.
- AC-R-6. New debate returns to a filled-in setup form.
- AC-R-7. `npm test` passes with Ollama stopped, including a test that null `judgment` does not render scores.

## 10. Implementation tasks

1. Add client-side judgment validation that recomputes `weightedUnits`.
2. Extend the playback reducer with the judge events and tests.
3. From the debate screen, start or defer judging according to R-2, with cancel and retry.
4. Build the results screen and the transcript section.
5. Wire Play again and New debate.
6. Add the render tests in section 8.
7. Run `npm test`, `npm run lint`, and `npm run build`.
8. In the browser, open a fixture-driven results state if the app cannot call Ollama, and check the win and tie headings at about 390px and at desktop width. If Ollama is available, run one real judged debate and use both replay buttons.

## 11. Open questions

None. The disclaimer stays visible even if the verdict sounds certain.
