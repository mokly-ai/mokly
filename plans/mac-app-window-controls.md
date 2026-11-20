# Mac app window controls in the top bar

Status: Active. The work moved from cloud PR #133 of the old `mokly-ai/mokly-cloud` repository to this repository. [PR #397](https://github.com/mokly-ai/mokly/pull/397) is open. The pull request that completes the work deletes this plan, as the `plans` skill says.

The Mac window of the desktop app keeps the native title bar. That bar shows
the page title, such as `Sign in · Mokly`, above the app's own 48px top bar,
and the user finds that it makes the app look cheap. This change hides the
native title bar on macOS. The native traffic lights then sit at the start of
the app's own top bar on every screen, as in other Mac apps. The cloud does
the whole change in the app and the shell. Only the cloud-owned parts of a top
bar move the window. On the main screen, the part of the bar that the pinned
viewer package draws, with search, does not move the window.

This change does not cover Linux, which keeps its native frame. It does not
cover Windows, which has no package yet. It does not change the open-source
viewer package, and it adds no preload script to the shell.

Contract owners:

- [Desktop bundle and origin](../docs/protocol/cloud/desktop-bundle.md), for the
  window.
- [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md), for the top bar slots.
- [Product mockups](../docs/protocol/cloud/product-mockups.md) and its
  [Mac app inventory](../docs/protocol/cloud/product-mockups-mac-app.md), for the
  drawings.
- [Desktop application](../docs/protocol/cloud/desktop-app.md), for the round trips
  of decision 2.
- The [desktop README](../apps/desktop/README.md) and the
  [app README](../apps/app/README.md).

## Decisions

### 1. Native Mac title bar looks unfinished

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `apps/desktop/src/window.ts`, where the shell creates the window.
- **Background:**
  - The shell creates the Mac window with the default native frame.
  - Electron 44.7.2 can hide the bar and keep the native lights. Its window
    controls overlay gives the page the width of the lights as the CSS value
    `env(titlebar-area-x)`.
  - A browser does not set that value, so the web app does not change. In
    full screen, Electron reports no overlay, so the space closes.
  - On the main screen, the cloud owns the leftmost slot of the viewer's top
    bar, `topBarStart`. So the cloud can keep the space for the lights itself.
  - The viewer package owns the middle of that bar, with search. The cloud
    may not style the package's own parts, so it cannot make that part a drag
    region without a Mokly release.
- **Problem:** The native bar adds a second grey bar with the page title above
  the app's own top bar. Other Mac apps put the lights inside their own top
  bar.
- **Impact if no action:** The Mac app keeps a look that the user calls cheap,
  on every screen and every launch.
- **Root question:** How does the Mac app put the traffic lights in its own
  top bar and stay easy to move?
- **Options:**
  - **A.** Hide the Mac title bar. Put the lights at the start of every app
    top bar. Make the cloud's parts of each bar a drag region. On the main
    screen, the user can move the window only from the area around the
    lights and the gaps between cloud controls. Effort: Large.
  - **B.** Do A now. Then add a documented drag region to the viewer's own top
    bar in the open-source Mokly repository, and keep its controls clickable.
    Adopt it with the next viewer release, which desktop screen previews
    already need. Until then, B behaves like A. Effort: Large.
  - **C.** Do A, and add an empty drag region at the start of the cloud's
    `topBarEnd` content in the Mac app. It takes bar width that the package's
    part leaves empty, and it has no width when the window reports no buttons.
    Its width is a tuned guess at the room that the package's part needs.
    Effort: Large.
  - **D.** Build the drag regions of A, B or C from one shared part: one marker
    class for each drag region, and one shared rule that makes every control
    inside it, and every dialog, sheet and menu surface, opt out. Effort:
    Large.
  - **E.** Open the GitHub and Stripe round trips in a second window that keeps
    the native title bar. This answers its own root question, so decision 2
    carries it. Effort: Large.
- **Left out:**
  - A cloud drag band over the whole bar, with one rule that keeps every
    button and field clickable. The package documents its 48px row, but the
    band still needs the package's own search, menu and brand to opt out, and
    the cloud may not style package parts. The repository rules say that a
    behaviour that the cloud needs from Mokly lands first in the open
    repository and a release.
  - A slim strip in the app's colours above every screen. It is still a
    separate title bar.
  - The native bar in the app's colours, or with no title. It keeps the
    separate bar.
  - No frame, with buttons that the app draws. These lose native hover, the
    zoom menu and accessibility.
  - A translucent sidebar, as in Finder. It needs a change to the viewer's
    rail and goes beyond the request.
  - No change until a Mokly release. It builds the same thing as B, but later.
- **Shared assumptions:**
  - The window keeps the native lights. Source: the task message.
  - The lights sit in the existing 48px bars. Source: the `topbar` layout
    token that every app top bar uses.
  - The shell gets no preload script. Source:
    [Desktop bundle and origin](../docs/protocol/cloud/desktop-bundle.md).
  - The cloud does not style the viewer's own bar. Source:
    [Viewer host](../docs/protocol/cloud/viewer-host.md) and the repository rules.
    The left-out drag band drops this assumption.
- **Wider fix:** None. This item adds a feature. It does not fix a class of
  defects.
- **Previous examples:** None found. No plan, follow-up item or earlier
  workspace covers the Mac title bar.
- **Recommendation:** C, with D, from the options check of 2026-11-06. The
  first recommendation was B. C makes the empty middle of the main bar move
  the window within answer A, and D makes every later control and overlay
  right by default.
- **Answer:** A, on 2026-11-06. The user asked for mockups to approve before
  the UI work. The options check found C, D and E after the answer. This plan
  builds A with D, as a design call, and asks about the round trips in
  decision 2. My call is to keep A rather than C, because C's spacer must
  guess the viewer's width and can squeeze its search in a narrow window. The
  user can still choose C.

### 2. Stripe pages in the Mac window

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Design. The options check of decision 1 found it.
- **Category:** Product bug.
- **Location:** `apps/desktop/src/navigation.ts`, whose round-trip hosts keep
  Stripe in the window.
- **Changed:** On 2026-11-18, `main` merged the desktop browser sign-in. No
  GitHub page loads in the window any more: sign-in, GitHub connection and
  App installation open on the web. So the question now covers only Stripe
  checkout and billing, the two round trips that stay.
- **Background:** Stripe checkout and the Stripe billing portal load in the
  app's own window, as the Navigation section of
  [Desktop application](../docs/protocol/cloud/desktop-app.md) requires. Their
  return goes to the public app origin, which the shell loads in the window.
  The cloud does not own these pages, so they have no drag region and do not
  keep the top-start corner clear. Stripe draws its way back to Mokly in that
  corner. The Web Setup section of the same doc already opens each GitHub trip
  on the web, and the app reads its state again when the window gets focus.
- **Problem:** With the title bar hidden, the reader cannot move the window
  during a Stripe page. The native buttons also sit over the corner where
  Stripe draws its way back.
- **Impact if no action:** Checkout and billing look broken in the Mac app. A
  click meant for Stripe's way back can close or minimize the window.
- **Root question:** How does the reader use the Stripe pages, which the cloud
  does not own, from the Mac app, whose window has no title bar?
- **Options:**
  - **A.** Record the limit: the Stripe pages show under the buttons and do
    not move the window. Effort: Small.
  - **B.** Hide the buttons while a Stripe page shows, and show them again on
    the return. Nothing covers the page. The menu still closes and minimizes
    the window, but nothing moves it during the trip. Effort: Medium.
  - **C.** Open each Stripe trip in a second window that keeps the native
    title bar. The return still loads in the main window, and the second
    window closes. This changes the Navigation section. Effort: Large.
  - **D.** Show the Stripe page in a separate view below an app-drawn 48px
    bar inside the main window. It needs C's routing, a new drawing and a
    new shell view. Effort: Large.
  - **E.** Open checkout and the billing portal on the web, as Web Setup does
    for GitHub. Each billing action opens its route on the public app origin
    as a popup, which the shell opens in the system browser, and the billing
    pane reads the plan again when the window gets focus. Stripe leaves the
    round-trip hosts. This changes the Navigation and Web Setup sections and
    the billing drawings. Effort: Medium.
  - **F.** Keep the page in the main window's own web contents, moved down by
    48px below a separate shell bar view that moves the window. It touches
    startup, the window state and the Electron smoke test, and the bar needs
    a drawing and a way back. Effort: Large.
  - **G.** Show the Stripe page in a macOS sheet below the app's own 48px bar.
    It needs C's routing, a cancel command, and a Mac check that the window
    still moves while the sheet is open. Effort: Large.
- **Left out:**
  - Styles that the shell inserts into the Stripe pages. They change
    third-party layouts that can change at any time, and they can hide those
    pages' own controls.
  - A title bar for each page. Electron cannot change the title bar style
    after it creates the window. A swap of the web contents into a framed
    window for each trip makes the window blink and leave full screen.
- **Wider fix:** E. No page that the cloud does not own then shows in the
  shell.
- **Previous examples:** The Web Setup section moved every GitHub trip to the
  web on 2026-11-18, for the same kind of reason.
- **Related:** Decision 1, same cause: answer A hides the title bar for every
  page in the window.
- **Recommendation:** E. It follows the pattern that the desktop sign-in work
  set for GitHub, and it leaves no page in the window that the cloud does not
  own. The first recommendation, from the options check of 2026-11-06, was
  also E, for GitHub and Stripe together.
- **Action:** ask the user, because the recommended option changes the
  Navigation requirement of Desktop application, and no recorded decision
  covers that change.
- **Resolved:** On 2026-11-20, `main` merged PR #405, which the user merged.
  It opens Stripe Checkout and the Customer Portal in the system browser, as
  option E proposes, and the Billing section of
  [Desktop application](../docs/protocol/cloud/desktop-app.md) now requires it.
  No page that the cloud does not own loads in the window, so the problem is
  gone, and this branch applies no answer of its own.

### 3. Package surfaces over the bar do not take clicks

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Implementation. Milestone 4 found the zoomed search on
  2026-11-06, and the options check of that day found the expanded frame.
- **Category:** Product bug.
- **Location:** `docs/mockups/styles/product/shared.css`, the rule that makes
  the cloud slots move the window.
- **Terms:**
  - **Package surface:** a part that the pinned viewer package draws over the
    page, such as its open search or an expanded preview frame.
- **Background:**
  - The cloud slots of the viewer's top bar are drag regions. Chromium
    collects drag regions in document order and ignores what is painted on
    top, so a slot stays a drag region under any surface that covers it.
  - The cloud does not style package parts, so a package surface does not opt
    out of dragging.
  - When the viewer's top bar is 560 CSS px wide or less, the package opens
    its search over the whole bar. The narrowest Mac window reaches that at
    the second zoom step, 120%.
  - An expanded preview frame sits 2.5% of the window height below the top,
    at every zoom. Its address pill and collapse control lie partly over the
    cloud slots.
  - The package's own focused skip link sits under the window buttons and
    over the start slot, so it loses presses too. Review round 1 found this
    on 2026-11-06.
- **Problem:** A press on those parts of a package surface moves the window
  instead. The Mac Window section of Desktop bundle and origin requires that
  every control over the drag area takes clicks.
- **Impact if no action:** In the Mac app, the upper part of an expanded
  frame's collapse control and address pill, and parts of the zoomed open
  search, do not take clicks. Escape still closes both.
- **Root question:** How does every package surface over the cloud's part of
  the top bar take clicks in the Mac app? The options check of 2026-11-06
  widened it from the open search alone.
- **Options:**
  - **A.** Record both limits in the Mac Window section, and check them on a
    Mac in Milestone 5. Effort: Small.
  - **B.** Make every control on the page opt out, not only the controls in
    cloud bars. This reaches the package's controls through generic
    selectors. Because Chromium applies the regions in document order, the
    opt-out wins over the start slot but loses to the end slot. Effort: Small.
  - **C.** Add a documented drag contract to the open-source viewer's top
    bar, so that its own surfaces opt out, and adopt it with the next viewer
    release. This is option B of decision 1. It misses the end slot for the
    same reason as B. Effort: Large.
  - **D.** The viewer host turns off the drag region of a cloud slot while a
    package surface covers it. After each change in the viewer root, each
    resize and each focus change, it tests points of each slot with
    `document.elementFromPoint`. It uses no package selector, and it covers
    later package surfaces too. While a surface covers the bar, the bar does
    not move the window. Effort: Medium.
  - **E.** The open-source viewer documents start, end and top insets, and
    the cloud sets them from the window controls overlay, so the package's
    bar and surfaces keep clear of the window buttons. This also removes the
    zoomed search limit of the buttons. Effort: Large.
- **Left out:**
  - Turn off the slot drag regions below 560px. Nothing would then move the
    window in that layout, and 560px is package geometry.
  - A minimum viewer width above 560 CSS px in the Mac app. It depends on
    package geometry and makes the reader scroll sideways.
  - A page zoom limit. The shell keeps the platform menu, and readers need
    zoom.
- **Wider fix:** D. It handles any package surface that covers a slot, in any
  shape, with no package selector.
- **Previous examples:** None found.
- **Related:** The design call "Zoomed search" has the same cause, and option A
  records it as a limit.
- **Recommendation:** D, my call after the options check, which kept A for the
  open search alone. The expanded frame happens at every zoom, and D fixes
  both cases inside the cloud. A best limits the work if expanded frames are
  rare in the desktop app.
- **Action:** ask the user, because D adds behaviour at the viewer host that
  no requirement covers, and A records an exception to a requirement.
- **Answer:** D, on 2026-11-18.

## Design calls

These are my calls, made on 2026-11-06.

- **Mac only.** Linux keeps its native frame, because the request names the
  Mac and Linux desktops draw their own frames.
- **Electron options.** On macOS the window uses `titleBarStyle: "hidden"`,
  a `trafficLightPosition` that centres the lights in the 48px bar, and
  `titleBarOverlay` with a 48px height. These options need no preload. The
  overlay gives the page the inset, and Electron 44.7.2 reports no overlay in
  full screen, so the inset closes there. The vertical position is half of 48
  less the button height, which centres the lights.
- **One inset value.** Every top bar takes its start inset from
  `env(titlebar-area-x, 0px)`. The value is zero in a browser and on Linux,
  so only the Mac app changes. The bars are the viewer's `topBarStart` slot
  content, the viewer's loading bar, the account header and the compact
  settings layer bar.
- **One light position.** Every app top bar is 48px high, so one position
  fits every screen. The exact position is tuned on a Mac in Milestone 5.
- **Drag regions.** One shared rule makes each cloud-owned part of a top bar
  a drag region by its class: the viewer's slots, the fallback and loading
  bars, the account header, the compact settings bar and the 48px band at the
  top of a screen with no top bar, such as Not found. One shared rule makes
  every control inside them, and every dialog, sheet and menu surface, opt
  out. So a later control or overlay takes clicks without an opt-out of its
  own. This is option D of decision 1. Without the native bar, a screen with
  no drag region cannot move the window. The rules and the check of decision
  3 list the classes separately, and
  `plans/follow-ups/drag-area-list-has-four-copies.md` replaces them with one
  marker class.
- **Overlays.** The drag regions stay on while a dialog or a menu is open, so
  the window still moves from the parts of the bar that the overlay leaves
  free. The overlay surfaces opt out, so their controls take clicks where
  they cover a bar, as the top of the settings dialog does in a short
  window. The native lights stay above every overlay, because macOS draws
  them above the page.
- **Right-to-left.** In a right-to-left locale, Electron puts the lights at
  the end edge and reports no start inset. Each bar also takes an end inset
  from the overlay's width, so its end stays clear.
- **Zoomed search.** At a high page zoom in a narrow window, the viewer's open
  compact search covers its whole row, under the lights. The cloud cannot
  inset that package surface. Decision 3 asks how package surfaces over the
  bar behave, and its option A records this limit.
- **Window titles.** The page titles stay. They still name the window in the
  Window menu and in Mission Control.
- **Mockup placement.** Each Mac drawing is a situation of the screen that it
  draws, with the slug `mac-app`, as the existing bar situations are. This
  keeps each drawing beside its owner and its app-source mapping.
- **Mockup viewports.** The desktop drawing is a wide window. The mobile
  drawing is a narrow window, because the window can be 640px wide, below the
  768px breakpoint, so a narrow window shows the compact composition.
- **Mockup scope.** The drawings are the main screen, sign-in, and settings.
  Every other screen with a top bar uses one of these compositions. A screen
  with no top bar only gains an empty band at its top, and the full-screen
  window looks the same as in a browser, so neither gets a drawing.
- **Light drawing.** A registered illustration draws the three lights as
  decorative shapes in the native macOS colours. The colours are illustration
  tokens, as the art tile colours are.
- **Actions.** This session runs the docs and mockup milestones. The models
  table gives both to Claude Opus 5.5 at max effort, which this session runs.
- **Mockup inventory.** The three drawings have their own inventory page,
  [Mac app](../docs/protocol/cloud/product-mockups-mac-app.md), because the viewer
  inventory and the catalogue contract already pass the protocol doc length
  target.

These calls come from the drawings, made on 2026-11-06.

- **Shared styles.** The inset rules live in the shared product stylesheets,
  which the app copies. So the app's top bars take the inset without a markup
  change, and the browser app does not change, because the value is zero
  there.
- **Compact settings bar.** The narrow window's settings bar was 60px high, so
  the lights sat 6px above its controls. In the Mac app the bar is 48px high:
  the inset takes its vertical padding. A phone keeps its 60px bar. With the
  inset and enlarged text, the brand moves to a second row.
- **Compact viewer bar.** The compact slot start had no padding of its own, so
  it takes the whole inset.
- **Skip link.** The focused skip link starts after the lights.
- **Full-bar switch.** The full bar still switches at 87rem. In the Mac app the
  inset shortens the variable labels at that width, and the fixed actions keep
  their place, as [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md) requires.
- **Pinned top areas.** Review round 1 found that a page scroll takes the
  account header out of the window, and with it the only area that moves the
  window. Where the window reports its buttons, the account header, the band
  and the viewer's fallback and loading bars stay at the top while the page
  scrolls, and draw the page's background only once content is under them, so
  each screen keeps its approved look at rest. The insets are registered
  lengths, so a container style query gates the rule, and a browser keeps its
  layout byte for byte.
- **Covered drag areas.** Made on 2026-11-18, after answer D of decision 3.
  The check runs for every cloud drag area, not only the viewer's slots, so
  the one mechanism also lets the focused skip link take presses, which was
  review finding 2. It runs only while the window reports its buttons, so a
  browser does no work. In full screen the window reports no buttons, so the
  check stops, and Electron treats the whole window as page there, so a cover
  takes presses without it. A cover counts only when it is a part that the
  viewer package draws or a skip link, so a cloud dialog or menu keeps the
  area moving the window, as the Mac Window section requires.
- **Drawn position.** The drawings put the lights 17px in, 12px wide and 8px
  apart, with an 86px inset. These values estimate Electron's position, and
  Milestone 5 tunes them on a Mac.

## Milestone 1: Documentation and protocol

Depends on: none

The protocol docs state the Mac window requirements and the decision in
force, so that the mockups and the code follow them.

- [x] Add a Mac window section to
      [Desktop bundle and origin](../docs/protocol/cloud/desktop-bundle.md): no
      native title bar on macOS, the native lights centred at the start of
      every top bar, a drag region on every screen with clickable controls,
      the inset closed in full screen, the native frame on Linux, and the
      page titles. Give the decision in force with its rejected alternatives.
- [x] State in [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md) that the
      `topBarStart` content starts after the window controls in the Mac app,
      and that only the cloud's slot content moves the window there.
- [x] Run `cargo xtask markdown-links`, `cargo xtask prettier` and
      `cargo xtask whitespace`.

## Milestone 2: Mockups

Tags: mockup

Depends on: 1

The catalogue draws the Mac app's top bars for review. The user approves the
drawings before any UI work starts.

- [x] Register the `design/window-controls` illustration. Add the three
      light colours as tokens, and list them in
      [Design tokens: colour](../docs/protocol/cloud/design-tokens-color.md).
- [x] Add the inset to the shared product stylesheets: the viewer's slot start
      in both compositions, the cloud fallback bar, the viewer's loading bar,
      the compact settings bar and the skip link.
- [x] Draw `product/viewer/standalone/mac-app`: the ready viewer in a wide
      window and a narrow window, with the lights before the cloud's slot
      content.
- [x] Draw `product/account/sign-in/mac-app`: the account header with the
      lights at its start.
- [x] Draw `product/settings/sections/mac-app`: the dialog over the stage in a
      wide window, with the lights above the backdrop, and the settings layer
      in a narrow window, with the lights before its bar control.
- [x] Record the three drawings in the
      [Mac app inventory](../docs/protocol/cloud/product-mockups-mac-app.md), the
      situation declarations, the app owners and the catalogue counts. The
      settings drawing declares one sentence, because its pane draws no
      button label.
- [x] Link each Mac drawing to the other two below its screen.
- [x] Run `npm run mockups:build`, `npm run mockups:check`,
      `npm run mockups:test`, `npm run mockups:typecheck` and `npm run lint`.
      Open every changed page from disk and save screenshots under
      `.context/mac-app-window-controls/`.
- [x] The user approves the Mac drawings. On 2026-11-06 the user asked to
      implement every milestone, which approves the drawings as drawn.
- [x] Update the design and the TODOs of this plan for each problem that the
      drawings show.

## Milestone 3: Mac window in the shell

Depends on: 2

The shell creates the Mac window without the native title bar.

- [x] Give the macOS window the Electron options of the design calls, and
      keep the Linux window unchanged.
- [x] Apply the answer of decision 2 to the Stripe pages. PR #405 on `main`
      opens every Stripe page in the system browser, so nothing is left to do.
- [x] Test the window options for macOS and Linux in the window logic tests.
- [x] Add the Mac window to the responsibilities and the key code of the
      desktop README.

## Milestone 4: Top bars in the app

Tags: ui

Depends on: 2

Every app top bar keeps the space for the lights and moves the window in the
Mac app. The browser app does not change.

- [x] Add the drag styles to the shared product stylesheets: one marker class
      for each cloud-owned drag region, and one shared rule that makes every
      control inside it, and every dialog, sheet and menu surface, opt out.
- [x] Give each top bar an end inset from the overlay's width, for a
      right-to-left locale.
- [x] Give Not found and every other screen with no top bar a draggable band
      at its top.
- [x] Confirm that the viewer's slot content, the viewer's loading bar, the
      account header and the compact settings bar take the inset and the drag
      region, and that the full bar shows no overlap at its switch width.
- [x] Add browser tests: the inset is zero in a browser, each top bar is a drag
      region, and each control in it opts out.
- [x] Update the [app README](../apps/app/README.md).

## Milestone 5: Mac verification

Depends on: 3, 4

A Mac proves the window, because this Linux workspace cannot run macOS and
browser test clicks do not pass through the macOS window layer.

- [x] Save a screenshot of the top bar in the macOS packaged smoke run, as
      part of its launch evidence. The smoke also asserts the window controls
      overlay and the start inset on both platforms.
- [ ] The user checks the packaged app on a Mac: the lights are centred, the
      cloud parts move the window, a double click zooms, full screen closes
      the space, and a dialog and a narrow window keep the lights clear.
- [ ] Check a right-to-left locale, and a high page zoom with the viewer's
      compact search open in the narrowest window.
- [ ] Check that the window still moves from a bar while a dialog or a menu
      is open, that tooltips show inside a drag region, that a press on the
      focused skip link works, and that the Linux window ignores the drag
      regions.
- [x] Tune the light position from that check, and move the drawn position to
      match it. The packaged smoke of 2026-11-06 on a macOS 15 runner reported
      an 86px inset, and its window capture puts the close button 17px in and
      centred within half a pixel, as drawn, so neither needs a change.
- [ ] Raise a decision if a double click on a drag region does not follow the
      macOS title bar setting.
- [ ] Check that an expanded preview frame, the open compact search and the
      focused skip link take presses where they cover a top bar, and that
      the bar moves the window again when they close.

## Milestone 6: Verification, commit, review, and pull request

Depends on: every other milestone

- [x] Run the targeted tests and the complete gate, `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report. Round 1 found two findings: the first is fixed, and
      the second is a follow-up item. Round 2 found none.
- [x] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds. The user asked for every
      task, so PR #133 is open while decisions 2 and 3 and the Mac checks
      wait, and the plan stays until they are done.

## Milestone 7: Package surfaces over the bar

Tags: ui

Depends on: 4

Decision 3, answer D: a drag area that something else covers stops moving
the window until the cover goes, so the cover takes presses.

- [x] State in the Mac Window section of
      [Desktop bundle and origin](../docs/protocol/cloud/desktop-bundle.md) that a
      covered part of the top area does not move the window, so what covers
      it takes presses.
- [x] While the window reports its buttons, check each cloud drag area after
      each change of the page, each resize, scroll and focus change, with
      `document.elementFromPoint` at points across it, and turn the drag off
      for an area that another element covers. Use no package selector.
- [x] Add browser tests: an expanded preview frame, the open compact search
      at a narrow width and the focused skip link each turn the covered area
      off, the area moves the window again when the cover goes, and a browser
      without the buttons runs no check.
- [x] Delete `plans/follow-ups/mac-skip-link-loses-presses.md`, because the
      check fixes review finding 2.
- [x] Update the [app README](../apps/app/README.md).

## Milestone 8: Verification, review, and pull request update

Depends on: 7

- [x] Run the targeted tests and the complete gate, `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report. Round 3 found that page zoom left the native buttons
      off centre, which is fixed, and its blocked wider fix is a follow-up
      item. Round 4 found none.
- [x] Update the pull request description with decision 3, its answer and
      the follow-up items.

## Milestone 9: Move to the combined repository

Depends on: 8

Mokly Cloud moved into this repository in PR #350, as one squashed import
commit. Cloud PR #133 closed for the move, so the branch moves here at the
combined paths of [Repository layout](../docs/protocol/repository-layout.md).

- [x] Apply the branch's changes at the combined paths: `ts/tokens` to
      `packages/tokens`, every other `ts/` project to `apps/`, and the cloud
      protocol pages to `docs/protocol/cloud`. Keep both sides of each
      conflict, and add the inventory entries to the owner and situation
      files that `main` split.
- [x] Drop the home page Lighthouse item, because
      `plans/follow-ups/flaky-site-lighthouse-performance.md` on `main`
      already records the same problem, and PR #398 owns that item.
- [x] Run the targeted tests and the complete gate, `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report. Round 5 found none.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [x] Open the pull request in this repository. Its description gives the
      decisions and the design calls of this plan with their dates, a
      permalink to this plan, and the follow-up items that the change adds.
