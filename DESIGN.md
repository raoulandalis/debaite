---
name: DebAIte
description: Application shell for a local AI debate game, set in a dark arena theme.
colors:
  background: "#0b1014"
  surface: "#141b22"
  surface-raised: "#1c2630"
  foreground: "#f3f7f8"
  muted: "#b7c5d0"
  border: "#31404c"
  header: "#0b1014"
  header-foreground: "#f3f7f8"
  for: "#3ee0d0"
  against: "#e88972"
  danger: "#ffb4b4"
  success: "#8ed4ae"
  rex: "#3ee0d0"
  athena: "#b7c5d0"
  jester: "#e88972"
typography:
  headline:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0.02em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "2px"
  md: "4px"
spacing:
  page: "16px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.for}"
    textColor: "{colors.background}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-disabled:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "16px"
  badge-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  textarea:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
---

## Overview

DebAIte’s shell is a dark arena. The ground is near-black. For is cyan. Against is coral. The header carries the wordmark, “The arena,” the model-status sentence, and three inactive round stamps: 01 Opening, 02 Rebuttal, 03 Closing. Those stamps are not buttons, and none of them is the current round. The debate screen marks the round being read with the word Current.

The scene is a screen in a dark room, so the theme is dark. There is one theme and no toggle.

## Colors

Page ground `#0b1014`. Panels `#141b22`. Raised panels `#1c2630`. Primary text `#f3f7f8`. Secondary text `#b7c5d0`. Borders `#31404c`.

For `#3ee0d0` is the affirmative side and the primary action. Against `#e88972` is the negative side. Side color tints the panel border and that side’s portrait. The name, letter, and drawing still identify the character when color is removed.

Danger `#ffb4b4` is for errors. Success `#8ed4ae` is for a ready status mark only.

## Typography

Fighter names and the “Set the match” heading use Bebas Neue. UI text is Geist. Stamp figures and compact labels are Geist Mono. Body text does not use Arial.

## Layout

The shell is a header plus one main column. Content has at least 16px of horizontal padding. At 1280px the column is centered and at most 1120px wide. Setup places For, VS, and Against in one row, and stacks them below that width. Nubi, the judge, sits in a center card directly under VS. Start debate is centered under the matchup. The first focusable control is a skip link to `#main`.

## Elevation & Depth

Depth comes from the ground, the panel, and the raised panel. Do not add hard offset shadows.

## Shapes

Corners are 2px. Stamps are outlined rectangles, not filled pills. Side panels use a 1px border in the side color. Portraits are white line drawings masked to the side color. They live in `public/characters/`.

## Components

`Button`, `Card`, `Textarea`, `Label`, and `Badge` live in `components/ui/`. The primary button is cyan with near-black text. Buttons default to `type="button"` and show a visible disabled state. Labels are real `<label>` elements. Focus uses a cyan `focus-visible` outline. When the user prefers reduced motion, transitions are removed or shorter than 0.01ms.

## Do's and Don'ts

Do keep one theme. Do keep danger off decoration. Do leave the header round stamps inactive. Do tint a portrait with the side it is playing, not with a separate character hue.

Do not switch colors with `prefers-color-scheme`. Do not add a theme toggle. Do not imply a debate is already running on the shell.
