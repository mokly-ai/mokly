# Serve clones the watch plan to read one field

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`: a
  problem that the options check of its design calls found outside the
  scope.
- **Location:** `crates/mokly-cli/src/serve_rebuild.rs:157`,
  `crates/mokly-cli/src/serve_rebuild_action.rs:23` and `:46`, and
  `crates/mokly-cli/src/serve_debounce.rs:20`.
- **Reason:** The calls are on `origin/main` outside the diff of that branch.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Watch plan:** `Plan` in `crates/mokly-watch/src/plan.rs`: the exact
    input files, their ancestors, the roots, and the rules that classify
    file events.
- **Background:**
  - `WatchInputs::plan` returns a clone of the whole live watch plan.
  - Three calls read only `repository` from that clone, for the terminal
    line of a watched action. One call reads only `debounce`, at the start of
    each debounce.
  - On `examples/basic`, one clone of the plan took about 0.5 ms in the
    release measurements of 2026-11-19.
- **Problem:** Each watched action clones a large plan to read one path or
  one duration.
- **Impact if no action:** Each action spends about 0.5 ms or more on clones,
  after the publication and at the debounce start.
- **Root question:** How do the callers read the repository path and the
  debounce without a copy of the whole plan?
- **Options:**
  - **A.** Add trait methods that return only the repository path and the
    debounce, and use them at the four calls. Effort: Small.
  - **B.** Keep the plan behind an `Arc` in the watch state, so that
    `WatchInputs::plan` returns a cheap handle. The drain then needs a copy on
    write when it adds resources. Effort: Medium.
- **Left out:** Read the fields under the state lock in each caller: the
  callers hold only the `WatchInputs` trait, and A gives the same result
  through it.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the clones with the smallest change.
- **Action:** fix after merge, apply A, because the calls are outside the diff
  of the branch that found them.
