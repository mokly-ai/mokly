# No upload status for an unsupported index version

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 and its completed plan, which put the
  gap outside the scope of its review.
- **Location:** `docs/protocol/mokly-upload-validation.md:20`.
- **Reason:** The rejection table predates PR #217, and the review found the
  gap outside the diff of that change.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Plan archive:** the gzip tar that `mokly publish` sends in its Plan
    request. Since PR #217 it always carries the catalogue index,
    `mokly-viewer/index.json`, as its third file.
  - **Rejection table:** the table under "Rejections" in
    `docs/protocol/mokly-upload-validation.md`. It maps each rejection to an
    HTTP status and a CLI category.
  - **Envelope:** `mokly-upload.json`, the upload metadata in the Plan
    archive. Its version is 3.
  - **Ownership marker:** `.mokly-export-artifact`, the list of each built
    file with its digest and size. Its version is 3.
  - **Receiver:** the catalogue service that stores publications, such as
    Mokly Cloud.
- **Background:**
  - The Plan archive holds the envelope, the ownership marker, and
    `mokly-viewer/index.json`. The receiver checks the index's `baseCommit`
    and `base` against the envelope's `baseSha` and `baseRef`.
  - The CLI maps a receiver's status by value alone. A 426 answer stops the
    exchange without a retry and prints "The catalogue service does not
    support this Mokly version. Update the service and try again."
  - `docs/protocol/mokly-upload-validation.md:20` gives 426 for an
    unsupported envelope or a present ownership `schemaVersion` other than 3. A malformed archive gets 400 or 422.
  - Each receiver accepts exactly the index versions that it knows. Mokly
    Cloud must move its index parser for each new index version.
  - `docs/protocol/mokly-format-versions.md:77` says that a receiver that
    does not support these versions answers HTTP 426. The inventory at
    line 7 of that page lists the public catalogue index, version 9. So
    the 426 answer for an unsupported index version is already a
    requirement. Only the rejection table lacks its row.
- **Problem:** The table gives no status for a catalogue index in the Plan
  archive whose version the receiver does not support. Receivers can then
  answer with different statuses, and the CLI shows different messages.
- **Impact if no action:** A user whose release is newer than the receiver
  can see `upload-invalid-bundle` or `upload-failed` instead of the update
  message. This case occurs after each index version change, such as the
  move to version 9.
- **Root question:** What does a receiver answer when the Plan archive holds
  an index version that it does not support?
- **Options:**
  - **A.** Answer 426, as for an unsupported envelope. The CLI then stops
    without a retry and prints the update message. Add the row to the table.
    Effort: Small.
  - **B.** Answer 400 or 422, as for an invalid archive. The CLI reports
    `upload-invalid-bundle`. Add the row to the table. This changes the
    426 rule of `mokly-format-versions.md:77`, which needs the user.
    Effort: Small.
  - **C.** Leave the status to each receiver, and state in the table that
    the receiver chooses it. This changes the 426 rule of
    `mokly-format-versions.md:77`, which needs the user. Effort: Small.
  - **D.** Change the 426 row to cover every versioned file in the Plan
    archive: the envelope, the ownership marker, and the catalogue index.
    Future versioned Plan files then fall under the same row. This changes
    the protocol document only. Effort: Small.
  - **E.** Do D, and make the test receiver in
    `tests/helpers/receiver/ownership.ts` return `unsupported-version` for
    an unknown index version. Add a test for that class. This needs the
    user's approval for a test for the class. Effort: Small (estimate).
- **Left out:** A new CLI category for an index version. The CLI maps
  statuses by value, and 426 already has a category for unsupported
  versions.
- **Wider fix:** D. One rule covers every versioned file in the Plan
  archive and prevents another omission.
- **Previous examples:** The table already gives 426 for an unsupported
  envelope and for an unsupported ownership version.
  Upload envelope version 3 added the catalogue index to the Plan archive
  on 2026-10-26. The index rule was added to the validation page, but the
  426 row did not change.
- **Related:** [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) moves
  Mokly Cloud to index version 9. Until it does, a publication of the next
  release meets exactly this case.
- **Recommendation:** D. It states the existing 426 requirement once for
  every versioned Plan file and keeps the CLI's update message.
- **Action:** fix after merge, apply D, because the row restates the 426
  rule of `docs/protocol/mokly-format-versions.md:77`. The review found the
  gap outside its change, so the fix stays in a separate branch.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L187).
