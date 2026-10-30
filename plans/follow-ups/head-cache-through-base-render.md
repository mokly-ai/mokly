# Keep head render entries while the base renders

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #222 and its completed plan, the
  post-merge follow-up of its eviction decision.
- **Location:** `crates/mokly-graph/src/cache.rs:64`,
  `crates/mokly-cli/src/render_runtime.rs:27`, and
  `docs/protocol/mokly-runtime.md:48`.
- **Reason:** On 2026-10-27 the user kept the 256 MiB bound and accepted the
  evictions during the base render, so head retention moved to a later
  performance branch.

- **Terms:**
  - **Render cache:** the in-memory LRU of rendered documents and fragments
    that Serve, `build`, and Changes share. `MemoryCache` in
    `crates/mokly-graph/src/cache.rs` implements it.
  - **Head and base:** the head is the current catalogue. The base is the
    catalogue at the merge base that Changes compares with the head.
  - **Charged bytes:** the cache's estimate of the retained memory of an
    entry, counted against the bound.
- **Background:**
  - Each command creates one render cache with a 256 MiB bound in
    `crates/mokly-cli/src/render_runtime.rs:27`. The runtime contract in
    `docs/protocol/mokly-runtime.md:48` states the bound. Equal keys of both
    sides share one entry.
  - A base render that misses the cache inserts its own entries. The LRU can
    then evict head entries, and the compare step composes and renders those
    head documents again.
  - PR #222 measured `examples/basic` on 2026-10-28. After the base render,
    the head and the base charged 296 MiB at a record multiplier of one, and
    311 MiB at two. The cache evicted 640 to 740 head entries while the base
    rendered, and the compare step missed 763 lookups.
  - In the experiment runs of PR #222, `review.compare-views` took 6.0 s and
    the run made 1,461 `sidecar.render` calls with the 256 MiB bound. With a
    4 GiB bound, which evicts nothing, it took 1.9 s and 1,098 calls.
  - On 2026-10-27 the user kept the 256 MiB bound and accepted these
    evictions. The user rejected a 384 MiB bound, because it changes the
    runtime contract. The user also rejected an order that evicts base
    entries before head entries for that branch, because it overlapped the
    planned work that keeps the base side across classifications.
  - PR #227 added cross-side render reuse: equal render keys on both sides
    share one render. Its measurement on 2026-10-28, after it merged with
    PR #222, found no eviction on `examples/basic`. After the base render, the
    cache held 1,217 entries and charged 156.9 MiB. The base added only its
    39 stylesheet bundles. The base capture and the comparison read 2,780
    entries, missed none, and made 0 `sidecar.render` calls.
  - The base added only its stylesheet bundles, so each base document had
    the key of a head document in that run. A base that differs in many
    documents still renders its own documents, and it can still evict head
    entries (estimate).
- **Task:**
  1. Run watched Serve on `examples/basic` from a release build with
     `--debug-timings` and `--sidecars 8`, after one warm-up run. Use a
     `--base` ref at which many `examples/basic` documents differ from the
     head.
  2. Read the `render.cache` records of `changes.classify`,
     `review.capture-side`, and `review.compare-views`. Count the
     `sidecar.render` records under `review.compare-views`.
  3. When the base render evicts head entries that the compare step then
     renders again, keep those head entries in the cache while the base
     renders. Keep the 256 MiB bound of the runtime contract. A change of
     the bound needs a user decision.
  4. Update `docs/protocol/mokly-runtime.md` and the `mokly-graph` README
     when the cache behaviour changes.
- **Impact if no action:** On a catalogue whose base differs from the head,
  Changes renders head documents a second time. The compare step then takes
  several seconds longer and makes hundreds of extra sidecar renders.
- **Needs:** Nothing beyond a local checkout with the history of the chosen
  base ref. The task needs no deployed change and no credentials.
- **Done when:** A measurement with a base that differs from the head shows
  that `review.compare-views` makes no `sidecar.render` call for a head
  document that the base render evicted. Or the measurement shows that the
  base render evicts no head entry, and the item records that result before
  its deletion.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L492).
