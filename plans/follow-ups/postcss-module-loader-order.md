# Align the PostCSS module loader choice with the bundle

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The options checks of its decisions C1 and C2 found the
  problem on 2026-11-18.
- **Location:** `packages/mokly/src/sidecar/postcss-source.ts:15-37`.
- **Reason:** The PostCSS files are outside the files that track C may
  change.

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
    hook of `packages/mokly/src/sidecar/plugins.ts`. There an import
    attribute wins first, except for a CSS import, which stays a stylesheet.
    A consumer loader by its longest key comes next, then Mokly's own
    loaders for JavaScript, TypeScript, and JSON, then the asset default.
    A consumer `file` loader gives the asset delivery for the delivered
    types and `.txt`, and fails for every other type with the message that
    `docs/protocol/mokly-imported-styles-errors.md` gives.
    `docs/protocol/mokly-imported-assets.md` states this order.
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
  - **B.** Give the PostCSS module compile the loader order of the bundle:
    the import attribute, then a consumer loader by its longest key, then
    Mokly's own loaders. A `file` loader there fails with the message of the
    bundle, because that compile delivers no file. Effort: Small.
  - **C.** Move the loader choice into one module that both compiles call. A
    later change of the order then reaches both compiles. Effort: Medium.
- **Left out:** Deliver a file from the PostCSS module compile: that compile
  renders no document, so a URL has no use there.
- **Wider fix:** C. One loader choice for both compiles prevents the next
  difference between them.
- **Previous examples:** None found.
- **Related:** On 2026-11-23 the orchestrator of the Storybook support plan
  answered its decisions C1 and C2 as design calls. An import attribute wins
  over every loader except for a CSS import. A `file` loader gives the asset
  delivery for the delivered types and `.txt`, and fails for other types.
  These answers set the order that B and C copy.
- **Recommendation:** C. Both compiles then give one configuration the same
  value.
- **Action:** fix after merge, apply C, because the PostCSS files are outside
  the files of track C, and C1 and C2 now set the order.
