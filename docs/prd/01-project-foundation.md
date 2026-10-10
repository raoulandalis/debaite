# PRD 01 — Project Foundation and Application Shell

## 1. Purpose

Give DebAIte an application shell and a test runner before any debate behavior exists. The shell’s look comes from `DESIGN.md`. Later PRDs should add screens and logic to this shell instead of restyling the create-next-app starter again.

## 2. User stories

- F-US-1. As a player, I see a DebAIte page with a readable layout on a phone and on a desktop.
- F-US-2. As a player, I can reach the main content with a keyboard and see where focus is.
- F-US-3. As a developer, I can run `npm test` without Ollama and without changing the existing Next.js project structure.

## 3. Scope

### Included

- Keep the current Next.js 16.4 app. Do not re-run `create-next-app` and do not replace `next.config.ts`.
- Replace the starter home page with a DebAIte shell.
- The palette, type, and theme recorded in `DESIGN.md`, wired into CSS variables and Tailwind, plus focus and reduced-motion styles.
- Five UI primitives: button, card, textarea, label, and badge.
- Vitest, plus one render test that the shell shows the product name.
- A short note in the shell that a full debate arrives in later work. Do not build topic submission, character choice, or API calls here.

### Excluded

- Ollama, characters, debate state, judging, and the results screen.
- A second theme or a theme toggle. The shell uses the single theme `DESIGN.md` records.
- New routes besides the existing `/` page.
- `.env.example`. PRD 02 adds that file and the `.gitignore` exception `!.env.example`.
- Rewriting `README.md`. PRD 08 owns the developer setup docs.

### Current repository

Confirmed before this PRD was written:

- `package.json` scripts: `dev`, `build`, `start`, `lint`. No test script.
- Dependencies: `next@16.4.0`, `react@19.3.0`, `react-dom@19.3.0`.
- Dev dependencies: Tailwind CSS 4, TypeScript 5, ESLint 9, `@types/node`, `@types/react`, `@types/react-dom`.
- `app/layout.tsx` loads Geist and Geist Mono and sets `lang="en"`.
- `app/page.tsx` is the create-next-app starter.
- `app/globals.css` uses a light background and a `prefers-color-scheme: dark` override.
- `tsconfig.json` maps `@/*` to the repo root.
- No `components/`, `lib/`, or test config yet.
- `.gitignore` ignores `.env*`.

## 4. Requirements

- F-1. `npm run dev`, `npm run build`, `npm run lint`, and `npm test` all succeed after this PRD.
- F-2. `app/layout.tsx` metadata title is `DebAIte`. The description says it is an AI debate game. Load the typefaces `DESIGN.md` names. The starter Geist and Geist Mono faces stay only when `DESIGN.md` keeps them.
- F-3. The page uses the single theme in `DESIGN.md`. Do not switch colors with `prefers-color-scheme`, and do not add a theme toggle.
- F-4. `:root` defines the color roles `DESIGN.md` records, and Tailwind theme colors point at them. Copy the values from `DESIGN.md`. Do not invent a second palette in this PRD. Include a role for page background, panels, raised panels, primary text, secondary text, borders, errors, positive status, and one color each for Rex, Athena, and Jester.
- F-5. Body text uses the text face `DESIGN.md` names, not `Arial`.
- F-6. The home page renders an `h1` whose accessible name is `DebAIte`, a one-sentence description of the game, and a main region with `id="main"`.
- F-7. The first focusable control in the body is a skip link "Skip to main content" that targets `#main`. It may be visually hidden until focused.
- F-8. Interactive primitives show a visible focus ring using `focus-visible`. Do not remove the outline without a replacement.
- F-9. Under `prefers-reduced-motion: reduce`, transitions and animations on the shell and primitives are removed or shorter than 0.01ms.
- F-10. At 390px width, the shell content has at least 16px of horizontal padding and does not require horizontal scrolling.
- F-11. At 1280px width, the shell content is centered and at most 1120px wide.
- F-12. Text and controls meet WCAG AA contrast against the surface they sit on. Muted text is for secondary copy, not for the `h1` or button labels.
- F-13. Primitives live in `components/ui/` and expose `Button`, `Card`, `Textarea`, `Label`, and `Badge`.
- F-14. `Button` supports `type`, `disabled`, and a visible disabled style. The default type is `button`, not `submit`.
- F-15. `Label` is a real `<label>` and can be associated with a control through `htmlFor`.
- F-16. Try the shadcn/ui CLI for this Next.js and Tailwind 4 app. If init or component generation fails, write the five primitives locally and record that in the PR summary or code comment at `components/ui/README.md` is not required; a short comment at the top of one primitive file is enough. Later PRDs import `@/components/ui/button` and the sibling files either way.
- F-17. Add Vitest with a `test` script. Tests do not start Next.js and do not call the network.
- F-18. One component test renders the home page and asserts the `h1` text `DebAIte`.
- F-19. Do not add debate components, route handlers, or env files in this PRD.
- F-20. Rex, Athena, and Jester each have one color role taken from `DESIGN.md`, so later character UI does not invent a second palette. Later PRDs may refer to those roles as `--rex`, `--athena`, and `--jester`. The values come from `DESIGN.md`.

## 5. Technical approach

Read `node_modules/next/dist/docs/` for layout, CSS, and font usage before editing `app/layout.tsx` or `app/page.tsx`.

Keep `app/layout.tsx` as a server component. The home page can be a server component. Primitives that need click handlers later may be client components; for this PRD they can be server-safe if they do not use state.

Suggested files:

```text
app/layout.tsx
app/page.tsx
app/globals.css
components/ui/button.tsx
components/ui/card.tsx
components/ui/textarea.tsx
components/ui/label.tsx
components/ui/badge.tsx
vitest.config.ts
tests/shell.test.tsx
```

Use Testing Library and jsdom for the render test. Keep the Vite or Vitest config aligned with the `@/*` path alias.

shadcn, if it works, should be limited to button, card, textarea, label, and badge. Do not add a form library, a toast system, or an animation library.

The shell copy can say: "Pick two AI characters, give them a topic, and watch them debate." Do not imply that the debate already runs.

Delete starter-only markup from `app/page.tsx` (Next and Vercel links and images). Leave unused files in `public/` alone.

`.gitignore` stays unchanged until PRD 02.

## 6. Dependencies

- PRD 00 for product scope, and `DESIGN.md` for visual direction. Do not recreate the Next.js app.
- No runtime dependency on PRDs 02–08.

Packages this PRD may add:

- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`
- shadcn peer packages only if the CLI is used

Do not add Zod, `server-only`, or an Ollama client here.

## 7. Error and edge cases

- shadcn CLI incompatibility: fall back to local primitives. Do not block the shell on the CLI.
- `prefers-reduced-motion`: the skip link and buttons remain usable with no required animation.
- Missing font: load the faces `DESIGN.md` names. Do not add a face that file does not name.
- Build must still pass with `cacheComponents` and the other existing Next config flags untouched.

## 8. Testing strategy

- `npm test` runs the shell render test.
- `npm run lint` passes for the new files.
- `npm run build` passes.
- Manually resize the browser to about 390px and to a desktop width and confirm the heading is readable and the page does not scroll sideways. PRD 08 repeats this check on the real game screens.

No Ollama test belongs here.

## 9. Acceptance criteria

- AC-F-1. The home page shows `DebAIte` as the `h1` on the page background color recorded in `DESIGN.md`.
- AC-F-2. A keyboard user can focus the skip link and then move into `#main`.
- AC-F-3. `Button`, `Card`, `Textarea`, `Label`, and `Badge` exist under `components/ui/`.
- AC-F-4. `npm test`, `npm run lint`, and `npm run build` pass.
- AC-F-5. `next.config.ts` flags listed in PRD 00 are unchanged.
- AC-F-6. No route handler, character data, or debate engine exists yet.

## 10. Implementation tasks

1. Read the Next.js docs for the layout and CSS files you will edit.
2. Read `DESIGN.md`. If it is missing, choose the shell’s direction with Impeccable and write `DESIGN.md` before styling. Wire its color roles and type into Tailwind. Remove the starter light theme and the `prefers-color-scheme` switch.
3. Update metadata, the skip link, and the shell page.
4. Add the five UI primitives, using shadcn or the local fallback.
5. Add Vitest and `tests/shell.test.tsx`.
6. Run `npm test`, `npm run lint`, and `npm run build`.
7. Check the shell at a narrow and a desktop width.

## 11. Open questions

The shell’s palette, type, and theme are decided in `DESIGN.md`, not in this PRD. If the shadcn CLI fails, the fallback in F-16 is the decision.
