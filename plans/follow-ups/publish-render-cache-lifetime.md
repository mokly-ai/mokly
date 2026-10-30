# Decide the publish render-cache lifetime

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #222 and its completed plan, the residual
  risk of its first review.
- **Location:** `crates/mokly-cli/src/entry_publish.rs:46`,
  `crates/mokly-cli/src/publication_runtime.rs:28`, and
  `crates/mokly-cli/src/publication/command.rs:121`.
- **Reason:** The memory that the cache keeps during the upload was never
  measured, and each option trades memory against a change of the cache
  ownership.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Render cache:** the in-memory LRU of rendered documents and fragments,
    bounded at 256 MiB of charged bytes. `MemoryCache` in
    `crates/mokly-graph/src/cache.rs` implements it.
  - **Publish `Output`:** the static output adapter of `mokly publish` in
    `crates/mokly-cli/src/publication_runtime.rs`. It builds the site that
    the upload then sends.
- **Background:**
  - Since PR #222, merged on 2026-10-28, each command creates its one render
    cache at its composition root. `mokly publish` creates it in
    `crates/mokly-cli/src/entry_publish.rs:46`.
  - The publish `Output` keeps the cache in its `cache` field at
    `crates/mokly-cli/src/publication_runtime.rs:28`. It passes the cache
    to the static build of each request.
  - `Command::run` in `crates/mokly-cli/src/publication/command.rs:121`
    builds the output first. It then checks the checkout again and uploads
    the publication. The `Command` and its `Output` live until the upload
    ends.
  - With `--debug-timings`, `serve_trace::install` at
    `crates/mokly-cli/src/entry_publish.rs:48` gives the global timing
    layer another handle to the cache for the life of the process.
- **Problem:** The upload can keep a large cache that it no longer uses. The
  cost has not been measured.
- **Impact if no action:** Publication can keep up to 256 MiB of charged
  cache entries in memory until every upload ends.
- **Root question:** How long should `mokly publish` keep its render cache
  after the build has finished with it?
- **Options:**
  - **A.** Keep the cache through upload. Record no new measurement. Effort:
    Small.
  - **B.** Measure retained bytes. Release the cache before network upload
    when the output no longer needs it. Effort: Medium (estimate).
  - **C.** Empty the cache at the end of the build through a new cache
    method, without a measurement first. This also frees the entries that
    the timing layer keeps under `--debug-timings`. Effort: Small
    (estimate).
- **Left out:** A separate upload-process cache has no upload consumer and
  adds complexity.
- **Wider fix:** B. It ends the cache ownership at its last consumer, so no
  later phase of publish can keep it by accident.
- **Previous examples:** PR #222 moved the cache to each command's
  composition root and measured its charge in Serve on 2026-10-28. It did
  not measure publish.
- **Recommendation:** B (estimate). It uses evidence and ends ownership at
  the last consumer. C frees the memory with less code, but it changes the
  cache without a measured need.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  performance finding, and the user chooses whether its cost is worth a
  change.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L422).
