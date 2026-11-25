# Tailwind source edits reload the whole setup

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding checks of findings 107 and 134 found.
- **Location:** `packages/mokly/src/sidecar/vite-context.ts:113`,
  `tests/sidecar_vite_incremental.test.ts:121`, and the reload rule at
  `docs/protocol/mokly-vite-adapter-inputs.md:26`.
- **Reason:** Nobody has measured the cost of the reload, and each option
  that removes it changes a rule of the adapter protocol.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Setup:** The Vite configuration and plugins that Mokly loads for one
    side of a comparison.
  - **Stylesheet dependency:** A file that a stylesheet transform reports to
    Vite, such as an imported partial or a file that Tailwind scans.
  - **In-process reload:** Mokly closes the Vite server of the setup and
    loads the setup again in the same sidecar process.
- **Background:**
  - `docs/protocol/mokly-vite-adapter-inputs.md:22` makes each file that a
    plugin reports while Vite transforms a module an input of the compile. A
    change to it reloads the setup and moves every render key, at line 26.
  - For a stylesheet dependency, the sidecar reloads the setup in the same
    process, at `packages/mokly/src/sidecar/vite-context.ts:113`. Each other
    setup reload runs in a fresh worker. The branch that found this item kept
    the in-process reload on 2026-11-25, because each edit of an imported
    partial causes one.
  - Before that reload, the same branch passes each change to the
    `watchChange` hooks and the watcher listeners of the setup's plugins.
  - The reload exists because plugin state can grow across edits. The `Root`
    of `@tailwindcss/vite` only adds candidates
    (`node_modules/@tailwindcss/vite/dist/index.mjs`). A reload gives that
    state the value of a fresh build.
  - `@tailwindcss/vite` reports each scanned source file of the entry
    stylesheet with `addWatchFile`. So in a Tailwind v4 project, each
    component file is a stylesheet dependency.
  - A retained server transforms only the changed module again, as
    `tests/sidecar_vite_incremental.test.ts:121` checks for module edits. A
    new server transforms every module again.
  - `vite dev` keeps its server for an edit of a reported file. It calls
    `watchChange` and invalidates the module
    (`node_modules/vite/dist/node/chunks/node.js:24991`). It restarts only for
    the config file, its dependencies, and the env files.
  - Mokly loads the setup with the command `serve` for every command, so that
    Serve and `build` render the same. A fresh `build` has no candidates from
    earlier edits.
- **Problem:** In a Tailwind v4 project, each component edit closes the Vite
  server, loads the whole setup again, and makes the next `bundle` request
  transform every module again. This defeats the retained server for module
  edits.
- **Impact if no action:** A Serve edit in a Tailwind v4 project, a common
  Vite setup, can take as long as a cold compile. Nobody has measured how
  long.
- **Root question:** How does Serve keep its retained Vite transforms when a
  Tailwind v4 project edits a scanned source, while the CSS stays the CSS of
  a fresh build?
- **Options:**
  - **A.** Measure first. Time a component edit in Serve on a Tailwind v4
    fixture, with the in-process reload and with the server kept. Save the
    numbers under `.context/`. Keep the reload when the difference is small.
    Else bring B or C to the user with the numbers. Effort: Small.
  - **B.** Keep the server for an edit of a file that a stylesheet transform
    reports, as `vite dev` does. Dispatch the change events to the retained
    server. The inline stylesheet transform then runs again, because it
    invalidates the inline module, at
    `packages/mokly/src/sidecar/vite-css-transform.ts:89`. Change the reload
    rule at `docs/protocol/mokly-vite-adapter-inputs.md:26` for these files,
    the README sentences at `packages/mokly/src/sidecar/README.md:528` and
    line 597, and the process assertion at
    `tests/vite_stylesheet_watch.test.ts:71`. Cost: Tailwind's candidate set
    keeps the utilities of a removed class until a reload, so the Serve CSS
    can differ from a fresh build and from the base side. A plugin that
    refreshes its state only in a hot-update hook stays stale. Effort:
    Medium.
  - **C.** Transform stylesheets in a second Vite server of the same setup,
    in the same process. A stylesheet dependency edit then reloads only that
    server, and the JavaScript server keeps its transforms. Cost: it changes
    the rule of one Vite server for each sidecar process, at
    `docs/protocol/mokly-vite-adapter.md:109`. It doubles the plugin
    instances and the memory of a setup. Effort: Large.
- **Left out:**
  - A fresh worker for each stylesheet dependency edit. It fails the goal,
    because it adds a process start to the same cost.
  - Change nothing without a measurement. A is better on every point, because
    it gives the number that the choice needs.
- **Wider fix:** None. The cost comes from one reload rule, and B and C
  change that rule. A measurement must come first.
- **Previous examples:** None found.
- **Recommendation:** A. The options trade the CSS of a fresh build against
  the speed of each edit, and nobody knows the size of that cost.
- **Action:** fix after merge, apply A, because nobody has measured the cost,
  and B and C change rules of the adapter protocol that need the user.
