# Share the base conversion batch byte limit

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the review of PR #229, the batch conversion
  change, recorded in the completed plan of PR #236.
- **Location:** `crates/mokly-git/src/checkout_batch.rs:18`,
  `crates/mokly-git/src/extraction.rs:49`, and
  `crates/mokly-compare/src/git_prefetch.rs:50` and line 53.
- **Reason:** The batch change left these repeated bounds in unchanged
  callers, so their correction needs a separate branch.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Base read:** a read of a file at the base commit of Changes. Mokly reads
    it through Git with the checkout conversion that the commit's attributes
    select.
  - **Conversion batch:** one `git cat-file --batch --filters -Z` process that
    converts several base files.
- **Background:**
  - Since PR #229, merged on 2026-10-28, one Git process converts a batch of
    base files. `BATCH_BYTES` in `crates/mokly-git/src/checkout_batch.rs:18`
    names the bound of one batch: 48 MiB of raw bytes.
  - `convert_entries` in the same file converts a call within that bound in
    one batch. It converts each file of a larger call alone.
  - Two callers group files into calls before the conversion. The base
    extraction in `crates/mokly-git/src/extraction.rs:49` groups at most
    4,096 files and 48 MiB. The base prefetch in
    `crates/mokly-compare/src/git_prefetch.rs:50` and line 53 groups at most
    4,096 files and the smaller of its cache bound and 48 MiB.
- **Problem:** Both callers repeat `48 * 1024 * 1024` and `4096` as literals
  instead of using one named source. A change of `BATCH_BYTES` does not
  change their groups.
- **Impact if no action:** When the bound changes in one place only, the
  callers form calls above the batch bound. Each file of such a call then
  converts alone, so the output stays correct, but the process count grows
  without a visible error.
- **Root question:** How do the batch bounds of base conversion stay equal in
  every module that forms batches?
- **Options:**
  - **A.** Change nothing. The literals are equal today, and a drift costs
    only processes. Effort: Small.
  - **B.** Use `BATCH_BYTES` in `crates/mokly-git/src/extraction.rs`. The
    prefetch in `mokly-compare` keeps its own literal. Effort: Small.
  - **C.** Export `BATCH_BYTES` and a named file count from `mokly-git`. Use
    both in the extraction and in the prefetch. The `checkout_batch` module
    is private at `crates/mokly-git/src/lib.rs:30`, and no named file count
    exists. So C changes four code files: `lib.rs` for the export,
    `checkout_batch.rs` for the named count, `extraction.rs`, and
    `crates/mokly-compare/src/git_prefetch.rs`. Review both callers and run the affected crate tests. Effort: Small.
  - **D.** Give `mokly-git` one helper that forms the batches of a file list
    under both bounds. The extraction and the prefetch call it, so the bounds
    and the grouping rule live in one place. It adds the helper and its
    export to `mokly-git` and changes both callers: at least three code files
    in two crates. Review the grouping and fallback behaviour together. Effort: Medium.
- **Left out:** A shared configuration value. The bound is an internal
  limit of the conversion, not a user setting.
- **Wider fix:** D. One helper owns the grouping rule, so no
  caller can form a batch above the bound.
- **Previous examples:** None found.
- **Related:**
  - [base-batch-error-path.md](./base-batch-error-path.md) concerns the
    same batch conversion code. Its wider fix can live in the helper of D.
  - [base-batch-fallback-processes.md](./base-batch-fallback-processes.md)
    changes the fallback loops beside these literals. Its wider fix can also
    live in the helper of D.
- **Recommendation:** D. One helper owns both batch bounds and the grouping
  rule. The record first recommended C.
- **Action:** fix after merge, apply D, because the repeated grouping code lies
  outside the batch conversion change that found it.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L393).
