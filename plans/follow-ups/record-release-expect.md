# Generation release uses expect in production code

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-19, from the round-1 review of the branch
  `calummoore/mokly-return-warmup`, list of problems outside the scope.
- **Location:** `crates/mokly-sidecar/src/pool_releases.rs:83`
  (`Pool::record_release`).
- **Reason:** The calls are older than the return warm-up branch, which did not
  change this function. Since 2026-11-22 the work waits for the answer of
  [mokly-production-expect-rule.md](./mokly-production-expect-rule.md): #284,
  commit `055c95981`, added these calls under the user decision of
  2026-11-03.

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
- **Impact if no action:** The calls conflict with the shared `rust` skill
  until the user answers the rule item. Today the invariant holds, so no
  panic happens.
- **Root question:** How does a final release stay safe when the retained
  state of a generation is incomplete?
- **Options:**
  - **A.** Take the three values with `Option` and store the recipe only when
    all three exist. Drop the other retained state in every case. This
    restores the `Option` handling that #284 replaced under the decision of
    2026-11-03. Effort: Small.
  - **B.** Keep the three values in one struct in one map, so a live
    generation cannot hold only some of them. Effort: Medium.
- **Left out:** No change before the answer of the rule item, because the
  answer decides whether the calls stay. Fewer than three approaches are
  real, because the state either becomes optional at the use or one struct at
  the store.
- **Wider fix:** B. A single map entry removes the partial state at its source.
- **Previous examples:** None found.
- **Related:** [mokly-production-expect-rule.md](./mokly-production-expect-rule.md)
  holds the open choice of the rule for these calls, and the release work
  waits for its answer.
- **Recommendation:** If the rule item keeps the calls, with its option A, no
  release work is needed, and this item closes with no code change. For each
  other answer, B, because a single map entry removes the partial state at
  its source, and the fix rule applies such a fix before A. Until 2026-11-22
  the recommendation was A.
- **Action:** ask the user, because the fix depends on the answer of the rule
  item.
