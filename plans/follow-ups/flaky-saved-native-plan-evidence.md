# Saved plan test flakes without a native plan

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the complete gate of the branch
  `calummoore/fu-linked-renderer-stylesheet-root-crva` at commit `b90c9f9d5`.
- **Location:** `tests/sidecar_saved_plan.test.ts:29` to line 71,
  `tests/helpers/plan_capture.ts:8` to line 26,
  `packages/mokly/src/sidecar/captured-plan.ts:8` to line 45,
  `packages/mokly/src/sidecar/bundle-recipe.ts:128` to line 142 and line 190,
  and `packages/mokly/src/sidecar/capture-durability.ts:153` to line 211.
- **Reason:** The test, its helpers, and the sidecar code are unchanged from
  `origin/main`, so one fix in a separate branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Native plan:** the `plan` field of a bundle result. It holds the import
    targets that the bundle call resolved, so that a later Serve edit can
    reuse them.
  - **Reuse evidence:** the `compiled.reuseEvidence` field of a bundle result.
    Its flags `complete` and `durable` say whether the recorded inputs can
    prove a later reuse. Its optional `uncaptured` marker shows a Serve edit
    call that recorded no evidence.
  - **Witness:** a file or directory stamp that `CaptureDurability` records
    during a bundle call and checks again at the end of the call.
- **Background:**
  - The loop at `tests/sidecar_saved_plan.test.ts:29` runs the test twice,
    with `exact=true` and with `exact=false`.
  - Each run writes `entry.mjs` and `value.js` into a new real directory under
    `os.tmpdir()`. With `exact=false`, it also writes a `tsconfig.json`.
  - The run calls `bundle` of `packages/mokly/src/sidecar/bundle.ts` directly,
    with a counting compiler and `planCapture(root)` as its durability
    argument. It keeps the default capture mode `full`. No Rust configuration
    load runs.
  - Line 49 asserts that `captured.result.plan` exists, with the message "the
    captured bundle must return its native plan".
  - Lines 53 to 70 then check the two plan imports, `complete` and `durable`
    as true, and the compile count. A failure at line 49 stops the test
    before these checks, so it does not show why the plan is missing.
  - `planCapture`, at `tests/helpers/plan_capture.ts:8` to line 26, builds a
    `CaptureDurability`. It records the `lstat` of each parent directory of
    the root once, and it returns those values for them later.
  - `planCapture` also fixes the clock at its call time plus 10 seconds. It
    reports the platform `linux` and an ext4 file system. Every other `lstat`,
    `stat`, and file read uses the real file system.
  - `capturedPlan`, at `packages/mokly/src/sidecar/captured-plan.ts:8` to line
    45, returns no plan in five cases:
    - the bundle call gives no import map
    - `complete` is false
    - `durable` is false
    - an `uncaptured` marker is set
    - the plan and its evidence pass `EVIDENCE_LIMIT`, which is 8 MiB
  - `bundleRecipe`, at `packages/mokly/src/sidecar/bundle-recipe.ts:128` to
    line 142, takes the evidence from `evidence.finish`. It uses incomplete
    evidence when the call recorded none. It sets `complete` to false when
    `toolchainIdentity` returns no value. Line 190 calls `capturedPlan`.
  - `packages/mokly/src/sidecar/physical-inputs.ts:225` sets `durable` from
    `CaptureDurability.finish`. `physical-inputs.ts` and
    `resolution-evidence.ts` also set `complete` to false in several cases.
  - `CaptureDurability`, in `packages/mokly/src/sidecar/capture-durability.ts`,
    loses durability in several cases:
    - `observe`, at line 153 to line 183, rejects a witness that is not mature
      at the fixed clock.
    - `finish`, at line 186 to line 211, returns false when a witness stamp
      changed or a recheck of a witness fails.
  - PR #316, commit `be242a628` of 2026-11-18, added the test and
    `planCapture`. The test, its helpers, and `packages/mokly/src/sidecar`
    match `origin/main` at `c2d4148c7`.
  - The failure:
    - On 2026-11-18, the complete gate `cargo xtask check` ran on Linux x86_64
      with 4 CPUs, and it ended at about 17:35 UTC. It ran at `b90c9f9d5` with
      uncommitted changes to one Rust test file and to follow-up items. None of
      them touches this test, its helpers, or the sidecar.
    - The Rust tests reported 2635 passed, 0 failed, and 2 ignored.
    - The Node step `npm run test:viewer:prepared` ran
      `node scripts/verification/run-viewer.mjs --strict` with two test files
      at once. It reported
      `tests 3099, passed 3098, failed 1, skipped 0, cancelled 0` after
      382 seconds. The gate then stopped with status 1.
    - The failure text is:

      ```text
      ✖ a captured native plan shares its bundle call's durable evidence with exact=true
      Error [ERR_TEST_FAILURE]: the captured bundle must return its native plan
      Caused by:
      AssertionError [ERR_ASSERTION]: the captured bundle must return its native plan
          at TestContext.<anonymous> (/home/user/code/mokly/tests/sidecar_saved_plan.test.ts:49:12)
      ```

    - The `exact=false` run and every other Node test passed.
  - The rerun:
    - Less than one minute later, with no source or test change, this command
      passed: `npm test -- tests/sidecar_saved_plan.test.ts`.
    - It reported `tests 5, passed 5, failed 0, skipped 0, cancelled 0` in
      808 ms. It selected only this file, so no other test file ran beside it.
    - An earlier complete gate of the same branch also passed this test.
  - Suspected source: unknown. The failure printed no evidence flags, and
    nobody reproduced it. So neither candidate below is a confirmed cause:
    - The file system evidence differs while other test files run beside this
      test. For example, a witness or an input outside the recorded parent
      directories changes during the bundle call.
    - The capture loses a durability or completeness witness for another
      reason.
- **Problem:** The test failed once in a complete gate, because the bundle call
  returned no native plan. An unchanged rerun passed. The failure does not
  show which check removed the plan, so the source is unknown.
- **Impact if no action:** The complete gate can fail at random on an
  unchanged test. Each failure costs a gate rerun, and the Node step alone
  takes about 6 minutes.
- **Root question:** How does the saved plan test get its native plan on every
  run, also while other test files run beside it?
- **Options:**
  - **A.** Reproduce under the complete Node suite with a local diagnostic,
    and commit nothing.
    - Run the Node step of the gate many times, with two test files at once.
      Count the failures.
    - On a failure, record the flags `complete`, `durable`, and `uncaptured`.
    - Also record whether the toolchain identity and the import map were
      present.
    - Record the check and the path that cleared a flag.
    - Run the test file alone in a loop too, for comparison.
    - Cost: machine time, and an unknown number of runs. Effort: Medium.
  - **B.** Make a later failure name its reason. For example, check the
    evidence flags of lines 68 and 69 before line 49, or add them to the
    message of line 49. Keep every assertion. Cost: a small test change, and
    the next failure can take many gates. Effort: Small.
  - **C.** After A or B names the cause, make the test harness deterministic
    for that cause. For example, isolate a shared path that changed, as
    `planCapture` already isolates the parent directories. Keep every
    assertion. When the cause is in the sidecar, it is a product bug: add a
    failing test first, then fix the code. Cost: unknown until the cause is
    known. Effort: Medium.
  - **D.** Change nothing, and add each recurrence with its failure text to
    this item. Cost: the gate stays flaky. Effort: Small.
- **Left out:**
  - A retry, a sleep, a repeat, a skip, a quarantine, or a longer time limit.
    The testing rules forbid each of them for a flaky test, because they hide
    the defect.
  - One test file at a time in the Node step. It changes the runner
    configuration only to make the test pass, and it names no cause.
  - A fix for one guessed cause before the reason is known. It can miss the
    real cause, and the testing rules ask for a named source before a fix.
- **Wider fix:** None yet, because the defect class is unknown until A or B
  names the cause.
- **Previous examples:** None found. No follow-up item names this test,
  `capturedPlan`, or `planCapture` as flaky.
- **Recommendation:** A. It names the reason under the conditions of the
  failure before any fix, as the testing rules require. It changes nothing in
  the repository. B is the next step when A cannot reproduce the failure, and
  C follows when the cause is known.
- **Action:** fix after merge, apply A, because the test and the sidecar code
  are unchanged from `origin/main`, and the source must be named before a
  fix. If A cannot reproduce the failure or name its source, the testing rules
  give the fix the outcome `ask the user`.
