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

No product code starts before the orchestrator signals that PR #459 merged.
After that signal, merge `origin/main` once before implementation starts.
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
- Save only a successful compilation with consistent evidence. Saves add no
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

### Proposed PostCSS restart rules

Bind PostCSS snapshots to a digest of the effective child environment under
the existing inheritance rules. Do not guess a variable allow list.
Store and log no environment values. A changed digest is a normal miss.
Plain CSS needs no environment identity.

Keep the task's existing evidence rule after restart. PostCSS coverage stays
incomplete. A read that escapes observation gains no invented witness.
A record remains eligible until an evidenced input changes or the user
deletes the cache. A restart no longer refreshes unobserved plugin inputs.
This is the same restart limit that the render store documents.
The proposed common contract includes these rules, the writer gate, and the
existing entry-fault warnings. Decision 1 requests approval of that contract.

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
    storable compilation. Give the stylesheet namespace a separate 512 MiB bound.
    Use format 1, the Mokly version, and the payload digest in its first line.
    Keep the existing 64 MiB entry-size ceiling. Stream the codec and intern
    context evidence after loading. This repeats context bytes on disk but
    keeps eviction and corruption local to one root. Effort: Large.
  - **B.** Keep root entries and separately keyed context entries in the same
    512 MiB namespace. Load both on demand. Missing context entries make roots
    miss. This saves disk bytes but needs dependent-entry publication,
    eviction, validation, and fault handling. Effort: Large.
  - **C.** Keep one self-contained snapshot per settings key, with all its
    stylesheet roots and distinct context-chain entries. Keep the sides
    separate. A first lookup loads that snapshot within the existing memory
    bound. Use the same format 1 header, 64 MiB entry ceiling, and separate
    512 MiB namespace bound. This avoids repeated context bytes and per-root
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
  evidence checks, and nonblocking cache rules. Every option needs the
  proposed environment identity and preserves incomplete PostCSS coverage.
  The provisional 512 MiB limit matches the bundle kind. Measure encoded
  sizes in Milestone 2 before finalizing that limit. Do not exceed the
  approved limit without a new decision.
- **Recommendation:** C, replacing the initial A after the options check.
  It removes per-root storage overhead and preserves context sharing.
  Stream decoding and optional writes to protect the memory limit.
- **Action:** ask the user, because the task requests review of each protocol
  change, and the stored layout and numeric bound extend the cache contract.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Confirm the baseline split with a release native build and built packages.
- [x] Run the fresh read-only options check with the requested second-pass agent.
- [ ] Record the answer to decision 1 and approval of this plan.
- [ ] Extend cache, PostCSS reuse, budget, and cache-output requirements.
      Add a linked stylesheet-cache companion page if needed to keep page limits.
- [ ] State only the required behavior in protocol pages. Keep mechanics in
      the area READMEs and code comments. Use a status line until implemented.
- [ ] Record the resolution of the restart follow-up. Delete its file when
      this branch implements the work. Keep its other linked items in scope only
      when this change causes or fixes their problem.

Evidence lives under `.context/stylesheet-cache-across-restarts/`.

## Milestone 2: Red tests and reusable storage

Depends on: 1 and the #459 merge signal

- [ ] Merge `origin/main` after the signal. Save the preservation audit.
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
- [ ] Measure encoded snapshot sizes on the four fixtures. Confirm the
      namespace and entry bounds before finalizing the protocol numbers.

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
