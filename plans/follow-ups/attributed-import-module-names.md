# Bundle one file imported with and without an attribute

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The options check of its decision C2 found the problem on
  2026-11-18.
- **Location:** `packages/mokly/src/sidecar/bundle-graph.ts:15-28` and
  `packages/mokly/src/sidecar/bundle-recipe.ts:74-77`.
- **Reason:** The failure exists before track C, and the module graph files
  are outside the files that track C may change.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Import attribute:** the `with { type: ... }` part of an import, such
    as `import text from "./icon.svg" with { type: "text" }`. esbuild
    supports the types `json`, `text`, and `bytes`.
  - **Module graph:** the list of modules that the sidecar reports for one
    bundle. `moduleGraph` in `bundle-graph.ts` builds it from the esbuild
    metafile. Each module has a logical path, a digest, and its imports.
  - **Asset import:** an import of an image, font, or media file. Mokly
    delivers the file and gives the component a URL, under
    `docs/protocol/mokly-imported-assets.md`.
- **Background:**
  - esbuild loads a file once for each set of import attributes. Its
    metafile names the second load `d.json with { type: 'text' }`, not
    `d.json`.
  - `moduleGraph` turns each metafile input into a logical path and a
    physical path. Its helper `clean` at line 15 removes only the
    `mokly-css:` namespace, so the decorated name becomes a path.
  - The `onLoad` hook in `packages/mokly/src/sidecar/plugins.ts` records
    the bytes of each loaded file under its real path.
  - At `bundle-recipe.ts:74-77`, the recipe looks up the recorded bytes of
    each module under its physical path. A missing entry fails the bundle.
  - The bundling contract in `docs/protocol/mokly-sidecar.md` requires the
    module graph to report the digest of the bytes of each module.
  - Asset imports make this case more common. An SVG can give a URL in one
    module and its text in another.
- **Problem:** When a bundle imports one file both with and without an
  import attribute, the bundle fails with "Bundled source bytes were not
  recorded". An options check reproduced it on 2026-11-18 with a JSON file
  that one module imports plainly and another with `type: "text"`.
- **Impact if no action:** The whole catalogue fails to bundle. The message
  names an internal record, not the import, so the author cannot find the
  cause.
- **Root question:** How does the module graph name and digest a file that
  esbuild loads more than once, with different import attributes?
- **Options:**
  - **A.** Change nothing. Authors import each file in one way only.
    Effort: Small.
  - **B.** Fail such an import early with a `bundle-failed` message that
    names both importers and the attribute. The bundle still fails, but the
    author can act. Effort: Small.
  - **C.** Map each decorated metafile input to its file. The module graph
    then lists the file once, with the digest of its bytes and the imports
    of each load. Watch and the render keys follow the real file. Effort:
    Medium.
- **Left out:** A separate logical module for each attribute: its logical
  path names no file, and watch and source protection need a real path.
- **Wider fix:** C. One mapping from a metafile input to its file serves the
  graph, the digests, and the watch inputs. The same mapping fixes the
  suffix case of
  [bundle-recipe-query-suffix.md](bundle-recipe-query-suffix.md).
- **Previous examples:**
  [bundle-recipe-query-suffix.md](bundle-recipe-query-suffix.md), where an
  import with a `?query` or `#hash` suffix fails with the same message.
- **Related:**
  - [bundle-recipe-query-suffix.md](bundle-recipe-query-suffix.md) has the
    same cause: a metafile input name that holds more than its path. One
    branch can fix both items with option C of each.
  - No option of the open decisions C1 and C2 of the Storybook support plan
    covers this problem. C2 asks which wins when an import names its type:
    the attribute, or a rule for its file extension. Its answer changes the
    value of such an import, not its module name. C1 decides what a
    configured `file` loader does.
- **Recommendation:** C. A valid esbuild import then bundles, and the digest
  rule of the bundling contract holds.
- **Action:** fix after merge, apply C, because the failure exists before
  track C and the module graph files are outside its scope.
