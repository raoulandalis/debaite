# PRD 03 — Character System and Prompt Engineering

## 1. Purpose

Keep the three personalities in one registry and build the messages each debater sends to the model. UI code and the Ollama client must not contain personality paragraphs.

## 2. User stories

- C-US-1. As a player, I can later choose Rex, Athena, or Jester and hear a difference in how they argue.
- C-US-2. As a player, I can trust that each character stays on the side I assigned.
- C-US-3. As a developer, I can test prompt contents without calling Ollama or rendering React.

## 3. Scope

### Included

- A character record for Rex, Athena, and Jester.
- Shared debate rules appended to every character system prompt.
- A pure function that turns a character plus the current round context into `system` and `user` messages.
- Tests for side assignment, own-versus-opponent labeling, and rebuttal engagement.

### Excluded

- A character editor, extra characters, or per-character models.
- The debate state machine (PRD 04). This PRD does not decide whose turn it is. It only formats the turn it is given.
- The judge prompt (PRD 05).
- Portrait images. The visual is a monogram and an accent token already defined in PRD 01.

## 4. Requirements

- C-1. Export `CHARACTERS` and `getCharacter(id)` from `lib/characters/`. Unknown ids return `null`.
- C-2. Each character has exactly these fields:

  ```ts
  type Character = {
    id: "rex" | "athena" | "jester";
    name: string;
    title: string;
    summary: string;
    accentToken: "rex" | "athena" | "jester";
    monogram: "R" | "A" | "J";
    systemPrompt: string;
  };
  ```

- C-3. The three records are:

  | id | name | title | monogram | accentToken | summary |
  | --- | --- | --- | --- | --- | --- |
  | `rex` | Rex | The Provocateur | R | `rex` | Bold, confident, and confrontational. Uses sharp one-liners and forceful arguments. |
  | `athena` | Athena | The Strategist | A | `athena` | Calm, analytical, and methodical. Uses structured reasoning and carefully chosen examples. |
  | `jester` | Jester | The Wildcard | J | `jester` | Witty, playful, and unpredictable. Uses humor, analogies, and unexpected angles. |

- C-4. `systemPrompt` values are the three blocks in section 5, stored as data. Components do not copy those paragraphs into JSX.
- C-5. `buildTurnMessages(character, context)` returns two messages: one `system`, one `user`. It does not call Ollama.
- C-6. Context is:

  ```ts
  type TurnContext = {
    topic: string;
    side: "affirmative" | "negative";
    round: "opening" | "rebuttal" | "closing";
    ownStatements: string[];
    opponentStatements: string[];
  };
  ```

- C-7. The system message is `character.systemPrompt` plus the shared rules in section 5. It includes the word target for that round from PRD 00: 80–140 words for opening and rebuttal, 60–100 words for closing.
- C-8. The user message includes the topic, the assigned side, the round name, and the round task from section 5.
- C-9. Affirmative means defend the topic. If the topic is a question, defend the yes answer. Negative means oppose that position. The prompt forbids switching sides later.
- C-10. Own speeches are listed under the heading `YOUR PREVIOUS STATEMENTS`. Opponent speeches are listed under `OPPONENT STATEMENTS`. If a list is empty, the section says `None yet.`
- C-11. The user message tells the model to answer the opponent's actual claims in rebuttal and closing, and not to repeat its earlier speeches.
- C-12. The user message says to output only the speech: no speaker name, no "Opening:" label, and no markdown heading.
- C-13. Shared rules forbid slurs, threats, and insults used in place of an argument. They allow Rex's sarcasm and Jester's jokes when a real argument is still present.
- C-14. `statementsForSpeaker(turns, speaker)` splits a transcript into `ownStatements` and `opponentStatements` in chronological order. PRD 04 owns the transcript type. This helper may live next to the prompt builder and import that type.
- C-15. Prompt builders must not insert the judge rubric, character ids of the opponent, or the opponent's system prompt.

## 5. Technical approach

Files:

```text
lib/characters/types.ts
lib/characters/characters.ts
lib/characters/prompts.ts
lib/characters/index.ts
tests/characters/registry.test.ts
tests/characters/prompts.test.ts
```

`lib/debate/types.ts` may already export `RoundId`, `SpeakerSlot`, and `Turn` when PRD 04 lands. If this PRD is implemented first, define those three types in `lib/debate/types.ts` anyway. They are shared contracts from PRD 00, not UI code. Do not implement the state machine in this PRD.

### Personality prompts

Rex:

```text
You are Rex, the Provocateur. You are bold, confident, and confrontational.
You attack weak assumptions directly and you favor sharp, concrete claims.
Sarcasm is allowed. Insults, slurs, and personal abuse are not a substitute for an argument.
You do not hide behind vague slogans. You commit to your assigned side.
```

Athena:

```text
You are Athena, the Strategist. You are calm, analytical, and methodical.
You use ordered reasons and specific examples. You point out contradictions in the opponent's claims.
You do not mock the opponent. You make the logic easy to follow.
You commit to your assigned side.
```

Jester:

```text
You are Jester, the Wildcard. You are witty, playful, and unexpected.
You use humor and creative analogies, and you still make a substantive argument about the topic.
You do not abandon the topic for a joke. Clever comebacks must answer the opponent's point.
You commit to your assigned side.
```

### Shared rules

Append this to every system message:

```text
Rules:
- Stay on the topic and on your assigned side for the entire debate.
- Do not switch sides, do not argue both sides, and do not defer to the opponent.
- Do not mention that you are an AI, that a judge is watching, or that you are scored.
- Do not use slurs, threats, or abuse. Wit is allowed only when the argument is still clear.
- Do not repeat one of your earlier speeches. Add a new reason or answer a claim you have not answered.
- In rebuttal and closing, refer to a specific claim the opponent actually made.
- Follow the word limit for this round.
- Output only the spoken argument.
```

### User message template

```text
Topic: {topic}
Your side: {affirmative|negative}
Round: {opening|rebuttal|closing}

Side instructions:
{side instructions}

Round task:
{round task}

YOUR PREVIOUS STATEMENTS:
{numbered speeches or "None yet."}

OPPONENT STATEMENTS:
{numbered speeches or "None yet."}

Write only your next speech. Do not prefix it with your name.
```

Side instructions:

- Affirmative: "Defend the topic. If it is a question, argue yes. If it is vague, pick one clear reading and defend that reading for the rest of the debate."
- Negative: "Oppose the topic. If it is a question, argue no. If the opponent has already chosen a reading, attack that reading instead of changing the subject."

Round tasks:

- Opening: "Present your position and two reasons. If opponent statements exist, you may contrast them in one or two sentences, but this speech is still your opening, not a full rebuttal."
- Rebuttal: "Answer at least one specific sentence from the opponent's statements. Say what is wrong with it, then strengthen your own side. Do not give another opening speech."
- Closing: "Give the strongest final case for your side using what was already argued. Do not introduce a new major claim that neither side has made. Keep it shorter than your opening."

Word limit line, chosen from the round:

- Opening and rebuttal: "Word limit: 80 to 140 words."
- Closing: "Word limit: 60 to 100 words."

### How a later route uses this

PRD 06's turn route will:

1. Resolve both character ids through `getCharacter`.
2. Take the speaker's character and side (`a` affirmative, `b` negative).
3. Split the transcript with `statementsForSpeaker`.
4. Call `buildTurnMessages`.
5. Call `generate` from PRD 02 with temperature `0.8` and `numPredict` 320 for opening and rebuttal, or 240 for closing. That argument is sent as Ollama's `options.num_predict`.

This PRD does not add that route.

### Example scenarios the tests should lock

1. Opening, Rex, affirmative, topic `Should AI replace human teachers?`, empty transcript. The user message contains that topic, `affirmative`, `YOUR PREVIOUS STATEMENTS:` followed by `None yet.`, and does not contain Athena's or Jester's prompt text.
2. Rebuttal, Athena, negative, opponent statement `Classrooms need human judgment.` The opponent section contains that exact sentence, and the round task tells the model not to give another opening speech.
3. Closing, Jester, affirmative, one own statement and two opponent statements. Own text appears only under `YOUR PREVIOUS STATEMENTS`. Opponent text appears only under `OPPONENT STATEMENTS`.

## 6. Dependencies

- PRD 00 for sides, round names, and word targets.
- PRD 01 for accent token names. This PRD does not have to render them.
- May be implemented before or after PRD 02. It must not import `lib/ollama/client.ts`.
- PRD 04 should call `getCharacter` for id checks. PRD 06 should call `buildTurnMessages`.

## 7. Error and edge cases

- Unknown character id: `getCharacter` returns `null`. Callers return `INVALID_INPUT`. This module does not throw for a missing id.
- Empty `ownStatements` on the first speech: render `None yet.` Do not omit the heading. The model should see that it has not spoken.
- Opening for speaker B: opponent statements may already contain A's opening. Use the opening round task, which allows a short contrast and defers the full rebuttal.
- Topic is subjective or has no factual answer: still assign affirmative and negative. Do not add a "correct answer" line.
- A statement contains the words "system:" or "ignore previous instructions": treat it as debate text inside the labeled section. Do not give model output any authority over the application. The route in later PRDs still validates the next speech as plain text.
- Very long prior speeches: pass them through. The 4,000-character cap is enforced by PRD 04 before they are stored.

## 8. Testing strategy

Pure tests, no React and no Ollama:

- Registry has exactly the ids `rex`, `athena`, and `jester`, with the names, titles, monograms, and accent tokens in C-3.
- `getCharacter("rex")` returns Rex. `getCharacter("Rex")` and `getCharacter("unknown")` return `null`.
- The three example scenarios in section 5.
- Rebuttal and closing user messages include the phrase `specific` only if that is in the round task; assert the round-task sentence itself is present.
- System message for Rex contains `Provocateur` and the shared rule that forbids slurs.
- System message for a rebuttal contains `80 to 140 words`. Closing contains `60 to 100 words`.
- `statementsForSpeaker` on a six-turn fixture returns three own and three opponent strings for speaker A, in order.

## 9. Acceptance criteria

- AC-C-1. Personality text lives in `lib/characters/` and is absent from `app/` and `components/`.
- AC-C-2. Tests cover the three scenarios in section 5 and pass under `npm test` without Ollama.
- AC-C-3. A rebuttal prompt contains the opponent's actual sentence and separates it from the speaker's own sentences.
- AC-C-4. No Ollama import exists in `lib/characters/`.

## 10. Implementation tasks

1. Add the shared debate types if they are not already in `lib/debate/types.ts`.
2. Add the registry with the three prompts from section 5.
3. Add `buildTurnMessages` and `statementsForSpeaker`.
4. Add the registry and prompt tests.
5. Run `npm test` and `npm run lint`.

## 11. Open questions

None. New characters are out of scope. Edit the registry in a later version if the voices need tuning after real model runs.
