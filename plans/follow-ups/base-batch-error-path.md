# Name the failed path in batch conversion errors

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the review of PR #229, the batch conversion
  change, recorded in the completed plan of PR #236.
- **Location:** `crates/mokly-git/src/checkout_output.rs:153`,
  `crates/mokly-git/src/checkout.rs:29` and line 65,
  `crates/mokly-git/src/checkout_batch.rs:38`,
  `crates/mokly-git/src/extraction.rs:65`,
  `crates/mokly-compare/src/git_prefetch.rs:65`, and
  `crates/mokly-compare/src/inputs.rs:212`.
- **Reason:** The error naming comes from a helper that the batch change
  reused unchanged, so the review left it for a separate branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base read:** a read of a file at the base commit of Changes. Mokly reads
    it through Git with the checkout conversion that the commit's attributes
    select.
  - **Conversion batch:** one `git cat-file --batch --filters -Z` process that
    converts several base files.
- **Background:**
  - Since PR #229, merged on 2026-10-28, `convert_entries` in
    `crates/mokly-git/src/checkout_batch.rs` converts several files in one
    batch. A file that converts alone gets a `Conversion` error with its own
    path, at line 124 of that file.
  - `checkout_read` and `checkout` in `crates/mokly-git/src/checkout.rs:29`
    and line 65 wrap the result of a whole call in the helper `conversion`.
  - `conversion` in `crates/mokly-git/src/checkout_output.rs:153` names the
    first entry of the call for a timeout, a filter failure, a command
    failure, or a byte limit.
  - The base extraction and the base prefetch catch a `Conversion` error of a
    batch and convert each of its files alone, so their final errors name
    the right file.
  - The dependency input read in `crates/mokly-compare/src/inputs.rs:212`
    calls `read_many` without such a retry.
  - `read_many` passes the whole call to `checkout_read`. The prefetch at
    `crates/mokly-compare/src/git_prefetch.rs:65` also reads through
    `read_many`, and then reads each file of a failed call alone.
  - `docs/protocol/mokly-git.md:108` requires that each file of a failed
    batch converts again alone, so that a file is unavailable only when its
    own conversion fails.
- **Problem:** When a batch fails as a whole, its `Conversion` error names
  the first file of the call, not the file that failed. A caller without a
  retry reports that wrong path.
- **Impact if no action:** A base dependency read can report a conversion
  failure for a file that converts correctly. The user then looks at the
  wrong file to repair the filter or the attributes.
- **Root question:** How does a failed batch conversion name the file that
  failed?
- **Options:**
  - **A.** Change nothing. The extraction and the prefetch already name the
    right file after their retry. Effort: Small.
  - **B.** Name no single file for the failure of a whole batch. Report the
    batch failure without a path, so that `Conversion` names only a file
    that failed alone. The dependency input read then loses the path. A
    pathless failure changes what the user sees, so it needs the user.
    Effort: Small.
  - **C.** When a batch fails, convert each of its files alone inside
    `convert_entries`, as the deadline path already does. Every caller then
    follows the protocol rule, and every failure names its own file. Remove
    the retry loops of the extraction and the prefetch. Each file of a
    failed batch still costs about three Git processes. It changes
    `checkout_batch.rs` and removes the loops in `extraction.rs` and
    `crates/mokly-compare/src/git_prefetch.rs`. Verify the failure, cancellation, and byte-limit paths in both crates. Effort: Medium.
  - **D.** When a batch fails, split it in halves inside `convert_entries`
    and convert each half again, until the failing file converts alone. The
    error then names that file, and one failing file costs a few batch
    processes for each halving. Keep the per-file retry after a deadline,
    because each halving would wait for a new 120-second deadline. Update
    the mechanism sentence at `docs/protocol/mokly-git.md:108`. This changes
    a stated rule, so it needs the user. Effort: Medium.
  - **E.** When `convert_entries` returns a batch failure for a call of two
    or more files, convert each file of the call alone inside
    `checkout_read`. Then `read_many` follows the rule of
    `docs/protocol/mokly-git.md:108`, and each failure names its own file.
    Retry only on a filter failure, a command failure, or a byte or output
    limit, never on a cancellation. Keep the remaining byte limit across the
    files, each file's own deadline, and the record of a file whose own
    conversion timed out. Leave the loops of the extraction and the
    prefetch. After a failed batch, the prefetch then converts each file
    alone a second time, and its output stays correct. Review the remaining byte limit and each failure path when grading the whole fix. Effort: Small.
- **Left out:** Reading the failing path from the Git diagnostic.
  `CheckoutFailed` keeps only the bounded standard error of Git, and a
  parser of that text depends on Git's wording. A retry only in the
  dependency input read repeats the loop in a third caller and leaves the
  next caller of `read_many` without it.
- **Wider fix:** C. One place converts the files of a failed batch again, so no
  caller can skip the retry or report the wrong path.
- **Previous examples:** On 2026-10-28 the review of PR #229 changed the
  deadline path of `convert_entries`: each file of a timed-out batch
  converts again alone with its own deadline. Such a failure names its own
  file.
- **Related:**
  - [base-batch-fallback-processes.md](./base-batch-fallback-processes.md)
    concerns the same fallback. Its option B is the split of D here. Option
    C here keeps the per-file cost that that item wants to remove. E keeps
    it too, and after a failed batch the prefetch pays it twice.
  - [base-batch-byte-limit.md](./base-batch-byte-limit.md) concerns the same
    batch code. Its batch helper can hold the split of D.
- **Recommendation:** C. One retry owner gives every caller the required
  per-file fallback without repeated caller loops. The record previously
  recommended E because it treated Large effort as blocked. D changes the stated
  retry rule and still needs approval.
- **Action:** fix after merge, apply C, because the shared retry correction lies
  outside the batch change that found the wrong diagnostic path.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L396).
