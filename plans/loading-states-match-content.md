# Loading states match their content

Status: Active. [PR #131](https://github.com/mokly-ai/mokly-cloud/pull/131)
of the old `mokly-ai/mokly-cloud` repository merged the completed milestones on
2026-11-06, and this repository holds that code. No branch and no pull request
of this repository holds the remaining work yet. The pull request that
completes the work deletes this plan, as the `plans` skill says. The plan
stays until decisions 4 and 5 are answered and applied.

The app shows a loading state while it waits for the API. Every wait draws one
shared block: `Pending` in `apps/app/src/components/page-parts.tsx`. The block is
a visible label line over a card with three placeholder bars. The mockup
catalogue draws the same block through
`docs/mockups/src/screens/product/page-parts.tsx`. The block does not depend on
the content that it stands for, so the content jumps when the answer arrives.
Forms also insert the block next to their control while a write runs. The slug
suggestion inserts it under the address on every keystroke.

Measured on 2026-11-04 at 1280×900 against the local API. During each
suggestion read, the create-workspace panel grows from 555 to 699 px and its
button moves down 86 px. The install step's wait is 328 px, but the loaded step
is 477 px. The session read draws a bare 206 px card with no header and no
title. The evidence is in `.context/skeleton-shapes/`.

This change makes every wait draw the layout that it waits for. The wait uses
the same shared parts, with placeholders only where the answer supplies
content. A write shows its wait on its own control and inserts nothing. It
adds no API change, no Rust change and no migration. Decisions 4 and 5 are
open again, because the options check found options that the user did not
see.

## Decisions

Cal answered each decision on 2026-11-04. The options check of the same day
added options. Its report is in
`.context/loading-states-match-content/options-check-report.md`.

1. **How a screen looks while it waits for data.** Chosen: **C**. Each shared
   part gets a placeholder form at its real size: field, facts row, button,
   state card, and table and list rows. Each screen draws its wait with its own
   layout and these parts. Known text shows at once. The mockups change first,
   then the app.
   - Reason: only shared parts keep the wait and the loaded screen the same
     shape when screens change.
   - Rejected: **A**, a few shape presets in `Pending`. The fit stays
     approximate, so smaller jumps remain. **B**, a hand-drawn skeleton for
     each wait. Each screen then has two layouts that drift apart.
   - Added by the check: **D**, the screen's own component draws with each
     missing value as a placeholder. **E**, each row part draws its own frame
     with bars, in place of the Firna loading rows. The design takes E and a
     narrower form of D as design calls inside C, because both keep the user's
     choice and only fix how C reaches the real size.
   - Left out: keep the bars and reserve the loaded height, because the bars
     still do not look like the content and fixed heights drift. Show nothing
     for the first few hundred milliseconds, because slow networks still jump
     and a blank wait names nothing. Keep the previous screen until the next
     one is ready, because the first load still needs a wait and loading must
     keep its landmark. Animate height changes, because the content still
     moves. Draw stand-in values under a mask, because it breaks the real-data
     rule.
2. **How a form shows that its write is running.** Chosen: **A**. The control
   that was pressed carries the wait: its working word, the `busy` spinner of
   the `@firna/ui` Button, and a status for screen readers. The form inserts
   nothing. The install step keeps Install on GitHub, which reads
   "Installing…".
   - Reason: `docs/protocol/cloud/settings-dialog.md` already says that the control
     names the operation, so the inserted block adds nothing.
   - Rejected: **B**, one status line under every control, empty at rest.
     Every form then carries an empty line.
   - Added by the check: **C**, one control bound to its write. **D**, a write
     that leaves the page stays busy until the page unloads. The design takes
     both as design calls inside A, because they keep the user's choice.
   - Left out: change nothing, because it fails the goal. Draw the block over
     the form, because it hides what the reader typed. A lint against a block
     next to a control, because C removes the case by structure.
   - This answers the open follow-up
     `plans/follow-ups/install-step-hides-control-while-working.md`. Its
     option B with no pending line above the control is the chosen design.
3. **Where a wait names its operation.** Chosen: **B**. The name shows in a
   text place that the loaded layout already has, such as the line under the
   title or the field that waits. Where no such place exists, the name is for
   screen readers only.
   - Reason: sighted readers still see what the screen waits for, and nothing
     moves.
   - Rejected: **A**, a name for screen readers only on every screen.
   - Added by the check: **C**, the name only in a place that the answer
     fills, never in place of known text. The design keeps B and takes C's
     limit as a design call: a text place holds the name only when the answer
     decides that place's text.
   - Left out: the visible line above the placeholders, because it goes away
     when the answer arrives. The tab title and a label over the
     placeholders, because neither is a place of the loaded layout.
4. **A check that waits keep their geometry.** Open again. Answered: **A**,
   add no geometry test and review the mockup drawings in each change.
   - Rejected at the answer: **B**, a browser spec that holds each read and
     write and checks that the title, the primary control and the panel edges
     stay within 1 px at 1280 and 390 px.
   - Added by the check: **C**, regression tests for the measured defects
     only. Recommendation after the check: **C**, in place of B. The `testing`
     skill asks for a failing test for each defect that a change fixes.
   - Waits for the answer: the test TODOs of Milestones 3 and 4.
5. **Where the account panel sits.** Open again. Answered: **A**, keep the
   centered panel that `docs/protocol/cloud/folio-chrome-account.md` requires.
   - Rejected at the answer: **B**, a fixed top on desktop for every account
     screen. Short panels would sit high.
   - Added by the check: **C**, center each screen's panel when it first
     draws, then hold its top. **D**, a fixed top on desktop for the three
     setup steps only. Recommendation after the check: **D**, in place of B.
   - Waits for the answer: the account panel TODOs of Milestones 1 and 2.

## Design

### Rules for a wait

The documentation milestone writes these rules as requirements.

- A wait draws the layout that it waits for. Known text renders as text: the
  title, labels, section headings, the steps strip, and links whose targets
  are known.
- A part whose content the answer supplies draws its placeholder form at its
  own size.
- The wait names its operation once, in a text place that the loaded layout
  already has, or for screen readers only. It never adds a line that the
  loaded layout does not have. The waiting region sets `aria-busy`.
- A layout that depends on the answer draws its most common form.
- A write keeps its form. The pressed control shows its working word and the
  busy spinner, and it refuses a second press until the write is done. A
  write that leaves the page is done when the page leaves. A screen reader
  hears the operation. The form inserts nothing.

### Parts

- App: a new module `apps/app/src/components/placeholders.tsx` holds the
  placeholder forms. `page-parts.tsx` is near its length target, so the parts
  do not go there.
- Mockups: a new module `docs/mockups/src/screens/product/placeholders.tsx`
  holds the same forms. The registered `design/skeleton` draws them as its
  variants, in place of the three bars.
- `Pending` becomes the waiting region. It takes the operation's name and the
  layout to draw. It sets `aria-busy`, and it renders the name once. The name
  keeps the `fo-pending-label` class, so the pending-label parity checks and
  the document policies keep reading it.
- `Action` in the app takes the write that it sends and derives `busy` from
  the write's `working`. The registered mockup Button gets `busy`. This keeps
  the `derive-disabled-from-write` rule intact.

### Design calls

Each call is mine, made on 2026-11-04. The calls marked "check" take an
option or a problem from the options check.

- Each screen's loaded drawing and its wait render one layout component. The
  screen passes its real parts, and its wait passes placeholder parts. The
  session read, the route's read and the screen's own reads all draw that
  wait. `RequireSession`, `WorkspaceRoute`, `ProjectRoute` and `PaneResource`
  take it. Reason: the wait cannot drift from the screen, and no hook has to
  accept a missing answer, which the full D of decision 1 needs. Check.
- The placeholder forms reuse the part's own frame, so the size is exact by
  construction:
  - A field draws its label and its own frame, read-only. The frame holds a
    bar, or the operation's name when the field is the place that names it.
  - A control whose label is known draws itself, disabled. A control whose
    label or presence the answer decides draws a placeholder over its own
    frame.
  - A facts row draws its label and a value bar of one text line.
  - A list row or a table row draws its own row frame, with bars in place of
    its text. Check: the Firna loading rows have other heights than the
    app's `ContentList`, member, note and table rows.
  - A heading that the answer decides draws a bar of the heading's line
    height.
  - A state card draws its glyph tile, its line and its action as
    placeholders, and the operation's name in its title.
    Reason: no height is copied from `@firna/ui`, so nothing drifts when the
    package changes.
- A layout that depends on the answer draws its most common form. A
  role-dependent step draws the owner's and the admin's form, because the
  person who creates a workspace owns it.
- A list is the one exception to the most-common-form rule. It draws one
  placeholder row, also a list that can be empty. Text that only a non-empty
  list shows, such as the Active tokens heading, draws as a bar. Reason: a
  list's count is unknown, and growth below the row moves nothing above it.
  Check.
- A text place holds the operation's name only when the answer decides that
  place's text. Known text keeps its place. A visible name never repeats the
  heading. Reason: this keeps decision 3 B and the rule that known text
  renders as text. Check.
- While a read runs, every control in its region draws its placeholder form,
  also a control that does not need the answer. Reason: a failed read then
  removes no text that the reader typed, and a failed pane still says so
  where the pane would be.
- A wait draws the line "Publish with the CLI instead" as text with no link,
  because its target needs the workspace's slug. Reason: known text renders
  as text. Check.
- The address suggestion shows "Finding an available address…" in the
  address line under the slug field, in place of the address. The form
  inserts nothing and the read gets no debounce. Reason: the requirement puts
  the label next to the field, the line keeps its height, and a debounce
  would change when the API is read. Check.
- A landing and a resolver draw the account frame with their title over one
  state card placeholder. The landings are the email, GitHub and preview
  callbacks, the GitHub install return and the invitation. The resolvers are
  `/dashboard` and the UUID permalinks. Where the title already names the
  operation, the name is for screen readers only and the card's title draws a
  bar. Reason: success replaces the route, and a visible name must not repeat
  the heading. Check.
- While `RequireSession` sends a signed-out reader to sign in, it draws the
  sign-in screen's wait. Reason: sign-in is the next screen, and the reader
  cannot open the destination yet. Check.
- `Action` takes the write that it sends. It derives `busy` and the
  screen-reader status from the write's `working`. Reason: no call site sets
  `busy` by hand, and `disabled` still reads `.disabled` under the
  `derive-disabled-from-write` rule. Check.
- A busy `Action` stays enabled: `busy` refuses the press, and `disabled`
  applies only while the control is not busy. Reason: the protocol keeps
  focus on a busy control, and a disabled button drops it. Found by
  Milestone 2.
- The GitHub callback and GitHub install landings each get a drawing of their
  wait in the callback folder, and the drawing table lists them. Reason: the
  app draws these waits, and the catalogue must draw each wait that the app
  draws. Found by Milestone 2.
- A write that leaves the page for GitHub or Stripe keeps its control busy
  until the page unloads. A page that the browser restores from its
  back-forward cache returns the control to rest. Reason: the control refuses
  a second press until the write is done, and these writes end with the page
  change. Check.
- A write that leaves the page leaves only while its screen is still shown.
  Reason: Back and the CLI line stay on the install step during its write,
  and a reader who used them must not land on GitHub. Check.
- The Automatic builds switch shows "Saving…" in its own row, beside its
  label, and is disabled while it saves. Reason: the settings protocol asks a
  pending control to name its operation, and the switch has no working word.
  Check.
- While the settings scope loads, the rail draws the sections that the
  address's scope gives an owner. The pane draws the requested pane's wait.
  Reason: the pane is known from the address, and an owner sees every
  section.
- The settings dialog stays centered. Reason: exact waits remove the measured
  32 px move, and decision 5 covers the account panel only. Check.
- The viewer route's project read draws the cloud frame: the bar's cloud
  controls as placeholders over the stage's waiting card. Reason: the package
  viewer appears only when a publication is ready, so the cloud frame is the
  layout that the reader sees first.
- Found by Milestone 4: `Action` takes `write` and `operation` as one typed
  pair and reads `write.working`, so `disabled` at a call site still reads
  `.disabled`. The leaving state lives in `useLeavePage`, which `useWrite` and
  the GitHub install landing use. A write that leaves runs no `done`. A screen
  counts as shown while it is mounted, also under the settings dialog. A
  screen that unmounts while its page leaves cancels the trip with
  `window.stop()` in a layout cleanup, before the next screen starts its
  reads, so the reader stays where they went. A
  restored GitHub install landing shows its missing-input recovery, because
  its one-use input is spent. A leave that the desktop shell cancels keeps the
  control busy until a reload, because production leaves only for GitHub and
  Stripe. The browser tests answer each trip to GitHub with 204 No Content and
  send a synthetic `pageshow`, because a leaving page defers every read and
  Playwright's Chromium runs without the back-forward cache. The GitHub writes
  of sign in, sign up and the connect situation get drawings, so the parity
  checks read their names.
- Found by the review fixes: the write-failure frame stays one element at
  rest (`display: contents`), refused and during a retry, so a control keeps
  its focus. The settings waits take an unknown session, so the compact layer
  and the desktop dialog draw from the session read on. A durable settings
  route on a wide surface draws the dialog's wait until it hands over, and it
  hands over only while it is still shown. The wide route's wait draws the project's
  panes on every route, so its rail does not grow at the hand-over (the user
  may change this: `plans/follow-ups/route-wait-rail-scope.md`), and an entry
  whose address the route does not know yet draws disabled with no link. `paneRoute` returns no address for a pane whose slug the scope
  lacks, and a press on the route's own entry does nothing, so a Checkout
  return keeps its query.
- Found by Milestone 6: the project read draws the whole cloud frame as one
  waiting region whose `h1` names the read for screen readers, and the
  stage's card draws its title as a bar. The session and project reads draw
  the same frame (`ViewerFrameWait`), with the account as a placeholder of a
  short name. The build card's workspace-read wait comes from
  `awaitsOwnerAction`, so `buildAction` still offers no action, as
  `viewer-builds.md` says. Each panel's loaded form and wait render one group
  component. The reference trigger shows the name that the address or a read
  gives, and its placeholder otherwise; it never shows a loading word.
- Found by Milestone 5: the dialog and the layer stay mounted from the scope
  wait to its answer, so focus lands on the requested rail row at once. The
  scope wait lists the project's panes only when the address names a project.
  The Account, Workspace, Project and Delete project panes have no read of
  their own, so their scope wait draws their layout in waiting form. A wait
  leaves out the controls that a reader who does not administer never gets.
  `startCheckout` and `openBillingPortal` return the Stripe address, and the
  Billing pane leaves through `Write.leave`.
- Found by Milestone 2: a list's wait names its read for screen readers only,
  because a list has no text place that the read decides. Billing's wait names
  its read in the Plan value, because a Checkout confirmation can last 30
  seconds. The switcher's group labels draw as bars, because a group shows
  only with rows. The CLI form's loading drawing stays its write, and its
  workspace read is a variant, because `product-mockups-account.md` names the
  write as that drawing. A named pane's scope wait has its own drawing,
  `product/settings/members/scope-loading`. The Project pane's Save keeps Make
  public and the Automatic builds switch live, as `settings-dialog-states.md`
  requires.

### Waits by area

| Area     | Wait                                                                                | Waiting layout                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Account  | Sign in, sign up, magic link, create workspace, repository step and CLI form writes | The form, with the busy control.                                                                                                            |
| Account  | Address suggestion                                                                  | The address line reads "Finding an available address…".                                                                                     |
| Account  | Create workspace: session read                                                      | The form with its fields and its button in waiting form.                                                                                    |
| Account  | Install step: session and workspace reads, and the connected hand-over              | The title, "Loading your workspace…" in the line under it, the button as a placeholder, Back, the CLI line as text and the strip at step 2. |
| Account  | Install step: suspended list read                                                   | The suspension fact with a placeholder for Resume on GitHub.                                                                                |
| Account  | Install step: installing                                                            | Install on GitHub, busy with "Installing…" until the page leaves. Back and the CLI line stay.                                               |
| Account  | Repository step: workspace and repository reads                                     | The form. Repository holds "Loading repositories…". Create project is disabled. The CLI line as text and the strip stay.                    |
| Account  | CLI form: workspace read                                                            | The form in waiting form, Back, and the strip at step 3.                                                                                    |
| Account  | Connect: workspace list                                                             | The workspace field with "Loading your workspaces…", and the button in waiting form.                                                        |
| Account  | Project created: project and branch reads                                           | The title, the four facts and two button placeholders. The title and the facts draw as placeholders until the project loads.                |
| Account  | Landings and resolvers                                                              | The account frame with the title over one state card placeholder. The name is for screen readers only when the title says it.               |
| Settings | Dialog and layer scope read                                                         | The rail for the scope, and the requested pane's waiting layout.                                                                            |
| Settings | Pane reads: workspace projects, members, GitHub, tokens, access, billing            | The pane's sections and headings, one placeholder row in each list, and controls in waiting form.                                           |
| Settings | Pane writes                                                                         | The busy control. The switch shows "Saving…" in its row.                                                                                    |
| Viewer   | Project read on a viewer route                                                      | The cloud frame over the stage's waiting card.                                                                                              |
| Viewer   | Stage reads: catalogue, publication, publishing access, publishing, build           | The stage's state card, with the operation in its title.                                                                                    |
| Viewer   | Panels: switcher, projects, history, share                                          | The panel's groups, with one placeholder row in each.                                                                                       |

Contract owners:

- [Folio chrome](../docs/protocol/cloud/folio-chrome.md).
- [Folio chrome account](../docs/protocol/cloud/folio-chrome-account.md).
- [Web application](../docs/protocol/cloud/web-app.md).
- [Product mockups account](../docs/protocol/cloud/product-mockups-account.md).
- [Product accounts and roles](../docs/protocol/cloud/product-accounts-and-roles.md).
- [Product mockups](../docs/protocol/cloud/product-mockups.md).
- [Settings dialog](../docs/protocol/cloud/settings-dialog.md) and its
  [states](../docs/protocol/cloud/settings-dialog-states.md).
- [Settings dialog GitHub](../docs/protocol/cloud/settings-dialog-github.md).
- [Viewer builds](../docs/protocol/cloud/viewer-builds.md) and
  [Viewer build navigation](../docs/protocol/cloud/viewer-build-navigation.md).
- [Shared control overlays](../docs/protocol/cloud/shared-control-overlays.md).
- [Shared control registrations](../docs/protocol/cloud/shared-control-registrations.md).
- The [app README](../apps/app/README.md) and the
  [mockup catalogue README](../docs/mockups/README.md).

Replaced ways:

- The three-bar `Pending` block in the app → the waiting region with the
  screen's own layout. Consumers: `components/resource-state.tsx`,
  `session/guard.tsx`, the routes in `screens/app/`, the account screens in
  `screens/account/`, `settings/dialog-host.tsx`, `settings/layer-screen.tsx`,
  the settings panes, and `viewer/stage.tsx` with its callers
  `viewer/stage-view.tsx` and `viewer/build-stage.tsx`. Moved in Milestones 3,
  5 and 6. Deleted in Milestone 7.
- The old block as the default wait of `RequireSession`, `WorkspaceRoute`,
  `ProjectRoute` and `PaneResource` is a converter. It keeps the routes and
  panes that a later milestone moves working. Deleted in Milestone 7, which
  makes the waiting layout a required prop.
- The write block next to a control → the busy control. Consumers: the account
  forms in `screens/account/` and the settings panes in `settings/panes/`.
  Moved in Milestones 4 and 5. Deleted in Milestone 7.
- The three-bar `Pending` and the three-bar `design/skeleton` in the mockups →
  the placeholder forms. Consumers: every product drawing that renders
  `Pending`. Moved and deleted in Milestone 2. The `fo-pending-shape` styles in
  `docs/mockups/styles/product/` stay until Milestone 7, because the app reads
  them through `sync:styles` until then.
- The tests of the old block move to the new layout with every assertion:
  `apps/app/src/_tests_/invitation.spec.ts`, `preview-callback.spec.ts` and
  `a11y.spec.ts`, and `docs/mockups/src/_tests_/` `product.spec.ts`,
  `product-pages.test.ts`, `cli-form.test.ts`, `workspaces-account.test.ts`,
  `workspaces-settings.test.ts` and `disk.spec.ts`.

## Milestone 1: Documentation and protocol

Depends on: none

Write the rules for a wait and the decisions in force. Name no source file in a
protocol doc.

- [x] In `docs/protocol/cloud/folio-chrome.md`, replace the loading sentence of
      **State** with the rules for a wait. Add the decision in force: a wait
      reuses the loaded layout's parts, not a generic block or a hand-drawn
      skeleton, because only shared parts keep both shapes equal.
- [x] In `docs/protocol/cloud/folio-chrome.md`, add the write rule next to **Write
      failure**: the control keeps its place, shows its working word and the
      busy spinner, and refuses a second press until the write is done. A
      write that leaves the page is done when the page leaves. The form
      inserts nothing.
- [x] Align the loading sentence in `docs/protocol/cloud/web-app.md` under
      Accessibility.
- [x] In `docs/protocol/cloud/folio-chrome-account.md`, say under **States** that a
      wait draws the step's own layout.
- [ ] Apply the answer to decision 5 to the **Panel** rule in
      `docs/protocol/cloud/folio-chrome-account.md`. Waits for the answer.
- [x] In `docs/protocol/cloud/product-mockups-account.md`, replace "Every
      data-backed screen's loading variant ... uses Firna skeletons" with the
      rules. Say that a write's drawing keeps the form with the busy control,
      and that the install step keeps Install on GitHub with "Installing…".
      Replace "Loading drawings do not draw it" for the CLI line with: a wait
      draws the line as text with no link.
- [x] In `docs/protocol/cloud/product-accounts-and-roles.md` and
      `docs/protocol/cloud/product-mockups.md`, put "Finding an available address"
      in the address line, in place of the address.
- [x] In `docs/protocol/cloud/settings-dialog.md`, align the loading sentence under
      **States** and the sentence on pending forms. The doc has 249 lines, so
      split it into linked pages if it passes the target.
- [x] In `docs/protocol/cloud/settings-dialog-github.md`, say that the loading state
      names "Loading GitHub accounts" and draws one placeholder row.
- [x] In `docs/protocol/cloud/shared-control-overlays.md`, say that the skeleton
      registration draws the placeholder forms and that Button takes `busy`.
- [x] In `docs/protocol/cloud/shared-control-registrations.md`, add `busy` to
      `design/button`, the waiting form to `design/input` and
      `design/selector`, and the loading rows to `design/table` and
      `design/content-list`.
- [x] Read `docs/protocol/cloud/product-mockups-settings.md`,
      `docs/protocol/cloud/product-mockups-viewer.md` and
      `docs/protocol/cloud/auth-callbacks.md` for each loading sentence. Change only
      a sentence that contradicts the rules. `product-mockups-viewer.md` has
      301 lines, so split it if you touch it.
- [x] Run `cargo xtask markdown-links`, `cargo xtask prettier` and
      `cargo xtask whitespace`.

## Milestone 2: Mockups

Tags: mockup

Depends on: 1

Draw every wait of the three areas with its own layout, before any app change.
Read the `mockups` and `product-ui` skills first.

- [x] Add `docs/mockups/src/screens/product/placeholders.tsx` with the
      placeholder forms, including the content-list, member, note and table
      rows. Make `Pending` the waiting region. Give the registered Button
      `busy`. Give the registered Input and the selector a waiting form, and
      update their registrations and saved variants.
- [ ] Apply the answer to decision 5 in `docs/mockups/styles/product/account.css`.
      Waits for the answer.
- [x] Redraw `design/skeleton` with one variant for each placeholder form.
      Delete the three-bar render of the mockup `Pending` and of
      `design/skeleton`. Keep the `fo-pending-shape` styles for the app.
- [x] Account: redraw the waits of sign in, sign up, magic link, the callback
      landings, create workspace, the install step, the connect situation,
      the repository step, the CLI form, invitation acceptance and the
      project-created screen. Each read wait draws the screen's own layout.
      Each write wait draws the form with the busy control.
- [x] Account: redraw both suggestion-loading drawings with the address line.
- [x] Settings: redraw the dialog's scope wait, each pane's loading drawing,
      and each pane write with the busy control.
- [x] Viewer: redraw the stage's waiting cards, the cloud frame of the
      project read, and the waits of the switcher, projects, history and share
      panels.
- [x] For each difference with the app that a later milestone closes, add a
      parity allowance whose `todo` names
      `plans/follow-ups/app-waits-trail-redrawn-mockups.md`. Update the
      drawing tables in `docs/protocol/product-mockups*.md` for each drawing
      that is added or renamed.
- [x] Move the mockup tests of the old block to the new drawings with every
      assertion. Keep `drawnPendingLabels` and the document policies reading
      the name.
- [x] Run `npm run mockups:build`, then `npm run mockups:check`,
      `npm run mockups:test` and `npm run mockups:typecheck`. Inspect every
      changed page from disk at both viewports. Compare each wait with its
      loaded drawing.
- [x] Keep one accessible `h1` in each wait whose title the answer decides:
      the project-created wait's `h1` holds its bar and the operation's name
      for screen readers. Found by Milestone 3.
- [x] Expose the `h1` of `product/viewer/standalone/project-loading` with
      the read's name for screen readers, as the project-created wait does.
      Milestone 6 does it before its app change.
- [x] Draw the settings states that Milestone 5 found with no drawing: the
      scope wait of the Account, Workspace, Project and Delete project panes,
      and the ten pane writes that no drawing names.
- [x] Draw a reviewer's running build with no action and no line as a
      `running` variant of `product/viewer/standalone/build/reader`, so that
      each build card body maps to a drawing that shows it. Found by
      Milestone 6.
- [x] Draw the publication read after an alias redirect, with the reference
      trigger as its placeholder, as a screen beside
      `product/viewer/standalone/loading`. Found by Milestone 6.
- [x] Update the design and the TODOs of this plan for each problem that the
      drawings show.

## Milestone 3: Shared parts and account reads in the app

Tags: ui

Depends on: 2

Add the shared parts, and make the account read waits match their drawings.

- [x] Add `apps/app/src/components/placeholders.tsx`. Make `Pending` the
      waiting region.
- [x] Give each account screen one layout component that its loaded screen
      and its wait both render.
- [x] Give `RequireSession`, `WorkspaceRoute`, `ProjectRoute` and
      `PaneResource` an optional waiting layout. Keep the old block as the
      default for the routes and panes that a later milestone moves. Draw the
      sign-in screen's wait while `RequireSession` sends a signed-out reader
      to sign in.
- [x] Pass the waiting layout from each account route, and move each account
      read wait in the table above to it.
- [x] Draw the suggestion status in the address line, in
      `create-workspace-screen.tsx` and `project-address.tsx`.
- [x] Update `sourcePendingLabels` in `docs/mockups/src/_tests_/app-parity.ts`
      for the new `Pending` form, so that it still reads every app label. See
      it fail on a changed label mode, then restore the label.
- [x] Move the app tests of the old block with every assertion. Run each
      changed browser test 10 times.
- [ ] Apply the answer to decision 4 for the suggestion read. Waits for the
      answer.
- [x] Keep one accessible `h1` in the project-created wait while the project
      loads, as its drawing shows after the Milestone 2 fix.
- [x] Run the targeted logic and browser tests. Walk the onboarding flow on
      the local stack at 1280 px and 390 px, and compare each wait with its
      drawing.

## Milestone 4: Account writes in the app

Tags: ui

Depends on: 3

- [x] Let `Action` take the write that it sends, and derive `busy` and its
      screen-reader status from the write's `working`. Keep a busy `Action`
      enabled, so that it keeps focus.
- [x] Keep a write that leaves the page busy until the page unloads, and
      return it to rest when the browser restores the page from its
      back-forward cache. Leave the page only while the screen is still
      shown.
- [x] Move the writes of sign in, sign up, the magic link, create workspace,
      the repository step and the CLI form to the busy control. Remove each
      write block.
- [x] Keep the install step's control mounted while it installs, busy with
      "Installing…", with Back and the CLI line. Delete
      `plans/follow-ups/install-step-hides-control-while-working.md` in the
      same commit.
- [x] Add the busy state and the working word to the install step's
      double-press test. See the new assertion fail on the old screen. Run
      each changed browser test 10 times.
- [ ] Apply the answer to decision 4 for the create-workspace write. Waits
      for the answer.
- [x] Run the targeted tests, and submit each account form on the local
      stack at both viewports.

## Milestone 5: Settings waits in the app

Tags: ui

Depends on: 4

- [x] Pass the waiting layout to the dialog and layer scope waits and to each
      pane's `PaneResource`. Keep "← Settings" in the layer's bar during the
      scope wait, as the drawings show.
- [x] Move each pane write to the busy control, and remove its block. The
      writes that leave for GitHub or Stripe stay busy until the page leaves.
- [x] Show "Saving…" in the Automatic builds switch's own row while it saves,
      disable the switch, and give screen readers "Saving automatic builds".
- [x] Move the settings tests of the old block with every assertion. Run each
      changed browser test 10 times.
- [x] Run the targeted tests, and open each pane on the local stack at both
      viewports.

## Milestone 6: Viewer waits in the app

Tags: ui

Depends on: 3

- [x] Pass the cloud frame as the waiting layout of the viewer route's
      project read.
- [x] Move `StagePending` and its callers to the stage's waiting card, and
      draw the build card's workspace-read wait with the owner's action as a
      placeholder. Map `pending-workspace` to
      `product/viewer/standalone/plan-loading` in `stage-drawings.test.ts`.
- [x] Pass the waiting layout to the switcher, projects, history and share
      panels.
- [x] Check that `src/_tests_/viewer/stage-drawings.test.ts` still maps every
      card to its drawing.
- [x] Run the targeted tests, and open the viewer and each panel on the local
      stack at both viewports.

## Milestone 7: Remove the old block

Tags: ui

Depends on: 5, 6

- [x] Make the waiting layout a required prop of `RequireSession`,
      `WorkspaceRoute`, `ProjectRoute` and `PaneResource`. Delete the old
      default.
- [x] Delete the three-bar render of the app's `Pending`. Delete the
      `fo-pending-shape` styles from the shared Folio stylesheet under
      `docs/mockups/styles/product/`, which only the app's old block still
      uses.
- [x] Search the repository for `fo-pending-shape`, the three-bar widths and
      each removed label. Update each live reference.
- [x] Remove the last parity allowance that names
      `app-waits-trail-redrawn-mockups.md`, and delete that follow-up file.
- [x] Update `apps/app/README.md` under Key Code and Development, and
      `docs/mockups/README.md`.

## Milestone 9: Review fix mockups

Tags: mockup

Depends on: 7

Draw the states that the round 1 review fixes need, before the app fixes.
The findings are in `.context/reviews/calummoore/skeleton-sizing-mismatch/findings.md`.

- [x] Finding 81: draw Publish, Try again and Cancel busy, as sibling screens
      of the publish, running build and failed build drawings, with their
      operation names.
- [x] Finding 82: draw the settings waits while the session loads: the
      compact layer and the desktop dialog with the pane's wait and the
      Account pane's wait with no session, and the wide durable route
      while it reads and hands over to the dialog.

## Milestone 10: Review fixes in the app

Tags: ui

Depends on: 9

- [x] Finding 41: keep one stable write-failure frame around a control at
      rest, refused and during a retry, so the control keeps its node and
      its focus. Test keyboard focus after a refusal and during a retry in
      one account form and one settings pane.
- [x] Finding 81: bind Publish, Try again and Cancel to their writes, with
      regression rows that hold each request.
- [x] Finding 82: let the settings waits take an unknown session, draw them
      from the session-loading branch of the compact layer and the desktop
      dialog, and give the wide durable route the same wait, with browser
      cases that hold the session read.
- [x] Run the targeted checks and the whole app browser suite.

## Milestone 11: Second review fix mockups

Tags: mockup

Depends on: 10

Draw the state that finding 83 of the round 2 review needs.

- [x] Draw the wide route's wait with a rail entry that has no address yet,
      disabled with no link.

## Milestone 12: Second review fix in the app

Tags: ui

Depends on: 11

Fix finding 83, the second and last fix round of the review.

- [x] Make `paneRoute` return no address when the scope lacks a slug that
      the pane needs, draw such a rail entry disabled, and keep the Checkout
      return's query when the reader presses the route's own entry, with
      browser cases.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone

- [x] Merge `origin/main` at `967ab6c8` (merge commit `ddb2b235`). The
      per-path justifications are in
      `.context/loading-states-match-content/merge/justifications.md`; the
      pull request description copies them.
- [x] Run the early checks and the complete gate, `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [x] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds and deletes.
