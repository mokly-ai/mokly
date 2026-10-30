# Upload rejections omit the index version

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 (`calummoore/reviewjson-purpose`), the
  outside-scope list of its second review.
- **Location:** `docs/protocol/mokly-upload-validation.md:20`, the 426 row of
  the rejection table. `docs/protocol/mokly-upload-validation.md:80`, the
  rule that the Plan archive holds the catalogue index.
  `docs/protocol/mokly-format-versions.md:77`, the 426 rule.
- **Reason:** The second review found the gap outside the fix commit that it
  reviewed, so the fix needs its own branch.

- **Terms:**
  - **Plan archive:** the gzip tar file that `mokly publish` sends in its
    first request, the Plan request. It holds `mokly-upload.json`,
    `.mokly-export-artifact`, and `mokly-viewer/index.json`.
  - **Envelope:** `mokly-upload.json`, the upload metadata in the Plan
    archive. It is at version 3.
  - **Ownership marker:** `.mokly-export-artifact`, the list of every file
    of the built site with its digest and size. It is at version 3.
  - **Receiver:** the catalogue service that stores publications, such as
    Mokly Cloud.
  - **`upload-unsupported-version`:** the CLI category for HTTP 426. The CLI
    then prints "The catalogue service does not support this Mokly version.
    Update the service and try again."
- **Background:**
  - The receiver reads the catalogue index from the Plan archive. It checks
    the index's `baseCommit` and `base` against the envelope's `baseSha` and
    `baseRef`.
  - `docs/protocol/mokly-format-versions.md:77` says that a receiver that
    does not support the versions of a publication answers HTTP 426. The CLI
    then sends no Blob or Complete request and does not downgrade.
  - The rejection table of `docs/protocol/mokly-upload-validation.md` maps
    each rejection to an HTTP status and a CLI category.
  - Its 426 row names only the envelope version and the ownership marker
    version.
  - The catalogue index is version 9. A receiver that reads only an earlier
    index version meets this case after each index version change.
- **Problem:** The rejection table gives no status for a catalogue index
  version that the receiver does not support. A receiver that follows the
  table can answer 400 or 422, and the CLI then reports
  `upload-invalid-bundle` instead of `upload-unsupported-version`.
- **Impact if no action:** A publication to a receiver that lags behind the
  CLI fails with an invalid-bundle message. That message hides the real
  cause, which is that the service needs an update.
- **Root question:** How does a receiver tell the CLI that it does not
  support the catalogue index version of a publication?
- **Options:**
  - **A.** Add one table row: an unsupported catalogue index `schemaVersion`
    in the Plan archive answers 426, with the category
    `upload-unsupported-version`. The change is in the protocol doc only.
    Effort: Small.
  - **B.** Change the 426 row so that it names every versioned file of the
    Plan archive: the envelope, the ownership marker, and the catalogue
    index. A new versioned Plan file then falls under the same row. The
    change is in the protocol doc only. Effort: Small.
  - **C.** Do B, and let the test receiver in
    `tests/helpers/receiver/ownership.ts` answer `unsupported-version` for an
    unknown index version, with a test of that answer. It adds a test for
    the class. Effort: Small (estimate).
- **Left out:** Change nothing, because a lagging receiver then answers
  with the wrong category.
- **Wider fix:** B. One rule for every versioned Plan file prevents the
  next omission.
- **Previous examples:** On 2026-10-26, upload envelope version 3 added the
  catalogue index to the Plan archive. The same page then gained the index
  rule at line 80, but the 426 row did not change.
- **Related:** `plans/follow-ups/mokly-cloud-index-v9.md` has the same
  boundary. Until Mokly Cloud accepts index version 9, its receiver meets
  exactly this case, so its status shows whether the gap matters now.
- **Recommendation:** B. It states the 426 rule of
  `docs/protocol/mokly-format-versions.md` once, for every versioned Plan
  file.
- **Action:** fix after merge, apply B. The review found the gap outside the
  scope of its change, so the fix belongs on its own branch.
