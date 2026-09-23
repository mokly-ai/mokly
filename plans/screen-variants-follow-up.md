# Screen Variants Follow-up

Status: the initial follow-up is implemented, verified, pushed, and reviewed in
[PR #115](https://github.com/mokly-ai/mokly/pull/115). Active pending PR merge.
The user has approved fixing historical snapshot selection;
Milestones 9–12 carry that work without reopening completed milestones. Created 2026-09-22 to close
[Screen Variants](./screen-variants.md) for
[PR #101](https://github.com/mokly-ai/mokly/pull/101). The user's 2026-09-22
request to implement this follow-up authorizes its six design route moves and
related collection cleanup. Delivery belongs in a separate PR. Implementation
is delegated to Codex 5.6 Sol with max reasoning; the coordinating agent checks
the implementation, runs the complete gate, commits and pushes, then performs
the final read-only review. Keep this plan Active until its PR merges.

## Scope And Contracts

Carry forward Task 9.1, all three second-review findings, the two latest
variant-related findings, and both later product ideas. The original plan
retains its completed milestones and historical review record.

Contract owners:

- [Screen variants](../docs/protocol/mokly-screen-variants.md) and
  [authoring](../docs/protocol/mokly-authoring.md).
- [Viewer](../docs/protocol/mokly-viewer.md),
  [navigation](../docs/protocol/mokly-navigation.md), and
  [Changes](../docs/protocol/mokly-changes.md).
- [Shell design](../docs/protocol/mokly-shell-design.md),
  [design links](../docs/protocol/mokly-design-links.md), and
  [component workspace](../docs/protocol/mokly-component-workspace-design.md).

Use option A for all five findings below. The two later product ideas remain
non-blocking follow-ups. The approved conversion preserves every existing
design id and moves exactly these six routes beneath `design-browse-screen`:

| Stable id                             | Old route below `design/browse/`     | New route below `design/browse/views/screen.variants/` |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `design-browse-dark-scheme`           | `states/dark-scheme.html`            | `dark-scheme.html`                                     |
| `design-browse-light-only`            | `states/light-only.html`             | `light-only.html`                                      |
| `design-browse-tag-picker`            | `states/tags/picker.html`            | `picker.html`                                          |
| `design-browse-tag-forms`             | `states/tags/forms.html`             | `forms.html`                                           |
| `design-browse-tag-onboarding`        | `states/tags/onboarding.html`        | `onboarding.html`                                      |
| `design-browse-tag-onboarding-picker` | `states/tags/onboarding-picker.html` | `onboarding-picker.html`                               |

Remove these six collection memberships. Retain the now-empty
`design-browse-tags` collection's stable id and all other routes, including
`design-browse-tag-filter`; update its description to point readers to Welcome.
Generated fragment moves follow the six route moves automatically. Before
conversion, capture the manifest's id/route/collection inventory as regression
evidence; new regression screens may add ids but must not hide unrelated losses.

## Parallel mainline delivery

[PR #112](https://github.com/mokly-ai/mokly/pull/112) independently delivered
`resolveWorkspaceView`, effective Light fallback, and complete-evidence
eligibility, including SSR, Viewer, partial-evidence and deep-link regressions.
Those interfaces and tests are retained during this branch's mainline merge.
Existing embedded routing already applied valid explicit axes; this follow-up
also consolidates partial/invalid-axis parsing and Changes landing behavior.
The completed milestones below retain this branch's original finding numbers.

## Carried Review Findings

1. **P2 — Embedded links ignore explicit view axes.** Original second review,
   item 1. `ViewerRouting.shell` parses the saved variant and fragment but not
   valid `viewport` or `scheme` parameters. A linked screen can open at the
   wrong size or theme; even an invalid axis suppresses first-changed landing.
   **A (recommended):** share a typed axis parser between standalone Browse and
   the Viewer, applying each valid explicit axis and retaining the other.
   **B:** patch the two navigation paths independently. A prevents the same
   drift and needs controlled and uncontrolled Viewer browser coverage.
2. **P2 — A light-only preview uses Dark for its status and marks.** Original
   second review, item 2. In a mixed catalogue, `syncViewControls` passes the
   selected Dark scheme to `shownStatus` and `viewMarks` even when the screen
   or saved component variant displays its Light fallback. Users can see a
   misleading Changed badge or a mark for a theme that has no render.
   **A (recommended):** resolve the effective view once and share it across
   status, marks, and comparison presentation, with mixed-catalogue tests in
   Serve and the Viewer. **B:** add local fallback checks at each consumer.
   A protects future consumers from presenting inconsistent view evidence.
3. **P2 — Fallback status grants unavailable comparisons.** Original second
   review, item 3. With missing or pending per-view evidence,
   `selectedComparisonEligible` uses route-level Changed status even when the
   selected saved component variant is Unmodified and ineligible. Users can
   select unavailable comparisons, including through `?comparison=side`.
   **A (recommended):** return status, eligibility, and evidence provenance
   together; derive eligibility from shown status only for matching evidence,
   retaining existing entry/variant eligibility otherwise. Reuse the resolver
   in server rendering and every client path. **B:** guard only comparison
   controls. A also closes deep-link and background-update paths.
4. **P2 — Broadly typed screen inputs promise the wrong return shape.** Latest
   post-CI review, item 1; `src/authoring/definitions.ts:24`.
   `defineScreen(input)` for an `input: ScreenInput` is typed as one
   `ScreenDefinition`, but returns an array when `variants` is present, even
   when it is empty. Validly typed consumers can read undefined properties.
   **A (recommended):** expose a union when variants are optional while keeping
   precise literal inference; cover typed inputs and generic helper wrappers
   in packed-consumer type tests and runtime tests. **B:** always return an
   array, requiring a broader breaking API migration. A fixes the public
   contract and adds boundary coverage without changing established behavior.
5. **P2 — Historical variants disappear when their parent becomes a variant.**
   Latest post-CI review, item 2; `packages/viewer/src/shell/nav_tree.ts:124`.
   A former parent can retain its id while becoming another screen's variant.
   Removed children are then adopted and excluded from flat fallback, but
   `attachRemovedVariants` never attaches them through variant leaves. Users
   lose navigation to those removed routes and their previous versions.
   **A (recommended):** adopt only beneath current non-variant parent screens;
   otherwise retain flat fallback. Add an invariant that every removed route
   remains represented. **B:** design nested historical variant groups across
   navigation and the contracts. A preserves the existing one-level model
   while the invariant protects other hierarchy transitions.

## Milestones

### Milestone 1: Define the follow-up contracts

Documentation first: make the intended behavior explicit before changing
authoring or navigation.

- [x] Specify return types for literal, optional, empty, and generic `variants`
      inputs: absent or definitely undefined returns one definition; a definite
      array (including empty) returns a readonly array; a possibly present
      array returns their union. Preserve distributive literal inference and
      reject unsafe assignments in broad and generic consumer code.
- [x] Specify valid axis parsing, partial/invalid axis handling and Changes
      landing in the navigation and Viewer contracts for finding 1. Parse each
      axis independently; only one valid value counts as explicit. Ignore
      invalid or repeated values, apply valid values atomically, and retain
      the other sticky axis. Only a valid explicit axis suppresses first-change
      landing. Cover same-destination axis changes and controlled proposals.
- [x] Define effective view fallback and evidence-backed comparison
      eligibility for findings 2 and 3, including server render, deep links,
      controlled selection, and background evidence updates.
- [x] Clarify that removed-variant adoption requires a non-variant current
      parent; preserve every removed route exactly once for finding 5.
- [x] Record the implementation request's authorization and exact six-route
      mapping above, preserving the original plan's historical review record.
- [x] Copy the approved route mapping, stable ids and collection changes into
      the design inventories before conversion.
- [x] Validate changed Markdown and links; review the documentation diff.

### Milestone 2: Stage the design catalogue conversion

Tags: mockup

Capture the existing catalogue and prepare the authorized conversion with the
existing mobile/desktop screen components before changing core behavior.

- [x] Capture the original manifest's id, route, and collection inventory before
      conversion: 137 entries and 127 design ids.
- [x] Add and run the route, `variantOf`, and membership regression assertions
      before conversion; record the expected three-test failure.
- [x] Reuse the six existing mobile/desktop screen components as Welcome variant
      inputs and remove only their six old memberships in the staged source.
- [x] Record the discovered empty-collection validation gap instead of deleting
      `design-browse-tags` or retaining a fake child. Continue in the required
      backend and replacement mockup milestones below; complete this item only
      after the staged catalogue builds again.

Evidence: the original inventory is in
`.context/screen-variants-original-inventory.json`; the pre-conversion test
failed in `.context/screen-variants-design-red.log` before any entry mutation.

### Milestone 3: Support empty structural collections

Allow an intentionally empty collection to retain a stable navigation identity
while preserving all hierarchy and manifest invariants.

- [x] Update the authoring, manifest, catalogue, and navigation contracts for
      empty `childIds`; an empty collection remains structural and viewless.
- [x] Add failing authoring/build, manifest-reader, public-reader, and hierarchy
      regressions before the fix, including round trips and empty navigation
      projection.
- [x] Accept empty collection `childIds` at authored and manifest boundaries;
      retain duplicate, unknown-child, multi-parent, and cycle checks unchanged.
- [x] Run the collection validation, manifest, public catalogue, hierarchy, and
      navigation suites plus `npm run build`.

Evidence: `.context/empty-collections-red.log` records the two authored-boundary
failures; `.context/empty-collections-green.log` records the five passing
authoring, build, manifest, reader, and navigation regressions.

### Milestone 4: Complete design conversion and regression states

Tags: mockup

Resume the blocked authorized conversion after empty collections are supported.
Reuse the existing design library and standalone mobile/desktop components.

- [x] Move `design-browse-dark-scheme`, `design-browse-light-only`, and the four
      tag-state screens into `design-browse-screen` (Welcome) as variants.
      Preserve all six ids and derive the six routes below
      `design/browse/views/screen.variants/`.
- [x] Update `examples/basic/entries/design/browse_screens.tsx`,
      `browse_scheme_screens.tsx`, `browse_tag_screens.tsx`,
      `browse/states/tags/*.tsx`, and `design.mockup.tsx`; reuse screen
      components and remove only the approved old collection memberships.
- [x] Update the shell-design and design-links inventories,
      `examples/basic/notes.md`, the example README, and the root README's
      relevant feature paragraph. Keep their delivered-status claims accurate.
- [x] Extend the owning design pages for mixed-scheme fallback, ineligible
      comparisons, and removed variants whose old parent becomes a variant.
      Reuse existing screens where possible; keep mobile and desktop variants,
      reachable design links, and no more than five mockups per screen-spec
      page. User flows must link back to those owning screen components.
- [x] Verify the manifest retains every original design id, moves exactly six
      routes, adds `variantOf` to those entries, and removes only the approved
      memberships. Run `tests/design_screens.test.tsx`,
      `tests/design_links.test.ts`, `tests/browser/design_links.spec.ts`, and
      `tests/browser/preview_design_links.spec.ts`.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and `npm run preview:build`. Smoke through `npm run dev` and the static
      preview: expand Welcome, open every variant, and follow a mini-screen
      design link into a variant at mobile and desktop sizes.
- [x] Keep generated HTML and the manifest ignored; commit only authored
      source and CSS. Record every approved retired route in the conversion
      commit message.

Evidence: the independent inventory verifier retained all 137 original ids,
reported only the six authorized moves and one new regression screen, and the
52-test design unit run passed. The required browser suites passed 10/10;
Serve/static smoke covered all six variants at both sizes with keyboard links.
Logs and screenshots are under `.context/`.

### Milestone 5: Correct the public authoring types

Resolve finding 4 at the package boundary while keeping the running product
and existing authoring use cases functional.

- [x] Add failing NodeNext packed-consumer checks for annotated `ScreenInput`,
      generic wrappers, omitted/undefined variants, empty arrays, and populated
      arrays; assert that unsafe single-definition assignment is rejected.
- [x] Correct `DefineScreenResult` and add matching runtime assertions without
      losing precise inference for known single-screen and array calls.
- [x] Run authoring tests, `npm run build`, `npm run typecheck`,
      `npm run package:check`, and `npm run package:smoke`.

Evidence: `.context/authoring-packed-consumer-red.log` records the initial and
caller-owned optional-property failures. The final exact-optional NodeNext
matrix, 18 authoring tests, build, typecheck, package check, and all five packed
consumer smoke scenarios passed.

### Milestone 6: Correct Viewer selection and historical navigation

Tags: ui

Resolve findings 1, 2, 3, and 5 through shared decisions that keep standalone,
embedded, and published navigation consistent.

- [x] Add failing tests for each finding before implementation. Cover valid,
      partial and invalid explicit axes; controlled/uncontrolled Viewer
      navigation; light-only screens and saved variants in mixed catalogues;
      missing/pending/nonmatching evidence and comparison deep links. Capture
      the failing test commands and outcomes before each corresponding fix.
- [x] Share the typed axis parser and effective-view/evidence resolution among
      the server-rendered shell, client updates and Viewer selection paths.
      Resolve the displayed scheme from the selected screen/saved variant,
      retaining the global scheme preference; status, marks and comparison
      availability must describe those displayed renders. Missing evidence
      preserves the existing entry/saved-variant eligibility independently of
      the displayed route-level status. Re-evaluate on background updates.
- [x] Restrict removed-variant adoption and test former-parent reparenting,
      deletion and kind changes. Assert that every removed route appears
      exactly once, either under an eligible parent or in flat fallback.
- [x] Run the navigation, view-status, view-marks, workspace and Viewer unit
      suites, plus the affected Serve, Viewer and static browser suites.
- [x] Smoke the affected navigation and comparison states through Serve and
      static preview at mobile and desktop widths; check keyboard navigation
      and controlled-host proposals as well as pointer input.

Evidence: `.context/viewer-selection-red.log` records the four pre-fix
boundaries. The final broad unit selection passed 94/94; focused SSR/rendering
passed 27/27; Viewer browser passed 7/7; effective fallback, removed comparison,
and static comparison browser coverage passed 8/8. Controlled keyboard
proposals remained inert until accepted, background/deep-link evidence stayed
ineligible when required, and Light-only comparison headings retained their
fallback label.

### Milestone 7: Verify, deliver, and review the separate PR

Complete the follow-up independently of PR #101. No task requires this PR
already to be merged.

- [x] Reconcile every carried item with test or decision evidence and update
      delivery documentation. Record branch readiness here; the PR merge
      moves this plan to Completed. Keep genuinely later work below.
- [x] Align the full-suite catalogue assertions with the delivered conversion:
      derive global design stylesheet scope from the catalogue and scope the
      example Welcome inheritance assertion to its actual parent. The first
      full gate exposed obsolete totals of 79 design screens and one variant
      across the entire catalogue; preserve the tests' behavioral assertions.

Evidence: the focused full-suite follow-up passed 11/11 tests. Shared
stylesheet assertions now compare the exact design-screen id set, and the
Welcome test counts only variants whose parent is `example-welcome`.

- [x] Scope the exported example's variant disclosure assertion to the
      `example-welcome` parent after the design conversion added another valid
      variant toggle to the complete catalogue.

Evidence: the full retry passed all 2,253 unit tests and 690 of 691 browser
tests; its only failure was the global toggle locator resolving both the Design
Selected screen and Example Welcome. The assertion now locates the toggle
inside the leaf with `data-entry-id="example-welcome"`. The only sibling global
toggle test uses an isolated fixture with one variant parent.

- [x] Run all relevant tests and `cargo xtask check` with a 100% pass rate;
      inspect the complete diff and mainline preservation before committing.
- [x] After checks pass, run `git add -A`, commit with Conventional Commits
      and a title of at most 50 characters, and push the branch. Include all
      authored new files and record approved route retirements.
- [x] Only after the push, review the complete local diff against `origin/main`
      using [the implementation review prompt](../docs/implementation-review-prompt.md).
      Report every finding with severity, context, impact, lettered options
      and a recommendation; do not automatically fix review findings.

Verification: the complete `cargo xtask check` passed with 2,253 Node tests,
691 Chromium browser tests, and 10 Rust tests, with no failures or skips.
The gate also passed dependency audit, formatting, lint, type checks, example
validation and packed-consumer checks. The branch includes mainline `b4f1aca`;
all 137 original catalogue ids remain, exactly six routes moved, and no tracked
files were deleted. Desktop/mobile Serve and static smoke checks passed.
Delivery: implementation commit `176c7a9` was pushed before the read-only review
against `origin/main` (`b4f1aca`). Two findings were reported in Conductor's
Checks panel for the user's decision; no review finding was automatically fixed.
The PR remains a draft and this plan stays Active until merge.

### Milestone 8: Preserve subsequent mainline changes

The remote-tracking branch refreshed to `a8f408d` during final review. Preserve
its CI verification, fixture cleanup, tests and documentation without changing
the reviewed product implementation or applying review findings.

- [x] Capture source tip `3503f5a` and audit additions since `b4f1aca` before
      merging the updated mainline.
- [x] Resolve the Viewer README and plan-index conflicts by retaining the new
      mainline structure and entries plus this branch's documented behavior.
- [x] Run repository checks, type checks and the unit/browser tests affected by
      the incoming CI and fixture changes; verify no mainline files were lost.
- [x] After checks pass, run `git add -A`, commit with Conventional Commits,
      and push the branch with all authored files tracked.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete diff from `origin/main`; report findings without
      changing the implementation.

Integration evidence: repository checks and type checks passed, along with all
117 affected unit/integration tests and 33 affected browser tests. Incoming
changes modify CI verification, test fixtures and documentation; the product
runtime code is identical to the implementation that passed the complete gate.
No mainline files were deleted and both reported findings remain unchanged.
Commit `263ba75` was pushed before the final read-only comparison against
`origin/main` (`a8f408d`); the review confirmed the same two findings and no
additional implementation changes.

### Milestone 9: Define historical snapshot selection

Fix review item 1 generally for consumer catalogues. Preserve each screen's
stable id and distinguish its selected historical snapshot. Existing previous-
version screen components own the presentation; no new visual design is needed.
Review item 2's mockup alignment remains outside this approved fix.

- [x] Define snapshot identity, public discovery and selection in the catalogue,
      Viewer and removed-preview contracts before implementation. Reuse real
      immutable generation/baseline identity where available; cover live history
      before a comparison is generated without fake or ambiguous identifiers.
- [x] Specify current selection, same-id historical selection, unknown/stale
      snapshots, legacy catalogues, controlled proposals, events, URL/history
      restoration, and evidence updates. Snapshot mismatch must fail closed.
- [x] Record the compatibility decision and update the relevant READMEs.

### Milestone 10: Publish and resolve historical identities

Keep identity ownership at the catalogue boundary and make every selected
historical record resolve to its own route, metadata and preview descriptor.

- [x] Add failing projection/reader and workspace-resolution tests for current
      and removed screens sharing an id; cover absent/pending generation data,
      stale identities and separate catalogues.
- [x] Implement typed, validated identity publication/resolution, including
      older supported catalogue inputs. Avoid duplicating identity algorithms
      or using current-entry precedence for an explicit historical selection.
- [x] Reject snapshot intent on logical-id aliases and current routes in both
      served and static delivery; accept only the exact historical view route,
      and never canonicalize a rejected snapshot to current content.
- [x] Bind removed-preview responses to the selected baseline commit or legacy
      immutable generation, including late responses, retries and final-URL
      generation changes, before historical bytes can render.
- [x] Verify package declarations, readers, projection and relevant build tests.

### Milestone 11: Carry historical selection through the Viewer

Tags: ui

Select the requested version consistently without changing the previous-version
screen design or weakening historical frame isolation.

- [x] Add failing browser regressions for same-id current/historical navigation
      in controlled and uncontrolled hosts, plus Serve/export history paths.
- [x] Carry snapshot identity through selection normalization/equality, route
      proposals, view/context/workspace lookup, navigation events and restoration.
      Keep historical selection through axis/filter updates and clear it on an
      explicit return to current content. Stale evidence cannot retarget it.
- [x] Verify status, exact previous-version content, breadcrumbs, active rows,
      read-only frames and absence of current-only inspection/comparison actions.
- [x] Remove obsolete server-rendered preview frame templates so historical
      screen routes hydrate through the same unavailable-to-ready lifecycle as
      historical pages without a React tree mismatch.
- [x] Run targeted Viewer and historical-preview tests and mobile/desktop smoke.

Implementation evidence: exact pre-fix browser and unit runs reproduced the
same-id selection, stale-preview, alias and history failures. The final Viewer
suite passed all 100 tests, the focused data/server suite passed all 61 tests,
and the packed-package consumer check passed. The 34-case browser run covered
controlled and uncontrolled hosts, Serve and static history, Back/Forward and
refresh, both frame adapters, mobile and desktop widths, late responses,
retries, CSP and read-only historical frames with no hydration errors. The
public API/type probes, four independent boundary probes, lint, formatting and
304 Markdown-link validation also passed.

### Milestone 12: Prepare mainline integration

Mainline integration uses source tip `01515cb`, merge base `a8f408d`, and fetched
mainline `d665d06`. The 26-path audit and individually checked resolutions retain
mainline's effective-view interfaces and regression tests, the completed design
conversion, and every new historical-selection file. The working-tree conflicts
are resolved; the merge commit follows the complete gate. The merged resolver
passed 25 focused workspace/status/SSR tests and the integrated viewer/browser
checks retained both the snapshot and effective-view behavior.

- [x] After implementation, fetch latest main, capture the source tip and audit
      additions; prepare the merge in the working tree and resolve conflicts
      path-by-path while preserving both the fix and every unrelated mainline
      feature. Finalize the merge commit after the complete gate below.
- [x] Align strict test-fixture types and the static removed-entry alias
      assertion with the snapshot contract. Validate the actual published
      snapshot id while retaining the old route, status and comparison checks.

The first complete gate passed all repository/package/Rust checks and 2,283 of
2,284 Node tests. Its sole failure was a preview-link assertion that still
expected a historical URL without a snapshot query. Independent verification
also found that provider-normalized historical paths used the current id-alias
map and therefore lost same-id history. Complete the new milestones below
before rerunning the gate; the original mockup review finding remains separate.

### Milestone 13: Preserve snapshot URLs in preview exports

Keep the preview adapter's URL normalization aligned with the published
historical-selection contract, preserving both the exact record and its query.

- [x] Clarify the export/navigation contract for provider-normalized historical
      URLs and document the distinction between route lookup and id aliases.
- [x] Capture a failing preview-publication assertion for the actual published
      snapshot id and preserve every historical-content and isolation check.
- [x] Make any required preview-link normalization preserve snapshot queries
      while normalizing the known exported path, then run the publication tests.

### Milestone 14: Resolve historical paths after host normalization

Tags: ui

Use the accepted catalogue's historical routes when a static host removes an
HTML suffix; keep the existing screen presentation and strict snapshot checks.

- [x] Add failing unit and browser coverage for same-id screens and pages at
      provider-normalized URLs, including hydration, Back/Forward, refresh,
      return to current content and mismatched snapshot rejection.
- [x] Resolve normalized paths through exact accepted route records without
      relying on current id-alias precedence or admitting unknown routes.
- [x] Run the focused historical navigation and preview browser suites and
      verify that both exact-file and normalized URLs retain the same snapshot.

Verification: the normalized-route unit regression and both screen/page browser
regressions failed before the fix. The completed route/publication unit suite
passed 5/5. All 12 focused browser cases passed, covering controlled/uncontrolled
selection, exact-file and normalized routes, real preview-host comparisons and
pages, mobile/desktop widths, history/refresh, and snapshot mismatch rejection.
The integrated build, type checks, formatting and source lint passed. Generated
Wrangler temporary files were removed only after their test processes stopped.

### Milestone 15: Preserve legacy historical invalidation

Tags: ui

The second complete gate passed all 2,286 Node tests and 702 of 703 browser
tests. The remaining browser failure exposed older, identity-less catalogues:
changing an active historical record must retain their existing reload and
preview-refresh behavior. Explicit snapshot selections keep the new in-place
adoption and stale-identity rejection contract.

- [x] Clarify the legacy invalidation rule without fabricating snapshot ids or
      weakening explicit historical selection.
- [x] Add failing unit coverage for unchanged and changed identity-less
      historical records; retain the existing browser reload/request assertions.
- [x] Restore conservative legacy evidence adoption and verify it alongside
      versioned snapshot replacement, route history and live evidence races.

Verification: the existing full-suite browser failure and new legacy unit
regressions failed before the compatibility fix. The completed capability suite
passed 7/7, and all 16 focused browser tests passed, including the unchanged
legacy reload assertions, evidence races, current workspace preservation, and
controlled/exact/normalized snapshot history. Explicit stale snapshots also
remain unavailable if their former route becomes current content. Build, full
type checks and formatting passed before the final gate retry.

### Milestone 16: Verify and deliver the integrated snapshot fix

- [x] Integrate main's later CI runner and Serve shutdown changes through
      `0216610` after the historical fix passed the complete gate against
      `d665d06` (2,287 Node and 703 Chromium cases). The later merge applied
      cleanly; retain its workflow, CLI, fixture, and regression-test updates.
- [x] Smoke-test real Serve on the integrated mainline baseline: all six
      same-ID historical screens load their exact previous versions with
      snapshot-scoped, read-only frames; returning to current clears the
      snapshot. Inspect desktop/mobile captures and verify no page errors.
- [x] Run relevant tests and `cargo xtask check`, inspect the complete diff,
      validate docs and record results with all authored files included. The
      integrated check passed 2,288/2,288 Node and 703/703 Chromium cases,
      repository/Rust checks, package smoke, build, typecheck, example check,
      formatting and lint. All 293 changed-document links resolve; the
      inventory preserves 137 original ids and exactly six approved moves.
- [x] After checks pass, run `git add -A`, commit using Conventional Commits
      and push this branch; update PR #115 for the delivered snapshot fix.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      on the complete diff against `origin/main`; report numbered findings with
      severity, impact, lettered options and recommendations without fixing them.
      The read-only review found one P3 parity issue in the reparented removed
      variant mockup: with only that removed row in Changes, the runtime hides
      the unmodified Workspace and Welcome rows that the mockup depicts. Leave
      the finding for the user's decision; no other concrete findings surfaced.

### Milestone 17: Define the reviewed Changes parity

The user approved fixing the remaining P3 mockup mismatch. The reparented
scenario changes only the removed route, so the current parent and its variant
do not appear in Changes. The historical breadcrumb still describes the
removed screen, while All remains a separate navigation destination.

- [x] Update the design links contract to specify the single flat Changes row,
      and explain the example catalogue's depicted state in its README.
- [x] Preserve the completed review's finding and update the plan index to
      identify this final active task without reopening completed milestones.
- [x] Check the changed Markdown and its relative links before mockup work.

### Milestone 18: Match the reparented mockup to Changes

Tags: mockup

Keep the desktop and mobile artboards, historical preview, breadcrumb, and
inspector, while correcting the desktop Changes rail.

- [x] Add and run a regression that fails on the existing mockup, deriving the
      Changes-visible rows from the runtime filter with only the removed route
      changed. Keep assertions for the flat active row and All destination.
- [x] Remove the unmodified ancestor rows from the reparented mockup's rail
      and align its descriptive copy; verify both mobile and desktop outputs.

Verification: the runtime-filter parity test failed before the change because
the mockup rendered Example, Screens, Workspace and Welcome alongside the sole
changed Removed row. After correction, all 17 focused design tests pass. The
example build and check pass (312 generated files); real Serve screenshots for
desktop and mobile show the previous-version preview, and the desktop rail
shows exactly the one flat Removed row. No browser page errors surfaced.

### Milestone 19: Verify, commit, push, and review parity

- [x] Stabilize the historical-navigation browser assertion exposed by the
      complete gate: target the page title rather than every stage heading,
      still require the real previous-version iframe, and assert the interim
      unavailable state has cleared. Verify the focused case and full gate.
- [x] Run relevant tests and full `cargo xtask check`, visually smoke-test the
      served desktop and mobile artboards, and inspect the final diff against
      the freshly merged mainline without dropping its new release work.

Verification: six focused historical browser cases and the final full gate
passed (2,300/2,300 Node tests and 703/703 Chromium tests). The merged mainline
through `bf9e3c9` is present with no deleted tracked files, and both Serve
artboards retain the previous-version preview with no page errors. All 295
relative links in 23 changed Markdown files resolve.

- [ ] After checks pass, `git add -A`, commit with a Conventional Commit,
      push the branch and update PR #115 for the completed parity fix.
- [ ] After the push, review the complete local diff against `origin/main`
      with [the implementation review prompt](../docs/implementation-review-prompt.md)
      without changing the implementation; report numbered findings, severity,
      impact, lettered options and a recommended scope, if any.

## Post-merge follow-up (non-blocking)

These are the original plan's later product ideas, carried forward without
claiming approval or making adoption-dependent work a merge requirement.

- [ ] Evaluate grouping a component's Affected screens by parent once variants
      make that list long. Record the decision; if useful, define the contract
      and mobile/desktop mockups in a separate change before implementation.
- [ ] After the user has seen variants in use, consider a variants count on
      Home beside screens and components. Record the decision and scope any
      resulting UI work separately with real catalogue-derived counts.
