# Generation release uses expect in production code

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the round-1 review of the branch
  `calummoore/mokly-return-warmup`, list of problems outside the scope.
- **Location:** `crates/mokly-sidecar/src/pool_releases.rs:83`
  (`Pool::record_release`).
- **Reason:** The calls are older than the return warm-up branch, which did not
  change this function.

- **Source:** Review.
- **Category:** Repository rule.
- **Terms:**
  - **Final release:** the release of the last lease of a generation's current
    lifetime. The pool then drops the retained bundle settings, compiled
    recipe, module inventory, class maps, and bindings of that generation.
- **Background:** The shared `rust` skill forbids `panic!`, `unwrap`, and
  `expect` in production code. `Pool::record_release` in
  `crates/mokly-sidecar/src/pool_releases.rs` handles a final release. It
  removes the bundle settings, the compiled recipe, and the module inventory
  with three `expect` calls, because a live generation always holds all three
  in the pool state.
- **Problem:** Three `expect` calls stay in production code. If a later change
  breaks the invariant, a release panics on the caller's thread instead of
  keeping the pool usable.
- **Impact if no action:** The code breaks a repository rule. Today the
  invariant holds, so no panic happens.
- **Root question:** How does a final release stay safe when the retained
  state of a generation is incomplete?
- **Options:**
  - **A.** Take the three values with `Option` and store the recipe only when
    all three exist. Drop the other retained state in every case. Effort:
    Small.
  - **B.** Keep the three values in one struct in one map, so a live
    generation cannot hold only some of them. Effort: Medium.
- **Left out:** No change, because it keeps the rule broken. Fewer than three
  approaches are real, because the state either becomes optional at the use
  or one struct at the store.
- **Wider fix:** B. A single map entry removes the partial state at its source.
- **Previous examples:** None found.
- **Related:** [mokly-production-expect-rule.md](./mokly-production-expect-rule.md)
  holds the open choice of the rule for these calls: #284, commit
  `055c95981`, added them under the user decision of 2026-11-03.
- **Recommendation:** A. It is the smallest change that keeps the release
  safe. B best protects the codebase.
- **Action:** fix after merge, apply A, because the code is older than the
  branch that found it.
