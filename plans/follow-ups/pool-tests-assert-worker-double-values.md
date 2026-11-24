# Pool tests assert values that a worker double sets

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from the check of review finding 9 of round 2 of
  branch `calummoore/mokly-edit-bundle-path-kv2o`.
- **Location:**
  `crates/mokly-sidecar/src/_tests_/bundle_pool/order_tests.rs:34`,
  `crates/mokly-sidecar/src/_tests_/bundle_pool/restore_tests.rs:64` and
  line 207, and
  `crates/mokly-sidecar/src/_tests_/bundle_pool/restored_reply_tests.rs:265`
  and line 266.
- **Reason:** These tests are on `main`, and the branch that found them did
  not change them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Worker double:** a `unimock` mock of a sidecar worker that answers each
    `bundle` call with a fixed result.
- **Background:**
  - The `testing` skill says: "A value that goes from a test double straight
    to the assertion, through no code under test, checks only the double. Do
    not assert such a value."
  - Review finding 9 of round 2 of that branch found two such asserts in a
    new pool test: `result.generation` and `result.compile_count`, which the
    worker double set for every `bundle` call. The fix removed them and
    narrowed the test helper, so that it returns only the restored seeds and
    the `cache` value, which the pool decides.
  - The check of that finding found the same pattern in older pool tests:
    each place under **Location** asserts a `generation` or a
    `compile_count` that one worker double sets for every `bundle` call.
  - Nobody has checked each place at the code. Some of these values can pass
    through pool code that could change them, such as the decoder of a
    restored reply. Such an assert checks the code and stays.
- **Problem:** Some of these asserts can check only the double, so they
  suggest more coverage than the tests give.
- **Impact if no action:** A reader trusts asserts that no change to the pool
  can fail, and new tests copy the pattern.
- **Root question:** Which pool test asserts check only a value of the worker
  double, and how do those tests check only what the pool decides?
- **Options:**
  - **A.** Check each place at the code. Remove each assert whose value goes
    from the double to the assertion through no pool code, and record the
    reason under the `testing` skill. Keep each assert whose value the pool
    can change. Effort: Small.
  - **B.** A, plus test helpers that return only the values that the pool
    decides, as the fix of that finding did for `probe_outcome`. Effort:
    Small.
- **Left out:** A lint for the class. No static check can tell that an
  asserted value came from a test double.
- **Wider fix:** B, for the helpers of the pool tests. The `testing` skill
  rule is already in force for the class.
- **Previous examples:** review finding 9 of round 2 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`.
- **Recommendation:** B. It removes the asserts that check nothing and keeps
  later cases from copying them.
- **Action:** fix after merge, apply B, because the tests are on `main`,
  outside the branch that found them.
