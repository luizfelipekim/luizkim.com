# Theme switch via the claw machine

## Goal

On luizkim.com, every prize caught in the claw machine switches the whole site to a random
new theme, out of five, and nothing else about the site changes.

Built in sessions of under an hour, each ending in a mergeable PR. Once shipped it is not
maintained; it is for show.

## How to run a phase

1. Read this file. Find the first phase whose checkbox is empty.
2. Cut a branch from `main` with the phase's branch name. Never work on `main`.
3. Do the tasks. Meet every line under "Done when" before opening the PR.
4. Open the PR with: what changed, how to verify, screenshots. Nothing else.
5. End the session with three lines: what merged or is waiting, what the owner should check,
   what is next. Hard stop at the time box; push unfinished work with WIP in the note.
6. Do not start the next phase until the owner confirms the previous one worked.

Owner verifies by pulling the branch and opening `index.html`. No build, no server.

## Constraints

- Same HTML across themes. Markup changes allowed only in Phase 0 and Phase 1, and only the
  ones listed there.
- Plain CSS custom properties. No build step, no generator, no token JSON, no picker.
- No `localStorage`. `sessionStorage` only, so a broken theme dies with the tab.
- Every external font has a system fallback that looks deliberate on its own.
- Scripts that read tokens fall back to charcoal values, never to empty.
- Each theme sets `color-scheme`.
- Contrast: every text/background pair in a theme is at least 4.5:1, recorded in the PR.
- The 3D content (ball, claw, cards, materials) stays as it is. Only its chrome and scene
  background follow the theme. Case-page cover illustrations stay charcoal.
- Commit messages and PR descriptions mention nothing sensitive or withheld.

## Decisions already made

- Trigger: every catch. Random theme, never the current one, and no repeats until all
  six looks (five themes plus charcoal) have shown in the session.
- Transition: a full-page shutter, 250ms on, swap, 250ms off. Instant under
  `prefers-reduced-motion`. The claw's `aria-live` status line names the new theme.
- Case pages follow the theme through `sessionStorage` but get no skin work; tokens only.
- `?theme=<name>` in the URL forces a theme, for testing and screenshots.
- Fonts load on first switch. Google Fonts for Broadsheet, Windows 95, Brutalist, Casino;
  system monospace for Terminal.
- Build order by payoff: Brutalist, Windows 95, Broadsheet, Casino, Terminal.
  After each theme the owner says continue or stop. The cycle works at any count.
- Design calls are Claude's, explained in two or three lines. The owner is a design
  director and reviews with annotated screenshots; design help is available on request.

## Token set (28; 18 required)

Names stay as the site already uses them. No component layer. Hover is always a
background/ink pair, never one side alone.

| Group | Tokens | Required |
|---|---|---|
| Page | `--bg --surface --surface-2 --ink --muted --line --accent --accent-ink` | yes |
| Field | `--field --field-ink --field-muted`; `--field-accent` optional (link hover on the field) | yes |
| Hero | `--hero-bg --hero-ink --hero-a --hero-b` (last two feed the shader) | yes |
| Stage | `--stage-bg --stage-ink --stage-muted --stage-line` | no, default to page |
| Type | `--font --font-display --weight --weight-strong`, plus existing `--step-*` | yes |
| Shape | `--radius --radius-pill --border` | yes |
| Other | `--danger`; spacing and motion tokens unchanged | yes |

Areas (hero, each opener's stage, the contact field) map their family onto local
`--bg`/`--ink`/`--muted`/`--line`, so components inside them need no special rules.

## Phases

Estimates are Claude working time; owner verification is 10 to 15 minutes per phase.

### [x] 0a. Tokens in CSS. Branch `phase-0a-tokens`. 45 min

- Baseline screenshots on `main` first: 4 pages x 2 viewports (1440, 390), reduced
  motion on, stored in `Claude outputs/baseline/` (git-ignored).
- Create `css/tokens.css` with the token set. All four pages link it before any other style.
- Fix drift: `--section` differs between home and case pages; keep both, home value in
  tokens, case value as a local override in `case.css`. Drop unused `--field-surface`.
  Define `--accent-hover` or remove its use.
- Replace every hex, rgba, hardcoded weight (48 x `500`) and radius in `index.html`,
  `case.css` and the three case pages' inline styles with tokens. SVG cover fills excepted.
- Hover fix: `.button:hover` becomes `background: var(--ink); color: var(--bg)`.
- Done when: screenshot diff against baseline is zero at both viewports on all four pages,
  masking the hero canvas and the three opener canvases; the hover fix is the only
  visible difference; `grep -E '#[0-9a-f]{3,8}' index.html case.css case-*.html` returns
  only SVG fills; no `font-weight: 500` literal remains.

### [ ] 0b. Tokens in scripts. Branch `phase-0b-scripts`. 40 min

- `js/fortune-ball.js`, `js/claw-machine.js`, `js/poker-peek.js`: scene backgrounds and
  drawn textures read `--stage-*` tokens via `getComputedStyle` with charcoal fallbacks;
  each exposes a redraw on a `theme:change` event.
- Hero shader in `index.html`: `colorA`/`colorB` from `--hero-a`/`--hero-b`; updated live on
  `theme:change` via `shader.update`.
- Done when: screenshot diff zero; `grep` for hex in the three scripts returns only the
  fallback constants, each on a line marked `fallback`.

### [ ] 1. The switch. Branch `phase-1-switch`. 60 min

- `js/theme.js` in all four heads, before stylesheets, synchronous: reads `?theme=`, then
  `sessionStorage`, sets `data-theme` on `<html>` before first paint.
- `collect()` in the claw dispatches `claw:caught` with the prize type. `theme.js` listens,
  picks random-not-seen, writes `sessionStorage`, dispatches `theme:change`, runs the
  shutter, and writes the status line through the claw's existing `aria-live` element.
- Hint line on the claw machine (one sentence, markup change) saying a catch changes the
  site. It lives here, not in Phase 0, because `main` deploys live and the hint must not
  promise a feature that is not there yet.
- Placeholder theme `css/themes/placeholder.css`: magenta and lime on purpose so any element
  still charcoal is a hole. It becomes Brutalist's starting file.
- Done when: `?theme=placeholder` renders; a catch changes the theme; six catches show six
  looks with no repeat; a case page opened after a catch keeps the theme; a new tab is
  charcoal; reduced motion gives no shutter; the status line reads the theme name; no theme
  in URL or storage gives charcoal; no flash of charcoal on load.

### [ ] 2. Brutalist. Branch `theme-brutalist`. 50 min
### [ ] 3. Windows 95. Branch `theme-windows95`. 60 min
### [ ] 4. Broadsheet. Branch `theme-broadsheet`. 60 min
### [ ] 5. Casino felt. Branch `theme-casino`. 50 min
### [ ] 6. Terminal. Branch `theme-terminal`. 45 min

Each theme phase:

- Inputs: name, the 18 required tokens, optional stage tokens, font family with fallback,
  skin CSS scoped under `html[data-theme="<name>"]`. First pass only; polish is a separate
  PR on request.
- Period detail checked against one or two real images where memory is unreliable
  (Windows 95 title bar and bevels, broadsheet masthead).
- Outputs: `css/themes/<name>.css`; screenshots of home and one case page at both
  viewports; a contrast table in the PR covering body, muted, accent on bg, field pair,
  hero pair, stage pair.
- Done when: all contrast pairs at least 4.5:1; the owner has seen the screenshots; the
  fallback font stack looks deliberate with the web font blocked.

## Totals

Eight sessions, eight PRs. About 6.5 hours of Claude time, 1.5 to 2 hours of owner
verification. Stop rule applies from phase 2 onward.

## Known facts about the code (saved so no session rediscovers them)

- Claw: 15 prizes of 6 types, refills itself when empty; every catch runs `collect()` in
  `js/claw-machine.js`.
- Hardcoded colours before Phase 0: `index.html` ~27 hex plus 8 rgba; `case.css` 5;
  `case-poker.html` ~25 and `case-system.html` ~10, almost all inside SVG covers;
  `case-ai.html` defines its own `--other` and `--rule`.
- `--accent-hover` is used in `index.html` but never defined. `--field-surface` is defined
  but never used. `--step-title` exists only in `case.css`; `--ease-in-out` and
  `--ease-soft` only in `index.html`.
- Unbounded is loaded on the home page and never used.
- The poker peek vignette and the portrait mask are not themed: shadow and alpha, not chrome.
- Local `--ui-muted` in `case.css` exists because `--muted` cannot be redefined in terms of
  itself on the same element (it is a cycle and the browser drops it).
- Hero shader runs only on WebGPU browsers and exposes `update('flow', props)`.
- Google Fonts may not load from the build container; baseline and after screenshots then
  both use the fallback font, which is fine for the diff.
