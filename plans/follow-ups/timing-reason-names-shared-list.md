# Share timing reason names with their producers

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the step B review round 1 of PR #242.
- **Location:** `crates/mokly-cli/src/serve_trace.rs`.
- **Reason:** The review found the problem outside the diff of PR #242.

`crates/mokly-cli/src/serve_trace.rs`: the `reason` allow list repeats the
names of `crates/mokly-sidecar/src/pool_timing.rs` without a shared list, so
a renamed reason would vanish from the timing output. The `cache` allow list
of `css.bundle` repeats the names of `Miss::as_str` in
`crates/mokly-render/src/stylesheet_store.rs` in the same way.
