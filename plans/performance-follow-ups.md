# Performance Follow-Ups

Status: Active. Milestone groups ship as separate pull requests from stacked
branches. The first is `conductor/rust-rebuild-59-performance-follow-ups`.
No pull request exists yet. The plan closes when the last of its pull
requests merges.

The [Rust rebuild plan](./rust-rebuild.md) left performance items open in its
post-merge section: user items 59, 61, 64, 97, 99, 134, and 162, the
measurement TODO under item 64, and the checks of items 57, 133, and 165.
The perf wave of 2026-10-28 (#222, #225 to #229, #235, and #236) changed the
code and the numbers, so this plan measured every item again on
`origin/main` at `02eec937`. The measurements, probes, and logs are in
`.context/performance-follow-ups/`, with a summary in `measurements.md`
there. It does not cover item 182, which #240 ticked, the bookfolio run, or
the perf 6 item, the retained base generation.

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
  `mokly-compare`, `mokly-css`, `mokly-watch`, and `mokly-render`.

## Decisions

The coordinator answered on 2026-10-28 for Cal, after an independent review
of each item at `c9d402cd`. Each answer keeps the options of the report of
2026-10-28.

- Item 57 (2026-10-28): A. Tick 57 and remove the status line of
  `mokly-on-demand.md`. Keep Cal's React `usableMs` budget of 15,000 ms.
  Rejected: B, a 5,000 ms budget, because the worst cold run had 181 ms of
  margin. Rejected: C, no tick, because all six runs met the target.
- Item 64 (2026-10-28): A, refined. Batch the digests and lookups of base
  opaque assets, and stream a base asset from Git into the private copy that
  Serve already makes, so item 64 does not wait for item 61. Rejected: B,
  keep the adapter, and C, batching only, because the full blob buffer
  costs about three copies of a large asset.
- Item 97 (2026-10-28): B, with the counted test of C as its regression
  test. Rejected: A, keep the by-value state, and C alone, because neither
  removes the regression.
- Item 99 (2026-10-28): A. Record the applied rule and keep the probe as a
  test. Rejected: B, strict route order, and C, rerendering dropped views,
  because no current workload reaches the capture bound.
- Item 133 (2026-10-28): B, refined. Write every absolute path in the render
  environment digest relative to the working repository root, or by its base
  cache identity: the repository and dependency roots, the resolved runtime
  package paths in `peers`, and a tier-two base's install root in
  `moduleResolution.dependencyRoot`. The root `package.json` half of the
  record stays, because #227 decision 3 B accepts it. Rejected: A, C, and D.
- Item 134 (2026-10-28): C, with conditions. Pin `notify` to
  `=9.0.0-rc.7`, and name 9.0.0 as the exit in the `mokly-watch` README.
  Port the batched path update with a retry over the operations that rc.7
  did not apply. The native suite stays green on macOS and Windows.
  Rejected: A, B, D, and E.
- Item 162 (2026-10-28): C. Reset the build deadline on each output line,
  keep the 300-second value, and measure the release binary. Rejected: A, a
  larger deadline, and B without the release binary.
- Item 61 (2026-10-28): option D, added by the review: concurrent requests
  for one generation and asset route share one verified copy, which closes
  after the last response. It never uses more disk than today, so it sets no
  budget. The retention cap of option A waits for Cal, below.
- Item 59: waits for Cal, below. Do not start the store of unused recipes.

### 59. Byte budget for unused compiled recipes

- **Severity:** Low (estimate). **Effort:** Medium.
- **Terms:**
  - **Compiled recipe:** the sidecar's compiled program for one bundle, with
    its module graph and input digests.
- **Background:** Option C of F8 decision 59 is decided: keep unused
  recipes, and check every input again before reuse. Recipes measure 2.2 to
  3.3 MiB on the wire.
- **Problem:** No byte budget is agreed. In a watched session, 7 of 10
  bundles repeated an earlier compile, and each took 2.2 to 5.5 s.
- **Impact if no action:** Milestone 8 cannot start.
- **Options:**
  - **A.** 32 MiB per process, about ten recipes. Effort: Medium.
  - **B.** 64 MiB per process, the sidecar frame limit, so any recipe that
    the sidecar accepts fits. Effort: Medium.
  - **C.** 16 MiB per process, about five recipes. Effort: Medium.
- **Conditions that every option keeps:** the store holds only released
  recipes, and the sidecar's input check stays the only reuse gate, from F8
  decision 59 C.
- **Recommendation:** B. It matches the existing frame limit, so no valid
  recipe is too large for the store. The report of 2026-10-28 recommended
  A, and the coordinator's review changed it to B.
- **Auto-fix:** no, because condition 5 holds: the record says Cal agrees
  the budget.

### 61. Retention cap for verified asset copies

- **Severity:** Low (estimate). **Effort:** Medium.
- **Terms:**
  - **Verified copy:** the temporary file in which Serve copies an opaque
    asset and checks its SHA-256 digest before it sends the response.
- **Background:** Option D shares one verified copy among concurrent
  requests for one generation and route. The copy closes after the last
  response, so a later request copies the asset again.
- **Problem:** Option A would keep each copy until its generation ends, up
  to a cap. That keeps disk in use, so it needs a cap.
- **Impact if no action:** A repeated request copies and checks the asset
  again, as today.
- **Options:**
  - **A.** Keep copies until their generation ends, up to 256 MiB per Serve
    process. Effort: Medium.
  - **B.** As A, with 1 GiB per Serve process. Effort: Medium.
  - **C.** Keep option D only. Effort: Small.
- **Conditions that every option keeps:** the copy is checked before the
  first response, from `mokly-imported-styles-assets.md`.
- **Recommendation:** A, from the report of 2026-10-28.
- **Auto-fix:** no, because condition 5 holds: the coordinator asked that
  each disk budget goes to Cal.

## The item records and the code

Release binary and eight CPUs, 2026-10-28, unless a line says otherwise.

- Item 57 holds. The default React fixture (1,620 routes, 5,850 documents,
  two sidecars) reached usable startup in 4,311 to 4,819 ms cold and 3,863 to
  4,061 ms warm in three runs. The record said 10.5 s. The perf wave, mainly
  #226, made the change.
- Item 165 holds. A base build of a 49-file HTML fixture starts 67 Git
  processes with `core.autocrlf` unset and 67 with it set to true. One
  `cat-file --batch --filters` process converts each batch (#229).
- Item 133 does not hold. Builds of `examples/basic` from two folders of
  `02eec937` differ in 549 of 594 document keys and in `deploymentId`. Only
  entries that render without JavaScript keep equal keys. A one-line
  devDependency edit in the root `package.json` moves the same 549 keys.
  Cause: `crates/mokly-render/src/render_environment.rs` hashes physical
  paths into every key of a side.
- Item 59. The pool drops a compiled recipe when the last lease of its
  generation releases. A live generation with equal settings already seeds a
  new bundle, and the sidecar's `reuse` check revalidates every input. In a
  five-minute watched session of `examples/basic`, 7 of 10 bundles had
  inputs equal to an earlier compile: 3 head bundles and 4 bundles of the
  unchanged base.
- Item 61. Each request copies and verifies the whole asset into its own
  unnamed temporary file. Eight concurrent requests for one 60 MiB asset
  made eight files, 480 MiB in total, with eight SHA-256 checks.
- Item 64. A base opaque asset of an HTML catalogue costs about ten Git
  processes: about four `ls-tree` and three `rev-list` lookups, one
  `config`, one `check-attr`, one digest `cat-file`, and one full read. 64
  small assets add 4.5 s to a 0.3 s build. A base asset read holds the whole
  blob in memory, so a 60 MiB asset adds about 180 MB of peak RSS. The
  large fixtures hold one opaque asset each.
- Item 97. `crates/mokly-compare/src/comparison.rs` keeps every view's owned
  proof state until `attribution::attribute` has read the whole catalogue.
  A view builds its two instance indexes only when an owner's rules changed
  in that view (`owned_styles.rs`). Only the styled-components and Emotion
  adapters give style records an owner. With a dark text token change, 1,350
  large-fixture entries changed and 0 of 5,850 views held owned state. Each
  element costs 32 bytes per side in an index. So 1,000 elements per side
  give about 375 MB over 5,850 views, but only when every view has a changed
  owned rule (estimate).
- Item 99. A probe test confirmed the rule of the record: route `b` is
  skipped and the later route `c` stays. Both sides of the default fixtures
  keep all 5,850 views with 67 MB (HTML) and 86 MB (React) of the 256 MiB
  bound. Since #220 the same collector also captures the build head.
- Item 134. In `notify` 8.2.0 and 8.2.1, the macOS backend drops a "must
  scan subdirectories" event whose path is not a watched directory or its
  child. The Windows backend ignores an overflowed read and unwatches the
  directory on `ERROR_NOTIFY_ENUM_DIR`. `notify` 9.0.0-rc.7 reports both as
  rescans. Mokly turns a rescan into a repository-root `config` action.
- Item 162. With the release binary, the default builds take 39 s (HTML) and
  126 s (React). With the debug binary that `npm run build` installs, they
  take 284 s, and the React build is killed at 300 s while it still writes
  progress lines. The harness then reports "exited with SIGKILL", and the
  kill leaves an output reservation that fails every later build.

## Overlaps and shared files

- Perf 6, the retained base generation, has no branch yet. It would remove
  the base recompiles of item 59 at their source.
- [PR #224](https://github.com/mokly-ai/mokly/pull/224) (dedup 1) changes
  `crates/mokly-server/README.md` and how `deploymentId` enters the entry
  details. Milestone 4 edits that README.
- The dedup 4 branch writes a before snapshot only when it differs.
  Milestone 3 streams the base asset reads that feed those snapshots.
- [PR #237](https://github.com/mokly-ai/mokly/pull/237) changes
  `crates/mokly-git/src/extracted.rs` and `crates/mokly-git/README.md`.
- The perf 5 step B branch changes `docs/protocol/mokly-timings.md` and
  `crates/mokly-render/README.md`.
- Workspace 353 changes `Cargo.toml` and `Cargo.lock`, and ports and deletes
  `tests/serve_generation_release.test.ts`,
  `tests/static_changes_capture.test.ts`, and
  `tests/static_publication_assets.test.ts`. New tests go into Rust.
- Workspace 406 changes `docs/protocol/mokly-git.md` and
  `docs/protocol/mokly-base-preparation.md`.
- Workspace 407 changes `docs/protocol/mokly-sidecar-modules.md` and
  `crates/mokly-sidecar/src/methods.rs`.
- Workspace 408 changes `crates/mokly-git/README.md` and `disk.rs`.
- Every branch edits `plans/rust-rebuild.md`. Each milestone group ticks only
  its own items there.

Outside the scope: on the large React fixture, `mokly build` with the debug
binary did not exit within 10 s of SIGTERM while it read its output inputs.
Not checked with the release binary. Separate branch.

## Design

Each line is the coordinator's answer of 2026-10-28 or, where marked, my
design call of 2026-10-28.

- Item 162: each complete line on standard output or standard error resets
  the 300-second window of the build scenario. My call: the failure names
  the liveness limit also after the kill escalates, and it names the output
  reservation that a killed build leaves. The build scenario builds and
  installs the release binary as the Serve scenarios do, and records its
  profile and digest.
- Item 99: the capture keeps views in arrival order while they fit, and a
  skipped view is not reconsidered. My call: the protocol text says "views
  that a capture keeps", because "partial capture" already names a failed
  validation in `mokly-comparison-serving.md`.
- Item 64: lookups, attribute checks, and digests of the opaque assets of
  one stylesheet run as one batch, with one Git process for each kind. My
  call: a digest pass also counts the converted bytes, so delivery knows the
  length before it copies, as `resource_bytes.rs` and `backend_preview.rs`
  need. Delivery streams one Git process into the private copy through the
  SHA-256 check, with the 64 MiB blob bound.
- Item 61 D: my call: the generation's backend keeps a weak entry for each
  asset route in progress or in use. Each response reads the shared copy at
  its own position. A failed copy fails every waiting request, as today.
- Item 97: at view time, keep for each owner with changed rules the
  deduplicated instance chains for each rule identity, candidates only for
  instances of those owners, and one address pair for each view. Drop the
  instance indexes and the document matching after that step.
- Item 133: a path under the working repository root becomes relative to it.
  My call: a path under the comparison cache becomes its path below the
  cache namespace, such as `dependencies/entries/{key}/data/...`, because
  the namespace folder is a hash of the repository path.
- Item 134: replace `paths_mut()` with `update_paths`. After a failed
  operation, record its error, skip it, and apply the rest again. Keep the
  rescan mapping.
- My call: each milestone group from Milestone 2 to Milestone 7 is its own
  pull request, so the coordinator can merge it alone.

## Milestone 1: Decision record

- [x] Record each answer, its date, and the rejected options in this plan.

## Milestone 2: Harness liveness, capture rule, and checks

Items 162, 99, 57, and 165. Pull request 1, on
`conductor/rust-rebuild-59-performance-follow-ups`.

- [ ] Item 162: add failing tests to the large harness tests: a run that
      keeps printing past the window passes, a silent run fails with the
      liveness message, and an escalated kill keeps that message and names
      the reservation.
- [ ] Item 162: reset the window on each output line in
      `scripts/large/benchmark.ts`. Build and install the release binary
      before the build scenario, and record it in the result.
- [ ] Item 162: update the deadline text of the large fixture README.
- [ ] Item 162: run both default build scenarios with the release binary.
- [ ] Item 99: keep the probe as a regression test in
      `crates/mokly-compare/src/_tests_/capture_collection_tests.rs`.
- [ ] Item 99: state the rule in `mokly-comparison-serving.md`.
- [ ] Item 57: remove the status line of `mokly-on-demand.md`.
- [ ] Tick items 57, 99, 162, and 165 in `plans/rust-rebuild.md`.
- [ ] Run the targeted tests and the complete gate. Commit and push.
- [ ] Review the diff with the `implementation-review` skill, apply the
      review-fix rule, and report the pull request text.

## Milestone 3: Batched opaque digests and streamed base assets

Item 64. Pull request 2.

- [ ] Add a counted test at two asset counts in a 1:4 ratio: the Git
      processes for lookups and digests stay the same, and delivery of a
      large base asset never buffers the whole blob.
- [ ] Batch the lookups and digests in `mokly-git`, `mokly-compare`,
      `mokly-css`, and `mokly-source-interface`. Stream base delivery.
- [ ] Update `mokly-git.md`, `mokly-imported-styles-assets.md`, and the
      crate READMEs.
- [ ] Repeat the asset probes. Tick item 64 and its measurement TODO.
- [ ] Run the targeted tests and the complete gate. Commit and push.
- [ ] Review the diff, apply the review-fix rule, and report the pull
      request text.

## Milestone 4: Shared verified copy for concurrent asset requests

Item 61, option D. Pull request 3.

- [ ] Add a failing test: concurrent requests for one asset route make one
      copy and one check, and a request after the last response copies
      again.
- [ ] Share the copy in `mokly-server`. Update
      `mokly-imported-styles-assets.md` and the `mokly-server` README.
- [ ] Repeat the eight-request probe.
- [ ] Run the targeted tests and the complete gate. Commit and push.
- [ ] Review the diff, apply the review-fix rule, and report the pull
      request text. Item 61 stays open for the cap decision.

## Milestone 5: Compact owned proof state

Item 97. Pull request 4.

- [ ] Add a counted test at two catalogue sizes for the retained candidate
      state of owned styles.
- [ ] Keep the compact chains and drop the indexes in `owned_styles.rs`,
      `owned_style_instances.rs`, and `comparison_attribution.rs`.
- [ ] Tick item 97. Run the targeted tests and the complete gate. Commit
      and push.
- [ ] Review the diff, apply the review-fix rule, and report the pull
      request text.

## Milestone 6: Watch event loss on macOS and Windows

Item 134. Pull request 5.

- [ ] Add a Windows test that blocks the event handler until the read
      overflows and asserts a rescan, and a test that the path update skips
      a vanished directory and applies the rest.
- [ ] Pin `notify` to `=9.0.0-rc.7` in `crates/mokly-watch`, port
      `backend.rs`, and name 9.0.0 as the exit in the README.
- [ ] Tick item 134. Run the targeted tests and the complete gate. Commit
      and push. The native suite runs on macOS and Windows in the pull
      request's CI.
- [ ] Review the diff, apply the review-fix rule, and report the pull
      request text.

## Milestone 7: Folder-independent document keys

Item 133. Pull request 6.

- [ ] Add a failing test: two folders of one commit give equal render input
      keys, and the head and a tier-two base still give different keys.
- [ ] Map the paths of the render environment in `render_environment.rs`.
      State the folder rule of `documentKey` in `mokly-shell-delivery.md`.
- [ ] Repeat the two-folder probe. Tick item 133 and say that the root
      `package.json` half stays under #227 decision 3 B.
- [ ] Run the targeted tests and the complete gate. Commit and push.
- [ ] Review the diff, apply the review-fix rule, and report the pull
      request text.

## Milestone 8: Store of unused compiled recipes

Item 59. Waits for Cal's budget.

- [ ] Add failing pool tests: a released recipe restores without esbuild
      after an edit and a revert, a changed input compiles, and the budget
      evicts the least recently used recipe.
- [ ] Add the store to the pool and `seed_compilation`, and state it in
      `mokly-sidecar-modules.md`.

## Milestone 9: Retention cap for verified copies

Item 61, option A. Waits for Cal.

- [ ] Keep each verified copy until its generation ends, up to the cap.
