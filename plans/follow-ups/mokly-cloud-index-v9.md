# Mokly Cloud must accept index version 9

- **Severity:** High. **Effort:** Small.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** `mokly-ai/mokly-cloud`,
  `crates/mkc-mokly-contract/src/catalogue_index.rs`.
- **Reason:** Mokly Cloud pins a released Mokly, so it can move only after the
  release that holds PR #224.

PR #224 raises the catalogue index to version 9 and the entry detail to
version 4. Release 0.17.0 shipped index version 8 first. The receiver of Mokly
Cloud reads the index of each publication, and its parser accepts version 8
only. Until it accepts version 9, a publication from the next release fails.

The task: pin the release that holds PR #224, move the index version gate and
its fixtures to 9, and upgrade the embedded `@mokly/viewer`. The parser skips
the new `detailId` fields. The receiver parses no entry detail and no
`mokly-viewer/deployment.json`.
