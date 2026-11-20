# Viewer keeps the old source-path resolver

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from PR #333, post-push review finding 1.
- **Location:** `packages/viewer/src/shell/details_rows.tsx:74` and `:90`,
  `packages/viewer/tests/document_details.test.tsx:82`,
  `packages/viewer/src/catalogue/index_reader.ts:13`,
  `packages/viewer/src/host/types.ts:115`,
  `packages/viewer/src/catalogue/sources.ts:124` and `:162`,
  `crates/mokly-model/src/projection.rs:110`,
  `docs/protocol/mokly-documents.md:183`, and
  `docs/protocol/mokly-format-versions.md:47`.
- **Reason:** Removing the lookup removes links from released catalogue
  indexes, so the work needs a user decision beyond the producer fix.
  On 2026-11-18, the user deferred this choice to a later batch.
- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Catalogue index:** The JSON records that Mokly gives to its published
    viewer.
  - **`relatedDocs`:** An entry's ordered related-document references and
    display labels.
  - **`mock:` reference:** A link value that identifies a catalogue entry by
    its catalogue path.
- **Background:**
  - The Rust producer replaces exact discovered Document source paths with
    `mock:{catalogue path}` references. Comparison metadata calls the same
    resolver with its existing move mapper. Other labels and their order
    stay unchanged. Removed records keep their base-authored labels.
  - The viewer reads references in `details_rows.tsx:89`. The next two lines
    scan current documents for a `details.sourcePath` that equals a plain
    value. A match becomes a link labelled with the document's title.
  - The test at `document_details.test.tsx:82` supplies a raw source path
    and requires that link. It also checks plain labels for removed
    documents, unmatched values, and removed entries.
  - Releases 0.18.0 and 0.19.0 wrote index version 9 with raw source paths.
    At both releases, `projection_records::metadata` copied authored
    `related_docs` unchanged. Both releases used catalogue index version 9.
  - The viewer's version gate accepts version 9 and copies its content.
    The published package exports `MoklyViewer`. Its public `index` prop
    accepts an object or a URL through `host/types.ts` and
    `catalogue/sources.ts`. Released version-9 indexes therefore still
    reach the lookup.
  - `packages/viewer/docs/concepts/README.md:19` tells hosts to supply
    Mokly's files unchanged. Released indexes meet that rule. Mokly Cloud
    also shows retained publications through one viewer. Its
    `apps/app/package.json` names `@mokly/viewer` `0.19.0`, the version of
    the workspace package, so the cloud runs `packages/viewer` of this
    repository.
- **Problem:** The viewer retains a live source-path lookup that duplicates
  the new Rust resolver. The documents protocol says every value without a
  reference stays a display label. The format protocol says no stored-state
  converter or fallback exists at any boundary.
- **Impact if no action:** New output shows the correct links. Older
  version-9 indexes still turn raw paths into links, contrary to the stated
  rule. Mokly Cloud runs the workspace viewer, so its stored version-9
  publications keep these links now, and option A would remove them at
  once. The shared producer resolver does not retire the viewer's second
  matching rule. The viewer protocol identifies duplicate calculations as
  a drift risk in `docs/protocol/mokly-viewer.md:55`.
- **Root question:** Must a newer viewer keep related-document links for
  catalogue indexes built by releases 0.18.0 and 0.19.0?
- **Options:**
  - **A.** Remove the source-path lookup. Update its stale comment and the
    current-document test name. Give that test the projected `mock:`
    reference for its current document. Keep every removed-entry and
    unmatched-label assertion. Older catalogues then show raw paths as
    labels until rebuilt. Mokly Cloud runs the workspace viewer, so A also
    removes the related-document links of its stored version-9
    publications at once. Remove the documents status line when the rule
    is implemented. This removes live functionality and needs approval.
    Effort: Small.
  - **B.** Keep the lookup as an explicit compatibility rule. Update the
    documents protocol and the no-fallback rule in the format protocol.
    Record the user decision and when the exception ends. The matching
    rule stays in Rust and TypeScript. Effort: Small.
  - **C.** Keep the lookup until the next index format number. Keep a
    documents status line linked to this item. Remove the lookup and
    change its test in the later format change. The version gate then
    rejects indexes that need the lookup. Existing links remain, but the
    intended end state waits. Effort: Small.
  - **D.** Raise the catalogue index to version 10 now and remove the
    lookup. Older indexes then show the version error. This adds a
    rejection and needs types, fixtures, docs, and Mokly Cloud changes.
    Cloud currently reads only version 9. Effort: Large.
- **Left out:**
  - Moving the lookup to another viewer boundary keeps the same
    behaviour and protocol conflict. The existing lookup already occupies
    one branch.
  - Rewriting stored Mokly Cloud data is a converter that the format
    protocol forbids.
  - A tagged reference format reopens the selected `mock:` representation
    without improving this compatibility choice.
  - Changing nothing leaves the protocol conflict without a record.
- **Wider fix:** None. The shared plans rule already requires consumers to
  move to the replacement mechanism. Its exception for published exports
  and stored user data requires the user. No new rule or gate is needed.
- **Previous examples:** PR #131, commit `c4138a0b9`, added the viewer
  lookup as a feature. PR #281, commit `f08d02dfb`, adapted it when the
  Rust producer took over viewer calculations.
- **Recommendation:** A. One function change and one changed test input
  reach the protocol end state. Existing catalogues lose these links until
  rebuilt, so the user must approve the change. Apply it in a later branch
  to keep the producer fix within its recorded scope.
- **Action:** ask the user, because A removes live links from a published
  package and changes their test. The recorded producer decision does not
  authorize that removal. The independent review check confirmed that the
  public viewer still reaches the lookup.
