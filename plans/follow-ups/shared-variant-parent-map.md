# Share variant parent mapping

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of a comparison review of the rebuild.
- **Location:** `crates/mokly-compare/src/review_projection.rs:75` and
  `crates/mokly-compare/src/lookup.rs:174`.
- **Reason:** A comparison review found the second mapping in code that
  its change did not touch, so a separate branch gives the relationship one
  typed owner.

- **Source:** Review.
- **Category:** Code structure (estimate).
- **Terms:**
  - **`Lookup`:** the kind-aware branch-point lookup in
    `crates/mokly-compare/src/lookup.rs`. It is fenced to one accepted
    generation.
  - **`Pairing::paths`:** a map from base paths to current paths, without
    the entry kind.
- **Background:** The rebuild built the projection's references on
  `Lookup`, so that one branch-point lookup serves every shell.
  `Lookup::parent` resolves a variant's parent with explicit side and role
  checks.
- **Problem:** The review projection attaches variants to their parents
  through `pairing.paths(before, after)`, a map without entry kinds. It then
  tries the current parent, the mapped parent, and the base parent in turn.
  So a second, kind-less path decides the parent beside `Lookup::parent`.
- **Impact if no action:** A path that two entry kinds share can attach a
  variant to the wrong parent, and the two owners can drift.
- **Root question:** Which single typed owner should attach a variant to
  its parent?
- **Options:**
  - **A.** Keep the kind-less map, and document the fallback order.
    Effort: Small (estimate).
  - **B.** Attach variants through `Lookup::parent`. Effort: Medium
    (estimate).
  - **C.** Store each pair's typed parent and counterpart once in the
    pairing result, and let `Lookup` and the projection both read it.
    Effort: Medium (estimate).
- **Left out:** Matching parents by path text alone keeps the kind-less
  guess that causes the problem.
- **Wider fix:** C. One typed record of each pair removes every second
  map, also the component counterpart map.
- **Previous examples:** The rebuild already replaced the projection's
  other references with `Lookup`.
- **Related:**
  [shared-component-counterpart-map.md](./shared-component-counterpart-map.md)
  has the same class: a second map beside `Lookup::counterpart`. C of both
  items is one change.
- **Recommendation:** B. (estimate) It reuses the typed owner that already
  exists. C best protects the codebase.
- **Action:** ask the user (estimate), because condition 6 holds: the item
  concerns code structure.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5075).
