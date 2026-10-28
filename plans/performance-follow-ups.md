# Performance Follow-Ups

Status: Active. On branch `conductor/rust-rebuild-59-performance-follow-ups`,
no pull request yet. The plan closes when its PR merges.

The [Rust rebuild plan](./rust-rebuild.md) left performance items open in its
post-merge section: user items 59, 61, 64, 97, 99, 134, and 162, the
measurement TODO under item 64, and the checks of items 57, 133, and 165.
The perf wave of 2026-10-28 (#222, #225 to #229, #235, and #236) changed the
code and the numbers, so this plan measured every item again on
`origin/main` at `02eec937`. The measurements, probes, and logs are in
`.context/performance-follow-ups/`, with a summary in `measurements.md`
there. This plan covers the work for those items. It does not cover item 182,
which the normalized config-relative paths workspace ticks, the bookfolio
run, or the perf 6 item, the retained base generation.

No user decision is recorded yet. Every item below waits for the answers
under "Open decisions". No default is applied.

Contract owners:

- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md):
  compiled recipes and release.
- [Imported style assets](../docs/protocol/mokly-imported-styles-assets.md):
  opaque asset delivery and its bounds.
- [Git command runtime](../docs/protocol/mokly-git.md): batched base reads.
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md): base
  and head capture.
- [Watch contract](../docs/protocol/mokly-watch.md): event loss.
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md) and
  [rendering](../docs/protocol/mokly-rendering.md): `documentKey`.
- [On-demand Serve](../docs/protocol/mokly-on-demand.md) and
  [timings](../docs/protocol/mokly-timings.md): startup target and budgets.
- The [large fixture README](../tests/fixtures/large/README.md) and the
  READMEs of `mokly-sidecar`, `mokly-server`, `mokly-graph`, `mokly-git`,
  `mokly-compare`, `mokly-watch`, and `mokly-render`.

## The item records and the code

Release binary and eight CPUs, 2026-10-28, unless a line says otherwise.

- Item 57 holds. The default React fixture (1,620 routes, 5,850 documents,
  two sidecars) reached usable startup in 4,311 to 4,819 ms cold and 3,863 to
  4,061 ms warm in three runs. The worst margin is 181 ms. The record said
  10.5 s. The perf wave, mainly #226, made the change, not the compilation
  cache of decision 57 A.
- Item 165 holds. A base build of a 49-file HTML fixture starts 67 Git
  processes with `core.autocrlf` unset and 67 with it set to true. One
  `cat-file --batch --filters` process converts each batch (#229).
- Item 133 does not hold. Builds of `examples/basic` from two folders of
  `02eec937` differ in 549 of 594 document keys and in `deploymentId`. Only
  entries that render without JavaScript keep equal keys. A one-line
  devDependency edit in the root `package.json` moves the same 549 keys.
  Cause:
  `crates/mokly-render/src/render_environment.rs` hashes the physical
  repository and dependency roots into every key of a side, and the root
  manifest is on every module chain as whole bytes (#227 decisions 2 A and
  3 B).
- Item 59. The pool drops a compiled recipe when the last lease of its
  generation releases (`crates/mokly-sidecar/src/pool_releases.rs`). A live
  generation with equal settings already seeds a new bundle, and the
  sidecar's `reuse` check revalidates every consumed input. Recipes measure
  2.2 to 3.3 MiB on the wire. In a five-minute watched session of
  `examples/basic` with two edits and two reverts, 7 of 10 bundles had inputs
  equal to an earlier compile: 3 head bundles and 4 bundles of the unchanged
  base. Each bundle took 2.2 to 5.5 s.
- Item 61. Each request copies and verifies the whole asset into its own
  unnamed temporary file (`crates/mokly-server/src/asset_streams.rs`). Eight
  concurrent requests for one 60 MiB asset made eight files, 480 MiB in
  total, with eight SHA-256 checks.
- Item 64. A base opaque asset of an HTML catalogue costs about ten Git
  processes, not two: about four `ls-tree` and three `rev-list` lookups, one
  `config`, one `check-attr`, one digest `cat-file`, and one full read. 64
  small assets add 4.5 s to a 0.3 s build. A base asset read holds the whole
  blob in memory (`crates/mokly-compare/src/git_asset_io.rs`), so a build that
  copies a 60 MiB base asset adds about 180 MB of peak RSS. Serve delivery
  reads the same way. The default large fixtures hold one opaque asset,
  so the M14 workloads show no cost. A base with a leased extraction digests
  from its files since #236.
- Item 97. `crates/mokly-compare/src/comparison.rs` keeps every view's owned
  proof state until `attribution::attribute` has read the whole catalogue.
  No M14 workload reaches this state: with a dark text token change, 1,350
  entries changed and 0 of 5,850 views held owned state. Only the
  styled-components and Emotion adapters give style records an owner, and
  React Native Web styles have none. Each element costs 32 bytes per side
  in the instance index, so 1,000 elements per side give about 375 MB over
  5,850 views before the candidate proofs (estimate). The record said 190 MB.
- Item 99. A temporary probe test confirmed the rule of the record: route `b`
  is skipped and the later route `c` stays. Both sides of the default
  fixtures keep all 5,850 views with 67 MB (HTML) and 86 MB (React) of the
  256 MiB bound. Since #220 the same collector also captures the build head.
- Item 134. The hosted macOS and Windows native jobs pass and run
  `cargo test --workspace`. In `notify` 8.2.0 and 8.2.1, the macOS backend
  drops a "must scan subdirectories" event whose path is not a watched
  directory or its child. The Windows backend ignores an overflowed read and
  unwatches the directory on `ERROR_NOTIFY_ENUM_DIR`. `notify` 9.0.0-rc.7
  reports both as rescans. Mokly turns a rescan into a repository-root
  change, which is a `config` action.
- Item 162. With the release binary, the default builds take 39 s (HTML) and
  126 s (React). With the debug binary that `npm run build` installs, they
  take 284 s, and the React build is killed at 300 s while it still writes
  progress lines. The harness then reports "exited with SIGKILL", not its
  deadline message, and the kill leaves an output reservation that fails
  every later build of the fixture.

## Overlaps and shared files

- Perf 6, the retained base generation, has no branch yet. It would remove
  the base recompiles of item 59 at their source.
- [PR #224](https://github.com/mokly-ai/mokly/pull/224) (dedup 1) changes
  `crates/mokly-server/README.md` and how `deploymentId` enters the entry
  details. Item 61 edits that README. Item 133 changes `deploymentId`.
- The dedup 4 branch writes a before snapshot only when it differs. Item 64's
  per-asset base reads feed those snapshots.
- [PR #237](https://github.com/mokly-ai/mokly/pull/237) changes
  `crates/mokly-git/src/extracted.rs` and `crates/mokly-git/README.md`.
- The perf 5 step B branch changes `docs/protocol/mokly-timings.md` and
  `crates/mokly-render/README.md`.
- Workspace 353 changes `Cargo.toml` and `Cargo.lock`. It ports and deletes
  `tests/serve_generation_release.test.ts`,
  `tests/static_changes_capture.test.ts`, and
  `tests/static_publication_assets.test.ts`. This plan adds Rust tests in the
  owning crates instead.
- Workspace 386 changes `crates/mokly-render`, beside item 133's key code.
- Workspace 406 changes `docs/protocol/mokly-git.md` and
  `docs/protocol/mokly-base-preparation.md`.
- Workspace 407 changes `docs/protocol/mokly-sidecar-modules.md`,
  `docs/protocol/mokly-sidecar.md`, and `crates/mokly-sidecar/src/methods.rs`.
- Workspace 408 changes `crates/mokly-git/README.md`, `disk.rs`, and
  `crates/mokly-sidecar/src/memory_table.rs` and `methods.rs`.
- Every branch edits `plans/rust-rebuild.md`. This plan edits it only in the
  last milestone.
- The bookfolio run, when access exists, gives a real workload for these
  items. It shares no code with them.

Outside the scope: on the large React fixture, `mokly build` with the debug
binary did not exit within 10 s of SIGTERM while it read its output inputs.
Not checked with the release binary. Separate branch.

## Open decisions

Each entry gives the options and the recommendation of the report of
2026-10-28. Options that need Cal's approval are marked.

- Item 57, tick the check. A: tick, remove the status line of
  `mokly-on-demand.md`, and keep the React `usableMs` budget at 15,000 ms.
  B: as A, and lower the React budget to 5,000 ms, a stricter acceptance
  threshold that needs Cal's approval. C: do not tick yet. Recommended: A.
- Item 59, the byte budget of unused recipes. A: 32 MiB. B: 64 MiB, the frame
  limit. C: 16 MiB. Recommended: A.
- Item 61, the spool bound for each Serve process. A: 256 MiB. B: 1 GiB.
  C: no bound beyond one spool for each generation and route. Recommended: A.
- Item 64. A: batched digests and lookups, and streamed base delivery into the
  item 61 spool, Large. B: keep the adapter. C: batch the digests and lookups
  only, Medium. Recommended: A.
- Item 97. A: keep the by-value state. B: compact candidates. C: a counted
  test only. Recommended: B, with the counted test of C.
- Item 99. A: record the rule. B: strict route order. C: rerender dropped
  views that fit. Recommended: A.
- Item 133. A: document both inputs. B: repository-relative roots, keep the
  whole-manifest digests. C: also a folder-independent sidecar generation.
  D: B, and digest only the manifest fields that resolution reads.
  Recommended: B.
- Item 134. A: root rescans and stamp checks. B: recursive watches. C:
  `notify` 9.0.0-rc.7 now, then 9.0.0. D: a patched `notify` 8.2.1. E: wait
  for `notify` 9.0.0. Recommended: C.
- Item 162. A: a larger deadline. B: a liveness limit that each output line
  resets. C: B, and build and install the release binary before the build
  scenario. Recommended: C.

## Design

The design follows the recommended options. A different answer changes the
milestone of that item only.

- Item 59: when the last lease of a generation releases, the pool moves its
  bundle settings, modules, and compiled recipe to a least-recently-used
  store, charged by serialized size. `seed_compilation` also seeds from that
  store. The sidecar's `reuse` check stays the only reuse gate. A hit makes
  the recipe live again. Dispose and shutdown clear the store. Tests count
  the esbuild operations, so no new timing record is needed.
- Item 61: each generation keeps one spool for each asset route. The first
  request copies and verifies. Concurrent requests wait for it. Each response
  reads the spool at its own position, and HEAD uses its length. A failed
  verification fails every waiting request, as today. A request above the
  bound uses today's private copy. The spool stays in the OS temporary
  directory.
- Item 64: one `ls-tree` and one `rev-list` run cover the asset paths of a
  call. One `cat-file --batch --filters` stream hashes each blob of a bounded
  batch. Base delivery streams the converted output into the item 61 spool
  while it hashes. All Git bounds stay.
- Item 97: at view time, keep for each owner with changed rules the
  deduplicated instance chains for each rule identity. Keep one address pair
  for each view, shared by its candidates. Drop the instance indexes and the
  document matching after that step.
- Item 99: the probe becomes a regression test. The rule goes into the
  comparison serving contract.
- Item 133: the render environment hashes a folder-independent identity of
  each repository and dependency root instead of its physical path. The
  identity still differs when the two sides read different installations,
  so head and base share entries only as #227 decision 2 A requires. The
  milestone first checks how the base cache names a tier-two installation.
- Item 134: replace `paths_mut()` with `update_paths`. Keep the rescan
  mapping.
- Item 162: each line on standard output or standard error resets the
  300-second window. The failure names the liveness limit, also after a kill
  escalates, and names the reservation recovery path. The result records the
  binary profile and digest.
- Delivery: one pull request, or a stack with one pull request for each
  item. In a stack, each pull request carries the Milestone 1 doc changes of
  its item. The coordinator chooses.

## Milestone 1: Documentation and protocol

- [ ] Record each answer, its date, and the rejected options in this plan.
- [ ] Item 59: add the store of unused recipes and its budget to
      `mokly-sidecar-modules.md`, Compiled Recipes And Release.
- [ ] Items 61 and 64: add the shared spool, its bound, its release, and
      the streamed base delivery to `mokly-imported-styles-assets.md`.
- [ ] Item 64: add batched opaque digests and lookups to `mokly-git.md`.
- [ ] Item 99: add the partial capture rule to `mokly-comparison-serving.md`.
- [ ] Item 134: state in `mokly-watch.md` that lost notifications on every
      system queue a repository-root change.
- [ ] Item 133: state the folder rule of `documentKey` in
      `mokly-shell-delivery.md` and `mokly-rendering.md`.
- [ ] Item 57: remove the status line of `mokly-on-demand.md`. Change
      `mokly-timings.md` only under option B.
- [ ] Item 162: update the deadline text of the large fixture README.

## Milestone 2: Large harness build liveness (item 162)

- [ ] Add failing tests to `tests/large_benchmark.test.ts` or
      `tests/large_process.test.ts`: a run that keeps printing past the
      window passes, a silent run fails with the liveness message, and an
      escalated kill keeps that message and names the reservation path.
- [ ] Reset the window on each output line in `scripts/large/benchmark.ts`.
- [ ] Build and install the release binary before the build scenario, and
      record its profile and digest in the result.
- [ ] Run both default build scenarios with the debug and release binaries.

## Milestone 3: Partial capture rule (item 99)

- [ ] Add the probe as a regression test in
      `crates/mokly-compare/src/_tests_/capture_collection_tests.rs`.

## Milestone 4: Store of unused compiled recipes (item 59)

- [ ] Add failing pool tests: a released recipe restores without esbuild
      after an edit and a revert, a changed input compiles, and the budget
      evicts the least recently used recipe.
- [ ] Add the store to the pool state, the release path, and
      `seed_compilation`. Clear it on dispose and shutdown.
- [ ] Repeat the watched session probe and record the esbuild counts.

## Milestone 5: Shared verified asset spool (item 61)

- [ ] Add a failing test: eight concurrent requests for one asset make one
      spool and one verification, and the spool closes with its generation.
- [ ] Share the spool in `mokly-server` and `mokly-graph`. Keep the private
      copy for a request above the bound.
- [ ] Repeat the eight-request probe.

## Milestone 6: Batched opaque digests and streamed delivery (item 64)

- [ ] Add a counted test at two asset counts in a 1:4 ratio: the Git process
      count stays the same, and delivery of a large base asset never buffers
      the whole blob.
- [ ] Batch the lookups and digests in `mokly-git` and `mokly-compare`.
      Stream base delivery into the spool.
- [ ] Repeat the asset probes.

## Milestone 7: Compact owned proof state (item 97)

- [ ] Add a counted test at two catalogue sizes for the retained candidate
      state of owned styles.
- [ ] Keep the compact chains and drop the indexes in `owned_styles.rs`,
      `owned_style_instances.rs`, and `comparison_attribution.rs`.

## Milestone 8: Watch event loss on macOS and Windows (item 134)

- [ ] Add a Windows test that blocks the event handler until the read
      overflows and asserts a rescan. It fails with `notify` 8.2.0.
- [ ] Add a test that a rescan at an unwatched ancestor queues the
      repository-root change.
- [ ] Upgrade `notify` in `crates/mokly-watch` and adapt `backend.rs`.

## Milestone 9: Folder-independent document keys (item 133)

- [ ] Add a failing test: two folders of one commit give equal render input
      keys, and the head and a tier-two base still give different keys.
- [ ] Hash the folder-independent root identities in
      `render_environment.rs`.
- [ ] Repeat the two-folder probe.

## Milestone 10: Verification, commit, review, and pull request

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Repeat the React startup benchmark three times.
- [ ] Tick items 57, 59, 61, 64 and its measurement TODO, 97, 99, 133, 134,
      162, and 165 in `plans/rust-rebuild.md`, with the smallest edit.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
