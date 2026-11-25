# Serve misses new import.meta.glob matches

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding checks of findings 101 and 131 found.
- **Location:** `packages/mokly/src/sidecar/vite-invalidation.ts:123`,
  `packages/mokly/src/sidecar/resolution-inputs.ts:12`,
  `packages/mokly/src/sidecar/vite-watch-events.ts:47`, and
  `node_modules/vite/dist/node/chunks/node.js:27699`.
- **Reason:** No input rule covers the files that an `import.meta.glob` can
  match, and the best fix shares the scope record that the open item
  `plans/follow-ups/vite-tailwind-scan-scopes.md` decides.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **`import.meta.glob`:** A Vite feature that expands a file pattern into
    imports of the files that match it.
  - **Glob base:** The static directory part of a glob, such as `./icons` in
    `./icons/**/*.svg`.
  - **Membership record:** The sidecar's list of the file names in each
    directory that holds a consumed file. A change of a list makes the
    sidecar transform again.
- **Background:**
  - Under the adapter, Vite's `vite:import-glob` plugin expands each
    `import.meta.glob` when it transforms the importing module. It keeps the
    patterns of each importer, and it adds a later match only in its
    `hotUpdate` hook
    (`node_modules/vite/dist/node/chunks/node.js:27699` to line 27753).
  - The adapter runs Vite with no hot module replacement, under
    `docs/protocol/mokly-vite-adapter.md:102`. Vite skips `hotUpdate` hooks
    when `hmr` is off, at `node.js:24968`. Mokly passes each watched change to
    the `watchChange` hooks and the watcher listeners of the setup's plugins
    instead, at `packages/mokly/src/sidecar/vite-watch-events.ts:47`.
  - The sidecar transforms a module again only after a change of a consumed
    file or of a membership record, at
    `packages/mokly/src/sidecar/vite-invalidation.ts:123`. `directoryFiles`
    lists files and links only, not subdirectories, at
    `packages/mokly/src/sidecar/resolution-inputs.ts:12`. Only the
    directories of consumed files have a record, at line 60.
  - Serve watches the resolution directories of each JavaScript generation.
    A new subdirectory below a glob base is in no watched directory, so it
    starts no rebuild.
  - The esbuild path has no `import.meta.glob`.
- **Problem:** Under the adapter, a new file that matches an
  `import.meta.glob`, in a new subdirectory or in a directory that holds no
  consumed file, leaves the expansion of the importing module stale in Serve.
  Serve starts no rebuild for it, and a rebuild that another edit starts does
  not transform the importer again. This comes from a read of the code.
  Nobody ran it.
- **Impact if no action:** In Serve, a view that lists files through a glob,
  such as icons or stories, misses a new file until a restart.
- **Root question:** When a file starts to match an `import.meta.glob` of a
  module, how does Mokly see the change and transform that module again?
- **Options:**
  - **A.** State the limit on the inputs page and in the Vite guide: a new
    file below a glob base shows after a restart. Name the workaround, a
    `watch.rules` `rebuild` rule for the glob, which reloads the setup. Cost:
    each match of the rule reloads the setup and moves every render key.
    Effort: Small.
  - **B.** Report each `import.meta.glob` of a transformed module as a scope,
    its base directory and its glob. Carry it to the core in the scope record
    of `plans/follow-ups/vite-tailwind-scan-scopes.md`, so that Serve watches
    additions below the base, also in new subdirectories. Give the module a
    membership input for the scope, so that the sidecar transforms it again
    when the set of matches changes. Read the patterns from the module source
    with Vite's glob rules, because Vite keeps them private. Cost: a new
    input kind, a parser for the glob arguments, and a wire field. Effort:
    Large.
  - **C.** Extend the membership records. List subdirectories in
    `directoryFiles`, and record each directory below a glob base. A new
    subdirectory is then a membership change of its parent. Cost: a new
    folder beside any consumed file then counts as a change, so more
    transforms run. C still needs the glob bases, and Serve must watch each
    directory below a base. Effort: Medium.
- **Left out:**
  - Call Vite's `hotUpdate` hooks for create and delete events. It fails the
    goal. The adapter runs no hot module replacement, the update hooks of
    other plugins expect an update client, and Serve still sees no event for
    a file in a new subdirectory.
  - Expand each glob once into its files. It fails the goal, because later
    matches stay unseen.
- **Wider fix:** B. One scope record for each declared pattern, from a
  stylesheet plugin or a JavaScript glob, feeds the watch plan and the
  transform check. A new kind of pattern then needs only a new
  classification.
- **Previous examples:** `plans/follow-ups/vite-tailwind-scan-scopes.md`
  records the same class for the scan scopes of a stylesheet plugin.
- **Related:**
  - `plans/follow-ups/vite-tailwind-scan-scopes.md`: a shared wider fix. Its
    option E sends the patterns of JavaScript transforms through the same
    record. The answer there decides the record that B uses.
  - `plans/follow-ups/vite-replay-computed-imports.md`: that item points
    authors to `import.meta.glob` as an import form that the adapter records,
    so this gap matters more when that item lands.
- **Recommendation:** B, after the answer to the scan scope item. It closes
  the gap with the record that the scan scopes use. Choose A if the user
  wants no new input kind now.
- **Action:** ask the user, because no input rule covers the files that an
  `import.meta.glob` can match, and B depends on the answer to the open scan
  scope item.
