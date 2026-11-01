# Nested paths in one Git lookup hide a directory

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from item 64, the branch
  `conductor/rust-rebuild-64-opaque-asset-digests`: review round 3,
  finding 5, and its finding check.
- **Location:** `crates/mokly-git/src/lookup.rs:38-41`,
  `crates/mokly-compare/src/sources.rs:234`, and
  `crates/mokly-compare/src/git_projection.rs:22`.
- **Reason:** Only a base stylesheet that already fails validation reaches
  the defect, and the branch had used its two fix rounds without the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`GitTree`:** the source adapter in
    `crates/mokly-compare/src/git_tree.rs` that projects the files and
    directories of one base commit.
  - **`project_batch`:** the metadata operation of `SourceTree`. For each
    requested path, it must return the outcome of a single `project` of
    that path.
  - **Source index:** the Git metadata that `GitSources` caches for one
    commit, with the set of paths whose lookup finished.
  - **Exact lookup:** `Repository::lookup` in
    `crates/mokly-git/src/lookup.rs`. It reads the tree records of the
    requested paths and of their attribute files through `git ls-tree`.
- **Background:**
  - Mokly reads the base catalogue through `GitTree`, without extracting
    every file.
  - Commit `8efaa239` of the branch added `GitTree::project_batch`. It sends
    all its paths to one `GitSources::ensure` call, at
    `crates/mokly-compare/src/git_projection.rs:22`. Then it projects each
    path from the source index.
  - The exact lookup runs `git --literal-pathspecs ls-tree -l -z --full-tree`
    without `-t`. Every requested path and attribute file is a pathspec.
    When one pathspec lies inside another, Git traverses the outer
    directory. Without `-t`, Git leaves out the record of a directory that
    it traverses, and it lists the files below that directory.
  - The exact lookup keeps only the records of requested paths, at
    `crates/mokly-git/src/lookup.rs:38-41`. So it also drops the files
    below the directory.
  - `GitSources::ensure` marks every requested path as known, at
    `crates/mokly-compare/src/sources.rs:234`. That includes a path whose
    record the lookup did not return.
  - `project_node` infers a directory from an indexed record below it, at
    `crates/mokly-compare/src/git_projection.rs:53-64`. When it finds no
    record, it calls `ensure` again, at line 33. That call does no lookup,
    because the path is already known.
  - A run on 2026-11-01 with Git 2.50.1 and the flags above shows the Git
    part, in a commit that holds `assets/logo.svg` and the file `a.svg`:
    - `ls-tree -- assets` prints the `040000 tree` record of `assets`.
    - `ls-tree -- assets assets/missing.svg` prints only `assets/logo.svg`.
    - `ls-tree -t -- assets assets/missing.svg` prints the `assets` record
      and `assets/logo.svg`.
    - `ls-tree -t -- a.svg/b.png` prints nothing.
    - `ls-tree -t -- a.svg a.svg/b.png` prints the record of `a.svg`.
  - Git's own tests in `t/t3100-ls-tree-restrict.sh` of Git 2.50.1 show the
    same. For the file `path0`, `ls-tree $tree path0/` prints nothing. For
    the directory `path2` and the missing `path2/bak`,
    `ls-tree $tree path2/bak` prints nothing, and
    `ls-tree -t $tree path2/bak` prints the record of `path2`.
  - The CSS compiler sends only `url()` targets, and `SideTree` adds only
    their alias candidates. The confinement walk projects each ancestor
    directory on its own, at
    `crates/mokly-css/src/compiler_projection.rs:48-53`. So a real catalogue
    reaches the defect only when one base stylesheet names a directory with
    an asset extension, such as `icons.svg/`, together with a missing path
    below it.
  - That stylesheet already makes all of Changes unavailable as "base
    validation failed", through `crates/mokly-cli/src/changes_policy.rs:64-76`
    and `docs/protocol/mokly-comparison.md:186-187`. The false absence that
    the `SourceSnapshot` of the generation keeps can at most add false
    diagnostics for later stylesheets that name existing files below that
    directory.
  - Option D of `plans/follow-ups/base-asset-conversion-unavailable.md`
    changes only digests that return `SourceError::Unavailable`. A missing
    or non-regular target still fails base validation, so that work does
    not change the reach.
  - `crates/mokly-source-interface/README.md` states the intended rule: the
    Git adapter batches the exact metadata lookups and keeps the ordinary
    outcome of each path. That README starts with a status line that links
    this item.
- **Problem:** Take a commit that holds `assets/logo.svg` and no attribute
  files. A fresh `GitTree` gets `project_batch` with `/repo/assets` and
  `/repo/assets/missing.svg` before any other lookup. It returns `None` for
  the directory, but a fresh single `project` of `/repo/assets` returns a
  directory node. The source index then keeps the false absence, so later
  single projections of `/repo/assets` also return `None` until an
  expansion loads that directory. A later `GitTree::read` of the directory
  reports a missing path, `NotFound`, where `docs/protocol/mokly-git.md:80-81`
  gives a nonregular path its own error. Every multi-path caller of `ensure`
  shares the cause, such as `GitTree::prefetch_sources` and the digest
  batches.
- **Impact if no action:** `project_batch` breaks its per-path contract for
  nested paths, and the source index keeps an existing directory as absent.
  In a real catalogue, Changes is then already unavailable, and later
  stylesheets of the same generation can get false diagnostics.
- **Root question:** How does one multi-path exact lookup give each
  requested path the same answer as a lookup of that path alone, also when
  one requested path lies inside another?
- **Options:** Each option adds a regression test with a real Git
  repository, because only real Git leaves out the directory record.
  Through `GitTree::project_batch`, request a directory together with a
  missing path below it, and a file together with a path below it. Assert
  the literal results, and assert a later single projection of each path.
  Each option keeps the constant Git process counts of
  `css_confinement_git_processes_stay_constant_at_four_and_sixteen_assets`
  in `crates/mokly-render/src/_tests_/css_asset_batch_tests.rs`, and the
  confinement walk before any digest. A, C, and D add Git processes only for
  a batch with nested paths, and that test sends none. B and E add no
  processes. Each option removes the status line of
  `crates/mokly-source-interface/README.md`.
  - **A.** Leave ancestor paths out of the first `GitTree` batch, and
    project them alone after the leaf batch. The fix stays inside the new
    adapter operation. Effort: Small.
  - **B.** Make the exact lookup keep the requested directories that Git
    traverses. Run `ls-tree -t`, and keep every requested path as a
    pathspec. Remove the extra ancestor records before the existing result
    count bounds apply. The same processes then return the exact record of
    each requested path for every caller of `ensure`, without a listing of
    unrelated children. Effort: Small.
  - **C.** Split the requested and attribute paths into groups in which no
    path lies inside another. Query each group alone, and merge the exact
    results. It adds Git calls for overlapping requests. Effort: Medium.
  - **D.** In `GitSources::ensure`, mark a requested path as known only when
    the lookup proves its result. A result is proven when the lookup
    returned the record of the path, or when no other path of the same
    lookup lies below it. An unproven directory then gets one lookup of its
    own, through the second `ensure` call of `project_node`. It needs no
    `ls-tree -t`. It costs one more `ls-tree` for each unproven directory,
    only in a batch with nested paths. `crates/mokly-compare/src/sources.rs`
    is at the 300-line cap, so the rule goes in
    `crates/mokly-compare/src/source_index.rs`. Effort: Small.
  - **E.** In the exact lookup, also keep the records that Git lists below a
    requested path, so that the inference of `project_node` finds the
    directory. No Git command changes. The index then holds no exact record
    of the directory, so a later `read` of it reports NotFound, where a
    lookup of the directory alone gives InvalidInput. The children count
    against the node bound after the filter. An empty tree stays hidden, but
    only Git plumbing commands can make one. Effort: Small.
- **Left out:**
  - Change nothing: the batch keeps breaking its per-path contract.
  - One lookup for each asset: it breaks the batching decision of
    2026-10-28 for the opaque assets of a stylesheet.
  - An index of the whole commit: it reads far more than the requested
    paths.
  - The form of B that sends only the most specific paths: Git does not
    match a file against a deeper pathspec. A requested file that holds
    another requested path, such as `url(icon.svg)` with
    `url(icon.svg/x.png)`, then loses its record.
  - `git cat-file --batch-check` with `commit:path` lines: it gives no mode,
    so the confinement walk cannot see a symbolic link.
  - A listing of each parent directory: it lists unrelated siblings, such
    as all of `node_modules/.pnpm`, and can pass the node bound. B returns
    exact records without the siblings, so B is better on every point.
- **Wider fix:** B. A correct directory record at the shared lookup removes
  the defect for every caller of `ensure`.
- **Previous examples:** None found in the lookup history, the projection
  commits, and `plans/`.
- **Recommendation:** B, with every requested path kept as a pathspec and
  `ls-tree -t`. The same Git processes then return the exact record of each
  requested path for every caller of `ensure`.
- **Action:** fix after merge, apply B, because the likelihood is Rare and
  the severity Low.
