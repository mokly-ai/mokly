# Mokly Cloud must accept index version 9

- **Severity:** High (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** `mokly-ai/mokly-cloud`, outside this repository. On
  2026-10-30 its contract crate on `main` has no catalogue index reader. An
  unmerged branch adds `crates/mkc-mokly-contract/src/catalogue_index.rs`
  as a version 8 reader. In this repository,
  `docs/protocol/fixtures/catalogue-v9.json` and
  `docs/protocol/mokly-format-versions.md:80`.
- **Reason:** Mokly Cloud pins a released Mokly, so it can move only after the
  release that holds PR #224.

- **Terms:**
  - **Catalogue index:** `mokly-viewer/index.json`, the list of every entry
    of a catalogue. The Plan archive of `mokly publish` carries it.
  - **`detailId`:** the content id of one entry detail. Since PR #224 each
    index record lists it.
- **Background:**
  - On 2026-10-27 the user chose that a format takes at most one new number
    between two releases. Release 0.17.0 shipped index version 8 and entry
    detail version 3 before PR #224 merged. So PR #224, merged on
    2026-10-29, raised the catalogue index to version 9 and the entry detail
    to version 4.
  - Each index record of version 9 carries a required `detailId`. The
    `@mokly/viewer` reader `readCatalogueIndex` reads version 9 only, and
    `readEntryDetail` reads version 4 only.
  - The receiver of Mokly Cloud reads the index of each publication. On
    2026-10-29 its parser accepted version 8 only. That parser is on the
    unmerged adoption branch `conductor/adopt-mokly-without-reviewjson`. On
    2026-10-30 the receiver on `main`, at `860b163f`, still reads review
    version 6 and pins Mokly 0.14.0.
  - `docs/protocol/mokly-format-versions.md:80` says that Mokly Cloud reads
    catalogue version 9.
- **Task:**
  1. In `mokly-ai/mokly-cloud`, pin the release that holds PR #224.
  2. Move the index version gate and its fixtures to 9. The parser skips the
     new `detailId` fields.
  3. Upgrade the embedded `@mokly/viewer` to the same release.
  4. Deploy the receiver.
- **Impact if no action:** Every publication from the release that holds
  PR #224 fails at Mokly Cloud.
- **Needs:** That release on npm, and write and deploy access to
  `mokly-ai/mokly-cloud`. The receiver parses no entry detail and no
  `mokly-viewer/deployment.json`, so it needs no other format.
- **Done when:** Mokly Cloud accepts a publication with index version 9, and
  its embedded viewer shows that catalogue.
- **Related:**
  - [release-detail-content-ids.md](./release-detail-content-ids.md) is the
    release that this task pins.
  - [cloud-without-review-json.md](./cloud-without-review-json.md) moves the
    same index parser to version 8 for release 0.17.0.
  - [cloud-parent-usage-lists.md](./cloud-parent-usage-lists.md) pins
    release 0.17.0 of the same embedded viewer and makes its `detail` source
    answer the parent path of a variant. This task upgrades that viewer
    again, so the two tasks change the same code at two releases.
  - [upload-plan-index-version-status.md](./upload-plan-index-version-status.md)
    decides the status that a receiver gives an unsupported index version,
    the case that this task removes.
  - [hosted-upload-reuse-check.md](./hosted-upload-reuse-check.md) needs this
    task first.
