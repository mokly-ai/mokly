# Story errors hide fatal cleanup errors

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, finding 12 of round 2,
  with the options and the facts of its finding check.
- **Location:**
  - `packages/mokly/src/sidecar/story-render.ts`: `runCleanups`, which runs
    the `beforeEach` cleanups of one story render. `renderStoredStory`, which
    calls it after the markup, also when the story's own work throws. The
    `story.load()` call in `prepareStory`, which runs the loaders.
    `renderStory`, which decides whether an error gives a failed view or
    stops the build.
  - `node_modules/storybook/dist/_browser-chunks/chunk-M6YZR3ZW.js:760`, in
    Storybook 10.6.2: Storybook's own `applyLoaders`, which runs the loaders
    of each level under `Promise.all`.
  - `docs/protocol/mokly-storybook-setup.md`, section "Setup Before Render":
    the cleanup rules.
  - `docs/protocol/mokly-storybook-failures.md`, section "Failed Views": the
    rule that each error of Mokly's own code stops the build.
- **Reason:** The recommended option changes the setup rule in force that a
  failed render keeps its own error, and no user decision covers that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Story's own work:** the composition of a Storybook story, the preview's
    `beforeAll` hook, the loaders, the `beforeEach` hooks, their cleanups, and
    the render.
  - **Failed view:** a saved view whose story's own work throws, which Mokly
    shows as an error document with a `story-render-failed` warning while the
    build goes on.
  - **Mokly's own code:** the code of `@mokly/mokly` that runs in a render,
    such as the `Component` wrapper of a registered component and `mockLink`,
    and Mokly's checks of the rendered output.
  - **Fatal error:** an error of Mokly's own code, which stops the build with
    its Mokly code, such as `unknown-link-definition`, or with `render-failed`.
  - **Cleanup:** a function that a `beforeEach` hook returns to undo its work
    after the render.
- **Background:**
  - Section "Failed Views" of `docs/protocol/mokly-storybook-failures.md` says
    that an error of the story's own work gives a failed view. It also says
    that each error of Mokly's own code stops the build, and that an error
    with a Mokly code keeps that code.
  - Track F of the Storybook support plan made the second rule on 2026-11-25,
    in its review fixes of rounds 1 and 2. The user chose on 2026-11-06 that
    a story that cannot render gives a failed view in place of a stopped
    build.
  - Section "Setup Before Render" of `docs/protocol/mokly-storybook-setup.md`
    says that the sidecar runs the cleanups in reverse order after the
    markup, also when a loader, a hook, or the render throws. It also says:
    "A `beforeEach` cleanup that throws fails its own render. When the render
    already failed, it keeps its own error."
  - Commit `28f41dab4`, "fix(sidecar): give story setup the render args and
    release it per render", wrote that rule before track F. The commit
    applied the user's choice that each story render runs its own
    `beforeEach` cleanups. That choice does not say which error a failed
    render keeps.
  - So the two pages disagree when a cleanup raises a fatal error after the
    story's own work failed. The failures page says that the build stops. The
    setup page says that the render keeps its earlier error, which gives a
    failed view.
  - `runCleanups` runs every cleanup and keeps the first error in execution
    order. It throws that error only when the render did not fail.
  - `renderStory` rethrows an error with a Mokly code, which is a
    `SidecarError`. Each other error of the story's own work gives a failed
    view. The review fix of round 2 marks each error of Mokly's own code where
    Mokly raises it, and `renderStory` rethrows a marked error too. This mark
    tells a fatal error from an ordinary one, so it gives option B its test.
  - A loader is a Storybook function that loads data before the render.
    Storybook runs the loaders of each level, the preview, the meta, and the
    story, under one `Promise.all`. `Promise.all` rejects with the first
    rejection and drops each later one.
- **Problem:** A cleanup can call `mockLink` on a definition that no entry
  module exports, which raises `unknown-link-definition`. `runCleanups` drops
  that error when the story's own work already threw. It also drops it when
  an earlier cleanup in execution order threw an ordinary error. In the same
  way, a fatal loader error that rejects after an ordinary loader error of
  the same level is lost inside Storybook, so the story gives a failed view.
- **Impact if no action:** A non-strict build or publication can publish a
  failed view and hide a catalogue error that must stop the build. The setup
  page and the failures page keep their conflict.
- **Root question:** Which error decides the outcome when the story's own work
  and Mokly's own code both fail in one story render?
- **Options:**
  - **A.** Keep the first fatal cleanup error. Give it priority when the
    earlier error would give a failed view. Loaders keep their current
    behaviour, and the setup page names the exception. Effort: Small.
  - **B.** Give the render, the loaders, and the cleanups one rule that
    selects the error. Run every cleanup, prefer a fatal error, and keep the
    first error of each class. To see each loader's error, the story reader
    wraps each loader, as it already wraps each `beforeEach` hook. The setup
    page and the failures page state the rule. Effort: Medium.
  - **C.** Collect the errors of every phase, and select the reported error
    where the sidecar answers the request. This keeps more internal error
    data than B. Effort: Medium.
  - **D.** Record the first fatal error on the render session where Mokly
    raises it. The helper that marks each error of Mokly's own code can write
    the record. After the story's own work, a recorded error stops the render,
    whatever error escaped. This also covers an error that Storybook, React,
    or author code drops, and it stops the build also for a fatal error that
    author code catches. Effort: Medium.
  - **E.** Keep the code, and change section "Failed Views" of the failures
    page: the first error decides. A fatal error after an ordinary error of
    the story's own work then gives a failed view. This matches the current
    code, also for the loaders. Effort: Small.
- **Left out:**
  - Use the last cleanup error: an ordinary cleanup error could then hide a
    fatal render error.
  - Change nothing: the two pages keep their conflict, and a fatal error can
    pass a non-strict build.
- **Wider fix:** D. A record where Mokly raises the error does not depend on
  which error escapes, so it covers each place that drops an error.
- **Previous examples:**
  - The setup test
    `throwing beforeEach cleanups fail their own render and each cleanup runs once`
    in `tests/sidecar_storybook_setup.test.ts:193` checks the cleanup order
    and the first ordinary cleanup error.
  - Section "Shared Render Runtime" of
    `docs/protocol/mokly-base-preparation.md:106` gives a fatal failure inside
    a grouped attempt priority over recoverable historical validation.
- **Related:** `plans/follow-ups/suspense-hides-mokly-render-errors.md`, a
  shared wider fix: option D here also records a fatal error that React drops
  inside a Suspense boundary. Neither fix waits for the other.
- **Recommendation:** B. It keeps the fatal result and the order of the
  ordinary errors, and the mark of Mokly's own errors gives it its test. D
  best protects the codebase, because it also covers errors that Storybook,
  React, or author code drops.
- **Action:** ask the user, because option B changes the setup rule in force
  that a failed render keeps its own error, in section "Setup Before Render"
  of `docs/protocol/mokly-storybook-setup.md`, and no user decision covers
  that change. Option E instead changes the rule of section "Failed Views" of
  `docs/protocol/mokly-storybook-failures.md`.
