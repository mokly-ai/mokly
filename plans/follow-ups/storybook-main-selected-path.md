# Checked and loaded `main.*` files can differ

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, finding 5.
- **Location:** `packages/mokly/src/sidecar/storybook-main.ts:151`, where
  `findMain` selects the first candidate that is a regular file.
  `packages/mokly/src/sidecar/storybook-main.ts:184`, where `loadMain` checks
  that the selected file resolves inside the source root.
  `packages/mokly/src/sidecar/storybook-main-worker.ts:48` and line 56, where
  the worker gives Storybook an extensionless name.
  `docs/protocol/mokly-storybook.md:52`, which says that Mokly finds `main.*`
  as Storybook does.
- **Reason:** Storybook itself rejects the folder layout that shows the
  defect, so only the message misleads, and the fix can wait for a later
  branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`main.*`:** The Storybook configuration file of a Storybook folder.
    Mokly runs it with Storybook's loader to read `stories` and `framework`.
  - **Main candidate:** One name, such as `main.js` or `main.ts`, that Mokly
    checks for `main.*`, in Storybook's extension order.
- **Background:**
  - The section "Storybook Folders" of `docs/protocol/mokly-storybook.md`
    says that Mokly finds the `main.*` file of a Storybook folder as
    Storybook does. The extension order is `.js`, `.ts`, `.jsx`, `.tsx`,
    `.mjs`, `.mts`, `.mtsx`, `.cjs`, `.cts`, and `.ctsx`.
  - `findMain` selects the first candidate that is a regular file.
    `loadMain` checks that this file resolves inside the source root before
    the file runs. The `main` result of `readStorybook` and the configuration
    diagnostic name this file, under the section "Storybook" of
    `docs/protocol/mokly-sidecar.md`.
  - The worker then gives Storybook the extensionless name `{folder}/main`,
    through `getInterpretedFile` and `serverRequire`. Storybook selects the
    file again. Its `getInterpretedFile` takes the first candidate for which
    `existsSync` is true, also a directory.
  - Mokly selects a preview file with the regular-file rule, as `findMain`
    does.
  - Storybook 10.6.2 picks the same directory in its own `loadMainConfig`,
    and it fails there. So the layout below is not a valid Storybook
    configuration, and no work is blocked.
  - The two calls that load `main.*`, discovery and the framework fallback of
    `bundle`, use the same worker request. On 2026-11-28 the branch that
    found this item made both calls send the side's resolution settings in
    that request.
- **Problem:** When `main.js` is an empty directory beside a valid `main.ts`,
  Mokly checks and reports `main.ts`, and Storybook's loader tries the
  directory. The `config-invalid` or `bundle-failed` message then starts with
  `main.ts`, and its detail names the directory.
- **Screenshot:** In the Build terminal for that folder, box the
  `config-invalid` diagnostic that names `main.ts`.
- **Impact if no action:** The message sends the author to the wrong file. The
  file that Mokly checks for confinement is not the file that Storybook tries
  to load.
- **Root question:** How does Mokly guarantee that the `main.*` file that it
  checks and reports is the file that it runs?
- **Options:**
  - **A.** Give Storybook's `importModule` the checked file name, in both
    calls that load `main.*`. Add a case with a higher-priority `main.js`
    directory and a valid `main.ts`. Add one sentence near
    `docs/protocol/mokly-storybook.md:52`: Mokly skips a `main.*` candidate
    that is not a regular file, as it does for `preview.*`. Cost: such a
    layout then loads `main.ts` in Mokly, where Storybook 10.6.2 fails.
    Effort: Small.
  - **B.** Make the worker select, check, and import the exact file, and
    return its path with the evidence of the other candidates. This moves the
    candidate bookkeeping out of the parent. Effort: Medium.
  - **C.** Use Storybook's existence check as the only selector, and report an
    invalid higher-priority candidate by its own name. The directory is then
    a configuration error, which needs a contract decision. Effort: Medium.
  - **D.** Select once in the worker, with the installed Storybook:
    - Take the path from `getInterpretedFile`. Check that it resolves inside
      the source root, record it, load it with `importModule`, and return it
      as `main`, also in the error message.
    - Take the names of the absent candidates from Storybook's
      `supportedExtensions`.
    - The layout then fails as in Storybook, and the message names `main.js`.
    - It needs no protocol change, because the protocol already says that
      Mokly finds `main.*` as Storybook does.
    - Cost: the `main.*` and `preview.*` rules then differ for an entry that
      is not a regular file. The "no main file found" error comes after the
      lookup of the `storybook` package.
    - Effort: Medium.
- **Left out:**
  - Compare the file names after the load. An unchecked file then runs
    first.
  - Compare Mokly's selection with `getInterpretedFile` before the load.
    `serverRequire` still selects again inside Storybook, so A and D are
    better on every point.
  - Select and load with Storybook's `loadMainConfig`. It selects again with
    `getInterpretedFile`, and its ES module fallback writes a `main.tmp.*`
    file into the Storybook folder. The section "Rendering" of
    `docs/protocol/mokly-html-screens.md` says that rendering writes nothing
    to the repository.
  - One atomic check and load. Node's loader opens the path again, so B only
    makes that window shorter.
- **Wider fix:** A, for every load of `main.*` through Storybook. One worker
  entry point takes the selected path. A later preset load then gives that
  path to `getPresets` and does not call `loadAllPresets`, which selects
  `main.*` again.
- **Previous examples:** Commit `4614c4a90` kept one resolved file name for the
  renderer and the PostCSS module.
- **Related:** `plans/follow-ups/storybook-stories-function-not-read.md`:
  options that conflict. Its option B loads Storybook's presets, and
  `loadAllPresets` selects `main.*` again with `getInterpretedFile`. Under A,
  B, or D here, that preset load must give the selected path to `getPresets`.
- **Recommendation:** D, changed from A by the orchestrator on 2026-11-28.
  D keeps the rule that Mokly finds `main.*` as Storybook does, so the
  reported layout fails as it does in Storybook and the message names the
  file that Storybook picks. A adds an exception to that rule, which needs a
  user decision.
- **Action:** fix after merge, apply D, because the product bug is Rare and
  of Medium severity: Storybook rejects the same layout, so only the message
  misleads.
