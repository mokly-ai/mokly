# Mokly misses previews that Storybook finds

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, round 2, outside the scope.
- **Location:** `packages/mokly/src/sidecar/bundle-entry.ts:12-15`,
  `previewCandidates`, and its users `bundle-entry.ts:39-57`, `compiled.ts:72`,
  `vite-metadata.ts:30`, and `bundle-recipe.ts:105`.
  `crates/mokly-graph/src/render_inputs.rs:17-25`, `PREVIEWS`, the copy of the
  list that `render_preparation.rs` reads. `docs/protocol/mokly-storybook.md:8`,
  which says that the sidecar applies the consumer's `.storybook/preview`
  annotations.
- **Reason:** The code is older than the branch that found it, and that branch
  did not change the preview lookup.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Preview file:** the `.storybook/preview.*` file of the source root, whose
    settings, such as decorators, globals, loaders, and parameters, apply to
    every story.
  - **Preview candidates:** the paths of `.storybook/preview.*` that Mokly
    tries, in order. The bundle recipe hashes each one, also when it is
    absent, so that a new preview file starts a new bundle.
- **Background:**
  - Storybook 10.6.2 finds the preview file with `getInterpretedFile` over
    `storybookConfigExtensions`: `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.mts`,
    `.mtsx`, `.cjs`, `.cts`, and `.ctsx`, in that order. It takes the first
    file that exists.
  - Mokly tries `.tsx`, `.ts`, `.jsx`, `.js`, `.mjs`, and `.cjs`, in that
    order. The sidecar list and the core's copy, `PREVIEWS`, hold the same
    paths.
  - The Storybook page says that the sidecar applies the consumer's
    `.storybook/preview` annotations once to each story. It names no
    extension.
  - esbuild compiles `.mts` and `.cts` files with its TypeScript loader by
    default. `.mtsx` and `.ctsx` need a loader mapping, such as the `tsx`
    loader.
- **Problem:** A project whose preview file is `.storybook/preview.mts`,
  `.cts`, `.mtsx`, or `.ctsx` gets no preview settings in Mokly, and no
  warning. A folder with two preview files, such as `preview.js` and
  `preview.tsx`, gives Mokly another file than Storybook: Mokly takes the
  `.tsx` file, and Storybook takes the `.js` file.
- **Impact if no action:** Stories render without the preview's decorators,
  globals, loaders, and parameters, so views can publish a wrong theme or
  layout, with no hint.
- **Root question:** How does Mokly choose the same preview file that
  Storybook chooses?
- **Options:**
  - **A.** Use Storybook's extension list and order in both lists, the
    sidecar's `previewCandidates` and the core's `PREVIEWS`, and map `.mtsx`
    and `.ctsx` to esbuild's `tsx` loader. The recipe identities change once.
    Effort: Medium.
  - **B.** Let the sidecar ask Storybook's `getInterpretedFile` for the preview
    file, and send the chosen path to the core. Storybook's rule then lives in
    one place. The core must still hash the absent candidates, so that a new
    preview file starts a new bundle. Effort: Large.
  - **C.** Keep one shared list for the sidecar and the core, such as a
    generated constant, with Storybook's order. The two copies then cannot
    drift, but the list can still drift from Storybook. Effort: Medium.
- **Left out:** A warning for a preview file that Mokly does not read: A finds
  the file instead, and a new warning needs the user's approval.
- **Wider fix:** B. Mokly then reads the preview file that Storybook reads, also
  when a later Storybook version changes the rule.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/fallback-keys-checkout-folder.md` names `PREVIEWS` in
    `render_inputs.rs`. Keep its facts right when the list changes.
  - `plans/follow-ups/storybook-preview-entry-requires-commonjs.md`, the same
    file, `bundle-entry.ts`, and the same preview selection.
  - The fixed `.storybook` folder is due to give way to the Storybook folder of
    each root. Make this fix with that change, or before it.
- **Recommendation:** A. It reads the files that Storybook reads today, with
  the lists that exist. B best protects the codebase, because it keeps the rule
  in Storybook.
- **Action:** fix after merge, apply A, because the problem is outside the
  scope of the branch that found it.
