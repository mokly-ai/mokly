# Bundle Disk Cache

Status: Active. Approved for implementation on branch
`calummoore/lisbon-h906`. No pull request exists yet. The pull request into
`main` deletes this plan. The nine decisions below were answered on
2026-11-16. The performance orchestrator owns the merge.

On each Serve start and each `build`, the core asks the sidecar to bundle
every JavaScript entry with esbuild and then to describe the bundle. The
core's sidecar pool keeps each compiled bundle in memory, and the sidecar
reuses a live compilation while its inputs do not change. Nothing survives a
restart, so every start compiles again. On this machine the head bundle costs
2.8 s of the 6.6 s `serve.ready`, and the base side of the first Changes
classification compiles again for about 3.2 s. This plan is perf 7, finding
10 of the 2026-10-27 performance profile.

The approved approach keeps the latest compiled bundle of each bundle
setting in the OS cache directory. Before a `bundle` request, the core's pool
installs the stored bundle in the worker with the existing
`restoreGeneration` request. The sidecar's `reuse` input check then accepts
it or compiles. The check also gains the inputs that it misses today and the
identity of the toolchain that compiled the code. The pool offers each
complete and durable served bundle to the store. The store skips a write when
its current receipt names that compilation. Both comparison sides use it,
because they share one pool. The plan does not cache the describe result, the CSS Modules class
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
  [mokly-render](../crates/mokly-render/README.md),
  [mokly-cli](../crates/mokly-cli/README.md), and, under call 30,
  [mokly-platform](../crates/mokly-platform/README.md).

## Historical baseline

These measurements are the original plan evidence, not measurements of this
workspace. The current release baseline and the after measurements are in
`.context/bundle-disk-cache/`.

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

The performance orchestrator answered all nine items on 2026-11-16. The
user gave these decisions to that orchestrator. The user asked to keep
optimising the speed and reliability of Changes, to merge the performance
work in several pull requests without asking, and to make no change that
can exhaust memory or disk. That instruction is the reason for each
answer. This branch must not merge its pull request.

Terms that two or more items use:

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
| 4   | Key and recorded inputs            | Design | Medium   | Large  | F, first A  |
| 5   | Base side entries                  | Design | Medium   | Small  | A           |
| 6   | Storage format and bound           | Design | Medium   | Large  | F, first A  |
| 7   | Cache output in the terminal       | Design | Low      | Large  | C, first B  |
| 8   | Timing record of the cache outcome | Design | Low      | Large  | A           |
| 9   | Tests against the item's list      | Design | Low      | Medium | D, first A  |

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
- **Answer:** A, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply A. The recorded answer authorizes it.

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
  - **E.** As A, but measure against the current release baseline. Report
    the observed gain and require no warm compile. The old absolute gain
    belongs to its recorded machine. Effort: Small.
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
- **Answer:** A, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply A. The recorded answer authorizes it.

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
- **Answer:** A, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply A. The recorded answer authorizes it.

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
    `dist/` in this repository keeps version 0.19.0.
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
- **Root question:** How does a later process prove that a stored compile
  equals a fresh compile of the current files, package layout, and toolchain?
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
    stays. The sidecar repeats part of esbuild's `extends` resolution. An
    incomplete input record must not permit reuse. D also closes these gaps
    for in-process reuse. Effort: Large.
  - **E.** As D for the peers and `jsconfig.json`, without `extends`
    resolution. A compilation that read a tsconfig with `extends` stays in
    memory and is never stored. `examples/basic` reads such a tsconfig, so
    it would never hit. Effort: Large.
  - **F.** As D, plus package lookup candidates and real targets for bundled
    packages and peers. Include absent candidates and configured lookup
    roots. Continue reuse-only metadata candidates to the filesystem root.
    Incomplete evidence disables reuse. Effort: Large.
  - **G.** As D, plus package-manager install state files. This misses a
    manual package-link change. Effort: Medium.
  - **H.** As D, but resolve imports again with esbuild before reuse. This
    performs an esbuild operation on each hit and fails the current goal.
    Effort: Large.
- **Left out:** A check by file size and modification time in place of
  digests is faster, but it breaks the reuse rule, because an edit that
  keeps both values passes.
- **Wider fix:** F. Every later reuse path checks content and lookup evidence.
- **Previous examples:** None found.
- **Related:** Item 1: A and D suit decision 1 A and C. Decision 1 B and D
  need B. Item 6: its option D keeps another release's entries unparsed.
  Item 9: D adds one test case for each new input kind.
- **Recommendation:** F. The current options check widened D to cover
  lookup evidence. The earlier recommendations were D, then A. The approved
  no-stale-code rule covers this correction.
- **Answer:** D, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply D. The recorded answer authorizes it.

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
- **Answer:** A, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply A. The recorded answer authorizes it.

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
  - **F.** As D, with one nonblocking attempt for each store lock. Held
    locks miss or skip the write. Reserve room and retire the old entry
    before staging its replacement. Store errors never become bundle
    failures. Complete and staged data stay within 512 MiB. Effort: Medium.
- **Left out:** Memory only fails the goal.
- **Wider fix:** D. All kinds then share one set of cache rules, and no
  release reads the entries of another.
- **Previous examples:** The `sources` and `dependencies` kinds in
  `crates/mokly-compare/src/cache.rs`.
- **Related:** Item 7: the payload digest gives the damaged reason. Item 4:
  D keeps another release's entries unparsed before the sidecar compares
  the toolchain. Item 9: the replace operation needs one eviction case.
- **Recommendation:** F. The current options check widened D to cover lock
  contention and replacement bytes. The earlier recommendations were D,
  then A. This keeps the approved best-effort cache and byte bound.
- **Answer:** D, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply D. The recorded answer authorizes it.

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
- **Answer:** C, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply C. The recorded answer authorizes it.

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
  - **E.** As A, plus nested store read and write spans. A one-time probe
    can also measure the write cost without more product spans. Effort: Small.
- **Left out:** A counts record of hits and misses fails the goal, because
  it gives no reason for each request.
- **Wider fix:** None.
- **Previous examples:** Perf 5, decisions 3 and 4, the `cache` field of
  `css.bundle`. The `action` field of `review.base-extraction`.
- **Related:** Item 7: the reason is the same in every option of item 7.
  Item 6: its option D gives a release change the `version-mismatch` reason.
- **Recommendation:** A. The span measures the whole time that the core
  waits for a bundle, and the stale row goes.
- **Answer:** A, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply A. The recorded answer authorizes it.

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
  - **D.** As C, plus focused cases for the corrected rules: package and
    peer link retargets with the old targets present, metadata above the
    source root, reuse metadata that keeps render keys stable, a toolchain
    change outside the entry file, held locks, foreign-entry warnings, and
    a revert that updates disk. Use directory junctions on Windows where
    required. Skip no test. Effort: Medium.
- **Left out:** A Serve test that reads timing records is higher than
  needed, and C covers the same rules at a lower level.
- **Wider fix:** None.
- **Previous examples:** Perf 5, decision 16: a test subscriber reads the
  `cache` field of real spans.
- **Related:** Item 6: its replace operation needs the eviction case. Item 4:
  its option D adds the input cases. With 6 D, the version-mismatch test
  also covers an entry from another release.
- **Recommendation:** D. The current options check adds cases for the
  covered safety corrections. The earlier recommendations were C, then A.
  Test each changed requirement at its lowest level.
- **Answer:** C, 2026-11-16, by the performance orchestrator.
  Reason: the user delegated the choices to keep Changes fast and reliable,
  with no change that can exhaust memory or disk.
- **Action:** fix now, apply C. The recorded answer authorizes it.

## Design of the approved options

The approved options are 1 A, 2 A, 3 A, 4 D, 5 A, 6 D, 7 C, 8 A, and 9 C.

### Flow of one `bundle` request

1. The pool runs its existing in-process seeds. When no live or released
   complete recipe of the same settings is available, it asks the store for the entry of the
   request's settings. The store reads the first line and rejects another
   format or Mokly version without a parse. It checks the payload digest.
2. On an entry, the pool sends `restoreGeneration` to the worker. It records
   the restored generation in the slot as stale, so that the next cleanup
   disposes it unless the result takes its id. A failed restore counts as a
   damaged entry.
3. The pool forwards the `bundle` request. The sidecar's `reuse` check
   accepts the restored compilation, or the sidecar compiles.
4. The pool compares the runtime key of the result with the disk seed and
   every memory compilation available to the worker before the request.
   A match with a memory seed is `memory`. A match with a disk seed is
   `hit`. No match means that the sidecar compiled. The pool offers each
   complete and durable served envelope to the store, under call 30. The
   store skips a write only when the current receipt names that compilation,
   under current call 26. A core fast-path hit sends the same
   served-generation notice to the pool.
5. The pool returns the outcome with the result, in a field that never
   crosses the wire, as `epoch` does. The core's bundle call records it on
   the `catalogue.bundle` span. A damaged, unreadable, or foreign entry
   prints one warning line. An unusable directory also warns. The first
   opened cache prints the directory line.

### Components

- `packages/mokly/src/sidecar`: the toolchain identity, computed once in
  each process. `bundle-recipe.ts` records it and hashes it into the
  compilation identity. `resolution-evidence.ts` and `config-inputs.ts`
  capture reuse-only resolution, peer, and configuration evidence through
  the bounded owner in `physical-inputs.ts`. `resolution-inputs.ts` keeps
  the existing render-key and watch metadata. `compiled.ts` compares the
  toolchain and evidence in `reuse`. The capture owner also records the
  witnesses of call 30, runs its barrier, and sets `durable`.
- `crates/mokly-sidecar/src/compiled.rs`: the `toolchain` field of
  `CompiledGeneration` and typed physical evidence, with generated
  TypeScript types. The render core checks that evidence through
  `crates/mokly-render/src/physical_inputs.rs` on its own fast path.
- `crates/mokly-sidecar`: a `BundleStore` boundary with `load` and `save`,
  the outcome type, the pool seed and the pool write. Under call 30, `load`
  returns and `save` accepts only the durable-recipe type. The pool sends
  the private capture hint in `hello` only when it keeps a store.
- `crates/mokly-platform`: the local volume enumeration of macOS and
  Windows for that hint, under call 30.
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

### Current-code corrections: my calls, 2026-11-16

8. Keep the current memory lookup before the disk lookup. The live recipe
   and last released recipe already use `restoreGeneration` and the same
   `reuse` check after commit `2ca577425`. Read disk only when neither is
   available. Give a disk seed its own worker generation name. Keep the
   existing 64 MiB released-recipe bound and cleanup rules. Reason: this
   preserves the newer lifetime contract and avoids redundant disk IO.
9. Bound parallel input hashing and cache-entry reads. Use a fixed worker
   count for file digests. Reject an oversized entry before allocating its
   payload, using the existing restore-envelope frame limit. A partial
   input record must not enable reuse. Reason: the approved no-stale-code
   rule and the user's resource constraint cover these details.
10. Update the OS cache statements in `mokly-runtime.md` in this change.
    There is no need to wait for the other performance branch. This
    supersedes the deferral in call 6. Keep both changes when `main`
    advances. Reason: the current runtime page names only the source and
    dependency caches and must describe the added cache.
11. Keep milestones 2 and 3 sequential in this workspace. Reason: the user
    requested the milestones in order, and both can change sidecar types.
12. Use the current release baseline on this machine for the before and
    after comparison. Keep the old baseline above as history. Preserve
    baseline artifacts for interleaved runs. Reason: elapsed times from a
    different machine and version cannot prove the gain here.

13. Warn for a foreign entry as well as a damaged or unreadable entry.
    Keep these warnings outside strict-build diagnostics. Reason: the
    current task explicitly requires warning, rebuilding, and continuing
    for all three cases.

14. Record complete conservative resolution evidence for bundled imports
    and peers. Cover relative paths, extensions, index files, `paths`,
    `baseUrl`, package levels, and configured lookup roots. Keep absent
    directories, entry kinds, and real link targets. Continue reuse-only
    configuration candidates above the source root to the first present
    candidate or filesystem root. Reject reuse and disk writes when the
    evidence is incomplete. Use directory junctions on Windows. Skip no test.
    Reason: a package link can move
    while the old package remains, and every old file digest then matches.
    This applies option 4 F of the current options check as a correction
    within the approved no-stale-code requirement.
15. Keep new reuse evidence separate from render-key inputs. Check it on
    both the sidecar reuse path and the core's bundle fast path. One typed
    physical evidence list serves both checks. The Rust check uses a
    filesystem boundary outside the logical side tree. Failed reads cannot
    equal recorded absence. Keep conservative directory evidence out of
    compilation identity. Hash metadata that can change code into identity.
    The toolchain identity includes the Mokly, esbuild, and Node versions,
    every installed `dist/` program file, and the real package root.
    Preserve the exhaustive
    render-key rule and peer-manifest rule. Reason: putting all new metadata
    into the render-key map changes an independent contract, while checking
    it only in the sidecar lets the core bypass the check.
16. Store the served recipe when it differs from the last disk record,
    including a recipe that memory reuse serves after a revert. This
    supersedes the compile-only write rule. The core notifies the pool
    when its fast path serves a live generation. Reason: a restart must reuse
    the current unchanged sources after an edit and a revert as well.
17. Use one nonblocking lock attempt for each bundle-store lock. A held
    entry lock misses or skips the write. A held namespace lock on a read
    keeps the hit and skips only the access-order update. The store uses
    command or pool cancellation, never base-preparation cancellation.
    Store failures, including cancellation, never become bundle failures. Reason: the optional cache must not hold
    a command behind a suspended cache writer. This applies option 6 F of
    the current options check within the approved best-effort cache rule.
18. Reserve room before writing a bundle entry. Retire the replaced entry
    and evict other unleased entries before staging the replacement. Count
    complete and staged bundle data under the 512 MiB bound. Record each
    stage reservation under the namespace lock before writing data. Count
    other writers' stages. Delete trash before staging or count its bytes.
    Reason: the user's disk bound covers replacement work and final entries.

19. Measure the gain against this workspace's current release baseline.
    Keep the historical 2.0 s gain from a 6.6 s restart as history. Require
    zero warm compiles and byte-identical strict output, as the current task
    states. Count esbuild operations as well as compile spans for both
    sides. Report the observed time gain without a new elapsed-time gate.
    Reason: the current warm head bundle takes less than 2.0 s, so removing
    it cannot produce the old absolute gain on this machine. This applies
    the machine correction of option 2 E as my call under the current task.

20. Use one recoverable entry warning for damaged, unreadable, and foreign
    entries. Use one directory warning when the store becomes unavailable.
    Map another format or Mokly version to `version-mismatch`. Map damaged,
    unreadable, or wrong-settings entries to `damaged`. Map held entry locks
    and unusable directories to `unavailable`. Reason: these are the approved
    seven outcomes, and all entry faults require the same rebuild action.
    The warning text is in the terminal cache contract. The directory line
    still follows the approved first-bundle-lookup rule of decision 7 C.
    The options check chose D: one exhaustive store outcome type maps each
    read or write to its timing value, warning, and store state. Retire a
    still-rejected entry after one exclusive lock attempt, after checking
    that no other writer replaced it. This prevents repeated warnings when
    compilation fails or cannot store complete evidence. Contention, lack
    of room, incomplete evidence, and cancellation stay silent. Filesystem
    or platform faults outside an entry disable the store for the process.
    A failed disk restore stops using that seed. A transport failure uses
    only the pool's existing exchange recovery, without the rejected seed.
    No new retry is added. Alternatives: B removes rejected entries without
    a shared outcome mapping. C tracks rejected keys in memory. E adds a
    `busy` timing value. D prevents disagreement between output and timing
    without another timing value or an unbounded rejected-key set.

21. Bound cache-only evidence at 8 MiB and optional config reads at 1 MiB.
    Use four streaming file-hash workers. Bound recursive config and export
    inspection and queued resolution observations too. Omit evidence and
    mark it incomplete when these limits or the remaining restore-frame
    space cannot hold it. Compilation still proceeds. Reason: these
    internal limits enforce call 9 without rejecting valid source code or
    allocating a restore frame for cache evidence alone. Unbounded reads
    break the resource constraint. Frame-sized evidence would retain much
    more memory for inputs that can safely miss instead.
    Apply options G and D from the check. One physical-evidence owner bounds
    retained observations, parsed metadata, visited paths, and unique
    request keys, each at 8 MiB. It owns metadata reads and directory checks.
    Queue each unique request once. Remove the schedule-dependent in-flight
    count. Stop a directory check as soon as its entry count exceeds the
    record. Before storing, check both the whole stored file and the actual
    encoded disk-seed request against their read and wire limits. Oversized
    writes skip silently. Alternatives A, B, and C fix those bounds
    separately. F replaces directory records with digests. G keeps the
    current shared evidence shape and one owner, while D avoids a fragile
    fixed size margin. Measure capture and fast-path costs under E in
    Milestone 5. Use the observed cost to assess scheduling, without adding
    an elapsed-time gate.

22. Give each incomplete compilation a fresh identity by including its
    private runtime key. Apply the same rule when the frame budget drops
    evidence. Complete recipes keep deterministic identities. Apply option
    A from the check: hash each resolved peer's real path and manifest, and
    present `tsconfig.json` and `package.json` candidates above the source
    root, into that identity. Keep these outside render-key and watch
    metadata. Reason: equal ids let the core keep old definitions, the pool
    share an old recipe, the sidecar replace per-id state, and whole-bundle
    views keep old renders. An input that changes code or evaluation must
    give a new id. This follows the existing generation-id contract.
    Hashing normalized compiler output cannot detect changed peer evaluation
    and would permit reuse of an incomplete compilation. Giving every
    compile a fresh identity is option B. It adds a describe and whole-bundle
    renders after harmless directory changes. Finishing every unsupported
    resolver form cannot cover failed or oversized reads. Add a real peer
    change regression that reaches a new identity and describe.

23. Ignore incomplete recipes when selecting a memory seed for a bundle
    request. Keep old-generation restoration for existing graph and render
    lifetimes. Do not retain an incomplete recipe solely for release-time
    bundle reuse. Reason: the reuse check cannot accept it, and selecting it
    would also hide a usable disk record. The complete-evidence rule already
    rejects reuse and writes. This applies that rule before optional seeding
    and retention. Apply checked option B, confirmed by the user on
    2026-11-16: one reusable-recipe type admits
    only complete evidence. The released store, seed selection, and disk
    writes use that type. Live generations keep the plain recipe for explicit
    restoration. An incomplete release first removes the older record of
    equal settings, then retains nothing, as an oversized release does.
    This preserves the last-release rule. Keep the completeness guard outside
    the shared explicit-restoration functions. Test both skipped optional
    seeding and successful explicit restoration of an incomplete generation.
    Alternatives: A applies separate guards. C keeps an older complete
    release and changes the last-release rule. Keep the seed and fall through to disk only
    after its rejection, which adds restoration work. Remove all incomplete
    generations, which breaks live graph lifetimes. Keep memory-first lookup
    for complete recipes and the existing released-recipe byte bound.

24. Use 256 fixed entry-lock stripes for the bundle kind, indexed by the
    first byte of its SHA-256 settings key. Use one separate namespace lock.
    Every read, replacement, eviction, stage cleanup, and invalidation uses
    the same mapping. A collision misses or skips without waiting. Leave
    source and dependency locks unchanged. Reason: lock files for every
    settings key grow without a bound as source roots change. Fixed stripes
    bound lock metadata and active stages and add no outcome value.
    Deleting per-key lock files can split one logical lock across two file
    identities. A single global entry lock adds unnecessary contention.
    Alternatives: one global lock, or a bounded registry that assigns locks
    to keys and requires another lifetime protocol. The existing best-effort
    contention rule and resource bound settle this internal choice.
    Apply checked A: one function maps every kind and key to its lock path.
    A bundle lock ends inside its store call. Close the read file and release
    its lock before restore or invalidation. An exclusive writer may evict
    other keys of its own stripe without taking its own lock again. The old
    kinds retain per-key locks because they wait and keep long leases.
    Stripes could make a build wait for an unrelated lease, including its
    own. The stripe layout is fixed for the `bundles` directory. A future
    layout change needs another directory. State this in code and the compare
    README, and scope the protocol's key-independence rule to the old kinds.

25. Give each publication a fresh 256-bit nonce in its bundle-only receipt.
    The rejected-entry token carries that nonce and ignores the access
    sequence. Invalidation takes one exclusive lock attempt and removes only
    the matching publication. Apply checked A: after the exclusive attempt,
    also remove an entry whose receipt is still damaged or unreadable. A
    replacement with a complete entry stays. Each receipt touch keeps its
    nonce. Release the shared read lock before the exclusive attempt.
    Keep the bundle data header and the old kinds' receipts unchanged.
    Reason: access sequences change on reads and can repeat after cache
    deletion. A nonce also distinguishes equal payloads after replacement or
    namespace recreation. A platform randomness failure disables the optional
    store through its existing fault outcome. Alternatives: a durable
    monotonic counter plus a random namespace incarnation adds recovery and
    overflow state. Comparing a header alone can remove another writer's
    replacement. This applies call 20's matching-publication retirement rule.
    The base-cache protocol names the bundle publication id and the complete
    replacement rule. The old kinds' receipt shape stays unchanged.

### Pool publication correction: my call, 2026-11-17

26. Apply checked option G. The bundle receipt holds the SHA-256 digest of
    its compilation's runtime key. The store owns write elision. It checks
    that bounded receipt under one nonblocking shared stripe attempt before
    it encodes a served recipe. An equal digest returns `Unchanged`. A held
    stripe skips. Otherwise the existing replacement rules apply. Receipt
    touches preserve the digest. The pool offers every complete served
    recipe and retains no publication table. Keep legacy receipts unchanged.
    Reason: completion order, eviction, another process, and cache deletion
    can each invalidate a pool record. A receipt check removes that stale
    record and keeps the existing storage requirement. No IO runs under the
    pool mutex. This supersedes the own-record interpretation of call 16.
    The options check changed my first choice A to G on 2026-11-17.
    Alternatives: A forgets pool records after overlapping operations.
    B uses a nonblocking operation gate and skips overlaps. C always writes.
    D limits A's overlap tracking to each key. E checks a pool publication
    token against the receipt. F moves that token table into the store.
    H updates pool records through a callback under the stripe lock. A and D
    leave eviction, another process, and deletion uncovered. B loses writes.
    C adds a full write to each hit. E, F, and H keep a table and its lifetime.
    G adds one bounded receipt read and removes that lifetime. A to D are
    Small. E to H are Medium. The format is unpublished, so the bundle-only
    receipt field remains in schema 1. This correction belongs to open
    Milestone 4. Completed Milestone 3 remains history.

27. My call, 2026-11-17: apply checked option D. Hold the shared cache
    directory note only during head rendering in a static build. Start the
    hold at Rendering. The next phase start, or successful validation,
    releases the first held note before its own output and ends the hold.
    Release before the plain-mode and empty-warning returns. Discard an
    unreleased note on failure, cancellation, or drop. Outside that phase,
    notes remain immediate. Keep Serve immediate. Reason: this preserves
    both failed head-render stdout and the existing base-cache announcement
    timing. It keeps every existing assertion. Cache warnings still go to
    stderr and do not count as build warnings. This corrects the timing
    detail of decision 7 C and call 20 within the approved shared-line rule.
    Root question: when may build and publish print a head bundle's shared
    cache line while preserving failed head-render stdout and base-cache
    timing? Shared assumptions: the task preserves existing assertions, and
    decision 7 C keeps one plain stdout directory line for all three kinds.
    Serve has no strict mode. Options A to C also held base-cache lines, an
    assumption that the options check removed.
    A defers all static cache notes until validation. B holds the path in
    native composition until the command succeeds. C buffers all plain
    static stdout until success. D holds only head-render notes in the
    terminal owner. E routes a deferred bundle reporter and an immediate
    base reporter through one three-state announcement owner. F combines
    that routing with a flush before each durable stdout writer. A to D are
    Small. E and F are Medium. Recommendation D replaces the first A.
    A changes the existing immediate-note assertion and drops a base line on
    a later strict failure. C also delays the publish recovery-path line.
    D is the structural wider fix: a future cache kind opened during head
    rendering needs no extra wiring. E covers one more uncontracted failure
    path but adds reporter state and per-kind choices. F adds more flush
    points. Immediate stderr output breaks the stdout channel. Omitting the
    line breaks the shared announcement rule. Disabling the cache for strict
    builds removes the requested gain. Validation cannot precede bundling.
    The performance session supplied the checked D on 2026-11-17. No user
    choice remains open.

28. My call, 2026-11-17: apply checked F. An exact existing regular file
    records a bounded `FilePath` observation under its canonical path, with
    its existing logical-path links. It carries no content digest. Both
    readers require canonical keys for present `FilePath`, `File`, and
    `Directory` observations. Present preview probes use `FilePath`. Absent
    probes use `Absent`. Keep directory evidence for open lookups, missing
    files, directories, extensionless candidates, and the `.js` family that
    permits TypeScript substitutions. Keep all configuration and manifest
    checks. A later metadata read upgrades `FilePath` to `File` and charges
    only the byte difference. Source bodies stay with compiled inputs. CSS
    bodies stay with the stylesheet owner. A preview that compilation
    consumed keeps its compiler digest in both compiled and metadata inputs.
    Only unconsumed preview probes read a later body digest. A later read
    must not replace the digest of bytes that the compiler consumed.
    Reason: an unrelated empty directory must not reject an exact file
    selection. A new link must still reject reuse, even with equal bytes and
    old targets retained. Preview probes must not consume the metadata body
    budget. The existing two-compile and CSS reuse assertions stay.
    Root question: how does exact-file evidence preserve reuse after an
    unrelated sibling change while rejecting changed selection and links?
    Shared assumptions: the six preview candidates keep their order, as the
    code and sidecar protocol require. Every existing assertion stays, as
    the task requires. Complete evidence and byte bounds stay under calls
    9 and 21. The earlier assumption that only preview probes caused the
    mismatch was false. Exact renderer and CSS imports also captured the
    source-root listing. Call 14's conservative design needs no parent
    listing where the exact path wins before any alternative candidate.
    A uses file digests for fixed preview paths. Small. B adds a typed
    preview-selection record. Medium. C adds absent-or-empty semantics for
    that directory. Medium. All three leave the other exact lookups too
    broad. D uses canonical `File` digests for all exact files. Medium. It
    breaks CSS body reuse. E adds `FilePath` and canonical file checks.
    Medium. F extends E to canonical directories and body-free probes.
    Medium overall, Small beyond E. G adds a final mapping check against
    every esbuild edge. Medium. Its extra detection duplicates the pinned
    resolver's exact-file rule. Broad directory ignores fail the protocol.
    Changing the compile-count assertion is blocked. A second resolver run
    breaks the reuse contract. Recommendation F replaces my first A.
    F is the structural wider fix in the same capture owner and readers.
    No protocol requirement changes. The options check confirmed that no
    user decision is open.

29. My call, 2026-11-17: apply checked E. Let the virtual entry use the
    preview selection from the same bounded prepass that records its
    evidence. Reprobe only when evidence is already incomplete. Preserve
    consumed bytes through one metadata-digest helper at every post-compile
    digest site. Read a later digest only for an unconsumed file.
    Reason: a transient preview deletion can select the wrong virtual
    entry. A later metadata read can also replace the bytes that esbuild
    consumed, for a preview or an imported manifest.
    Root question: how does reusable code record the selected optional
    preview and the bytes that compilation consumed?
    Shared assumptions: preserve the six-candidate order and errors from
    the code and sidecar protocol. Keep best-effort compilation for
    incomplete evidence under calls 9 and 21. Preserve every assertion and
    the no-stale-code rule from the task. Do not add a retry. The former
    assumption that only deletion breaks coherence is false. A content edit
    after compilation also breaks it. The consumed digest must win, as the
    existing code comment and Rust stamp already require.
    A passes the captured selection to the virtual entry. Small. B moves
    selection and capture into the virtual-entry owner. Medium. C compares
    two selections and rejects evidence on disagreement. Small. D adds
    consumed-digest preservation for preview probes to A. Small. E applies
    D through one helper at all five post-compile metadata sites. Small.
    F makes the core select the preview and changes bundle parameters and
    keys. Large. F still needs D or E for consumed bytes. A and C alone
    leave the bytes race. B adds wiring for equal safety. E is the wider
    fix in the existing digest owners. Recommendation E replaces my first
    A. A typed selection reader would copy resolver rules. A post-compile
    presence check misses changes that were undone. Locks cannot stop
    external edits. A retry breaks the task. The checked E stays within
    the existing contract. No user decision is open.

30. My call, 2026-11-17: apply checked option F, with the adaptive compile
    maturity barrier and without the owned-root hint. Recommendation F
    replaces my first B and the interim B′ of the options check. The
    addendum of that check settled F on 2026-11-17. No user decision is
    open.

    Problem: the reuse evidence of a compilation must describe the
    filesystem view from which esbuild selected each module. Three windows
    broke that rule:

    - Transient window: a higher-priority candidate of an open lookup
      disappears while esbuild resolves, then returns before `finish()`.
      esbuild compiles the lower candidate. The evidence and the filesystem
      both show the higher candidate, so the evidence is complete for the
      wrong code.
    - Attempt window: each attempt of one `bundle()` call captured its own
      evidence. The planned attempt captured after the native attempt had
      selected its modules. A lasting change between the attempts then gave
      complete evidence for an old selection.
    - Cached-listing window: esbuild caches each directory listing at its
      first read, for the whole build. Under call 28, an exact-file lookup
      records no parent listing. A later open lookup in that directory
      records a newer listing. A lasting change between the two reads gives
      complete evidence for an old selection. A real esbuild 0.28.2
      regression confirmed the cached listing on Linux.

    Root question: how does a stored compilation prove that its evidence
    equals the filesystem view from which esbuild selected each module,
    without less in-process reuse than `origin/main` gives?

    Shared assumptions, with their sources:

    - The task and calls 9, 14, and 21 require no stale code, the warm
      restart, no retry, bounded capture, and the incomplete-evidence
      fallback. Every option keeps them.
    - `mokly-sidecar-modules.md` requires that the sidecar writes no file.
      Only C and G drop it, so both need the user.
    - The text of B let a witness clear `complete`. That reason is gone,
      because `complete` also gates in-process reuse and the identity.
      `origin/main` has no completeness check, and two `origin/main` tests
      assert its reuse. E and F drop the assumption.
    - The comment on `ResolutionEvidence` implies that capture precedes
      each esbuild read that it records. The attempt and cached-listing
      windows prove this false. E and F drop it.
    - The first draft assumed that only a transient change breaks the
      evidence. This is false. E and F cover both lasting windows.
    - The text of B took a nanosecond stamp field as proof of a fine clock.
      This Linux 6.8 kernel stamps from a coarse clock. E and F add an age
      guard.
    - The text of B assumed that Node can classify every volume. Node
      reports a file system type only on Linux. F drops the assumption.
    - Calls 28 and 29 prefer a capture that copies no resolver rule. This is
      a design preference, not a protocol requirement. So D may copy rules.

    Options:

    - A. Mark every open lookup incomplete. Small. It is safe, but package
      and extensionless imports lose the warm restart. It also removes the
      in-process reuse of `origin/main`.
    - B. My first choice. Capture bounded mutation witnesses with identity
      and fine change stamps. A changed or unreliable witness clears
      `complete`. Medium. It removes in-process reuse and deterministic
      identities on macOS and Windows. After a recent edit, it breaks two
      `origin/main` assertions. It misses both lasting windows. The interim
      B′ of the check kept these flaws.
    - C. Compile and capture from one immutable filesystem snapshot. Large.
      It prevents the class, but it needs sidecar file writes. It also
      moves source, dependency, and path ownership.
    - D. Bind each actual resolved winner to the captured candidates at the
      resolver boundary. Large. It keeps all reuse and may copy resolver
      precedence rules. A variant runs esbuild's own resolver over the
      captured view through `esbuild-wasm`. That adds a dependency and a
      file system shim.
    - E. B corrected. One evidence owner serves all attempts. Witnesses run
      from the first touch until after `finish()`, and they decide a new
      `durable` flag only. A private `hello` hint names the binary-owned
      cache root. Only Linux volumes qualify. Medium. The disk cache stays
      off on macOS and Windows, so the branch's disk-hit test fails on
      those CI jobs.
    - F. E, plus volume classes from Rust in the private `hello` hint for
      macOS and Windows. Large in total, and Medium beyond E. It needs a
      one-time proof of the stamp behaviour on each CI runner type.
    - G. Write the captured topology and metadata under a mirror root.
      Resolve each open edge there once with esbuild. A different winner
      blocks the store. Large. It needs sidecar file writes, a second
      resolve for each open edge, and the right to create links on Windows.
    - H. E with Linux inotify watches in place of stamps. Medium beyond E.
      Each compile needs thousands of watches from a per-user limit of
      65,536 here and 8,192 on older kernels. That can starve the watchers
      of Serve or an editor. macOS and Windows stay off.

    Left out:

    - A witness from mtime alone, or stamps without identity and a precision
      rule. tar, rsync, and `utimes` restore an mtime, and a coarse clock can
      repeat a stamp.
    - Multigrain stamps alone. They make a witness sound on Linux 6.13 and
      later. This machine runs 6.8, so the warm goal fails here.
    - A guard or witness that clears `complete`. It breaks the two
      `origin/main` assertions and removes their reuse. E and F are better
      on every point.
    - A wait for each recent stamp before esbuild reads it. The first check
      left it out as an open-ended sleep. The single bounded barrier that
      Cal proposed on 2026-11-17 replaces it.
    - Witnesses below the source root only. A flip of an ancestor
      `node_modules`, `package.json`, or `tsconfig.json` then stays unseen.
    - D without precedence rules, which requires a sole present candidate.
      It is sound, but nested `node_modules` levels and packages with both
      `main` and `module` targets never become durable.
    - A check that the winner is still present. It misses the transient
      window.
    - One re-resolve after the compile, a second resolver on reuse, and
      locks. The same transient state can occur during both resolves. The
      reuse contract forbids an esbuild operation on reuse. Locks cannot
      stop external edits.
    - A proof in the pool, the disk store, the Rust fast path, or the reuse
      check. They see only finished recipes. A stamp that reuse checks is a
      persistent timestamp input, which decision 4 left out.
    - The owned-root hint of E. The barrier ages the receipt and publication
      writes that the cache makes before a base compile. Add the hint only
      if the Milestone 5 measurement shows base misses.

    Wider fix: C stays the structural wider fix. It is blocked, because it
    needs sidecar file writes and moves source ownership. G is the detection
    fix without platform limits. It is blocked for the same reason. F is the
    best option that is not blocked.

    Design of F:

    - One `ResolutionEvidence` and one `prepare()` serve every attempt of
      one `bundle()` call, with the captured preview selection. `finish()`
      runs once, after the last attempt. `bundleWith()` keeps its signature
      and a fresh capture for direct callers. This part needs no stamps. A
      lasting change between attempts makes the evidence incomplete, also
      for in-process reuse.
    - A witness starts at the first touch and ends after `finish()`. A
      directory witness is a bigint lstat in the ancestor walk of each
      observed path: `dev`, `ino`, `ctimeNs`, and `mtimeNs`. A link also
      gets a bigint stat of its target directory. A metadata-file witness is
      a bigint stat of the open handle in the metadata read, with the same
      fields and `size`. Source bodies get no witness, because their
      consumed digests cover them.
    - Each witness charges its path bytes and 48 bytes to the 8 MiB
      visited-path bound. The barrier preflight also stays within that
      bound. A compilation above the bound is not durable. Its completeness
      does not change.
    - The age guard at the first touch reads the realtime clock in
      nanoseconds. A stamp younger than 50 ms makes the compilation not
      durable. When `ctimeNs` and `mtimeNs` are both whole seconds, the
      guard is 2.1 s. A zero stamp, or a stamp more than 1 s in the future,
      is not durable. Two ticks of the largest clock tick prove a tick
      boundary. That tick is 10 ms on Linux with `HZ=100` and on macOS, and
      15.6 ms on Windows.
    - After `finish()`, the four input workers stat each witness again. A
      changed field, a read error, or a changed volume class makes the
      compilation not durable. Witnesses never enter the recipe, and no
      reuse check reads them.
    - The adaptive barrier runs before the first observation of a real
      compile. Its preflight takes bigint lstats of the ancestor chains of
      the source root, the configuration directory, and each entry, stories,
      and renderer file. A stamp within its age guard and not newer than the
      request start makes the sidecar wait once. The wait ends at the
      request start plus 50 ms at the latest.
    - The barrier cap stays separate from the age guard. A whole-second
      stamp keeps its 2.1 s guard at the first touch, so its compilation can
      miss the store. No wait of 2.1 s exists.
    - The barrier runs at most once for each real compile. It never runs on
      memory or disk reuse. It does not wait when no recent change exists.
    - `ReuseEvidence` gains `durable: boolean` on the wire. The bundle
      format is unpublished, so the field stays in schema 1. Witnesses
      decide `durable` only. They never change `complete`, the identity,
      in-process reuse, memory seeds, released retention, or the Rust fast
      path.
    - The reusable-recipe type of call 23 stays complete-only, for memory
      seeds and released retention. A separate durable-recipe type requires
      complete and durable evidence. Disk saves and disk read results use
      only that type. It also protects direct store callers and entry
      decode. It adds no outcome, timing value, or setting.
    - The pool sends the private `hello` hint only when it keeps a bundle
      store. Only a sidecar with the hint records witnesses and runs the
      barrier. Without the hint, no compilation is durable. In-process tests
      and builds without a store then pay nothing.
    - On Linux, a volume qualifies by its Node `statfs` type, cached for
      each `dev`: `0xEF53` for ext2, ext3, and ext4, `0x58465342` for xfs,
      `0x9123683E` for btrfs, `0x01021994` for tmpfs, and `0x794C7630` for
      overlayfs.
    - On macOS, `crates/mokly-platform` calls `getfsstat` with
      `MNT_NOWAIT`. It keeps each `MNT_LOCAL` mount whose `f_fstypename` is
      `apfs` or `hfs`. The hint sends the `st_dev` of its mount point and
      its `f_type`. A durable `dev` must also show the hinted `f_type` in
      Node `statfs`. That catches a `dev` that a later mount reuses.
    - On Windows, `crates/mokly-platform` enumerates volumes with
      `FindFirstVolumeW`. It keeps each `DRIVE_FIXED` volume whose
      `GetVolumeInformationW` name is NTFS or ReFS. The hint sends the
      serial number and the mount roots from
      `GetVolumePathNamesForVolumeNameW`. A durable `dev` equals a hinted
      serial on a path below that volume's drive letter or mount root. A UNC
      path is never durable.
    - The hint holds at most 64 volumes and 64 KiB. It uses only the
      workspace crates `libc` and `windows-sys`, which already exist.
    - Every other volume is not durable. Examples are NFS, SMB, AFP, WebDAV,
      9p, FUSE, FAT, exFAT, and the Linux `ntfs3` driver.
    - A complete compilation that is not durable keeps in-process reuse, its
      identity, memory seeds, and released retention, as today. Only its
      disk write does not happen. The command does not fail and prints no
      warning. The next restart compiles.
    - An unrelated change in a witnessed ancestor, such as the home or the
      temporary directory, also skips a store. In production this costs one
      compile at the next restart. Tests therefore use a private fixture
      parent.

    Tests keep every existing assertion. No test gets a wait, a sleep, a
    skip, or a retry.

    - Unit tests drive the decision through an injected stat, volume class,
      and clock. They cover unchanged and changed witnesses, recent fine and
      whole-second stamps, zero and future stamps, an unknown `dev`, an
      unsupported type, the bound, and a witness that cannot change
      `complete`.
    - Fail-first regressions use a real filesystem, in-process `bundle()`,
      a compile wrapper, and an injected clock. A transient higher candidate
      gives complete evidence that is not durable. So does a higher
      candidate created between an exact lookup and a later open lookup in
      one directory. That fail-first run also confirms the esbuild listing
      cache.
    - The real-sidecar disk tests keep their assertions. Their fixture is
      below a private parent, such as `CARGO_TARGET_TMPDIR`. The test writes
      it before the pool starts, as production does.
    - One-time platform proofs run on this machine and on the macOS 26 and
      Windows 2025 runner types, with Node 22.15.0 and Node 24. A bigint stat
      of a directory must change `ctimeNs` and `mtimeNs` after a child is
      created, renamed, and deleted. Node's `stat.dev` must equal the hinted
      value on macOS and Windows. Each proof records the Node and libuv
      versions.
    - The proof artifacts stay under `.context/`, and the pull request names
      them. After the source commit, the root may run a temporary
      context-only workflow on the existing runner types. No permanent
      one-time test, platform semantic test, or gate change is added.

    Cost: the barrier waits at most 50 ms for each real compile, and only
    after a recent change. Milestone 5 measures it with the capture cost,
    without an elapsed-time test. That measurement is pending.

    Authorization under the decision test: F is my design call.

    - It changes no requirement in force. A compilation that is not durable
      only misses the disk cache, which the approved best-effort contract
      permits.
    - In-process behaviour, identities, and every existing assertion stay.
    - It adds no error, gate, retry, test seam, or public setting. The
      `hello` hint is private. The bounded wait is a design call with a
      measured cost.
    - The protocol and README updates record a mechanism within the approved
      requirements, as calls 24 to 26 did. They land with the code.
    - A user decision opens only in three cases. A one-time proof fails on
      macOS or Windows, because a platform-specific test expectation then
      changes the documented cache requirement. Someone chooses C or G,
      because both need sidecar file writes. A fix of the in-process windows
      reduces in-process reuse, because that removes `origin/main`
      functionality.

    In-process reuse keeps the transient and cached-listing exposure, which
    `origin/main` also has in a wider form. The durable check protects only
    the disk store. The follow-up item
    [in-process-resolution-coherence.md](./follow-ups/in-process-resolution-coherence.md)
    holds that work. Its recommended option binds the resolved winners and
    keeps all reuse. It is Large.

31. My call, 2026-11-17: apply checked option B of the Windows capture
    check. On Windows, every capture witness takes its device, identity, and
    stamps from one read-only handle stat. The path stat keeps only the link
    semantics, and it must agree with the handle. The check keeps the letters
    A to C. No user decision is open.

    Problem: the one-time proof of call 30 failed on the Windows 2025 runner
    with Node 22.15.0. Every path stat there reported device 0, so no Windows
    witness matched its hinted volume, and no compilation was durable. A
    handle stat reported the hinted serial, 1383836831, with the same inode
    and stamps. Node 24.22.1 reported the serial in both routes.

    Cause: libuv 1.49.x and 1.50.x declare their private copy of
    `FILE_STAT_BASIC_INFORMATION` with `FileId128` before
    `VolumeSerialNumber`. Windows 11 24H2 and Windows Server 2025 export
    `GetFileInformationByName`. There, a path stat of an object that is not a
    reparse point reads its device from the upper half of the 128-bit file
    ID. That half is 0 on NTFS. libuv 1.51.0 fixed the order through
    libuv/libuv#4696 and libuv/libuv#4698. Node 22.14.0 to 22.16.0 bundle
    libuv 1.49.2, and Node 23.11.0 to 24.1.0 bundle libuv 1.50.0. A handle
    stat queries `FileFsVolumeInformation` on the open handle, on every Node
    version. On the runner, that value equalled the hinted serial with both
    Node versions.

    Root question: how does a Windows capture witness get a faithful volume
    identity and faithful stamps on every supported Node version, without a
    guess and without a weaker assertion?

    Shared assumptions, with their sources:

    - Call 30 F stays: the private hint, the volume table, the witnesses,
      `durable` only, and no wait in tests. Source: call 30.
    - `mokly-base-cache.md` supports NTFS and ReFS on a fixed Windows volume,
      and `mokly-sidecar.md` defines the private `capture` hint. Both stay.
      Source: the protocol pages.
    - The supported Node range includes the affected versions. Source: the
      engines fields of `package.json` and `packages/mokly/package.json`, and
      the Node 22.15.0 native jobs of `docs/protocol/ci-workflow.md`. These
      are requirements. A and C change them, so both need the user.
    - The hint carries the 32-bit serial of `GetVolumeInformationW`. Source:
      the code and call 30. It stays, because the handle route reports the
      same number.
    - Call 30 assumed that a path stat supplies the witness device. Its text
      says "Node's `stat.dev` must equal the hinted value". That names a
      mechanism, not a requirement. B drops the path-device mechanism on
      Windows. macOS keeps its path stat.

    Options:

    - A. Runtime policy. Keep path stats and accept no Windows disk cache on
      affected runtimes. Move the Windows native job to Node 22.17.0 or 24,
      or give the disk-hit test a runtime-specific expectation, and document
      the runtime limit. It changes the CI or cache requirement, so it needs
      the user. Small.
    - B. Handle-snapshot witnesses on every Windows runtime. One capture
      runtime method opens the path read-only, takes a bigint handle stat,
      and closes the handle. Every Windows witness uses it at the first touch
      and after `finish()`. Medium.
    - C. Runtime floor. Raise both engines fields to Node 22.17.0 and 24.2.0,
      move every 22.15.0 pin, and update five docs. It is outward-facing for
      package users, so it needs the user. It also fixes the PostCSS name
      check that the follow-up below records. Medium.

    Left out:

    - A volume from device 0, a drive letter, or a mount root when the device
      is 0. Device 0 carries no volume, and on ReFS that value is part of a
      file ID.
    - A 64-bit serial in the hint, or a signed alias of the serial. No Node
      version reports either value.
    - Another path stat variant. All eight numeric, bigint, sync, async,
      `stat`, and `lstat` variants gave device 0.
    - A volume from `realpath` and the mount roots alone. It still needs a
      handle, and it loses the device check that rejects a junction to
      another volume. B is better on every point.
    - A Rust classifier for each path, or a final native proof in the pool.
      It needs the witness list on the wire and a second witness owner, and
      the sidecar still lacks the device at the first touch.
    - A native addon that reads `FILE_ID_INFO`. It adds a native package for
      each platform. B is better on every point.
    - A startup check that turns durability off when the two routes disagree.
      It still loses the cache. B removes the wrong case.
    - A libuv version gate inside B. It only lowers the cost on fixed
      runtimes. A later measurement can add it without a change of behaviour.

    Wider fix: B. One snapshot route serves every Windows witness at both
    ends, so no witness can read a path device on Windows. C is the wider fix
    for every path device in the package, but it changes a requirement, so it
    needs the user. Recommendation: B.

    B stays within F. It changes no requirement, hint, volume table, private
    `hello` field, CI matrix, or assertion. It adds no error, gate, retry,
    wait, skip, sidecar write, or weaker test, and it removes nothing from
    `origin/main`. The handle stat is private. Call 30 sends a failed Windows
    proof to the user only when F cannot make Windows durable. B makes
    Windows durable within F.

    Design of B:

    - `CaptureRuntime.handleStat` opens the path read-only, takes a bigint
      handle stat, and closes the handle. `captureSnapshot` applies it on
      `win32` only. Linux and macOS keep their current stats.
    - Every Windows witness uses `captureSnapshot` after `finish()`. At the
      first touch, the directories of the ancestor walk and the link targets
      use it too. A metadata witness keeps the handle stat of its own
      metadata read at the first touch and needs no second open.
    - The witness records only the handle stat, so it never mixes fields
      from two calls. The path stats before and after the open must agree
      with the handle on the kind, `ino`, `ctimeNs`, and `mtimeNs`, and on
      `size` for metadata. No check reads a Windows path `dev`.
      `sameCaptureStat` compares the witness with its recheck.
    - After `finish()`, a no-follow witness takes its path lstat first. A
      symlink, a junction, a file, or a missing path rejects before any open.
      A new volume mount point shows another `dev` and `ino`, so it rejects.
    - The maturity check uses the time of the first touch, which `observe`
      reads before the open. So handle latency cannot mature a recent stamp.
    - An open, stat, or close error, a kind mismatch, or a field mismatch
      clears only `durable`. It never changes `complete`, the identity, or
      in-process reuse. A directory that a user can pass but not list fails
      the open, so it fails closed.
    - The preflight keeps path lstats, because it reads only `ctimeNs`.

    Cost: one more open, stat, and close for each Windows directory witness,
    at both ends. It runs only for a real compile with a bundle store, never
    on reuse, and within the visited-path bound. The check estimates tens of
    milliseconds for about a thousand directory witnesses. It is not
    measured.

    Tests: a new focused file injects a `win32` runtime. It covers a path
    device of 0 with a handle serial, a metadata witness that keeps its first
    handle stat, a changed handle identity, stamp, or kind at either end, a
    link that replaces a directory, open, stat, and close failures that keep
    the evidence complete and close each handle, and handle latency that
    cannot mature a recent stamp. Each new test runs 10 times. Every existing
    assertion stays. No test gets a wait, sleep, skip, retry, or platform
    semantic expectation.

    Proof: after the source commit, the root runs the unchanged temporary
    proof on the macOS 26 and Windows 2025 runner types, with Node 22.15.0
    and Node 24. The native CI job then runs the Windows disk-hit
    assertions. A user decision opens only if that proof fails with B.

    Bounded unknowns: handle freshness after a create, a rename, and a
    delete on Node 22.15.0 is not proven yet. ReFS is unproven for all of F,
    and B fails closed there if the two routes disagree. The list-denied
    failure comes from the libuv access flags, not from a run.

    A volume mounted in a folder never matches its own mount directory, so
    such a volume fails closed. The follow-up item
    [capture-mount-root-match.md](./follow-ups/capture-mount-root-match.md)
    holds that fix. The PostCSS read witness has the same path-device cause.
    The follow-up item
    [postcss-windows-resolved-name.md](./follow-ups/postcss-windows-resolved-name.md)
    holds that work.

32. Keep synchronous saves after the cost review, my call, 2026-11-18.
    The measured store cost exceeded the review trigger of call 2. A fresh
    options check keeps A. This call closes that review and changes no
    requirement, source, test, setting, or boundary behaviour.

    Root question: how much delay may the optional bundle-cache write add
    to a compiling request, and what bounds that delay?

    Shared assumptions, with their sources:

    - Every eligible served compilation is offered, with no publication
      table. Source: `mokly-base-cache.md` and checked call 26 G. Kept.
    - The bundle kind keeps its 512 MiB bound, its frame bound, and one
      nonblocking lock attempt. Source: decision 6 D and calls 17, 18 and 24. Kept.
    - A write stays in the bundle response and its `catalogue.bundle`
      span. Source: decision 8 A and `mokly-timings.md`. This is a
      requirement in force. B and F drop it and need the user.
    - Synchronous ownership keeps the final write available to the next
      start and keeps tests independent of shutdown scheduling. This is
      the reason of call 2, rather than a separate protocol requirement.
      Kept. A detached writer drops it and stays left out.
    - The 100 ms rule reopens a design review. It is not a product gate or
      an acceptance assertion. Source: call 2. Kept.
    - The Linux basic-recipe probe supplies evidence for that review.
      Source: the measurement method and calls 12 and 19. Its limits are
      an empty namespace, one recipe size, and no native save samples.
      E drops this scope assumption.
    - Linux currently flushes the whole filesystem for bundle data.
      Source: the shared flush implementation on `origin/main`. The
      protocol requires durable data before a durable receipt, but it
      does not require that flush scope. D drops this mechanism.

    Options, with the checked letters:

    - A. Keep synchronous saves, the receipt fast path, and every current
      bound and lifecycle rule. A real compile pays for publication.
      Repeat offers still pay the offer clone before the store checks
      its receipt. The store-only receipt cost excludes that clone. Small.
    - B. Add one bounded per-pool writer queue. Coalesce equal settings,
      bound retained bytes, recheck receipts, and define warnings,
      cancellation and shutdown ownership. This is the structural wider
      fix, but it changes decision 8 A and the response timing rule.
      It needs a user decision. Large, corrected from Medium.
    - C. Profile the real CPU and I/O stages before reducing repeated
      clones or serialization. Keep all digests, limits, receipts, flushes
      and atomic publication. Keep a later change only after repeated
      measurements and correctness proof. Medium.
    - D. Flush only the bundle data file and its stage directories on
      Linux. Keep both durable receipts, the rename and every directory
      flush. It avoids unrelated dirty filesystem data, but has no
      measured gain yet. The other cache kinds stay unchanged. Medium.
    - E. Keep every sample and add native save evidence plus a recipe
      near the frame limit. The native runner work needs separate
      authorization. No extra proof runs in this call. Medium.
    - F. Defer pending saves to named command boundaries. Bound and
      coalesce pending recipes, and define shutdown cancellation. It
      changes the response, warning and timing contracts, so it needs
      a user decision. Large.

    Left out: a detached writer can lose the final write at exit and
    make warm tests depend on scheduling. An unbounded queue breaks the
    memory goal. Dropping durability, digests, receipts or limits breaks
    requirements. A time gate or a new public span does not reduce the
    save cost. Repeating a probe while retaining every sample hides
    nothing, but repeating until it passes a threshold is not evidence.
    A writer daemon adds an unrelated owner.

    Recommendation: A, as proposed. No measured gain justifies a new
    owner or a boundary change. The save code and probe were unchanged
    across the two saved sets, so their variance does not prove a source
    regression. The product-span estimate and its limits stay in the
    checked report. B is the blocked structural wider fix. D changes
    one flush cause, while C investigates repeated CPU work first.

    The Rust request-cost follow-up records the broad flush, the offer
    copies, the encoder frame-check copies, and the owned restore copy.
    It keeps the blocked queue alternative and requires measurements
    before implementation. No copy cost or native save cost is proven.

    Reopen this call when new measured evidence changes the comparison
    of these options. Keep the original threshold observation and every
    sample. The review trigger is not a recurring product time gate.
    No user decision is open.

The options check for the restored decisions and these calls is recorded
under `.context/bundle-disk-cache/options-check-current.md` and
`.context/bundle-disk-cache/options-check-calls-14-19.md`. Call 20 uses
`.context/bundle-disk-cache/options-check-call-20.md`. Call 21 uses
`.context/bundle-disk-cache/options-check-call-21.md`. The second check
confirms calls 14 to 19. Its suggested silent version miss does not apply:
the current task explicitly requires a warning for foreign entries. Any new
decision
that the decision test assigns to the user goes to the performance
orchestrator before dependent work continues.

Call 22 uses `.context/bundle-disk-cache/options-check-call-22.md`. Call 23
uses `.context/bundle-disk-cache/options-check-call-23.md`.
Call 24 uses `.context/bundle-disk-cache/options-check-call-24.md`.
Call 25 uses the same options-check report.
Call 26 uses `.context/bundle-disk-cache/options-check-call-26.md`.
Call 27 uses `.context/bundle-disk-cache/options-check-call-27.md`.
Call 28 uses `.context/bundle-disk-cache/options-check-call-28.md`.
Call 29 uses `.context/bundle-disk-cache/options-check-call-29.md`.
Call 30 uses `.context/bundle-disk-cache/options-check-call-30.md`.
Call 31 uses `.context/bundle-disk-cache/options-check-windows-device.md`.
Call 32 uses `.context/bundle-disk-cache/options-check-call-32.md` and
`.context/bundle-disk-cache/call-32-resolution.md`.

## Milestone 1: Documentation and protocol

Depends on: none

The protocol pages state the requirements and the decisions in force for
the work below. Each changed page carries the status line of the repository
rules until Milestone 5.

- [x] `docs/protocol/mokly-sidecar-modules.md`, "Compiled Recipes And
      Release": the toolchain identity in the recipe, in the identity, and in
      the reuse rule. The new recorded inputs: peer manifests,
      `jsconfig.json` candidates, and tsconfig `extends` targets. The binary
      keeps the latest compilation of each bundle setting in the OS cache,
      and a later process restores it only through the same input check.
- [x] `docs/protocol/mokly-watch.md`: the resolution inputs that invalidate
      compilation reuse. The render-key rule for peers stays.
- [x] `docs/protocol/mokly-base-cache.md`: the bundle kind, its bound, the
      entry header with the format and Mokly versions and the payload digest,
      the hit that checks the digest, the replace rule, the rejection of
      other versions, the damaged-entry rule, and the reset by deletion.
- [x] `docs/protocol/mokly-terminal-cache.md` and
      `docs/protocol/mokly-terminal-output.md` and
      `docs/protocol/mokly-terminal-errors.md`: the directory line for the
      bundle kind, and the warning line of decision 7 and current call 13.
- [x] `docs/protocol/mokly-format-versions.md`: a row for the bundle cache
      entry, version 1, with a reader that requires 1.
- [x] `docs/protocol/mokly-timings.md`: the `catalogue.bundle` span and its
      `cache` values, the field's meaning for each stage, the removal of the
      `catalogue.describe` row, and a budget row for the bundle cache bound.
- [x] Update both OS-cache statements in `docs/protocol/mokly-runtime.md`.
      Keep all current lifetime and cache requirements. Update the two
      OS-cache lists in `docs/architecture/rust-core.md` as well.
- [x] Delete the fixed item `plans/follow-ups/bundle-disk-cache.md` and
      update its live references. Keep the stylesheet cache target in its
      existing follow-up item, with the approved scope and date.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

Evidence: `.context/bundle-disk-cache/reports/milestone-1.md`.

## Milestone 2: Toolchain identity and recorded inputs

Depends on: 1

- [x] Add `toolchain` and typed physical reuse-evidence fields to
      `CompiledGeneration` in
      `crates/mokly-sidecar/src/compiled.rs`, and regenerate the TypeScript
      type.
- [x] Compute the toolchain identity once in each sidecar process. Record it
      in `bundle-recipe.ts`, and hash it into the compilation identity. Make
      `reuse` in `compiled.ts` require an equal toolchain, and digest the
      inputs in parallel.
- [x] Record the peer manifests, the `jsconfig.json` candidates, and the
      tsconfig `extends` chains. Record complete conservative resolution
      evidence under current calls 14 and 15. Both the sidecar and Rust
      fast path must check it. Preserve render-key and watch inputs.
- [x] Tests with a real sidecar: a fresh sidecar that restores a recipe with
      an equal toolchain and unchanged inputs bundles with no esbuild
      operation. With another toolchain it compiles again. Add one case for
      each new input kind to the existing reuse tests. Cover new candidates,
      link retargets with old targets present, and the Rust fast path.
      Cover the generation identity and describe boundary for incomplete
      evidence and for peer manifest or link changes. See each fail first.
- [x] Update the Key Code of `packages/mokly/README.md`.
- [x] Update the render README for the physical reader and its constructor
      boundary. State the incomplete-identity rule in the sidecar protocol.

Evidence: `.context/bundle-disk-cache/reports/milestone-2.md` and
`.context/bundle-disk-cache/reports/call-23-docs.md`.

## Milestone 3: The bundle kind of the OS cache

Depends on: 1, 2

- [x] Define the `BundleStore` boundary and its outcome type in
      `crates/mokly-sidecar`. Apply call 20 D to reads, writes, rejected-entry
      retirement, warnings, cancellation, and normal contention. Define the
      reusable-recipe type of call 23 B for the write boundary.
- [x] Add the `bundles` kind with its 512 MiB bound, the replace operation
      under the entry lock, the entry codec version 1 with the format
      version, the Mokly version, and the payload digest, and the store over
      the cache in `crates/mokly-compare`. Apply call 21 D to the whole stored
      file and the actual encoded disk-seed request, before every write.
- [x] Tests: an entry of another format or Mokly version that the reader
      rejects before the payload, a damaged entry, two writers of one key
      that never expose a partial entry, and a replace past the bound that
      evicts the least recently used other entry. See each fail first.
- [x] Update `crates/mokly-compare/README.md` and
      `crates/mokly-sidecar/README.md`.

Evidence: `.context/bundle-disk-cache/reports/milestone-3.md`,
`.context/bundle-disk-cache/reports/m3-readmes-docs.md`, and
`.context/bundle-disk-cache/reports/m3-followup-locations.md`.

## Milestone 4: Pool restore, write, composition, output, and timing

Depends on: 2, 3

- [x] The pool seeds the worker from the store, forwards the request,
      compares the runtime keys, offers every complete served envelope to the store, and
      returns the outcome. The core fast path sends a served-generation notice.
- [x] Apply checked call 26 G in the bundle receipt and store. Test that a
      receipt match skips encoding and writing, and that replacement,
      eviction, and deletion cannot leave stale write-elision knowledge.
      Preserve bounded warning facts, publication nonces, and legacy receipts.
- [x] Ignore incomplete memory recipes as bundle seeds and released reuse
      records. Preserve restoration for old live graph and render leases.
      Test that an incomplete memory recipe cannot hide a usable disk entry.
      Test explicit restoration and last-release replacement for an incomplete
      recipe. Update the sidecar protocol, the sidecar README, and the flow
      above for complete-only optional seeds and released retention.
- [x] Compose the store in `crates/mokly-cli/src/render_runtime.rs`.
- [x] Share one once-only cache reporter for each command between the bundle
      cache and the base caches, and print the warning line of decision 7 and current call 13.
      Follow the `product-ui` skill for the warning text.
- [x] Emit `catalogue.bundle` with `cache` in
      `crates/mokly-render/src/bundle_attempt.rs`. Add the stage and the
      values to `serve_trace_stages.rs` and `serve_trace.rs`. Remove the
      `catalogue.describe` allow-list entry.
- [x] Tests: pool unit tests with a fake worker and a fake store for the
      request order, a write when the served recipe differs from the disk record, a memory
      revert that updates disk, and a failed restore. One
      integration test with a real sidecar and a temporary cache: a second
      process bundles with no esbuild operation, and after a consumed file
      changes it compiles once and replaces the entry. A test subscriber
      reads the `cache` field of the real span for a hit and a miss. A test
      of the directory line and the warning line, including a foreign
      entry. Add focused cases for the lookup and byte-bound corrections. Run each new test 10
      times.
- [x] Update `crates/mokly-render/README.md` and `crates/mokly-cli/README.md`.

Evidence: `.context/bundle-disk-cache/reports/milestone-4.md`,
`.context/bundle-disk-cache/reports/call26-docs.md`, and
`.context/bundle-disk-cache/logs/m4-repetitions.json`.

## Milestone 5: Measurement, proof, and smoke test

Depends on: 4

- [x] Preserve plain stdout when head rendering fails. Hold its cache directory
      note until the next phase or successful validation, under call 27.
      Keep the existing callback diagnostics assertion and prove one
      announcement after successful validation.
- [x] Give the callback, sidecar, and final-render diagnostic fixtures their
      own external bundle cache. Keep it across each fixture's commands and
      remove it with the fixture. Preserve every diagnostic assertion.
- [x] Share one evidence owner across native, planned, and full attempts.
      Prepare once and finish after the last attempt, under call 30. Prove
      that a lasting inter-attempt change rejects reuse.
- [x] Close the transient open-lookup capture window under checked call 30.
      Close the cached-listing window for the disk store too. Preserve
      existing reuse assertions on every supported platform.
  - [x] Add `durable` to `ReuseEvidence` and regenerate the TypeScript
        types. Keep the reusable-recipe type complete-only for memory. Add
        the durable-recipe type for disk saves and disk read results. The
        pool offers the store only complete and durable recipes.
  - [x] Send the private `hello` capture hint only from a pool with a
        bundle store. Without the hint, record no witness, run no barrier,
        and mark no compilation durable.
  - [x] Record the directory and metadata-file witnesses from the first
        touch, with the age guards and stamp rules of call 30. Stat each
        witness again after `finish()`. Charge the witnesses and the barrier
        preflight to the visited-path bound. Change only `durable`.
  - [x] Add the adaptive barrier before the first observation of a real
        compile. End its one wait at the request start plus 50 ms at the
        latest. Never wait on reuse.
  - [x] Classify Linux volumes by Node `statfs`. Enumerate the local APFS
        and HFS+ volumes of macOS and the fixed NTFS and ReFS volumes of
        Windows in `crates/mokly-platform`. Bound the hint at 64 volumes and
        64 KiB.
  - [x] Add the decision unit tests with an injected stat, volume class,
        and clock. Add fail-first regressions for the transient and
        cached-listing windows. Keep every disk-hit assertion, with a
        private fixture parent. Add no wait, sleep, skip, retry, or platform
        semantic test.
  - [x] Apply checked call 31 B. Take every Windows witness from one
        read-only handle stat at the first touch and after `finish()`. Keep
        the first handle stat of a metadata witness. Require kind and field
        agreement with the path stats, and keep the first-touch maturity
        time. Let open, stat, and close errors clear only `durable`. Run each
        new focused test 10 times.
  - [x] Prove once that directory stamps change and that the capture's
        device value equals the hint: the path stat device on macOS, and the
        handle stat device of call 31 on Windows. Run the temporary proof
        with its assertions unchanged, on this machine and the macOS 26 and
        Windows 2025 runner types, with Node 22.15.0 and 24. Keep the
        artifacts under `.context/`. A failed proof on macOS or Windows goes
        to the user.
  - [x] Update the protocol pages and the READMEs in the commit of the
        code, after the source names settle and the root authorizes each
        README.
- [x] Measure with the method of the brief, interleaved with `origin/main`:
      three warm runs, the edit run, and the React fixture. Save the output
      under `.context/bundle-disk-cache/`. Count zero warm compile spans and
      zero esbuild operations on both head and base.
- [x] Measure the added evidence-capture cost after an edit and a core
      fast-path rebuild. Assess whether the capture scheduling needs a
      change. Keep this as measurement evidence, not a time gate.
- [x] Measure the barrier of call 30 with the capture cost: how often it
      waits, and its total wait on real compiles. Check that the first
      Changes run stores a base entry and that the next run hits it. Add the
      owned-root hint only if base misses remain. Keep this as measurement
      evidence, not a time gate.
- [x] Prove once that `mokly build --strict` output with a cache hit is
      byte-identical to a cold build. Save the proof under `.context/`.
- [x] Smoke test: restart Serve on `examples/basic`, open the catalogue, and
      check a JavaScript screen and its Changes view.
- [x] Keep retained preview reuse after adding and removing the preview file.
      Apply checked call 28. Preserve the existing two-compile assertion and
      the physical link, shadowing, and configuration checks.
- [x] Keep consumed digests at every post-compile metadata site under
      checked call 29. Prove the imported-manifest restore race.
- [x] Use one captured preview selection for compilation and reuse evidence,
      under checked call 29. Prove that a transient preview deletion cannot
      publish reusable code with the wrong selection.
- [x] Remove the bundle-cache status from every changed protocol page and
      `docs/architecture/rust-core.md`. Keep the existing unrelated follow-up
      status in the runtime and terminal-errors pages.
- [x] Fetch and merge `origin/main` if it advanced. Preserve the render
      cache and base-lifetime work of the parallel branches. Apply current
      design call 10 to `mokly-runtime.md`. Measure again if their changes
      affect the baseline.
      On 2026-11-17, the user selected the last merged `origin/main` as the
      release baseline. This supersedes the `c42755bcd` selection of
      2026-11-16. Give each checkout its own Cargo target directory. Check
      both successful build logs and different binary SHA-256 hashes before
      each paired run. Preserve the compact ceiling, capture bounds, and
      restore timing fields.

Merge evidence: `.context/bundle-disk-cache/merge-notes.md` and
`.context/bundle-disk-cache/merge-86-preservation.json`, and
`.context/bundle-disk-cache/merge-f380-preservation.json`, and
`.context/bundle-disk-cache/merge-794b-preservation.json`.

Evidence: `.context/bundle-disk-cache/reports/preview-reuse-fix.md`,
`.context/bundle-disk-cache/reports/test-cache-isolation.md`, and
`.context/bundle-disk-cache/logs/strict-output-d-cli-package.json`,
`.context/bundle-disk-cache/reports/strict-output-fix.md`, and
`.context/bundle-disk-cache/reports/final-docs.md`.

Call 30 evidence: `.context/bundle-disk-cache/reports/capture-window.md`
and `.context/bundle-disk-cache/reports/durability-docs.md`,
`.context/bundle-disk-cache/reports/durability.md`, and
`.context/bundle-disk-cache/reports/durability-boundary-docs.md`.

Call 31 evidence:
`.context/bundle-disk-cache/options-check-windows-device.md`,
`.context/bundle-disk-cache/reports/windows-capture.md`, and
`.context/bundle-disk-cache/reports/windows-capture-docs.md`.

Final measurement and smoke evidence:
`.context/bundle-disk-cache/after.md`,
`.context/bundle-disk-cache/reports/milestone-5.md`,
`.context/bundle-disk-cache/native-proof/handle-final-summary.json`,
`.context/bundle-disk-cache/logs/native-linux-final-node22.log`,
`.context/bundle-disk-cache/logs/native-linux-final-node24.log`, and
`.context/bundle-disk-cache/reports/browser-smoke.md`.
The capture scheduling assessment is recorded in
[sequential-evidence-capture-cost.md](./follow-ups/sequential-evidence-capture-cost.md).

## Milestone 6: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5

- [x] Run `cargo xtask check --suite repository` early, then the complete
      gate `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
  - [x] Review the pushed source at `2d15cae28` against `0accb6818`.
        Check finding 1 in a fresh second pass. Record the Rare timing
        defect after merge with option D. No source fix is required now.
  - [x] Review the combined source after the latest main integration.
  - [x] Fix confirmed finding 2 with checked option D. Normalize aliases
        before built-in filtering. Apply the current incomplete-evidence
        rule to bundled edges that the built-in rule skipped. Preserve
        written plugin-name rules and the exact single-slash alias tail.
  - [x] Fix confirmed finding 3 with checked option B. Observe each link
        expansion and every target-parent directory within the current
        visited-path bound. Keep memory reuse and Windows handle rules.
  - [x] Prove each new regression fails on its behavior assertion before
        the fix. Run each asynchronous regression ten times. Record its cost.
  - [x] Verify the combined source and re-review the pushed fix.
- [ ] Fetch and merge `origin/main` if it advanced before the final pull
      request. Audit preservation with the `git-merge` skill.
  - [x] Merge main `03bedb6ec` with its comparison-usage, render-worker, and
        browser-error isolation changes. Preserve every incoming path.
  - [x] Repeat the release pairs against exact main `03bedb6ec`, with
        separate checkouts and target directories. Keep every earlier run.
  - [x] Merge main `0accb6818` with its detail-publication reuse and
        MockLink fixture changes. Preserve every incoming path.
  - [x] Repeat the release pairs against exact main `0accb6818`. Archive
        each checkout's measured programs before its source changes. Keep
        each checkout's own Cargo target and all earlier evidence.
  - [x] Run repository verification on the combined source before the final
        implementation review. Let final CI verify the combined branch.
  - [x] Merge main `51f356574`, with kept-base reuse and the viewer pick
        completion fix. Audit all incoming paths and preserve the completed
        follow-up deletions. Adapt only the new test constructor arguments.
  - [x] Merge main `e8c964cb1`, with the settled large browser fixtures and
        failure evidence. Keep every incoming path exactly as main, including
        the completed follow-up deletion.
  - [x] Repeat the release comparison against exact main `e8c964cb1`.
        Preserve the complete `0accb6818` and `f032dd04c` programs, sources,
        reports, and raw evidence before updating the private checkouts. Keep
        the archived `51f356574` and `423e23930` build-only programs as well.
  - [x] Run repository verification on the latest combined source before
        its review. Let final CI verify all suites of the combined branch.
  - [x] Merge main `f13a5d979`, with retained comparison proofs from PR #310.
        Preserve the incoming comparison, capture, trace, and documentation
        changes alongside the bundle cache.
  - [x] Preserve the complete `e8c964cb1` and `1c3545ddf` programs,
        dependencies, sources, reports, and raw evidence before updating the
        private checkouts for `f13a5d979`.
  - [x] Audit the merged timing fields after the comparison-proof merge.
        Keep all cache values and comparison reuse fields.
  - [ ] Preserve the unfinished `f13a5d979` setup after main advances.
        It contains one successful main npm stage and no optimized f13
        release or product measurement. Keep its mixed program sources
        explicit. Do not report it as an accepted comparison.
  - [x] Merge main `bc4f4cc40`, with the source-read, POSIX-path, and
        style-adapter filter changes of PR #311. Preserve all seven incoming
        paths byte for byte, including tests and the new follow-up.
  - [ ] Repeat the release comparison against exact main `bc4f4cc40`.
        Keep separate checkouts and target directories. Preserve all earlier
        archives and accepted measurements.
  - [ ] Verify the new combined sidecar paths and release proofs. Let
        final CI verify every combined suite.
- [x] Reopen the synchronous-save call after its review trigger. Run a
      fresh options check and record checked call 32 A. Keep all original
      samples and the true threshold observation.
- [x] Record the checked Rust request-cost targets as an independent
      after-merge follow-up. Keep every bound and response contract.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request with `gh pr create --base main`. Its description
      gives the before and after table, the decisions and the design calls
      of this plan with their dates, a permalink to this plan, and the
      follow-up items that the change adds.

After the pull request opens, watch its last commit with `scripts/ci-wait.sh`.
Fix each CI failure caused by this branch. Send the performance orchestrator
the pull request, last commit, CI results, measurements, cache size, design
calls, review findings, follow-ups, and checks. Do not merge.

Verification evidence:
`.context/bundle-disk-cache/logs/full-gate-f6a006-r2.log`,
`.context/bundle-disk-cache/logs/full-gate-f6a006.log`,
`.context/bundle-disk-cache/logs/viewer-evidence-cancellation-rerun.log`, and
`.context/bundle-disk-cache/reports/viewer-evidence-gate-flake.md`.
Main integration evidence:
`.context/bundle-disk-cache/merge-03bedb6ec/preservation.json`,
`.context/bundle-disk-cache/merge-03bedb6ec/decisions.md`, and
`.context/bundle-disk-cache/logs/merge-03bedb6ec-audit.log`.
The repeated release evidence is under
`.context/bundle-disk-cache/m5-final-03bedb6e/`.
Latest main integration evidence:
`.context/bundle-disk-cache/merge-0accb6818/preservation.json`,
`.context/bundle-disk-cache/merge-0accb6818/decisions.md`, and
`.context/bundle-disk-cache/logs/merge-0accb6818-audit.log`.
Latest fixed release and repository evidence:
`.context/bundle-disk-cache/m5-final-0accb681/metadata/final-assessment.json`,
`.context/bundle-disk-cache/m5-final-0accb681/metadata/cleanup.json`, and
`.context/bundle-disk-cache/logs/repository-0acc-f032.log`.

Latest integration and review evidence:
`.context/bundle-disk-cache/merge-51f35657/before.json`,
`.context/bundle-disk-cache/m5-final-b881bfff/reports/preservation-phase.md`,
and `.context/reviews/calummoore/lisbon-h906/findings.md`.
The resolved integration is recorded in
`.context/bundle-disk-cache/merge-51f35657/preservation.json`,
`.context/bundle-disk-cache/merge-51f35657/decisions.md`,
`.context/bundle-disk-cache/reports/merge-51f-review-docs.md`, and
`.context/bundle-disk-cache/logs/repository-51f-combined.log`.

Latest main fixture integration evidence:
`.context/bundle-disk-cache/merge-e8c964cb/preservation.json` and
`.context/bundle-disk-cache/merge-e8c964cb/decisions.md`.

First source fix evidence:
`.context/bundle-disk-cache/reports/review-fix-round-1.md` and
`.context/bundle-disk-cache/reports/review-fix-round-1.json`.

Combined source and pointer checks:
`.context/bundle-disk-cache/logs/repository-e8c-fix-r1.json` and
`.context/bundle-disk-cache/logs/markdown-links-e8c-fix-r1.json`.

Final comparison and review evidence:
`.context/bundle-disk-cache/m5-final-e8c964cb/metadata/final-assessment.json`,
`.context/bundle-disk-cache/m5-final-e8c964cb/metadata/report-validation.json`,
`.context/reviews/calummoore/lisbon-h906/round-3-review.md`,
`.context/reviews/calummoore/lisbon-h906/round-3-checks.md`, and
`.context/bundle-disk-cache/reports/final-records-e8c.md`.

Comparison-proof integration evidence:
`.context/bundle-disk-cache/merge-f13a5d97/decisions.md`,
`.context/bundle-disk-cache/merge-f13a5d97/one-sided-preservation.json`, and
`.context/bundle-disk-cache/merge-f13a5d97/follow-up-pointers.md`.

Latest sidecar optimization integration evidence:
`.context/bundle-disk-cache/merge-bc4f4cc4/preservation.json`,
`.context/bundle-disk-cache/merge-bc4f4cc4/post-merge-audit.json`, and
`.context/bundle-disk-cache/merge-bc4f4cc4/decisions.md`.
The unfinished setup is recorded in
`.context/bundle-disk-cache/m5-final-f13a5d97/metadata/stage-hold-bc4f4cc4.json`.

## Post-merge follow-up (non-blocking)

- [ ] Keep the stylesheet cache across restarts, for the CSS Modules class
      maps and for graph preparation. It holds most of the startup time that
      this plan leaves. It carries the 1.5 s target of the item, with an
      estimate of about 1.2 s on the baseline machine. This task follows
      decision 2 A.

The existing owner of the stylesheet task is
[stylesheet-cache-across-restarts.md](./follow-ups/stylesheet-cache-across-restarts.md).
