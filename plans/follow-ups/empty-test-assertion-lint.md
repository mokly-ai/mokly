# Reject unit tests that make no assertion

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user decision 66 A of 2026-10-21.
- **Location:** `scripts/verification/node-execution.mjs:8-23`, where the
  Node test runner starts `node --import tsx --test`.
- **Reason:** On 2026-10-21 the user chose not to adopt this guard in the
  Rust rebuild and to record it as a follow-up after the merge.

- **Source:** Design.
- **Category:** Test.
- **Terms:**
  - **Assertion guard:** a test-runner hook that counts assertion calls and
    fails each test that completes without one.
- **Background:**
  - Pull request #153 added an assertion guard against the old TypeScript
    backend. Its branch is `origin/calummoore/empty-unit-test-prevention`,
    and commit `015312d7` of 2026-10-06 holds the guard.
  - That guard registered a module hook. It mapped `node:assert`,
    `node:assert/strict`, `assert`, and `assert/strict` to counting modules
    for imports from repository files. A test that completed with zero
    counted calls failed with "test made no assertions: {test name}".
  - It was made after a report of 2026-10-06 that four unit tests checked
    nothing. An id rename had left filtered loops that matched no entry, so
    they made no assertion and still passed. The guard also found ten tests
    that only claimed to complete. They then used `assert.doesNotThrow` or
    `assert.doesNotReject`.
  - On 2026-10-21 the user had three choices for this guard and a wider
    clock lint. The first adopted neither and recorded both as follow-ups
    after the merge. The second adopted the clock lint now and deferred the
    guard. The third ported both now. The user chose the first, and #153 was
    closed unmerged. That choice
    deferred the guard. It did not approve the new gate.
  - Today `scripts/verification/node-execution.mjs:8-23` runs the Node tests
    of `tests/`, `packages/viewer/tests/`, and `packages/ui/tests/` with no
    guard.
- **Problem:** A Node test that makes no assertion passes. A filter that
  matches nothing then hides a broken check.
- **Impact if no action:** A test can keep passing after a rename or a data
  change makes it check nothing, and nobody notices.
- **Root question:** How does the Node test suite catch a test that checks
  nothing?
- **Options:**
  - **A.** Change nothing, and rely on review. Effort: Small.
  - **B.** Add an ESLint rule that rejects a test callback with no direct
    `assert` call. It misses tests that assert through helpers, and it adds
    a lint. Effort: Medium.
  - **C.** Port the assertion guard to the current runner. Load it after
    `tsx` in `node-execution.mjs` and in each CI command that runs
    `node --test`. Port its own tests. The original change added six guard
    modules and changed the runner and CI. Effort: Large.
- **Left out:** Count assertions only in browser specs. Playwright assertions
  were outside the original guard, and the problem is in Node tests.
- **Wider fix:** C. A runtime count catches every test that checks nothing,
  whatever helper it uses.
- **Previous examples:** The four empty checks of 2026-10-06 after the id
  rename of PR #131.
- **Related:** [viewer-clock-lint.md](viewer-clock-lint.md) is the other
  test gate of the same user decision of 2026-10-21. The two gates are
  separate changes, but they share the decision, so each can cite it.
- **Recommendation:** C. It covers the whole class with a guard
  that already exists.
- **Action:** ask the user, because B and C add a test gate. The decision of
  2026-10-21 deferred this gate without approving it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5452).
