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
- **2026-11-24, decision 3, how Zoom in enlarges the home: open.** The
  Milestone 1 mockups show a problem with decision 2. CSS `zoom` lays the
  content out in the window's width divided by the zoom, but the window
  still picks the composition. Above 100% the frames column then gets less
  room than its composition expects, beside the Specs panel. On screen, at
  125% the Edit module's copy is 16px wide on a 1280px window and 96px wide
  on a 1366px window. At 156% on a 1440px window the Edit artboard covers
  the Edit heading and copy, and the hero heading passes its selection and
  the window. At 200% the open foundation's code panel is 8px wide, and the
  page grows from 6,800px to 38,900px. On a 390px phone the room is 250px
  at 156% and 195px at 200%, and the footer links break inside words.
  - Root question: how does Zoom in enlarge the home, so that the page
    stays whole and readable without sideways scrolling?
  - **A.** Change nothing. Keep 8% to 200%, with the broken layout above
    100%. This fails the goal, and the options check keeps it for the
    record. Effort: Small.
  - **B.** Zoom out only: the range becomes 8% to 100%. Zoom out gives the
    page more room, and the mockups show that it holds at 8%, 26% and 41%.
    Zoom in starts inactive, the reason that decision 2 rejected this
    option. Effort: Small.
  - **C.** Stop Zoom in at 125%, one press from 100%. Above 100% the Specs
    panel leaves, and the hero heading's size follows the room that the
    zoom leaves. With the panel gone, the mockups show that one press holds
    on desktop windows from 800px to 1440px. Without the heading change,
    the heading passes its selection on windows up to about 1470px and
    passes the window of a 320px phone. Effort: Medium.
  - **D.** Enlarge without a new layout: above 100% the content keeps its
    width at 100%, and the canvas cuts off both sides equally. The layout
    stays whole, but text at the sides goes out of reach: a tenth of the
    width on each side at 125% and a quarter at 200%, with the Specs panel
    and the hero actions. Links out of view still take focus, the harm for
    which decision 1 rejected the floating pill. Effort: Medium.
  - **E.** Let each home part follow the room that it gets, with container
    queries, down to 160px, the room of a 320px phone at 200%. Decision 2
    stays as it is, but every part of the home changes in the mockups and
    in the site. The mockups and the site must first write the phone split
    in one form, because `design-site-containers.test.ts` compares each
    container query. Effort: Large.
  - **F.** Added by the options check: the room picks the composition from
    the compositions that exist. The zoomed `main` and the footer frame
    become size containers, and each desktop step and `vw` size of the home
    and the footer uses them. The phone and desktop split stays on the
    window. Zoom in stops at 200%, or earlier at the narrowest room that
    holds: 640px on desktop and 288px on phones. Windows from 1280px reach
    200%, a 1024px window reaches 156%, phones from 360px get one press, and
    320px phones get none. About 44 step queries and 47 `vw` sizes change in
    the mockups and the site. Effort: Large.
  - **G.** Added by the options check: C, with a zoom-in end that grows with
    the window, read from measured bands of window widths. Only windows
    wider than about 1650px go past 125%. A later change to a home part can
    break a band, and each band needs a drawn state and a test. Effort:
    Medium.
  - Shared assumptions: the zoom uses CSS `zoom`, the design call below. Its
    reason "no media query changes" causes this problem, but each option
    that drops CSS `zoom` stays left out. The page never scrolls sideways, a
    rule of site design that decision 2 keeps. The window picks the
    composition, a rule of site design that C drops for the Specs panel and
    the heading, and E and F drop for every part. One zoom-in end serves
    every window, which F and G drop. Zoom out stays as the mockups draw
    it.
  - Left out: sideways scrolling, which decision 2 rejected, and a pan of
    D's cut-off sides, which is sideways scrolling by other means. A scale
    transform, because D gives the same picture and keeps the page height
    right. A script that sets the steps from the room, and the phone
    composition at every zoom above 100%, because F is better on every
    point. Zoom in that enlarges only the text, which fails the goal.
  - Recommendation: **D**, changed by the orchestrator from the first
    recommendation, C. Decision 2 already accepted that zoom above 100%
    cuts off the sides, and D keeps the layout whole up to 200%. C keeps
    one press only, which changes the range of decision 2. F best protects
    the codebase and keeps 200% on windows from 1280px, at Large effort.
  - Wider fix: F. At each zoom it shows a composition that the site already
    draws for that room, so a later change to a part holds at every zoom.
  - Waits for the answer: the last Milestone 1 TODO, Milestone 2 and
    Milestone 3.
  - The options check ran on 2026-11-24. Its report is
    `.context/home-zoom-pill/options-check-decision-3.md`.

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

The Milestone 1 mockups added these calls, also on 2026-11-24:

- **The home's pill keeps the box of the depicted pill at every text
  size.** Its padding and gaps give up what the buttons' padding adds, so
  the island's swap moves nothing. Each button is drawn 22px by 28px at
  the 16px base and reaches 44px through a transparent band. Hover fills a
  button with the canvas and turns its glyph to ink. Focus draws the shared
  glow, which a 5px gap keeps off the value.
- **The buttons draw no boundary and no tooltip.** The glyph names each
  button, as on the menu control, and a `title` adds visible words.
- **The gap above the footer frame keeps its size.** The zoom applies to
  the frame, and the gap is the footer's padding around it.
- **At small zooms the Specs panel keeps its place at the window's
  start.** Zoom out gives the content more room, as a window wider than
  1440px does, where the panel already sits there.

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

- [x] Draw the home's zoom pill as a group with two buttons in
      `docs/mockups/src/screens/design/site/parts/footer.tsx`. Put the new
      rules in a new sheet, because `docs/mockups/styles/site/footer.css`
      is near the length cap.
- [x] Add a home state that shows the page at a small zoom, and one at a
      zoom above 100%.
- [x] Let `docs/mockups/src/_tests_/design-site-chrome.test.ts` allow the
      buttons in the home's status bar only.
- [x] Run the mockup check in `docs/mockups/README.md`. Smoke-test the
      changed pages.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show.
- [ ] Draw the answer to decision 3: redraw the zoomed-in state for it,
      and draw a zoom button at a range end, which takes `aria-disabled`.

Evidence: `.context/home-zoom-pill/m1/`, with the captures,
`smoke-report.json` and `zoom-measurements.txt`.

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
