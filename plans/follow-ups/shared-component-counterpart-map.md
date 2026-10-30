# Share component counterpart mapping

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of a comparison review of the rebuild.
- **Location:** `crates/mokly-compare/src/projection_context.rs:24` and
  `crates/mokly-compare/src/lookup.rs:139`.
- **Reason:** A comparison review found the second map in code that its
  change did not touch, so a separate branch gives the relationship one
  owner.

- **Source:** Review.
- **Category:** Code structure (estimate).
- **Terms:**
  - **`Lookup`:** the kind-aware branch-point lookup in
    `crates/mokly-compare/src/lookup.rs`. It is fenced to one accepted
    generation.
  - **Counterpart:** the base path of a current component entry, after
    accepted moves.
- **Background:** The rebuild indexed `Lookup` and built the projection's
  references on it, so that one branch-point lookup serves every shell.
  `Lookup::counterpart` proves a current entry's base spelling from the
  accepted moves and the base entries, with a generation fence.
- **Problem:** `projection_context::Context::new` builds its own
  `counterparts` map from `result.pairing.entries`. It keeps only pairs
  whose two sides are components. So two owners answer "which base
  component is this current component" in two ways.
- **Impact if no action:** The two answers can drift. Then the projection
  and the branch-point lookup can disagree about a moved component.
- **Root question:** Which single owner should map a current component to
  its base counterpart?
- **Options:**
  - **A.** Keep both maps, and document why the projection keeps its own.
    Effort: Small (estimate).
  - **B.** Build the projection's counterparts from `Lookup::counterpart`.
    Effort: Medium (estimate).
  - **C.** Store each pair's typed counterpart once in the pairing result,
    and let `Lookup` and the projection both read it. Effort: Medium
    (estimate).
- **Left out:** Deleting the projection map without a replacement loses
  the component references of moved entries.
- **Wider fix:** C. One typed record of each pair removes every second
  map, also the variant parent map.
- **Previous examples:** The rebuild already replaced the projection's
  other references with `Lookup`.
- **Related:**
  [shared-variant-parent-map.md](./shared-variant-parent-map.md) has the
  same class: a second, kind-less map beside `Lookup::parent`. C of both
  items is one change.
- **Recommendation:** B. (estimate) It reuses the owner that already
  exists. C best protects the codebase.
- **Action:** ask the user (estimate), because condition 6 holds: the item
  concerns code structure.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5073).
