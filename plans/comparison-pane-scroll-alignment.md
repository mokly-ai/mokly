# Comparison Pane Scroll Alignment

Overlay and Difference compare two versions of a screen by stacking the Before
and Current snapshots on top of each other. Today each snapshot is its own
scrollable iframe, so scrolling over the stack moves only the top layer and the
two versions drift apart. This plan makes alignment structural: comparison
panes are presented as viewer-owned, script-disabled documents whose frames are
never user-scrollable, and every stacked comparison scrolls inside one shared
device-chrome viewport that drives both documents. Side by side keeps two
chromes whose viewports mirror each other. It is the user's chosen option C
from the 2026-09-26 discussion; Milestone 4 revised how frames are sized, as
Decision 3 records.

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

1. **Alignment has one owner.** A stacked comparison has exactly one
   user-scrollable container, the device chrome's viewport, and both layers
   live inside it. Every scroll of that viewport writes its one offset to both
   layer documents in the same handler, and any scroll a document makes on its
   own is written back to the viewport first, so the layers cannot diverge.
   Mirroring two independently user-scrollable frames was rejected for Overlay
   and Difference because it is stateful, drifts when the two versions lay out
   differently above the fold, and must be rewired on every renewal and
   reload. Milestone 4 replaced "both layers at their full document height" with
   Decision 3's device-sized frames.
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
3. **Frames stay at the device viewport size and one shared scroller drives
   every document.** This replaces the rule the user approved, which sized each
   frame to its document's `scrollHeight` and re-measured it with a
   `ResizeObserver`. While preparing Milestone 4 that rule proved defective in
   Chrome: viewport units, `position: fixed` and `position: sticky` resolve
   against the frame, so growing the frame changes the document. A
   `min-height: 100vh` hero followed by 600px of content grew the frame 1338 →
   1956 → … → 8136px over twelve observer cycles without converging, and even
   a converging document moved fixed tab bars to the end of the page, stopped
   sticky headers from sticking and stretched viewport-height sections, so
   comparisons stopped looking like Current; Mokly Cloud's own mockups use
   those patterns. The user was offered this fix (A, recommended) or
   document-sized frames with a height cap (B) and has not answered;
   Milestone 4 proceeds with A, the announced default, because B knowingly
   ships the distortions above. **Decision 3 awaits the user's confirmation.**
   Each chrome viewport is the only user-scrollable container: a
   `position: sticky` box of exactly the viewport's size holds the frames at
   device size, and a spacer after it extends the range to the section's
   largest document. Frames carry `scrolling="no"` and are scrolled only
   programmatically. Every viewport scroll writes one offset to every layer
   document; a shorter document stops at its end and its frame is translated
   by the remainder over its own canvas colour; a scroll the viewer did not
   make is written back to the viewport; loops are broken by comparing values,
   never with timers. Documents are re-measured on commit, load and observed
   size changes, and because no frame size depends on its document the
   measurement cannot feed back. Wheel and touch input over a non-scrollable
   frame chains to the shared viewport.
4. **One chrome per stacked comparison.** Overlay and Difference render one
   browser or phone chrome containing two stacked layers, not two stacked
   chromes with hidden labels. The top layer keeps 50% opacity in Overlay and
   the difference blend in Difference over the opaque base of the bottom
   layer. The existing overlay mockup already depicts this structure; the
   difference mockups move to it in Milestone 2.
5. **Side by side keeps two chromes and mirrors their viewports.** Each chrome
   viewport drives its one device-sized frame as Decision 3 describes; both
   spacers use the pair maximum so the two ranges always match, and the two
   viewports' `scrollTop` and `scrollLeft` are mirrored in both directions
   with a value-based re-entrancy guard and no timers.
6. **Comparison panes are read-only in every mode.** The existing guard from
   `read_only.ts` applies to every comparison frame from the moment its
   document commits: link and form activation is cancelled, a same-document
   anchor moves the shared viewport to its target's document position, scroll
   keys pressed inside a pane scroll the shared viewport except in editable
   targets, and the presentation is restored if the frame ever navigates. In a stack, any navigation of one layer would break the
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
   The loaded comparison and its per-address presentation cache survive mode,
   viewport and scheme switches; Current, route changes, evidence or source
   replacement, unmount and a newly loaded comparison (Refresh, Retry or a
   renewal that found a new generation) cancel and discard them.
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

- [x] Add `docs/protocol/mokly-comparison-panes.md` (about 250 lines) as the
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
- [x] In [`mokly-changes.md`](../docs/protocol/mokly-changes.md), replace the
      Overlay and Difference sentences and the "matching dimensions" sentence
      with a summary that links to the pane contract and states the scroll
      alignment invariant, qualify the "byte-unmodified, script-disabled"
      statement so files stay unmodified while the presentation carries the
      documented edits, and add the long-overlay mockup to the design
      references.
- [x] In [`mokly-selected-comparisons.md`](../docs/protocol/mokly-selected-comparisons.md),
      replace "Frames retain their script-disabled sandbox" with the viewer-owned
      presentation and link the pane contract.
- [x] In [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md),
      extend the fetched-not-framed statement to current HTML beneath
      `snapshots/after/`, replace "Comparison panes keep their existing sandbox
      and direct snapshot URLs" with the presentation rule, and update the
      pinned-delivery sentence near the end that names `snapshots/before/`.
- [x] In [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md), replace
      both statements that comparison panes retain their existing sandbox or
      stricter sandbox with the read-only rule, including guard-owned anchors.
- [x] In [`mokly-frame-adapter.md`](../docs/protocol/mokly-frame-adapter.md),
      state that comparison panes use the viewer-owned presentation, never enter
      either adapter, and gain only same-origin measurement and the guard.
- [x] In [`mokly-viewer.md`](../docs/protocol/mokly-viewer.md), extend the
      hydration boundary to comparison presentations and the network-activity
      sentence to `snapshots/after/` documents fetched for a selected
      comparison; in [`mokly-runtime.md`](../docs/protocol/mokly-runtime.md)
      and [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md), update the
      sentences that describe comparisons as directly framed script-disabled
      documents beneath `snapshots/before/`.
- [x] In [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md),
      note that the presentation pipeline is shared with comparison panes and
      that removed previews still accept only `snapshots/before/`.
- [x] In [`mokly-shell-design.md`](../docs/protocol/mokly-shell-design.md),
      describe the single-chrome stacked structure for Overlay and Difference
      and keep the comparison family statements consistent, without adding the
      `design-changes-overlay-long` inventory row, which
      `tests/design_links.test.ts` checks against the compiled registry and
      which therefore lands with the mockup in Milestone 2; update
      [`mokly-design-links.md`](../docs/protocol/mokly-design-links.md) where it
      enumerates the family.
- [x] Update the user guide
      [`docs/guides/catalogue/changes.md`](../docs/guides/catalogue/changes.md):
      Overlay and Difference scroll as one, Side by side scrolls together, and
      links inside a comparison do not navigate.
- [x] Update [`packages/viewer/README.md`](../packages/viewer/README.md)
      (embedded hosts: comparison documents are fetched and presented at the
      host origin, so the CORS and CSP requirements stated for previews apply
      to comparisons), [`packages/viewer/src/previews/README.md`](../packages/viewer/src/previews/README.md)
      and [`packages/viewer/src/shell/README.md`](../packages/viewer/src/shell/README.md)
      to describe the shared presentation loader and the aligned pane modules
      planned in Milestones 3 and 4.
- [x] Add the new contract to the [protocol index](../docs/protocol/README.md)
      and this plan to the active list in [`plans/README.md`](./README.md).
- [x] Validate the changed Markdown with `npm run format:check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 2: Mockups

Tags: mockup

Summary: depict the shared scroller and the single-chrome stacked structure in
the design catalogue before the implementation lands.

- [x] Add a `design-changes-overlay-long` screen to
      `examples/basic/entries/design/changes_screens.tsx` with desktop and
      mobile variants: a long screen in Overlay scrolled part-way inside one
      chrome, both layers at the same offset, the chrome viewport showing its
      scrollbar, and no annotations inside the screen area; register its
      destination in `examples/basic/entries/design/parts/destinations.ts`,
      add its inventory row at `design/review/controls/overlay-long.html` to
      the table in `docs/protocol/mokly-shell-design.md`, and keep the Changes
      page within the five-screen limit.
- [x] Restructure the Difference mockups in
      `examples/basic/entries/design/review_outcome_screens.tsx` and
      `examples/basic/entries/design/browse/appearance/workspaces/screens.tsx`
      to one chrome holding two stacked layers, matching the overlay mockup,
      and update the authored difference rules in
      `examples/basic/generated/design-review.css` while keeping the opaque
      blend base in either appearance.
- [x] Confirm the Side by side mockups need no structural change and that
      every changed screen still renders in both schemes.
- [x] Add the new screen id to the design inventories and link-state tests
      (`tests/design_library_inventory.test.ts`,
      `tests/design_page_links.test.ts`, `tests/design_link_states.test.ts`,
      `tests/browser/design_comparison_eligibility.spec.ts`) as each requires.
- [x] Depict every comparison pane as read-only, as Decision 6 requires: the
      Welcome sketch inside the Side by side, Overlay and Difference mockups
      carries its link as inert text, and `mokly-design-links.md` records it.
- [x] Pin the stacked structure with regressions:
      `tests/design_comparison_stacks.test.ts` (one chrome and two layers per
      stack, one chrome per Side by side version, no link inside any depicted
      comparison, one reworded section in the long overlay) and
      `tests/browser/design_comparison_stacks.spec.ts` (coincident layers,
      opaque screen base per scheme, unblended chrome, and the long overlay's
      shared offset matching its drawn scrollbar).
- [x] Now that the mockups exist, state in the Delivery Status of
      `mokly-shell-design.md` and `mokly-comparison-panes.md` that the design
      references are delivered while the runtime waits for Milestones 3 and 4,
      and update the design-screen counts in `mokly-design-links.md`,
      `examples/basic/README.md` and the design tests (Milestone 1 review
      finding 9).
- [x] Run `npm run build`, `npm run example:build` and
      `npm run example:check`, then smoke-test the changed pages through
      `npm run dev` and save screenshots under `.context/`.
- [x] Run the design tests, then `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 3: Shared Snapshot Presentation Pipeline

Summary: let the viewer-owned presentation pipeline serve comparison panes
without changing removed-preview behaviour.

- [x] Generalize `packages/viewer/src/previews/presentation.ts` so a loader is
      created for one immutable generation and a typed set of snapshot sides
      (`before`, `after`), confining every address to those subtrees, keeping
      the per-address cache, cancellation and acceptance rules, and keeping
      removed previews on `before` only.
- [x] Extend `advertisedPreviewPaths` in
      `packages/viewer/src/previews/request.ts` so a comparison generation
      advertises both subtrees to the embedded fetch boundary, and keep page
      previews unchanged.
- [x] Keep every module near 200 lines; split `presentation.ts` if the
      generalization pushes it past 300.
- [x] Add Node tests beside the existing preview tests under `tests/`:
      `after` addresses accepted for comparison loaders and rejected for
      removed-preview loaders, other generations and other prefixes rejected,
      cached and in-flight presentations reused, cancellation honoured, and the
      advertised prefixes for a comparison generation.
- [x] Update `packages/viewer/src/previews/README.md`; run the preview unit
      tests and browser specs, then `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 3A: Component Comparison Mockups

Tags: mockup

Summary: depict Overlay and Difference for component comparisons before
Milestone 4 rebuilds them, closing [Milestone 2 review](#milestone-2) finding
3, because the design catalogue shows component comparisons only in Side by
side. A saved component variant's two versions share one bordered component
frame whose interior is the only scroll container, and a component taller than
that frame is shown scrolled part-way inside it. Descriptions and rationale
state what a reader sees, one frame and one scroll position shared by both
versions, so they hold whether Milestone 4 sizes frames to their documents or
drives both documents from one shared scroller.

- [x] Generalize `ComparisonStack` in
      `examples/basic/entries/design/parts/compare_stack.tsx` so its caller
      supplies the one chrome, a device frame for a screen or the bordered
      component frame for a saved variant, and keep the three existing screen
      stacks rendering unchanged.
- [x] Add a `Stacked comparisons` collection beneath Pages and comparisons in
      `examples/basic/entries/design/components/pages/stacked/`, so that page
      keeps its five screens, with desktop and mobile variants of
      `design-component-overlay` and `design-component-difference` (Action's
      Default variant in one bordered frame, Current on top at half opacity or
      difference-blended over the opaque Before layer) and
      `design-component-overlay-tall` (a synthetic Checklist taller than its
      frame, scrolled part-way inside it with the frame's scrollbar drawn and
      both layers at one offset, in its own one-entry Changes scenario).
- [x] Keep the comparison band, caption, variants and inspector consistent with
      `design-component-comparison`, keep every depicted pane free of links,
      and give the Checklist fixed row heights so its depicted offset and
      scrollbar never depend on text wrapping.
- [x] Link Action's Default comparison family through its mode control,
      Current to `design-component-affected`, Side by side to
      `design-component-comparison`, and Overlay and Difference to the new
      screens, so they are reached from the existing comparison screen the way
      the Welcome family's modes are; register the destinations and navigation
      states.
- [x] Add the three rows, the family transitions, the collection and the
      Checklist fixture to `docs/protocol/mokly-component-design.md`, with a
      Delivery Status sentence that the stacked component designs precede
      their runtime; name the component stacks in the Design References of
      `docs/protocol/mokly-comparison-panes.md` and the other docs that list
      the comparison designs; update the design-screen counts; record the
      depiction notes in `examples/basic/notes.md`; and extend the Milestone 4
      Delivery Status TODO to the new sentence.
- [x] Update the inventories and link-state tests that enumerate design
      screens (`tests/design_links.test.ts`,
      `tests/design_library_usage.test.ts`,
      `tests/component_design_attribution.test.ts`,
      `tests/component_design_navigation.test.ts`,
      `tests/design_link_states.test.ts`, `tests/component_design_review.test.ts`,
      `tests/browser/component_evidence.spec.ts`), and cover the component
      stacks in `tests/design_component_stacks.test.ts` and
      `tests/browser/design_component_stacks.spec.ts`, siblings of the screen
      stack tests sharing `tests/helpers/design_stacks.ts`, with no assertion
      that depends on font metrics or text wrapping.
- [x] Run `npm run build`, `npm run example:build` and
      `npm run example:check`, then smoke-test the new and changed pages
      through `npm run dev` at desktop and mobile widths and save screenshots
      under `.context/m3a/`.
- [x] Run the design unit tests and the component and design browser specs,
      then `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.

## Milestone 4: Aligned Comparison Panes

Tags: ui

Summary: present comparison panes through the shared pipeline, keep every
frame at the device viewport size, drive every stack's documents from one
shared chrome viewport, mirror Side by side, and prove alignment in the
browser. Decision 3's shared scroller replaces the approved document-sized
frames and awaits the user's confirmation.

- [x] Add a dedicated tall-screen comparison fixture under `tests/helpers/`
      and a browser spec `tests/browser/comparison_alignment.spec.ts` that
      opens Overlay, scrolls over the stack with the wheel, and asserts both
      pane documents and the shared viewport reach one offset while their
      layer rectangles coincide; repeat for Difference, for mobile, for both
      viewports at once and for a component comparison, and cover a document
      shorter than its pair, a `min-height: 100vh` hero that must not grow its
      comparison before and after a late image loads, a fixed bar and a sticky
      header on the viewport's edges, and the documented inner-scroll
      limitation. Run it before the fix and record the failing assertions in
      the review record; do not change the shared fixture's classified counts.
- [x] Add the input cases in `tests/browser/comparison_alignment_input.spec.ts`
      with helpers in `tests/browser/comparison_alignment_helpers.ts`: Side by
      side mirrors in both directions; Space, Shift+Space, PageUp, PageDown,
      Home, End and ArrowDown pressed inside a pane move the shared viewport
      while an input keeps its keys; a same-document anchor moves every
      version in Overlay and Side by side without changing the shell URL or
      heading; and a scroll the viewer did not make pulls every version along.
- [x] Add `packages/viewer/src/shell/use_comparison_documents.ts` over the
      framework-free `comparison_documents.ts`, with the pure selection in
      `comparison_selection.ts`: after a comparison loads, present every
      selected pane document through the shared loader, report ready only when
      all are presented, show the existing failure copy with Try again and the
      loader's failure text as details, and keep the per-address cache across
      mode, viewport and scheme switches while discarding it for Current,
      route, evidence or source replacement, unmount and a newly loaded
      comparison (Milestone 1 finding 3, option A).
- [x] Split `packages/viewer/src/shell/comparison_views.tsx` into the section
      renderer, a stack renderer for Overlay and Difference
      (`comparison_stack.tsx`: one chrome, two layers, one shared viewport), a
      side-by-side renderer (`comparison_side.tsx`: two chromes, mirrored
      viewports), the chrome choice (`comparison_chrome.tsx`), the shared
      viewport (`comparison_viewport.tsx`), and a comparison frame
      (`comparison_frame.tsx`) that reuses the `srcdoc` frame and guard from
      `preview_frame.tsx`; keep the `data-compare-mode` and `data-diff-*`
      attributes and the pane classes tests rely on, the missing-pane messages
      and the Side by side fallback.
- [x] Add the scroll-sync controller
      `packages/viewer/src/shell/comparison_scroll_sync.ts` in place of the
      planned `use_frame_document_height.ts`: follow each layer document from
      its commit, measure it on load and on observed size changes, size every
      spacer to the section's largest range, write one offset to every
      document, translate a shorter document's frame by the remainder over its
      canvas colour, write back scrolls it did not make, forward scroll keys
      (`comparison_scroll_keys.ts`) and move the viewport to anchors; add
      `comparison_scroll_mirror.ts` for Side by side with a value-based
      re-entrancy guard, pair-maximum ranges (Milestone 1 finding 2, option A)
      and cleanup, and `comparison_layer_document.ts` for document reads.
- [x] Mark comparison frames `data-mokly-comparison-frame` with
      `data-mokly-preview-source`, exactly `sandbox="allow-same-origin"`,
      `scrolling="no"`, a `srcdoc` and never a `src` (Milestone 1 finding 10,
      option A), and give the guard a `reveal` hook so a comparison anchor
      moves the shared viewport while removed previews keep scrolling into
      view (Milestone 1 finding 8, option B).
- [x] Install the read-only guard and follow layer documents from the moment a
      `srcdoc` document commits, through the shared
      `packages/viewer/src/previews/presented_document.ts`, because a slow
      resource can hold back a frame's `load` event; a link clicked in that
      window navigated the frame before this change. Tolerate the refused
      listener release once the frame's window turns cross-origin.
- [x] Update `css_review.ts`, `css_preview_scheme.ts` and `css_workspace.ts`:
      the stacked chrome viewport, phone screen and bordered component frame
      scroll; the sticky box holds layers at full size, each on an opaque
      screen background in the selected scheme (Milestone 2 finding 2,
      option B); the top layer keeps the overlay opacity or difference blend
      and the chrome never blends; the viewport's scrollbar follows the
      preview scheme; and narrow layouts keep the existing responsive rules.
- [x] Rewrite the assertions that expect `sandbox=""` and direct `src` values
      in `tests/browser/preview_comparisons.spec.ts`,
      `static_comparisons.spec.ts`, `review.spec.ts`,
      `selected_comparisons.spec.ts`, `comparison_renewal.spec.ts`,
      `comparison_expiry.spec.ts`, `component_explorer_runtime.spec.ts`,
      `component_static_runtime.spec.ts` and `preview_backgrounds.spec.ts`
      through the shared `expectPresentedPane` and `PANE_SOURCE` helpers, and
      turn the comparison links test in `preview_design_links.spec.ts` into a
      read-only proof (links and forms inert, anchors move both viewports,
      shell URL and heading unchanged) (Milestone 1 finding 5).
      `design_links.spec.ts` and `removed_comparison_eligibility.spec.ts`
      assert Current frames and the missing-pane copy only and need no change,
      and `tests/changes.test.ts` inspects no frame markup;
      `tests/client_css_material.test.ts` renders the new section inputs.
- [x] Add unit tests with fakes for the scroll-sync controller, the documents
      controller and selection, the scroll mirror, the key forwarding and the
      presented-document follower under `packages/viewer/tests/`.
- [x] Smoke-test through `npm run dev` with a temporarily changed tall example
      screen containing a `min-height: 100vh` hero, a sticky header and a
      fixed bar: Overlay, Difference and Side by side on desktop and mobile,
      both viewports in Dark, Refresh, and Current; save screenshots under
      `.context/m4/` and revert the temporary change.
- [x] Rewrite the Sizing, Layout, Alignment Invariant, Lifecycle and
      Acceptance sections of `docs/protocol/mokly-comparison-panes.md` for the
      shared scroller, the inner-scroll limitation (Milestone 1 finding 4,
      option A), key forwarding and the frame attributes; align the changes,
      viewer, frame adapter, navigation and protocol index docs, the Changes
      guide, `examples/basic/notes.md` and the design stylesheet comment.
- [x] Update `packages/viewer/src/shell/README.md`,
      `packages/viewer/src/previews/README.md`,
      `packages/viewer/src/client/README.md` and `packages/viewer/README.md`
      for the delivered modules and attributes, and re-check
      `docs/guides/catalogue/changes.md`, `docs/guides/authoring/links.md`
      and `packages/viewer/README.md` against the delivered behaviour
      (Milestone 3A finding 4, option B).
- [x] Remove the pending-runtime sentences that Milestone 2 added to the
      Delivery Status sections of `docs/protocol/mokly-shell-design.md` and
      `docs/protocol/mokly-comparison-panes.md`, including the exception now
      attached to "Every state recorded here is implemented", and the one
      Milestone 3A added to `docs/protocol/mokly-component-design.md`.
- [x] Run the comparison, preview, review and design browser specs and
      `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report the
      findings without changing the implementation.
- [x] Fix the review findings that showed this milestone's own work broken,
      each with a test that failed first: finding 1, write every programmatic
      scroll instantly (`scrollInstantly`) so smooth-scrolling snapshots and
      hosts cannot pull the shared viewport back; finding 3, prove the
      contract's Acceptance against a static export and an embedded viewer
      through both frame adapters, including the pane failure path, in
      `tests/browser/comparison_alignment_hosts.spec.ts` over the shared
      `tests/browser/viewer_host.ts`, and name the proving specs in the
      contract; finding 7, state in the removed previews contract that the
      guard installs from commit.
- [x] Re-run the checks and `cargo xtask check`, commit the fixes with
      Conventional Commits, and push the branch.

## Post-merge follow-up (non-blocking)

- Smoke-test Overlay and Difference scrolling in a deployed cross-origin
  embedded viewer with a strict host CSP, and confirm the guard keeps
  comparison links inert there.
- Consider mirroring navigation between Side by side panes if reviewers ask
  for linked-screen browsing inside comparisons again.

## Review record

### Milestone 1

- Base commit: `origin/main` at `3699c56`; the contract landed as `1849a31`
  on `calummoore/kelowna-v2` and its review fixes follow it.
- Checks: `npm run format:check` passed before and after the review fixes.
  `npm run example:build` cannot run in the review sandbox because its Node
  24.14.1 falls in the CLI's unsupported range; the design tests were run
  directly with `npx tsx --test tests/design_links.test.ts`.
- Finding 1 pre-fix regression: that test's documented-inventory case failed
  with the extra `design-changes-overlay-long` row, because the row is checked
  against the compiled design registry and the mockup lands in Milestone 2.
  The row was removed from `mokly-shell-design.md` and moved to the Milestone
  2 TODOs; the test then passed 10/10.
- Finding 6 (three statements that still let comparison panes keep an opaque
  sandbox or navigable links, in `mokly-navigation.md`,
  `mokly-design-links.md` and `docs/guides/authoring/links.md`) was fixed as
  part of the milestone's no-conflicting-statements scope.
- Findings 2, 3, 4, 5, 7, 8, 9 and 10 change the contract's substance
  (Side by side sizing, lifecycle cancellation versus sharing, viewport-sized
  documents, the Milestone 3 and 4 TODO lists, CSP `base-uri`, keyboard
  scrolling, forward-looking design references, and the pane frame attribute)
  and were reported for a decision rather than applied.

### Milestone 2

- Base commit: `4982621`; the mockups landed as `93ca88a` and the review
  fixes as `57feb31` on `calummoore/kelowna-v2`.
- Checks: `npm run build`, `npm run example:build` (410 files) and
  `npm run example:check` passed; the design unit tests passed 127/127; the
  design, library and review browser specs passed; `cargo xtask check` passed
  on the tree that became `93ca88a` and again on the tree that became
  `57feb31` (repository and package suites, unit 2421/2421, browser 787/787
  in 123 files). The new structure test failed three of its four cases
  against `4982621`, so it captures the change.
- Smoke: `npm run dev` served the long overlay, Overlay, Current, both
  Difference mockups, both Side by side mockups and a stylesheet evidence
  screen in both viewports and schemes; screenshots are under `.context/m2/`.
- Environment: the sandbox's global npm 11.19.0 kept nine stale files from an
  in-place Node upgrade, which broke `npx` and `npm audit`; it was replaced
  with the identical npm from the checksum-verified Node 24.21.0 tarball
  before the checks. No repository file was involved.
- Finding 1 (the shared Comparison pane samples kept a working link) and
  finding 4 (the shell design Delivery Status still said every recorded state
  is implemented) contradicted statements this milestone added, so both were
  fixed in `57feb31`; the inert-link test now covers every generated design
  output and failed on the samples before the fix.
- Findings 2 (the pane contract does not require both stack layers to paint an
  opaque screen background), 3 (no mockup covers stacked component
  comparisons before Milestone 4 restructures them) and 5 (the long overlay's
  rationale implies layout alignment beyond scroll alignment, which rests on a
  fixed introduction height) were reported for a decision rather than applied.
- Finding 3 is addressed by
  [Milestone 3A](#milestone-3a-component-comparison-mockups), which adds the
  stacked component comparison mockups before Milestone 4.

### Milestone 3

- Base commit: `91ce4c2`; the shared snapshot pipeline landed as `7ad4e44`
  and its review fix as `abbeb20` on `calummoore/kelowna-v2`.
- Checks: `npm run build`, `npm run typecheck`, `npm run lint` and
  `npm run format:check` passed; the focused preview unit suite passed 23/23
  and the five removed-preview browser specs passed 30/30. The complete
  `cargo xtask check` passed before review (unit 2427/2427, browser 787/787 in
  123 files) and after the review fix (unit 2428/2428, browser 787/787 in 123
  files), with zero failures, skips or cancellations. The dependency audit,
  Rust format/clippy/tests and file-length audit, 410-file example build/check,
  and package verification/smoke all passed in both full runs.
- Finding 1 (a loader whose owner aborted in the microtask after parsing but
  before settlement could resolve and cache accepted work) was a Milestone 3
  cancellation defect, so it was fixed in `abbeb20`. The new regression failed
  before the fix, then proved the cancelled load rejects and the next load
  fetches again.
- No new findings remain open from Milestone 3. Earlier open Milestone 1
  findings 2, 3, 4, 5 (the Milestone 4 portion), 7, 8 and 10, and Milestone 2
  findings 2, 3 and 5 remain recorded for the user's decision; this milestone
  resolved Milestone 1 finding 5's advertised-fetch-set portion.

### Milestone 3A

- Base commit: `884ef5d`; the component comparison mockups landed as
  `33f76cd` and the review fixes as `4fd059b` on `calummoore/kelowna-v2`.
- Checks: `npm run build`, `npm run example:build` (416 files) and
  `npm run example:check` passed; the design unit tests passed 134/134 before
  review and 137/137 after; the component and design browser specs, including
  the new component stack spec, passed 71/71 both times. The complete
  `cargo xtask check` passed before review (unit 2432/2432, browser 798/798 in
  124 files) and after the review fixes (unit 2435/2435, browser 798/798 in
  124 files), with zero failures, skips or cancellations. Generalizing
  `ComparisonStack` left the three screen stacks' generated HTML
  byte-identical.
- Smoke: `npm run dev` served the component comparison, affected, Overlay,
  Difference and tall Overlay pages at desktop and 390px widths, and each mode
  link inside the framed artboards opened its own page; screenshots are under
  `.context/m3a/`.
- Finding 1 (the tall Checklist's caption named a "Wording changed" category
  the runtime cannot know, contradicting its recorded "Rendered output
  changed" reason) and finding 2 (the example README's scheme counts were
  stale, 71 and 21 with four Changes designs instead of 74 and 22 with five,
  partly missed in Milestone 2) were Milestone 3A defects, and finding 3 (the
  Checklist's one-entry Changes scenario had no test) was a coverage gap in
  its new behaviour, so all three were fixed in `4fd059b`. The new caption and
  count regressions failed before the fixes. Whether every caption should name
  the recorded reason instead of the pre-existing "Appearance changed" wording
  remains for the user's decision.
- Findings 4 (the published guides and the viewer README describe the
  Milestone 4 pane behaviour without a pending-delivery caveat) and 5
  (`mokly-shell-design.md` still waits for "Milestones 3 and 4") concern
  Milestones 1 and 3 and were reported for a decision rather than applied.
- Milestone 2 finding 3 is resolved by this milestone. Milestone 1 findings 2,
  3, 4, 5 (the Milestone 4 portion), 7, 8 and 10, and Milestone 2 findings 2
  and 5, remain recorded for the user's decision.

### Milestone 4

- Base commit: `2a3eacb`; the aligned pane runtime, its tests and documents
  landed as `5674c1c` and the review fixes as `28c0a3e` on
  `calummoore/kelowna-v2`.
- Design change, awaiting the user's confirmation: Decision 3 now keeps every
  comparison frame at the device viewport size and drives both documents from
  one shared scroller. It replaces the sizing rule the user approved, which
  sized each frame to its document's `scrollHeight`, because that rule proved
  defective in Chrome 153: viewport units, `position: fixed` and
  `position: sticky` resolve against the frame, so a `min-height: 100vh` hero
  followed by 600px of content grew the frame 1338 → 1956 → … → 8136px over
  twelve `ResizeObserver` cycles without converging, and converging documents
  still moved fixed tab bars to the end of the page, stopped sticky headers from
  sticking and stretched viewport-height sections. The user was offered this
  fix (A) or document-sized frames with a height cap (B) and has not answered;
  the milestone proceeds with A, the announced default, because B ships those
  distortions.
- Failing-first: `tests/browser/comparison_alignment.spec.ts` and
  `comparison_alignment_input.spec.ts` ran against `2a3eacb` before the runtime
  changed and failed 12 of 12. Ten failed on the defect itself, the Before
  document staying at 0 while the Current one scrolled (`[before, after]`
  received `[0, 400]` for desktop Overlay, `[0, 300]` mobile, `[0, 400]` with
  both viewports, `[0, 200]` for the component, `[0, 282]` for the shorter
  document, `[0, 900]` for the fixed and sticky case, `[0, 628]` for Space,
  `[0, 2790]` for the anchor, `[0, 2126]` for a scroll the viewer did not make,
  and `[300, 0]` for Side by side); the hero and inner-scroll cases failed
  because no shared spacer existed.
- Defects found while implementing, each captured by a test that failed first:
  a layer connected only on the frame's `load` event, which a slow image holds
  back, so its range stayed zero (intermittent hero failures; unit test "a
  document is followed from its commit"); the read-only guard was installed
  only on `load`, so a link clicked while a slow resource loaded navigated the
  frame ("links stay inert while a version is still loading"); and releasing a
  `pagehide` listener through a window proxy that had turned cross-origin threw
  and stopped the guard's restoration ("a cross-origin frame navigation
  restores the presentation" and the follower unit test).
  `previews/presented_document.ts` now follows presentations from commit for
  both the guard and the scroll controller.
- Checks before review: `npm run build`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run example:build` (416 files) and
  `npm run example:check` passed; the targeted comparison, preview, review,
  removed-preview and design browser specs passed 226/226; the complete
  `cargo xtask check` passed (audit, formatting, lint, Rust format, clippy,
  tests and file-length audit, typecheck, example build and check, package
  check and smoke, unit 2461/2461, browser 811/811 in 126 files) with zero
  failures, skips or cancellations. After the review fixes the
  18 alignment cases passed 18/18 and the complete `cargo xtask check` passed
  again (unit 2462/2462, browser 816/816 in 127 files) with zero failures,
  skips or cancellations.
- Smoke: `npm run dev` served a temporarily tall Details screen (sticky
  header, `min-height: 100vh` hero, eight sections, fixed bar) in Overlay,
  Difference and Side by side on desktop and mobile, both viewports in Dark,
  Refresh and Current, with no page errors; screenshots are under
  `.context/m4/`, and the temporary change was reverted.
- Resolved earlier findings: Milestone 1 finding 2 (option A, pair-maximum
  Side by side ranges), 3 (A, the cache survives mode, viewport and scheme
  switches), 4 (A, the inner-scroll limitation is documented and pinned by a
  spec), 5 (the Milestone 4 spec list), 8 (B, scroll keys and anchors move the
  shared viewport; removed previews keep their behaviour) and 10 (A, the
  `data-mokly-comparison-frame` marker); Milestone 2 finding 2 (B, both layers
  paint an opaque screen background, asserted in the spec); Milestone 3A
  findings 4 (B, the guides and viewer README describe delivered behaviour) and
  5 (the pending-runtime sentences are gone).
- Review of the complete diff against `origin/main` (fresh reviewer, after the
  push of `5674c1c`), eight findings:
  - Finding 1 (high: a snapshot or host with `scroll-behavior: smooth` animated
    the controller's `scrollTop` writes, so the read-back lagged and animation
    steps pulled the shared viewport back) broke the "scroll as one" contract
    and was fixed in `28c0a3e`: every programmatic scroll uses `scrollTo` with
    `behavior: "instant"`. The new unit test with animating fakes and the
    browser case "smooth-scrolling documents and hosts still move as one"
    failed before the fix (the stack settled at 399 instead of 400).
  - Finding 3 (medium: the Acceptance section claimed proofs through both
    output modes and every host that only live Serve had) was fixed in `28c0a3e`
    with `comparison_alignment_hosts.spec.ts`: a static export (stack, Side by
    side, read-only), an embedded viewer through both frame adapters (stack,
    read-only) and the pane failure path (failure copy, host error, Try again);
    the Acceptance section now names the proving specs.
  - Finding 7 (low: the removed previews contract still said the guard
    installs on each load) was fixed in `28c0a3e`.
  - Finding 8 (low: this record and the commit TODO were missing) is resolved
    by this entry.
  - Findings 2 (medium: a document that shrinks while scrolled past its end
    moves the shared offset to its new end), 4 (medium: Decision 3 awaits the
    user's confirmation), 5 (medium: Milestone 1 finding 7, a host
    `base-uri` policy that ignores the presented `<base>`) and 6 (low: a frame
    reused for a new scheme accepts its outgoing document and reloads the new
    one once) were reported for a decision rather than applied.
- Still open for the user's decision: Decision 3 and review findings 2, 5 and
  6; Milestone 2 finding 5 (the long overlay's rationale); and the Milestone 3A
  question whether every caption should name the recorded reason.
