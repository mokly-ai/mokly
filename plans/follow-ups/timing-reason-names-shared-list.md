# Share timing reason names with their producers

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the step B review round 1 of PR #242.
- **Location:** `crates/mokly-cli/src/serve_trace.rs:75` and line 78,
  `crates/mokly-sidecar/src/pool_timing.rs:19`, and
  `crates/mokly-render/src/stylesheet_store.rs:31`.
- **Reason:** The review found the problem outside the diff of PR #242.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Crate:** one Rust package in the Cargo workspace.
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
  - Both producer modules and their name functions are private. Neither
    crate exports the names for the CLI.
  - On 2026-10-29 the stylesheet-bundle work chose a subscriber around
    real cache bundles, one bundle for each miss reason. It made this call
    under the user's rule to apply the recommendation. It rejected a
    shared render and CLI reason list for now.
  - Existing CLI tests exercise all four sidecar reasons through producer
    flows. `crates/mokly-cli/tests/serve_process_tests.rs:203` exercises
    `no-record`. Producer-side bundle tests cover the CSS miss spans, but
    they do not read the CLI allow list.
- **Problem:** Both allow lists repeat the names of their producers without
  a shared list.
- **Impact if no action:** A new reason without a producer-driven CLI test
  can vanish from the timing output. Existing tests catch renames on the
  producer paths that they exercise.
- **Root question:** How do the timing allow lists stay equal to the names
  that their producers emit?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Export each producer's list of names, and let the timing layer
    check the value against that list. The exports and their consumer
    change `mokly-sidecar`, `mokly-render`, and `mokly-cli`. This crosses
    three crates. Review the exports and keep the existing timing names and tests. Effort: Medium.
  - **C.** Add producer-driven scenarios to the existing CLI integration
    tests for every current reason name. Check that the timing output
    keeps each name. A new reason without a scenario stays uncovered.
    Effort: Small.
- **Left out:** Copying any reason value into the record. The allow list
  keeps paths and other free text out of the output.
- **Wider fix:** B. One list of names for each producer removes
  the copies.
- **Previous examples:** None found.
- **Recommendation:** B. One producer-owned list removes the copies without
  changing the chosen reason names or the existing producer-driven tests.
- **Action:** fix after merge, apply B, because the repeated name lists lie
  outside the stylesheet-bundle change that found them.

The full historical record is in the [PR #242 commit](https://github.com/mokly-ai/mokly/commit/ee7d8ea739bd103aacd001f8e75e5aa144929348).

The earlier timing-test choice is in the [archived stylesheet plan](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L240).
