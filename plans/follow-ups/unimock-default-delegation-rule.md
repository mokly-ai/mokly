# State two unimock rules in the shared skills

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-classify-memo`, the wider fix that its first review split off finding 4, with a fact that the check of finding 6 of its second review found.
- **Location:** The Mocking section of `skills/rust/references/architecture.md` in the shared skills repository `Firna-AI/skills`, near its line 106.
- **Reason:** The fix belongs to the shared skills repository `Firna-AI/skills`, not to this repository.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Unimock delegation:** when a test sets no clause for a trait method that has a default body, `unimock` runs that default body instead of a panic.
  - **`DefaultImplDelegator`:** the `unimock` type that runs those default bodies. In `unimock` 0.6.8 it forwards only the required methods of the trait back to the mock (`unimock_macros-0.6.8/src/unimock/mod.rs`, near lines 166 to 194).
- **Background:**
  - A default body runs on the `DefaultImplDelegator`. When it calls another method that also has a default body, that call runs the trait default too. It never reaches a clause that a test set for the other method.
  - That branch first gave a new `Repository` method a default body that called `checkout_identity`, so that existing test doubles keep working. The existing test `checkout_change_after_first_read_keeps_old_sample_then_prepares_and_reuses_new_sample` in `crates/mokly-cli/src/_tests_/serve_base/checkout_tests.rs` mocks only `checkout_identity`. It failed with `(3, 0, 3)` instead of `(2, 0, 2)`, because each check read the trait default digest, the commit string. A later round of that branch removed the new method.
  - The Mocking section of the shared Rust rules says: "Every clause kind fails the test when the code never makes the call." In `unimock` 0.6.8 that is false. An `each_call` clause without a quantifier has a minimum of zero calls (`unimock-0.6.8/src/build.rs:46`, `src/counter.rs:84-86`). Only a mocked method that gets no call at all fails the test (`src/fn_mocker.rs:46-62`). `next_call`, and `some_call` with `returns`, need exactly one call.
- **Problem:** The shared rules do not say that a default body cannot reach the clause of another method with a default body. They also state a wrong minimum for clauses. Both facts change how an agent keeps existing tests passing.
- **Impact if no action:** Agents can break existing tests with a new default method, and can refuse a correct change because they expect an uncalled `each_call` clause to fail.
- **Root question:** How do agents learn how `unimock` treats default bodies and clause counts?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Change the Mocking section of `skills/rust/references/architecture.md`. Add: a default body never reaches the clause of another method with a default body, because the delegator forwards only the required methods, so a fallback for existing doubles goes in the caller or in one function over `&dyn Trait`. Correct the clause rule: `each_call` without a quantifier can match zero calls, and a mocked method that gets no call at all fails the test. Effort: Small.
  - **C.** Do B, and ask the `unimock` maintainers to forward default methods that have a clause. The change waits for another project. Effort: Medium.
- **Left out:** A lint that rejects a default body that calls another default method, because it would reject correct code that no test mocks, and a new gate needs the user.
- **Wider fix:** B. Each agent reads the rules before it adds a trait method or a clause.
- **Previous examples:** The first implementation of that branch, described in the background.
- **Recommendation:** B. A few lines in the shared rules prevent both mistakes in every repository.
- **Action:** fix after merge, apply B, because the rules live in the shared skills repository, outside this repository.
