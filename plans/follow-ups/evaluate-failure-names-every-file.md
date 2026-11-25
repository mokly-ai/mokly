# Evaluation failures list every file but the preview

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, round 1, outside the scope.
- **Location:** `packages/mokly/src/sidecar/evaluate.ts:71-75`, the `catch`
  block of the bundle evaluation. `packages/mokly/src/sidecar/bundle-entry.ts:62-65`,
  where the virtual entry imports the selected preview file.
  `packages/mokly/src/sidecar/bundle.ts:211-216`, where the bundle keeps the
  selected preview path in its capture state, not in the generation.
  `docs/protocol/mokly-sidecar.md:202`, the `bundle-failed` row of the
  fail-closed rules.
- **Reason:** The code is older than the branch that found it, and that branch
  did not change the bundle evaluation.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Bundle evaluation:** the one run of a generation's compiled bundle in
    the sidecar, with `new Function`, which gives the exports of every module.
  - **Virtual entry:** the generated module that imports every entry module,
    stories file, the renderer, and the selected preview file, and exports
    them to the sidecar.
  - **Preview file:** the `.storybook/preview.*` file of the source root, whose
    settings apply to every story.
- **Background:**
  - The sidecar compiles the entry modules, the stories files, the renderer,
    and the selected preview file into one CommonJS bundle through the virtual
    entry of `bundle-entry.ts`. It evaluates the bundle once, in
    `evaluate.ts`.
  - When the evaluation throws, the sidecar fails with `bundle-failed`. The
    message is the entry files, the stories files, and the renderer, joined
    with commas, then `: ` and the error detail.
  - The fail-closed rules of `docs/protocol/mokly-sidecar.md` say that
    `bundle-failed` gives `build-invalid` with the module and the diagnostic.
  - The bundle keeps the selected preview path in its capture state and its
    recipe. The `Generation` that `evaluate.ts` reads does not hold it.
- **Problem:** The message does not say which module threw. It lists every
  input file, and it leaves out the selected preview file, so a top-level
  error in the preview file never names that file.
- **Impact if no action:** With many files, the author cannot tell which
  module failed. A preview error names every input file except the preview.
- **Root question:** How does a failed bundle evaluation lead the author to
  the module whose code threw?
- **Options:**
  - **A.** Keep the selected preview path on the generation, and add it to the
    file list of the message. The list then holds every module that the
    bundle evaluates, but it still does not pick out the failing one. Effort:
    Small.
  - **B.** Make the virtual entry load each input module inside its own guard,
    so that the entry knows which input threw. This changes how the entry
    imports the modules, so it must keep the namespace exports that `describe`
    and the renders read. Effort: Medium.
  - **C.** Name the module whose code threw, from the stack of the error and
    the module map of the bundle, and keep the file list as the fallback when
    no frame maps to a module. Effort: Large.
- **Left out:** One bundle for each module: it breaks the shared module
  instances of one generation.
- **Wider fix:** C. It names the failing module for every error, also in
  `describe`, so no step can name a wrong file.
- **Previous examples:** Commit `b741db86d` made `describe` name the failing
  module in place of every file. Commit `d0ec9e6ec` recorded the earlier
  `describe` error, which listed every story and entry file.
- **Related:** `plans/follow-ups/describe-preview-error-names-a-story.md`, the
  same class in `describe`: an error in a preview setting names the first
  stories file. Its wider fix, which names the module from the stack and the
  module map of the bundle, also fixes this item. Neither fix waits for the
  other.
- **Recommendation:** A. It is Small, and the list then names the preview file
  for a preview error. C best protects the codebase, and one change can serve
  both items.
- **Action:** fix after merge, apply A, because the problem is outside the
  scope of the branch that found it.
