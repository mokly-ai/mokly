# Resolve base template imports from the base

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:42` and line 159.
- **Reason:** The gap exists on `origin/main` before PR #226, and the review
  found it outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base side:** the bundle of the base commit that Changes compares with
    the working tree. Its source root is the extracted base commit.
  - **Repository mapping:** the sidecar rule that maps a real module inside
    `repositoryRoots` to its copy under the side's source root, so that the
    base reads the bytes that the base commit tracks.
  - **Template-literal import:** a dynamic `import()` whose argument is a
    template string with a variable part, such as
    ``import(`./locale/${name}.js`)``. esbuild bundles every file that the
    pattern matches.
- **Background:**
  - The sidecar compiles the base side with esbuild. Its catch-all resolve
    callback at `packages/mokly/src/sidecar/plugins.ts:159` maps each
    resolved file through `paths.resolve`. That call applies repository
    mapping and the precedence of a tracked base copy.
  - The `file` load hook at `packages/mokly/src/sidecar/plugins.ts:42` reads
    and records the bytes of each loaded file at the path that esbuild gives.
  - The sidecar bundling contract in `docs/protocol/mokly-sidecar.md` says
    that the base source root is the extracted base commit. Repository
    mapping applies to `bundle`.
- **Problem:** The review of PR #226 found on 2026-10-28 that esbuild
  resolves the files of a template-literal `import()` without the resolve
  callbacks. In a base-side dependency, such an import then reads the head
  installation instead of a copy that the base commit tracks. The same
  defect exists on `origin/main` before PR #226.
- **Impact if no action:** The base bundle can contain head bytes for these
  modules. Changes can then miss a real change, or show a change that the
  base does not have.
- **Root question:** How does every module of a base bundle come from the
  base side, also when esbuild matches it from a template-literal import?
- **Options:**
  - **A.** Change nothing. State the limit in
    `docs/protocol/mokly-sidecar-modules.md`. Effort: Small.
  - **B.** After the base compile, fail the bundle with `bundle-failed` when
    a loaded file maps through `paths.resolve` to another file. The user
    then sees the gap instead of a silent head read. This adds a failure.
    Effort: Small.
  - **C.** Map each loaded file through `paths.resolve` in the `file` load
    hook, and read the bytes of the mapped base copy. The module keeps the
    logical name of its matched path. Effort: Medium.
  - **D.** Rewrite a template-literal `import()` of a base-side dependency
    in the load hook into dynamic imports that the resolve callbacks see,
    for example through a generated module that lists the matched files.
    Effort: Large.
- **Left out:** A separate dependency installation for each base. The
  comparison tiers decide when the base shares the head installation, and
  this item does not change them.
- **Wider fix:** C. Every loaded file then passes the mapping
  rule, whatever path esbuild used to find it.
- **Previous examples:** On 2026-10-27 the user chose, for PR #226, a second
  compile through the resolve callbacks whenever a native import would skip
  the base mapping. The template-literal case is the same class, but it
  skips the callbacks in every compile.
- **Recommendation:** C. It keeps the base bytes for every module
  without a new failure.
- **Action:** fix after merge, apply C, because head bytes in a
  base bundle are a product bug, and C is not blocked.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L417).
