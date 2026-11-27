# PostCSS hint skips ordinary repository modules

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`, review finding 6 and its check.
- **Location:** `crates/mokly-render/src/sources_hint.rs:12` (`SideTree::hint_sources`), `crates/mokly-render/src/sources.rs:226` (`SideTree::project`), `crates/mokly-compare/src/git_hint.rs:18` (`GitTree::hint_metadata`).
- **Reason:** Adding tracked files to the hint can start a promisor fetch inside a hint, so the change needs a partial-clone guard first, and the branch had ended its fix rounds.

- **Terms:**
  - **Projection hint:** `SourceTree::hint_projections`, which names paths that later projections ask for, so that `GitTree` can look them up in one batch. It reads no bytes and reports no error.
  - **PostCSS read inventory:** `postcss_read_inventory::collect`, which projects and hashes each module that the PostCSS worker reported.
- **Background:** The read inventory hints its modules without a digest at once. `SideTree::hint_sources` passes on only the private repository names and the first repository candidate of each dependency name. An ordinary repository path, such as `postcss.mjs` or `plugins/x.js`, gives no candidate in `source_paths::source_candidates`, so the hint drops it, and `SideTree::project` later sends it to Git alone. `GitTree::hint_metadata` also does nothing for a single path.
- **Problem:** On a base tree without a whole-tree listing, each ordinary repository module still starts its own lookup. Production lists the base tree once through `Sources::attach` before PostCSS runs, so only fixtures without that listing see the cost.
- **Impact if no action:** Tests whose base tree has no listing keep one Git lookup for each ordinary repository module.
- **Root question:** How can the hint name, for each path kind, the same first base-tree lookup that `SideTree::project` makes?
- **Options:**
  - **A.** Add the ordinary repository path to the hint when the projection would send it to Git directly. Effort: Small (estimate). The routing then has two copies.
  - **B.** Share the first-lookup decision between `SideTree::hint_sources` and `SideTree::project`, and add a regression case with two ordinary modules. Effort: Medium (estimate).
  - **C.** Do B together with a guard that makes `GitTree::hint_metadata` decline in a repository with a promisor remote, so that a hint never starts a fetch. Effort: Medium (estimate).
- **Left out:** Hinting every dependency alias, because a later alias is projected only when the first candidate is missing, and a wider hint in a partial clone can fetch objects that no read needs.
- **Wider fix:** B, because one routing decision keeps the hint and the projection aligned.
- **Recommendation:** C (estimate). It batches ordinary modules in full clones and keeps fetches at their original read boundary in partial clones.
- **Action:** fix after merge, with option C.
