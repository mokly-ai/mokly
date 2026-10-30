# Share timing reason names with their producers

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the step B review round 1 of PR #242.
- **Location:** `crates/mokly-cli/src/serve_trace.rs:75` and line 78,
  `crates/mokly-sidecar/src/pool_timing.rs:19`, and
  `crates/mokly-render/src/stylesheet_store.rs:31`.
- **Reason:** The review found the problem outside the diff of PR #242.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Timing layer:** the tracing layer of the CLI in
    `crates/mokly-cli/src/serve_trace.rs`. With `--debug-timings` it prints
    one JSON record for each span.
  - **Allow list:** the fixed set of field values that the timing layer
    copies into a record. It drops every other value, so that no path
    reaches the output.
- **Background:**
  - `crates/mokly-cli/src/serve_trace.rs:75` copies a sidecar `reason` only
    when it is `recycle`, `replacement`, `retry`, or `root-switch`. The
    producer, `crates/mokly-sidecar/src/pool_timing.rs:19`, defines these
    names.
  - Line 78 copies the `cache` field of `css.bundle` only when it is
    `no-record`, `evicted`, `stamp-mismatch`, or `inconsistent-evidence`.
    `Miss::as_str` in `crates/mokly-render/src/stylesheet_store.rs:31`
    defines these names.
  - On 2026-10-27 the user chose these four `cache` values for the miss
    reasons of `css.bundle`. `docs/protocol/mokly-timings.md` records them.
- **Problem:** Both allow lists repeat the names of their producers without
  a shared list.
- **Impact if no action:** A renamed or added reason vanishes from the timing
  output without an error, and timing analyses then miss it.
- **Root question:** How do the timing allow lists stay equal to the names
  that their producers emit?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Export each producer's list of names, and let the timing layer
    check the value against that list. Effort: Small (estimate).
  - **C.** Add a test that checks each producer name against the allow
    lists. Effort: Small (estimate).
- **Left out:** Copying any reason value into the record. The allow list
  keeps paths and other free text out of the output.
- **Wider fix:** B (estimate). One list of names for each producer removes
  the copies.
- **Previous examples:** None found.
- **Recommendation:** B (estimate). It removes the duplicated names with a
  small change.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  code structure finding.

The full historical record is in the [PR #242 commit](https://github.com/mokly-ai/mokly/commit/ee7d8ea739bd103aacd001f8e75e5aa144929348).
