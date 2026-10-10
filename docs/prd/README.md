# DebAIte PRDs

These documents plan the DebAIte MVP. They are the implementation source of truth. They do not replace reading the current Next.js project before changing it.

Implement one PRD per Cursor session. Do not start the next PRD until the current one's acceptance criteria pass.

Shared architecture, API shapes, error codes, and scoring math live in [00-product-overview.md](00-product-overview.md). Later PRDs restate only the parts they own. If a detail disagrees with PRD 00, PRD 00 wins until both files are corrected together.

## How to use a PRD in a new session

1. Read [00-product-overview.md](00-product-overview.md).
2. Read the single PRD you are implementing.
3. Inspect the files that PRD names before editing them.
4. Implement only that PRD's tasks. Leave later features unbuilt.
5. Run the tests and checks listed in that PRD.
6. Stop when its acceptance criteria pass. Do not continue into the next PRD in the same session unless you were asked to.

## Implementation order

| Order | File | What it delivers |
| ---: | --- | --- |
| 0 | [00-product-overview.md](00-product-overview.md) | Shared context. No application code. |
| 1 | [01-project-foundation.md](01-project-foundation.md) | Dark app shell, UI primitives, Vitest. |
| 2 | [02-ollama-integration.md](02-ollama-integration.md) | Server-side Ollama gateway and health check. |
| 3 | [03-character-system.md](03-character-system.md) | Rex, Athena, Jester, and prompt assembly. |
| 4 | [04-debate-engine.md](04-debate-engine.md) | Pure three-round state machine. |
| 5 | [05-judge-and-scoring.md](05-judge-and-scoring.md) | Judge schema, validation, and weighted scores. |
| 6 | [06-gameplay-ui.md](06-gameplay-ui.md) | Setup and live debate screen. |
| 7 | [07-results-and-replay.md](07-results-and-replay.md) | Verdict screen, rematch, and new debate. |
| 8 | [08-reliability-and-acceptance.md](08-reliability-and-acceptance.md) | Cross-cutting checks and the MVP checklist. |

PRDs 02 and 03 may be implemented in either order after PRD 01. Every other step follows the table.

## Dependency map

```text
00 Product overview
        |
        v
01 Project foundation
        |
        +------------------+
        |                  |
        v                  v
02 Ollama gateway    03 Characters
                           |
                           v
                     04 Debate engine
                           |
                           v
                     05 Judge and scoring
                           |
01 + 02 + 03 + 04 ---------+
        |
        v
06 Gameplay UI
        |
        v
07 Results and replay
        |
        v
08 Reliability and acceptance
```

PRD 06 needs the gateway, characters, and debate engine. It does not need the judge. PRD 07 needs both the gameplay screen and judging. PRD 08 assumes the earlier PRDs already exist.

## What this set deliberately excludes

No database, accounts, payments, debate history, character editor, token streaming, hosted model APIs, or deployment that publishes a home Ollama server. Those are non-goals in PRD 00. The player chooses two of `mistral:7b`, `qwen2.5:7b`, and `llama3.1:8b`. The judge is always `gemma2:9b`.
