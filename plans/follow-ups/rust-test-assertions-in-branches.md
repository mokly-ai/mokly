# Rust tests assert inside branches on a case

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`: a
  problem that the check of review finding 4 of round 1 found outside the
  scope.
- **Location:** `crates/mokly-cli/src/_tests_/serve_watch_coverage_tests.rs`
  (`changed_roots_attach_a_new_observer_and_recheck_only_when_uncovered`),
  and `crates/mokly-cli/tests/review_output_tests.rs:25` to `:31` and `:91`
  to `:96`, as examples.
- **Reason:** The tests are on `origin/main`, and that branch did not change
  them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Case loop:** a test that loops over a table of literal cases and runs
    the same assertions for each case.
- **Background:**
  - The `testing` skill says: do not put an assertion inside an `if` or a
    `match` arm, and a loop over a table of literal cases is fine when the
    failure output names the case.
  - Review finding 4 of round 1 of that branch found a new test that asserted
    inside an `else` arm on its case label. The branch split it into two
    tests.
  - Its check found the same pattern in existing tests. A rough text scan
    flagged about 115 test files under `crates/` and `xtask/` that assert
    inside an `if` or `match` arm on a case label. Nobody checked each hit.
  - The loop over `covered` in
    `changed_roots_attach_a_new_observer_and_recheck_only_when_uncovered`
    asserts without the case in the failure output.
- **Problem:** In these tests, an assertion runs for one case only, or a
  failure does not say which case failed.
- **Impact if no action:** A later edit of a branch condition can skip an
  assertion, and no test fails. A failure of a case loop takes longer to
  read.
- **Root question:** How do the Rust tests make every assertion run for its
  case and name the case when it fails?
- **Options:**
  - **A.** Fix the two named examples: add the case to the assertion messages
    of the `covered` loop, and move the assertions of
    `review_output_tests.rs` out of the arms. Effort: Small.
  - **B.** Audit the flagged files, as `references/test-audit.md` of the
    `testing` skill says, and fix each real case: split a test by case, or
    move the assertion after the branch with the case in its message. Keep
    every assertion. Effort: Large.
  - **C.** B, plus a lint that rejects an assertion inside a branch of a Rust
    test. A lint is a new gate, so it needs the user. Effort: Large.
- **Left out:** A property-test crate for the case tables: the workspace has
  none, and B needs no new dependency.
- **Wider fix:** C, a detection fix. No structural fix prevents the pattern.
- **Previous examples:** Review finding 4 of round 1 of branch
  `calummoore/mokly-publish-path`.
- **Recommendation:** A now, then B. C waits for the user, because it adds a
  gate.
- **Action:** fix after merge, apply A, because the tests are outside the
  diff of the branch that found them.
