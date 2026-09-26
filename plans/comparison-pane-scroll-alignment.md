# Comparison Pane Scroll Alignment

Overlay and Difference compare two versions of a screen by stacking the Before
and Current snapshots on top of each other. Today each snapshot is its own
scrollable iframe, so scrolling over the stack moves only the top layer and the
two versions drift apart. This plan makes alignment structural: comparison
panes are presented as viewer-owned, script-disabled documents whose frames
never scroll internally, and every stacked comparison scrolls inside one shared
device-chrome viewport. Side by side keeps two chromes whose viewports mirror
each other. It is the user's chosen option C from the 2026-09-26 discussion.

## Base And Prerequisites

This plan is based on `origin/main` at `3699c56` on the branch
`calummoore/kelowna-v2`. The comparison lifecycle lives in
`packages/viewer/src/shell/use_comparison.ts`, the toolbar and stage in
`packages/viewer/src/shell/diffs.tsx`, the pane rendering in
`packages/viewer/src/shell/comparison_views.tsx`, and the pane styling in
`packages/viewer/src/shell/css_review.ts`. The viewer-owned historical
presentation this plan reuses lives under `packages/viewer/src/previews/`
(`request.ts`, `presentation.ts`, `presentation_document.ts`, `read_only.ts`)
with its frame in `packages/viewer/src/shell/preview_frame.tsx`; it was
delivered by the
[viewer-owned historical previews plan](./viewer-owned-historical-previews.md)
and is specified by the
[removed previews contract](../docs/protocol/mokly-removed-previews.md).

## Problem

- `comparison_views.tsx` renders a Before pane and a Current pane, each with
  its own device chrome and its own `<iframe sandbox="">`. In Overlay and
  Difference the two panes occupy one grid cell (`css_review.ts`,
  `grid-area: 1 / 1`), the Current pane paints on top because it comes later
  in the DOM, and it is the only layer that receives wheel and touch input.
- The desktop chrome is fixed at 760px with hidden overflow and the phone
  chrome at 844px, so any taller snapshot scrolls inside its own frame. The
  Current layer scrolls while the Before layer stays at the top of the page.
  A 2026-09-26 screenshot of the Mokly Cloud home screen shows the hero
  heading twice at different offsets for exactly this reason. Difference has
  the same defect and reads worse once drifted, because every line of text
  then blends as changed. Side by side scrolls each pane independently.
- The shell cannot correct this after the fact: an empty sandbox gives each
  snapshot an opaque origin, so the parent can neither read a scroll offset,
  set one, nor measure the document, and no script may run inside a snapshot
  to report it. Current previews differ because they use
  `sandbox="allow-same-origin"` and the frame adapter.
- Component comparisons (`data-diff-component`) use a fixed 520px frame and
  share the defect.
- The [changes contract](../docs/protocol/mokly-changes.md) requires matching
  pane dimensions and withholds browser expansion "so it cannot misalign an
  overlay", but says nothing about scroll offset. The intent exists; the
  contract does not cover the scroll axis.

## Decisions

1. **Alignment is structural, not event-driven.** A stacked comparison has
   exactly one scroll container, the device chrome's viewport, and both
   layers live inside it at their full document height. There is no scroll
   state to mirror between the layers, so they cannot diverge. Scroll
   mirroring between two frames was rejected for Overlay and Difference
   because it is stateful, drifts when the two versions lay out differently
   above the fold, and must be rewired on every renewal and reload.
2. **Comparison panes become viewer-owned presentations.** Each pane
   document is fetched, validated, transformed and presented through the
   same pipeline the removed previews use: accepted only under the
   comparison's immutable generation, parsed without scripting, consumer
   `<base>` and meta refresh removed, one effective `<base href>` prepended,
   and assigned to `srcdoc` on a frame with exactly
   `sandbox="allow-same-origin"` and no script permission. The document
   therefore has the viewer's origin in every host, which is what lets the
   parent measure it. Granting `allow-same-origin` on a direct `src` frame
   was rejected because in a cross-origin embedded viewer, the host that
   Mokly Cloud uses, the frame would take the artifact origin and remain
   unmeasurable, leaving two presentation paths and the bug in the primary
   product. Injecting a scroll or measurement script would need
   `allow-scripts`, which the contract forbids for consumer documents.
   Recording heights at capture time was rejected because capture copies
   files and renders nothing. Disabling pointer events on the stack was
   rejected as a fix because it hides everything below the first viewport.
3. **Frames are sized to their documents.** After a presentation loads, the
   parent reads `documentElement.scrollHeight`, observes the document element
   with a `ResizeObserver`, and sets the frame height to the rounded-up value.
   Both layers of a stack take the taller of the two heights so the shorter
   document paints its own background below its content. A frame whose
   document is unavailable to the parent, which cannot happen for an accepted
   `srcdoc` presentation, falls back to the chrome's default viewport height
   with interior pointer scrolling disabled, so alignment is never lost even
   if measurement is. Wheel and touch input over a non-scrollable frame
   chains to the nearest scrollable ancestor in the parent, which is the
   shared viewport.
4. **One chrome per stacked comparison.** Overlay and Difference render one
   browser or phone chrome containing two stacked layers, not two stacked
   chromes with hidden labels. The top layer keeps 50% opacity in Overlay and
   the difference blend in Difference over the opaque base of the bottom
   layer. The existing overlay mockup already depicts this structure; the
   difference mockups move to it in Milestone 2.
5. **Side by side keeps two chromes and mirrors their viewports.** Each chrome
   viewport scrolls its own full-height frame; a parent-side listener copies
   `scrollTop` and `scrollLeft` between the two viewports with a re-entrancy
   guard. No frame access is needed for this because the scrollers are shell
   elements.
6. **Comparison panes are read-only in every mode.** The existing guard from
   `read_only.ts` applies to every comparison frame: link and form activation
   is cancelled, a same-document anchor scrolls its target into view, Space
   keeps scrolling, and the presentation is restored if the frame ever
   navigates. In a stack, any navigation of one layer would break the
   comparison outright; in Side by side, a navigation would leave `srcdoc`
   for an artifact-origin document that a cross-origin host cannot measure or
   guard, and the shell never tracked that navigation in its URL or heading.
   This retires the current ability to follow links inside a comparison
   snapshot, which
   `tests/browser/preview_design_links.spec.ts` protects today; that test is
   rewritten to prove links stay inert. Readers compare linked screens through
   the catalogue, where each screen has its own comparison.
7. **Ready means every pane document is presented.** A comparison shows the
   existing loading copy until every selected pane document, for both
   viewports when both are shown, has an accepted presentation, so a stack
   never appears with one layer missing. Any fetch, validation or
   presentation failure renders the existing failure copy with Retry.
   Renewal, refresh, route replacement and mode changes cancel and discard
   superseded work exactly as comparison requests do today.
8. **The embedded fetch set grows by the current tree.** An embedded viewer
   may already fetch historical HTML beneath the advertised generation's
   `snapshots/before/`; it may now also fetch beneath `snapshots/after/` of
   the same generation, on the source origin, under the existing CORS,
   `credentials: "omit"` and `nosniff` rules. The documented host CORS
   requirement already covers `__mokly/diffs/__generations/**`.
9. **Bytes stay unchanged.** Snapshot files, comparison JSON, capture,
   packaging, Serve routes and export inventories do not change. Only the
   in-memory presentation carries the base and refresh edits, and a `srcdoc`
   document renders in no-quirks mode, which is accepted as it is for removed
   previews. Both versions of a comparison share that mode, so they remain
   comparable with each other.

## Non-Goals

- No server, CLI, capture or export changes, and no pixel measurements or
  invented percentages.
- No navigation mirroring between panes and no scroll-position persistence
  across mode or route changes.
- Current screens, pages and component frames keep their adapter mounts,
  authenticated navigation and inspection; comparison frames never enter an
  adapter and expose no inspection, geometry or highlight.
- Browser expansion stays available only in Current.

## Milestone 1: Protocol And Documentation Contract

Summary: define the pane presentation, the shared scroller, the read-only
rule, the fetch set and the acceptance proofs in the specs and package docs so
the following milestones have a complete contract, and register the plan.

- [ ] Add `docs/protocol/mokly-comparison-panes.md` (about 250 lines) as the
      pane contract: viewer-owned presentation reused from removed previews
      for `snapshots/before/` and `snapshots/after/` documents of the accepted
      generation with the same acceptance rules, credential rule, base and
      refresh handling, `sandbox="allow-same-origin"` frames with no script
      permission, and the read-only guard in every host; frame sizing from the
      measured document with the rounded-up height, the pair maximum, the
      resize observation and the unmeasurable fallback; the stacked layout with
      one chrome per comparison whose viewport is the only scroll container,
      for desktop, mobile and component comparisons and for both viewports at
      once; the Side by side layout with mirrored viewports; the alignment
      invariant that no comparison document ever scrolls internally and that
      both layers of a stack share one offset at all times; loading, failure,
      retry, refresh and renewal states with the existing copy; and the
      acceptance list every later milestone must prove.
- [ ] In [`mokly-changes.md`](../docs/protocol/mokly-changes.md), replace the
      Overlay and Difference sentences and the "matching dimensions" sentence
      with a summary that links to the pane contract and states the scroll
      alignment invariant, qualify the "byte-unmodified, script-disabled"
      statement so files stay unmodified while the presentation carries the
      documented edits, and add the long-overlay mockup to the design
      references.
- [ ] In [`mokly-selected-comparisons.md`](../docs/protocol/mokly-selected-comparisons.md),
      replace "Frames retain their script-disabled sandbox" with the viewer-owned
      presentation and link the pane contract.
- [ ] In [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md),
      extend the fetched-not-framed statement to current HTML beneath
      `snapshots/after/`, replace "Comparison panes keep their existing sandbox
      and direct snapshot URLs" with the presentation rule, and update the
      pinned-delivery sentence near the end that names `snapshots/before/`.
- [ ] In [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md), replace
      both statements that comparison panes retain their existing sandbox or
      stricter sandbox with the read-only rule, including guard-owned anchors.
- [ ] In [`mokly-frame-adapter.md`](../docs/protocol/mokly-frame-adapter.md),
      state that comparison panes use the viewer-owned presentation, never enter
      either adapter, and gain only same-origin measurement and the guard.
- [ ] In [`mokly-viewer.md`](../docs/protocol/mokly-viewer.md), extend the
      hydration boundary to comparison presentations and the network-activity
      sentence to `snapshots/after/` documents fetched for a selected
      comparison; in [`mokly-runtime.md`](../docs/protocol/mokly-runtime.md)
      and [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md), update the
      sentences that describe comparisons as directly framed script-disabled
      documents beneath `snapshots/before/`.
- [ ] In [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md),
      note that the presentation pipeline is shared with comparison panes and
      that removed previews still accept only `snapshots/before/`.
- [ ] In [`mokly-shell-design.md`](../docs/protocol/mokly-shell-design.md),
      add the `design-changes-overlay-long` row at
      `design/review/controls/overlay-long.html`, describe the single-chrome
      stacked structure for Overlay and Difference, and keep the comparison
      family statements consistent; update
      [`mokly-design-links.md`](../docs/protocol/mokly-design-links.md) where it
      enumerates the family.
- [ ] Update the user guide
      [`docs/guides/catalogue/changes.md`](../docs/guides/catalogue/changes.md):
      Overlay and Difference scroll as one, Side by side scrolls together, and
      links inside a comparison do not navigate.
- [ ] Update [`packages/viewer/README.md`](../packages/viewer/README.md)
      (embedded hosts: comparison documents are fetched and presented at the
      host origin, so the CORS and CSP requirements stated for previews apply
      to comparisons), [`packages/viewer/src/previews/README.md`](../packages/viewer/src/previews/README.md)
      and [`packages/viewer/src/shell/README.md`](../packages/viewer/src/shell/README.md)
      to describe the shared presentation loader and the aligned pane modules
      planned in Milestones 3 and 4.
- [ ] Add the new contract to the [protocol index](../docs/protocol/README.md)
      and this plan to the active list in [`plans/README.md`](./README.md).
- [ ] Validate the changed Markdown with `npm run format:check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 2: Mockups

Tags: mockup

Summary: depict the shared scroller and the single-chrome stacked structure in
the design catalogue before the implementation lands.

- [ ] Add a `design-changes-overlay-long` screen to
      `examples/basic/entries/design/changes_screens.tsx` with desktop and
      mobile variants: a long screen in Overlay scrolled part-way inside one
      chrome, both layers at the same offset, the chrome viewport showing its
      scrollbar, and no annotations inside the screen area; register its
      destination in `examples/basic/entries/design/parts/destinations.ts` and
      keep the Changes page within the five-screen limit.
- [ ] Restructure the Difference mockups in
      `examples/basic/entries/design/review_outcome_screens.tsx` and
      `examples/basic/entries/design/browse/appearance/workspaces/screens.tsx`
      to one chrome holding two stacked layers, matching the overlay mockup,
      and update the authored difference rules in
      `examples/basic/generated/design-review.css` while keeping the opaque
      blend base in either appearance.
- [ ] Confirm the Side by side mockups need no structural change and that
      every changed screen still renders in both schemes.
- [ ] Add the new screen id to the design inventories and link-state tests
      (`tests/design_library_inventory.test.ts`,
      `tests/design_page_links.test.ts`, `tests/design_link_states.test.ts`,
      `tests/browser/design_comparison_eligibility.spec.ts`) as each requires.
- [ ] Run `npm run build`, `npm run example:build` and
      `npm run example:check`, then smoke-test the changed pages through
      `npm run dev` and save screenshots under `.context/`.
- [ ] Run the design tests, then `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 3: Shared Snapshot Presentation Pipeline

Summary: let the viewer-owned presentation pipeline serve comparison panes
without changing removed-preview behaviour.

- [ ] Generalize `packages/viewer/src/previews/presentation.ts` so a loader is
      created for one immutable generation and a typed set of snapshot sides
      (`before`, `after`), confining every address to those subtrees, keeping
      the per-address cache, cancellation and acceptance rules, and keeping
      removed previews on `before` only.
- [ ] Extend `advertisedPreviewPaths` in
      `packages/viewer/src/previews/request.ts` so a comparison generation
      advertises both subtrees to the embedded fetch boundary, and keep page
      previews unchanged.
- [ ] Keep every module near 200 lines; split `presentation.ts` if the
      generalization pushes it past 300.
- [ ] Add Node tests beside the existing preview tests under `tests/`:
      `after` addresses accepted for comparison loaders and rejected for
      removed-preview loaders, other generations and other prefixes rejected,
      cached and in-flight presentations reused, cancellation honoured, and the
      advertised prefixes for a comparison generation.
- [ ] Update `packages/viewer/src/previews/README.md`; run the preview unit
      tests and browser specs, then `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 4: Aligned Comparison Panes

Tags: ui

Summary: present comparison panes through the shared pipeline, size frames to
their documents, scroll every stack inside one chrome viewport, mirror Side by
side, and prove alignment in the browser.

- [ ] Add a dedicated tall-screen comparison fixture under `tests/helpers/`
      and a browser spec `tests/browser/comparison_alignment.spec.ts` that
      opens Overlay, scrolls over the stack with the wheel, and asserts both
      pane documents keep a zero scroll offset while their layer rectangles
      coincide; repeat for Difference, for mobile, for both viewports at once
      and for a component comparison. Run it before the fix and record the
      failing assertions in the review record; do not change the shared
      fixture's classified counts.
- [ ] Add a Side by side case to the same spec: scrolling one chrome viewport
      moves the other to the same offset in both directions.
- [ ] Add `packages/viewer/src/shell/use_comparison_documents.ts`: after a
      comparison loads, present every selected pane document through the
      shared loader, report ready only when all are presented, expose the
      existing failure and retry states, and discard superseded work on mode,
      viewport, scheme, route, renewal and refresh changes.
- [ ] Split `packages/viewer/src/shell/comparison_views.tsx` into a stack
      renderer for Overlay and Difference (one chrome, two layers, shared
      viewport scroller), a side-by-side renderer (two chromes, mirrored
      viewports), and a comparison frame that reuses the `srcdoc` frame and
      guard from `preview_frame.tsx`; keep the `data-compare-mode` and
      `data-diff-*` attributes tests rely on.
- [ ] Add `packages/viewer/src/shell/use_frame_document_height.ts`: measure on
      load, observe the document element, round up, take the pair maximum and
      apply the unmeasurable fallback; add
      `packages/viewer/src/shell/comparison_scroll_mirror.ts` for Side by side
      with a re-entrancy guard and cleanup.
- [ ] Update `css_review.ts` and the chrome styles: the stacked chrome viewport
      and phone screen scroll, layers stack at full width, the top layer keeps
      the overlay opacity or difference blend, component comparisons scroll
      inside their bordered wrapper, and narrow layouts keep the existing
      responsive rules.
- [ ] Rewrite the assertions that expect `sandbox=""` and direct
      `src` values in `tests/browser/preview_comparisons.spec.ts`,
      `tests/browser/static_comparisons.spec.ts` and
      `tests/browser/preview_design_links.spec.ts`, and turn the comparison
      links test into a read-only proof; update `tests/changes.test.ts` if it
      inspects frame markup.
- [ ] Add unit tests for the height hook, the documents controller and the
      scroll mirror using fake frames and documents.
- [ ] Smoke-test through `npm run dev` with a temporarily changed tall example
      screen: Overlay, Difference and Side by side on desktop and mobile,
      Refresh, and Current; save screenshots under `.context/` and revert the
      temporary change.
- [ ] Update `packages/viewer/src/shell/README.md` and
      `packages/viewer/README.md` for the delivered modules, then run the
      comparison and preview browser specs and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Post-merge follow-up (non-blocking)

- Smoke-test Overlay and Difference scrolling in a deployed cross-origin
  embedded viewer with a strict host CSP, and confirm the guard keeps
  comparison links inert there.
- Consider mirroring navigation between Side by side panes if reviewers ask
  for linked-screen browsing inside comparisons again.

## Review record

Filled in as each milestone's review runs.
