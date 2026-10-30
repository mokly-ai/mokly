# Avoid one Git process per failed-batch file

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the review of PR #229, the batch conversion
  change, recorded in the completed plan of PR #236.
- **Location:** `crates/mokly-git/src/extraction.rs:65` and
  `crates/mokly-compare/src/git_prefetch.rs:67`.
- **Reason:** The per-file fallback keeps the failure confinement of the
  code before PR #229, and a cheaper fallback needs its own design.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Base extraction:** the copy of the base commit's files in the OS cache
    directory, which the sidecar bundles from.
  - **Conversion batch:** one `git cat-file --batch --filters -Z` process that
    converts several base files.
- **Background:**
  - Since PR #229, merged on 2026-10-28, one Git process converts a batch of
    at most 4,096 files and 48 MiB. Before it, each converted file started
    its own `git cat-file --filters` process. For this repository, a cold
    extraction started about 4,400 Git processes.
  - When a batch fails with a `Conversion` error, the base extraction in
    `crates/mokly-git/src/extraction.rs:65` converts each file of the batch
    in its own call. A file that still fails becomes unavailable with a
    `base-conversion` warning, and the other files stay.
  - The base prefetch in `crates/mokly-compare/src/git_prefetch.rs:67` does
    the same through one read for each path.
  - `docs/protocol/mokly-git.md:106` requires that each file of a failed,
    timed-out, or oversized batch converts again alone, so that a file is
    unavailable only when its own conversion fails.
- **Problem:** Each call of the fallback can start about three Git
  processes. One failing filter in a batch of 4,096 files can then start
  about 12,000 processes.
- **Impact if no action:** A repository with one file whose filter fails
  pays the cost of the code before PR #229 on every cold extraction of a
  base that holds that file.
- **Root question:** How does a failed batch keep each failure with its file
  without one Git process run for each file?
- **Options:**
  - **A.** Change nothing. A batch fails only when a filter or a limit fails,
    so the cost stays on a rare path. Effort: Small.
  - **B.** Split a failed batch in halves and convert each half again as a
    batch, until each failing file converts alone. A batch with one failing
    file then needs a few batch processes for each halving. Keep the
    per-file retry after a deadline, because each halving would wait for a
    new 120-second deadline. Update the mechanism sentence at
    `docs/protocol/mokly-git.md:106`. Effort: Medium (estimate).
  - **C.** Keep the per-file fallback, but share the attribute lookup and the
    object fetch of the failed batch among its single-file calls. Each file
    then starts one process instead of about three. Effort: Medium
    (estimate).
- **Left out:** Asking Git which file failed. The batch diagnostic is
  bounded standard error without a structured path, so a parser would
  depend on Git's wording.
- **Wider fix:** B (estimate). The split also gives each failure its own
  path, so the extraction and the prefetch need no own retry loops.
- **Previous examples:** PR #229 replaced one process for each converted
  file with one process for each batch on 2026-10-28. PR #236 then read the
  base files from the leased extraction on the same day.
- **Related:**
  - [base-batch-error-path.md](./base-batch-error-path.md) concerns the
    same fallback. Its option D is the split of B here. Its recommended
    option C moves the per-file retry into one place and keeps its cost.
  - [base-batch-byte-limit.md](./base-batch-byte-limit.md) concerns the same
    two modules. Its batch helper can hold the split of B.
  - [git-opaque-asset-batching.md](./git-opaque-asset-batching.md) concerns
    the Git processes of each opaque asset in the base. It is the same cost
    class in another reader, so one design can cover both.
- **Recommendation:** B (estimate). It keeps every failure with its file and
  bounds the process count.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  performance finding.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L389).
