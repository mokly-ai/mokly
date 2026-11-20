# Finalized output files remain mutable

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from `calummoore/fu-typed-output-inventory-akh6`, an implementation concern outside the recorded finalizer-input migration.
- **Location:** `crates/mokly-model/src/output/artifact.rs:25`, `crates/mokly-static/src/artifact.rs:12`, `crates/mokly-static/tests/transaction_tests.rs:229`, and `crates/mokly-publish/src/_tests_/snapshot_tests.rs:101`.
- **Reason:** The finalizer-input migration does not change existing public field access or the live boundary tests that use it.

- **Source:** Implementation.
- **Category:** Code structure.
- **Terms:**
  - **Artifact:** The finalized files, typed ownership, and optional upload metadata in `mokly-model`.
  - **Inventory:** The admitted ordinary-file set in `mokly-model`.
  - **Marker:** The `.mokly-export-artifact` file that lists final file paths, sizes, and digests.
- **Background:** `Artifact::finalize` requires an `Inventory`. Only its insertion method adds ordinary files after the existing path, collision, and 64 MiB checks. The finalizer writes the marker last. `Artifact` retains public `directory`, `files`, `ownership`, and `metadata` fields. This field access predates the shared admission migration.
- **Problem:** A caller can construct an `Artifact` directly or change `artifact.files` after finalization. It can then supply files that did not pass admission or no longer match the marker. No current product caller does this. Two tests of live safety boundaries deliberately change finalized files.
- **Impact if no action:** A future producer can bypass admission and marker writing through the public fields. An extra installed file makes the next build fail with `Error::UnexpectedEntries`, instead of replacing the output.
- **Root question:** How should finalized output keep its file set consistent with its marker?
- **Options:**
  - **A.** Keep public mutation and the current trust in callers from the same Mokly version. Keep the existing final filesystem and upload checks. A future producer still needs to preserve the marker invariant itself. Effort: Small.
  - **B.** Mark `Artifact` as `#[non_exhaustive]`. This blocks struct literals outside `mokly-model`, but public fields still permit changes after finalization. Effort: Small.
  - **C.** Make the `Artifact` fields private and provide read accessors. Migrate every reader and design a test boundary that preserves the existing safety assertions. A raw test constructor or a new feature can reopen the bypass, so its boundary needs a separate design. Effort: Large.
- **Left out:** Rechecking the finalized files against the marker before staging repeats checks. The user decision of 2026-11-03 says to check author and external input once, then trust typed output from the same Mokly version. Deleting or weakening the safety tests has no approval.
- **Wider fix:** C. An immutable finalized type prevents changes around the marker writer.
- **Previous examples:** The earlier raw `Vec<File>` finalizer API allowed ordinary files to bypass shared admission. Its replacement requires `Inventory`, but does not close writes to finalized fields.
- **Recommendation:** C. It preserves the marker invariant through the type, but needs more than mechanical accessor changes.
- **Action:** ask the user, because C removes existing public mutation and needs a design that preserves two tests of live safety boundaries.

Keep these facts when the user decides:

- `untrusted_inventory_cannot_write_outside_its_stage` in `crates/mokly-static/tests/transaction_tests.rs` sets `artifact.files[0].path` to `../escape`. It expects `Error::Portable` from the final filesystem path check.
- `file_count_and_regular_file_limits_fail_before_upload_preparation` in `crates/mokly-publish/src/_tests_/snapshot_tests.rs` supplies 20,001 repeated files, then one file of 67,108,865 bytes. It expects `Error::TooLarge` from `Prepared::new`. Its oversized ownership-parser assertion must also stay.
- With private fields and the current finalizer as the only constructor, `Inventory::insert` rejects each unsafe test input before those boundaries run. The count case can use distinct admitted paths, but the path escape and oversized file need another test route.
- `crates/mokly-model/Cargo.toml` currently defines no feature for a test constructor. An ordinary dependency does not compile its `cfg(test)` methods for another crate's tests.
- The final filesystem path check and persisted ownership parsing remain required. This item records a separate API choice. It does not authorize a new validation, repeated hash, schema reparse, test removal, or resource limit.
