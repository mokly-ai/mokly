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
- **2026-11-24, decision 3, how Zoom in enlarges the home: H.** The
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
  - **H.** Added by Cal: D, but the zoomed home scrolls sideways, so the
    reader reaches the sides. Decision 2 had rejected sideways scrolling.
    Effort: Medium.
  - **Answer, 2026-11-24: H.** Cal wrote "maybe we allow zoom with scroll
    at the bigger than 100%?". The orchestrator reads it as H and told Cal
    so. Above 100% the home's `main` and footer frame keep the layout of
    100% at the window's width and grow with CSS `zoom`. The page then
    scrolls sideways, and only then. The tool bar and the status bar keep
    their place and size. A focused link at a side scrolls into view, so
    the focus harm of D goes away. This changes the no-sideways-scroll rule
    of site design for the zoomed home only.
  - The options check ran on 2026-11-24. Its report is
    `.context/home-zoom-pill/options-check-decision-3.md`.
- **2026-11-24, decision 4, the layout at every zoom: a pure scale.** The
  Milestone 3 site showed two problems below 100%. WebKit draws no text
  smaller than 9px under CSS `zoom`, so the zoomed-out home overlaps in
  Safari. On windows from 768px to 1439px the spread sits at the left in
  the wider room. Cal asked: "can we not just do what we do in the viewer,
  and make everything stay the same, but zoomed in?". The orchestrator
  reads it as: at every zoom the home keeps its layout of 100% at the
  window's width, and the zoom only scales it, as the viewer scales its
  frames. Nothing reflows. This replaces "at or below 100% the content
  lays out in the room that it gets". Above 100% the page still scrolls
  sideways, as decision 3 says. The options that this answer replaces:
  stop zoom out at 80% in WebKit, a transform in WebKit only, and a
  centred spread in a wide room.

## Design calls

Each call is my call, made on 2026-11-24.

- **Only the home changes.** Cal named the home page. `StatusBar.astro` draws
  the buttons on the home route only.
- **CSS `zoom`, not a scale transform.** The page height, the sticky parts,
  in-page links and focus scrolling then follow without a script. A transform
  keeps the old page height. No media query changes, so no hidden demo
  replays. The home already uses CSS `zoom` in `home-spread.css`. Decision
  4 replaces this call with a scale transform.
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
  Milestone 6 adds one: reduced motion's 1ms transitions would ease the
  scale and the heights after a press.
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
  1440px does, where the panel already sits there. Decision 4 keeps the
  place for another reason: the panel keeps its size and its place at
  every zoom.

The redraw for decision 3 added these calls, also on 2026-11-24:

- **The zoomed-in state draws 200%,** so one state shows both decision 3
  and a button at a range end.
- **Above 100% the page root grows by the zoom.** `main` keeps
  `width: 100%`, so it lays out in the window's width and grows. The tool
  bar and the status bar stick with `left` and keep the window's width.
  `100vw` was not used, because it includes a classic scrollbar. The
  Milestone 4 calls replace `main` with the three scaled parts.
- **The zoomed-in rules read `--home-zoom`,** which the page root carries
  above 100%. The rule that styles read only `--mk-*` properties protects
  the one source of tokens. The zoom is runtime state, not a token, and
  decision 3 needs any zoom value. `site-design.md` and `site-mockups.md`
  name the property. Inline widths in markup and script were rejected,
  because the script would then have to know each footer gutter.
- **After a press above 100%, the window's centre keeps its place.**
  Decision 3 is option D with a sideways scroll, and D cuts both sides
  equally. The product's buttons zoom about the stage's centre too.
- **A button at a range end shows a muted glyph, no hover fill and the
  default cursor.** The value beside it, 8% or 200%, also shows the range
  end, so the state does not rely on colour alone.

Milestone 3 added this call, also on 2026-11-24:

- **The site's page root carries `--home-zoom` at every zoom but 100%.**
  The Specs panel's sticky offset divides by it, so the panel sticks below
  the tool bar at every zoom. Only the zoomed-in class waits for a zoom
  above 100%. The static mockups need the property above 100% only.
  Milestone 6 replaces this call: the Specs panel no longer sits in a scaled
  part.

Decision 4 added these calls, also on 2026-11-24:

- **The zoom is a scale transform of the 100% layout,** not CSS `zoom`.
  A transform also scales the text in WebKit. A script sets the height and
  the width that the scaled parts take in the page, so the page scrolls to
  the scaled size.
- **The Specs panel keeps its size and its place at every zoom,** like the
  tool bar and the status bar. The viewer's panels keep their size at
  every zoom, as `docs/protocol/mokly-shell-canvas-stage.md` says. A sticky
  part also does not stick inside a transform.
- **Below 100% the scaled content sits at the centre of the window's
  width,** and the page starts at its top.

The Milestone 4 mockups added these calls, also on 2026-11-24:

- **The zoom scales three parts: the hero, the workspace and the footer
  frame.** A transform on `main` would also scale the Specs panel, which
  sits in the workspace.
- **A stage holds the Specs panel over the workspace.** The panel leaves
  the workspace and floats over it in one grid cell, the stage, and the
  workspace keeps its first column free. The panel stays between the hero
  and the frames in the reading order. A panel before or after `main` was
  rejected, because it changes the Tab order at 100%.
- **The panel's offset below the workspace's top keeps its size, 120px,**
  as the gap above the footer frame does. The panel sticks 72px below the
  window's top. Above 100% it also sticks 16px from the window's start
  while the page scrolls sideways, and it draws over the zoomed workspace,
  as the viewer's panels draw over its canvas.
- **Each part scales from its top centre.** Each part keeps its width of
  100% and sits at the centre of the page root, which is the window's
  width up to 100% and the zoom times wider above it. One origin then
  gives the centred picture below 100% and the picture that grows from the
  page's start above it.
- **The drawings scale with CSS `zoom`, not with a transform.** A static
  drawing runs no script, so it cannot give a transformed part its scaled
  height. CSS `zoom` scales the height too. Each drawn part keeps its width
  of 100%, and geometric precision keeps the glyphs' widths in scale, so
  the lines break as at 100%. In Chromium the drawings then match the
  site's transform to within 0.3% of the page height. WebKit draws no text
  smaller than 9px under CSS `zoom`, so the 41% drawing overlaps in Safari.
  The site does not.

Milestone 6 added these calls, also on 2026-11-24:

- **The script sets only the height that each part takes.** Each part's
  bottom margin is its own height times the zoom less one. The island reads
  the own height from the part's computed height, which no transform
  changes. A resize observer sets the margins again when a part's own
  height changes, as on a new window width. The page root's width and each
  part's width above 100% follow `--home-zoom` in CSS.
- **The page root carries `--home-zoom` above 100% only, again.** Only the
  zoomed-in widths read it.
- **The body and the scaled parts take no transition.** The site's
  reduced-motion rule gives every element a 1ms transition. It eased the
  scale and the margins after a press while the island read the layout, so
  the pill missed its place.
- **A measured value divides by the `scale` that draws its target:** the
  product of the `scale` of the target and of its ancestors.
- **In-page links and focus scrolling need no code.** Each engine scrolls a
  scaled target into view by its drawn box, and an anchor lands where it
  lands at 100%.

The review of 2026-11-24 added this call:

- **The home always draws the window's vertical scrollbar.** With classic
  scrollbars, a zoom out that made the page fit the window removed the
  scrollbar, widened the layout and moved the pill. A stable scrollbar
  gutter was rejected, because headless Chromium reserves its room but
  leaves it in `clientWidth`, which broke 16 site browser tests. The cost
  is an empty track on classic-scrollbar platforms while the zoomed-out
  page fits the window.

The second review of 2026-11-24 added these calls:

- **A page that a press leaves too short grows while the pill shows.** The
  page root takes a minimum height, which the footer's flexible top margin
  takes, so the pill keeps its place at the page's top scroll limit. Each
  press sets it anew from the pill's place. A pill below the window, which
  only the keyboard presses, and a shortfall under a pixel leave the page
  where its content ends, so the page never grows far past the window.
- **Above 100% the status bar's clearance gives up a classic sideways
  scrollbar's height,** which the island measures and gives the page root
  as `--home-scrollbar-height`, a second runtime property. The drawings
  set none, so the mirrored rule keeps 28px there.
- **The status bar wraps.** The people take the room that the row leaves,
  down to their narrowest, so the pill takes a second row only where the
  row cannot hold both. Each zoom button's band is centred on it and at
  least 44px in both axes, whatever width its glyph takes.
- **A size tag reads its target's offset size,** which no transform
  changes, so a size half a pixel from whole ones keeps its value at every
  zoom.

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
- [x] Draw the answer to decision 3: redraw the zoomed-in state for it,
      and draw a zoom button at a range end, which takes `aria-disabled`.

Evidence: `.context/home-zoom-pill/m1/` and `.context/home-zoom-pill/m1b/`, with the captures,
`smoke-report.json` and `zoom-measurements.txt`.

## Milestone 2: Documentation and protocol

Depends on: 1

- [x] State in `docs/protocol/cloud/site.md`, `site-chrome.md` and
      `site-design-components.md` that the home's zoom pill is a control:
      the range, the step, the names, the no-script state and that nothing
      is kept. The rest of the status bar stays a depiction.
- [x] Add the zoom to the Home section of `site-design-pages.md` and to the
      island table of `site-delivery-islands.md`.
- [x] Change the no-sideways-scroll rule of `site-design.md` for decision 3:
      the home zoomed above 100% scrolls sideways, and no other page does.
- [x] Update `apps/site/README.md` and `docs/mockups/README.md`.

## Milestone 3: The home zoom island

Tags: ui

Depends on: 2

- [x] Check first, in Chromium, WebKit and Gecko, how `vw` sizes, sticky
      offsets, `getBoundingClientRect()` and `ResizeObserver` behave under
      CSS `zoom`. Record the result in `.context/home-zoom-pill/`.
- [x] Draw the buttons on the home route in
      `apps/site/src/components/StatusBar.astro`, hidden until the island
      runs. Add their styles beside the status bar styles.
- [x] Add a pure zoom model (step, clamp, snap, percent) and a small island
      that applies CSS `zoom` to `main` and the footer frame, keeps the pill
      in place, and updates the value and the button states.
- [x] Above 100%, keep the layout of 100% and let the page scroll sideways,
      as decision 3 says. The tool bar and the status bar stay in place.
- [x] After a press above 100%, keep the window's centre in place.
- [x] Keep the Specs panel's sticky offset below the tool bar at every zoom.
- [x] Let the measurements island and the Specs spy read the layout again
      after each press.
- [x] Add a stub-page test for the model and the island, like
      `apps/site/tests/home_island.test.ts`, and a home browser spec that
      zooms out to 8% and in to 200%.
- [x] Remove the seven status lines that link this milestone, and add the
      island files to the Key Code list of the site README.
- [x] Get Cal's answer to the WebKit finding of the engine check. Under CSS
      `zoom`, WebKit draws no text smaller than 9px, so from 64% down the
      zoomed-out home overlaps in WebKit, and at 8% it is a tall, garbled
      column. Chromium and Gecko scale the text. A scale transform was
      measured as the alternative: the sticky Specs panel does not stick
      inside it in any of the three engines. Evidence:
      `.context/home-zoom-pill/m3/zoom-engines.md` and `m3/engines/`.
- [x] Get Cal's answer to the spread's place on windows from 768px to
      1439px when zoomed out. The desktop steps start the hero's spread at
      the window's gutter, so in the wider room of a zoom below 100% the
      spread sits at the window's left while the hero copy is centred.
      Evidence: `.context/home-zoom-pill/m3/smoke/home-1280-41-start.png`.
- Both answers: decision 4 replaces the layout below 100%, so neither
  finding remains. Milestones 4 to 6 build it.
- [x] Smoke-test the home at 1440px, 768px and 390px through the site dev
      server, at 8%, 100% and 200%. Save the screenshots in
      `.context/home-zoom-pill/`. The smoke ran on the preview of a build,
      which serves the production policy, in `m3/smoke/`.

## Milestone 4: Mockups for decision 4

Tags: mockup

Depends on: 3

- [x] Redraw the `zoomed-out` home state as the 100% layout, scaled to 41%
      and centred, with the Specs panel at its own size and place.
- [x] Redraw the `zoomed-in` state with the same mechanism, if the
      mechanism changes its rules, and keep the site parity checks green.
      The parity checks pass with the site sheets of Milestone 6.
- [x] Run the mockup check in `docs/mockups/README.md`. Smoke-test the
      changed pages.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show.
- The mockups and a prototype of the site showed three problems, each now
  a Milestone 6 TODO. The parity test compares the drawings' sheets with
  the site's, so the redrawn sheets pass only with the site sheets of
  Milestone 6. The drawings' zoomed-in footer frame takes a CSS `zoom`
  width, which the site's transform cannot share. Reduced motion gives
  every element a 1ms transition, which eases the scale and the heights
  after a press while the island reads the layout.

Evidence: `.context/home-zoom-pill/m4/`, with the prototype of the site in
`proto/` (`scripts/proto.mjs`), the captures, `smoke-report.json` and the
check logs.

## Milestone 5: Documentation for decision 4

Depends on: 4

- [x] Replace "at or below 100% the content lays out in the room that it
      gets" in `site-design-pages.md`, and every other doc that says it,
      with the pure scale of decision 4. Name the Specs panel's place.
- [x] Update `apps/site/README.md` and `docs/mockups/README.md`. The site
      README's Key Code entries change with the code in Milestone 6.

## Milestone 6: The home zoom as a scale

Tags: ui

Depends on: 5

- [x] Apply the zoom as a scale transform of the 100% layout at every zoom,
      with the page's scroll size set to the scaled size.
- [x] Keep the Specs panel at its own size and place at every zoom.
- [x] Keep the pill in place after each press, and the window's centre
      above 100%.
- [x] Keep the measured values in the page's own CSS px.
- [x] Update the unit tests and the browser spec, and run the spec in
      Chromium, Firefox and WebKit.
- [x] Remove CSS and code that only the CSS `zoom` approach needed.
- [x] Mirror the stage and the Specs panel rules of the mockups in the site
      sheets. Record the zoomed-in footer frame rule as a parity
      difference, because the drawings give it a CSS `zoom` width.
- [x] Keep the zoom from easing under reduced motion: the page root and
      the scaled parts take no transition.
- [x] Smoke-test the home at 1440px, 1280px, 768px and 390px at 8%, 41%,
      100% and 200%, in Chromium and WebKit. Save the screenshots in
      `.context/home-zoom-pill/m6/`.

Evidence: `.context/home-zoom-pill/m6/`, with the repeat runs
(`repeat-summary.txt`), the broken-code runs (`mutations.txt` and
`mutations-browser.txt`), `test-cost.txt`, the check logs and the smoke in
`smoke/` with `smoke-report.json`.

## Milestone 7: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5, 6

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Get Cal's answer to review finding 8, how the zoomed-out home
      mockup looks in Safari. The follow-up item
      `plans/follow-ups/safari-reflows-the-zoomed-out-home-mockup.md` holds
      it. The pull request waits for the answer.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
