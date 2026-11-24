# Home zoom pill

Status: Active. On branch `calummoore/homepage-functionality-vjxs`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Every page of the public site (`apps/site`) ends with a status bar under the
footer frame. The bar depicts the design file: its title, the people in it
and a zoom pill that reads − 100% +. Today the whole bar is a depiction: it is
hidden from assistive technology, nothing in it takes focus, and no script
runs on it. Cal asked on 2026-11-24 that the pill "should actually work on the
home page". This change makes − and + zoom the home page. Every other page
keeps the depiction. The change does not add wheel, pinch or keyboard zoom,
a reset or a Fit control, and it does not keep the zoom across visits.

## Decisions

- **2026-11-24, decision 1, where the pill is and what it zooms: A.** Cal
  chose A. The pill stays in place in the status bar at the end of the page.
  Its − and + zoom the home's `main` and its footer frame. The tool bar and
  the status bar keep their size. Option B, a pill that floats at the bottom
  of the window while the reader scrolls, lost: it costs more, it covers
  content, and it can hide a focused link.
- **2026-11-24, decision 2, the zoom range: B.** Cal chose B. The zoom runs
  from 8% to 200%. Above 100% the content gets less room than the window,
  and the canvas cuts off parts that pass the window's sides. Option A, zoom
  out only, lost: + is inactive at page load and can read as a dead control.
  Option C, zoom in with sideways scrolling, lost: it changes the
  no-sideways-scroll rule of
  [site design](../docs/protocol/cloud/site-design.md).
- Left out in the brainstorm, each because it fails the goal or breaks a
  requirement that stays: a second pill that zooms only the spread, a zoom in
  the tool bar or the Specs panel, a pan-and-zoom canvas with wheel and pinch
  zoom (it takes the browser's zoom from readers who need it), a pill that
  changes only the text size, a pill that sets the browser's zoom (no web API
  exists), no change, and removal of the pill.
- The options check of the `implementation-review` skill did not run on
  these decisions, because Cal had already answered both before the plan
  existed.

## Design calls

Each call is my call, made on 2026-11-24.

- **Only the home changes.** Cal named the home page. `StatusBar.astro` draws
  the buttons on the home route only.
- **CSS `zoom`, not a scale transform.** The page height, the sticky parts,
  in-page links and focus scrolling then follow without a script. A transform
  keeps the old page height. No media query changes, so no hidden demo
  replays. The home already uses CSS `zoom` in `home-spread.css`.
- **Steps.** Each press multiplies the zoom by 1.25 or by 0.8, the product's
  step in `packages/ui/src/canvas-stage/canvas-view.ts`. The zoom snaps to
  100% when a step lands within half a step of it. The pill shows whole
  percentages.
- **The pressed control keeps its place in the window**, so repeated presses
  land on it. The island restores the pill's distance from the window's
  bottom after each press.
- **The percentage is text, not a reset control.** The reader returns with
  the other button or a reload.
- **No shortcut keys and no gestures.** ⌘ or Ctrl with + or −, the wheel and
  a pinch stay the browser's zoom.
- **Accessibility.** On the home, the pill leaves the hidden status bar. It
  is a group named "Zoom" with native buttons named "Zoom out" and "Zoom in",
  the product's names. The value is a polite live region. A button at a
  range end takes `aria-disabled`, so it keeps focus. The value keeps one
  width, so the buttons do not move. Each button has a 44px target, the
  focus glow and a hover fill.
- **Without script, the home draws the depiction of every other page.** The
  island swaps in the buttons in the same box, so the page does not shift.
- **The zoom never animates.** Reduced motion then needs no rule.
- **The zoom works at every width**, phones included.
- **The zoom is not kept.** Each page load starts at 100%. A kept zoom would
  add a storage item to the privacy policy.
- **Measured values keep the page's CSS pixels at every zoom.** The
  measurements island and the Specs spy read the layout again after each
  press.
- **The site does not import `@mokly/ui`.** The product's pill is a React
  component with `--cv-*` styles. The home loads no React, and site styles
  read only `--mk-*` roles. The site repeats the product's step, range
  minimum and names.
- **No new visible words.**

Contract owners:

- [Site](../docs/protocol/cloud/site.md), its accessibility rules.
- [Site chrome](../docs/protocol/cloud/site-chrome.md), the status bar.
- [Site design pages](../docs/protocol/cloud/site-design-pages.md), the Home
  section.
- [Site design components](../docs/protocol/cloud/site-design-components.md).
- [Site delivery islands](../docs/protocol/cloud/site-delivery-islands.md),
  the island table.
- The [site README](../apps/site/README.md) and the
  [mockups README](../docs/mockups/README.md).

## Milestone 1: Mockups

Tags: mockup

Depends on: none

The site mockups draw the home's pill as buttons and add a home state at a
small zoom, so that Cal can review the look first.

- [ ] Draw the home's zoom pill as a group with two buttons in
      `docs/mockups/src/screens/design/site/parts/footer.tsx`. Put the new
      rules in a new sheet, because `docs/mockups/styles/site/footer.css`
      is near the length cap.
- [ ] Add a home state that shows the page at a small zoom, and one at a
      zoom above 100%.
- [ ] Let `docs/mockups/src/_tests_/design-site-chrome.test.ts` allow the
      buttons in the home's status bar only.
- [ ] Run the mockup check in `docs/mockups/README.md`. Smoke-test the
      changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] State in `docs/protocol/cloud/site.md`, `site-chrome.md` and
      `site-design-components.md` that the home's zoom pill is a control:
      the range, the step, the names, the no-script state and that nothing
      is kept. The rest of the status bar stays a depiction.
- [ ] Add the zoom to the Home section of `site-design-pages.md` and to the
      island table of `site-delivery-islands.md`.
- [ ] Update `apps/site/README.md` and `docs/mockups/README.md`.

## Milestone 3: The home zoom island

Tags: ui

Depends on: 2

- [ ] Check first, in Chromium, WebKit and Gecko, how `vw` sizes, sticky
      offsets, `getBoundingClientRect()` and `ResizeObserver` behave under
      CSS `zoom`. Record the result in `.context/home-zoom-pill/`.
- [ ] Draw the buttons on the home route in
      `apps/site/src/components/StatusBar.astro`, hidden until the island
      runs. Add their styles beside the status bar styles.
- [ ] Add a pure zoom model (step, clamp, snap, percent) and a small island
      that applies CSS `zoom` to `main` and the footer frame, keeps the pill
      in place, and updates the value and the button states.
- [ ] Keep the Specs panel's sticky offset below the tool bar at every zoom.
- [ ] Let the measurements island and the Specs spy read the layout again
      after each press.
- [ ] Add a stub-page test for the model and the island, like
      `apps/site/tests/home_island.test.ts`, and a home browser spec that
      zooms out to 8% and in to 200%.
- [ ] Smoke-test the home at 1440px, 768px and 390px through the site dev
      server, at 8%, 100% and 200%. Save the screenshots in
      `.context/home-zoom-pill/`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
