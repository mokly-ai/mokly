# Removed Content Previews

## Status And Outcome

Planning only; implementation has not started. The user requested this plan
after discussing the removed-document empty state and agreed preview behavior.

Opening a removed document or screen shows the version from the same Git
branch-point baseline as Changes, with its original local styles and assets.
The title keeps its Removed badge, and the stage says “Showing previous
version.” This makes the deleted content directly reviewable.

Keep this plan Active until its implementation PR merges. Required work must
finish on the branch or as part of that merge; npm publication, deployment,
and downstream adoption are not completion requirements.

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
  Delivery without Changes includes no historical routes, bytes, or requests.
- Keep ordinary browsing and filtering free of historical snapshot capture.
  Opening a removed item is the explicit capture trigger in development;
  static delivery packages its previews before publication.

## Contracts And Implementation Boundaries

- [Catalogue changes](../docs/protocol/mokly-catalogue-changes.md),
  [pages](../docs/protocol/mokly-pages.md), and
  [Changes](../docs/protocol/mokly-changes.md) currently specify empty removed
  states. Update those contracts before replacing that presentation.
- [Selected comparisons](../docs/protocol/mokly-selected-comparisons.md),
  [derived baselines](../docs/protocol/mokly-derived-baselines.md), and
  [source protection](../docs/protocol/mokly-source-protection.md) establish
  historical readers, bounded capture, and resource confinement. Reuse these
  boundaries through `src/review/` and `src/server/`, without treating pages
  as screens or introducing page comparison records.
- [Public catalogue](../docs/protocol/mokly-catalogue.md),
  [viewer](../docs/protocol/mokly-viewer.md), and
  [frame adapters](../docs/protocol/mokly-frame-adapter.md) own the package
  boundary. Extend `src/catalogue/` and `packages/viewer/src/catalogue/` with
  explicit historical-preview metadata; current paths stay null for removals.
- [Static delivery](../docs/protocol/mokly-export-delivery.md),
  [publication](../docs/protocol/mokly-publication.md), and
  [upload](../docs/protocol/mokly-upload.md) own packaged URLs, inventories,
  deployment identity, and transactional delivery through `src/export/`.
- [Shell design](../docs/protocol/mokly-shell-design.md) and
  [basic example](../examples/basic/README.md) own the mockups. Reuse
  `examples/basic/entries/design/page_screens.tsx`, `review_outcome_screens.tsx`,
  and shared `parts/`; runtime presentation belongs in the existing
  `packages/viewer/src/shell/`, `client/`, and `viewer/` components.

## Working Rules

Each milestone leaves a functioning product. Add regression tests before
changing existing behavior, and keep docs aligned with delivery status.
Complete all initially known mockup work in Milestone 2 before UI work.
If backend work is discovered during a tagged milestone, insert a new backend
milestone immediately after it and a new tagged milestone immediately after
that; move blocked tasks there without marking them complete.

The example currently uses derived output, while `AGENTS.md` requires committing
generated example HTML and its manifest. Derived-mode Check rejects tracked
generated output. Resolve this instruction conflict in Milestone 1 before
mockup edits; do not silently force-add ignored artifacts or change output mode.

## Milestone 1: Define the historical-preview contract

Specify the complete behavior and delivery boundaries before implementation.

- [ ] Resolve the example output-policy conflict with the user. Recommend
      retaining derived mode and updating the stale generated-commit rule;
      document the agreed tracking and validation requirements before proceeding.
- [ ] Update the owning protocols above and their delivery-status notes to
      distinguish this planned replacement from shipped empty-state behavior.
      Specify selection, baseline provenance, views, copy, failure/retry,
      navigation restrictions, and unchanged component comparison behavior.
- [ ] Define a typed removed-preview provider and an optional public descriptor
      separate from current paths and comparison eligibility. Specify its exact
      request/response shapes, generation identity, public paths, availability,
      and reader validation. Keep catalogue v1 only if the change is additive
      under its versioning rules; update its shipped fixture and compatibility
      requirements accordingly.
- [ ] Specify loading for local and embedded viewers using advertised paths,
      including object/URL sources and both frame adapters. The viewer must not
      discover private CLI endpoints, run Git, or infer a historical URL from a
      removed entry's current path. Older catalogues retain a clear unavailable
      state when the optional capability is absent.
- [ ] Define generation retention, renewal after idle expiry, cancellation,
      coalescing, queue/byte bounds, shutdown, and evidence invalidation using
      the selected-capture lifecycle. Pin metadata and bytes to the same accepted
      removal snapshot; do not rebuild a baseline during an HTTP request.
- [ ] Specify script-disabled, read-only delivery for same-origin and
      cross-origin frames. If presentation transformations are necessary, keep
      original captures and existing comparison bytes unchanged. Preserve the
      existing external-resource policy without promising offline copies of
      external assets, and expose no source files or private baseline metadata.
- [ ] Define strict static capture: an included historical preview must have a
      complete permitted local resource closure or export fails transactionally.
      Preserve current-only delivery's zero-history behavior and command defaults.
- [ ] Update relevant READMEs, catalogue/Changes guides, and protocol links with
      clear delivery status. Validate Markdown, links, and the documentation diff.

## Milestone 2: Specify removed-content designs

Tags: mockup

The design catalogue demonstrates every planned state at mobile and desktop
widths while the existing application remains functional.

- [ ] Reuse the existing shell, document, frame, status, and inspector components.
      Replace the removed-document design's empty stage with its historical
      handbook, retaining the flat Changes row and deleted-parent ancestry.
- [ ] Update the removed-screen design with historical device frames, available
      viewport/scheme controls, Removed badge, and “Showing previous version.”
      Omit comparison modes and editable component/Props actions.
- [ ] Design loading, unavailable, retry, long-document scrolling/anchors, and
      static-delivery states. Show these through linked owning screen-spec pages
      with at most five mockups per page; every screen has its own mobile and
      desktop component, and flows only reuse those components.
- [ ] Keep the designs reachable from existing Browse/Changes navigation. Use
      established typography and surfaces, with no left-edge accent rail,
      environment labels, or engineering annotations inside rendered screens.
- [ ] Update the example README and shell-design protocol; run `npm run build`,
      `npm run example:build`, `npm run example:check`, and relevant design tests.
      Track generated outputs according to the policy resolved in Milestone 1.
- [ ] Start `npm run dev`, visually inspect every changed mobile and desktop
      design, and save screenshots under `.context/` before UI work begins.

## Milestone 3: Capture typed historical previews

Implement the reusable backend capability without changing visible shell behavior.

- [ ] Add failure-first tests for removed pages and screens in committed and
      derived modes, including older supported manifests, multiple screen views,
      deleted local assets, missing output, and invalid baseline data.
- [ ] Implement the typed provider over the accepted removed-entry snapshot and
      pinned `BaselineReader`. Capture a page's single document or a screen's
      historical views using the existing validated resource-copying machinery.
- [ ] Retain styles, nested CSS imports, images, fonts, and embedded resources
      from that baseline. Prove that current files with the same paths cannot
      replace deleted or changed historical bytes.
- [ ] Apply existing source/public exclusions, path and regular-file validation,
      size bounds, and reserved-file protections to every transitive read. Test
      traversal, symlinks, private manifests, and authored-source references.
- [ ] Add the historical descriptor to pure public projection, strict readers,
      serialization, and fixtures. Keep current paths null, metadata private,
      route/ID conflict precedence intact, and page comparison records absent.
- [ ] Test screen-only and component-aware catalogues, historical usage whose
      component metadata is unavailable, and old/new reader compatibility.
      Preserve removed component and saved-variant comparison coverage.
- [ ] Run build, typecheck, and focused baseline, resource, catalogue, and review
      tests; keep relevant module READMEs and contracts aligned.

## Milestone 4: Deliver previews in Serve and static catalogues

Connect the backend capability to bounded live requests and complete exports.

- [ ] Add server regressions before wiring requests: only the selected removed
      route and its resources are captured, ordinary navigation/filtering does
      no capture, and requests never compile or reclassify the catalogue.
- [ ] Serve advertised generation-bound resources with GET/HEAD parity and the
      established cache/MIME protections. Fence refreshes, evidence changes,
      restore/redelete cycles, and route reuse so stale work cannot publish.
- [ ] Reuse bounded admission, pending-request coalescing, cancellation, retained
      generations, idle renewal, and shutdown cleanup. Test generation expiry,
      failed retries, invalid selections, and source/base changes during capture.
- [ ] Preserve fast startup and background preparation in watched and no-watch
      Serve. Test preparing/unavailable evidence and confirm current entries
      remain usable when historical previews cannot be prepared.
- [ ] Capture historical previews for Changes-enabled export, publish packaging,
      and repository preview from their single pinned baseline. Include all
      permitted resources in ownership inventories, reference validation,
      deployment hashes, and upload archives; preserve atomic rollback on failure.
- [ ] Prove current-only delivery performs no historical work or requests and
      removes old historical files when replacing a Changes-enabled artifact.
      Static previews must not require live capture, renewal, or watch endpoints.
- [ ] Run build and focused server, lifecycle, export, publication, upload, and
      catalogue tests; update affected READMEs and protocols.

## Milestone 5: Render previous content across the shared viewer

Tags: ui

Activate the completed designs through the shared shell and both viewer hosts.

- [ ] Add shell/client, embedded-viewer, and browser regressions before replacing
      empty stages. Reuse existing base/frame components and one shared preview
      presentation for pages and screens where their behavior matches.
- [ ] Automatically load the selected removed preview, keep its Removed badge
      and historical Details, and show the previous-version label. Render pages
      in a document pane and screens with their baseline viewport/scheme choices.
- [ ] Implement loading, real unavailable states, and retry. Revalidate saved
      viewport/theme choices against historical capabilities without inventing
      views; keep catalogue navigation usable throughout failures.
- [ ] Keep removed screens/pages outside comparison modes, including incoming
      comparison URLs. Preserve current-entry and component-variant behavior.
      Do not expose Props edits, current-document inspector bindings, or current
      usage/comment markers against a historical frame.
- [ ] Enforce read-only forms and navigation without breaking scrolling, text
      selection, or same-document anchors. Test links, keyboard activation,
      forms, popup/download attempts, and both frame adapters.
- [ ] Fence late responses on navigation, evidence/source replacement, unmount,
      and viewport/scheme changes. Test Back/Forward, direct old routes, ID/route
      reuse, idle recovery, embedded controlled selection, and multiple viewers.
- [ ] Run focused shell/client/viewer and browser tests. Smoke-test real served
      and exported removed pages/screens at mobile and desktop sizes; compare
      them with Milestone 2 and save screenshots under `.context/`.

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
- [ ] Finalize README/guide/protocol delivery status, release notes, fixtures,
      and mockup alignment. Validate Markdown and links. Record checks, smoke
      evidence, and remaining risks; tick only completed tasks and arrange for
      the plan's index entry to move to Completed as part of the implementation
      PR merge, not as a required post-merge task.
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
