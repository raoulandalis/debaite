---
name: DebAIte
description: Application shell for a local AI debate game, set in a ballot theme.
colors:
  background: "#d5dee8"
  surface: "#eef3f8"
  surface-raised: "#f7f9fb"
  foreground: "#1a2330"
  muted: "#3e4d61"
  border: "#b3c0cf"
  header: "#173556"
  header-foreground: "#f4f7fb"
  danger: "#9b2c2c"
  success: "#1d6b45"
  rex: "#8a3d16"
  athena: "#1f4f86"
  jester: "#7a5b10"
typography:
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
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
    letterSpacing: "0.04em"
rounded:
  sm: "2px"
  md: "4px"
spacing:
  page: "16px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.header}"
    textColor: "{colors.header-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "24px"
  badge-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.header-foreground}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  textarea:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
---

## Overview

DebAIte’s shell is a working app frame in a ballot theme. Carbon blue owns the header. The page ground is cool blue-gray paper. Three outline stamps in the header name the match shape: Opening, Rebuttal, and Closing. They are inactive. They are not buttons, and none of them is the current round.

The scene is a desk under ordinary room light, so the theme is light. There is one theme and no toggle.

## Colors

The header blue `#173556` is the committed color. Header text is `#f4f7fb`.

Page ground `#d5dee8`. Panels `#eef3f8`. Raised panels `#f7f9fb`. Primary text `#1a2330`. Secondary text `#3e4d61`. Borders `#b3c0cf`.

Pencil red `#9b2c2c` is for errors and a status mark only. Success `#1d6b45` is for positive status only.

Character marks are border and stamp colors, never the only way to read a name: Rex `#8a3d16`, Athena `#1f4f86`, Jester `#7a5b10`. The CSS variables are `--rex`, `--athena`, and `--jester`.

## Typography

UI text is Geist. Stamp figures and compact labels are Geist Mono. Body text does not use Arial. Headings use weight and size, not a second display face.

## Layout

The shell is a header plus one main column. Content has at least 16px of horizontal padding. At 1280px the column is centered and at most 1120px wide. The first focusable control is a skip link to `#main`.

## Elevation & Depth

Depth comes from the paper steps: ground, panel, raised panel. Do not add hard offset shadows.

## Shapes

Corners are 2px. Stamps are outlined rectangles, not filled pills. Borders are 1px.

## Components

`Button`, `Card`, `Textarea`, `Label`, and `Badge` live in `components/ui/`. Buttons default to `type="button"` and show a visible disabled state. Labels are real `<label>` elements. Focus uses `focus-visible`. When the user prefers reduced motion, transitions are removed or shorter than 0.01ms.

The header stamps use `Badge`. The waiting note uses `Card`. Character colors stay available for later screens.

## Do's and Don'ts

Do keep one theme. Do keep pencil red off decoration. Do leave the round stamps inactive until a debate exists.

Do not switch colors with `prefers-color-scheme`. Do not add a theme toggle. Do not imply a debate is already running on the shell.
