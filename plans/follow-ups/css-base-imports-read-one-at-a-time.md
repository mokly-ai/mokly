# Base CSS imports read one at a time

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`.
- **Location:** `crates/mokly-css/src/compiler.rs:97` (`Preparation::source`) and `crates/mokly-css/src/compiler_assets.rs:36` (`Preparation::read`).
- **Reason:** The fix changes the read order of the shared CSS compiler on every side, which is outside the scope of the Git base-read change that found it.

- **Terms:**
  - **Base side:** the render of the comparison's base commit. Its files come from Git through `GitTree` in `mokly-compare`, not from the disk.
  - **Prefetch:** `SourceTree::prefetch`, a hint that lets a tree read a set of exact paths in one batch. `GitTree` converts such a batch in one `git cat-file --batch --filters` process.
- **Background:** The CSS compiler walks the `@import` tree of each stylesheet root. `Preparation::source` reads a file, resolves its imports, and then calls itself for each import, so it reads each file alone through `Preparation::read`. On the base side each read is one `git cat-file --filters` process, and each first projection of a path is one `ls-tree` process. A plain-CSS comparison with 80 imported stylesheets starts 85 `cat-file` and 88 `ls-tree` processes; the other Git work of the comparison is constant.
- **Problem:** The base side of a stylesheet walk starts two Git processes for each imported file. On Windows, where a process start is slow, a catalogue with many stylesheets spends most of its base preparation on process starts.
- **Impact if no action:** Comparisons of catalogues with many stylesheets stay slower on the base side than they need to be, most of all on Windows.
- **Root question:** How can the base side of a stylesheet walk read the files of one import level together, with the same bytes, read evidence, and errors?
- **Options:**
  - **A.** In `Preparation::source`, after the first resolve loop, call `tree.prefetch` once with the resolved import targets that are not excluded and not yet read, and ignore a prefetch error, as `crates/mokly-graph/src/planning_resources.rs:57` does. Each later read then hits the `GitTree` cache. Effort: Medium (estimate).
  - **B.** Do A, and also prefetch the targets that PostCSS adds in its processed text before the second loop reads them. Effort: Medium (estimate).
  - **C.** Collect the whole import closure in a first pass of resolutions only, prefetch it once, and then read. Effort: Large (estimate), because the second resolve loop runs on PostCSS output that the first pass does not have.
- **Left out:** A batch lookup without prefetch. The read, not the lookup, starts the conversion process, so a batched lookup alone halves the count at best.
- **Wider fix:** None found. Prefetch is already the batching boundary of `SourceTree`; the compiler is a caller that does not use it yet.
- **Recommendation:** A (estimate). It batches the common case of a root that imports many files, with one call at one place, and a failed prefetch keeps the current per-file reads and errors.
- **Action:** fix after merge, with option A. Check that the head-side trees, which record their reads, record the same inputs with the prefetch.
