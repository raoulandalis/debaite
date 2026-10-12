import { expect, test } from "vitest";
import { CHARACTERS, getCharacter } from "@/lib/characters";

const fields = [
  "id",
  "name",
  "title",
  "tagline",
  "summary",
  "accentToken",
  "monogram",
  "systemPrompt",
] as const;

test("registers exactly Rex, Athena, and Jester", () => {
  expect(Object.keys(CHARACTERS).sort()).toEqual(["athena", "jester", "rex"]);
  expect(CHARACTERS.rex).toMatchObject({
    id: "rex",
    name: "Rex",
    title: "The Provocateur",
    monogram: "R",
    accentToken: "rex",
    summary:
      "Bold, confident, and confrontational. Uses sharp one-liners and forceful arguments.",
  });
  expect(CHARACTERS.athena).toMatchObject({
    id: "athena",
    name: "Athena",
    title: "The Strategist",
    monogram: "A",
    accentToken: "athena",
    summary:
      "Calm, analytical, and methodical. Uses structured reasoning and carefully chosen examples.",
  });
  expect(CHARACTERS.jester).toMatchObject({
    id: "jester",
    name: "Jester",
    title: "The Wildcard",
    monogram: "J",
    accentToken: "jester",
    summary:
      "Witty, playful, and unpredictable. Uses humor, analogies, and unexpected angles.",
  });
});

test("each record has only the character fields", () => {
  for (const character of Object.values(CHARACTERS)) {
    expect(Object.keys(character).sort()).toEqual([...fields].sort());
  }
});

test("looks up a character by exact id", () => {
  expect(getCharacter("rex")).toBe(CHARACTERS.rex);
  expect(getCharacter("Rex")).toBeNull();
  expect(getCharacter("unknown")).toBeNull();
});

test("stores the personality prompts as data and does not name a model", () => {
  expect(CHARACTERS.rex.systemPrompt).toBe(
    [
      "You are Rex, the Provocateur. You are bold, confident, and confrontational.",
      "You attack weak assumptions directly and you favor sharp, concrete claims.",
      "Talk like you are in the room. Use short sentences. One jab, then the claim.",
      "Sound like you are cutting in, not writing a column.",
      "Sarcasm is allowed. Insults, slurs, and personal abuse are not a substitute for an argument.",
      "You do not hide behind vague slogans. You do not end with a pep talk.",
      "You commit to your assigned side.",
    ].join("\n"),
  );
  expect(CHARACTERS.athena.systemPrompt).toContain(
    "You are Athena, the Strategist.",
  );
  expect(CHARACTERS.jester.systemPrompt).toContain(
    "You are Jester, the Wildcard.",
  );
  for (const character of Object.values(CHARACTERS)) {
    expect(character.systemPrompt).not.toMatch(/llama3\.2|qwen|gemma/i);
  }
});
