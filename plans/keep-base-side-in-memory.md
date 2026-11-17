# Keep The Base Side In Memory Between Edits

Status: Active. On branch `calummoore/mokly-keep-base-side-in-memory-2-hjj4`, no pull request yet. The
pull request that completes the work deletes this plan, as the `plans` skill
says.

Serve's Changes compares the working tree, the head, with the merge base of
`HEAD` and `review.base`. Each classification prepares the base side again.
It loads the base configuration and discovers the base sources. It bundles
and describes the base entries in the sidecar pool, prepares the base render
graph, and captures every base document. After an edit the merge base stays
the same, so this work repeats for the same commit. On 2026-10-29, `main` at
`f93afcea` took 11.5 s from an edit to the end of the second classification
on the baseline machine. The base side took 5.0 s of it. On 2026-10-30 a
machine 1.6 to 1.9 times slower measured 22.1 s and 9.7 s. That evidence
stayed in the closed perf 6 workspace. Milestone 5 measures again from
the last merged `main`, now `f380e9462`.

Serve keeps the last prepared base side in memory: the captured base
generation with its render graph, its sources, its leases, its bundle
generation, and its source-failure record. A classification reuses it while
the key and the freshness checks hold. The key is the merge-base commit, a
digest of the working configuration, and the effective install-scripts
setting. The freshness checks are the working-install checks of decision 1
and the checkout identity check of decision 6. A reuse runs no base
configuration load, discovery, validation, graph preparation, or capture.
Serve keeps at most one base. `build` and `publish` keep nothing. The plan
does not cover a disk copy of the capture or the bundle disk cache of
`plans/follow-ups/bundle-disk-cache.md`. It also does not cover a separate
base render pool, the per-head merge-base cache, render keys, or the source
and dependency caches.

User decision, recorded on 2026-10-30 from the task message: option A of
finding 2 of the 2026-10-27 performance profile. Keep the prepared base
generation in the Serve process, and reuse it while the merge base and its
inputs stay equal. Rejected: option B, which also persists the capture to
disk for the next start. A persisted capture needs a new versioned format,
and perf 7 caches the bundle on disk separately.

User decision, 2026-11-16: restore this plan from commit `129dda09`,
implement it, and open the pull request. That day the user told the
performance orchestrator to keep optimising the speed and the reliability of
Changes, without a change that can exhaust memory. On that instruction, the
performance orchestrator answered decisions 1 to 6 for the user on
2026-11-16. The section "Decisions" records each answer.
`plans/follow-ups/keep-base-side-in-memory.md` held these decisions while
they were open. This branch deletes it.

Replaced ways: none. A fresh preparation stays for the first classification,
for a key change, and after each base event. A base that Serve does not keep
follows its classification's cancellation for its whole life, as on `main`.

Contract owners:

- [Base preparation](../docs/protocol/mokly-base-preparation.md),
  [runtime](../docs/protocol/mokly-runtime.md),
  [comparison serving](../docs/protocol/mokly-comparison-serving.md),
  [selected comparisons](../docs/protocol/mokly-selected-comparisons.md),
  [timings](../docs/protocol/mokly-timings.md),
  [Changes](../docs/protocol/mokly-changes.md), and
  [watch runtime](../docs/protocol/mokly-watch-runtime.md).
- The [Rust core architecture](../docs/architecture/rust-core.md).
- The [CLI README](../crates/mokly-cli/README.md), the
  [compare README](../crates/mokly-compare/README.md), and the
  [Git README](../crates/mokly-git/README.md).

## Design calls

The perf 6 planner made calls 1 to 13 on 2026-10-30. On 2026-11-16 the docs
implementor checked each call against `main` at `a1d834fbe`. A dated note
marks each change. Calls 14 to 24 are new calls of 2026-11-16.

1. A reuse publishes no `preparing` status and no second `pending` status.
   The [Changes contract](../docs/protocol/mokly-changes.md#changes-in-serve)
   gives `preparing` only while base sources extract and dependencies
   install. On 2026-10-30 each publication took about 1 s.
2. The configuration part of the key is a digest of the serialized `Config`
   with the file, the roots, and the authored inputs. Any adopted
   configuration change prepares the base again.
3. Serve keeps one base. A classification with another key releases it
   before it prepares a new one, so the peak stays at one kept base. Note of
   2026-11-16: a keep replaces any base that the slot still holds. In-flight
   work can still hold an older base, as the
   [comparison serving contract](../docs/protocol/mokly-comparison-serving.md#generation-and-serving)
   allows.
4. Serve keeps no base after a base error or a source failure. It keeps no
   base with a `base-conversion` warning, because the
   [base cache contract](../docs/protocol/mokly-base-cache.md#converted-source-identity)
   runs the filters again in a later preparation. It keeps no tier-3 base
   that fell back for a retryable reason. These reasons are a failed
   install, the time limit, a cache failure, and the cache size limit. Note
   of 2026-11-16: under decision 6, Serve also keeps no base whose files
   have a `filter` attribute.
5. Serve keeps a tier-3 base that fell back for a lasting reason, such as an
   unsupported manager. A manager that the user installs during the session
   takes effect when Serve prepares the base again.
6. Replaced on 2026-11-16 by decision 6. The call of 2026-10-30 kept the
   checkout conversion of the preparation until the next preparation. That
   was option 6A. Now Serve checks the checkout identity before each reuse.
7. A reuse captures nothing again. It hands the kept capture to the
   comparison through a per-classification reader. That reader follows the
   wrapper rule of `RenderGeneration::comparison_capture`, at
   `crates/mokly-graph/src/types.rs:92`. Note of 2026-11-16: so the reuse
   path calls `compare_prepared` without `capture_base`. Under decision 2,
   the reader checks its own classification's cancellation before each
   call.
8. The workspace orchestrator's call, 2026-11-16, which keeps the call of
   2026-10-30: a reuse that meets a changed frozen resource, or a bundle
   reload that fails, first releases the kept base. The same classification
   then prepares a fresh base once, and at most once. Reason: Changes
   recovers at once, without a wait for another edit. This is a bounded
   product fallback. Only a failure that the kept base's reader marks as
   its own takes this path. A head failure or a reader cancellation keeps
   a valid base. On 2026-11-16 the performance orchestrator confirmed
   that the task's no-retry rule covers tests, time limits, and polling
   loops, not this fallback. That instruction also allowed one immediate
   new classification. The orchestrator chose the same classification,
   because the server has no typed outcome for the alternative. A freshness
   check that fails before any read takes the same single fresh path.
9. Serve also reuses a base whose capture did not fit. Its uncaptured views
   render through the kept graph, as the comparison does today.
10. A failed reference lookup keeps the base until the next successful
    classification or Serve's stop.
11. `review.base-tree` carries `action`, `reuse` or `prepare`. A reuse emits
    no `review.base-extraction`, `review.base-dependencies`, or
    `review.capture-side` span. Note of 2026-11-16: the Serve trace already
    passes an `action` string, at `crates/mokly-cli/src/serve_trace.rs:72`.
12. The lifetime rule lives in the
    [base preparation contract](../docs/protocol/mokly-base-preparation.md).
    Corrected on 2026-11-16: `docs/protocol/mokly-runtime.md` has 250 lines
    against the cap of 250, and it already has a status line. Milestone 1
    extends that line and changes sentences without net new lines.
13. Code that does not fit the 300-line cap of a scoped file goes to a new
    module beside that file. Note of 2026-11-16:
    `crates/mokly-compare/src/base_render.rs` has 296 lines, so the reuse
    path goes to a new module.
14. The docs implementor's call, 2026-11-16: a reuse announces no
    `Extracting`, `Installing`, or `Rendering` step. The spinner keeps
    `reading base catalogue` until `finding changes`. PR #248 added these
    steps. The
    [terminal steps contract](../docs/protocol/mokly-terminal-steps.md#comparison-steps)
    starts each step only when its work starts, so it needs no change.
15. The docs implementor's call, 2026-11-16: the kept base keeps the
    `scripts_off` flag of its preparation. A failure of a reuse then carries
    the same scripts hint as a failure of a fresh preparation. Commit
    `7d0682af4` added the flag to `PreparedBase` and `Error::Base`.
16. The docs implementor's call, 2026-11-16: decision 1 needs no new public
    API in `mokly-render` or `mokly-catalogue`. Its checks read public
    fields. These are the `module_digests` of
    `PreparedCatalogue::javascript.generation` and the
    `dependency_directories` of each side. They also include the
    `dependency_usage` of the head `Runtime`, and the `tier` and the
    `module_resolution` of the base side's `Resolved`. The new public items
    are the kept-base methods and types of `mokly-compare`.
17. The docs implementor's call, 2026-11-16: decision 6 adds one default
    method to the `Repository` trait of `mokly-git`. It returns the checkout
    identity without the salt, and it says whether a file has a `filter`
    attribute. `source_key` keeps its exact bytes, so no source cache key
    changes.
18. The docs implementor's call, 2026-11-16: the install record, entry list,
    and installed-module checks of decision 1 cover only a base that reads
    the working install. Such a base is tier 1, tier 3, or HTML-only. A
    tier-2 base reads its own install from the dependency cache, so its
    modules can differ from the head's. The selection check of option 1A
    runs for every base.
19. The docs implementor's call, 2026-11-16: the crate READMEs change with
    the code in Milestones 2 to 4, not in Milestone 1. Their Key Code names
    entry points that exist only after the code lands.
20. The workspace orchestrator's call, 2026-11-16, under decision 6B: a
    fresh preparation samples the checkout identity and its filter flag
    after the pin and before its first base read. The kept base records
    that sample. It does not sample again at keep. Reason: a setting that
    changes during preparation must make the next reuse check fail.
    Sampling only at keep could keep older bytes under newer settings.
    A setting that changes and changes back between samples stays unseen,
    as in a fresh preparation today.
21. The workspace orchestrator's call, 2026-11-16: a reader records its own
    base read failure for the bounded fallback. A head read failure or a
    reader cancellation does not release a valid base. Reason: the frozen
    readers of both sides return the same server error inside a graph
    provider error. The comparison layer cannot identify the side from
    that error type. This call applies the options check's first problem.
22. The workspace orchestrator's call, 2026-11-16: also align the replacement
    rule in `mokly-on-demand.md` with decision 2B. Reason: its rule that
    replacement cancels every active Git command needs the same kept-base
    exception as the other cancellation rules. This adds no user decision.
    The docs implementor keeps the runtime change in its Changes section,
    includes `build` in the timing rule, and points follow-up links to the
    protocol anchors. This preserves the runtime cap, the prepare trace,
    and links after this plan is deleted.

23. The workspace orchestrator's call, 2026-11-16: release uses the exact
    `Arc<KeptBase>` identity. The reader releases it on its first owned
    failure, also after classification returns. The reuse attempt ends
    before fresh preparation starts. Reason: a late failure must preserve
    a newer slot, and the fallback must release its local old handles.
24. The workspace orchestrator's call, 2026-11-16: a successfully kept fresh
    base uses the same reader as a found base. A streamed asset copy also
    checks that reader. Reason: the first published result and a copy after
    an asset opens need the same cancellation and failure checks.
25. The continuation orchestrator's call, 2026-11-17: split the checkout
    sample test at the milestone boundary. Milestone 3 proves that a setting
    change after the first base read preserves the earlier sample and makes
    the freshness check stale. Milestone 4 proves that the stale check
    releases the Serve slot and prepares again. Reason: Milestone 3 has no
    Serve slot, and the requirement needs no test-only retention provider.
26. The continuation orchestrator's call, 2026-11-17: only a provider that
    can keep a base enables preparation evidence. A sample or record failure,
    except cancellation, gives no evidence and keeps the normal fresh path.
    Reason: optional reuse must add no limit or failure to a fresh build, and
    `build` and `publish` need no evidence. This fixes the unused whole-tree
    sample and its new failure found by the docs implementor.
27. The non-UI implementor's call, 2026-11-17: keep the exact working inputs
    returned to dependency selection and HTML's exact governing candidate
    paths. Reason: this applies decision 1C without another selection rule.
28. The non-UI implementor's call, 2026-11-17: fingerprint direct package names
    and kinds, plus scoped package directory children. Read npm's
    `.package-lock.json`, pnpm's `.modules.yaml` and `.pnpm/lock.yaml`, Yarn
    Classic's `.yarn-integrity`, and Yarn Berry's `.yarn-state.yml` and sibling
    `.yarn/install-state.gz`. Reason: these are the selected installs' records.
29. The non-UI implementor's call, 2026-11-17: stream manager records and bound
    package-name storage with the existing Git limits. Give no evidence when
    a bound or unreadable record prevents proof. Reason: memory stays bounded,
    and no new build rejection is needed.
30. The non-UI implementor's call, 2026-11-17: use the base's dependency usage
    directories and prepared catalogue dependency directories as working
    roots. Tier 2 has no working roots or shared-module check. Reason: this
    follows design call 18 and covers each root the base reads.
31. The non-UI implementor's call, 2026-11-17: move the unchanged `Repository`
    implementation to `repository_access.rs`. Reason: both files stay below
    the 300-line cap.
32. The non-UI implementor's call, 2026-11-17: forward the two added scheduling
    methods through `BaseReader`, and keep its retained-input path and
    `comparison_capture` result of `None`. Reason: the scheduling of `main`
    stays active, with the reader's cancellation and owned failure checks.

33. The continuation orchestrator's call, 2026-11-17: put one shared kept-base
    slot on `ServeChanges`, and put retention policy in a provider wrapper.
    Hash the adopted configuration, its resolved paths and authored inputs,
    the merge-base commit, and the scripts setting. Release by `Arc` identity.
    Reason: every source shares one bounded slot, and an old reader cannot
    clear a newer base.
34. The continuation orchestrator's call, 2026-11-17: give fresh base work one
    detachable cancellation token. Before keep it follows the classification,
    capture scope, and command stop. An eligible keep detaches inside the
    original classification's commit callback. Reason: replacement cannot
    race the handoff, and a base that is not kept keeps its earlier lifetime.
35. The continuation orchestrator's call, 2026-11-17: keep each reader's
    `CombinedCancel` separate from the detachable base token. The new Git
    repository uses the still-attached base token during freshness checks.
    Reason: a cancelled reader cannot poison a kept base, and a freshness
    check can still stop promptly before reuse.
36. The continuation orchestrator's call, 2026-11-17: take a slot snapshot and
    run freshness checks outside its lock. Choose head catalogue directories
    for HTML evidence, and runtime usage and unmapped directories for sidecar
    evidence. End stale local handles before fresh preparation. Reason: slow
    IO holds no slot lock, and the check uses the exact selection inputs.
37. The continuation orchestrator's call, 2026-11-17: the Serve provider checks
    evidence and source eligibility, installs the kept base without a new
    sample, and returns the existing `BaseReuse` reader path. Reason: the
    original sample, typed failure ownership, and bounded fallback stay in
    force for both the first result and later classifications.

38. The non-UI implementor's call, 2026-11-17: `ServeChanges` owns the slot
    strongly, and each classification's provider holds only a weak slot
    handle. Reason: `BaseReader` retains its provider. An old in-flight reader
    must not keep a newer slot entry after the last Serve state drops. Its
    own base can remain until the reader ends, as decision 4A permits.

### Code facts on `main` at `a1d834fbe`

The docs implementor checked these facts on 2026-11-16.

1. The base side has no pool of its own. A base request switches one pool
   worker to the base source root. The pool stops a head worker and starts
   one there, at `crates/mokly-sidecar/src/pool_sources.rs:24`. The trace
   shows `sidecar.recycle` with `reason: "root-switch"`.
2. The provider does not capture. `Changes::classify` captures the base
   after the provider returns, at `crates/mokly-compare/src/base_render.rs:233`.
3. `review.base-tree` also holds two status publications and the extraction
   lease. `PreparingDependencies` publishes `preparing`, at
   `crates/mokly-cli/src/serve_changes_base.rs:91`. `AttemptBase` publishes
   `pending` again at line 128. On 2026-10-30 each publication rebuilt the
   index and 240 entry details. `review.base-extraction` took 0.3 s on the
   slower machine.
4. Tier 1 is not the only working-tree input. An HTML-only base reads
   package stylesheets through the working dependency tree. Its
   `base-dependencies` warning compares working manifests, in
   `html_dependencies` at `crates/mokly-cli/src/changes_base.rs:194`.
5. PR #248 added comparison steps on 2026-10-30. `Changes::classify`
   announces `Reading` before the pin, at
   `crates/mokly-compare/src/base_render.rs:188`. `BaseRequest` carries
   `steps`, and `NativeBase` announces `Rendering`.
6. Each base handle follows the classification's `CombinedCancel`. The Git
   runner gets it at `crates/mokly-cli/src/serve_changes_native.rs:115`.
   The sidecar pool handle and the render workers get it in
   `classification_runtime`, at line 170. The source tree gets it at
   `crates/mokly-cli/src/changes_base.rs:62`.
7. A selected capture binds its cancellation into the base through
   `Source::capture_scope`, at `crates/mokly-cli/src/serve_changes.rs:100`.
   It also checks its own token before each document and each resource, at
   `crates/mokly-server/src/comparison_capture.rs:160`.
8. `ServeChanges` is built at `crates/mokly-cli/src/serve_delivery.rs:56`.
   Every `Source` clones it, so a slot on it is shared by every `Source`.
9. The checkout identity is `checkout_key`, at
   `crates/mokly-git/src/source_key.rs:12`. It adds a per-preparation salt
   at line 40 when a file has a `filter` attribute.
10. Both sides expose the installed-module digests of their bundle in
    `catalogue().javascript.generation.module_digests`. Installed modules
    have logical `node_modules/` names, from
    `packages/mokly/src/sidecar/module-paths.ts:145`.
11. The base capture bound is 256 MiB, at
    `crates/mokly-compare/src/capture_weight.rs:16`. The accepted
    classification already holds its captured base until the next `pending`
    publication replaces it.

### Scope

- `crates/mokly-compare`: the kept-base contract, the reuse path, and the
  checks of decision 1, in new modules where a file is near its cap.
- `crates/mokly-cli`: the Serve slot, the base cancellation of decision 2,
  the working-install reads, and the release events.
  `crates/mokly-cli/src/serve_delivery.rs` gets one line for the slot.
- `crates/mokly-git`: the checkout identity of design call 17.
- `crates/mokly-server`: only when design call 8 starts a new
  classification.
- The pages of Milestone 1, the crate READMEs, and
  `plans/follow-ups/background-base-render-pool.md`.
- Out of scope: `crates/mokly-render`, the watch code,
  `crates/mokly-compare/src/git_failures.rs`, `entry_serve.rs`,
  `serve_lifecycle.rs`, render keys, and the source and dependency caches.
  Options 1D, 1F, 2C, 2D, and 4B needed them. No answer chose them.

## Decisions

On 2026-11-16 the performance orchestrator answered these decisions for the
user. Decisions 1 to 5 keep the numbers of the plan at `129dda09`. Decision
6 comes from the follow-up item of 2026-11-01. The options check of
2026-10-30 stayed in the closed perf 6 workspace. The orchestrator saves the
options check of these answers under `.context/keep-base-side-in-memory/`.
The check of 2026-11-16 kept each answer. Its report is
`.context/keep-base-side-in-memory/options-check.md`. The design and TODOs
include its three corrections. No new user decision is open.

All options share these assumptions. Serve keeps one base, as the third
design call says. The base lives in process memory only, under the user
decision of 2026-10-27. A reuse must give the result of a fresh preparation,
under the user decision of 2026-10-30.

### 1. Working-install changes

Severity High. Root question: when does a kept base still give the result of
a fresh preparation, when it reads files of the working install? Shared
assumption: tiers 1 and 3 and an HTML-only base read the working install,
under the base preparation contract.

- **A.** Check the dependency selection again before each reuse. It misses an
  install that keeps the lockfile. Effort: Medium.
- **B.** A, and compare the install record and the entry list of each working
  `node_modules` root. It misses Bun and hand edits. Effort: Medium.
- **C.** B, and compare the base bundle's installed-module digests with the
  current head bundle's digests. It misses package stylesheets, assets, and
  files that only the base reads. Effort: Medium.
- **D.** A, and release the kept base on a head watch event below a used
  dependency directory. It changes the watch code. Effort: Medium.
- **E.** C, and digest again each file that the base read through the working
  dependency reader. The sidecar reads module files itself, so this reader
  misses modules that only the base imports. Effort: Large.
- **F.** B, and check the input stamps of the base runtime again, with a new
  check in `crates/mokly-render`. Nobody measured it against the 0.5 s
  target. The stamps miss `jsconfig.json` candidates, tsconfig `extends`
  targets, and peer manifests other than React. The 64 MiB stylesheet store
  can evict a record with its stamp. Effort: Large.
- **G.** Digest each installed file that the base read again from disk.
  Use the bundle's module and resolution lists and the dependency reader's
  file list. It covers more inputs than C, but misses runtime packages
  that the sidecar does not bundle. Nobody measured it. Effort: Large.

Left out: a copy of the working install for the base. It breaks the rule
that both sides use the working install in tiers 1 and 3. It also keeps
older files while a fresh preparation reads the current install.

**Answer, 2026-11-16:** C. Reason: it checks every module that both sides
read, and its code stays in `mokly-compare` and `mokly-cli`. It changes no
render key and no cache. F was not adopted. F needs a new check in
`crates/mokly-render`, nobody measured it, and its stamps still miss inputs.
The follow-up item had recommended F.
The options check added G. C stays the recommendation and the answer.
G is the wider fix when a future change needs more coverage.

Accepted limits of C:

- A change to a package stylesheet, an asset, or a file that only the base
  reads keeps the base, when the install record and the entry list stay
  equal.
- Bun installs and hand edits inside `node_modules` change no install record.
- The head digests are as current as the last head bundle.
  `plans/follow-ups/installed-module-watch-paths.md` records that the watcher
  can miss installed modules.
- A missed change stays until a Serve restart or a key change prepares the
  base again.
- Under design call 5, a manager installed during the session takes effect
  at the next preparation.

### 2. Cancelled readers

Severity High. Root question: how do a replaced classification and a
cancelled selected capture stop promptly on one kept base, and leave it
usable? Today a stopped Git read records a fatal source failure, in
`GitTree::failed` at `crates/mokly-compare/src/git_failures.rs:15`.

- **A.** Release the kept base after any cancelled read. Each edit during a
  classification then loses the gain. Effort: Small.
- **B.** Detach at keep. The base then follows only Serve's stop, and each
  reader checks its own cancellation before each call. It changes the
  replacement rule of `docs/protocol/mokly-comparison-serving.md` and the
  capture-abort rule of `docs/protocol/mokly-selected-comparisons.md`.
  It also changes the shared cancellation rule of the base preparation
  contract, because a kept base follows only Serve's stop.
  Effort: Large.
- **C.** B, and a cancelled Git read records no source failure. One capture
  scope can then stop a read in flight, and the capture-abort rule stays. It
  can also stop a simultaneous classification's read. It changes
  `crates/mokly-compare/src/git_failures.rs`. Effort: Large.
- **D.** A shared reader scope: the base stops only when every reader is
  cancelled. An edit can cancel the last reader before the next reader
  arrives, which stops the base and records a source failure. Effort: Large.
- **E.** Pass each reader's token through each call to the Git runner,
  admission gate, and render workers. A cancelled call records no shared
  source failure. It changes five crates, including the out-of-scope
  `mokly-render`, or adds a context across worker threads. Effort: Large.

Left out: a fresh base runtime for each reader. It prepares the graph again
and misses the 0.5 s target.

**Answer, 2026-11-16:** B. Reason: it is the only option that keeps the base
across replacements without a new race. The answer approves the two protocol
rule changes and the shared base cancellation rule. Accepted cost: a call
that already runs finishes after its
reader is cancelled. Such a call is a Git read, a sidecar call, or a wait at
the sidecar admission gate. A render worker also finishes its current work.
Only Serve's stop interrupts it. The options check added E as the wider
fix. B stays the recommendation and the answer.

### 3. What Serve keeps

Severity Medium. Root question: what must Serve keep so that a reuse needs
no preparation and no capture?

- **A.** The captured generation with its graph, sources, leases, and bundle
  generation. Effort: Small.
- **B.** The capture and the catalogue only. Views outside the capture then
  cannot render. Effort: Large.

Left out:

- A disk copy of the capture. The user chose option A over it on 2026-10-27.
- Keep the capture and leases, then prepare the graph on a miss. It breaks
  the rule that a reuse runs no base graph preparation.
- Keep the graph without the capture, then capture at each reuse. A keeps
  the capture that the accepted classification already holds and avoids
  that repeated work.

**Answer, 2026-11-16:** A. Reason: it is the smallest option that meets the
goal.

### 4. When Serve releases it

Severity Medium. Root question: when must Serve give up the kept base?

- **A.** On the base events, and at stop when the last Serve state drops.
  Effort: Small.
- **B.** A, and also in the release step of the shutdown order. It frees
  nothing more. Effort: Medium.

Left out: an idle time limit. The accepted classification holds the same
base while its publication is current, so a limit frees no memory then. A
limit also prepares the base again after a pause.

**Answer, 2026-11-16:** A. Reason: it is the smallest option that meets the
goal.

The base events are these:

- a merge-base move or another key change,
- a failed freshness check,
- a base error or a source failure,
- a fallback that design call 4 does not keep,
- a failed reuse under design call 8.

### 5. The render pool follow-up

Severity Low. Root question: what changes for
`plans/follow-ups/background-base-render-pool.md`?

- **A.** Change nothing in it. Effort: Small.
- **B.** Add two facts to it. Base capture then runs only on a fresh
  preparation. Under 2B, a replaced reader cannot cancel a kept-base render
  that waits at the admission gate. Effort: Small.
- **C.** Do that item in this branch. Effort: Small. The options check
  aligned this grade with the follow-up item's grade for the same work.

Left out: close the item. Fresh preparations still capture the base, so
the stall that the item describes stays.

**Answer, 2026-11-16:** B. Reason: it is the smallest option that keeps the
item true. Its impact text must also say that a kept-base call ends its
admission wait when the foreground request ends or Serve stops. Cancelling
the reader no longer ends that wait.

### 6. Git checkout settings

Severity Medium. Root question: how does a kept base follow a change of the
effective Git checkout settings? The source identity hashes the commit, the
full Git configuration, and the effective attributes of each file. It adds a
salt for each preparation when a file has a `filter` attribute.
`docs/protocol/mokly-base-cache.md` makes a settings change invalidate a
source entry, and a later preparation runs external filters again. A base
without an extraction reads later files through Git with the current
settings, at `crates/mokly-compare/src/sources.rs:185`.

- **A.** Keep the conversion of the preparation until the next preparation.
  This was design call 6 of 2026-10-30. Effort: Small.
- **B.** Check the identity, without its salt, before each reuse. Keep no base
  whose files use an external filter. Effort: Small, an estimate.
- **C.** B, but keep a filtered base and its earlier filter output. This
  changes the filter rule of the cache contract. Effort: Small, an estimate.
- **D.** Release the base on a watch event of the Git files. The watcher skips
  `.git`, at `crates/mokly-watch/src/pattern.rs:37`, so this changes the
  watch code. Effort: Medium, an estimate.
- **E.** Keep the pinned file list. Check Git configuration and attribute
  files outside the commit before each reuse. Recheck attributes only
  after a change. It needs the system attributes path and misses a Git
  upgrade during the session. Effort: Medium.

Left out: a digest of each converted base file at each reuse. It reads every
file and misses the 0.5 s target.

**Answer, 2026-11-16:** B. Reason: it keeps the cache contract, and it checks
the same checkout identity that a fresh preparation uses. Cost: each reuse
runs the Git configuration list, the tree listing, and the attribute check.
Milestone 3 measures it against the 0.5 s target.
The full configuration also includes writes that change no checkout,
such as an upstream setting. Those writes release the base. A repository
with Git LFS filters keeps no base. The options check added E, but B stays
the recommendation and the answer.

## Milestone 1: Documentation and protocol

Depends on: none

The docs implementor writes the contract. Each changed page gets the status
line of the repository rules until Milestone 6.

- [x] `docs/protocol/mokly-base-preparation.md`: add a Serve base lifetime
      section. It states what Serve keeps, the key, and the freshness checks
      of decisions 1 and 6 with the accepted limits of decision 1. It also
      states the cancellation rule of decision 2, the release events, the
      fallback of design call 8, and the bound of one kept base. It gives
      the decisions in force with their rejected options. Change the shared
      cancellation rule at line 62 under decision 2.
- [x] `docs/protocol/mokly-runtime.md`: Serve keeps the base capture between
      classifications. Extend the existing status line. Keep the page at 250
      lines or fewer.
- [x] `docs/protocol/mokly-comparison-serving.md`: one kept capture instead
      of one for each classification, its memory bound, and the replacement
      rule at line 104 under decision 2.
- [x] `docs/protocol/mokly-selected-comparisons.md`: the capture-abort rule
      at line 102 under decision 2, and the memory bound at line 119.
- [x] `docs/protocol/mokly-timings.md`: the spans of design call 11.
- [x] Align `docs/protocol/mokly-changes.md`,
      `docs/protocol/mokly-watch-runtime.md`, and
      `docs/architecture/rust-core.md`.
- [x] Align the Git replacement rule in `docs/protocol/mokly-on-demand.md`
      with decision 2B, under design call 22.
- [x] Update `plans/follow-ups/background-base-render-pool.md` under decision
      5, and refresh its code locations.
- [x] When the plan commit did not do it, delete
      `plans/follow-ups/keep-base-side-in-memory.md`. Fix the three links to
      it in `plans/follow-ups/installed-module-watch-paths.md` and
      `plans/follow-ups/bundle-disk-cache.md`.
- [x] Fetch `origin/main`. Run `npm run format:check`,
      `npm test -- tests/markdown_links.test.ts`, and
      `cargo xtask source-file-length-lint`.

Evidence: `.context/keep-base-side-in-memory/milestone-1-report.md`.

## Milestone 2: Reuse contract in mokly-compare

Depends on: 1

The `non-ui implementor` adds the reuse path to `Changes::classify`. The new
provider methods keep nothing by default, so `build` and `publish` do not
change.

- [x] `BaseProvider` gets three default methods. They find a kept base for
      the pinned commit and the key, keep a captured base, and release it.
      A kept base holds its source-failure record and its `scripts_off`
      flag, under design call 15.
- [x] `Changes::classify` asks for a kept base after the pin and before it
      creates sources. A reuse skips sources, preparation, and capture. It
      compares through the reader of design call 7.
- [x] A fresh preparation keeps the base after its capture succeeds, under
      design calls 4 and 5. The base events release it.
- [x] A failed reuse releases the base first, then prepares once, under
      design calls 8 and 21. Only a failure marked by the base reader takes
      this path. A head failure or cancellation keeps a valid base.
- [x] `review.base-tree` records `action`.
- [x] Update the strict provider mocks of the existing tests, also the step
      tests of PR #248.
- [x] Test: two classifications through one provider prepare and capture the
      base once.
- [x] Test: a source failure on a reused base releases it.
- [x] Test: a failed reuse read releases the base, and the classification
      prepares once and no more.
- [x] Test: a head failure and reader cancellation do not take the fresh
      base path or release a valid base.
- [x] Update the Key Code of `crates/mokly-compare/README.md`.

Evidence: `.context/keep-base-side-in-memory/milestone-2-report.md` and
`.context/keep-base-side-in-memory/milestone-2-docs-report.md`.

Implementation approval, 2026-11-16: the performance orchestrator chose 1A
for the strict fixtures under user delegation. Separate strict Unimock
instances cover present and absent boundaries. Every assertion stays.
The implementor stops after three further unexpected failures of the same
tests and sends the logs. This adds no product decision.

## Milestone 3: Freshness checks

Depends on: 2

Continuation, 2026-11-17: this workspace starts from `5f8f2716e` and redoes
the uncommitted work of the earlier workspace. `983654df0` merges `main`
at `6d0fcbb46` without conflicts. Evidence:
`.context/keep-base-side-in-memory/merge-resolution.md`.

The `non-ui implementor` records the inputs of decisions 1 and 6 at
preparation and checks them before a reuse. Nothing reuses a base yet.

- [x] Enable preparation evidence only for providers that can keep a base.
      A sample or record failure except cancellation gives no evidence and
      preserves normal fresh preparation, under design call 26. Test both
      disabled evidence and failed optional evidence.
- [x] Record the inputs of decision 1 at preparation: the dependency
      selection, the install record and the entry list of each working
      `node_modules` root that the base reads, and the installed-module
      digests of the base bundle.
- [x] A check reads the current values and compares the installed-module
      digests with the current head bundle's. It says whether the base is
      current. Design call 18 sets which bases it covers.
- [x] Add the `Repository` method of design call 17. Sample the identity and
      its filter flag after the pin and before the first base read, under
      design call 20. Record that sample with the kept base. Keep no base
      whose files have a `filter` attribute.
- [x] Test: `source_key` gives its earlier value for a commit without a
      `filter` attribute, and it stays salted for a commit with one.
- [x] Tests: equal inputs keep the base current. Each of these makes it
      stale: a changed working lockfile, install record, entry list,
      installed-module digest, or checkout setting. A tier-2 base ignores
      the working install records. A base with a `filter` attribute is not
      kept.
- [x] Test: a checkout setting that changes after the first base read and
      before the keep preserves the earlier sample and makes its freshness
      check stale. Milestone 4 proves the next preparation.
- [x] Measure the time of both checks on `examples/basic` and the React
      fixture. Save the results under `.context/keep-base-side-in-memory/`.
      When the checks miss the 0.5 s target of `review.base-tree`, stop and
      report to the orchestrator.
- [x] Update `crates/mokly-git/README.md` for the new method.
- [x] Update the moved checkout call location and new callers in
      `plans/follow-ups/plain-git-fsmonitor-override.md`.
- [x] Update moved `Repository` call locations in
      `plans/follow-ups/partial-clone-lazy-fetch-builds.md` and
      `plans/follow-ups/plain-git-promisor-tree-reads.md`.

Evidence: `.context/keep-base-side-in-memory/milestone-3-report.md` and
`.context/keep-base-side-in-memory/milestone-3-docs-report.md`.

The main refresh at `f380e9462` merged without conflicts as `59c51fa33`.
Evidence: `.context/keep-base-side-in-memory/merge-resolution.md`.

## Milestone 4: Serve kept base

Depends on: 3

The `non-ui implementor` keeps the base in Serve and reuses it.

- [x] Add one kept-base slot to `ServeChanges`, shared by every `Source`.
- [x] Prepare the base under decision 2. Until the keep, the base's Git
      runner, source tree, sidecar pool handle, and render workers follow
      the preparing classification. At the keep they detach, and then they
      follow only Serve's stop.
- [x] Give each classification its own reader of the kept base. A selected
      capture keeps its own check before each document and each resource.
- [x] Reuse only for an equal key and current freshness checks.
- [x] Release on the base events, and at stop when the last Serve state
      drops, under decision 4.
- [x] Apply design calls 1 to 5, 7 to 10, 14, and 15.
- [x] Test: a second classification with the same merge base prepares once.
- [x] Test: a merge-base move prepares again and drops the old base.
- [x] Test: a checkout setting that changes after the first base read and
      before the keep releases the slot at the next classification and
      prepares again, under design call 25.
- [x] Test: cancel the preparing classification after the keep, and cancel a
      capture in a base read. Then a reuse reads a document and a resource.
- [x] Test: a changed frozen resource on a reuse releases the base, and the
      same classification prepares once.
- [x] Test: after the last Serve state drops, a weak handle of the base is
      empty.
- [x] See each new test fail once. Run the targeted tests of `mokly-compare`,
      `mokly-git`, `mokly-cli`, and `mokly-server` when it changed.
- [x] Update `crates/mokly-cli/README.md` for the kept base.

Evidence: `.context/keep-base-side-in-memory/milestone-4-report.md` and
`.context/keep-base-side-in-memory/milestone-4-docs-report.md`.

## Milestone 5: Measurement and smoke test

Depends on: 4

- [ ] Build release binaries of the branch and the last merged `main`,
      `f380e9462`, with `cargo build --release -p mokly-cli`. Each checkout
      has its own target directory. The before checkout is
      `.context/before-checkout`, with `.context/target-before`. Refresh
      `.context/keep-base-side-in-memory/before-mokly` from that build.
- [ ] Interleave three before runs and three after runs, in the order before,
      after, before, after, before, after. Measure the Serve edit on
      `examples/basic` and on the React fixture of the
      [large fixture README](../tests/fixtures/large/README.md). Save each run
      and the medians under `.context/keep-base-side-in-memory/`.
- [ ] Report the retained bytes of each kept base: `retainedBytes` and
      `encodedBytes` of the first `review.capture-side` span of each run.
      Also record the peak resident size of each run, because the goal
      forbids a change that can exhaust memory.
- [ ] When `/home/user/code/mokly-cloud` is available, run Serve on its
      catalogue with each binary. Make two edits, and record each
      classification. Revert the edits, and commit nothing there. Otherwise
      record why the run was skipped.
- [ ] Confirm the acceptance. After the edit, the second classification runs
      no base `config.load`, `catalogue.discover`, `catalogue.validate`, or
      `graph.prepare` span. `review.base-tree` takes under 0.5 s. Edit to the
      end of the second classification falls by about the base side. The
      first classification is not slower.
- [ ] Smoke test: run Serve on the example, and change the visible text of
      one screen. The next classification lists that screen and prepares no
      base. Restore the text. The next classification lists nothing.

## Milestone 6: Verification, commit, review, and pull request

Depends on: every other milestone

Evidence: `.context/keep-base-side-in-memory/merge-resolution.md` holds the
preservation audits of the merges of `main` at `6d0fcbb46` and `f380e9462`.
The pull request description copies their outcomes.

- [ ] Remove the status lines that Milestone 1 added. Keep the macOS item of
      the runtime status line.
- [ ] Refresh the live code references in affected follow-up items after the
      Milestone 4 code layout settles. Keep their requirements and grades.
- [x] Merge `origin/main` with the `git-merge` skill.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request with `gh pr create --base main`. Its description
      gives the decisions and the design calls with their dates, a
      permalink to this plan, the before and after table with the retained
      bytes, and the follow-up items that the change adds.

## After the pull request opens

These steps are not milestone TODOs.

- Wait for CI with the `finish-work` skill. Fix each failure in this branch.
- Report with the `finish-work` skill. Do not merge the pull request.

## Post-merge follow-up (non-blocking)

- None.
