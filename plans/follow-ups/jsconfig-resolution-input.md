# Include jsconfig paths in resolution inputs

- **Severity:** Medium (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts:57`,
  `crates/mokly-graph/src/render_closure.rs:6`, and
  `docs/protocol/mokly-sidecar-modules.md:142`.
- **Reason:** The input list is older than PR #226, and the review found the
  gap outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Compilation reuse:** the sidecar keeps a compiled bundle while its
    recorded inputs stay unchanged, so that an unrelated edit does not
    compile again.
  - **Render input key:** the key of one entry module's renders. It moves
    when one of its inputs changes, under the watch contract.
- **Background:**
  - esbuild reads `paths` from a `jsconfig.json`, as it does from a
    `tsconfig.json`. `packages/mokly/src/sidecar/package-scope.ts:107`
    already reads `tsconfig.json`, else `jsconfig.json`, for parse
    settings.
  - `resolutionInputs` in
    `packages/mokly/src/sidecar/resolution-inputs.ts:57` records the
    `package.json` and `tsconfig.json` candidates of each consumed module's
    directory chain as compilation inputs. It records no `jsconfig.json`.
  - `docs/protocol/mokly-sidecar-modules.md:142` lists the same two
    candidates as reuse inputs.
  - In Rust, `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:6` lists the same two names
    for the render input keys. `docs/protocol/mokly-watch.md:70` states that
    rule.
- **Problem:** An edit to the `paths` of a `jsconfig.json` changes how
  esbuild resolves imports, but it is not a compilation input. The sidecar
  can then reuse a compilation that resolves an alias to the old file.
- **Impact if no action:** A JavaScript catalogue that uses `jsconfig.json`
  aliases can show modules from the old alias target until another input
  changes or Serve restarts.
- **Root question:** How does every file that esbuild reads for resolution
  invalidate the compilation that it shaped?
- **Options:**
  - **A.** Add `jsconfig.json` to the candidate names in
    `packages/mokly/src/sidecar/resolution-inputs.ts:57`, so that an edit
    invalidates compilation reuse and enters the watch inputs. Update the
    list in `docs/protocol/mokly-sidecar-modules.md:142`. Effort: Small.
  - **B.** Apply A. Also add `jsconfig.json` to `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:6`, so that an edit moves the
    render input keys as a `tsconfig.json` edit does. Update
    `docs/protocol/mokly-watch.md:70`. It changes the sidecar package and a
    Rust crate. Effort: Large (estimate).
  - **C.** Let the sidecar report the resolution file names that it records
    in each bundle result, and make the Rust chain use the reported names.
    One list then serves both sides. Effort: Large (estimate).
- **Left out:** Change nothing. A stale compilation breaks the reuse rule
  that a compilation stays only while its inputs stay unchanged.
- **Wider fix:** C (estimate). One reported list keeps the sidecar inputs
  and the render input keys equal.
- **Previous examples:** None found.
- **Recommendation:** A (estimate). It removes the stale compilation with
  one list entry. C best protects the codebase.
- **Action:** fix after merge, apply A (estimate), because a stale
  compilation is a product bug, and A is Small.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L421).
