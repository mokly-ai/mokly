# Removed Content Previews

## Status And Outcome

Milestones 1 to 4 are complete: the contract lives in
[removed previews](../docs/protocol/mokly-removed-previews.md), the owning
protocols mark the sentences it replaces, the design catalogue renders every
previous-version state, and the backend captures removed page previews and
delivers previews through Serve and static catalogues. Milestone 5 is next. The user
requested this plan after discussing the removed-document empty state and
agreed preview behavior, then approved the amendments recorded below: reuse
the comparison engine's historical capture for screens, settle the example
output policy, deliver each milestone with its own commit and review, and name
the contract lines to change.

Opening a removed document or screen shows the version from the same Git
branch-point baseline as Changes, with its original local styles and assets.
The title keeps its Removed badge, and the stage says “Showing previous
version.” This makes the deleted content directly reviewable.

Keep this plan Active until its implementation PR merges. Required work must
finish on the branch or as part of that merge; npm publication, deployment,
and downstream adoption are post-merge follow-ups, not completion requirements.

## Scope And Decisions

- Cover registered document pages and screens in local Serve, static catalogues
  with Changes, and `@mokly/viewer`. Keep removed components and saved variants'
  existing comparison behavior, and do not introduce removed user flows.
- Show the historical preview automatically on selection, without a Current
  selector or comparison modes. Pages keep their plain document pane; screens
  retain historical mobile/desktop and available light/dark views.
- Use the pinned Changes baseline, not the latest commit before deletion or a
  reconstruction using current components. Branch edits immediately before
  deletion are not recovered by this feature.
- Reuse the existing historical capture instead of adding a second one. A
  removed screen's previous views are already the `before` panes of its
  comparison: `src/review/screen_compare.ts` writes `beforePath` snapshots for
  every baseline fragment, `src/review/selected.ts` accepts a before-only
  route, component-aware results carry the same paths, and Changes-enabled
  exports package them under the generation root. Only the eligibility gate in
  `src/catalogue/changes.ts` and the empty stage in
  `packages/viewer/src/shell/views.tsx` hide them. Removed pages have no
  comparison records, so they gain a typed page preview captured with the same
  Git asset reader and dependency copier, served from the same generation
  lifecycle, and packaged under the same generation root.
- Preserve historical metadata, textual ancestry, search/filter membership,
  counts, and current route/ID precedence. Keep existing All/Changes visibility
  rules; do not recreate deleted collection trees or alter current totals.
- Historical content is read-only. Preserve scrolling, text selection, and
  same-document anchors; block forms and cross-document navigation, including
  links into current content. Keep consumer scripts disabled.
- Show loading while a selected preview is captured. Show “Previous version
  unavailable” with a retry for recoverable failures. Never substitute current
  bytes or invented content when historical output or resources are missing.
- Preserve publication defaults: consumer export includes Changes; repository
  preview opts in with `--include-changes`; publish supports `--no-changes`.
  Delivery without Changes has a null comparison URL and therefore no
  historical routes, bytes, or requests.
- Keep ordinary browsing and filtering free of historical snapshot capture.
  Opening a removed item is the explicit capture trigger in development;
  static delivery packages its previews before publication.
- Keep catalogue schema v1. The historical-preview descriptor is an optional
  additive field on `removedEntries`, which the catalogue versioning rules
  allow; older catalogues without it show the unavailable state.

## Contracts And Implementation Boundaries

- [Catalogue changes](../docs/protocol/mokly-catalogue-changes.md),
  [pages](../docs/protocol/mokly-pages.md),
  [Changes](../docs/protocol/mokly-changes.md),
  [static delivery](../docs/protocol/mokly-export-delivery.md), and
  [shell design](../docs/protocol/mokly-shell-design.md) currently specify
  empty removed states and a no-snapshot-on-open rule. Milestone 1 lists the
  exact sentences to replace.
- [Selected comparisons](../docs/protocol/mokly-selected-comparisons.md),
  [derived baselines](../docs/protocol/mokly-derived-baselines.md), and
  [source protection](../docs/protocol/mokly-source-protection.md) establish
  historical readers, bounded capture, and resource confinement. Screens reuse
  `RepositorySelectedReview` and the packaged complete comparison; pages add a
  page selection to the generation service in `src/server/` and to export
  assembly in `src/export/site.ts`, without treating pages as screens or adding
  page comparison records to `review.json`.
- [Public catalogue](../docs/protocol/mokly-catalogue.md),
  [viewer](../docs/protocol/mokly-viewer.md), and
  [frame adapters](../docs/protocol/mokly-frame-adapter.md) own the package
  boundary. Extend `src/catalogue/` and `packages/viewer/src/catalogue/` with
  the additive historical-preview descriptor; current paths stay null for
  removals.
- [Static delivery](../docs/protocol/mokly-export-delivery.md),
  [publication](../docs/protocol/mokly-publication.md), and
  [upload](../docs/protocol/mokly-upload.md) own packaged URLs, inventories,
  deployment identity, and transactional delivery through `src/export/`.
- [Shell design](../docs/protocol/mokly-shell-design.md) and the
  [basic example](../examples/basic/README.md) own the mockups. Reuse
  `examples/basic/entries/design/page_screens.tsx`, `review_outcome_screens.tsx`,
  and shared `parts/`; runtime presentation belongs in the existing
  `packages/viewer/src/shell/`, `client/`, and `viewer/` components.

## Working Rules

Each milestone leaves a functioning product and ends with its checks, a
Conventional Commits commit, a push, and a review of the complete local diff
against `origin/main` using
[docs/implementation-review-prompt.md](../docs/implementation-review-prompt.md).
Report review findings numbered, with severity, context, the impact of doing
nothing, lettered options, and a recommendation; never fix them automatically.
Add regression tests before changing existing behavior, and keep docs aligned
with delivery status. Complete all initially known mockup work in Milestone 2
before UI work. If backend work is discovered during a tagged milestone, insert
a new backend milestone immediately after it and a new tagged milestone
immediately after that; move blocked tasks there without marking them complete.

Example output policy: the example uses the default derived mode. Generated
HTML and `mokly-manifest.json` under `examples/basic/generated/` are ignored
local artifacts validated by `npm run example:check`; only the authored CSS
there is tracked. The stale `AGENTS.md` instruction to commit generated output
was corrected in the same commit as this amendment. Never force-add ignored
artifacts or switch the example to committed mode.

## Milestone 1: Define the historical-preview contract

Specify the complete behavior and delivery boundaries before implementation.
Documentation-only: validate Markdown and links instead of `cargo xtask check`.

- [x] Replace the shipped empty-state and no-capture sentences with the planned
      behavior, marked by delivery status until implementation lands (also
      applied to the runtime, component explorer, workspace design, inspector
      design, component design, viewer, frame adapter, and catalogue contracts):
  - `mokly-changes.md`: “known removed screens show Removed with a current
    empty state and no comparison band”; “opening a screen … do not generate
    comparison snapshots in development”; “Removed screens remain discoverable
    in Changes and show an explicit current empty state without offering a
    comparison”; “No comparison data or snapshot document is requested until a
    user selects a diff”.
  - `mokly-catalogue-changes.md`: “The removed page view shows an explicit
    missing-current state” and the publication paragraph's “missing-current
    views”.
  - `mokly-pages.md`: “Pages expose Current only; they do not trigger snapshot
    generation”.
  - `mokly-selected-comparisons.md`: “Current, navigation and filtering never
    request snapshots”.
  - `mokly-export-delivery.md`: “Removed screens retain their current empty
    state without comparison modes”.
  - `mokly-shell-design.md`: the `design-review-removed` and
    `design-page-removed` table rows and “Removed screens show a status badge
    and current empty state instead”.
- [x] Specify selection, baseline provenance, views, copy (“Showing previous
      version”, “Previous version unavailable”), failure/retry, navigation
      restrictions, and unchanged component-variant comparison behavior. Note
      that the shell copy “Select a comparison to see the previous screen” is
      replaced because removed screens offer no comparison.
- [x] Specify screen previews as the `before` views of the existing selected or
      packaged comparison result: which `beforePath` views render, how
      viewport/scheme choices map onto the available historical views, and that
      the comparison band, Props edits, and current inspector bindings stay
      absent.
- [x] Define the typed page-preview selection and response: the request shape
      on the stable selected endpoint, the generation-bound descriptor and
      snapshot path, reader validation, and how the packaged export exposes the
      same path relative to `comparisonUrl`. Keep `review.json` and its schema
      unchanged; pages add no comparison records.
- [x] Define the optional additive `removedEntries` descriptor in catalogue v1:
      fields, availability semantics, privacy (no source paths or baseline
      metadata), and old/new reader compatibility. The shipped fixture changes
      in Milestone 3: today's reader drops the unknown field and the serializer
      cannot emit it, so the fixture's byte round-trip test would fail first.
- [x] Specify loading for local and embedded viewers from advertised paths only,
      including object/URL sources and both frame adapters. The viewer must not
      discover private CLI endpoints, run Git, or infer a historical URL from a
      removed entry's current path.
- [x] Reuse the selected-capture lifecycle for page previews: retention, idle
      renewal by HEAD, cancellation, coalescing, queue/byte bounds, shutdown,
      and evidence invalidation. Pin metadata and bytes to the same accepted
      removal snapshot; never rebuild a baseline during an HTTP request.
- [x] Specify script-disabled, read-only delivery for same-origin and
      cross-origin frames. Keep original captures and existing comparison bytes
      unchanged. Preserve the external-resource policy without promising offline
      copies of external assets; expose no source files or private baseline data.
- [x] Define strict static capture: an included page preview must have a
      complete permitted local resource closure or export fails transactionally,
      matching the existing screen snapshot rule. Preserve current-only
      delivery's zero-history behavior and command defaults.
- [x] Update relevant READMEs and protocol links with clear delivery status, and
      validate Markdown, links, and the documentation diff. The packaged guides
      describe shipped behavior in present tense, so
      `docs/guides/catalogue/changes.md` changes in Milestone 5 instead.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, review the complete local diff against `origin/main` with
      the implementation review prompt; report findings without changing the
      plan or docs.

## Milestone 2: Specify removed-content designs

Tags: mockup

The design catalogue demonstrates every planned state at mobile and desktop
widths while the existing application remains functional.

- [x] Reuse the existing shell, document, frame, status, and inspector
      components. Replace the removed-document design's empty stage with its
      historical handbook, retaining the flat Changes row and deleted-parent
      ancestry.
- [x] Update the removed-screen design with historical device frames, available
      viewport/scheme controls, Removed badge, and “Showing previous version.”
      Omit comparison modes and editable component/Props actions.
- [x] Add loading, unavailable-with-retry, and long-document scrolling/anchor
      states as child pages under `design/browse/pages/previous-version/` and
      `design/review/outcomes/previous-version/` — a `removed/` segment would
      collide with the exported `removed.html` alias — so the collections stay within
      five screens. Each parent removed page renders its canonical preview and
      links to its children; every state is its own mobile and desktop
      component reachable from Browse/Changes navigation. Served and exported
      previews look identical, so no static-delivery variant is designed.
- [x] Use established typography and surfaces, with no left-edge accent rail,
      environment labels, or engineering annotations inside rendered screens.
- [x] Update the example README and the shell-design protocol's route table and
      grouping notes; run `npm run build`, `npm run example:build`,
      `npm run example:check`, and relevant design tests. Commit only tracked
      authored CSS; generated HTML and the manifest stay ignored.
- [x] Start `npm run dev`, visually inspect every changed mobile and desktop
      design, and save screenshots under `.context/` before UI work begins.
- [x] Discovered during the mockups: the
      [design links contract](../docs/protocol/mokly-design-links.md) still says
      “Removed Farewell shows a current empty state without comparison modes and
      has no live product destination,” and its delivery status still counts 33
      design screens. Replace that sentence with the previous-version behavior,
      record the removed family's Changes rows as canonical destinations, and
      refresh the count. Left unchanged by the delegated mockup work because its
      scope named only `mokly-shell-design.md`; closed in the follow-up commit.
- [x] Run `cargo xtask check`; then `git add -A`, commit with Conventional
      Commits, and push the branch.
- [x] After the push, review the complete local diff against `origin/main` with
      the implementation review prompt; report findings without changing the
      mockups.

## Milestone 3: Capture typed historical page previews

Implement the reusable backend capability without changing visible shell
behavior. Screens need no new capture; this milestone proves the existing
before-only comparison path and adds page capture beside it.

- [x] Add failure-first tests for removed screens through
      `RepositorySelectedReview` and the complete comparison in committed and
      derived modes: before-only v2 and v3 results, older supported manifests,
      multiple screen views, deleted local assets, and missing baseline output.
- [x] Add failure-first tests for removed pages: missing document, deleted
      local assets, invalid baseline data, historical page-v4 manifests, and
      current files sharing a deleted resource's path.
- [x] Implement the typed page-preview selection over the accepted removed-entry
      snapshot and pinned `BaselineReader`, using `GitReviewAssetReader` and
      `copySnapshotDependencies` for the document and its transitive closure.
- [x] Retain styles, nested CSS imports, images, fonts, and embedded resources
      from that baseline. Prove that current files with the same paths cannot
      replace deleted or changed historical bytes.
- [x] Apply existing source/public exclusions, path and regular-file validation,
      size bounds, and reserved-file protections to every transitive read. Test
      traversal, symlinks, private manifests, and authored-source references.
- [x] Add the historical descriptor to pure public projection, strict readers,
      serialization, and fixtures, including the shipped
      `docs/protocol/fixtures/catalogue-v1.json` with one removed page and one
      removed screen. Keep current paths null, metadata private, route/ID
      conflict precedence intact, and page comparison records absent.
- [x] Test screen-only and component-aware catalogues, historical usage whose
      component metadata is unavailable, and old/new reader compatibility.
      Preserve removed component and saved-variant comparison coverage.
- [x] Run build, typecheck, and focused baseline, resource, catalogue, and review
      tests; keep relevant module READMEs and contracts aligned.
- [x] Run `cargo xtask check`; then `git add -A`, commit with Conventional
      Commits, and push the branch.
- [x] After the push, review the complete local diff against `origin/main` with
      the implementation review prompt; report findings without changing the
      implementation.

## Milestone 4: Deliver previews in Serve and static catalogues

Connect page capture to the bounded generation service and complete exports;
screens already flow through both.

- [x] Add server regressions before wiring requests: a removed screen route
      resolves to a before-only generation, a removed page route resolves to a
      page-preview generation, ordinary navigation/filtering does no capture,
      and requests never compile or reclassify the catalogue.
- [x] Extend the selected generation service with the page selection kind.
      Serve its descriptor and snapshot files with GET/HEAD parity and the
      established `no-store`/`nosniff` protections. Fence refreshes, evidence
      changes, restore/redelete cycles, and route reuse so stale work cannot
      publish.
- [x] Reuse bounded admission, pending-request coalescing, cancellation, retained
      generations, idle renewal, and shutdown cleanup. Test generation expiry,
      failed retries, invalid selections, and source/base changes during capture.
- [x] Preserve fast startup and background preparation in watched and no-watch
      Serve. Test preparing/unavailable evidence and confirm current entries
      remain usable when historical previews cannot be prepared.
- [x] Package page previews for Changes-enabled export, publish packaging, and
      repository preview under the same generation root as the comparison, from
      the single pinned baseline. Include them in ownership inventories,
      reference validation, deployment hashes, and upload archives; preserve
      atomic rollback on failure.
- [x] Prove current-only delivery performs no historical work or requests and
      removes old historical files when replacing a Changes-enabled artifact.
      Static previews must not require live capture, renewal, or watch endpoints.
- [x] Run build and focused server, lifecycle, export, publication, upload, and
      catalogue tests; update affected READMEs and protocols.
- [x] Run `cargo xtask check`; then `git add -A`, commit with Conventional
      Commits, and push the branch.
- [x] After the push, review the complete local diff against `origin/main` with
      the implementation review prompt; report findings without changing the
      implementation.

## Milestone 5: Render previous content across the shared viewer

Tags: ui

Activate the completed designs through the shared shell and both viewer hosts.

- [ ] Add shell/client, embedded-viewer, and browser regressions before replacing
      empty stages. Reuse existing base/frame components and one shared preview
      presentation for pages and screens where their behavior matches.
- [ ] Automatically request the selected removed entry's generation: the
      existing selected comparison for a screen, the page preview for a page.
      Keep the Removed badge and historical Details, show the previous-version
      label, render pages in a document pane, and render screens from their
      `before` views with the baseline viewport/scheme choices.
- [ ] Implement loading, real unavailable states, and retry. Revalidate saved
      viewport/theme choices against historical capabilities without inventing
      views; keep catalogue navigation usable throughout failures.
- [ ] Keep removed screens/pages outside comparison modes, including incoming
      comparison URLs, while leaving the eligibility gate for changed screens and
      removed component variants unchanged. Do not expose Props edits,
      current-document inspector bindings, or current usage/comment markers
      against a historical frame.
- [ ] Enforce read-only forms and navigation without breaking scrolling, text
      selection, or same-document anchors. Test links, keyboard activation,
      forms, popup/download attempts, and both frame adapters.
- [ ] Fence late responses on navigation, evidence/source replacement, unmount,
      and viewport/scheme changes. Test Back/Forward, direct old routes, ID/route
      reuse, idle recovery, embedded controlled selection, and multiple viewers.
- [ ] Update `docs/guides/catalogue/changes.md` so its Added and removed
      section describes the shipped previous-version behavior in present tense.
- [ ] Run focused shell/client/viewer and browser tests. Smoke-test real served
      and exported removed pages/screens at mobile and desktop sizes; compare
      them with Milestone 2 and save screenshots under `.context/`.
- [ ] Run `cargo xtask check`; then `git add -A`, commit with Conventional
      Commits, and push the branch.
- [ ] After the push, review the complete local diff against `origin/main` with
      the implementation review prompt; report findings without changing the
      implementation.

## Milestone 6: Verify and deliver the complete change

Complete the implementation and its review before the PR merge boundary.

- [ ] Exercise a real Git fixture with removed documents/screens, deleted
      ancestors and assets, changed historical CSS, and branch edits before
      deletion. Verify baseline identity and rendered resource bytes in local
      Serve, consumer export, both repository preview options, and an embedded
      viewer mounted from a packed package.
- [ ] Run all relevant tests with a 100% pass rate, package builds, example
      build/check, lint, typecheck, packed-consumer checks, and browser suites.
      Run `cargo xtask check`; fix failures and rerun affected checks. If Rust
      changes, include fmt, clippy, tests, and the Rust file-length audit.
- [ ] Finalize README/guide/protocol delivery status, fixtures, and mockup
      alignment; leave changelog generation to the release tooling unless it
      requires a manual entry. Validate Markdown and links. Record checks, smoke
      evidence, and remaining risks; tick only completed tasks and move this
      plan's index entry to Completed in the final pre-merge commit.
- [ ] Fetch `origin/main`, audit its additions from a captured pre-integration
      tip, and preserve unrelated features. Inspect the complete diff and
      deletions against `origin/main`; identify the approved replacement of the
      removed-document/screen empty-state behavior and keep all new files tracked.
- [ ] After all checks pass, run `git add -A`, commit the completed work using
      Conventional Commits with a title of at most 50 characters and an
      explanatory body, then push the existing branch. Inspect the committed
      diff and deletions against `origin/main`.
- [ ] Only after the push, use
      [docs/implementation-review-prompt.md](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Do not change
      implementation or automatically fix findings. Report each numbered finding
      with severity, context, impact of doing nothing, lettered solution options,
      and a recommendation that considers broader prevention; if none, state
      that clearly and describe residual test risk.

## Post-merge follow-up (non-blocking)

- Publish the `@mokly/viewer` and `@mokly/mokly` versions that carry the
  descriptor and preview support, then smoke a packed consumer against the
  published packages.
- Deploy a repository preview with `--include-changes` and confirm removed
  previews load from the deployed generation without live requests.
- Recovering the last branch commit before a deletion is a separate history
  feature; it stays out of scope for this plan.
