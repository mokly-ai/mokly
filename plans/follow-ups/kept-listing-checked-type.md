# Let only a passed check keep a listing

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-classify-memo`, the wider fix that its first review split off finding 3.
- **Location:** `crates/mokly-git/src/source_key.rs` (`KeptListing::keep`), `crates/mokly-git/src/checkout_index.rs` (`GitRepository::listing`), `crates/mokly-cli/src/_tests_/serve_base/kept_listing_tests.rs`.
- **Reason:** The type changes a public trait of `mokly-git` for a Low test gap, and a test of that branch already guards the rule.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Object check:** the missing-object preflight of a tree listing in `mokly-git`. It runs `git ls-tree -l` for the `.gitattributes` paths and `git rev-list --objects --missing=print`, and it fetches missing objects from a promisor remote.
  - **`KeptListing`:** the `mokly-git` store that holds the tree listing of a commit after its object check passed. A later identity read with an equal listing skips the object check.
- **Background:**
  - `GitRepository::listing` runs the object check of a new listing, and it calls `KeptListing::keep` only after the check passed. An equal later listing then skips the check, because the check would see the same objects.
  - `KeptListing::keep` accepts any bytes. Only the test `a_failed_object_check_keeps_no_listing` in `crates/mokly-git/src/_tests_/kept_listing_tests.rs` fails when a change keeps a listing before or without a passed check.
  - The only caller of `keep` outside `listing` is the test double in `crates/mokly-cli/src/_tests_/serve_base/kept_listing_tests.rs`.
- **Problem:** The rule "only a checked listing is kept" depends on one call order in `listing` and on one test. The type of `keep` does not hold the rule.
- **Impact if no action:** A later change of `listing`, for example a new early return, can keep an unchecked listing. The next identity read then skips the object check and can miss a missing object. Only that one test would catch it.
- **Root question:** How does the code make sure that only a listing whose object check passed can skip a later object check?
- **Options:**
  - **A.** Change nothing, and keep the test as the guard. Effort: Small.
  - **B.** Make `KeptListing::keep` take a `CheckedListing` with a private field. Build it only in a function that runs the object check and the listing read after a fetch, in a module other than `checkout_index.rs`, so that `listing` cannot build it. Change the CLI test double so that it records the store that each check gets instead of calling `keep`. Update the `KeptListing` text of `crates/mokly-git/README.md`. Effort: Medium.
- **Left out:** Return the checked listing in the result of `checkout_identity_kept` and let the caller keep it, because B gives the same guarantee inside `mokly-git` and needs no change of the callers. Only two approaches are real, because one call holds the rule.
- **Wider fix:** B. A keep without a passed check then fails to compile, whatever shape `listing` takes.
- **Previous examples:** None found.
- **Recommendation:** B. It removes the wrong case, and the test stays as the check of the work that it guards.
- **Action:** fix after merge, apply B, because it changes a public trait for a Low test gap that a test of that branch already guards.
