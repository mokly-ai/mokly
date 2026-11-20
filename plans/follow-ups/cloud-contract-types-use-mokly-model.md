# Cloud contract crate keeps its own Mokly types

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, from the post-merge section of the plan that moved Mokly Cloud into this repository (PR #350).
- **Location:** `crates/mkc-mokly-contract/` (its index, detail, and upload types) and `crates/mokly-model/`.
- **Reason:** The move kept product behaviour the same, so it did not replace the cloud's own copies of the Mokly contract types.

- **Terms:**
  - **`mkc-mokly-contract`:** the cloud crate that reads the Mokly catalogue files that a publication uploads.
  - **`mokly-model`:** the Mokly crate that owns the public catalogue formats and their readers.
- **Background:**
  - Before the move, the cloud lived in another repository and copied the Mokly contract types that it needed, with exact pins on published Mokly releases.
  - Both crates now live in one Cargo workspace, and the boundary rule lets a cloud crate depend on a Mokly crate.
  - `mkc-mokly-contract` already depends on `mokly-model`. Its content check in `src/content.rs` reads the index and every entry detail of an upload with the lenient readers of `mokly-model`. Its own index types, such as `CatalogueIndex`, still give the Changes count, the screens, and the comparison fields.
- **Task:** Replace each Mokly contract type that `mkc-mokly-contract` defines itself with the matching `mokly-model` type, and delete the copies. Keep every receiver test and the contract fixtures.
- **Impact if no action:** Two copies of the same formats can drift, and each Mokly format change needs a second edit in the cloud crate.
- **Needs:** Nothing.
- **Done when:** `mkc-mokly-contract` defines no Mokly format type that `mokly-model` provides, and its tests pass.
- **Related:** [receiver-read-model-validation.md](./receiver-read-model-validation.md) deploys and smoke-tests the content check. This task keeps that check.
