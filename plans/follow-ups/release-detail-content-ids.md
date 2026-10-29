# Release content-addressed details with a breaking note

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** The next release pull request of Release Please and
  `CHANGELOG.md`.
- **Reason:** The release pull request opens only after PR #224 merges.

Check that the next release is a minor version and that its notes carry the
breaking change of PR #224: index version 9 with `detailId` in each record,
entry detail version 4 without `deploymentId` or `generation`, the type
`EntryDetailV4`, and `mokly-viewer/deployment.json`. Each hosted catalogue
must be rebuilt and published again with the matching viewer.
