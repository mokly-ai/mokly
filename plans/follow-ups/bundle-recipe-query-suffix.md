# Support query and hash suffixes in bundle recipes

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `packages/mokly/src/sidecar/bundle-recipe.ts:64` and
  `packages/mokly/src/sidecar/bundle-graph.ts:15`.
- **Reason:** The failure exists on `origin/main` before PR #226, and the
  review found it outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Bundle recipe:** the compiled generation that `bundleRecipe` in
    `packages/mokly/src/sidecar/bundle-recipe.ts` builds from one esbuild
    compile. It holds the module graph, the digests, and the identity.
  - **Import suffix:** a `?query` or `#hash` part at the end of an import
    specifier, such as `./icon.svg?inline`.
- **Background:**
  - `moduleGraph` in `packages/mokly/src/sidecar/bundle-graph.ts` turns each
    input of the esbuild metafile into a logical module name and a physical
    path. Its helper `clean` at line 15 removes only the `mokly-css:`
    namespace.
  - The `file` load hook in `packages/mokly/src/sidecar/plugins.ts:42`
    records the bytes of each loaded file under its file path.
  - At `packages/mokly/src/sidecar/bundle-recipe.ts:64`, the recipe looks up
    the recorded bytes of each module under its physical path. A missing
    entry fails the bundle.
  - The bundling contract in `docs/protocol/mokly-sidecar.md:98` requires the
    module graph to report the digest of each module's consumed bytes.
- **Problem:** The review of PR #226 found on 2026-10-28 that an import with
  a `?query` or `#hash` suffix fails every bundle with "Bundled source bytes
  were not recorded". The most likely cause: the metafile path keeps the
  suffix, but the load hook records the bytes under the path without it
  . The same failure exists on `origin/main` before PR #226.
- **Impact if no action:** A catalogue whose modules use such an import
  cannot bundle at all. The message names an internal record, so the user
  cannot see that the suffix is the cause.
- **Root question:** How does the bundle recipe find the consumed bytes of a
  module whose import has a suffix?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Fail such an import early with a `bundle-failed` diagnostic that
    names the importer and the suffix. The bundle still fails, but the
    message tells the user what to change. Effort: Small.
  - **C.** Remove the suffix when `moduleGraph` maps a metafile input to its
    logical name and its physical path. The recipe then finds the recorded
    bytes, and the watch inputs name a real file. Effort: Small.
- **Left out:** A separate module for each suffix of one file. Mokly runs no
  loader that reads a suffix, so the bytes are equal, and C is simpler on
  every point.
- **Wider fix:** C. One mapping from a metafile input to its file
  then serves the graph, the digests, and the watch inputs, as `clean`
  already does for the `mokly-css:` namespace.
- **Previous examples:** None found.
- **Recommendation:** C. It makes a valid esbuild import bundle
  and keeps the digest rule of the bundling contract.
- **Action:** fix after merge, apply C, because a valid import
  fails with an internal error, which is a product bug, and C is Small.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L413).
