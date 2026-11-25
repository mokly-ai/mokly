# The esbuild entry imports previews as namespaces

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, finding 6 of round 2. The final
  call split the finding: that branch applied option A in the story reader,
  and this item holds option C.
- **Location:** `packages/mokly/src/sidecar/bundle-entry.ts:62-65`, where the
  virtual entry loads the selected preview with a namespace import.
  `packages/mokly/src/sidecar/story-reader.ts:162-174`, `unwrapPreview`, the
  direct fix in the reader. `packages/mokly/src/sidecar/native-plan.ts:104` and
  `packages/mokly/src/sidecar/planned-relative.ts:86` and `:111`, which treat a
  `require-call` edge apart from an `import-statement` edge.
- **Reason:** `bundle-entry.ts` is outside the scope of the branch that found
  the problem, and the fixed preview path in that file is due to give way to
  the preview file of each root's Storybook folder.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Virtual entry:** the generated module that imports every entry module,
    stories file, the renderer, and the selected `.storybook/preview.*` file,
    and exports them to the sidecar.
  - **Namespace import:** `import * as preview from "..."`, which gives an
    object with the module's exports.
  - **esbuild CommonJS wrapper:** the code by which esbuild turns a CommonJS
    module into a namespace. Without an `__esModule` flag, it puts the whole
    `module.exports` object under a read-only `default` property.
- **Background:**
  - The esbuild adapter compiles the catalogue modules into one CommonJS
    bundle through the virtual entry of `bundle-entry.ts`. The entry loads the
    selected preview file with `import * as preview from ...; export { preview };`.
  - Storybook 10.6.2 reads the settings of a preview module field by field:
    first from its default export, then from its named exports. The story
    reader gives Storybook the whole preview module.
  - For a CommonJS preview that assigns `exports.default` without
    `__esModule`, the esbuild wrapper (esbuild v0.28.2,
    `internal/runtime/runtime.go` lines 249 to 264) puts the whole exports
    object under `default`. Storybook then looks one level too high and finds
    no default settings.
  - The branch that found the problem fixed it in the story reader:
    `unwrapPreview` uses the object under `default` as the preview module when
    that property is read-only and its value has its own `default`.
  - The Vite adapter has no CommonJS preview, because its module runner gives
    no `exports`.
- **Problem:** At commit `c2fdac1ce`, a CommonJS preview with `exports.default`
  lost its default loader and its `initialGlobals`. An in-memory probe with
  this import shape showed that the base branch ran the default loader and
  applied the initial globals, and that `c2fdac1ce` dropped both. The reader
  fix recognizes the wrapper by its shape. Every other reader of the preview
  module must repeat that rule.
- **Impact if no action:** A later reader of the preview module, such as the
  preview of each Storybook folder, can lose the default settings of a
  CommonJS preview again, and views then publish a wrong theme or miss loader
  data.
- **Root question:** Which form of the evaluated preview file does Mokly give
  to Storybook, so that Storybook reads the same default and named settings
  from a CommonJS file as from an ES module?
- **Options:**
  - **A.** Normalize CommonJS preview exports in the story reader, and keep
    the default and named settings. Add a regression fixture with
    `exports.default`. The branch that found the problem applied A. Effort:
    Small.
  - **B.** Normalize the preview exports at both bundle adapters, and give the
    reader one form of the default and named settings. This reaches both
    compilation paths. Effort: Medium.
  - **C.** On the esbuild adapter, load the preview with
    `export const preview = require(...)` in the virtual entry, and keep the
    namespace import when the Vite adapter compiles, that is when
    `params.vite` is set. `require` gives `module.exports` for a CommonJS file
    and an `__esModule` namespace for an ES module, so Storybook reads either
    one directly. A probe with esbuild 0.28.2 and Storybook 10.6.2 kept the
    loader and `initialGlobals` for six module shapes, and also for a
    CommonJS `exports.default = definePreview(...)`. Risk: the edge of the
    preview changes from `import-statement` to `require-call` in the
    resolution plans and in the recipe identities. Effort: Small.
- **Left out:** A rule that requires `.storybook/main` drops preview-only
  projects. Giving Storybook both the namespace and its default applies the
  decorators twice.
- **Wider fix:** C. The esbuild entry gives every reader the form of the module
  that Storybook expects, so no reader needs a wrapper rule.
- **Previous examples:** Commit `fa9b18de2` normalized CommonJS exports for the
  Vite configuration, in `packages/mokly/src/sidecar/vite-config-bundle.ts:158-166`.
- **Related:**
  - `plans/follow-ups/storybook-preview-candidates-miss-extensions.md`, the
    same file and the same preview selection.
  - `plans/follow-ups/describe-preview-error-names-a-story.md`, the same entry
    line: its option C exports the preview path beside `preview`.
  - Neither fix waits for the other. All three fit the change that gives each
    root its own Storybook folder.
- **Recommendation:** C. One line of the entry removes the wrapper at its
  source, and the probe covered the known shapes. Test the edge change in the
  resolution plans. When C lands, remove `unwrapPreview` from the reader,
  because the reader then gets no wrapper.
- **Action:** fix after merge, apply C, because `bundle-entry.ts` is outside
  the scope of the branch that found the problem, and the preview path in that
  file is due to change.
