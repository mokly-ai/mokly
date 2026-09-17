# Component Explorer

Status: completed; the design feedback and component runtime are implemented,
verified, committed, pushed, and reviewed. Milestone 4h audited all 112 design
artboards and corrected the divider and comparison eligibility. The public API,
saved pages, attribution, inspection, static export and local controls are
delivered. Review follow-ups remain for the user's decision in the
[runtime review record](../docs/reviews/component-explorer-runtime.md).

Implement the approved [component authoring contract](../docs/protocol/mokly-components.md),
[change attribution](../docs/protocol/mokly-component-changes.md),
[pages and inspection](../docs/protocol/mokly-component-explorer.md), and
[local controls](../docs/protocol/mokly-component-controls.md).

The central rule is that a component-only change puts the component in Changes.
Its consuming screens appear under Affected screens on the component page;
they neither appear in Changes nor increase its count unless their own inputs,
content, structure, or other independent material changes. Existing propagation
from directly changed screens to their use cases remains intact.

Scope includes the Mokly package, protocol docs, existing design catalogue,
consumer fixtures, and served/published verification. Saved variants work in
both delivery modes. Editable props use local server rendering. A browser React runtime, hosted arbitrary rendering, downstream app
migrations, and publishing an npm release are outside this change.

## Execution Rules

Keep the existing catalogue functioning after every milestone. Backend
capabilities can be exercised through internal fixtures until their shell is
ready; expose the public opt-in API in the final integration milestone. Do not
release a component entry that crashes existing Browse or publishing paths.

Mockup and UI milestones are separate from backend work. If either discovers
missing backend work, insert a new backend milestone immediately afterward,
then a new tagged mockup/UI milestone containing the blocked, unchecked tasks.
Do not reopen completed milestones or move those tasks into an existing one.
Add other newly discovered TODOs to the relevant active milestone.

For regressions, add the failing test before fixing the implementation. Run
focused tests after each unit, build new modules/services, and smoke-test newly
usable behavior. Keep source files near 200 lines and below the repository's
hard caps. New documentation describes target behavior until it is delivered.

## Milestone 1: Define the contract — completed

Record the agreed behavior and its integration boundaries before implementation.

- [x] Inspect registry, render markers, props material keys, Browse Changes,
      comparison assets, Details, publishing, and the owning design catalogue.
- [x] Record the distinction between directly changed entries and affected
      consumers, including screen-owned props/slots and nested ownership.
- [x] Define saved variants, data/instance records, migration behavior, screen
      highlighting, and local-only editable controls in target protocol docs.
- [x] Create and index this plan; link planned behavior without claiming it ships.
- [x] Preserve mainline additions: captured source tip
      `f11e516d144b4616986423ccf3e8ed86095eed21`, fetched/audited main, and
      fast-forwarded to `bb3a22f` to retain its search-icon fix without conflicts.

## Milestone 1a: Complete the reviewed contract — completed

Apply the four approved findings from the initial review of `6bf3183`.
This adds a documentation milestone without reopening completed Milestone 1.

- [x] Define exact [manifest v4](../docs/protocol/mokly-component-manifest.md)
      and [comparison v3](../docs/protocol/mokly-component-review.md) interfaces,
      references, sorting, optional fields, path rules, and shared fixture checks.
- [x] Require one [runtime prop schema](../docs/protocol/mokly-component-props.md)
      for derived types, authoring, variants, controls, recorded props, and hashes.
- [x] Specify memory-only transient rendering and no-file/watch-feedback tests;
      clarify README links to registration, attribution, inspection, and controls.
- [x] Validate changed Markdown, local links, and the normative TypeScript
      declarations. Keep feature code unimplemented and the plan Active.

## Milestone 2: Build component registration and ownership — completed

Deliver tested internal authoring/build support while current public catalogues
continue to work. Standalone generated fixtures prove the component renders.

- [x] Implement typed/runtime-validated definitions, variants, controls metadata,
      slot declarations, component wrappers, and explicit repeated-instance ids.
- [x] Share the explicit prop-schema validator and canonical codec across all
      callers; test rejected JS/TS inputs, optional/uncontrolled fields, unions,
      nested values, key round trips, negative zero, and mutation isolation.
- [x] Preserve explicit dependency provenance in v4 so source attribution cannot
      create false exact-screen dependency evidence, including explicit overlaps.
- [x] Extend source attribution, collection validation, discovery, and the
      single consumer graph without inferring usage from import lists.
- [x] Capture actual per-view instances, input material, caller-owned slots,
      parent/owner relationships, order, and layout-neutral DOM ranges.
- [x] Verify deterministic fixed-size instance/slot keys through deep nesting
      and forwarding; reject invalid digests and conflicting duplicate records.
- [x] Extend the existing renderer for components and optional style/resource
      ownership, retaining plain-string renderers and consumer theme providers.
- [x] Generate variant fragments and manifest v4; retain v3 output bytes for
      unregistered catalogues and existing v2/v3 baseline readers.
- [x] Implement the normative manifest types/validator with shared accepted and
      rejected fixtures, reference/path checks, and deterministic serialization.
- [x] Validate nested/multi-root/text/null boundaries, reserved metadata,
      compatibility transforms, owned dependencies, and unsupported inputs.
- [x] Extend transactional output, collision/orphan checks, links, variant
      resources, and id destinations through existing shared validation.
- [x] Add unit/integration fixtures for duplicate/missing identities, slots,
      repeated/nested instances, invalid metadata, both viewports/themes,
      renderer failures, and unregistered/legacy compatibility; build and run
      focused tests and standalone rendering smoke checks.

## Milestone 3: Attribute changes and publish component data — completed

Deliver one tested classification policy and complete comparison artifacts,
with lightweight Browse detection and no eagerly generated snapshots.

- [x] Add failing regressions for a component-only edit currently flagging its
      consumers through raw generated paths, broad dependencies, or shared impact.
- [x] Implement owner-aware normalization and input comparison; retain slot
      material, repeated-instance order, empty instances, and one-sided adoption.
- [x] Attribute implementation changes observed only at actual consumer props,
      while preserving metadata-only affected eligibility and manual-ignore adoption.
- [x] Compare component variants without suppressing their own root; classify
      nested child implementation and parent-supplied input changes separately.
- [x] Integrate owned source/assets/head styles and conservative mixed/global
      evidence without globally removing existing dependency or ignore rules.
- [x] Keep complete-render view states separate from direct Changes reasons;
      component suppression must not masquerade as a manual ignore.
- [x] Make Browse, watch updates, comparison results, counts, and use-case
      propagation use the same direct-change/affected distinction.
- [x] Generate component results and baseline/current affected-consumer links,
      including transitive use, removed screens/components/variants, and explicit
      missing sides; keep before/after documents and assets unmodified.
- [x] Extend served/published data and artifact packaging, historical schema
      readers, immutable generations, and cache invalidation for component views.
- [x] Implement the normative result schema and Changes reasons; share fixtures
      across producers/readers to prove exact membership, sides, and usage chains.
- [x] Test every attribution-contract table row, unchanged-render prop changes,
      slots, simultaneous component/screen edits, asset-only changes, migration,
      light/dark/mobile/desktop, and no snapshot work from ordinary browsing.
- [x] Run focused suites and comparison/build smoke checks; prove published
      component data and isolated resources agree with local classification.

## Milestone 4: Design component pages and screen inspection — completed

Tags: mockup

Establish the visual contract in the existing generated design catalogue before
implementing the shell UI. No backend work belongs in this milestone.

- [x] Reuse the owning components in `examples/basic/entries/design/parts`;
      create distinct mobile and desktop screens for component browsing, saved
      variants, comparisons, Used by, and changed-component Affected screens.
- [x] Design screen Details usage/props, nested and repeated selection,
      highlighting, and empty/unavailable/removed states with accessible controls.
- [x] Give Toolbar and hidden Help hint usage links their own selected-instance
      artboards; keep a removed consumer's independent Changes membership explicit.
- [x] Show component-only versus direct-screen Changes membership and counts.
      Link component and screen views through the existing catalogue navigation.
- [x] Split owning screen-spec pages at five screens; give nonterminal pages
      a canonical representation and linked child pages. Keep screen components
      reusable, flow links correct, and engineering notes outside the screens.
- [x] Update the shell design contract and example README; run
      `npm run example:build`, `npm run example:check`, and relevant design tests.
      Open every changed generated page directly from disk in both variants and
      inspect its layout. Commit matching generated HTML with its source.

Delivered eighteen owning screens and thirty-six mobile/desktop artboards.
All seventeen focused browser tests pass, including served navigation, and all
artboards were visually inspected from disk. `cargo xtask check` passes with
402 TypeScript tests, 93 browser tests, and 3 Rust tests, plus the build,
format/lint/type, generated-output, package, and Rust checks. An existing watcher
test timed out on the first run; its isolated retry and the full rerun passed
without changing the test or runtime.

## Milestone 4a: Scope design stylesheet impact and integrate main — completed

Tags: mockup

Resolve the approved review finding without reopening Milestone 4, preserving
the latest mainline design catalogue and its working navigation links.

- [x] Add failing regression coverage for all three component stylesheets, then
      remove their global shared-impact entries and retain scoped dependencies.
- [x] Update the design contract and example README to explain scoped impact.
- [x] Merge latest main, resolve conflicts path by path, and preserve its design
      navigation, generated screens, tests, and docs alongside component mockups.
- [x] Extend the complete design inventory and link checks to both families;
      verify component controls do not inherit unrelated Browse transitions.
- [x] Synchronize browser assertions with real on-demand comparison responses
      after reproducing cold-generation timeouts; retain all behavior checks.
- [x] Regenerate affected mockups, run focused tests and visual smoke checks,
      then pass `cargo xtask check` and inspect the diff against `origin/main`.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after the push and report any new findings.
- [x] Create a pull request against `main` describing the complete branch scope,
      validation, and any remaining review findings.

Delivered in `231a451`, merging main at `93ac778`, with all 56 mainline artboards
preserved byte for byte. [PR #48](https://github.com/mokly-ai/mokly/pull/48)
records the completed post-push review and its four findings for user decision;
no review-driven code fixes were applied. The pending delivery checklist observed
during review is now complete. `cargo xtask check` passed with 431 TypeScript,
111 browser, and 3 Rust tests; Node 22.14/24 CI and the PR preview also passed.

## Milestone 4b: Complete the reviewed inspector mockups — completed

Tags: mockup

Apply the approved visual and review recommendations without reopening earlier
milestones. Share the inspector across component and consuming-screen designs.

- [x] Specify icon-panel behavior and remove design-only footer navigation from
      artboards, retaining discoverability through the owning catalogue.
- [x] Add regressions, then use stable component/screen identities and actual
      artboard destinations for current-page links, including saved variants.
- [x] Declare explicit component metadata for labels, ids, sources, and dependencies.
- [x] Implement the shared Info, Components, Props/Controls, and Usage inspector:
      open/switch/close, no selected icon when closed, accessible native controls,
      and distinct mobile/desktop closed-panel artboards.
- [x] Reproduce stale comparison-response matching; correlate browser waits with
      the initiating request, its redirects, and refresh intent.
- [x] Regenerate all affected artboards, preserve existing non-component designs,
      and verify links, metadata, responsive layout, selection, and keyboard use.
- [x] Pass focused suites and `cargo xtask check`; inspect the diff and deletions.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report new findings for user decision.
- [x] Update PR #48 with the complete mockup sign-off scope and validation.

Mockup implementation and visual verification are complete: 31 owning screens,
62 mobile/desktop artboards, and all 56 existing mainline HTML files preserved
byte for byte. `cargo xtask check` passed with 439 TypeScript, 122 browser, and
3 Rust tests, including build, formatting, lint, typechecking, generated-output,
package smokes, and Rust checks. Implementation commit `646bb43` is pushed;
the post-push `cargo xtask review` completed and its findings are recorded in
[PR #48](https://github.com/mokly-ai/mokly/pull/48). The review's pending
handoff observation is closed by this delivery record. Three low-priority
follow-ups remain for user decision: stale counts in neighboring docs,
incomplete focused-test guidance, and a manually maintained browser route list.
The controls table formatting was corrected independently during handoff;
no other new review fixes were applied. Published-preview checks passed for
inspector open/close, controls navigation, and read-only saved variants.

## Milestone 4c: Refine view controls and inspector layout — completed

Tags: mockup

Apply the [workspace design revision](../docs/protocol/mokly-component-workspace-design.md)
without reopening completed mockup milestones or implementing the runtime.

- [x] Inspect the supplied screenshots and specify nested-component tab scope,
      grouped view controls, comparison eligibility, scrolling, and resizing.
- [x] Capture failing regressions for inactive viewport controls, comparison
      controls on unchanged examples, and enclosing page/panel scrolling.
- [x] Group icon controls beside the title; make viewport, scheme, and fixture
      highlighting work natively, retaining inputs while switching contexts.
- [x] Hide Nested components for leaves; retain it for composed components and
      preserve the screen inspector's empty/unavailable states.
- [x] Bound the shell and pane contents, add an inspector resize grip, and verify
      that resizing, scrolling, and closing keep headers and tabs reachable.
- [x] Keep comparison controls on changed/affected examples and show Unmodified
      for unchanged examples without treating temporary prop edits as Changes.
- [x] Update owning docs and README, regenerate all artboards, preserve mainline
      output, and visually inspect mobile/desktop plus Both/Dark interactions.
- [x] Integrate main’s Changes/resource-watch update, preserve its source and
      generated screens, and adapt stylesheet attribution tests to rendered resources.
- [x] Run focused tests and `cargo xtask check`; inspect the diff and deletions.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report new findings for user decision.
- [x] Update PR #48 with the revised sign-off scope and validation.

Validation: all 493 TypeScript unit/integration tests, 133 Chromium tests, and
3 Rust tests passed through `cargo xtask check`, including package smokes and
format/lint/type/generated-output checks. All 62 component artboards and the
Both/Dark/resized states were visually checked. Main at `a5ecbc0` is integrated
with its runtime source and 56 artboards preserved. The local check used Xcode’s
Git executable directly to avoid launcher delays; test deadlines are unchanged.
Implementation commit `80195d6` is pushed and its post-push `cargo xtask review`
completed. [PR #48](https://github.com/mokly-ai/mokly/pull/48) contains the full
sign-off inventory, validation, and review findings. The review found stale
inventory counts in two neighboring protocol summaries; those remain unchanged
for user decision. Its pending-handoff observation is closed by this delivery
record. Published mobile/desktop checks passed for view controls, field retention,
nested-component tabs, highlights, and closing; resize checks also passed when
opening the deployed artboards directly. The mockup uses a native resize grip;
the full-width, keyboard-accessible runtime divider remains in Milestone 5.

## Milestone 4d: Stabilize integrated design navigation checks — completed

CI exposed an existing test sequence that clicks controls in the previous frame
before the preceding catalogue navigation finishes. Keep real navigation and
assertions intact while making the test wait for each intended destination.

- [x] Reproduce the CI failure with a delayed real navigation response before
      changing the browser sequence.
- [x] Assert the intermediate destinations before activating their controls;
      document the sequencing rule for in-frame navigation checks.
- [x] Run focused browser checks and `cargo xtask check`; inspect the diff.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report findings for user decision.
- [x] Record CI and PR handoff after verification finishes.

Validation: both viewport sequences failed with a delayed real response before
the correction, then all five design-link checks passed with that delay retained.
`cargo xtask check` passed all 493 TypeScript, 133 Chromium, and 3 Rust tests,
including package smokes and all formatting/lint/type/generated-output checks.
Only test sequencing and its documentation changed; runtime source and generated
artboards remain unchanged from the reviewed implementation.

Commit `4fa47f0` is pushed and its required post-push review completed. That
review reports the same stale inventory summaries (Low) and pending delivery
record (Medium); the former remains for user decision and the latter is closed
by this record. Neither of those first two passes reported implementation findings.
Release Node 24 CI passed the complete gate. The unchanged mainline resource
watcher test intermittently observed a replacement's temporary missing-file state
on Node 22 and was retried; CI history and current status are recorded in
[PR #48](https://github.com/mokly-ai/mokly/pull/48). The published artboards are
unchanged from the verified Milestone 4c preview.

## Milestone 4e: Await completed resource replacements in tests — completed

The unchanged mainline watcher test repeatedly fails on CI when a multi-event
file replacement publishes its temporary missing-file state before the final
resource. Verify the intended final state without changing runtime watch behavior.

- [x] Reproduce the failure by explicitly observing the intermediate removal
      update before restoring the resource.
- [x] Extend the bounded watch-test wait to accept the expected catalogue state,
      keeping existing assertions and timeout budgets intact.
- [x] Run focused resource-watch tests and `cargo xtask check`; inspect the diff.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report findings for user decision.
- [x] Record verification and PR handoff after the checks finish.

Validation: observing the intermediate removal reproduced the original count
assertion failure before the correction. All 10 focused resource-watch tests
then passed, followed by `cargo xtask check` with all 493 TypeScript, 133 Chromium,
and 3 Rust tests, package smokes, and format/lint/type/generated-output checks.
The 20-second wait deadline, final assertions, runtime, and artboards are intact.

Commit `5cdd78e` is pushed. Its [CI run](https://github.com/mokly-ai/mokly/actions/runs/34390399505)
passed the full gate on Node 22.14 and Node 24, including Required CI; Preview
also deployed successfully. The third required post-push review completed with
three follow-ups for user decision: comparison controls with no action (Medium),
a duplicated browser route inventory (Medium), and stale secondary document
counts (Low). All 31 current routes are covered; the inventory finding concerns
future additions. The review's fourth finding, pending handoff bookkeeping (Low),
is closed by this delivery record. Findings and recommendations are recorded in
[PR #48](https://github.com/mokly-ai/mokly/pull/48); no new review fixes were
automatically applied.

## Milestone 4f: Clarify comparison and highlight mockups — completed

Tags: mockup

Apply the next design feedback to comparison evidence, status labels, disabled
highlight explanations, and outline geometry. Runtime work stays in later milestones.

- [x] Capture failing regressions for comparison placement, status scope,
      disabled highlight descriptions, and label/outline geometry.
- [x] Replace authored change prose with structured fixture evidence in Details;
      remove the extra banner and canvas disclosure.
- [x] Show Added, Changed, Removed, and Unmodified entry badges, including a
      linked mobile/desktop Added example with an explicit missing Before side.
- [x] Explain each disabled highlight state and share clean chip/outline styling
      across outer, nested, and single-instance regions.
- [x] Align protocols, README, generated artboards, and focused tests; visually
      inspect every changed mobile/desktop page and interaction.
- [x] Run `cargo xtask check`, inspect the diff and mainline preservation.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report findings for user decision.
- [x] Record verification and update the PR handoff.

Validation: all 10 new browser regressions failed against the previous mockups
and pass with this revision. All 47 focused browser and 21 catalogue tests pass.
All 64 mobile/desktop artboards were opened from disk and visually inspected,
including Details and highlight outlines. `cargo xtask check` passed all 493
TypeScript, 143 Chromium, and 3 Rust tests, along with format/lint/type checks,
121-file generated-output verification, package smokes, and Rust checks. All 56
mainline HTML artboards remain byte-identical; no runtime code or mainline file
was removed.

Commit `63d0634` is pushed and its required post-push review is complete.
[CI](https://github.com/mokly-ai/mokly/actions/runs/34401740976) passed on Node
22.14 and Node 24, including Required CI. The
[preview](https://pr-48.mokly.pages.dev/view/design/components/overview)
deployed successfully; published checks verified comparison Details, status
badges, empty highlighting, and Both/Dark highlighting in mobile/desktop frames.

The review reported three findings: handoff bookkeeping (Medium), a duplicated
browser route inventory (Medium), and stale secondary documentation counts (Low).
This post-review delivery record closes the existing handoff task. Independent
verification confirms all 32 routes are covered today; deriving that list from
the manifest and replacing duplicate prose counts with a canonical inventory
link remain recommendations for user decision. No new review fixes were applied.
The complete findings and options are recorded in
[PR #48](https://github.com/mokly-ai/mokly/pull/48).

## Milestone 4g: Refine inspector surfaces and icons — completed

Tags: mockup

Replace the corner resize treatment with the existing divider style, make the
mobile inspector a bottom sheet, and correct the Usage/menu/dropdown glyphs.

- [x] Capture failing browser regressions for centered desktop dragging, mobile
      sheet placement/expansion, and SVG alignment.
- [x] Reuse the navigation divider's handle for desktop resizing and preserve
      bounds, close/reopen sizing, fixed tabs, and independent scrolling.
- [x] Add the mobile bottom sheet, iOS-style grabber, touch/keyboard size toggle,
      close/reopen behavior, safe-area spacing, and retained field edits.
- [x] Replace the misaligned menu/caret glyphs with SVGs and redraw Usage.
- [x] Update contracts/README, regenerate artifacts, and visually inspect all
      mobile/desktop pages and the changed interactions.
- [x] Run focused tests and `cargo xtask check`; audit mainline preservation.
- [x] Integrate main's preview-icon update; preserve its watcher helpers and
      tests while retaining the branch's explicit intermediate-removal wait.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after pushing; report findings for user decision.
- [x] Record the completed verification and update the PR handoff.

Local verification for Milestone 4g passed: 497 TypeScript unit/integration
tests, 149 Chromium browser tests, and 3 Rust tests, plus every other full-gate
check. All 64 artboards and the expanded/closed/resized states were visually
inspected. Main `aa5adea` is integrated with its preview icons and watcher
helpers intact; all 56 mainline HTML artboards are byte-identical and `src/`
has no diff from main. Implementation commit `ebb1ccb` is pushed and its required
post-push review is complete.

The review repeated the manual browser-route inventory (Medium) and stale
secondary protocol counts (Low) recommendations recorded under Milestone 4f.
All 32 current routes match the manifest; neither recommendation has been
automatically applied. Its delivery-bookkeeping finding is covered by this
existing handoff task. Published smoke checks pass for desktop/mobile icons,
mobile sheet sizing, close/reopen retention, Usage, and Both/Dark highlighting.
[CI](https://github.com/mokly-ai/mokly/actions/runs/34406794097) passed on Node 22.14
and Node 24, including Required CI. Node 24 passed after retries for an npm
connection reset and one existing published-navigation timeout. Six focused
navigation repetitions passed unchanged locally; test timeouts and assertions
remain intact.
The [preview deployment](https://github.com/mokly-ai/mokly/actions/runs/34406794146)
succeeded.

## Milestone 4h: Divider alignment and comparison eligibility — completed

Tags: mockup

Apply the latest design feedback across the complete owning-screen inventory.

- [x] Add failing divider-line and catalogue-wide comparison regressions.
- [x] Center the desktop grip on its divider and preserve bounded resizing.
- [x] Require explicit changes before showing comparisons; retain their opaque
      background, remove irrelevant controls from all Browse/unchanged designs,
      and keep comparison evidence in Details.
- [x] Derive the browser design inventory from the manifest and link secondary
      docs to the canonical inventory instead of maintaining stale counts.
- [x] Regenerate, run focused tests, and visually inspect every owning artboard.

## Milestone 5: Implement component pages and inspection — completed

Tags: ui

Deliver the designed shell against the validated backend records. No backend
or rendering-contract changes belong in this milestone.

- [x] Reuse shell navigation, search/tags, Details, preview, and comparison
      components; add component entries, saved-variant selection, and suitable
      canvases with viewport/theme and URL/history behavior.
- [x] Ensure fragment swaps replace iframe history so Back/Forward navigates
      saved variants and catalogue pages without hidden frame-history stops.
- [x] Implement the grouped viewport/theme/highlight icon controls with working
      Mobile/Desktop/Both contexts and comparison eligibility from real evidence;
      show Unmodified only for known unchanged saved examples.
- [x] Render Added/Changed/Removed/Unmodified entry badges and factual comparison
      Details from validated records and paired props; keep entry/variant status
      distinct and explain disabled highlighting with its specific reason.
- [x] Keep shell headers and inspector icons fixed around desktop sibling panes;
      implement the centered full-width draggable, keyboard-accessible divider,
      bounded sizing, and close/reopen behavior from the workspace design.
- [x] Implement the mobile bottom sheet over the preview, with safe-area spacing,
      an iOS-style grabber, pan gestures, compact/expanded snap heights, accessible
      size changes, fixed tabs, and retained edits when closing/reopening.
- [x] Show Nested components only for component pages with recorded children;
      preserve explicit empty/unavailable inspection on screen pages.
- [x] Render Used by/Affected screens from actual current/baseline evidence,
      including removed consumers and links into the correct screen instance.
- [x] Add the screen Details component tree, counts, props/slots, instance
      selection, and explicit empty/unavailable states for the active view.
- [x] Add the Highlight components toggle, mask/outline/label presentation,
      nested drill-down, and two-way selection between DOM regions and Details.
- [x] Track multi-root/text bounds, clipping, nested scroll, frame resize,
      expansion, fonts/images, viewport/theme swaps, and null/hidden instances
      without changing consumer layout, styles, or inherited opacity.
- [x] Implement keyboard selection, focus return/Escape, inspection click
      handling, comparison exclusion, and full listener/mask cleanup on navigation.
- [x] Add real-shell browser tests for responsive pages, variants/comparisons,
      actual metadata, highlight geometry, accessibility, history, and cleanup;
      smoke-test local saved-variant workflows against mockups.

## Milestone 5a: Integrate component data with static export — completed

Main added the consumer export engine while the workspace UI was being built.
Extend that backend before completing the published inspector work.

- [x] Preserve main's export transaction, delivery identities, security boundaries,
      static aliases, reference closure, captured inputs, tests, and packaging.
- [x] Export current and removed components, variants and consumers from v4
      manifests and v3 comparisons, with the shared direct Changes policy.
- [x] Supply validated baseline/current workspace evidence without snapshot work
      outside the explicit export/comparison lifecycle.
- [x] Add component export regressions, build, and run export integration tests.

## Milestone 5b: Complete the published component workspace — completed

Tags: ui

Complete the UI tasks that depend on the new export engine's component support.

- [x] Use the same package inspector in served/published shells, preserving
      authenticated immediate-frame access and script-disabled consumer frames.
- [x] Preserve static deployment checks, aliases and immutable comparison URLs
      through component variants, Usage links, view controls, and history.
- [x] Smoke-test published saved variants and inspection against both mockup
      layouts; test missing/removed variants, comparisons and listener cleanup.

## Milestone 6: Add the local controls rendering service — completed

Deliver bounded temporary rendering through the existing consumer graph; keep
the endpoint inactive in published output and independent of generated files.

- [x] Implement the typed control schema, overrides/unset validation, generation
      checks, and render request/result/error contracts from the controls spec.
- [x] Add the private POST endpoint with Host/origin/token validation, method,
      body-size, unknown-prop, and component/variant/view enforcement.
- [x] Reuse consumer adapters/providers and the full marker/link/resource
      validation pipeline in a supervised worker with bounded jobs and timeout.
- [x] Return immutable transient preview URLs and usage records; implement
      memory-only bundles, count/byte/lifetime bounds, expiration, valid resource
      resolution, no-store/nosniff headers, and cleanup without disk spill.
- [x] Integrate successful/failed watched replacement, stale-generation handling,
      cancellation, worker recovery, and shutdown with the last-good lifecycle.
- [x] Test control types/presets, malformed or unauthorized requests, unchanged
      committed output, queue/artifact limits, failure/timeout/restart, and shutdown.
- [x] Assert controls create no filesystem output, Git changes, watch events,
      rebuild/reload loops, Check orphans, or publication entries, including with
      a repository-root watch rule; verify memory is released on shutdown.
- [x] Build and smoke-test real consumer rerenders while browsing/watching;
      prove static publishing has no rendering endpoint or background requests.

## Milestone 7: Design editable component controls — completed

Tags: mockup

Extend the component-page design with local controls and published saved-variant
behavior before implementing the new controls UI.
Delivered with 4b for one design sign-off. The mockups use
authored fixture states independent of the runtime rendering service.

- [x] Create mobile/desktop screen components for controls, edited values/reset,
      pending/error/retry, comparison of the saved variant, and read-only controls.
- [x] Cover text, boolean, number, select, optional/unset values, and saved-variant
      switching; use typed shared fixture values for controls and their previews.
- [x] Reuse the component page and existing inspector patterns; link all states
      from their owning pages and follow screen caps, hierarchy, and flow rules.
- [x] Keep copy focused on editing/choosing variants; put prop details in the
      inspector and avoid environment labels or renderer implementation copy.
- [x] Add a read-only Disabled state so published variant links preserve their
      editing boundary, and retain the selected variant when opening Controls.
- [x] Reproduce and fix the controls canvas width regression; assert it matches
      the saved component page in both layouts.
- [x] Update design docs; regenerate/check the example, run relevant tests,
      and visually verify every changed generated page directly from disk.
- [x] Include this milestone in 4b's full check, commit/push, post-push review,
      and PR handoff, with commit/push and review tracked independently.

## Milestone 8: Implement editable component controls — completed

Tags: ui

Connect the designed controls to the existing local rendering service without
introducing backend work or altering committed variant comparison semantics.

- [x] Render text/boolean/number/select controls and optional/unset states from
      real definitions; implement validation, debounce, reset, and preset choices.
- [x] Manage temporary props across viewport/theme changes and discard them on
      variant change, navigation, reload, or entry into saved-variant comparison.
- [x] Handle pending/error/retry/expiration and sequence/generation cancellation
      while retaining the last valid preview and matching inspector metadata.
- [x] Keep published controls read-only, with functional saved variants and no
      requests to local render endpoints; use capability data rather than badges.
- [x] Add browser tests and local/published smoke checks for real prop updates,
      rapid edits, stale responses, reset, navigation, comparisons, failure, and
      responsive keyboard access. Verify the UI against both mockup variants.

Implementation verification so far: component build/attribution and schema suites,
real desktop/mobile inspection and static export browsers, private HTTP/queue/store
contracts, and a watched hung-render/failed-candidate/recovery smoke test pass.
Additional regressions cover dependency-only/adoption Changes and cancelling the
first pending edit when switching context. Final full verification is Milestone 9.

## Milestone 9: Integrate the public API and verify delivery — completed

Enable the complete capability, prove real consumer integration, and bring
documentation into alignment with the tested implementation.

- [x] Export the now-complete public authoring API and types; add clean packed
      ESM/NodeNext and cross-platform consumer coverage using actual components.
- [x] Extend the basic consumer fixture with a shared component used by multiple
      screens, repeated/nested usage, slots, owned styles, and saved variants.
- [x] Update the package README, example README, build architecture, and current
      package/runtime/navigation/Changes/shell protocols with delivered behavior,
      adoption instructions, and static-controls limitations. Retain target status
      on any behavior still incomplete.
- [x] Exercise source/style/prop edits through watched Serve; confirm matching
      Changes counts, affected links, comparisons, and unchanged source artifacts
      during controls edits. Build and smoke-test the published catalogue.
- [x] Run relevant unit/integration/browser/package suites, example build/check,
      lint, formatting, typechecking, and `cargo xtask check` with a 100% pass rate.
      Run Rust fmt/clippy/tests when Rust changes; fix compile failures and retry
      progressing timeouts. Record commands and any real blockers.

`cargo xtask check` passed all 693 TypeScript unit/integration tests, 179 Chromium
browser tests, and 4 Rust tests, plus dependency auditing, formatting, lint,
typechecking, deterministic example verification, package validation and packed
consumer smokes, Rust fmt/clippy, and the file-length audit. The final visual
audit opened all 136 generated HTML views directly from disk and inspected all
23 paired contact sheets. Actual mobile and desktop Action controls were also
exercised and visually checked, including edited values, dark mode, Usage links,
and nested Toolbar highlighting. No verification blockers remain.

## Milestone 10: Commit, push, and review implementation — completed

Deliver the validated implementation through the mandatory post-push review.

- [x] Before integration, capture the source tip, fetch main, and audit its
      additions; preserve mainline features and resolve conflicts path by path.
- [x] After tests and `cargo xtask check` pass, inspect the full diff and
      deletions against `origin/main`, then run `git add -A` so new sources,
      tests, docs, and generated files all enter the review diff.
- [x] Commit using Conventional Commits with a title of at most 50 characters
      and a descriptive body; inspect the committed diff and push the branch.
- [x] Run `cargo xtask review` after that push. Do not automatically fix findings.
      Report every item with severity, feature/code context, impact of doing
      nothing, lettered options, and a recommended scope, considering reusable
      validation, tests, or architectural prevention of the same class of issue.
- [x] Record validation and review disposition, complete the milestones only
      when their tasks are done, and move this plan from Active to Completed.
      Validate and commit/push any final delivery-record update separately.

Implementation commit `f27b8ae` contains the integration with main `a0e349a`,
preserving the captured source tip `b68e84a` as its other parent. Its full check,
post-push review, green Node 22/24 and macOS/Windows CI, and published mobile and
desktop smokes are recorded in the [delivery review](../docs/reviews/component-explorer-runtime.md).
[PR #48](https://github.com/mokly-ai/mokly/pull/48) now describes the complete
implementation. Review follow-ups are recorded separately; none were
automatically fixed.

Documentation-only delivery updates use AGENTS.md's exception: validate changed
Markdown and review the diff instead of repeating `cargo xtask check`, then
commit, push, and run the required post-push review.
