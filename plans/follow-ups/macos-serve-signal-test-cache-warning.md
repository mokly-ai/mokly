# macOS Serve signal test gets a second stderr line

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch `calummoore/removed-entries-all-section-n5a3` (PR #417), CI runs 44760823252 and 44766438401.
- **Location:** `crates/mokly-cli/tests/serve_process_tests.rs:129` and `crates/mokly-cli/src/render_store_runtime.rs:142`.
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
- **Problem:** On macOS, the cache cannot open in the test's environment, so
  the test sees one more stderr line than it allows.
- **Impact if no action:** Required CI fails on macOS now and then, and each
  failure needs a rerun. Until 2026-11-22 this line said that it failed for
  every pull request.
- **Root question:** Should Serve on macOS open the rendered document cache
  in the test's environment, or should the test allow the warning?
- **Options:**
  - **A.** Give the test a writable cache home, as the other Serve process
    tests do, so the cache opens and stderr keeps one line. Effort: Small.
  - **B.** Find why the cache cannot open on macOS and fix the product path,
    with a test first. Effort: Medium.
- **Left out:** Loosening the line-count assertion, because it would stop
  the test from catching new stderr noise.
- **Wider fix:** None found.
- **Previous examples:** `plans/follow-ups/non-serve-process-cache-homes.md`.
- **Recommendation:** B, and A when the cause is the test environment only.
- **Action:** fix after merge, apply B, because the change is in Rust Serve
  code outside this branch.
