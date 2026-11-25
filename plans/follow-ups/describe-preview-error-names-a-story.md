# Describe blames a story for preview errors

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, finding 3 of round 1.
- **Location:** `packages/mokly/src/sidecar/describe.ts:184-195`, the loop over
  the stories files, which makes each stories file the error source of
  `withSource` while Storybook composes it, and `:32-44`, `withSource`.
  `packages/mokly/src/sidecar/story-reader.ts:73`, where
  `setProjectAnnotations` reads the settings of the preview file.
  `packages/mokly/src/sidecar/bundle-entry.ts:62-65`, where the virtual entry
  exports the selected preview module. `docs/protocol/mokly-sidecar.md:202`,
  the `bundle-failed` row of the fail-closed rules.
- **Reason:** The build already stops with `bundle-failed` for such an error,
  so only the named file is wrong, and the fix costs the same after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Describe:** the sidecar request that collects the catalogue definitions
    from the evaluated entry modules and stories files of one bundle
    generation.
  - **Preview file:** the `.storybook/preview.*` file of the source root. Its
    settings, such as `args`, `argTypes`, decorators, and enhancers, apply to
    every story.
  - **Project composition:** Storybook's `setProjectAnnotations` and
    `composeStories`, which read the settings of the preview file and compose
    each story with them.
- **Background:**
  - `describe` walks the stories files of a generation once. For each file, it
    makes that file the error source, and then reads the file's stories
    through the project composition.
  - When collection throws, `describe` fails with `bundle-failed` and the
    message `{source}: {detail}`.
  - The project composition reads the settings of the preview file while it
    composes each stories file. So an error in a preview setting comes out of
    the composition of the first stories file.
  - The fail-closed rules of `docs/protocol/mokly-sidecar.md` say that
    `bundle-failed` gives `build-invalid` with the module and the diagnostic.
  - The virtual entry of the bundle, in `bundle-entry.ts`, imports the selected
    preview file and exports its module as `preview`. It does not export the
    path of that file.
  - The fix must also work when one generation holds more than one preview
    file, one for each Storybook folder.
- **Problem:** An error in a preview setting names the first stories file.
  Probes against the sidecar build of commit `59cc768f6`, with Storybook 10.6.2
  and two stories files, put a throwing getter on the preview's `args`,
  `argTypesEnhancers`, or `argsEnhancers`. Each failure named the first
  stories file, for example `One.stories.js: Shared preview args failed`.
- **Impact if no action:** An author looks for the error in the first stories
  file, while it is in the shared preview file.
- **Root question:** How can an author locate the source of a shared preview
  error?
- **Options:**
  - **A.** Label the errors of the project composition as preview errors, and
    give the current stories file as context. The message then points to the
    preview even when its path is not known. Effort: Small.
  - **B.** Carry the selected preview path with the evaluated preview exports,
    and use it as the error source during the project composition. Use the
    phase label when the path is not known. Effort: Medium.
  - **C.** Compose the preview once, in its own step before the loop over the
    stories files, with the path of the preview file as the error source. The
    virtual entry exports that path beside `preview`. Effort: Small, because
    `describe` already walks each stories file once with a local source
    helper.
  - **D.** Name the module whose code threw, from the stack of the error and
    the module map of the bundle. Effort: Large.
- **Left out:** A general stack trace alone can show only a place in the
  bundled code. Each option gives a source at the point where collection
  fails.
- **Wider fix:** D. It names the failing module for every step, so no step can
  name a wrong file. It also fixes
  `plans/follow-ups/evaluate-failure-names-every-file.md`.
- **Previous examples:** Commit `d0ec9e6ec` recorded the earlier collection
  error, which listed every story and entry file. Commit `b741db86d` made
  `describe` name the failing module, and this case is the one that it still
  names wrong.
- **Related:** `plans/follow-ups/evaluate-failure-names-every-file.md`, the
  same class at the bundle evaluation: its failure lists every input file and
  leaves out the preview. D of this item fixes both. Neither fix waits for the
  other.
- **Recommendation:** C. One step composes the preview, so its errors name the
  preview file, and the change stays Small on the one-walk `describe`. Test a
  throwing preview setting, which must name the preview file, apart from a
  throwing story, which must name its stories file. D best protects the
  codebase, because it names the failing module for every step.
- **Action:** fix after merge, apply C, because it is a Low product bug with
  the likelihood Rare, and its fix does not get harder after the merge.
