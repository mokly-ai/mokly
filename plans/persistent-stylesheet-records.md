# Reuse stylesheet records after Serve restarts

Status: Active. On branch `calummoore/mokly-stylesheet-store-across-restarts-jffu`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly Serve keeps compiled stylesheet records in memory. Each new process
currently compiles every stylesheet root again. This change stores those
records in a separate kind of the existing repository cache.

On 2026-11-21, the performance orchestrator chose option B of the
[stylesheet restart item](follow-ups/stylesheet-cache-across-restarts.md).
The bundle cache has merged. A separate cache implementation and parallel
work against the bundle-cache branch are therefore unnecessary.
The performance orchestrator owns official measurements and every merge.
This workspace opens one pull request into `main` and does not merge it.

On 2026-11-21, the performance orchestrator approved C with a provisional
256 MiB namespace bound and a 64 MiB entry ceiling. It approved the
environment hash, original stamps, side ownership, memory borrowing, writer
gate, and direct compilation after a memory stamp mismatch.
It amended admission to require complete and stable evidence. Incomplete
records stay memory-only and compile again after a restart. It rejected the
earlier interpretation that existing incomplete evidence permits disk reuse.
Count eligible roots before implementation. If basic's Tailwind root does
not qualify, stop and request a decision on the evidence gap.

On 2026-11-21, the orchestrator signalled that PR #459 merged at `793d0c77d`.
This branch integrated `origin/main` at merge commit `d5f53f82c` without
conflicts. The preservation audit is
`.context/persistent-stylesheet-records/main-merge-audit.log`.
Product code and cache red tests still wait for the evidence decision below.
The orchestrator separately authorized a main regression test for a dropped
observed Browserslist configuration read. That diagnostic changes no product
code and stays outside this speed change unless its evidence work fixes it.
Later integration follows the repository merge rules. PR #461 changes base
startup order. This change must work with that order too.

Contract owners:

- [Retained cache storage](../docs/protocol/mokly-base-cache.md).
- [PostCSS reuse](../docs/protocol/mokly-imported-styles-postcss.md).
- [PostCSS evidence](../docs/protocol/mokly-sidecar-postcss.md).
- [Timing diagnostics and budgets](../docs/protocol/mokly-timings.md).
- [Cache output](../docs/protocol/mokly-terminal-cache.md).
- [Render integration](../crates/mokly-render/README.md).
- [Cache storage](../crates/mokly-compare/README.md).

## Acceptance

- Basic warm unchanged restarts improve mean `serve.ready` by at least 0.5 s
  in interleaved rounds against `main`.
- A warm unchanged stylesheet root runs no PostCSS and no CSS bundle.
- Basic first Changes and edits are no slower.
- Cloud startup, first Changes, and edits are no slower beyond noise.
- Published output is byte-identical on basic, large HTML, large React,
  and the cloud catalogue.
- Basic whole-process-tree memory peaks stay within 2% of `main` for warm
  restarts and cold sessions with ten edits.
- The stored kind has its own byte bound and eviction.
- The complete gate, review rounds, and Required CI pass before handoff.

## Design

These requirements come from the task of 2026-11-21:

- Load stored records through the existing cross-generation evidence check.
  Preserve source bytes, read evidence, asset and glob stamps, configuration,
  plugin packages, toolchain identity, and format and Mokly versions.
- Preserve observed and late evidence separately. Do not upgrade incomplete
  PostCSS coverage. Add no modification-time shortcut.
- Preserve the shared and attempt-local 64 MiB memory bounds.
- Use the existing cache ownership, entry format, fault classes, lock,
  publication, accounting, and eviction rules.
- A lock attempt never waits. A held lock skips a save or makes a read miss.
- Save only a successful compilation with complete and stable evidence. Saves add no
  wait to readiness or an edit. A cancelled or skipped save stays optional.

### Record ownership and loading

The options check of 2026-11-21 recommends C instead of the initial A.
The baseline prepares every root before readiness. One snapshot per side
therefore avoids repeated namespace scans, context copies, and durable writes.
The full report is `.context/persistent-stylesheet-records/options-check.md`.

Proposed design: load a side's snapshot on its first lookup without a memory
candidate. A memory candidate whose stamp failed goes straight to compilation.
Do not reread its stale disk copy on every edit. Measure read, decode,
evidence check, and replay costs separately. Prefetch remains optional.

A snapshot contains root bundles, their original captured stamps and read
evidence, and each distinct context-chain entry once. Store the chain in
base-first order without recursive encoding. Restore its original stamps.
Never use record constructors that take new stamps from the current tree.
Check each requested root and its context against the current side tree.
Rebuild memory charges from decoded allocations. Never trust stored charges.
Intern the original chain entries in the bounded store. Check each entry
once per attempt, as current memory hits do. Stream the codec without a
second complete payload buffer. Keep decoded state within the memory bound.

Design call, 2026-11-21: keep the current side and resolution keys.
Plain CSS can share in memory when its existing key and evidence permit it.
PostCSS keeps its physical source root in the key. Its worker receives
physical paths, and records hold physical asset and file identities.
Rebasing those records would change the evidence contract.
Give each side a distinct snapshot key, also for plain CSS. Include the
effective settings and physical source identity. This prevents a partial
snapshot of one side from replacing the other side's set of roots.
Warm each side's own snapshot. Base lookups still use the base tree
and pinned evidence. A base lookup never mutates the head memory store.

### Optional writer

Proposed design: use one optional writer for rendered documents and stylesheet
snapshots. Keep both kinds' bounds, codecs, faults, and statistics separate.
Use the render store's readiness and foreground-activity gate. Start no save
before first Changes finishes, or while foreground preparation is active.
An edit pauses new writes without waiting for a write already in progress.
Offers hold weak store references and bounded key metadata. They do not clone
stylesheet text or keep evicted records alive. A snapshot must not retain a
second complete set of records through a later edit. An interrupted snapshot
is a normal skipped save. Recheck activity before publication.
Release codec buffers between saves. Cancellation and shutdown do not drain
the queue on a readiness or edit path.
Tests observe save completion before starting the second process.
They never infer completion from readiness or a delay.

### Toolchain identity

Design call, 2026-11-21: bind stored records to the native toolchain identity.
For PostCSS, also bind them to the existing sidecar toolchain identity.
That identity covers the package version, Node version, esbuild version,
installation root, and built package files.
Reuse the identity from a JavaScript bundle result when available.
For PostCSS without JavaScript, obtain that identity without running PostCSS.
If this needs a typed sidecar request, keep Rust as its type owner and
regenerate the TypeScript declarations. Plain CSS needs no Node process.
Start identity preparation early and share existing native identity work.
An unavailable identity prevents disk reuse and storage only.

### PostCSS restart rules

Bind PostCSS snapshots to a digest of the effective child environment under
the existing inheritance rules. Do not guess a variable allow list.
Store and log no environment values. A changed digest is a normal miss.
Plain CSS needs no environment identity.

Only complete and stable evidence permits disk admission and reuse.
Use the bundle cache's stable-capture rule. Consistency alone is insufficient.
A read that escapes observation gains no invented witness. A declaration,
late digest, or matching filename list does not prove a consumed read.
Incomplete or unstable records remain memory-only. A restart compiles them
again. Preserve the existing in-process reuse rules for those records.

The current PostCSS producer reports incomplete coverage for every result.
The current core evidence type has no complete variant. The eligibility
census must distinguish this missing proof from observed read counts.
Do not implement a store that falsely marks those records complete.

The performance orchestrator requires offline validation beyond the current
in-process check. Check the content of every resolved plugin module, including
native bindings. Check every reported dependency and directory dependency
with Mokly's own digests and listings. Include scanner control files such as
`.gitignore`, the configuration and its imports, the effective environment
hash, the cache format, and the Mokly version.
List remaining unobserved input classes for each evidence option. State
whether in-process reuse already trusts each class. Cover any new restart
trust exactly, or propose a bounded refresh rule with its risk stated.
No bounded rule is approved yet. The orchestrator chooses the evidence option.

Use the isolated `mokly-cloud` fixture at
`194fdb789b243ca649a592c6488e8d56b0a32be5` for cloud measurements.
Leave the other checkout unchanged. The current monorepo configuration has
161 stylesheet roots. Do not substitute the earlier estimate of 60 roots.

### Protocol details within the approved contract

Design calls, 2026-11-21:

- Admit each record on its evidence. A configured PostCSS module alone does
  not prove that a root used opaque processing. Some module roots run none.
- A pinned immutable source identity proves the stability of its Git bytes.
  Mutable dependencies, modules, and configuration inputs still need the
  full stable-capture checks. This preserves the approved base ownership.
- Never wait for stable capture on a stylesheet foreground path. Skip optional
  admission when its proof is unavailable. This preserves the no-wait rule.
- Treat an unavailable build identity as a normal miss and skipped save.
  It prevents optional reuse only and emits no cache-fault warning.
- Skip a whole snapshot above the entry ceiling. Reject an oversized stored
  file as damaged, under the bundle kind's existing fault rules.
- Report the cache directory on the first store read, including a miss.
  Keep the existing Serve output ordering and the common warning pattern.

## Decision 1: Stored record layout and limit

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `docs/protocol/mokly-base-cache.md` and the new stylesheet kind.
- **Terms:**
  - **Root:** One local stylesheet or module whose CSS Mokly bundles for delivery.
  - **Context evidence:** A growing chain of module read evidence shared by records from one PostCSS context.
- **Background:** The task chooses a second stored kind under the bundle-cache rules.
  A record must include every witness needed for validation and replay.
- **Problem:** Self-contained root records repeat context evidence on disk.
  Separate context entries reduce that repetition but add dependencies between entries.
- **Impact if no action:** The stored format and its byte limit remain unspecified.
- **Root question:** How should Serve retain reusable stylesheet work within a fixed disk budget?
- **Options:**
  - **A.** Keep one self-contained entry per existing root key, with its latest
    storable compilation. Give the stylesheet namespace a separate 256 MiB bound.
    Use format 1, the Mokly version, and the payload digest in its first line.
    Keep the existing 64 MiB entry-size ceiling. Stream the codec and intern
    context evidence after loading. This repeats context bytes on disk but
    keeps eviction and corruption local to one root. Effort: Large.
  - **B.** Keep root entries and separately keyed context entries in the same
    256 MiB namespace. Load both on demand. Missing context entries make roots
    miss. This saves disk bytes but needs dependent-entry publication,
    eviction, validation, and fault handling. Effort: Large.
  - **C.** Keep one self-contained snapshot per settings key, with all its
    stylesheet roots and distinct context-chain entries. Keep the sides
    separate. A first lookup loads that snapshot within the existing memory
    bound. Use the same format 1 header, 64 MiB entry ceiling, and separate
    256 MiB namespace bound. This avoids repeated context bytes and per-root
    scans and flushes. It rewrites a side's snapshot after edits. Effort: Large.
  - **D.** Hash roots into a fixed number of buckets per side. Each entry
    keeps its roots and distinct context-chain entries. A save rebuilds one
    bucket. This reduces entry overhead but repeats shared context between
    buckets and adds bucket selection. Effort: Large.
  - **E.** Append records in render-store-style segments and build a bounded
    index. This supports smaller updates but adds index ownership, stale
    entries, and segment eviction to this change. Effort: Large.
- **Left out:**
  - No storage fails the chosen restart goal.
  - A separate database or cache directory breaks the chosen shared-cache approach.
  - Source-content-only keys cannot replace evidence about resolution, plugins,
    assets, directory membership, and physical paths.
  - **F.** The check proposed storing PostCSS roots only. This leaves plain
    roots compiling after restart and does not meet the requested root reuse.
- **Wider fix:** C. A side uses its roots together. One snapshot removes the
  namespace and publication work that would grow with each stored root.
- **Previous examples:** The bundle kind keeps self-contained entries.
  The render store shares documents through segments under different indexing rules.
- **Assumptions:** The task requires one separate stored kind, existing
  complete and stable evidence, and nonblocking cache rules. Every option
  needs the approved environment identity. Incomplete coverage cannot enter
  the stored kind. The performance orchestrator set the provisional limit
  to 256 MiB. Measure encoded sizes before finalizing it. Do not exceed the
  approved limit without a new decision.
- **Recommendation:** C, replacing the initial A after the options check.
  It removes per-root storage overhead and preserves context sharing.
  Stream decoding and optional writes to protect the memory limit.
- **Outcome:** C approved on 2026-11-21. Use 256 MiB for the kind and 64 MiB
  for an entry. Send encoded sizes on basic, cloud, and large React with
  the implementation SHA. The performance orchestrator sets final numbers.
- **Action:** fix now, apply C under the approved complete-and-stable rule.

## Decision 2: Tailwind evidence cannot enter the store

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/postcss-evidence.ts` and
  `crates/mokly-source-interface/src/read_evidence.rs`.
- **Terms:**
  - **Coverage:** Whether the capture proves that it observed every input.
  - **Stable capture:** Proof that captured input identities and change stamps
    stayed valid through compilation.
  - **Bounded admission:** Reuse that trusts unobserved inputs only under an
    explicit age or refresh rule. It is not complete evidence.
- **Background:** The orchestrator requires complete and stable disk evidence.
  Current stylesheet records have consistency checks but no durable certificate.
  Known plugin modules and reported source files already have late content
  digests, including the native Tailwind and Lightning CSS bindings.
- **Problem:** Those digests cannot prove the full input boundary.
  Scanner controls, native resolution probes, external inputs, and context
  state can escape the existing record. A strict store cannot admit those
  results. A separate main red test also confirmed a dropped observed
  Browserslist configuration read. Workspace 223 owns that correctness fix.
- **Impact if no action:** The approved strict store cannot provide the
  required Basic gain with the current evidence producer.
- **Root question:** Which restart improvement should this task pursue while
  preserving correctness or explicitly bounding any new trust?
- **Options:**
  - **A.** First establish a complete input boundary and deterministic replay
    for the PostCSS process. A feasibility study must name the mechanism,
    supported platforms, native-plugin behavior, and fallback. No complete
    implementation or startup cost is known. Effort: Large. The study alone
    is Medium.
  - **B.** Add positive complete-and-stable certificates for core-only records.
    Keep opaque PostCSS results memory-only. Classification is per record,
    including roots that run no PostCSS under a configured module. This helps
    cloud but requires a smaller Basic goal. Effort: Large.
  - **C.** Park the store work. Keep the protocol and test design as a handoff.
    This preserves current restart refresh behavior and provides no gain.
    Effort: Small.
  - **D.** Amend strict admission to allow a checked PostCSS snapshot under an
    explicit age bound. First cover every mandatory file, directory, control,
    configuration, native module, environment, and version input. Stamp a
    conservative directory superset without changing plugin selection or
    public membership. Capture a full startup and reuse a side's PostCSS
    records together or compile them again. Unknown native inputs and ambient
    state remain trusted. The parent must choose the bound and its risk.
    Effort: Large.
  - **E.** Load checked stored results for readiness, then compile PostCSS again
    before first Changes. This refreshes unknown inputs each session but can
    serve stale output until the fresh generation publishes. It changes the
    zero-compile acceptance rule and can delay first Changes. Effort: Large.
  - **F.** Extend merged PostCSS preparation to startup so that context setup
    overlaps JavaScript bundling. Store no PostCSS results. This keeps the
    restart freshness rule but changes this task's approach and Basic goal.
    CPU and memory overlap still need measurement. Effort: Medium.
- **Left out:**
  - Unlimited opaque persistence remains rejected.
  - Dependency paths, late hashes, or equal glob lists do not prove complete
    capture. Stable capture can close provenance gaps only for known inputs.
  - Tailwind-only exclusion is insufficient. Other processed roots use the
    same consumer configuration and module context.
  - A scanner-only adapter closes neither other native reads nor plugin state.
    It can also change the consumer plugin's discovery behavior.
  - Two concurrent head PostCSS contexts break the merged context contract
    and add another process against the memory acceptance limit.
- **Wider fix:** B. A positive admission certificate prevents unsupported
  records from entering the strict store. It does not make Tailwind complete.
- **Previous examples:** The bundle cache has a separate durable recipe type.
  `plans/follow-ups/confined-postcss-inputs.md` already records the broader
  input-domain design. The observed configuration bug is a separate
  correctness record in `plans/follow-ups/stylesheet-observed-plugin-config-reads.md`.
- **Assumptions:** The original Basic goal is at least 0.5 seconds.
  Strict complete-and-stable admission remains approved. A late digest is
  not a consumed-read witness. The store remains Serve-only. In-process reuse
  already trusts deterministic plugin behavior. B and F need a changed Basic
  goal. D and E need an explicit exception to strict restart admission.
- **Recommendation:** F, replacing A after the options check. It offers a
  smaller measurable Basic improvement without extending opaque reuse across
  restarts. It needs approval for the changed goal and approach. If those
  must stay, choose C rather than claim a complete boundary that does not exist.
- **Action:** ask the user, because no current Tailwind record qualifies and
  the requested stop condition applies. Product code and cache red tests wait.

The read-only options check and its correction are
`.context/persistent-stylesheet-records/eligibility-options-check-after-main.md`.
The orchestrator's checked disposition, input-class matrix, estimated gains,
and validation-cost limits are
`.context/persistent-stylesheet-records/eligibility-options-disposition.md`.
No measured candidate speed gain or complete validator exists yet.

For D, the age bound controls admission at restart only. Unless a forced
refresh is added, an admitted record can remain in memory throughout that
Serve session. A hit or snapshot save must never renew its original compile
age. Unknown inputs can therefore affect stale styles and Changes for the
admission window plus the session lifetime. A wall-clock rollback can extend
that window unless it is detected. No age or refresh rule is approved.

The census and direct diagnostic live under `.context/` as evidence only.
The diagnostic is not a full core-record capture or a complete inventory.

## Test plan

This section plans cache tests only. Write no cache red tests before the evidence
decision. Amend the admission cases to the chosen rule before implementation.
Keep the existing PostCSS preparation and in-process evidence tests.

### Stored record behavior

- Extend the lowest public render/store test boundary for record replay.
  Load a saved record through the real codec and lookup path.
  Assert exact CSS, class maps, dependencies, assets, watches, and read evidence.
  This catches incomplete replay even when the CSS text remains equal.
- Change a source after saving, then load its old snapshot.
  Assert a miss and the newly compiled bytes. Include an asset projection
  and a directory membership change in the existing stamp cases.
  This catches constructors that replace saved stamps with current stamps.
- Keep observed versions, late digests, byte ranges, identities, and context
  entries distinct through a round trip. Reject inconsistent context chains.
  Use a long shared chain to check iterative decode and shared charging.
- Populate a memory candidate, change its stamp, and offer the old disk entry.
  Assert one compile and no second disk lookup. Check the resulting CSS.
  This catches repeated stale disk reads on edits.
- Load once per side and settings. Check the shared context stamp once per
  attempt with operation counts. Check both results beside those counts.
  Extend existing borrowing tests for plain CSS and PostCSS side isolation.
- Admit only records allowed by the chosen evidence rule. Under the approved
  strict rule, incomplete or unstable records compile again after restart.
  Preserve their current in-process reuse. Never manufacture a certificate.

### Real Serve restarts and invalidation

- Add one isolated two-process harness at the existing Serve process boundary.
  Start with a private empty cache. Wait for an explicit successful snapshot
  publication after first Changes. Stop all descendants before restarting.
  Readiness and elapsed delay do not prove that publication completed.
- On the next start, fetch CSS and rendered documents through real HTTP.
  Assert expected bodies, record hits, and zero CSS compile/PostCSS calls for
  eligible unchanged roots. Compare with a forced fresh compile.
  Keep speed measurements outside the correctness test tree.
- Extend that harness with offline mutations that protect distinct evidence
  classes. Cover imported CSS, Tailwind utility add/remove, a reported file,
  a reported directory add/remove, and a scanner `.gitignore` change.
  Cover a configuration import and a plugin module or native binding change.
  Assert fresh output or the required compile, rather than only a miss counter.
- Check environment, toolchain, format, and Mokly identities at the storage
  boundary. A changed environment must miss without exposing its values in
  stored bytes or diagnostics. Use harmless fixture values.
- If the chosen option adds a refresh rule, test its exact reset boundary.
  A disk hit must not extend a compilation certificate's life.
  Test interrupted ownership without consuming or duplicating that allowance.
- Exercise real base preparation and head edits in the existing base tests.
  Assert each side's original bytes and independent snapshot ownership.
  Keep the base's captured immutable source identity while head files change.
  Check mutable installed inputs separately. Do not require disk timestamps
  for virtual Git bytes or replace the saved base identity with current HEAD.
  Preserve the merged preparation context lifetime on failure and cancellation.

### Faults, bounds, and optional writes

- Extend raw-cache integration cases for the new kind. Reuse existing receipt,
  lock, confinement, and retirement tests where their rules already apply.
  Check malformed, foreign, truncated, damaged, and oversized snapshots as
  recoverable misses. Check a valid record still compiles or loads afterward.
- Check encoded byte accounting across staged, replaced, retained, and trash
  entries. Exercise independent eviction with small injected test budgets.
  Assert retained entries and readable output. Do not test copied constants.
- Use controlled pending I/O to hold a save. Assert readiness or an edit
  completes with correct output before releasing that save.
  Assert no offer starts before first Changes or during foreground preparation.
  Check one shared optional writer, lock contention skips, and cancellation.
- Feed a snapshot larger than the memory store through the actual streaming
  reader. Assert bounded charges, eviction, useful replay, and released buffers.
  Measure the additional process memory peak separately as a one-time proof.

### Verification evidence

- Record each new test's behavioral red assertion before its implementation.
  A setup error, compile error, or zero matched tests is not a red assertion.
- Run targeted tests first. Repeat each new asynchronous test ten times.
  Record pass/fail/skip counts and per-test costs under `.context/`.
- Run the repository suite and complete gate on the combined implementation.
  Do not add sleeps, retries, elapsed-time assertions, or skipped checks.
- Run the strict four-fixture Build proof and the Basic HTTP closure proof
  as separate one-time checks. Run restart and comparison workloads too.
  Static `--no-changes` equality does not cover those workloads or Publish.
- Measure interleaved startup, first Changes, edits, encoded snapshot sizes,
  check costs, and memory on the same frozen main/candidate inputs.
  Keep official acceptance with the performance orchestrator.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Confirm the baseline split with a release native build and built packages.
- [x] Run the fresh read-only options check with the requested second-pass agent.
- [x] Record the answer to decision 1 and its evidence amendment.
- [x] Count eligible roots on basic and cloud before product code.
      Identify Tailwind's unobserved inputs. If it does not qualify, stop
      and send the performance orchestrator the evidence and safe options.
- [x] Write the detailed test plan without writing red tests.
- [x] Extend cache, PostCSS reuse, budget, and cache-output requirements.
      Add a linked stylesheet-cache companion page if needed to keep page limits.
- [x] State only the required behavior in protocol pages. Keep mechanics in
      the area READMEs and code comments. Use a status line until implemented.
- [ ] Record the resolution of the restart follow-up. Delete its file when
      this branch implements the work. Keep its other linked items in scope only
      when this change causes or fixes their problem.

Evidence lives under `.context/stylesheet-cache-across-restarts/`.
The merged census is
`.context/persistent-stylesheet-records/merged-root-eligibility-census.json`.
The checked protocol draft is
`.context/persistent-stylesheet-records/docs-report-after-main.md`.

## Milestone 2: Red tests and reusable storage

Depends on: 1 and the #459 merge signal

- [x] Merge `origin/main` after the signal. Save the preservation audit.
- [ ] Merge `origin/main` after workspace 223 fixes observed configuration reuse.
      Keep that product fix and its regression test in the correctness branch.
- [ ] Record the orchestrator's evidence option before any store implementation.
- [ ] Write the real two-start Serve harness. Use one private cache directory.
      Observe writes explicitly. Compare second-start output with a fresh compile.
- [ ] See behavioral assertions fail for unchanged hits, added and removed
      Tailwind utilities, imported CSS, PostCSS and Tailwind configuration,
      plugin-package changes, and a changed Mokly toolchain.
- [ ] See behavioral assertions fail for damaged, truncated, foreign, and
      oversized records, entry and directory faults, simultaneous saves,
      byte accounting, and eviction.
- [ ] Add event-order tests for readiness and edits while a save is blocked.
      Keep lock and codec boundary tests at the lowest useful level.
- [ ] Add the stylesheet kind through the existing raw cache operations.
      Preserve fixed lock stripes, receipts, staging bounds, retirement tokens,
      LRU eviction, cancellation, confinement, and recoverable faults.
- [ ] Add the bounded typed snapshot codec. Reject incompatible headers before
      payload decoding. Verify payload and side settings before constructing
      reusable records. Preserve original stamps and chain evidence.
- [ ] Measure encoded snapshot sizes on basic, cloud, and large React.
      Measure the extra memory peak of streaming a snapshot into the store.
      Send sizes and peak with the SHA before the final bounds are set.

## Milestone 3: Serve integration

Depends on: 2

- [ ] Inject the optional store into Serve and its base runtimes.
      Keep build and publish on their existing compile paths.
- [ ] Load each side once when no memory candidate exists. Use the same stamp and context checks.
      Replay the original evidence, dependency usage, class maps, assets, and watches.
- [ ] Keep plain-CSS class-map batching from bypassing disk lookup.
      Preserve serial delivery and failure order for cold misses.
- [ ] Preserve #459 preparation and context lifetime rules on edits.
      An unchanged warm root starts no PostCSS work.
- [ ] Integrate the bounded optional writer with the document writer's gate.
      Save one side snapshot. A held lock skips a save. A hit does not
      re-encode an unchanged snapshot. Prove base offers stay live until saved.
- [ ] Confirm head/base behavior with real base preparation. Keep PostCSS roots
      separate and prove that compatible plain CSS can share unchanged records.
- [ ] Add timing spans and counters for record bytes, read, decode, evidence
      validation, hits, misses, saves, faults, and dropped offers.

## Milestone 4: Verification and performance

Depends on: 3

- [ ] Run targeted tests. Run each new asynchronous test ten times.
      Save red assertions, pass counts, and per-test costs.
- [ ] Run the repository suite and the complete gate from `AGENTS.md`.
      Run the strict example build and Serve smoke test.
- [ ] Measure interleaved main/branch rounds on basic and the cloud catalogue:
      warm restarts, first Changes, and edits. Use release native and dist.
- [ ] Record encoded sizes and read, decode, validation, and replay costs.
      Check that every unchanged root runs no PostCSS and no CSS bundle.
- [ ] Prove every published byte equal on basic, large HTML, large React,
      and the cloud catalogue. Adapt the verified WS206 helper transport to
      this branch's own commits and scopes. Generate both large fixtures with
      30 areas, 40 screens per area, 12 rows, 4 shared stylesheets, and share 0.5.
      Keep all input and output manifests and raw-body comparisons in `.context/`.
- [ ] Run the Basic HTTP label/add/remove/restore proof with the fresh static
      CSS inventory, including unlinked roots. Preserve exact indexes and
      live dist. Keep the static `--strict --no-changes --sidecars 2` proof
      separate from restart and comparison evidence. Make no Publish claim
      from the Build proof.
- [ ] Measure local whole-tree memory for warm restart and cold ten-edit
      basic sessions. Confirm the 2% limit before official measurement.
- [ ] Commit with Conventional Commits and push. Send the SHA to the performance
      orchestrator for official interleaved startup and memory pairs.
- [ ] Receive the official result. Resolve any failed acceptance criterion.

Before each large Cargo build, check disk and memory. Require at least 15 GB
free disk. Use `CARGO_INCREMENTAL=0` and `CARGO_PROFILE_DEV_DEBUG=0`.
Run one heavy job at a time. Add no timeout, retry, sleep, skip, or weaker assertion.

## Milestone 5: Review and pull request

Depends on: 4

- [ ] Review the complete local diff against `origin/main` after the push,
      with the `implementation-review` skill. Run finding checks and its fix
      rounds. Record follow-up items for each permitted deferred finding.
- [ ] Check protocol alignment and remove implemented status lines.
      Commit and push the reviewed result.
- [ ] Watch final CI with `scripts/ci-wait.sh`. Fix branch-caused failures.
      Record Site Lighthouse as unrelated. Do not rerun it.
- [ ] Delete this plan under the `plans` skill when every earlier TODO is done.
- [ ] Open the pull request into `main`. Preserve this plan's dated decisions,
      its permalink, and follow-up changes in the description. Watch the CI
      started by opening the pull request. Send the PR link and final SHA.
      Do not merge.
