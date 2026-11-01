# Removed previews skip the removed-detail fence

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the options check of the plan for the viewer's leftover layers.
- **Location:** `packages/viewer/src/previews/content.ts:26-37`, `packages/viewer/src/previews/request.ts:132-147`, `packages/viewer/src/shell/data_requests.ts:45-54`, `docs/protocol/mokly-removed-previews.md:126-131`, and `docs/protocol/mokly-viewer.md:47-49`.
- **Reason:** Each fix adds a runtime rejection or changes a protocol requirement, and the user reserves both choices.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Removed detail:** the entry detail of a removed entry. It lives in the
    comparison generation that the index's `comparisonUrl` names.
  - **Fence:** the check that a fetched detail belongs to the index that the
    viewer holds, in `docs/protocol/mokly-shell-fences.md`.
- **Background:**
  - `docs/protocol/mokly-shell-fences.md:43-45` accepts a removed detail only
    when its `identity` equals the index, its path selects the index's removed
    record, and its `snapshotId` and `detailId` equal that record.
  - The route of a removed entry already requests that detail through the
    shell data layer, which applies the fence, in
    `packages/viewer/src/shell/data_requests.ts:45-54`.
  - The preview of a removed screen reads the same file a second time, in
    `packages/viewer/src/previews/request.ts:149-177`. It checks the kind,
    the path, and the snapshot id, in `previews/content.ts:26-37` and
    `previews/request.ts:132-147`. It checks neither `detailId` nor the
    catalogue identity, and its stage does not wait for the fenced copy, in
    `packages/viewer/src/shell/views.tsx:85-86`.
  - In an embedded host, `docs/protocol/mokly-viewer.md:47-49` takes the
    removed detail from the host's `detail` source, while
    `docs/protocol/mokly-removed-previews.md:126-131` fetches it from the
    generation. So one removed detail has two sources.
- **Problem:** A removed detail that fails the fence can still show its
  preview, against the fail-closed table of `mokly-shell-fences.md:65`.
- **Impact if no action:** A stale or wrong removed detail shows a preview
  instead of the unavailable state. Generation files never change, so normal
  use rarely meets this.
- **Root question:** How does a removed entry's preview show only the removed
  detail that the index names?
- **Options:**
  - **A.** Apply the removed-detail fence inside `requestPreview`. This adds
    runtime rejections that the protocol already asks for. Effort: Small.
  - **B.** Show the preview from the removed detail that the route already
    loads and fences, and drop the second read. In an embedded host, the
    preview then uses the host's `detail` answer, so
    `mokly-removed-previews.md:126-131` changes. Effort: Medium.
  - **C.** Change nothing. Effort: Small.
- **Left out:** None.
- **Wider fix:** B, because one read path applies the fetch rule and the
  fence once, and it also ends the two sources of one removed detail.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/viewer-credential-rule.md`: both items
  change how the viewer reads files.
- **Recommendation:** B. One fenced read serves the route and the preview, and
  it removes a duplicate request.
- **Action:** ask the user, because B changes a protocol requirement and A
  adds runtime rejections, and the user reserves both.
