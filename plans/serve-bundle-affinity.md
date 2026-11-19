# Serve bundle affinity

Status: Active. On branch `calummoore/mokly-bundle-affinity-3-5gsm`, no pull request yet. The pull request that completes the work deletes this plan.

Serve must reduce idle esbuild memory without changing output or slowing edits.
This branch starts from `origin/main` at `6ae96ed08` on 2026-11-19.
The user authorised this plan, delegated implementation, review, and an open pull request.
The user holds every merge into `main`.

Contract owners:

- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Memory admission](../docs/protocol/mokly-sidecar-memory.md).
- [Lifecycle](../docs/protocol/mokly-sidecar-lifecycle.md).
- [Compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).

## Design and dated calls

The performance orchestrator made these calls on 2026-11-19.
The user assigned design decisions to that orchestrator on 2026-11-16.
The reason was faster, reliable Changes without exhausting machine memory.

1. Prefer the process of the previous successful head bundle when it is idle, live, unretired, and in the head root.
   Otherwise use the existing selection. Never wait for the preferred process.
2. Measure affinity first. Consider stopping idle esbuild in other processes only if affinity misses the memory goal.
   Measure that separate change. Ask the performance orchestrator before retaining any edit-time cost.
3. Preserve base capacity and first Changes. Keep the return pass that replaces base processes after capture.
4. Add no setting, gate, retry, or process. Preserve every output rule and existing test.

Code inspection confirms that bundle calls have no generation.
The generation rank therefore gives every matching slot `Loaded::Missing`.
Queue order rotates bundles among the idle processes.
The existing warm-head record moves after renders, so it cannot identify the previous bundler.

The performance orchestrator replaced call 1 with option D on 2026-11-19 after the options check.
Reason: D reuses another compiler after a busy fallback, with no wait and no extra process-identity check.
Rank only idle head-root processes by their last successful compilation, newest first.
Processes without a record keep today's choice. Base bundles keep today's selection.
The record belongs to the live process and ends when that process ends.
Do not raise a process's rank when the result says that it reused a recipe without compiling.
If the result cannot distinguish that case, record successful head bundles and state the imprecision.
This replaces the original regression test for a busy fallback with a next-newest-bundler test.
No assertion is weakened.

My call on 2026-11-19 was to use a separate process-control identity for A because warm head follows renders.
The approved D supersedes that representation. Its per-process record gives the same lifetime protection by structure.

### 1. Reduce idle esbuild memory without slower edits

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs` and `pool_head.rs`.
- **Terms:**
  - **Sidecar:** A Node process that compiles and renders JavaScript for the Rust core.
  - **Head root:** The working repository whose source files Serve watches.
  - **Warm head:** The process that most recently bundled or rendered the newest head generation.
- **Background:** Serve shares a bounded sidecar pool between head and base work. Each process starts esbuild when it first needs it. That service remains until its process exits.
- **Problem:** Bundles rotate across idle sidecars. Each process can retain a large idle esbuild heap.
- **Impact if no action:** The measured large catalogue keeps about 1.24 GiB in four esbuild services.
- **Root question:** How can Serve reduce idle compiler memory while preserving output and edit speed?
- **Options:**
  - **A.** Prefer the last successful head bundler when eligible. Keep all existing fallbacks. Measure before adding service disposal. Effort: Medium.
  - **B.** Stop esbuild after every bundle. This reduces retained memory but measured edits become 2.2% slower. Effort: Medium.
  - **C.** Prefer the last bundler and stop esbuild in other processes after their calls end. This needs a request mechanism and timing evidence. PostCSS services need their own worker change. Effort: Medium.
  - **D.** Rank idle head processes by their last successful bundle, newest first. Store the record with each process. Prefer an older bundler before a process without a record after a busy fallback. This changes the authorised fallback. Effort: Medium.
  - **E.** Stop esbuild after a fixed idle time inside Node. This needs a timer and can make the first edit cold. Effort: Medium.
- **Left out:** Change nothing misses the memory goal. A smaller Go heap slowed bundles in the supplied experiment. A dedicated compiler process breaks the no-new-process constraint. Reserving a pool slot breaks the no-wait and base-capacity constraints. Reusing warm-head identity follows renders rather than bundles. A smaller pool reduces parallel capacity.
- **Wider fix:** D. A process owns its bundle record, so a replacement cannot inherit it.
- **Previous examples:** `pool_affinity.rs` already prefers loaded generations. The memory contract preserves admission and call claims from PR #330.
- **Recommendation:** D. The fresh options check recommends D instead of the original A. It preserves older compiler reuse after a busy fallback. The performance orchestrator approved D for head bundles only on 2026-11-19.
- **Action:** fix now, apply D. The performance orchestrator replaced the original fallback and its requested test on 2026-11-19.

Shared assumptions and sources:

- Equal output, unchanged tests, no retries, no settings, and no extra processes come from the task message. Keep them.
- Pool admission, claims, context affinity, and generation affinity come from the linked contracts. Keep them.
- Base capacity, warm head, return, reap-before-start, and retirement rules come from the task and scheduling contract. Keep them.
- esbuild retention comes from the task measurements and the one-shot calls in `packages/mokly/src/sidecar/session.ts`.
  Option B and option C change that retention assumption.
- Process choice is internal. The scheduling contract currently requires queue order for bundles, so update it under the recorded authorisation.
- One preferred process comes from A, not a boundary requirement. D drops that assumption. Recipe reuse can return a successful bundle without starting esbuild.

The fresh `second-pass review agent` checked the decision and all recorded calls on 2026-11-19.
Its report is `.context/serve-bundle-affinity/options-check.md`.
It confirmed the diagnosis, added D and E, and corrected the PostCSS scope of C.
The performance orchestrator approved D with the conditions recorded above. No decision waits.
The implementation uses the existing cache classification. A known rare false-negative reuse classification can still raise a process's rank.
The existing [reuse provenance follow-up](./follow-ups/worker-bundle-reuse-provenance.md) owns that defect. This change does not repair it.

Replaced ways: no API, data format, or consumer mechanism is replaced.
Bundle selection gains one preference before its existing fallback.

## Milestone 1: Scheduling contract

Depends on: none

- [x] Delegate the source-root scheduling contract update to the `docs implementor`.
- [x] State eligible head-bundler preference and unchanged fallback without code mechanics.
- [x] Align the sidecar README where needed. Preserve the existing contracts and add the temporary status line if needed.

Completed. Evidence: `.context/serve-bundle-affinity/docs-report.md`.

## Milestone 2: Pool preference

Depends on: 1

- [x] Delegate implementation and regression tests to the `non-ui implementor`.
- [x] Add deterministic tests first and observe the new preference assertions fail.
- [x] Cover newest idle preference, busy-to-next-newest fallback, no-record selection, other-root isolation, and recycled, retired, or reaped record loss.
- [x] Keep the record with each live process. Update it only after successful head compilations. Verify that recipe reuse does not raise the rank when the result identifies reuse.
- [x] Preserve context and generation affinity, admission, claims, warm head, return, and retirement.
- [x] Read PR #351's pool changes and confirm that both changes can survive either merge order. A overlaps its `Head` struct and bundle-recording arm. Preserve both behaviours.
- [x] Run the sidecar, pool, and relevant Serve tests unchanged.
- [x] Delegate removal of the protocol status line and the README's temporary queue-order wording when the implementation passes. Update its test summary and Key Code where needed.

Completed. Evidence: `.context/serve-bundle-affinity/pool-report.md` and `.context/serve-bundle-affinity/docs-cleanup-report.md`.

Evidence lives in `.context/serve-bundle-affinity/`.

Implementation call on 2026-11-19: run the recipe test fixture's `/repo` requests as base work by giving its pool a separate launch root.
Three recipe tests select a fresh worker through FIFO order. The approved head rank intentionally replaces that selection rule.
The fixture change preserves their recipe requests, test bodies, exact assertions, and expected values. New tests cover head selection.
This isolates recipe seeding from head scheduling. Evidence: `.context/serve-bundle-affinity/pool-sidecar-unit.log`.

## Milestone 3: Release measurements

Depends on: 2

Harness preparation is independent. Run measurements only after Milestone 2 passes.

- [x] Delegate fixture measurement tooling to the `non-ui implementor`. Keep one-time tooling under `.context/`.
- [x] Build current merged main and the branch in separate checkouts and Cargo target directories.
- [x] Use Git 2.45 or later, git-lfs, pinned Bun, `CARGO_INCREMENTAL=0`, and `CARGO_PROFILE_DEV_DEBUG=0`.
- [x] Check disk and memory before each large Cargo build. Run Cargo builds one at a time.
- [x] Run three interleaved 10-edit sessions per arm on `examples/basic` and the HTML and React large fixtures.
- [x] Use a separate cache per arm. Restore source files between sessions. Keep four sidecars.
- [x] Record cgroup anon plus swap peaks, esbuild count and RSS, bundle owners, bundle and compile times, first Changes, and edit times. Separate sidecar-owned services from PostCSS-worker services.
- [x] Compare corresponding output for equality. Keep performance measurements outside permanent tests.

Completed. Evidence: `.context/serve-bundle-affinity/measurement/measurement-report.md` and `.context/serve-bundle-affinity/root-served-body-equality.json`.
The generated fixtures use the documented shared-machine dimensions. Basic keeps its full authored catalogue.
Local React edit 1 is 19.717 ms slower on average. No local result replaces the required cloud acceptance below.
The same-input proof compares raw served bytes and maps only exact identities that the existing delivery contract permits to differ.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

- [x] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check` with the locked Cargo dependencies.
- [x] Record each failed, skipped, or blocked check and the test cost in `.context/serve-bundle-affinity/`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Send the implementation SHA immediately to the performance orchestrator for the mokly-cloud acceptance measurement.
- [ ] Confirm the mokly-cloud goal: at least 0.6 GiB lower peak, edits 2–10 mean within +1%, and no slower edit 1 or first Changes.
- [ ] If affinity misses the goal, send the measured result to the performance orchestrator and apply the authorised next step.
- [ ] Review the complete local diff against `origin/main` with `implementation-review` after the push. Run finding checks, fix the fix-now findings, record follow-up items, and re-review once. Use at most two fix rounds.
- [ ] Re-fetch main and merge it with `git-merge` if needed. Preserve PR #351 and the other merged pool work. If main moves, rebuild and repeat the acceptance comparison against it.
- [ ] Delete this plan under the `plans` skill after every prior required TODO completes.
- [ ] Open the pull request into `main`. Preserve the dated decisions and plan permalink in its description. Watch final CI with the shared `finish-work/scripts/ci-wait.sh`. Send the report to the performance orchestrator. Do not merge.
