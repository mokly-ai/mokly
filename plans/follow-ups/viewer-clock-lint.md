# Catch three more clock forms in tests

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: the post-merge task of user decision 66 A on the test gates of closed PR #174.
- **Location:** `eslint.config.js:82`, `tests/test_timing_lint.test.ts:36`,
  and `docs/protocol/ci-test-timing.md:56`.
- **Reason:** On 2026-10-21 the user deferred this stricter lint until after
  the merge of PR #199, without approving it.

- **Source:** Design.
- **Category:** Test (estimate).
- **Terms:**
  - **Timing lint:** the ESLint `no-restricted-syntax` rules in
    `eslint.config.js` that reject elapsed-time assertions in tests.
- **Background:** The timing lint works as follows.
  - It covers every test file under `tests/`, `packages/viewer/tests/`, and
    `packages/ui/tests/`.
  - It rejects a subtraction with `performance.now()`, `Date.now()`, or
    `process.hrtime.bigint()` on the left and a nonliteral on the right.
  - It also rejects `performance.now()` or `Date.now()` plus a literal below
    10,000.
  - `tests/test_timing_lint.test.ts` checks each form, and
    `docs/protocol/ci-test-timing.md` states them. That page starts with a
    status line that links to this item.
  - Closed PR #174 also gave unit-test discovery and the lint one shared list
    of test roots, and it exempted `tests/helpers/browser_timing.ts`. Neither
    file exists on `main`.
  - On 2026-10-21 the user chose to adopt neither this lint nor the
    empty-test assertion guard of closed PR #153 before the merge. The user
    recorded both for later, and the rebuild noted that a stricter lint needs
    the user's approval.
- **Problem:** Closed PR #174 widened the lint, and the rebuild did not
  port it. The lint on `main` misses three clock forms of PR #174:
  - A member-expression clock, such as `globalThis.Date.now()`.
  - `new Date().getTime()`.
  - A clock that is an operand of a sum, such as
    `performance.timeOrigin + performance.now() - started`.
- **Impact if no action:** A test can assert elapsed time through one of the
  three forms, and the lint does not catch it.
- **Root question:** Which clock reads should the timing lint reject in
  every test root?
- **Options:**
  - **A.** Keep the current lint, which already covers the viewer and UI
    test roots. Effort: Small (estimate).
  - **B.** Port the three clock forms of #174, with their lint test cases,
    and state them in `ci-test-timing.md`. Then remove its status line.
    Effort: Small.
  - **C.** Apply B, and give unit-test discovery and the lint one shared
    list of test roots, as #174 did. Effort: Medium (estimate).
- **Left out:** A lint for every clock call breaks the allowed clock uses of
  the timing contract, such as polling deadlines.
- **Wider fix:** C. One list of test roots stops a new root from missing
  the lint.
- **Previous examples:** Closed PR #174 is the earlier attempt. Before its
  selector change, its red run failed only on the seven new lint cases and
  the new exemption. After the change, its green run passed 807 of 807 tests.
- **Related:** [empty-test-assertion-lint.md](./empty-test-assertion-lint.md)
  holds the other test gate that the same decision of 2026-10-21 deferred:
  the empty-test assertion guard of closed PR #153.
- **Recommendation:** B. It ports the recorded forms with the smallest
  change. C best protects later test roots.
- **Action:** ask the user, because condition 3 holds: B and C add lint
  rules, a stricter check. On 2026-10-21 the user deferred this lint without
  approving it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5448).
