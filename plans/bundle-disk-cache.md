# Bundle Disk Cache

Status: Active. On branch
`conductor/perf-7-disk-cache-for-sidecar-bundles-and-descriptions`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says. The decisions below wait for the user.

On each Serve start and each `build`, the core asks the sidecar to bundle
every JavaScript entry with esbuild and then to describe the bundle. The
core's sidecar pool keeps each compiled bundle in memory, and the sidecar
reuses a live compilation while its inputs do not change. Nothing survives a
restart, so every start compiles again. On this machine the head bundle costs
2.8 s of the 6.6 s `serve.ready`, and the base side of the first Changes
classification compiles again for about 3.2 s. This plan is perf 7, finding
10 of the 2026-10-27 performance profile.

The recommended approach keeps the latest compiled bundle of each bundle
setting in the OS cache directory. Before a `bundle` request, the core's pool
installs the stored bundle in the worker with the existing
`restoreGeneration` request. The sidecar's `reuse` input check then accepts
it or compiles. The check also gains the inputs that it misses today and the
identity of the toolchain that compiled the code. After a compile, the pool
stores the new bundle. Both comparison sides use it, because they share one
pool. The plan does not cache the describe result, the CSS Modules class
maps, or the stylesheet bundles of graph preparation. It does not change the
Serve base lifetime, which perf 6 owns.

Decision 0 (2026-10-29, made by the user before this plan): start this item
now, in parallel with perf 6.

The options check of the decisions ran on 2026-10-30. It changed the
recommendations of decisions 4, 6, 7, and 9 and added options to every
decision except 3 and 5. Its report is
`.context/bundle-disk-cache/options-check.md`.

Contract owners:

- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md#compiled-recipes-and-release):
  compiled recipes, reuse, and restore.
- [Sidecar bundling](../docs/protocol/mokly-sidecar.md#bundling): the
  generation id.
- [Watch](../docs/protocol/mokly-watch.md): the resolution inputs of reuse.
- [Base preparation cache](../docs/protocol/mokly-base-cache.md): the OS
  cache kinds, receipts, locks, bounds, and eviction.
- [Cache directory output](../docs/protocol/mokly-terminal-cache.md) and
  [terminal output](../docs/protocol/mokly-terminal-output.md).
- [Format versions](../docs/protocol/mokly-format-versions.md#version-inventory).
- [Timings](../docs/protocol/mokly-timings.md): core spans and budgets.
- The READMEs of [`@mokly/mokly`](../packages/mokly/README.md),
  [mokly-sidecar](../crates/mokly-sidecar/README.md),
  [mokly-compare](../crates/mokly-compare/README.md),
  [mokly-render](../crates/mokly-render/README.md), and
  [mokly-cli](../crates/mokly-cli/README.md).

## Baseline

Release build of `origin/main` at `f93afcea`, measured on 2026-10-30 on this
machine with the method of the brief: 8 cores, 16 GB. Warm values are the
median of three runs. This machine is about 55% slower than the brief's
baseline machine, which measured `serve.ready` at 4.2 s.

| Measure                                            | This machine |
| -------------------------------------------------- | -----------: |
| `serve.ready`, cold                                |        6.3 s |
| `serve.ready`, warm                                |        6.6 s |
| head `catalogue.validate`                          |        5.1 s |
| head `sidecar.bundle`, two esbuild compiles inside |        2.8 s |
| head CSS Modules class maps, inside validation     |        1.5 s |
| head `sidecar.describe`, inside validation         |       0.26 s |
| `sidecar.spawn` before the bundle                  |       0.24 s |
| head `graph.prepare`                               |        1.3 s |
| `serve.background`                                 |        6.4 s |
| `changes.classify`                                 |       15.0 s |
| `review.base-tree`                                 |        9.8 s |
| base `catalogue.validate`                          |        5.3 s |
| base `sidecar.bundle`                              |        3.2 s |
| base `graph.prepare`                               |        1.7 s |
| `review.capture-side`                              |        0.8 s |
| `review.compare-views`                             |        3.8 s |
| Edit run: `watch.action`                           |        5.5 s |
| Edit run: `changes.classify` after the edit        |       15.3 s |
| Edit run: base side after the edit                 |       10.0 s |
| Edit run: edit to the end of the second classify   |       21.7 s |
| React fixture: `serve.ready`                       |        3.0 s |
| React fixture: `serve.background`                  |        2.3 s |
| React fixture: `changes.classify`                  |        3.8 s |

One stored head bundle of `examples/basic` is 3.3 MB of JSON: 1.8 MB of code,
2,273 modules, and 2,753 consumed input files. The `reuse` input check over
these files takes about 0.4 s one file after the other and about 0.2 s in
parallel. Two cold `mokly build --strict` runs give byte-identical output.

Evidence: `.context/bundle-disk-cache/baseline.md`.

## Corrections to the item text

The item text came from a reading of `main` at `f93afcea`. These points
differ from the code.

1. The core call is not in `crates/mokly-catalogue/src/preparation.rs`. That
   file calls the describe boundary only. The `bundle` and `describe`
   requests start in `crates/mokly-render/src/bundle.rs` and
   `bundle_attempt.rs`, and the pool in `crates/mokly-sidecar` sends them.
   The recommended option of decision 1 needs files outside the item's list.
   Decision 1 names them.
2. Only one describe call is on the startup path: 0.26 s here, about 0.17 s
   on the baseline machine. The item's 1.2 s is the sum of seven calls. Five
   run after `serve.ready` in the background workers, and one runs on the
   base side.
3. The item did not count the CSS Modules class maps. The core bundles the
   stylesheet roots for their class maps between the bundle and the
   describe call. That step takes 1.5 s here and stays after a restart,
   because the stylesheet cache is in memory. Decision 2 follows from it.
4. The timings page lists a `catalogue.describe` span. No code emits it.
   Decision 8 resolves it.
5. The OS cache composition that the base side uses is in
   `crates/mokly-cli/src/base_dependencies.rs`, a perf 6 file. The new cache
   kind must not need a change there.
6. A `tracing::warn!` of the core never reaches the terminal, because no
   subscriber prints warnings. Decision 7 uses the CLI's terminal reporters.
7. The compiled recipe does not record `jsconfig.json` candidates, the
   targets of a tsconfig `extends`, or the manifests of the peers other than
   React. In-process reuse on `main` already misses a change to them, and a
   restart clears it. Decision 4 resolves it.
8. `mokly-runtime.md`, a perf 6 file, lists the OS caches as the extraction
   cache and the dependency cache. Design call 6 handles it.

## Decisions

The items wait for the user. Terms that two or more items use:

- **Sidecar:** the Node process under `packages/mokly/src/sidecar` that
  bundles, evaluates, and renders the JavaScript entries.
- **Pool:** the core's sidecar process pool in `crates/mokly-sidecar`. It
  sends every request and keeps each compiled bundle in memory.
- **Compiled recipe:** the private part of a `bundle` result: the code, the
  module graph, the consumed input digests, and the directory listings.
- **`reuse` check:** the sidecar function in `compiled.ts` that accepts an
  earlier recipe when the settings, the dependency roots, every consumed
  file digest, and every consumed directory listing are equal.
- **`restoreGeneration`:** the existing request that installs a compiled
  recipe in a sidecar without esbuild and without reading sources.
- **OS cache directory:** the per-repository directory outside the
  repository that holds the base extraction cache and the dependency cache.
- **Toolchain identity:** one digest of the Mokly version, the esbuild
  version, the Node version, and the sidecar's own program files.

| #   | Title                              | Source | Severity | Effort | Recommended |
| --- | ---------------------------------- | ------ | -------- | ------ | ----------- |
| 1   | Where the stored bundle is checked | Design | High     | Large  | A           |
| 2   | Startup target is out of reach     | Design | High     | Small  | A           |
| 3   | What the cache keeps               | Design | Medium   | Small  | A           |
| 4   | Key and recorded inputs            | Design | Medium   | Large  | D, first A  |
| 5   | Base side entries                  | Design | Medium   | Small  | A           |
| 6   | Storage format and bound           | Design | Medium   | Large  | D, first A  |
| 7   | Cache output in the terminal       | Design | Low      | Large  | C, first B  |
| 8   | Timing record of the cache outcome | Design | Low      | Large  | A           |
| 9   | Tests against the item's list      | Design | Low      | Small  | C, first A  |

### 1. Where the stored bundle is checked

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs`,
  `crates/mokly-render/src/bundle.rs`, `packages/mokly/src/sidecar/compiled.ts`.
- **Background:** The pool sends each `bundle` request to a sidecar. The
  sidecar runs the `reuse` check against its live compilations, then
  compiles when no compilation matches. The pool already installs an
  in-memory recipe in a new sidecar with `restoreGeneration`. The core's
  render runtime also keeps an input stamp of each bundle for its own
  in-process reuse. Both comparison sides share one pool. Every option keeps
  these conditions: the sidecar runs consumer code and holds no catalogue
  state, from `mokly-sidecar.md`. A sidecar never outlives its binary, from
  the same page.
- **Problem:** A stored bundle must pass the same input check as a live one
  before a process uses it. Several components can do the check and the
  restore. The item's file list names none of the core files that the
  check needs.
- **Impact if no action:** The implementation cannot start, because the
  file scope and the component are open.
- **Root question:** Which component reads, checks, and writes a stored
  bundle, so that both sides use it and each component keeps its contract?
- **Options:**
  - **A.** The pool. Before a `bundle` request, the pool loads the stored
    recipe for the request's settings and installs it in the worker with
    `restoreGeneration`. The sidecar's `reuse` check accepts it or
    compiles. After a compile, the pool stores the new recipe. Both sides
    use it with no perf 6 file. A hit costs one round trip of the 3.3 MB
    recipe and the check: about 0.3 s here, estimate. Files:
    `crates/mokly-sidecar` pool and results, `crates/mokly-compare` cache,
    the CLI composition and timing allow-lists,
    `crates/mokly-render/src/bundle_attempt.rs`, and the sidecar's
    `compiled.ts` and `bundle-recipe.ts`. Effort: Large.
  - **B.** The core's render runtime. `crates/mokly-render/src/bundle.rs`
    checks the stored recipe with its input stamp in Rust and registers it
    in the pool through a new pool method, without a `bundle` request. A hit
    costs about 0.2 s here, estimate. The runtime gets the store through its
    constructor, so the base side needs a change in
    `crates/mokly-cli/src/changes_base.rs`, a perf 6 file, and waits for
    perf 6. The toolchain identity must reach the core, as in decision 4 B.
    Effort: Large.
  - **C.** The sidecar. Its `bundle` method reads and writes the stored
    recipe in a directory that the core passes in `hello`. This changes the
    requirements "The sidecar performs no file writes" and "The binary owns
    ... caching" of the sidecar pages. It needs atomic writes, a byte bound,
    and eviction in TypeScript beside the Rust cache. Effort: Large.
  - **D.** As B, but the pool holds the store, so no perf 6 file changes.
    The render runtime asks the pool for the stored recipe of its settings,
    checks it with its input stamp, and registers it through a new pool
    method. The `cssModules` prerequisite restores it in the sidecar later.
    This adds two methods to the three `SidecarPool` implementations, and
    the toolchain identity must reach the core, as in decision 4 B. A hit is
    about 0.1 s faster here than with A, estimate. Effort: Large.
- **Left out:**
  - A shared sidecar daemon that keeps bundles in memory across Serve
    processes breaks the requirement that a sidecar never outlives its
    binary.
  - A wrapper around the pool outside `crates/mokly-sidecar` cannot send
    its restore and the next `bundle` request to the same sidecar, because
    the pool gives a request any free slot of the same source root.
  - Storing only the native resolution plan saves the first compile and the
    classify step, about 1.2 s of the 2.8 s. The second compile still runs,
    so it fails the acceptance of no compile on a warm restart.
  - "Change nothing" fails the goal.
- **Wider fix:** None. The options are the structure of the change.
- **Previous examples:** The pool's in-memory seed in
  `crates/mokly-sidecar/src/pool_preparation.rs`, and the core's in-process
  bundle reuse in `crates/mokly-render/src/bundle.rs`.
- **Related:** Item 3: its option B needs a pool change that A, B, and D can
  host. Item 4: its options A and D suit A and C. B and D need 4 B. Item 5:
  A and D cover the base side without a perf 6 file.
- **Recommendation:** A. One check then decides for live and stored
  recipes, with no new pool methods and no change to `hello`. D is about
  0.1 s faster for each hit here.
- **Action:** ask the user, because condition 5 holds: the item lists the
  key and the check as open decisions, and the scope leaves the item's file
  list.

### 2. Startup target is out of reach

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** None.
- **Background:** The item asks for `serve.ready` to fall from about 4.2 s
  to 1.5 s or less on the baseline machine. Here, `serve.ready` is 6.6 s.
  The bundle is 2.8 s of it. The CSS Modules class maps take 1.5 s. In
  `graph.prepare`, 35 stylesheet bundles take 0.88 s of 1.14 s, all with no
  cache record. Both stylesheet steps use one stylesheet cache, and that
  cache is in memory. The describe call takes 0.26 s and the sidecar start
  0.24 s. Every option keeps two conditions. This item caches the bundle
  and, when safe, the describe result, from the task message. Serve is ready
  only after complete validation, from the decision in `mokly-timings.md`.
- **Problem:** With decisions 1 A and 3 A, the expected warm `serve.ready` is
  about 4.1 s here and about 2.6 s on the baseline machine. The describe
  result adds at most 0.17 s there. Only a scope that also keeps the
  stylesheet work across restarts reaches 1.5 s.
- **Impact if no action:** The pull request cannot meet its acceptance, and
  the remaining cost has no owner.
- **Root question:** Which work must a warm restart skip to reach the 1.5 s
  target, and which part of that work does this item deliver?
- **Options:**
  - **A.** Revise the acceptance of this item. A warm restart runs no
    `sidecar.bundle.compile`. The warm `serve.ready` median here falls by at
    least 2.0 s, from 6.6 s. Move the 1.5 s target into a follow-up item
    that keeps the stylesheet cache across restarts, with the estimate of
    option D. Effort: Small.
  - **B.** Widen this item to keep only the stylesheet records of the class
    maps on disk. The expected value is about 2.7 s here and 1.7 s on the
    baseline machine, estimate, so it still misses the target. Effort: Large.
  - **C.** Keep the 1.5 s target and also cache the describe result, as in
    decision 3 B. The expected value is about 2.4 s on the baseline machine.
    Effort: Large.
  - **D.** Widen this item to keep the whole stylesheet cache across
    restarts, for the class maps and for graph preparation. The expected
    value is about 1.9 s here and 1.2 s on the baseline machine, estimate.
    It is a second stored format with PostCSS read evidence, asset and glob
    stamps, and its own check, in the same pull request. Effort: Large.
- **Left out:** Listening before the class maps are ready changes the
  readiness and validation order. `mokly-timings.md` records the user's
  rejection of usable navigation before every entry is ready.
- **Wider fix:** None. The target is a planning choice.
- **Previous examples:** Perf 5, decision 8: the user accepted step A as
  measured in a slower machine state and moved work to step B.
- **Related:** Item 3: its option B adds about 0.17 s on the baseline
  machine. Item 1: its option D adds about 0.1 s for each hit here.
- **Recommendation:** A. The bundle is the part that this item can remove,
  and only the scope of D reaches 1.5 s, which needs its own design.
- **Action:** ask the user, because condition 1 holds: the recommended
  option changes the acceptance of the task message.

### 3. What the cache keeps

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/describe.ts`,
  `crates/mokly-sidecar/src/pool_requests.rs`.
- **Terms:**
  - **Bindings:** the handle table that the core installs in a sidecar
    after describe and before the first render.
- **Background:** `describe` evaluates the bundle and returns the entry
  definitions. Its output is not a function of the bundle and the settings
  alone. It also depends on the CSS Modules class maps, on the peer packages
  that the code loads at evaluation, such as React and Storybook, on the
  Node version, on the process environment, on the time, and on each file
  that the code reads outside its module graph. The core already reuses a
  description inside one process for an equal generation and class maps.
  The `bindings` request in `graph.prepare` needs a sidecar that has
  evaluated the bundle. Every option keeps the rule that a description is
  reused only while its generation and class maps are equal, from
  `crates/mokly-render/src/bundle.rs`.
- **Problem:** A stored description saves at most 0.26 s here. It needs a
  pool change to take effect, because the `bindings` request evaluates the
  bundle anyway. A description from another environment can be stale. A
  stale handle list fails the `bindings` check with a protocol error.
- **Impact if no action:** The store format and the tests cannot be fixed.
- **Root question:** Which results of the bundle and describe steps can a
  later process reuse, without a risk of stale catalogue output?
- **Options:**
  - **A.** Keep the compiled bundle only. Each process evaluates the bundle
    once, as today. Effort: Small, because it adds no code to decision 1.
  - **B.** Keep the bundle and the description. Reuse the description for an
    equal generation, class maps, and toolchain. Install the bindings in the
    pool without a sidecar until the first render, so that no evaluation
    runs before `serve.ready`. The first render then pays the evaluation.
    Effort: Large.
  - **C.** Keep both, and compare the stored description with the first real
    evaluation in the background. Rebuild the catalogue on a mismatch. This
    changes the readiness and validation order that the user kept for
    startup. Effort: Large.
- **Left out:** Storing the evaluated objects is not possible across
  processes. "Change nothing" fails the goal.
- **Wider fix:** None.
- **Previous examples:** The in-process reuse of `existing.definitions` in
  `crates/mokly-render/src/bundle.rs`.
- **Related:** Item 2: B and C change the expected saving by about 0.17 s
  on the baseline machine. Item 1: B needs the pool of decision 1 A, B, or
  D.
- **Recommendation:** A. The five describe calls after `serve.ready` run in
  other sidecars, and each must evaluate the bundle to render. So a stored
  description removes only the one 0.26 s call, and it adds a risk of wrong
  output.
- **Action:** ask the user, because condition 5 holds: the item lists this
  choice as an open decision.

### 4. Key and recorded inputs

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/compiled.ts`,
  `packages/mokly/src/sidecar/bundle-recipe.ts`,
  `packages/mokly/src/sidecar/resolution-inputs.ts`.
- **Background:**
  - The `reuse` check compares the settings, which are the bundle
    parameters without `evaluation`. It also compares the dependency roots,
    the digest of every consumed file, and the file list of every consumed
    directory.
  - The recorded files are the module sources, the ancestor `package.json`
    and `tsconfig.json` candidates, also absent ones, the resolved
    `react/package.json`, the Storybook preview candidates, and the lookup
    files.
  - esbuild also reads `jsconfig.json` when a directory has no
    `tsconfig.json`, and it follows a tsconfig `extends`. Three packages of
    this repository extend a tsconfig.
  - The restored code loads each peer from its stored real path. Only the
    React manifest of the peers is recorded. With pnpm, a peer upgrade
    changes the real path.
  - Across processes the producer of a recipe can change: `@mokly/mokly`
    depends on esbuild `^0.28.2`, the Node version can change, and a rebuilt
    `dist/` in this repository keeps version 0.17.0.
  - Every option keeps two rules. A compilation is reused only while its
    inputs stay unchanged, from `mokly-sidecar-modules.md`. A peer other
    than React counts through its path only in render keys, from
    `mokly-watch.md`.
- **Problem:** The `reuse` check has no input for the producer of the
  compiled code, and it misses three inputs that esbuild or the evaluation
  reads. A stored recipe carries these gaps past a restart, which clears
  them today.
- **Impact if no action:** A restart after an upgrade, a sidecar rebuild, or
  an edit of one of the missed files can serve stale or broken compiled
  code.
- **Root question:** Which inputs must match before a stored compilation can
  serve a new process, and where is each input compared?
- **Options:**
  - **A.** The store key is a digest of the settings. The sidecar records its
    toolchain identity in each compiled recipe, and the `reuse` check also
    requires an equal toolchain. An upgrade replaces the entry in place.
    Effort: Large.
  - **B.** The store key is a digest of the settings and of a toolchain
    identity that the `hello` result reports. The `reuse` check stays as it
    is. Entries of an old toolchain stay until eviction. This changes the
    `hello` result, and the worker handshake must return it. Effort: Large.
  - **C.** The store key is a digest of the settings and the Mokly version.
    A sidecar rebuild or another esbuild version can serve stale code.
    Effort: Small.
  - **D.** As A, plus three recorded inputs and one identity input. The
    recipe records the package manifest of each resolved peer, a
    `jsconfig.json` candidate beside each `tsconfig.json` candidate, and
    each file that a tsconfig `extends` chain names. The toolchain identity
    enters the compilation identity, as the rule of `mokly-sidecar.md`
    wants for any input that can change the compiled code. The new peer
    manifests are inputs of the `reuse` check only, so the render-key rule
    stays. The sidecar repeats part of esbuild's `extends` resolution. A
    case that it misses is no worse than today. D also closes these gaps for
    in-process reuse. Effort: Large.
  - **E.** As D for the peers and `jsconfig.json`, without `extends`
    resolution. A compilation that read a tsconfig with `extends` stays in
    memory and is never stored. `examples/basic` reads such a tsconfig, so
    it would never hit. Effort: Large.
- **Left out:** A check by file size and modification time in place of
  digests is faster, but it breaks the reuse rule, because an edit that
  keeps both values passes.
- **Wider fix:** D. Every later reuse path then checks the producer and the
  full set of resolution files.
- **Previous examples:** None found.
- **Related:** Item 1: A and D suit decision 1 A and C. Decision 1 B and D
  need B. Item 6: its option D keeps another release's entries unparsed.
  Item 9: D adds one test case for each new input kind.
- **Recommendation:** D. The first recommendation was A. A meets the
  acceptance only for the inputs that the check records today.
- **Action:** ask the user, because condition 5 holds: the item lists the
  key and the check as an open decision, and D changes the reuse rule.

### 5. Base side entries

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-render/src/bundle_inputs.rs`.
- **Background:** The base source root is the extracted base commit in the
  OS cache directory. Its path is keyed by the commit and its checkout
  settings, so it stays the same across restarts. The compiled code holds
  absolute paths of its side: the configuration directory in the JSX
  development shim, and the resolved peers. The settings and the
  compilation identity include the source root. Every option keeps the
  requirement that equal head and base sources get separate generations,
  from `mokly-sidecar.md`, and the rule that no perf 6 file changes, from
  the task message.
- **Problem:** A base run cannot use a head entry, even for equal sources,
  because the code and the input paths differ.
- **Impact if no action:** The store design cannot be fixed.
- **Root question:** Can the base side of a comparison reuse a stored
  compilation, and which runs can write it?
- **Options:**
  - **A.** Each side keeps its own entries under its own source root. A base
    run hits an entry that an earlier base run stored for the same
    extraction. Paths stay absolute. Effort: Small, no code beyond decision
    1 A.
  - **B.** Store the recipe relative to its side root and rewrite the paths
    at restore, so that equal head and base sources share one stored text.
    The restored generations still get an id for each side. This rewrites
    code text, peers, and input paths. It helps only the first base compile
    of a commit whose JavaScript equals the head. Effort: Large.
  - **C.** Head only. The base side does not use the store. This loses about
    3.2 s here at the first classification, and after each edit until perf 6
    merges. Effort: Small.
- **Left out:** Entries inside the base extraction break the base cache rule
  that a complete entry's data does not change.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** Item 1: its options A and D cover the base side through the
  shared pool. Its option B needs a perf 6 file.
- **Recommendation:** A. It needs no extra code and keeps the identity rule.
  An extraction with external checkout filters is private to one
  preparation. It can get the same staging path again, so its entries can
  hit. That is safe, because the check digests every input.
- **Action:** ask the user, because condition 5 holds: the item lists the
  base side as an open decision.

### 6. Storage format and bound

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-compare/src/cache.rs`,
  `crates/mokly-compare/src/cache_types.rs`.
- **Terms:**
  - **Receipt:** the file that marks a cache entry complete. No caller leases
    an entry before its receipt exists.
- **Background:**
  - The OS cache has two kinds today, `sources` and `dependencies`. Each has
    a 2 GiB bound, entry locks, receipts, least recently used eviction by an
    access sequence, staging, and trash.
  - A complete entry never changes. Damaged receipts rebuild. Hits trust the
    receipt and hash no content, because hashing large trees is slow.
  - Two processes can share an entry: one builds and the other waits.
  - The wire types of a recipe reject unknown fields, so an entry from
    another release can fail to parse.
  - Every option keeps these requirements: a version number with a reader
    that rejects other numbers, from `mokly-format-versions.md`. A byte
    bound and eviction, and readers that never see a partial entry, from
    the task message. Eviction order without wall-clock time, from
    `mokly-base-cache.md`. No perf 6 file changes, so the new bound needs
    no new field in the cache composition of `base_dependencies.rs`.
- **Problem:** The bundle needs one store with these properties. A stale
  entry must be replaced under the same key, which the cache cannot do
  today.
- **Impact if no action:** Two Serve processes can corrupt or exceed the
  cache, or the implementation cannot start.
- **Root question:** How is one compilation kept on disk, so that concurrent
  processes never read a partial entry, disk use stays bounded, and an entry
  of another format or release is rejected before it is parsed?
- **Options:**
  - **A.** A third kind of the existing cache, `bundles`, with its own 512 MiB
    bound. Each entry holds one file. Its first line gives the format
    version 1 and the SHA-256 digest of the payload. The payload is the
    restore envelope. The cache gains one operation that replaces a complete
    entry under its entry lock. The reader rejects another version before it
    reads the payload. Hits hash the one payload, which the page must state
    for this kind. Effort: Large.
  - **B.** A separate single-file store. Each key is one file, written to a
    temporary file and renamed. The last writer wins. Eviction must use an
    access sequence, not file times. This is a second set of cache rules,
    and rename over an open file differs on Windows. Effort: Medium.
  - **C.** One embedded database file for each repository, for example
    SQLite. It gives atomic updates. It adds a dependency and a second
    storage engine. Effort: Large.
  - **D.** As A, and the first line also names the Mokly version that wrote
    the entry. The `hello` check makes that version equal to the sidecar's.
    The reader treats another version like another format number: it misses
    without a parse, and the next compile replaces the entry. Each release
    then costs one miss for each entry. Effort: Large.
  - **E.** Entries never change after they are written. Each compile adds
    an entry keyed by the settings and the compilation identity. A small
    pointer file for each settings key names the latest entry, and an atomic
    rename replaces it. Old entries stay until eviction, so the store writes
    more. Effort: Large.
- **Left out:** Memory only fails the goal.
- **Wider fix:** D. All kinds then share one set of cache rules, and no
  release reads the entries of another.
- **Previous examples:** The `sources` and `dependencies` kinds in
  `crates/mokly-compare/src/cache.rs`.
- **Related:** Item 7: the payload digest gives the damaged reason. Item 4:
  D keeps another release's entries unparsed before the sidecar compares
  the toolchain. Item 9: the replace operation needs one eviction case.
- **Recommendation:** D. The first recommendation was A. It keeps the
  shared cache rules, and one header field stops a new release from reading
  an old entry as damaged. One head entry of `examples/basic` is 3.3 MB, so
  512 MiB holds about 150 entries.
- **Action:** ask the user, because condition 5 holds: the item lists the
  format as an open decision, and the bound is a new budget.

### 7. Cache output in the terminal

- **Severity:** Low. **Effort:** Large.
- **Source:** Design.
- **Category:** UX wording.
- **Location:** `crates/mokly-cli/src/entry_serve.rs`,
  `crates/mokly-cli/src/serve_delivery.rs`,
  `crates/mokly-cli/src/changes_runtime.rs`.
- **Background:**
  - The existing kinds rebuild a damaged receipt with no output. The first
    opened base cache prints one line that names the cache directory, once
    for each process.
  - Serve creates its once-only cache flag in `serve_delivery.rs`, and
    `entry_serve.rs` has the terminal before it builds the pool. `build`
    and `publish` create their once-only reporter in `changes_runtime.rs`.
    None of these is a perf 6 file.
  - The core's tracing warnings never reach the terminal. Serve prints a
    recoverable internal fault as a warning line, for example the watch
    event loss.
  - Deleting the cache directory resets a valid but stale entry. A restart
    no longer does that.
  - Every option keeps the rule that deleting the cache is safe and changes
    time only, from `mokly-runtime.md`. A terminal warning is not a build
    warning, so `--strict` does not count it, from the same rule and the
    user's rule against new gates.
- **Problem:** The item asks to warn on a damaged or unreadable entry. The
  user also needs the directory to delete a stale entry. No channel prints
  either for the bundle cache today.
- **Impact if no action:** A damaged entry is visible only in the timing
  records, and the user cannot find the bundle cache.
- **Root question:** How does a user learn that the bundle cache exists,
  where it is, and that an entry or the directory failed?
- **Options:**
  - **A.** No terminal output. A damaged, unreadable, or other-version entry
    is replaced after a compile. An unusable cache directory turns the store
    off for the process. The timing record names the reason. The general
    cache line rule of `mokly-terminal-output.md` must then name the base
    caches only. Effort: Small.
  - **B.** As A, plus one warning line on stderr for each damaged entry and
    for an unusable cache directory, in the warning form of the terminal
    page. It needs a warning that knows the output mode in `crates/mokly-cli`
    and a call in the store's crate. Effort: Large.
  - **C.** As B, plus the shared directory line for the bundle cache,
    through the command's one cache reporter that the base caches also use.
    In plain mode the `Mokly cache:` line then prints at the first bundle
    lookup, earlier than today, also for `--no-changes` builds with
    JavaScript. Effort: Large.
  - **D.** As A, plus the shared directory line. These are the rules of the
    existing kinds, unchanged. It drops the warning of the task message.
    Effort: Large.
- **Left out:** Failing the command breaks the rule that deleting the cache
  changes time only.
- **Wider fix:** C.
- **Previous examples:** The watch event loss warning in
  `mokly-terminal-output.md`.
- **Related:** Item 8: every option keeps the reason in the timing record.
- **Recommendation:** C. The first recommendation was B, which rested on a
  perf 6 file that C does not need. The line also tells the user where to
  delete a stale entry.
- **Action:** ask the user, because condition 5 holds: the item lists this
  as an open decision, and C changes the terminal output.

### 8. Timing record of the cache outcome

- **Severity:** Low. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-render/src/bundle_attempt.rs`,
  `docs/protocol/mokly-timings.md`.
- **Background:** Perf 5 added a `cache` field to `css.bundle` that names why
  the stylesheet cache missed. The core has no span for a `bundle` request.
  The timings page lists `catalogue.describe`, but no code emits it. The
  sidecar's own `sidecar.bundle` record cannot know the store outcome. With
  decision 1 A the pool sees only that the sidecar compiled, so an input
  change and a toolchain change both read `stamp-mismatch`. Every option
  keeps the privacy rule of timing records and the rule that the timing
  flag does not change caching, both from `mokly-timings.md`.
- **Problem:** A reader of the timing records cannot see why a restart
  compiled.
- **Impact if no action:** A slow restart needs a throwaway build to
  diagnose, as perf 5 did.
- **Root question:** Where does a timing reader find why a `bundle` request
  compiled or was served from a cache?
- **Options:**
  - **A.** A new core span `catalogue.bundle` around each core `bundle`
    request: the lookup, the restore, the sidecar request, and the write. Its
    `cache` field is `hit`, `memory`, `no-record`, `stamp-mismatch`,
    `version-mismatch`, `damaged`, or `unavailable`. The page defines the
    field for each stage, because on `css.bundle` it names only a miss.
    Remove the `catalogue.describe` row and its allow-list entry, which no
    code emits. Effort: Large.
  - **B.** Emit the documented `catalogue.describe` span and put the same
    `cache` field on it. The span then also holds the class maps and the
    describe call. Effort: Large.
  - **C.** Put the field on the sidecar's `sidecar.bundle` record. The pool
    passes the outcome in a new optional `bundle` parameter, which the
    `reuse` settings must ignore. Effort: Large.
  - **D.** The pool emits the span itself, around the lookup, the restore,
    the sidecar request, and the write. The result needs no outcome field,
    and `crates/mokly-render` does not change. The span leaves out the
    pool's queue wait and uses a pool stage name. Effort: Large.
- **Left out:** A counts record of hits and misses fails the goal, because
  it gives no reason for each request.
- **Wider fix:** None.
- **Previous examples:** Perf 5, decisions 3 and 4, the `cache` field of
  `css.bundle`. The `action` field of `review.base-extraction`.
- **Related:** Item 7: the reason is the same in every option of item 7.
  Item 6: its option D gives a release change the `version-mismatch` reason.
- **Recommendation:** A. The span measures the whole time that the core
  waits for a bundle, and the stale row goes.
- **Action:** ask the user, because condition 5 holds: the item lists the
  timing record as an open decision.

### 9. Tests against the item's list

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Test.
- **Location:** `tests/sidecar_generation_reuse.test.ts`,
  `crates/mokly-render/tests/integration/watch_metadata_tests.rs`,
  `crates/mokly-compare/src/_tests_/cache_tests.rs`.
- **Background:** The item asks for tests of a hit, a miss for each input
  kind, a version mismatch, a damaged entry, eviction under the byte bound,
  and two writers. The `testing` skill tests each requirement once, at the
  lowest level that fails without the change. Tests already cover the input
  kinds of the `reuse` check: module bytes, ancestor manifests, tsconfig
  files, the React manifest, preview candidates, and directory membership.
  The stored path goes through the same check. Every option keeps a test for
  each new requirement, from the `testing` skill.
- **Problem:** A stored-path test for each input kind repeats the existing
  tests of the same check. The replace operation of decision 6 is new code
  on the eviction path.
- **Impact if no action:** The test plan stays open, or the suite gains
  about eight slow tests with real sidecars.
- **Root question:** Which tests protect the new behaviour once, at the
  lowest level that fails without the change?
- **Options:**
  - **A.** One test for each new requirement: a hit in a fresh process, one
    stored-path miss for a changed source, the toolchain miss, a version
    mismatch, a damaged entry, two writers of one key, and the `cache` field
    of a real span. Eviction keeps its existing tests. Effort: Small.
  - **B.** The item's list as written: a stored-path miss for each input kind
    and an eviction test for the new kind. Effort: Small.
  - **C.** As A, plus one case in the existing cache eviction test: a replace
    that goes past the bound evicts the least recently used other entry.
    With decision 4 D, add one case for each new input kind to the existing
    reuse tests, because each kind has its own recording code. Effort: Small.
- **Left out:** A Serve test that reads timing records is higher than
  needed, and C covers the same rules at a lower level.
- **Wider fix:** None.
- **Previous examples:** Perf 5, decision 16: a test subscriber reads the
  `cache` field of real spans.
- **Related:** Item 6: its replace operation needs the eviction case. Item 4:
  its option D adds the input cases. With 6 D, the version-mismatch test
  also covers an entry from another release.
- **Recommendation:** C. The first recommendation was A. A replace that
  skips eviction passes every test of A.
- **Action:** ask the user, because condition 1 holds: the recommended option
  changes the test list of the task message.

## Design of the recommended options

This section assumes options 1 A, 2 A, 3 A, 4 D, 5 A, 6 D, 7 C, 8 A, and 9
C. It changes when the user chooses other options.

### Flow of one `bundle` request

1. The pool runs its existing in-process seed. When no live compilation of
   the same settings exists, it asks the bundle store for the entry of the
   request's settings. The store reads the first line and rejects another
   format or Mokly version without a parse. It checks the payload digest.
2. On an entry, the pool sends `restoreGeneration` to the worker. It records
   the restored generation in the slot as stale, so that the next cleanup
   disposes it unless the result takes its id. A failed restore counts as a
   damaged entry.
3. The pool forwards the `bundle` request. The sidecar's `reuse` check
   accepts the restored compilation, or the sidecar compiles.
4. The pool compares the runtime key of the result with the restored one.
   An equal key is a hit. A different key means that the sidecar compiled.
   After a compile, the pool stores the new envelope and replaces the old
   entry.
5. The pool returns the outcome with the result, in a field that never
   crosses the wire, as `epoch` does. The core's bundle call records it on
   the `catalogue.bundle` span. A damaged entry or an unusable directory
   prints one warning line, and the first opened cache prints the directory
   line.

### Components

- `packages/mokly/src/sidecar`: the toolchain identity, computed once in
  each process. `bundle-recipe.ts` records it and hashes it into the
  compilation identity. `resolution-inputs.ts` records the peer manifests,
  the `jsconfig.json` candidates, and the tsconfig `extends` chains.
  `compiled.ts` compares the toolchain in `reuse`.
- `crates/mokly-sidecar/src/compiled.rs`: the `toolchain` field of
  `CompiledGeneration`, with the generated TypeScript type.
- `crates/mokly-sidecar`: a `BundleStore` boundary with `load` and `save`,
  the outcome type, the pool seed and the pool write.
- `crates/mokly-compare`: the `bundles` kind, the replace operation, the
  entry codec, and the store over the cache.
- `crates/mokly-cli`: the store composition in `render_runtime.rs`. One
  once-only cache reporter for each command, shared by the bundle cache and
  the base caches, through `entry_serve.rs`, `serve_services.rs`,
  `serve_delivery.rs`, `static_setup.rs`, and `changes_runtime.rs`. The
  warning line. The timing allow-lists in `serve_trace_stages.rs` and
  `serve_trace.rs`.
- `crates/mokly-render/src/bundle_attempt.rs`: the `catalogue.bundle` span.

### Design calls

These are my calls, made on 2026-10-30 under the decision test.

1. The `reuse` check digests the consumed files in parallel. Reason: the
   check over 2,753 files falls from about 0.4 s to 0.2 s here, also for
   in-process reuse.
2. The pool stores the entry before it returns the result. Reason: tests
   stay deterministic, and no write stays in flight at exit. Milestone 5
   measures the cost on a miss. A cost above 100 ms reopens this call.
3. The entry carries a SHA-256 digest of its payload, and a hit checks it.
   Reason: a damaged file never reaches a worker. The existing kinds trust
   their receipts because they hold large trees. One 3 MB file hashes in
   about 10 ms.
4. The key is the SHA-256 digest of the bundle parameters without
   `evaluation`, as the pool serializes them. Reason: the parameters include
   the source root, so each side and each extraction gets its own key.
5. A failed bundle stores no entry.
6. The change touches no perf 6 file. The bound of the new kind needs no new
   field in the cache composition of
   `crates/mokly-cli/src/base_dependencies.rs`. `mokly-runtime.md` lists the
   OS caches as two kinds. When perf 6 has merged before the last merge of
   `origin/main`, this branch adds the bundle cache to that sentence.
   Otherwise a follow-up item does.
7. `crates/mokly-catalogue/src/preparation.rs` does not change, as
   correction 1 says.

## Milestone 1: Documentation and protocol

Depends on: none

The protocol pages state the requirements and the decisions in force for
the work below. Each changed page carries the status line of the repository
rules until Milestone 5.

- [ ] `docs/protocol/mokly-sidecar-modules.md`, "Compiled Recipes And
      Release": the toolchain identity in the recipe, in the identity, and in
      the reuse rule. The new recorded inputs: peer manifests,
      `jsconfig.json` candidates, and tsconfig `extends` targets. The binary
      keeps the latest compilation of each bundle setting in the OS cache,
      and a later process restores it only through the same input check.
- [ ] `docs/protocol/mokly-watch.md`: the resolution inputs that invalidate
      compilation reuse. The render-key rule for peers stays.
- [ ] `docs/protocol/mokly-base-cache.md`: the bundle kind, its bound, the
      entry header with the format and Mokly versions and the payload digest,
      the hit that checks the digest, the replace rule, the rejection of
      other versions, the damaged-entry rule, and the reset by deletion.
- [ ] `docs/protocol/mokly-terminal-cache.md` and
      `docs/protocol/mokly-terminal-output.md`: the directory line for the
      bundle kind, and the warning line of decision 7.
- [ ] `docs/protocol/mokly-format-versions.md`: a row for the bundle cache
      entry, version 1, with a reader that requires 1.
- [ ] `docs/protocol/mokly-timings.md`: the `catalogue.bundle` span and its
      `cache` values, the field's meaning for each stage, the removal of the
      `catalogue.describe` row, and a budget row for the bundle cache bound.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Toolchain identity and recorded inputs

Depends on: 1

- [ ] Add the `toolchain` field to `CompiledGeneration` in
      `crates/mokly-sidecar/src/compiled.rs`, and regenerate the TypeScript
      type.
- [ ] Compute the toolchain identity once in each sidecar process. Record it
      in `bundle-recipe.ts`, and hash it into the compilation identity. Make
      `reuse` in `compiled.ts` require an equal toolchain, and digest the
      inputs in parallel.
- [ ] Record the peer manifests, the `jsconfig.json` candidates, and the
      tsconfig `extends` chains in `resolution-inputs.ts`.
- [ ] Tests with a real sidecar: a fresh sidecar that restores a recipe with
      an equal toolchain and unchanged inputs bundles with no esbuild
      operation. With another toolchain it compiles once. Add one case for
      each new input kind to the existing reuse tests. See each fail first.
- [ ] Update the Key Code of `packages/mokly/README.md`.

## Milestone 3: The bundle kind of the OS cache

Depends on: 1

- [ ] Define the `BundleStore` boundary and its outcome type in
      `crates/mokly-sidecar`.
- [ ] Add the `bundles` kind with its 512 MiB bound, the replace operation
      under the entry lock, the entry codec version 1 with the format
      version, the Mokly version, and the payload digest, and the store over
      the cache in `crates/mokly-compare`.
- [ ] Tests: an entry of another format or Mokly version that the reader
      rejects before the payload, a damaged entry, two writers of one key
      that never expose a partial entry, and a replace past the bound that
      evicts the least recently used other entry. See each fail first.
- [ ] Update `crates/mokly-compare/README.md` and
      `crates/mokly-sidecar/README.md`.

## Milestone 4: Pool restore, write, composition, output, and timing

Depends on: 2, 3

- [ ] The pool seeds the worker from the store, forwards the request,
      compares the runtime keys, stores the envelope after a compile, and
      returns the outcome.
- [ ] Compose the store in `crates/mokly-cli/src/render_runtime.rs`.
- [ ] Share one once-only cache reporter for each command between the bundle
      cache and the base caches, and print the warning line of decision 7.
      Follow the `product-ui` skill for the warning text.
- [ ] Emit `catalogue.bundle` with `cache` in
      `crates/mokly-render/src/bundle_attempt.rs`. Add the stage and the
      values to `serve_trace_stages.rs` and `serve_trace.rs`. Remove the
      `catalogue.describe` allow-list entry.
- [ ] Tests: pool unit tests with a fake worker and a fake store for the
      request order, a write after a compile only, and a failed restore. One
      integration test with a real sidecar and a temporary cache: a second
      process bundles with no esbuild operation, and after a consumed file
      changes it compiles once and replaces the entry. A test subscriber
      reads the `cache` field of the real span for a hit and a miss. A test
      of the directory line and the warning line. Run each new test 10
      times.
- [ ] Update `crates/mokly-render/README.md` and `crates/mokly-cli/README.md`.

## Milestone 5: Measurement, proof, and smoke test

Depends on: 4

- [ ] Measure with the method of the brief, interleaved with `origin/main`:
      three warm runs, the edit run, and the React fixture. Save the output
      under `.context/bundle-disk-cache/`.
- [ ] Prove once that `mokly build --strict` output with a cache hit is
      byte-identical to a cold build. Save the proof under `.context/`.
- [ ] Smoke test: restart Serve on `examples/basic`, open the catalogue, and
      check a JavaScript screen and its Changes view.
- [ ] Remove the status lines from the protocol pages.
- [ ] Merge `origin/main`. When perf 6 has merged, measure again, and apply
      design call 6 to `mokly-runtime.md`.

## Milestone 6: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5

- [ ] Run `cargo xtask check --suite repository` early, then the complete
      gate `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request with `gh pr create --base main`. Its description
      gives the before and after table, the decisions and the design calls
      of this plan with their dates, a permalink to this plan, and the
      follow-up items that the change adds.
- [ ] Merge `origin/main`, wait for CI, and send the orchestrator the ready
      line.

## Post-merge follow-up (non-blocking)

- [ ] Keep the stylesheet cache across restarts, for the CSS Modules class
      maps and for graph preparation. It holds most of the startup time that
      this plan leaves. It carries the 1.5 s target of the item, with an
      estimate of about 1.2 s on the baseline machine. This task follows
      decision 2 A.
- [ ] When perf 6 merges after this plan, add the bundle cache to the cache
      sentence of `docs/protocol/mokly-runtime.md`, as design call 6 says.
