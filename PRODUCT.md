# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A player on their own computer who wants a short competitive argument and does not need to know how language models work. They open the app, pick two characters, give them a topic, watch the argument, and read a scored ending. There is no account and no saved history.

## Product Purpose

DebAIte is a local debate game. Two built-in AI personalities argue a topic the player chose, for three rounds, and a third AI role evaluates the transcript. The application computes the weighted scores and the winner. Success is a finished debate the player can follow, with a clear speaker, round, and result, then the choice to play again.

## Positioning

The spectacle is three distinct personalities in a fixed six-speech match, not an open chat. The judge never supplies the winner or the weighted total. The browser never talks to the model. Reloading the page discards the session.

## Operating Context

The player runs the app against Ollama on the same machine. Debate progress lives in the browser. Each turn or judge request sends the transcript it needs. The playable phases are setup, debate, and results. The first surface, the application shell, exists before topic submission, character choice, or model calls.

## Capabilities and Constraints

Confirmed for the product:

- One loop: topic, two different characters, six speeches (opening, rebuttal, closing; affirmative speaks first), then a judgment.
- Characters: Rex the Provocateur, Athena the Strategist, and Jester the Wildcard. Personalities come from prompts, not from separate models.
- Debater models are `mistral:7b`, `qwen2.5:7b`, and `llama3.1:8b`. The player assigns two of those. The judge is always `gemma2:9b`. A tag that is not installed is unavailable. Setup does not list other Ollama models.
- Slot A is affirmative. Slot B is negative. The same character cannot fill both slots.
- Results must say the verdict is an AI-generated evaluation, not an objective ruling. Required sentence: "This verdict is an AI-generated evaluation, not an objective ruling."
- No accounts, payments, database, saved history, shareable debate URLs, character editor, token streaming, or a claim that the judge is unbiased.
- Existing app: Next.js App Router, React, TypeScript, Tailwind CSS. Do not recreate the Next.js app.
- Shell engineering that stays regardless of look: keyboard reach including a skip link to `#main`, visible focus, WCAG AA contrast, and reduced motion that removes or shortens animation. `npm test` must not need Ollama.

Undecided, and not to be invented as product truth:

- Visual world, palette, typography, light or dark ground, and whether the interface should look like a game. The player unbound the overview's "dark, game-like" line and the foundation PRD's color, type, and width tokens on 2026-10-09.

## Brand Commitments

The name is DebAIte. Voice stays plain: a person should understand the game without a lesson on models. The fun is distinct personalities, short arguments, and a clear ending.

No palette, typeface, theme, or "game-like" treatment is binding in the PRDs. Character identities stay; their earlier accent hex values do not. Once a direction is chosen, `DESIGN.md` is the visual source of truth for implementation.

## Evidence on Hand

Product requirements live in `docs/prd/`. There is no shipped debate UI, no screenshot set, and no customer proof. Do not invent testimonials, benchmarks, or a claim that a debate already runs on the shell.

Shell copy may say: "Pick two AI characters, give them a topic, and watch them debate." It must not imply the match is already playable on that screen.

## Product Principles

- The match has a shape: two sides, three rounds, one ending.
- Personality is the reason to watch. The model machinery stays backstage.
- The score is the application's, and the verdict is labeled as a game evaluation.
- A player can finish, then immediately play again, without an account.
- The interface stays operable by keyboard, with readable contrast and no required motion.

## Accessibility & Inclusion

Text and controls meet WCAG AA contrast against the surface they sit on. A keyboard user can reach the main content and see focus. When the player prefers reduced motion, transitions and animations are removed or shorter than 0.01ms.
