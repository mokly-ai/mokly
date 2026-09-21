# Viewer-Owned Historical Previews

Close the High finding recorded by the final review of the
[removed content previews plan](./removed-content-previews.md): in a
cross-origin embedded viewer, links inside a historical preview can still
navigate their own frame, because the parent cannot reach a cross-origin
document to install its read-only guard and the frame sandbox does not forbid
self-navigation. Same-origin Serve and exports are unaffected. This plan makes
the "every link is inert" promise hold in every host by presenting each
validated historical document through a viewer-owned same-origin document, so
the parent guard applies everywhere. It is the reviewer's recommended option A.

## Base And Prerequisites

This plan is based on `origin/main` at `a177abd`, which contains the merged
removed content previews change (pull request #98) re-integrated with the
hydrated React shell. The preview request lifecycle lives in
`packages/viewer/src/shell/use_removed_preview.ts` and the stage, frames and
guard installation in `packages/viewer/src/shell/previews.tsx`; the pure
request, descriptor, copy and guard modules live under
`packages/viewer/src/previews/`. Serve, static export and application-owned
`@mokly/viewer` roots share that one React lifecycle.

The user asked for this plan after the review finding was compared with the
authenticated frame document handoff change (pull request #99, merged as
`b95ad47`) and found to be a different issue: that change authenticates
same-origin document identity for the navigation receiver and deliberately
preserves frame-owned native links for unowned documents, whereas this plan
removes native link navigation from historical documents entirely.

## Problem

`packages/viewer/src/previews/read_only.ts` installs the guard through
`frame.contentDocument`, called from the `PreviewFrame` component in
`packages/viewer/src/shell/previews.tsx`. A same-origin host reaches that
document and the guard cancels link and form activation. In a cross-origin embedded viewer the
preview frame's `src` points at the artifact origin, `contentDocument` is
inaccessible, and the frame keeps `sandbox="allow-same-origin"` with no
script permission. That sandbox withholds forms, popups, downloads and top
navigation, but it never withholds navigation of the frame itself, so a
portable relative link, a marked catalogue link rewritten to its relative
artifact path, or a plain external link replaces the historical document
inside its frame. A 2026-09-21 probe against the exact `origin/main` base
`a177abd` confirmed that “Relative link” through the `postMessageAdapter`
fixture issued a document request for
`snapshots/before/screens/current.mobile.html` and replaced the preview while
the outer `src` attribute stayed at the removed page. The same activation
through `sameOriginAdapter` was cancelled. Before Milestone 1, the
[removed previews contract](../docs/protocol/mokly-removed-previews.md)
documented that limitation even though its Behavior section promised every
link was inert. Milestone 1 replaces that limitation with the viewer-owned
contract; the current implementation retains the gap until Milestone 2.

## Decisions

1. **One presentation path for every host.** Same-origin Serve, static export
   and both viewer adapters present historical documents the same way. A
   cross-origin-only branch would keep two presentation paths, two regression
   sets and a guard that must know which path it is on; the reviewer's phrase
   "so the guard applies everywhere" is taken literally. Existing same-origin
   read-only tests must keep passing against the new path.
2. **Fetch, validate, then present through `srcdoc`.** The viewer fetches each
   historical document with an ordinary GET under the comparison request's
   credentials rule, accepts the response only when its final URL is the
   requested snapshot address or its provider-normalized extensionless form
   (the `.html` canonicalization static hosts already apply to shell pages),
   the status is OK, the content type is `text/html` and the body is within
   the existing 64 MiB artifact bound, and
   assigns the presentation to the frame's `srcdoc`. The frame keeps
   `sandbox="allow-same-origin"` and no script permission, so the document
   runs at the viewer's origin, cannot execute, submit, open windows,
   download or navigate the top window, and the parent can reach it.
   `srcdoc` is chosen over `document.write` and Blob URLs because it is a
   declarative attribute the React stage owns directly and needs no
   object-URL lifecycle.
3. **Resource resolution through one injected `<base href>`.** The historical
   HTML is parsed with scripting disabled, every `<base>` element and every
   `<meta http-equiv="refresh">` is removed, and one `<base href>` is
   prepended to the head naming the document's effective base: the first
   removed `<base href>` resolved against the snapshot address when one
   existed, otherwise the snapshot address itself. The doctype and every
   other node are serialized unchanged, so the consumer's markup is
   preserved; a `srcdoc` document always renders in no-quirks mode, which is
   accepted for previous versions. Rewriting every resource attribute and
   stylesheet URL instead would be lossy and fragile. Meta refresh is removed
   because it is a frame navigation the sandbox does not block.
4. **The guard owns same-document anchors.** Because the presented document's
   URL is `about:srcdoc` while its base is the snapshot address, a native
   `#fragment` activation would be a full navigation to the base URL. The
   guard therefore cancels every link activation, and when the activated
   link resolves to the presented document plus a fragment it scrolls that
   element into view itself. Space keeps its default so long documents stay
   readable from the keyboard. `:target` styling does not apply in previews.
5. **Navigation cannot replace the presentation.** If the frame ever loads a
   document other than the presented one, the parent presents the historical
   document again. This is defence in depth behind the guard and the refresh
   removal, not a substitute for them.
6. **Embedded viewers fetch only under the advertised generation.** The fetch
   set an embedded viewer may request grows by every path beneath
   `snapshots/before/` of the generation `comparisonUrl` names, on the source
   origin, under the existing CORS and `credentials: "omit"` rules. The
   artifact host's documented CORS requirement already covers
   `__mokly/diffs/__generations/**`, so HTML snapshots need no new hosting
   rule beyond a correct MIME type.
7. **Host CSP applies to previews and is documented.** A `srcdoc` document
   inherits its parent's Content Security Policy, so an embedded host with a
   CSP must allow the artifact origin for the images, stylesheets, fonts and
   media a historical document loads, including inline styles generated
   documents carry. First-party Serve and export already run previews at
   their own origin, so nothing changes for them; the requirement is stated
   for embedded hosts and proven by a strict-CSP fixture.
8. **Rejected alternatives.** Accepting the documented limitation leaves the
   product promise false for the host that embeds catalogues. Stripping links
   from snapshot bytes at capture or export time would break the rule that
   comparison snapshots stay byte-identical and would still leave meta refresh
   and Serve's live generations untouched. Injecting a guard script into
   historical documents would require `allow-scripts`, enabling consumer
   scripts the contract disables.

## Non-Goals

- Comparison panes keep their opaque `sandbox=""` frames and direct snapshot
  URLs; link activation inside a comparison pane retains its existing
  behaviour.
- Current screens, pages and component frames keep their adapter mounts,
  authenticated navigation and inspection; nothing here touches
  `same_origin_mount.ts`, `same_origin_identity.ts`,
  `post_message_adapter.ts` or the inspector.
- Capture, packaging, descriptors, Serve routes and export inventories are
  unchanged; no server or CLI code changes.
- No mockup work: every visible state (label, loading, unavailable, missing
  view note, device chrome) is unchanged, so the design catalogue stays as it
  is.

## Milestone 1: Protocol And Documentation Contract

Summary: define the viewer-owned presentation, the guard rules, the fetch set
and the host requirements in the specs and package docs so Milestone 2 has a
complete contract, and register the plan.

- [x] In [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md)
      `## Behavior`, keep the read-only paragraph and state that it holds in
      every host, including cross-origin embedded viewers, and that a
      historical document's `:target` styling does not apply.
- [x] In `## Public Descriptor`, extend the embedded-viewer fetch sentence with
      the historical documents beneath the advertised generation's
      `snapshots/before/`, and establish that neither adapter mounts a preview
      frame: previews are viewer-owned documents, so no handshake, inspection,
      marker or navigation message exists for them.
- [x] Rewrite `## Frames And Lifecycle` as the presentation contract: the fetch
      and its acceptance rules (exact final URL, OK status, `text/html`, 64 MiB
      bound, comparison credentials rule, mount signal), the parse with
      scripting disabled, the removal of `<base>` and meta refresh, the single
      prepended `<base href>` and its effective-base rule, unchanged doctype and
      node serialization, `srcdoc` presentation in a script-disabled
      `allow-same-origin` frame at the viewer's origin, the
      `data-mokly-preview-source` attribute carrying the snapshot address,
      the guard rules from Decisions 4 and 5, and the statement that snapshot
      files and comparison bytes stay byte-identical while only the
      presentation carries these edits.
- [x] In `## Acceptance`, add: read-only proof through both adapters in an
      embedded viewer including plain external and relative links; rejection
      of redirected, other-origin, non-HTML and oversized documents; meta
      refresh removal; consumer `<base>` handling; doctype and compatibility
      mode preservation; guard-owned anchor scrolling; presentation restored
      after an external navigation of the frame; a strict-CSP embedded host.
- [x] In [`mokly-frame-adapter.md`](../docs/protocol/mokly-frame-adapter.md),
      document that neither adapter mounts a historical preview, link to the
      removed-previews contract, and define the viewer-owned presentation and
      parent guard that apply in every host.
- [x] In [`mokly-viewer.md`](../docs/protocol/mokly-viewer.md), qualify
      the frame hydration boundary so the parent reaches inside only
      viewer-owned preview documents to enforce read-only behaviour, and extend
      the network-activity sentence with historical documents fetched from the
      advertised generation.
- [x] In [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md)
      and [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md), note
      that historical HTML documents under `__mokly/diffs/__generations/**`
      are fetched rather than framed, so the existing CORS, MIME and nosniff
      rules apply to them.
- [x] In [`packages/viewer/README.md`](../packages/viewer/README.md), add the
      embedded-host requirements: CORS on the generation files, and a host
      CSP that allows the artifact origin in `img-src`, `style-src`,
      `font-src` and `media-src` plus inline styles, because previews are
      presented at the host's origin with scripts disabled.
- [x] Update [`packages/viewer/src/previews/README.md`](../packages/viewer/src/previews/README.md),
      [`packages/viewer/src/shell/README.md`](../packages/viewer/src/shell/README.md)
      and [`packages/viewer/src/client/README.md`](../packages/viewer/src/client/README.md):
      describe the new presentation module and the guard's anchor and restore
      rules, and replace the former cross-origin limitation with the
      viewer-owned path.
- [x] In [`removed-content-previews.md`](./removed-content-previews.md)
      "Remaining risks", state that the High finding is tracked by this plan;
      add this plan to the active list in [`plans/README.md`](./README.md)
      and point the completed removed-previews entry at it.
- [x] Validate the changed Markdown with `npm run format:check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Viewer-Owned Presentation

Tags: ui

Summary: prove the cross-origin gap with failing regressions, then replace
URL-framed previews with fetched, validated, viewer-owned documents guarded in
every host, keeping every existing preview regression green.

- [x] Extend `tests/helpers/removed_preview_fixture.ts`: add a plain external
      link without `target` and a `<meta http-equiv="refresh">` pointing at
      `../screens/current.mobile.html` to the removed page and screens. Add a
      `csp` option to `tests/helpers/static_server.ts` that sends a
      `Content-Security-Policy` header on HTML responses.
- [x] Add failing embedded-viewer regressions to
      `tests/browser/removed_previews_viewer.spec.ts` for both adapters: with
      the previous version shown, click the marked, relative, plain external
      and download links, submit the form and press Enter on a focused link;
      assert no `document` request is issued, `frameMessages` stays empty, the
      frame still shows "Previous page" and the outer URL is unchanged. Confirm
      the cross-origin case fails on the current implementation and record the
      failing assertion in the review record.
- [x] Add `tests/browser/removed_preview_presentation.spec.ts` with an esbuild
      harness entry (like `removed_preview_viewer_entry.tsx`) that exposes the
      presentation module, and assert in a real browser: the prepended
      `<base>` is the first head child; a consumer `<base href>` is removed
      and folded into the effective base; meta refresh is removed; an
      `<html lang>` attribute and the doctype of a standards and a quirks
      document are preserved while both render in no-quirks mode, and a
      document with an implicit head still receives the prepended base first;
      a fetch whose final URL only drops the `.html` suffix is accepted, and
      one whose final URL otherwise differs, whose origin differs, whose type
      is not HTML or whose body exceeds the bound is rejected.
- [x] Create `packages/viewer/src/previews/presentation.ts` owning the fetch,
      acceptance rules, per-address cache for one loaded preview, and the
      parse-edit-serialize step that returns the `srcdoc` text and its snapshot
      address; keep it pure over an injected `fetch` and parser so it is
      unit-testable, and under 300 lines with doc comments on public items.
- [x] Confine historical document fetches: `presentation.ts` accepts only
      addresses beneath `snapshots/before/` of the generation the loaded
      preview resolved against, on the same origin, with `credentials: "omit"`
      for pinned delivery and the comparison request's rule for live
      delivery; extend `advertisedPreviewPaths` (or a sibling) in
      `packages/viewer/src/previews/request.ts` so the documented embedded
      fetch set includes that prefix, and cover both in
      `tests/client_removed_previews.test.ts`.
- [x] In `packages/viewer/src/shell/previews.tsx`, render `PreviewFrame`
      from a presentation rather than a URL: assign `srcdoc`, keep
      `sandbox="allow-same-origin"`, set `data-mokly-preview-source` to the
      snapshot address, and never set `src`. In
      `packages/viewer/src/shell/use_removed_preview.ts`, fetch and validate
      every document the selected viewports and scheme need before reporting
      `ready`, reuse loaded presentations on viewport and scheme changes
      after the existing renewal check, fence late responses with the
      existing controller, and route any failure to the failed state with
      Retry. Keep both files under 300 lines, splitting a
      `use_removed_preview_documents.ts` hook if needed.
- [x] In `packages/viewer/src/previews/read_only.ts`, cancel every link
      activation including same-document anchors, resolving the activated
      link through `composedPath()` so a declarative shadow root cannot hide
      one; scroll the fragment's element into view for anchors that name the
      presented document; keep Space's default; cancel form submission; and
      on every later `load` present the historical document again when the
      frame's document is not the presented one. Keep
      `same_origin_navigation.ts` skipping `[data-mokly-preview-frame]` and
      keep the module's existing `enforcePreviewReadOnly` entry point.
- [x] Update existing specs to the new presentation without weakening them:
      in `removed_previews.spec.ts` locate the historical frame through its
      element instead of `frame.url().includes("snapshots/before")` and
      assert its document identity through `data-mokly-preview-source`
      rather than `frame.url()`; assert `data-mokly-preview-source` where
      `src` was asserted in `removed_preview_views.spec.ts`; and keep the
      served, static, shell unit and expired-generation reacquire tests
      passing against `srcdoc` frames.
- [x] Add a strict-CSP embedded-host test in
      `removed_previews_viewer.spec.ts`: serve the viewer page with a policy
      that allows only its own origin and the artifact origin for images,
      styles, fonts and media, assert the historical stylesheet applied
      (`archive.css` background) and that the browser reported no policy
      violation; correct the README directive list if the fixture proves it
      wrong.
- [x] Run the viewer build and typecheck, `npm run lint`, the changed unit
      tests, and `tests/browser/removed_previews.spec.ts`,
      `removed_preview_views.spec.ts`, `removed_previews_static.spec.ts`,
      `removed_previews_viewer.spec.ts`, `removed_preview_presentation.spec.ts`
      three times to show they are deterministic; confirm the package check
      (`npm run package:check`) accepts the unchanged browser inventory and
      that the inspector budget is untouched.
- [x] Smoke by hand: `npm run dev`, open a removed page and screen, follow
      every link and the form, toggle viewport and scheme, then repeat through
      the exported catalogue and the cross-origin viewer fixture; save
      screenshots under `.context/`.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 3: Review Fixes

Tags: ui

Summary: apply the five findings from the Milestone 2 post-push review so the
guard covers every anchor form, the presentation keeps document-level nodes,
a missing presentation degrades to the failed state, the advertised fetch set
is typed, and the completed removed-previews plan states the resolution.

- [x] Finding 1: add an SVG `<a xlink:href>` anchor to the removed page and
      screens in `tests/helpers/removed_preview_fixture.ts`, extend the
      inert-link regressions in `removed_previews_viewer.spec.ts` (both
      adapters) and `removed_previews.spec.ts` to click it and assert no
      document request, then make `read_only.ts` match `a` and `area` by
      local name on the composed path regardless of which `href` attribute
      they carry, reading the SVG `xlink:href` when `href` is absent for the
      fragment rule.
- [x] Finding 2: serialize every top-level document child in order in
      `presentation_document.ts` (doctype through the existing serializer,
      comments as `<!--…-->`, the document element as `outerHTML`), extend
      `removed_preview_presentation.spec.ts` to prove a comment before and
      after `<html>` survives, and state in
      `docs/protocol/mokly-removed-previews.md` that document-level comments
      are preserved.
- [x] Finding 3: in `plans/removed-content-previews.md`, replace "The
      implementation remains unchanged until that plan's viewer presentation
      milestone" with the resolution and the `9ae758e` commit, keeping the
      dated probe record.
- [x] Finding 4: make `presentationFor` in `shell/previews.tsx` return
      `undefined` for a missing address and render the failed state with
      Retry instead of throwing; cover it with a unit test that renders the
      ready state with an incomplete map (precedent
      `tests/removed_preview_shell.test.ts`).
- [x] Finding 5: change `advertisedPreviewPaths` in `previews/request.ts` to
      return a typed `{ files: readonly string[]; prefixes: readonly string[] }`
      value, update its unit test and the previews README sentence.
- [x] Run the viewer build and typecheck, `npm run lint`,
      `npm run format:check`, the changed unit tests, and the five preview
      browser specs three times; then the complete `cargo xtask check` gate
      with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Publish the `@mokly/viewer` version carrying the presentation; embedded
  hosts adopt it and the CSP guidance on their next dependency update, and
  exported catalogues redeploy to pick up the new browser inventory.
- Smoke a deployed repository preview with `--include-changes` from a real
  cross-origin embed: open a removed page, follow its links, and confirm the
  previous version stays in place.

## Review record

### Milestone 1

The post-push review of `da7ade2` against browser behaviour on this base found
two contract errors, corrected in `f10a066` before Milestone 2 started: a
`srcdoc` document always renders in no-quirks mode, so the contract no longer
promises to preserve quirks or limited-quirks compatibility modes; and static
hosts may canonicalize a final `.html` suffix away, as the frame adapter and
static workspace evidence read already accept, so the fetch acceptance rule
allows that provider-normalized final URL. No other findings.

### Milestone 2

- Base commit: `f10a066` on `calummoore/jakarta-v2`, based on `origin/main` at
  `a177abd`.
- Pre-fix regression: `MOKLY_PLAYWRIGHT_PORT=4517 npx playwright test
tests/browser/removed_previews_viewer.spec.ts --grep "a previous version
stays inert through the cross adapter"` failed at
  `await expect(preview.locator("h1")).toHaveText("Previous page")` with
  `Expected: "Previous page"` and `Error: element(s) not found` after the
  relative link replaced the historical frame.
- Checks: `npm run build`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`,
  `npx tsx --test tests/client_removed_previews.test.ts
tests/client_removed_preview_requests.test.ts
tests/client_removed_preview_presentation.test.ts
tests/removed_preview_shell.test.ts` (20/20), the five changed browser specs
  through `MOKLY_PLAYWRIGHT_PORT=<port> npx playwright test
tests/browser/removed_previews.spec.ts
tests/browser/removed_preview_views.spec.ts
tests/browser/removed_previews_static.spec.ts
tests/browser/removed_previews_viewer.spec.ts
tests/browser/removed_preview_presentation.spec.ts` on ports 4532, 4533 and
  4534 (30/30 on every run),
  `npm run package:check`, and `cargo xtask check` all passed. The focused
  `MOKLY_PLAYWRIGHT_PORT=4531 npx playwright test
tests/browser/catalogue_fetch.spec.ts
tests/browser/removed_previews_viewer.spec.ts` security regression also
  passed (11/11).
- Smoke: `npm run dev` served the example catalogue at
  `http://127.0.0.1:4173`. Because it contained no removed entries, the served,
  exported and cross-origin fixtures were exercised instead. Screenshots are
  `.context/viewer-owned-preview-dev.png`,
  `.context/viewer-owned-preview-served-page.png`,
  `.context/viewer-owned-preview-served-screen.png`,
  `.context/viewer-owned-preview-exported.png`,
  `.context/viewer-owned-preview-cross-origin-page.png` and
  `.context/viewer-owned-preview-cross-origin-screen.png`.

The post-push review of `9ae758e` against `origin/main` recorded these
findings for the user's decision; none was applied automatically:

1. Medium: the guard matches `a[href], area[href]`, so an SVG anchor that
   uses `xlink:href` is not cancelled. A browser probe confirmed such a click
   navigates a sandboxed `srcdoc` frame; the load-time restoration then
   re-presents the document, but a document request is still issued.
   Recommended: match `a` and `area` by local name on the composed path
   regardless of which `href` attribute they carry, add an SVG `xlink:href`
   anchor to the fixture, and extend the inert-link regressions.
2. Low: the presentation is serialized from the doctype plus
   `documentElement.outerHTML`, so comments before or after `<html>`, such as
   the generated ownership header, are dropped although the contract says
   other parsed nodes are serialized unchanged. Recommended: serialize every
   top-level document child in order, or narrow the contract.
3. Low: the completed removed content previews plan still says the
   implementation remains unchanged until this plan's presentation milestone.
   Recommended: state the resolution and commit there.
4. Low: `presentationFor` in `shell/previews.tsx` throws during render when a
   selected address has no presentation. The hook guarantees the map is
   complete, but the shell has no error boundary, so a future mismatch would
   unmount the viewer rather than show the unavailable state. Recommended:
   render the failed state for a missing presentation.
5. Low: `advertisedPreviewPaths` now mixes exact file paths with one
   directory prefix in a single string array. Nothing in production reads it
   after the React shell, but a future consumer could treat the prefix as a
   file. Recommended: return a typed `{ files, prefixes }` shape or document
   the mixed contents on the function.

### Milestone 3

- Base commit: `0fe41f8` on `calummoore/jakarta-v2`, based on `origin/main` at
  `a177abd`.
- Finding 1 pre-fix regression: the focused three-case browser run on port 4539
  failed each retained `expect(documents).toEqual([])` assertion because it
  received one request for `snapshots/before/screens/current.mobile.html`
  after clicking “SVG link.”
- Finding 2 pre-fix regression: the focused presentation test on port 4539
  expected the ordered `comment: before ` and `comment: after ` document nodes
  but received only `doctype:html` and `element:html`.
- Finding 4 pre-fix regression: the new Node test failed
  `assert.doesNotThrow` because `presentationFor` raised “The previous version
  is unavailable.” Findings 3 and 5 were documentation and typed-contract
  corrections, so no failing browser assertion was expected for them.
- Checks: `npm run build`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`,
  `npx tsx --test tests/client_removed_previews.test.ts
tests/client_removed_preview_requests.test.ts
tests/client_removed_preview_presentation.test.ts
tests/removed_preview_shell.test.ts
tests/removed_preview_presentation_state.test.ts` (21/21), the five preview
  browser specs through `MOKLY_PLAYWRIGHT_PORT=<port> npx playwright test` on
  ports 4541, 4542 and 4543 (30/30 on every run), `npm run package:check`, and
  the complete `cargo xtask check` all passed. The complete gate's unit phase
  passed 2068/2068 with no failures, skips or cancellations.
- The post-push review of `25b4dce` against `origin/main` found no findings.
  Residual risk is limited to host-specific behavior in a deployed cross-origin
  preview and remains the non-blocking post-merge smoke above.
