# TypeScript tests assert inside branches

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from review finding 7 of round 1 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`, which raised the blocked wider fix
  of its finding 4.
- **Location:** `tests/static_publication_cases.test.ts:59`, as an example. A
  rough text scan counted about 61 places in 45 TypeScript test files on
  `main` at `9bdb0569d`.
- **Reason:** The places are in tests that the branch that found them did not
  change, and the lint that would prevent the class needs the user.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Case loop:** a test that loops over a table of literal cases and runs
    the same assertions for each case.
- **Background:**
  - The `testing` skill says: do not put an assertion inside an `if` or a
    `switch` arm. A loop over a table of literal cases is fine when the
    failure output names the case.
  - Review finding 4 of round 1 of that branch found a new test,
    `tests/sidecar_guarded_edit_differential.test.ts`, that compared two
    errors inside an `if` and then skipped its other assertions. A step that
    threw the same error on both sides passed. The fix gave each step its
    expected outcome as literals and asserted them for every step.
  - The check of that finding scanned the TypeScript test folders and found
    about 61 assertions inside an `if` or a `switch` arm, in 45 files. Nobody
    checked each hit, so some can be guards that are not assertions of the
    case.
  - `plans/follow-ups/rust-test-assertions-in-branches.md` records the same
    class in Rust tests.
- **Problem:** In these tests, an assertion runs for one case only, or a
  branch can skip it, so a later edit can drop the check and no test fails.
- **Impact if no action:** A wrong result in a skipped branch passes the
  test.
- **Root question:** How do the TypeScript tests make every assertion run for
  its case and name the case when it fails?
- **Options:**
  - **A.** Audit the flagged places and fix each one: give each case its
    expected value as a literal, and assert it for every case. Remove nothing
    and loosen nothing. Effort: Medium.
  - **B.** A, plus a local ESLint rule under `scripts/eslint/` that rejects an
    `assert` call inside an `if` or a `switch` arm in the test folders. Turn
    it on in `eslint.config.js`, beside `no-eager-fixture-setup`. A new lint
    needs the user. Effort: Large.
- **Left out:** A shared case-table helper. A test that branches on its case
  can still branch inside the helper's callback, so the helper does not
  remove the class.
- **Wider fix:** B, a detection fix. It is blocked, because a new lint needs
  the user.
- **Previous examples:** review finding 4 of round 1 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`, and
  `plans/follow-ups/rust-test-assertions-in-branches.md`.
- **Related:**
  [rust-test-assertions-in-branches.md](./rust-test-assertions-in-branches.md)
  holds the same class in Rust tests. One lint decision can cover both.
- **Recommendation:** A now. B when the user approves the lint.
- **Action:** fix after merge, apply A, because the places are in 45 test
  files on `main`, outside the branch that found them.
