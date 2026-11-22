# macOS Serve signal test gets a second stderr line

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch `calummoore/removed-entries-all-section-n5a3` (PR #417), CI runs 44760823252 and 44766438401.
- **Location:** `crates/mokly-cli/tests/serve_process_tests.rs:129`, `crates/mokly-cli/src/render_store_runtime.rs:142`, `crates/mokly-compare/src/render_store_write.rs:31` and `:37`, and `crates/mokly-compare/src/render_writer.rs:243`.
- **Reason:** The branch changes only viewer TypeScript and docs; the failing test and the warning are Rust code that `main` changed in #394.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Rendered document cache:** the Serve cache that #394 added to reuse
    rendered documents after a restart. When it cannot open, Serve prints a
    warning and renders without it.
- **Background:**
  - `repeated_sigint_and_sigterm_exit_zero_and_release_the_port` starts Serve
    in a directory without Git, stops it with SIGINT and then SIGTERM, and
    asserts that stderr has exactly one line, the `[mokly/git-failed]` line.
  - On `Native (macos-26)`, two CI runs of PR #417 failed with two lines:
    the `[mokly/git-failed]` line and
    `[mokly/warning] The rendered document cache is unavailable. Rendering without it.`
  - The same job passed on Linux and Windows. Recent `main` runs of the macOS
    job were cancelled, so `main` has no clear macOS result since #394.
  - 2026-11-22, the CI of PR #472 at `bb59546ba` (run 45015168777, job
    137186010901): the same two lines. The one rerun of the job passed
    (attempt 3, job 137193247265), and the same job passed on the CI of PR
    #471 and on a manual CI run of an earlier commit of PR #472. So the
    failure does not happen on every run.
  - The test gives Serve its own cache home since #394
    (`crates/mokly-cli/tests/serve_process_tests.rs:63` and `:68`), and
    `SystemLocations::repository` in `crates/mokly-compare/src/locations.rs:48`
    reads it for the render store (`render_store_runtime.rs:40`). So a missing
    cache home does not explain a failure that only some runs show.
  - Suspected source, unproven, from a read of the code; no run has
    confirmed either candidate:
    - A Serve stop inside a segment write. The stop sets the cancellation
      (`crates/mokly-cli/src/serve_lifecycle.rs:60`), but the document writer
      stops only when `ServeServices` drops
      (`crates/mokly-cli/src/serve_services.rs:178`). After its last
      cancellation check (`crates/mokly-compare/src/bundle_cache_write.rs:62`),
      the write syncs two directories (`crates/mokly-compare/src/storage.rs:233`
      and `:236`). On macOS, `sync_all` is `F_FULLFSYNC`
      (`crates/mokly-platform/src/flush.rs:14`), and on Windows the directory
      sync does nothing (`crates/mokly-compare/src/durability.rs:136`), so the
      window is widest on macOS. The `inspect` after the write then returns a
      cancellation, which `render_store_write.rs:37` counts as a store fault,
      as `:31` does for the inventory, and `render_writer.rs:243` prints the
      warning. The test sends its signal at once after readiness.
    - A real input or output fault of the store in some macOS runs.
- **Problem:** On macOS, some runs of the test print the warning that the
  rendered document cache is unavailable, so the test sees one more stderr
  line than it allows. Until 2026-11-22 this line said that the cache cannot
  open in the test's environment.
- **Impact if no action:** Required CI fails on macOS now and then, and each
  failure needs a rerun. Until 2026-11-22 this line said that it failed for
  every pull request.
- **Root question:** Which fault makes some macOS runs of the test print the
  cache warning, and which side, Serve or the test, needs the fix?
- **Options:**
  - **A.** Separate the two candidates first: run the test on macOS with a
    temporary trace of the error that `render_store_write.rs:31` and `:37`
    count as a fault, so that each failure shows a cancellation or an input
    or output error. Effort: Small.
  - **B.** If the cause is the stop: do not count a cancelled inventory or a
    cancelled `inspect` as a store fault, so that a Serve stop prints no
    warning, with a test of a stop during a segment write first. Effort:
    Small.
  - **C.** If the cause is a real fault: find it on macOS and fix the product
    path, with a test first. Effort: Medium.
- **Left out:** Loosening the line-count assertion, because it would stop
  the test from catching new stderr noise.
- **Wider fix:** None found.
- **Previous examples:** None found. Until 2026-11-22 this line named
  `plans/follow-ups/non-serve-process-cache-homes.md`, which says that every
  Rust fixture that starts Serve already has its own cache home.
- **Recommendation:** A, then B or C by its result. A names the fault with no
  product change. Until 2026-11-22 the recommendation was B, and A when the
  cause is the test environment only.
- **Action:** fix after merge, apply A, because the failing code is Rust Serve
  code outside the branch that found it.
