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

The modules this plan changes exist only on the removed-content-previews branch
(`calummoore/bamako-v4`, pull request #98, tip `cf06cfd`); `origin/main` has
no `packages/viewer/src/previews/` and no removed-previews contract yet. Branch
this work from that tip, or from its re-integration with the hydrated React
shell if #98 is rebased first. The contract below does not depend on which
shell renders the stage; only the file references in Milestone 2 do, and the
implementer records the actual base commit in the review record.

The user asked for this plan after the review finding was compared with the
[authenticated frame document handoff plan](https://github.com/mokly-ai/mokly/blob/calummoore/tashkent-v2/plans/authenticated-frame-document-handoff.md)
on branch `calummoore/tashkent-v2` and found to be a different issue: that
plan authenticates same-origin document identity for the navigation receiver
and deliberately preserves frame-owned native links for unowned documents,
whereas this plan removes native link navigation from historical documents
entirely.

## Problem

`packages/viewer/src/previews/read_only.ts` installs the guard through
`frame.contentDocument`. A same-origin host reaches that document and the
guard cancels link and form activation. In a cross-origin embedded viewer the
preview frame's `src` points at the artifact origin, `contentDocument` is
inaccessible, and the frame keeps `sandbox="allow-same-origin"` with no
script permission. That sandbox withholds forms, popups, downloads and top
navigation, but it never withholds navigation of the frame itself, so a
portable relative link, a marked catalogue link rewritten to its relative
artifact path, or a plain external link replaces the historical document
inside its frame. The review probe confirmed the link issued a document
request and changed the child frame URL to
`snapshots/before/screens/current.mobile.html` while the outer `src`
attribute stayed at the removed page. The
[removed previews contract](../docs/protocol/mokly-removed-previews.md)
currently states this limitation ("Cross-origin previews rely on the sandbox
alone"), so code and docs agree, but the Behavior section's promise that every
link is inert does not hold for that host.

## Decisions

1. **One presentation path for every host.** Same-origin Serve, static export
   and both viewer adapters present historical documents the same way. A
   cross-origin-only branch would keep two presentation paths, two regression
   sets and a guard that must know which path it is on; the reviewer's phrase
   "so the guard applies everywhere" is taken literally. Existing same-origin
   read-only tests must keep passing against the new path.
2. **Fetch, validate, then present through `srcdoc`.** The viewer fetches each
   historical document with an ordinary GET under the comparison request's
   credentials rule, accepts the response only when its final URL is exactly
   the requested snapshot address, the status is OK, the content type is
   `text/html` and the body is within the existing 64 MiB artifact bound, and
   assigns the presentation to the frame's `srcdoc`. The frame keeps
   `sandbox="allow-same-origin"` and no script permission, so the document
   runs at the viewer's origin, cannot execute, submit, open windows,
   download or navigate the top window, and the parent can reach it.
   `srcdoc` is chosen over `document.write` and Blob URLs because it is a
   declarative attribute the future React stage can own directly and needs no
   object-URL lifecycle.
3. **Resource resolution through one injected `<base href>`.** The historical
   HTML is parsed with scripting disabled, every `<base>` element and every
   `<meta http-equiv="refresh">` is removed, and one `<base href>` is
   prepended to the head naming the document's effective base: the first
   removed `<base href>` resolved against the snapshot address when one
   existed, otherwise the snapshot address itself. The doctype and every
   other node are serialized unchanged, so the compatibility mode and the
   consumer's markup are preserved. Rewriting every resource attribute and
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
  `same_origin_mount.ts`, `post_message_adapter.ts` or the inspector.
- Capture, packaging, descriptors, Serve routes and export inventories are
  unchanged; no server or CLI code changes.
- No mockup work: every visible state (label, loading, unavailable, missing
  view note, device chrome) is unchanged, so the design catalogue stays as it
  is.

## Milestone 1: Protocol And Documentation Contract

Summary: define the viewer-owned presentation, the guard rules, the fetch set
and the host requirements in the specs and package docs so Milestone 2 has a
complete contract, and register the plan.

- [ ] Record the actual base commit for this branch at the top of this plan.
- [ ] In [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md)
      `## Behavior`, keep the read-only paragraph and state that it holds in
      every host, including cross-origin embedded viewers, and that a
      historical document's `:target` styling does not apply.
- [ ] In `## Public Descriptor`, extend the embedded-viewer fetch sentence with
      the historical documents beneath the advertised generation's
      `snapshots/before/`, and replace "Both frame adapters render previews in
      script-disabled frames; the cross-origin adapter mounts historical
      documents without the inspector handshake" with: neither adapter mounts
      a preview frame; previews are viewer-owned documents, so no handshake,
      inspection, marker or navigation message exists for them.
- [ ] Rewrite `## Frames And Lifecycle` from "Preview frames are the existing
      shell frames" through "Original historical bytes are not transformed for
      presentation." as the presentation contract: the fetch and its
      acceptance rules (exact final URL, OK status, `text/html`, 64 MiB
      bound, comparison credentials rule, mount signal), the parse with
      scripting disabled, the removal of `<base>` and meta refresh, the single
      prepended `<base href>` and its effective-base rule, unchanged doctype
      and node serialization, `srcdoc` presentation in a script-disabled
      `allow-same-origin` frame at the viewer's origin, the
      `data-mokly-preview-source` attribute carrying the snapshot address,
      the guard rules from Decisions 4 and 5, and the statement that snapshot
      files and comparison bytes stay byte-identical while only the
      presentation carries these edits.
- [ ] In `## Acceptance`, add: read-only proof through both adapters in an
      embedded viewer including plain external and relative links; rejection
      of redirected, other-origin, non-HTML and oversized documents; meta
      refresh removal; consumer `<base>` handling; doctype and compatibility
      mode preservation; guard-owned anchor scrolling; presentation restored
      after an external navigation of the frame; a strict-CSP embedded host.
- [ ] In [`mokly-frame-adapter.md`](../docs/protocol/mokly-frame-adapter.md),
      replace the Delivery Status sentence "Historical page and screen frames
      use both adapters without inspection handshakes" and the Same-Origin
      sentence "Historical removed previews use the same frames with
      parent-enforced read-only links and forms" with the viewer-owned
      presentation and a link to the removed-previews contract.
- [ ] In [`mokly-viewer.md`](../docs/protocol/mokly-viewer.md), qualify
      "hydration never reaches inside a frame" so the parent reaches inside
      only viewer-owned preview documents to enforce read-only behaviour, and
      extend the network-activity sentence with historical documents fetched
      from the advertised generation.
- [ ] In [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md)
      and [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md), note
      that historical HTML documents under `__mokly/diffs/__generations/**`
      are fetched rather than framed, so the existing CORS, MIME and nosniff
      rules apply to them.
- [ ] In [`packages/viewer/README.md`](../packages/viewer/README.md), add the
      embedded-host requirements: CORS on the generation files, and a host
      CSP that allows the artifact origin in `img-src`, `style-src`,
      `font-src` and `media-src` plus inline styles, because previews are
      presented at the host's origin with scripts disabled.
- [ ] Update [`packages/viewer/src/previews/README.md`](../packages/viewer/src/previews/README.md)
      and [`packages/viewer/src/client/README.md`](../packages/viewer/src/client/README.md):
      describe the new presentation module, the guard's anchor and restore
      rules, and remove "a cross-origin preview relies on its sandbox instead".
- [ ] In [`removed-content-previews.md`](./removed-content-previews.md)
      "Remaining risks", state that the High finding is tracked by this plan;
      add this plan to the active list in [`plans/README.md`](./README.md)
      and point the completed removed-previews entry at it.
- [ ] Validate the changed Markdown with `npm run format:check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Viewer-Owned Presentation

Tags: ui

Summary: prove the cross-origin gap with failing regressions, then replace
URL-framed previews with fetched, validated, viewer-owned documents guarded in
every host, keeping every existing preview regression green.

- [ ] Extend `tests/helpers/removed_preview_fixture.ts`: add a plain external
      link without `target` and a `<meta http-equiv="refresh">` pointing at
      `../screens/current.mobile.html` to the removed page and screens. Add a
      `csp` option to `tests/helpers/static_server.ts` that sends a
      `Content-Security-Policy` header on HTML responses.
- [ ] Add failing embedded-viewer regressions to
      `tests/browser/removed_previews_viewer.spec.ts` for both adapters: with
      the previous version shown, click the marked, relative, plain external
      and download links, submit the form and press Enter on a focused link;
      assert no `document` request is issued, `frameMessages` stays empty, the
      frame still shows "Previous page" and the outer URL is unchanged. Confirm
      the cross-origin case fails on the current implementation and record the
      failing assertion in the review record.
- [ ] Add `tests/browser/removed_preview_presentation.spec.ts` with an esbuild
      harness entry (like `removed_preview_viewer_entry.tsx`) that exposes the
      presentation module, and assert in a real browser: the prepended
      `<base>` is the first head child; a consumer `<base href>` is removed
      and folded into the effective base; meta refresh is removed; an
      `<html lang>` attribute and the compatibility mode of a standards and a
      quirks document are preserved, and a document with an implicit head
      still receives the prepended base first; a fetch whose final
      URL differs, whose origin differs, whose type is not HTML or whose body
      exceeds the bound is rejected.
- [ ] Create `packages/viewer/src/previews/presentation.ts` owning the fetch,
      acceptance rules, per-address cache for one loaded preview, and the
      parse-edit-serialize step that returns the `srcdoc` text and its snapshot
      address; keep it pure over an injected `fetch` and parser so it is
      unit-testable, and under 300 lines with doc comments on public items.
- [ ] Extend the embedded viewer's fetch confinement in
      `packages/viewer/src/viewer/scope.ts` (or its React-shell successor) with
      the `snapshots/before/` prefix of the advertised comparison generation,
      keeping exact matching for every other advertised path, and cover it in
      `tests/client_removed_previews.test.ts`.
- [ ] In `packages/viewer/src/previews/render.ts`, create preview frames from
      a presentation rather than a URL: assign `srcdoc`, keep
      `sandbox="allow-same-origin"`, set `data-mokly-preview-source` to the
      snapshot address, and never set `src`. In `install.ts`, fetch and
      validate every document the selected viewports and scheme need before
      rendering, reuse the cache on viewport and scheme changes, fence late
      responses with the existing ownership check, and route any failure to
      the unavailable state with Retry.
- [ ] In `packages/viewer/src/previews/read_only.ts`, cancel every link
      activation including same-document anchors, resolving the activated
      link through `composedPath()` so a declarative shadow root cannot hide
      one; scroll the fragment's element into view for anchors that name the
      presented document; keep Space's default; cancel form submission; and
      on every later `load` present the historical document again when the
      frame's document is not the presented one. Keep `same_origin_navigation.ts` skipping
      `[data-mokly-preview-frame]`.
- [ ] Update existing specs to the new presentation without weakening them:
      locate the historical frame through its element instead of
      `frame.url().includes("snapshots/before")`, assert
      `data-mokly-preview-source` where `src` was asserted in
      `removed_preview_views.spec.ts`, and keep the served, static and
      expired-generation reacquire tests passing against `srcdoc` frames.
- [ ] Add a strict-CSP embedded-host test: serve the viewer page with a policy
      that allows only its own origin and the artifact origin for images,
      styles, fonts and media, assert the historical stylesheet applied
      (`archive.css` background) and that the browser reported no policy
      violation; correct the README directive list if the fixture proves it
      wrong.
- [ ] Run the viewer build and typecheck, `npm run lint`, the changed unit
      tests, and `tests/browser/removed_previews.spec.ts`,
      `removed_preview_views.spec.ts`, `removed_previews_static.spec.ts`,
      `removed_previews_viewer.spec.ts`, `removed_preview_presentation.spec.ts`
      three times to show they are deterministic; confirm the package check
      (`npm run package:check`) accepts the unchanged browser inventory and
      that the inspector budget is untouched.
- [ ] Smoke by hand: `npm run dev`, open a removed page and screen, follow
      every link and the form, toggle viewport and scheme, then repeat through
      the exported catalogue and the cross-origin viewer fixture; save
      screenshots under `.context/`.
- [ ] Run the complete `cargo xtask check` gate with no failures or skips.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use
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

To be completed after each milestone's post-push review, including the
assertion the cross-origin regression fails on before the fix.
