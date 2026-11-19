# State the unimock default-body rule in skills

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-classify-memo`, the wider fix that its first review split off finding 4.
- **Location:** The Mocking section of `skills/rust/references/architecture.md` in the shared skills repository `futex-ai/skills`. The example in this repository is `crates/mokly-git/src/repository.rs` (`checkout_identity_with`).
- **Reason:** The fix belongs to the shared skills repository `futex-ai/skills`, not to this repository.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Unimock delegation:** when a test sets no clause for a trait method that has a default body, `unimock` runs that default body instead of a panic.
  - **`DefaultImplDelegator`:** the `unimock` type that runs those default bodies. In `unimock` 0.6.8 it forwards only the required methods of the trait back to the mock (`unimock_macros-0.6.8/src/unimock/mod.rs`, near lines 166 to 194).
- **Background:**
  - A default body runs on the `DefaultImplDelegator`. When it calls another method that also has a default body, that call runs the trait default too. It never reaches a clause that a test set for the other method.
  - That branch first gave `Repository::checkout_identity_kept` a default body that called `checkout_identity`, so that existing test doubles keep working. The existing test `checkout_change_after_first_read_keeps_old_sample_then_prepares_and_reuses_new_sample` in `crates/mokly-cli/src/_tests_/serve_base/checkout_tests.rs` mocks only `checkout_identity`. It failed with `(3, 0, 3)` instead of `(2, 0, 2)`, because each kept check read the trait default digest, the commit string.
  - The fix was one function on `dyn Repository`, `checkout_identity_with`, that calls each method through the trait object, so each clause of a double answers.
  - The Mocking section of the shared Rust rules says how to set clauses, but not this rule.
- **Problem:** The shared rules do not say that a default body cannot reach the clause of another method with a default body. A change that adds such a default can break existing tests, or make a new test pass for the wrong reason.
- **Impact if no action:** Agents can repeat the mistake in any repository that uses `unimock`, and lose time on a test failure that names no cause.
- **Root question:** How do agents learn that a fallback for existing test doubles must call through the trait object, not through another default body?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Add one rule to the Mocking section of `skills/rust/references/architecture.md`: a default body never reaches the clause of another method with a default body, because the delegator forwards only the required methods. So a fallback for existing doubles goes in the caller, or in one function over `&dyn Trait`. Effort: Small.
  - **C.** Do B, and ask the `unimock` maintainers to forward default methods that have a clause. The change waits for another project. Effort: Medium.
- **Left out:** A lint that rejects a default body that calls another default method, because it would reject correct code that no test mocks, and a new gate needs the user.
- **Wider fix:** B. Each agent reads the rule before it adds a trait method with a default body.
- **Previous examples:** The first implementation of that branch, described in the background.
- **Recommendation:** B. One line in the shared rules prevents the class in every repository.
- **Action:** fix after merge, apply B, because the rule lives in the shared skills repository, outside this repository.
