# Stabilize the Vite native child rebuild test on macOS

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the CI of pull request #605, a plan-only change
  that could not cause the failure.
- **Location:** `crates/mokly-cli/tests/serve_js/watch_tests.rs:106`, the test
  `vite_rebuild_evaluates_an_edited_native_child_behind_an_unchanged_entry`.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Native child:** a module that Node loads outside Vite, behind an entry
    module that does not change.
  - **macOS native job:** the job `Native (macos-26, shard 3/5)` of
    `.github/workflows/ci.yml`.
- **Background:**
  - The test starts Serve under the Vite adapter, edits `child.mjs` from
    `Before` to `After`, presses `r`, and waits for a new revision whose
    document holds `</h1>`.
  - It then asserts that the document holds `>After</h1>`.
  - `plans/follow-ups/installed-module-watch-paths.md` names this test, but
    not its flakiness.
- **Problem:**
  - Failure: the test failed once in the macOS native job of
    [CI run 46049698026](https://github.com/mokly-ai/mokly/actions/runs/46049698026),
    [job 140677731144](https://github.com/mokly-ai/mokly/actions/runs/46049698026/job/140677731144),
    at commit `7e220ad49e6b8189e2cf4aa962422d538f9cbe44`.
  - Failure text: a panic at `watch_tests.rs:106:5`. The panic message was the
    rendered Home document, so the new revision did not hold `>After</h1>`.
  - Rerun outcome: one rerun of the failed jobs passed.
  - Suspected source: the wait accepts the first new revision that holds any
    `</h1>`. A revision that starts before the edit reaches the native child
    can render the old label. Nobody confirmed it.
- **Impact if no action:** The macOS native suite can fail at random on a
  correct change. A real stale native child after a rebuild can hide behind a
  flake label.
- **Root question:** How does the test wait for the rebuild that the edit of
  the native child causes, and not for an earlier revision?
- **Options:**
  - **A.** Reproduce the failure on macOS by repeating the test. Then wait on
    an explicit signal: the revision whose inputs include the edited child,
    or the document text `>After</h1>`. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again. Effort: Small.
  - **C.** If the reproduction shows that a rebuild after the edit keeps the
    old child, add a failing test first, and fix the rebuild. Effort: Medium.
- **Left out:** A longer wait, a retry, or a sleep, because the `testing`
  skill forbids them.
- **Wider fix:** None. The `testing` skill already requires an explicit
  readiness signal.
- **Previous examples:** `plans/follow-ups/flaky-postcss-context-release.md`.
- **Recommendation:** A. The wait condition matches the old document too, so
  a readiness fix is likely, and the reproduction confirms the source first.
- **Action:** fix after merge, apply A, because the failure is outside the
  scope of #605 and it passed on rerun.
- **Work:**
  - Repeat the test on macOS until it fails, and record the pass counts under
    `.context/`.
  - Name the source, then apply A or C.
  - Delete this item in the branch that fixes the test.
