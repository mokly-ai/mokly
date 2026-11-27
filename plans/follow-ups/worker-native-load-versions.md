# Workers trust native modules that they already loaded

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 33, option G.
  The branch applied option D of that finding, a direct fix for the
  dependency inputs of an evaluation. This item is its wider fix.
- **Location:** `packages/mokly/src/sidecar/vite-node-peers.ts:19`,
  `packages/mokly/src/sidecar/vite-fetch.ts:34`,
  `packages/mokly/src/sidecar/vite-evaluate.ts:72`,
  `packages/mokly/src/sidecar/vite-invalidation.ts:84`, and
  `crates/mokly-sidecar/src/pool_affinity.rs:36`.
- **Reason:** One record of every native load reaches the setup and the
  evaluation of every worker, so it needs its own branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Worker:** One Node process of the sidecar pool. Serve keeps its workers
    across rebuilds.
  - **Native load:** A module that Node itself loads in a worker with
    `require` or `import`, not through Vite's module runner.
  - **External dependency:** A JavaScript package that the setup makes Node
    load directly during evaluation.
  - **Generation:** One compiled bundle of a side, with its recorded inputs.
  - **Module hooks:** Node's synchronous module customization hooks. The
    sidecar installs them at `packages/mokly/src/sidecar/vite-node-peers.ts:19`.
- **Background:**
  - The sidecar records the file digest of an external dependency and saves
    its file URL in the recipe, at `packages/mokly/src/sidecar/vite-fetch.ts:34`
    and line 39. Evaluation imports that URL, at
    `packages/mokly/src/sidecar/vite-evaluate.ts:76`.
    `docs/protocol/mokly-vite-adapter.md:156` says that Node loads such a
    dependency and its own imports at evaluation.
  - Serve watches each exact reported module, also inside a selected
    dependency root. See `docs/protocol/mokly-watch.md:124`.
  - Node keeps one CommonJS cache and one ES module map for each process.
    Node has no API that removes an ES module entry.
  - Serve keeps its workers across rebuilds, at
    `crates/mokly-cli/src/serve_pool.rs:30`, because warm Vite servers keep
    ordinary edits fast.
  - The pool can restore any generation on any worker of its root, at
    `crates/mokly-sidecar/src/pool_affinity.rs:36`. The pool ranks the idle
    head workers by their last compile.
  - A package update can keep its entry file and change only other files and
    the manifest. For example, `node_modules/react/index.js` only selects a
    file under `cjs/`. The Vite path records that stub as the external module
    of React.
  - On 2026-11-25 the branch that found this item applied three direct
    fixes:
    - Each worker keys on the dependency inputs that it evaluated: the
      selected peer files and the digest of each recorded input inside the
      selected dependency roots. These are external modules, package
      manifests, and directory memberships. The sidecar refuses a generation
      that records one of these inputs with another value, with a typed
      reason. The pool then restores that generation on a worker without the
      conflict, or on a new worker.
    - A setup reload for a changed input, other than a stylesheet
      dependency, runs in a fresh sidecar process.
    - The config load records each repository file that Node resolves while
      the config loads.
- **Problem:**
  - The direct fixes key on recorded inputs. A file that Node loads but no
    generation records escapes them. An example is a child file of an
    external package that changes while the package manifest stays the same.
  - The setup and the evaluation use two different mechanisms against the
    same process-wide caches. A setup reload uses a fresh process, and an
    evaluation uses a worker key. Each new native load path needs its own
    rule.
  - Before the direct fix, a second bundle in the same worker recorded an
    edited dependency under the same URL. Vite's runner delegated to Node's
    process-wide import cache, which returned the earlier exports. The
    native dependency test keeps the installed files fixed.
- **Screenshot:** In Serve's Canvas, mark the text from a changed external
  dependency after the catalogue rebuilds in a retained worker.
- **Impact if no action:** A generation can report a new dependency digest
  and still render old content. A worker replacement can then change the
  result with the same reported bytes.
- **Root question:** How does a worker serve a new generation or setup only
  when each module that Node already loaded in it still matches the current
  files?
- **Options:**
  - **A.** Tie native files to the workers that can evaluate them. Route an
    evaluation to a fresh worker when an external digest changes, and keep
    old workers for live generations. Test two bundles with an edit to a
    direct external file. Effort: Medium.
  - **B.** Load external dependencies through a native module loader with its
    own scope. Cover ES modules and CommonJS, and keep the shared React
    runtime. Scope the loader by the key of D, not by generation. Node never
    unloads an ES module, so a scope for each generation adds a copy of each
    native package on each Serve edit. Effort: Large.
  - **C.** Compile changed dependencies through Vite when Vite can run them.
    Use fresh workers for the other native formats. This changes which
    modules Vite transforms. It transforms packages that the setup
    externalizes, against the rule that
    `plans/follow-ups/vite-node-loading-rule.md` recommends. It still needs
    fresh workers for CommonJS. Effort: Large.
  - **D.** The worker key on the dependency inputs that it evaluated, as
    above. The branch applied D on 2026-11-25. Effort: Medium.
  - **E.** Apply D, and also check each external file at its first native
    load in a process. When its current digest differs from the recorded
    digest, fail the evaluation as stale. This also covers an older
    generation that a fresh worker restores after the edit. It is a new
    evaluation failure, so it needs the user's approval. Effort: Medium.
  - **F.** Replace the workers of each side that uses a selected dependency
    root when Serve sees a change inside that root, before the rebuild
    starts. It needs no record for each file, and it also covers a change to
    a manifest only. Cost: it drops the warm Vite servers, and older live
    generations then restore with the new files. Effort: Medium.
  - **G.** One native-version rule for each worker:
    - Record the digest of each file that Node loads in a worker, during the
      setup and the evaluation, through the module hooks that the sidecar
      already installs.
    - Before a worker serves a new generation or a reloaded setup, check that
      record against the current files and the inputs of the request.
    - Send a request with a conflict to a fresh worker. That routing must
      override the rank of the last compile.
    - Cost: it checks each loaded file for each new generation.
    - Effort: Large.
- **Left out:**
  - A query on the entry URL only. CommonJS files and shared child imports
    keep their earlier cached modules.
  - Clear `require.cache` for external CommonJS files. Node keeps a separate
    entry for each URL in its ES module loader and has no API to remove it,
    so this fails the goal.
  - A guide note that tells authors to restart Serve after a dependency
    update. Serve still publishes new digests with old content, so it fails
    the goal.
  - A worker thread for each dependency version inside the sidecar is not a
    real choice. The process boundary of the pool gives the same fresh module
    cache, and a faster start matters only after a rare dependency edit.
- **Wider fix:** G. A and D key on recorded inputs. G records each file that
  Node actually loads in a worker, so it holds whichever file of a package
  changes. It covers the setup helpers too.
- **Previous examples:** `plans/follow-ups/vite-node-loading-rule.md` records
  earlier mismatches in the selection of native packages. No earlier cache
  case surfaced.
- **Related:**
  - `plans/follow-ups/esbuild-retained-worker-react.md`: on the esbuild path,
    a retained worker keeps an old React after a React update, through
    Node's CommonJS cache. G, with hooks for the whole worker, covers that
    path too.
  - `plans/follow-ups/vite-node-loading-rule.md`: the rule for which packages
    Node loads natively. C here works against it.
  - `plans/follow-ups/installed-module-watch-paths.md`: a child that only
    Node loads gets no record and no Serve watch until this item lands. Its
    Vite regression imports the edited child directly for that reason.
- **Recommendation:** G. One record of what Node actually loaded protects
  every native load path of a worker, during the setup and the evaluation.
- **Action:** fix after merge, apply G, because G reaches every native load
  of a worker.
