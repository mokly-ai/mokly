# Retained workers keep an old React

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the finding check of finding 33 in round 1 of
  the implementation review of the branch
  `calummoore/storybook-track-d-finish-nkpi`, which put it outside the scope.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:55`,
  `packages/mokly/src/sidecar/compiled.ts:80`, and
  `crates/mokly-cli/src/serve_pool.rs:30`.
- **Reason:** The esbuild path predates the Vite adapter work of the branch
  that found it, and the fix reaches the worker lifecycle of the sidecar
  pool.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Worker:** One Node process of the sidecar pool. Serve keeps its workers
    across rebuilds.
  - **Generation:** One compiled bundle of a side, with its module graph.
  - **Peer:** A package that the sidecar loads at render time from the
    project's installation, such as `react` and `react-dom`.
  - **`generation.require`:** The `require` function that `restore` in
    `packages/mokly/src/sidecar/compiled.ts` gives each esbuild generation.
- **Background:**
  - `restore` makes `native` with `createRequire` for the `package.json` of
    the side's configuration directory, at `compiled.ts:55`.
    `generation.require(name)` calls `native(resolve(name))`, at
    `compiled.ts:80`. For a peer, `resolve` returns the resolved file that
    `compiled.peers` holds.
  - Node's CommonJS loader keeps one cache for each process, keyed by the
    resolved file path. A second `require` of the same path returns the
    cached exports.
  - A React update in place, such as an `npm install` of a new React patch
    release, keeps the path `node_modules/react/index.js` and changes the
    files behind it.
  - Serve keeps its workers across rebuilds, at
    `crates/mokly-cli/src/serve_pool.rs:30`.
  - The section "Bundling" of `docs/protocol/mokly-sidecar.md` says that
    React and React DOM resolve from the side's configuration directory
    through its settings, with one React runtime.
  - On 2026-11-25 the branch that found this item keyed each worker of the
    Vite path on the dependency inputs that it evaluated. These include the
    selected peer files. The sidecar refuses, with a typed reason, a
    generation that records one of these inputs with another value. The pool
    then uses another worker or a new one. That fix covers the Vite path
    only.
- **Problem:** On the esbuild path, `generation.require` loads React through
  Node's CommonJS cache. After a React update, each new generation in a
  retained worker keeps the old React.
- **Impact if no action:** Serve renders with the old React until the worker
  ends, for example at a restart or a recycle. The output can then differ
  from a fresh build of the same files.
- **Root question:** How does each esbuild generation in a retained worker
  run the React that its side's installation holds now?
- **Options:**
  - **A.** Key each esbuild worker on the peers that it loaded, as the Vite
    path does. Record the resolved file and the digest of the package
    manifest of each peer that `generation.require` loads. Refuse a
    generation whose peers differ, with the typed reason of the Vite path,
    so that the pool uses another worker or a new one. Test a retained
    worker after a React update that keeps the entry file. Effort: Medium.
  - **B.** Replace the workers of a side when Serve sees a change inside a
    selected dependency root, before the rebuild starts. It needs no record
    for each file. Cost: each dependency edit drops the warm state of every
    worker of the side. Effort: Medium.
  - **C.** One record of every native load of a worker, as option G of
    `plans/follow-ups/worker-native-load-versions.md` describes. With hooks
    for the whole worker, it covers this path, the Vite path, and the setup
    helpers. Effort: Large.
- **Left out:**
  - Clear the CommonJS cache entries of the peer packages. React DOM and
    other loaded modules keep references to the old React, so one process
    can then mix two React copies. It fails the goal.
  - A guide note that tells authors to restart Serve after a React update.
    Serve still renders with the old React until the restart, so it fails
    the goal.
- **Wider fix:** C. One record of what Node actually loaded protects every
  native load path of a worker.
- **Previous examples:** The Vite path had the same defect for external
  dependencies. The branch `calummoore/storybook-track-d-finish-nkpi` fixed
  it on 2026-11-25 with a worker key on the evaluated dependency inputs.
- **Related:** `plans/follow-ups/worker-native-load-versions.md`: its option
  G is C here. When that item lands with hooks for the whole worker, check
  this case, and close this item with it.
- **Recommendation:** C. It fixes this path and every other native load path
  with one rule. A is the direct fix, if the user wants this case fixed
  before C.
- **Action:** fix after merge, apply C, because the esbuild path predates
  the branch that found it, and C is the wider fix that
  `plans/follow-ups/worker-native-load-versions.md` records.
