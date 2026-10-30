# Write relatedDocs references into catalogue output

- **Severity:** Medium (estimate). **Effort:** Medium (estimate).
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: the status-line sweep of user decision 185 A, finding 6 of the documentation audit.
- **Location:** `crates/mokly-model/src/projection_records.rs:31`,
  `crates/mokly-model/src/projection.rs:94`,
  `crates/mokly-compare/src/entry_metadata.rs:104`, and
  `docs/protocol/mokly-documents.md:181`.
- **Reason:** The status-line sweep of 2026-10-26 changed only documentation,
  so it left this code gap for a separate branch.

- **Source:** Review.
- **Category:** Product bug (estimate).
- **Terms:**
  - **`relatedDocs`:** the authored list of repository paths that an entry
    names as its related documents.
  - **`mock:` reference:** a portable link to a catalogue entry by path, such
    as `mock:guides/setup`, which the viewer turns into a URL.
- **Background:** The protocol defines related-document references as follows.
  - `docs/protocol/mokly-documents.md` says that when an entry's `relatedDocs`
    path names a current document, the index carries `mock:{document path}` in
    its `details.relatedDocs`.
  - Other paths stay display labels.
  - The viewer's Related docs row links each reference to the document and
    labels it with the document's title.
  - `docs/protocol/mokly-catalogue-delivery.md` states the same rule. Both
    pages start with a status line that links to this item.
  - The viewer already reads the references in
    `packages/viewer/src/catalogue/references.ts`.
- **Problem:** No producer writes the references.
  `projection_records::metadata` copies the authored labels into the index
  unchanged. Only the comparison metadata in
  `crates/mokly-compare/src/entry_metadata.rs` maps a matched label to a
  `mock:` reference, for change detection.
- **Impact if no action:** The Related docs row never links to a document and
  shows the raw path. Two protocol pages keep a status line.
- **Root question:** How should the catalogue index tell the viewer which
  related documents are catalogue documents?
- **Options:**
  - **A.** Map each `relatedDocs` path that names a current document to
    `mock:{document path}` in the index projection. `projection.rs` already
    has every model entry. Remove both status lines. Effort: Small
    (estimate).
  - **B.** Keep display labels only, and remove the reference rule from
    both protocol pages. This drops a requirement. Effort: Small (estimate).
  - **C.** Apply A through one shared resolver that the index projection and
    the comparison metadata both call. Effort: Medium (estimate).
- **Left out:** Resolving the labels in the viewer breaks the rule that the
  index carries the validated references for every reader of the index.
- **Wider fix:** C. One resolver keeps the index and the comparison
  metadata from disagreeing about which label is a document.
- **Previous examples:** None found.
- **Recommendation:** C. (estimate) It implements the stated requirement
  and removes the second copy of the lookup.
- **Action:** fix after merge, apply C (estimate), because the protocol
  already requires the references and the work reaches crates that the
  sweep did not change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6434).
