# Hidden catalogue navigation

Status: Active. On branch `calummoore/sidebar-collapse-pi9i`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

A reader on a window 900px or wider cannot hide the catalogue navigation
column. The separator stops at 192px, and `Collapse all` closes only the
sections and folders. The previews then lose at least 192px of the stage.
This change lets the reader hide the column on a wide window and bring it
back. While the column is hidden, the top-bar menu button opens it as the
same drawer that a narrow window uses. The change does not add a keyboard
shortcut, a slim rail, or a new close rule for the drawer.

Decision 1, 17 November 2026: the user chose B, "a hidden column becomes the
drawer". The alternatives were:

- A. One top-bar toggle at every width shows or hides the column in place.
  It lost because each move to another entry costs a show, a click, and a
  hide.
- C. Drag the separator past its minimum, or press Enter on it, to snap the
  column closed. It lost because readers do not find it, and the grip is
  hard to hit on a touch screen. It can come later on top of B.
- D. A slim rail with a Show button. It lost because it is a new component
  with no spec, and it still takes about 40px.
- E. A focus mode in the screen head for one entry. It lost because it
  repeats the browser frame's Expand toggle and hides search.

Design calls, all made by the agent on 17 November 2026:

- The standalone shell remembers the choice in `localStorage` under the new
  key `mokly:navigation-hidden:v1`, as it remembers the width and Details.
  The embedded viewer keeps the choice in memory only, as it does for the
  width. Reason: the same rule as the other layout preferences.
- The button is an icon button with a stroked panel-left icon at the end of
  the column head, after `Collapse all`. Its name is
  `Hide catalogue navigation` while the column shows, and
  `Show catalogue navigation` in the drawer of a hidden column. Reason: the
  word "collapse" would clash with `Collapse all`.
- The button shows only at 900px and wider. A narrow window keeps today's
  drawer and ignores the saved choice until the window is wide again.
  Reason: a narrow window already hides the column.
- While the column is hidden on a wide window, the narrow rules apply: the
  column leaves the layout, the menu button shows, the menu button opens
  the drawer, each navigation closes the drawer, and a breadcrumb folder
  opens the drawer. The drawer has no separator. Reason: one drawer, one
  set of rules.
- Hiding keeps the stored width and the folder disclosures. Showing the
  column again restores the stored width.
- Escape and a click outside do not close the drawer, as today on a narrow
  window. Reason: that is a separate change to the drawer at every width.
- No keyboard shortcut. Reason: it would be Mokly's first global key, and a
  key pressed inside a sandboxed preview never reaches the shell.
- No animation.

Design calls from the mockups of Milestone 1, all made by the agent on
17 November 2026:

- The button is a 20px muted icon control with a 14px icon, as the tag
  button of the search field is. It keeps the height of the column head. A
  link or a button fills with `--chrome-border` on hover, and its tooltip
  repeats its name. Reason: the tag button is the same kind of small icon
  control, and the head stays a quiet row.
- The column head stays on one line at the narrowest column, so
  `Collapse all` does not wrap. Reason: with Inter, 11px separate
  `CATALOGUE` and `Collapse all` at 192px, but a wide fallback font made
  `Collapse all` wrap and the head 7px taller.
- A hidden column on a wide window takes only the navigation rules of a
  narrow window. The top bar keeps its wordmark and its wide search field.
  Reason: the window still has the room.
- The drawer of a hidden column keeps the width of the narrow drawer: 82%,
  at most 20rem, so 320px on a wide window. The stored column width does not
  apply to it. Reason: one drawer, one set of rules.
- The hidden states depict Welcome, so that the stage shows the width that
  the column gives back. They are the variants `hidden` and `hidden-drawer`
  of `design/browse/states/navigation`. Reason: Shell states holds four of
  its five screens, and the drawer of a hidden column is the drawer of that
  state.
- The mobile artboards of the hidden states draw the narrow shell and the
  narrow drawer, with no show button. Reason: a narrow window ignores the
  hidden column.
- In the design catalogue, Welcome's hide button opens the hidden state, and
  the menu opens and closes the drawer of the hidden column. In that drawer,
  the Welcome row opens the hidden state, and the show button opens Welcome.
  Every other hide button is a picture. Reason: a design link opens only a
  state that the catalogue depicts.

Contract owners:

- [Shell navigation column design](../docs/protocol/mokly-shell-design-navigation.md).
- [Shell device chrome](../docs/protocol/mokly-shell-device-chrome.md#responsive-behavior).
- [Viewer selection](../docs/protocol/mokly-viewer-selection.md).
- [Shell design inventory](../docs/protocol/mokly-shell-design-inventory.md).
- The [UI package README](../packages/ui/README.md).
- The [Browse guide](../docs/guides/catalogue/browse.md).

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw the column head with the hide button, the shell with a hidden column,
and the shell with a hidden column and its drawer open, at desktop width.

- [x] Add the hide button to the column head in every existing design
      state of the column, through the shared design component.
- [x] Add a design state of the shell with a hidden column at desktop width.
      The menu button shows, and the stage takes the width of the column.
- [x] Add a design state of a hidden column with its drawer open at desktop
      width. The drawer shows `Show catalogue navigation`.
- [x] Update the shell design inventory for the new states. Keep the folder
      limit of the inventory.
- [x] Add `design/browse/states/navigation/hidden` and
      `design/browse/states/navigation/hidden-drawer` to the frozen design
      inventories of the tests: `tests/fixtures/design/inventory.json` and
      `tests/fixtures/design-library/browser-inventory.json`. Until then,
      `tests/design_catalogue.test.ts` fails "design screens match the frozen
      inventory".
- [x] Add the two states to the top-bar snapshots of the nightly design
      matrix, `top_bar_implementation` and `top_bar_shared_rules` under
      `crates/mokly-cli/tests/design_support/snapshots/`, and run
      `cargo test -p mokly-cli --features design-matrix --test design_attribution_tests`.
- [x] Run the mockup check named in `AGENTS.md`. Smoke-test the changed
      pages.
- [x] Update the design and the TODOs of this plan for each problem that
      the mockups show.

Evidence: `.context/hidden-catalogue-navigation/` holds the logs of the
mockup check, the design tests, the browser specs, and the design matrix, and
the smoke-test screenshots.

## Milestone 2: Documentation and protocol

Depends on: 1

State the hidden column as a requirement in the protocol docs and the guide.

- [ ] Update `docs/protocol/mokly-shell-design-navigation.md`: the hide
      button, its names, its icon, and that it shows only at 900px and
      wider.
- [ ] Update `docs/protocol/mokly-shell-device-chrome.md`: a hidden column
      uses the drawer rules at every width.
- [ ] Update `docs/protocol/mokly-viewer-selection.md`: the stored hidden
      state, its key, and that the embedded viewer keeps it in memory.
- [ ] Update `docs/protocol/mokly-design-links-navigation.md`: the
      destinations of Welcome's hide button, of the menu of a hidden column,
      and of the Welcome row and the show button in its drawer. Every other
      hide button is a picture.
- [ ] Update `docs/guides/catalogue/browse.md` and the UI package README.

## Milestone 3: Package components

Tags: ui

Depends on: 2

Add the button and the hidden layout to `@mokly/ui`.

- [ ] Add a panel-left icon to the package icons.
- [ ] Add the hide button to the head of `CatalogueNavigation`, with a link
      form and a picture form for static depictions, as the menu button has.
      Give the pointer and the hover fill to the link and the button only.
- [ ] Keep the column head on one line at 192px: `Collapse all` does not
      wrap.
- [ ] Add a root mark for a hidden column to the standalone and the
      embedded roots.
- [ ] Under that mark at 900px and wider, apply the drawer CSS of a narrow
      window: hide the column, show the menu button, and show the column as
      the drawer while the drawer is open. Hide the separator in the drawer.
- [ ] Add package tests for the button names, the forms, and the root mark.

## Milestone 4: Design library adopts the package button

Tags: mockup

Depends on: 3

Replace the mockup-side button of Milestone 1 with the package's button. The
plans skill keeps mockup work out of a `ui` milestone, so this work has its
own milestone.

- [ ] Make the design library's catalogue navigation and top bar render the
      package's button and hidden column. Delete the mockup-side button in
      `examples/basic/specs/design/library/chrome/catalogue-navigation-toggle.tsx`,
      its rules in `examples/basic/design-library/chrome/`, and the paragraph
      of the design library README that names it.
- [ ] Run the mockup check named in `AGENTS.md`. Smoke-test the changed
      pages.

## Milestone 5: Viewer state

Depends on: 3

Wire the hidden state through the viewer store.

- [ ] Add the hidden state to the store, read before the first render in the
      standalone shell and kept in memory in the embedded viewer.
- [ ] Save the state under `mokly:navigation-hidden:v1` in the standalone
      shell.
- [ ] Make `navigationDrawerShown` true while the column is hidden, so that
      a breadcrumb folder opens the drawer.
- [ ] Close the drawer when the reader shows the column again.
- [ ] Add viewer tests for the state, its storage, and the breadcrumb rule.
- [ ] Add a browser spec: hide the column, open the drawer with the menu
      button, open an entry, show the column, and reload.

## Milestone 6: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5

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

## Post-merge follow-up (non-blocking)

- [ ] Release Mokly, then bump `@mokly/mokly` in Conductive and check the
      hidden column in Conductive's `npm run mockups:serve`.
