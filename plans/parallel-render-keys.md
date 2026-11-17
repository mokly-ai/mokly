# Parallel render input keys

Status: Active. On branch `calummoore/mokly-parallel-render-keys-6m85`, no pull request yet. The completing pull request deletes this plan.

Mokly computes one render input key for each exporting JavaScript module.
The exporter calculations read shared records but currently run in sequence.
Run these independent calculations on bounded workers. Preserve every key,
the whole-bundle fallback, and all public output.

## Authority and contracts

The performance orchestrator owns these calls, dated 2026-11-17:

- Optimise this loop in one pull request. Keep keys byte-for-byte equal.
- Keep memory bounded. Do not make a change that can exhaust the machine.
- Choose the worker pool after an options check. Avoid sidecar oversubscription.
- Add a build span only if the existing timing contract permits it.
- Measure release builds in separate checkouts and target directories.
- Complete review and CI. Leave the pull request open for the performance orchestrator to merge.

Reason: On 2026-11-16, the user delegated design calls to the performance
orchestrator. The user asked for faster, reliable Changes across multiple
pull requests, with no memory exhaustion risk. This task authorises the
plan and its implementation without another approval stop.

Contract owners:

- [Rendering](../docs/protocol/mokly-rendering.md).
- [Watch key rules](../docs/protocol/mokly-watch.md#invalidation-through-the-render-graph).
- [Timings](../docs/protocol/mokly-timings.md).
- [Graph crate](../crates/mokly-graph/README.md).
- [Large fixtures](../tests/fixtures/large/README.md).

## Design calls

### 1. Bound parallel key calculation

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/render_inputs.rs`, `crates/mokly-graph/src/workers.rs`.
- **Terms:**
  - **Exporter:** A module that exports at least one resolved definition.
  - **ThreadWorkers:** The existing dedicated render worker pool in `mokly-graph`.
- **Background:** Shared records and binding attribution complete before exporter calculation. Each exporter then needs only immutable inputs.
- **Problem:** Sequential calculation costs about 230 ms on the target catalogue.
- **Impact if no action:** Serve rebuilds retain this delay.
- **Root question:** How can exporter keys finish sooner while the core keeps one bound on worker threads and peak memory?
- **Options:**
  - **A.** Use the global Rayon pool. It adds another pool and takes its size from global Rayon settings. Effort: Small.
  - **B.** Reuse `ThreadWorkers` and its tracing context. Temporary exporter sets live only during each worker job. Jobs can wait behind active renders. Effort: Small.
  - **C.** Create a bounded scoped pool for key calculation. It adds runnable threads beside render workers and sidecars. Effort: Small.
- **Left out:** Sequential execution fails the parallel calculation goal. Sidecar calculation moves core inputs across a boundary without reducing work.
- **Wider fix:** B. Share the existing concurrency limit rather than add independent worker capacity.
- **Previous examples:** `comparison_tasks` and `stylesheets` reuse `ThreadWorkers` and `WorkerContext`.
- **Assumptions:** Equal keys and bounded memory come from this task. Independent exporter work comes from the code. Keep these assumptions.
- **Recommendation:** B. Existing workers bound concurrency and avoid another pool.
- **Action:** fix now, apply B. This is the workspace orchestrator's call of 2026-11-17 under the task's authority.

Keep existing two-argument builder callers and existing tests working.
The implementor chooses the smallest worker-aware entry that satisfies this
constraint. Keep the fallback path and record ordering unchanged. Store only
finished keys between jobs. Do not queue completed exporter closure sets.
Reuse the existing indexed task boundary when practical. Skip scheduling an
empty exporter batch. If a new worker method is necessary, forward it through
both CLI wrappers. Check the queue wait when render workers are occupied.

### 2. Observe the key build duration

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/serve_trace_stages.rs`.
- **Background:** The timing contract treats stage names as diagnostic details. It permits overlapping worker spans without logging source values.
- **Problem:** Existing timings do not isolate key calculation.
- **Impact if no action:** Target measurements need a profile to separate this work.
- **Root question:** How can measurements isolate key calculation under the existing timing contract?
- **Options:**
  - **A.** Keep profiling without a new span. Profiles have sampling error. Effort: Small.
  - **B.** Add a `render.inputs` build span and allow it through the existing reporter. Keep the timing schema unchanged. Effort: Small.
  - **C.** Add a separate benchmark executable. It duplicates fixture and reporting setup. Effort: Medium.
- **Left out:** A new public timing schema exceeds the task and is unnecessary.
- **Wider fix:** B. The existing reporter carries one complete build span.
- **Previous examples:** `graph.prepare.routing-records` uses the same timing reporter.
- **Assumptions:** Timing remains opt-in and source-free, as the timings contract requires. Keep these assumptions.
- **Recommendation:** B. Stage names are diagnostic details, so this needs no protocol change.
- **Action:** fix now, apply B if the allowlist tests accept it. This is the workspace orchestrator's call of 2026-11-17.

### 3. Prove key and fallback equality

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** test.
- **Location:** `crates/mokly-graph/src/_tests_/render_parallel_tests.rs`.
- **Background:** Existing tests compare keys with the original reference algorithm. The current equivalence fixture has only a few exporters.
- **Problem:** It does not exercise a worker batch with many exporters.
- **Impact if no action:** A scheduling error could omit or misassign a key without a focused regression case.
- **Root question:** How can verification detect missing or changed keys in parallel exporter work?
- **Options:**
  - **A.** Run a temporary many-exporter equality probe. It leaves no scheduling regression case. Effort: Small.
  - **B.** Add one worker-backed many-exporter case against the existing sequential reference. Exercise shared closures, a cycle, preview stories, renderer, and fallback. Effort: Small.
  - **C.** Compare complete rendered catalogues only. This is slower and can miss incorrect unused module keys. Effort: Medium.
  - **D.** Run one many-exporter case through reverse-order injected scheduling and two real workers. Compare with the sequential reference. Effort: Small.
- **Left out:** A test per exporter repeats one requirement. A timing assertion would be nondeterministic.
- **Wider fix:** None. Existing reference tests already protect key encoding.
- **Previous examples:** `shared_closures_and_fallbacks_keep_reference_keys`.
- **Assumptions:** The task explicitly requires this test when current tests do not cover many parallel exporters. Keep the reference algorithm unchanged.
- **Recommendation:** D, changed from B after the options check. Reverse scheduling makes a completion-order mapping defect fail deterministically.
- **Action:** fix now, apply D. This is the workspace orchestrator's call of 2026-11-17 under the explicit test requirement.

The options check kept calls 1 and 2. Its report is
`.context/parallel-render-keys/options-check.md`. The contract check is
`.context/parallel-render-keys/documentation-check.md`. No protocol change is needed.

## Milestone 1: Documentation alignment

Depends on: none

The docs implementor checks the contract and graph README. Preserve the
protocol because keys and timing schema keep their existing behaviour.

- [x] Check contract alignment. Existing key, fallback, memory, and timing requirements remain valid.

## Milestone 2: Parallel exporter keys

Depends on: 1

The non-ui implementor changes calculation and its runtime call together.
It keeps the records, closure rules, hashes, and serialization unchanged.

- [x] Run exporter calculations on existing bounded render workers with caller tracing context.
- [x] Preserve deterministic module association and the unchanged fallback.
- [x] Add the permitted build timing span and allowlist entry. Run the existing timing reporter tests.
- [x] Keep the five existing render key test modules unchanged. Add the missing many-exporter worker case and prove it fails on a wrong result.
- [x] Have the docs implementor add the worker entry to the graph README. Clarify indexed task guidance if keys reuse that boundary.
- [x] Run focused Rust tests, formatting, and clippy. Report test cost.

Evidence: `.context/parallel-render-keys/implementation/report.md` and
`.context/parallel-render-keys/documentation-implementation.md`.

## Milestone 3: Measurements and verification

Depends on: 2

The orchestrator keeps builds sequential. Check disk and memory before each
large Cargo build. Set `CARGO_INCREMENTAL=0` and distinct target directories.

- [x] Build release `origin/main` and the branch in separate checkouts and target directories.
- [x] Measure `examples/basic`, HTML and React fixtures from `scripts/large/`, and builds with Changes. Compare elapsed time and core peak RSS.
- [x] Run the canonical strict example build and a Serve HTTP smoke test. Record the blocked desktop visual smoke.
- [ ] Send the implementation SHA to the performance orchestrator at once after push. Obtain the target catalogue's 4-vCPU Serve measurement, including active renders, before completion.
- [ ] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`. Put Git 2.45 or later first on PATH and install git-lfs.

Evidence lives under `.context/parallel-render-keys/`.
Measurement summary: `.context/parallel-render-keys/measurements-summary.md`.
Smoke evidence: `.context/parallel-render-keys/smoke-report.md`.

## Milestone 4: Commit, review, and pull request

Depends on: 1, 2, and the local checks of 3

The initial implementation push starts the target catalogue measurement in
Milestone 3. Its result holds plan deletion and pull request completion.
Independent review can run while that measurement runs.

- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after push. Check each new finding. Apply up to two fix rounds and re-review. Record follow-up items for other findings.
- [ ] Delete this plan under the `plans` skill after every other required TODO passes. Keep its dated decisions in the pull request description.
- [ ] Open the pull request into `main`. Wait for final CI with `scripts/ci-wait.sh`. Report the link, SHA, measurements, calls, review, checks, and follow-ups to the performance orchestrator. Do not merge.
