# Test every rejected contract document

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #223 and its completed plan, the wider fix
  that its first implementation review split off finding 11.
- **Location:** `crates/mokly-model/src/read_contract.rs:7` and
  `crates/mokly-model/src/_tests_/public_contract_tests.rs:1`.
- **Reason:** PR #223 fixed the finding itself, and no dated user choice
  approves this proposed test of the whole class.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **`ContractViolation`:** the enum in
    `crates/mokly-model/src/read_contract.rs:7`. Each variant names one
    semantic rule that a decoded index, entry detail, or live descriptor
    can break.
  - **Rejected document:** a payload that breaks exactly one rule, so that
    the reader must return that one violation.
- **Background:**
  - The public readers of `mokly-model` validate each payload before a
    consumer reads a field. They reject a payload with a typed
    `ContractViolation`.
  - On 2026-10-30 the enum had 59 variants. The tests under
    `crates/mokly-model/src/_tests_/` named 18 of them directly.
  - A finding of the first implementation review of PR #223, on
    2026-10-27, was fixed in that pull request. Its text was not kept in
    the repository. The review then recorded this test for its class.
- **Problem:** Some rules have no test with a document that breaks them.
  The tag rule at `crates/mokly-model/src/public_validation.rs:181-192` is
  one. No test feeds a reader a duplicate or invalid tag. So deleting the
  duplicate check at line 183 passes every test. Many mutation tables also
  assert only `is_err()`, for example
  `crates/mokly-model/src/_tests_/public_reader_tests.rs:83` and
  `crates/mokly-model/src/_tests_/usage_context_tests.rs:76-81`. A reader
  that returns the wrong violation then still passes.
- **Impact if no action:** A host or a receiver can accept a payload that
  the contract rejects, and the error appears only later in a consumer.
- **Root question:** How does the test suite show that each contract rule
  rejects the documents that break it?
- **Options:**
  - **A.** Add one table test with one rejected document for each
    `ContractViolation`. Effort: Medium.
  - **B.** Change nothing, and add tests only when a rule changes. Effort:
    Small.
  - **C.** Add rejected documents only for the rules that PR #223 changed.
    Effort: Small.
  - **D.** Apply A, and build the table through an exhaustive `match` over
    `ContractViolation`. A new variant without a row then fails to compile.
    This adds a compile-time rejection. Effort: Medium.
- **Left out:** A lint that counts the test rows. D gives the same guard
  through the compiler, and each of them adds a new rejection.
- **Wider fix:** D. Each later variant then needs its own
  rejected document.
- **Previous examples:** None found, as the review of PR #223 recorded.
- **Recommendation:** A. It is the test that the review proposed,
  and it gives every rule a rejected document without a new rejection. D
  best protects the codebase, but its exhaustive `match` adds a compile-time
  rejection.
- **Action:** ask the user, because A adds a test for the whole
  contract-violation class. D also adds a compile-time rejection for a variant
  without a test row.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L382).
