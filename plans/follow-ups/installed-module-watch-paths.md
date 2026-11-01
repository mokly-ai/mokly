# Serve watches installed modules at their logical paths

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the options check of the unmerged plan of the
  closed "perf 6" workspace, 2026-10-30, which put it outside its scope.
- **Location:** `crates/mokly-render/src/bundle_attempt.rs:62` and line 83,
  `crates/mokly-render/src/bundle.rs:177`,
  `crates/mokly-watch/src/plan.rs:129`, and
  `packages/mokly/src/sidecar/module-paths.ts:150`.
- **Reason:** The perf 6 plan changes the base lifetime, not the watcher,
  and nobody reproduced the problem.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Dependency root:** a `node_modules` directory that the sidecar
    resolves packages from. The first is the nearest one above the
    configuration.
  - **Logical path:** the name that the sidecar gives an installed module:
    `node_modules/{path}` in the first dependency root, and
    `node_modules/.mokly-roots/{n}/{path}` in root `n`.
  - **Resolution files:** the repository-relative paths that Serve watches
    for each JavaScript generation, in `JavaScriptGeneration`.
- **Background:**
  - The sidecar reports each bundled module by its logical path, in
    `packages/mokly/src/sidecar/module-paths.ts:150`.
  - `stamp` in `crates/mokly-render/src/bundle_attempt.rs:62` joins each
    logical path to the repository root. Line 83 leaves out `.css` modules.
  - `finish` in `crates/mokly-render/src/bundle.rs:177` turns those paths
    into resolution files. `Plan::resolution` in
    `crates/mokly-watch/src/plan.rs:129` watches each one under the
    repository root.
  - The source tree maps logical paths to the real dependency roots, in
    `crates/mokly-render/src/sources.rs:36`. So the input check of a bundle
    reads the right file. The watcher does not use that map.
  - `docs/protocol/mokly-watch.md` requires Serve to watch the sidecar's
    reported modules, also beneath `node_modules`.
- **Problem:** Serve can watch a path that is not the real file of a
  module. This happens when the first dependency root is not
  `{repository}/node_modules`, or when a module comes from a second root.
  An edit or an install there then starts no rebuild.
- **Impact if no action:** For a configuration in a nested package with its
  own `node_modules`, previews stay stale after an install until Serve
  restarts. An installed stylesheet that JavaScript imports may have the
  same gap. Nobody checked whether the stylesheet watch covers it.
- **Root question:** How does Serve watch the real file of every module
  that the sidecar reports?
- **Options:**
  - **A.** Change nothing, and tell users to restart Serve after an install
    in a nested package. Effort: Small.
  - **B.** Map each logical path to its real path with the dependency roots
    of the side. Put the mapping in one helper that the input check and the
    watch plan share. Include the `.css` modules when the stylesheet watch
    does not cover them. Effort: Medium (estimate).
  - **C.** Let the sidecar report the real path beside the logical path,
    and watch the real path. This changes the `bundle` result. Effort:
    Medium (estimate).
- **Left out:** Watch the whole dependency root. Broad traversal prunes
  `node_modules` at every depth, and its file count is large.
- **Wider fix:** B. One shared mapping keeps every logical-to-real
  conversion the same.
- **Previous examples:** None found.
- **Related:**
  - [keep-base-side-in-memory.md](./keep-base-side-in-memory.md): its
    options 1C and 1D rely on the head watcher seeing install changes.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): another
    gap in the watched resolution inputs.
- **Recommendation:** B. It fixes both cases with one rule, and it changes
  no wire format.
- **Action:** fix after merge, apply B, because no open branch owns the
  watcher, and the fix first needs a reproduction with a nested package.
