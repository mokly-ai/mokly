# Stabilize verification registry cleanup

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of a verification round of the rebuild.
- **Location:** `tests/serve_process.test.ts:75` and
  `scripts/verification/process-owner-snapshot.mjs:24`.
- **Reason:** The test failed once in an unrelated gate run and passed in an
  isolated rerun. On 2026-11-26 the user chose option B, a reproduction first.
  The reproduction did not fail, so the cause of that failure is not proven.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Verification registry:** the record of process owners that the
    verification scripts keep, so that a gate can name and stop every
    process that a suite starts.
- **Background:** The test and the registry check work as follows.
  - The test "the verification registry names Serve's group until it drains"
    starts Serve. It checks that the registry names Serve's process group
    until the group drains.
  - It runs on POSIX systems only.
  - `process-owner-snapshot.mjs` fails with `Verification owner {id} has no parent` when an owner has no parent process.
  - On 2026-11-26, the branch `calummoore/ci-speed-flaky-decisions-k3dt` ran
    `tests/serve_process.test.ts`, `tests/helper_process_ownership.test.ts`,
    and `tests/verification_process_owner.test.ts` with
    `--test-concurrency=3` under one parent owner from `runCaptured` in
    `scripts/verification/process.mjs`, as the gate's Node suite shares one
    registry. On a 4-CPU machine with four CPU spinners, 15 rounds passed 14
    of 14 tests each, and no output said `has no parent`.
  - The same day, a probe that calls the real helpers of
    `scripts/verification/process-owner-records.mjs` found one order that
    gives this exact error each time:
    1. A child owner passes its first open check of the parent, in
       `createVerificationProcessOwner`.
    2. The parent writes its closing marker and removes its subtree records.
       `removeOwnedOwnerRecords` also removes the closing marker.
    3. The child writes its record under the parent that is now gone.
    4. A third owner that scans the same registry, for example its own
       `dispose`, fails with `Verification owner {id} has no parent`, because
       the child file still exists.
    5. The child's second check then fails, and its cleanup removes its
       record, so the error leaves no trace on disk.
  - Step 1 needs an owner that is created while its parent closes, for
    example a command that starts while a gate cancels its suite. The probe
    does not prove that the recorded failure took this path.
- **Problem:** The test failed once with `Verification owner {id} has no parent`, and the isolated rerun passed. The suspected source is concurrent
  process-registry cleanup, not proven. The record gives no run, commit, or
  full log.
- **Impact if no action:** A gate can fail on this test without a product
  change, and the developer must rerun it.
- **Root question:** How should the test read the registry while another
  cleanup can remove a parent?
- **Options:**
  - **A.** Drop the item unless the failure recurs. Effort: Small.
  - **B.** Done on 2026-11-26: repeat the test to reproduce the failure. It
    did not fail in 15 rounds of the three owner test files under load.
  - **C.** Keep the closing marker of each owner for the life of its
    registry, so that a scan can tell an orphan whose parent closed, which
    its creator removes, from broken ancestry, which keeps its error. A
    top-level owner removes the markers with its registry. Add a test of the
    probe's order. Effort: Small.
- **Left out:** A retry, a sleep, or a longer timeout breaks the
  deterministic-test rule.
- **Wider fix:** C. It removes the one known order that gives this error,
  for every reader of a shared registry.
- **Previous examples:** None found.
- **Recommendation:** C. The probe proves that the order happens with the
  real helpers, and the fix keeps the error for persistent broken ancestry,
  which `tests/verification_process_owner.test.ts` checks.
- **Action:** ask the user, because the reproduction did not fail, so the
  cause of the recorded failure is not confirmed, and C changes what a scan
  of the registry accepts.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4436).
