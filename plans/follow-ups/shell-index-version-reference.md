# Shell delivery states the wrong index version

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the test skills review baseline on branch `calummoore/test-skills-guidelines-review`.
- **Location:** `docs/protocol/mokly-shell-delivery.md:64-66`.
- **Reason:** The audit records requirement conflicts. A later documentation branch can correct this reference without changing the public format.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Catalogue index:** the JSON read model that the Mokly shell loads from `/mokly-viewer/index.json`.
  - **Schema version:** the number that identifies the index format accepted by its readers.
- **Background:** The shell delivery page describes the public catalogue index. The format inventory owns the supported version. The catalogue contract points readers to that inventory.
- **Problem:** The shell page calls the index read model v9, then lists `schemaVersion: 8` in the same paragraph. The format inventory requires version 9. The producer and reader also use version 9.
- **Impact if no action:** A reader can use the stale value when building a consumer or a fixture. The public reader rejects that value.
- **Root question:** How should shell consumers find the supported index version?
- **Options:**
  - **A.** Change the stale literal to `schemaVersion: 9`. This corrects the current value but keeps a second version reference. Effort: Small.
  - **B.** Link the schema version to the existing format inventory. Remove the duplicated version literals from the paragraph. Keep the required `schemaVersion` field. Effort: Small.
- **Left out:** Only two documentation approaches are needed: repeat the current value, or reference its owner. Changing producers or adding format compatibility broadens the task without a reported consumer need. Keeping the contradictory value fails the goal.
- **Wider fix:** None. The documentation skill already gives each fact one home. B applies that rule to this reference.
- **Previous examples:** None found.
- **Recommendation:** B (estimate). The format inventory already owns this requirement, so one reference prevents another stale copy.
- **Action:** fix after merge, apply B (estimate), because this audit preserves product behaviour and protocol requirements.

Evidence in the repository:

- `docs/protocol/mokly-format-versions.md:7` identifies public catalogue index version 9 and requires readers to accept 9.
- `docs/protocol/mokly-catalogue.md:5-6` assigns version ownership to the format inventory.
- `crates/mokly-model/src/versions.rs:4` defines `CATALOGUE_INDEX` as 9.
- `crates/mokly-model/src/projection.rs:63` stamps the emitted index with that value.
- `crates/mokly-model/src/readers.rs` checks the public index against that version before reading its fields.

This is a documentation correction. Keep the emitted format and version checks unchanged. Do not add a test of protocol prose. Check Markdown formatting, local links, and the final diff.
