# Align the PostCSS module loader choice with the bundle

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The options checks of its decisions C1 and C2 found the
  problem on 2026-11-18.
- **Location:** `packages/mokly/src/sidecar/postcss-source.ts:15-37`.
- **Reason:** The PostCSS files are outside the files that track C may
  change, and the loader order to share depends on two open decisions.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **PostCSS module compile:** the esbuild compile that loads the
    consumer's PostCSS module, which `postcss` in `mokly.config.json` names,
    and the local modules that it imports. `postcssSource` in
    `postcss-source.ts` chooses the loader of each file there.
  - **Consumer loader:** an entry of `moduleResolution.loaders` in
    `mokly.config.json`, such as `".json": "text"`.
  - **Import attribute:** the `with { type: ... }` part of an import. esbuild
    supports the types `json`, `text`, and `bytes`, and it applies the
    attribute before the loader of the extension.
- **Background:**
  - The bundle of entries and components chooses a loader in the `onLoad`
    hook of `packages/mokly/src/sidecar/plugins.ts`. There a consumer
    loader wins over Mokly's own loaders for JavaScript, TypeScript, and
    JSON.
  - `postcssSource`, at lines 30-32, tries Mokly's own loaders by the last
    extension first. It tries the consumer loader with the longest key
    second.
  - It gives a consumer `file` loader to esbuild. That compile writes no
    output folder. A plain esbuild run with the same options gave the asset
    bytes as its first output, not the code.
  - It ignores an import attribute when a Mokly loader or a consumer key
    matches the file.
- **Problem:** One configuration gives a file different values in the two
  compiles. For example, `".json": "text"` gives text in the bundle and
  parsed JSON in the PostCSS module compile. A `file` loader gives broken
  code in the PostCSS module compile.
- **Impact if no action:** A PostCSS module that imports such a file gets
  another value than the components get, or fails with an unclear error.
- **Root question:** Which loader rules apply when the PostCSS module
  compile loads a file?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Give the PostCSS module compile the loader order of the bundle: a
    consumer loader by its longest key, then Mokly's own loaders, then the
    import attribute. A `file` loader there fails with the message of the
    bundle. Effort: Small.
  - **C.** Move the loader choice into one module that both compiles call. A
    later change of the order then reaches both compiles. Effort: Medium.
- **Left out:** Deliver a file from the PostCSS module compile: that compile
  renders no document, so a URL has no use there.
- **Wider fix:** C. One loader choice for both compiles prevents the next
  difference between them.
- **Previous examples:** None found.
- **Related:** Two decisions of the Storybook support plan, both open on
  2026-11-20, decide the order that B and C copy:
  - Decision C1 asks what a configured `file` loader does, now that Mokly
    delivers imported files itself. Its options change only the bundle, so
    none of them covers this compile.
  - Decision C2 asks which wins when an import names its type: the
    attribute, or a rule for its file extension. Its option E gives each
    esbuild compile of Mokly one shared attribute rule, also the PostCSS
    module compile. Option E covers the attribute part of this problem.
- **Recommendation:** C, after the answers to C1 and C2. Both compiles then
  give one configuration the same value.
- **Action:** ask the user, because the order that C shares depends on the
  answers to the open decisions C1 and C2.
