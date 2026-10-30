# Write relatedDocs references into catalogue output

- **Severity:** Medium (estimate). **Effort:** Small (estimate).
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: the status-line sweep of user decision 185 A, finding 6 of the documentation audit.
- **Location:** `crates/mokly-model/src/projection.rs:94`,
  `crates/mokly-model/src/projection_records.rs:31`,
  `crates/mokly-compare/src/projection_index.rs:105`,
  `crates/mokly-compare/src/projection_removed.rs:19`,
  `crates/mokly-compare/src/entry_metadata.rs:104`,
  `docs/protocol/mokly-documents.md:181` and `:184`, and
  `packages/viewer/src/catalogue/references.ts:101`.
- **Reason:** The status-line sweep of 2026-10-26 changed only documentation,
  so it left this code gap for a separate branch.

- **Source:** Review.
- **Category:** Product bug (estimate).
- **Terms:**
  - **`relatedDocs`:** the authored list of repository paths that an entry
    names as its related documents.
  - **`mock:` reference:** a portable link to a catalogue entry by path, such
    as `mock:guides/setup`, which the viewer turns into a URL.
  - **Historical index:** the index of the base side, which Changes builds
    to show removed entries.
- **Background:** The protocol and the code handle related documents as
  follows.
  - `docs/protocol/mokly-documents.md:181` says that when an entry's
    `relatedDocs` path names a current document, the index carries
    `mock:{document path}` in its `details.relatedDocs`.
  - The same page says at line 184: "Other paths stay display labels, and
    removed entries keep the base side's labels. Readers validate the logical
    reference against current documents."
  - The viewer's Related docs row links each reference to the document and
    labels it with the document's title.
    `docs/protocol/mokly-catalogue-delivery.md` states the same rule. Both
    pages start with a status line that links to this item.
  - `projection::index` in `crates/mokly-model/src/projection.rs:51` builds
    the current index for Serve and the static build.
  - `projection_index::base_index` builds the historical index with the same
    function. `projection_removed::records` takes the removed records from
    that historical index.
  - The retained base snapshot keeps each removed entry's authored labels in
    `related_docs`, at `crates/mokly-model/src/snapshot_records.rs:32`, from
    the base model at `crates/mokly-compare/src/snapshots.rs:131`.
  - The viewer checks each `mock:` link of current and removed records
    against the current documents, at `references.ts:101`. A failed check
    rejects the whole index.
- **Problem:** `projection_records::metadata` copies authored labels
  unchanged, and only `entry_metadata.rs` resolves them for change detection.
  A naive mapping in shared `projection::index` also gives removed records
  references to base documents. The viewer rejects such a reference when its
  document is not current.
- **Impact if no action:** The row shows raw paths, and two protocol pages
  keep status lines. An unguarded fix can make the viewer reject an index
  while the Rust build accepts it.
- **Root question:** How should the catalogue index tell the viewer which
  related documents are catalogue documents?
- **Options:**
  - **A.** Map each `relatedDocs` path that names a current document to
    `mock:{document path}` in the index projection, in
    `crates/mokly-model/src/projection.rs`. Keep the base side's labels on
    removed records in `crates/mokly-compare/src/projection_removed.rs`.
    Restore them from the retained snapshot through a match over the five
    record kinds, because `CatalogueRecord` has no details accessor. Remove
    both status lines. A is Small only as this two-file change of 30 code
    lines or fewer, about 22 lines (estimate). If it grows, or needs a third
    file such as `projection_index.rs`, re-grade it and ask the user. Do not
    compact code to meet the bound. Effort: Small (estimate).
  - **B.** Keep display labels only, and remove the reference rule from
    both protocol pages. This drops a requirement. Effort: Small (estimate).
  - **C.** Apply A through one shared resolver that the index projection and
    the comparison metadata both call. It needs at least three code files in
    two crates. The first holds a public resolver and its call, in
    `projection.rs`. The second replaces the inline lookup at
    `entry_metadata.rs:104`. The third holds the label restore, in
    `projection_removed.rs` or `projection_index.rs`. The
    historical index caller, not the crate count, makes C Large.
    Effort: Large (estimate).
- **Left out:** Resolving the labels in the viewer breaks the rule that the
  index carries the validated references for every reader of the index. A
  mapping inside `projection::index` without the restore breaks the rule that
  removed entries keep the base side's labels.
- **Wider fix:** C. One resolver keeps the index and the comparison
  metadata from disagreeing about which label is a document. C is Large, so
  it needs the user.
- **Previous examples:** None found.
- **Recommendation:** A. (estimate) It is the best unblocked fix: it writes
  the stated references and keeps the removed-label rule with the smallest
  change. The record first recommended C, graded Medium. C is a wider option
  that needs the user.
- **Action:** fix after merge, apply A (estimate), because the protocol
  already requires the references and A is Small. The branch that applies A
  deletes this record and records the still-unapproved C as a separate Needs
  decision item.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6434).
