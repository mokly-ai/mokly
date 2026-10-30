# No upload status for an unsupported index version

- **Severity:** Low (estimate). **Effort:** Small (estimate).
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
- **Background:**
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
- **Left out:** A new CLI category for an index version. The CLI maps
  statuses by value, and 426 already has a category for unsupported
  versions.
- **Wider fix:** A (estimate). One rule then covers every versioned document
  of the Plan archive.
- **Previous examples:** The table already gives 426 for an unsupported
  envelope and for an unsupported ownership version.
- **Related:** [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) moves
  Mokly Cloud to index version 9. Until it does, a publication of the next
  release meets exactly this case.
- **Recommendation:** A. It adds the row that `mokly-format-versions.md:77`
  already requires, and 426 gives the user the update message.
- **Action:** fix after merge, apply A, because the row restates the 426
  rule of `docs/protocol/mokly-format-versions.md:77`, so no user choice is
  needed.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L187).
