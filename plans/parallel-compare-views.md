# Parallel comparison of classification views

Status: Active. On branch `calummoore/mokly-parallel-view-comparison-n4kr`, no pull request yet. The completing pull request deletes this plan.

Mokly compares every classification view on one thread. This change runs the independent work on the generation's existing render pool.
The ordered remainder preserves the result, warnings, first error, cancellation error, and work counts.
On four CPUs, the large-catalogue comparison stage must take at most half its sequential time.
The change retains at most one extra bounded batch of decoded view inputs.
It adds no pool and changes no pool size.

The user authorized planning, implementation, review, and an open pull request on 2026-11-16. Do not merge the pull request.
The performance orchestrator owns the design calls below.
Its authority comes from the user's 2026-11-16 request to improve Changes speed and reliability without exhausting machine memory.
The user assigned design choices to that orchestrator.

Contract owners:

- [Comparison](../docs/protocol/mokly-comparison.md).
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md).
- [Timings](../docs/protocol/mokly-timings.md).
- [Comparison crate](../crates/mokly-compare/README.md).
- [Graph crate](../crates/mokly-graph/README.md).
- [Server crate](../crates/mokly-server/README.md).
- [CLI crate](../crates/mokly-cli/README.md).

## Design

Phase A reads a retained base document and closure without source fallback, then reads the head document and closure.
It builds both matching trees and compares material for a non-moved pair without aliases.
A view with a base route but no retained base input defers its complete preparation to the ordered caller.
A view without a base route can prepare in parallel.
A failed retained restore also defers without reading the source or retrying the restore.
Its deferred recipe keeps the source generation, captured closure, and restore error.
The ordered consumer reads the source base document, the head document, the captured base closure, and the head closure.
It emits the existing restore-failure log only when it consumes that view.
The deferred path keeps base document, head document, base closure, and head closure order.
Phase A has no resource memo or parsed CSS cache access.
Phase B runs in existing entry and view order on one thread.
It computes move aliases, moved material, resource evidence, styles, instance proofs, state, and usage.
Every memo and parsed CSS cache call keeps its existing order.
Phase B consumes and releases each Phase A result.

The first implementation uses one batch at a time, without overlap.
A batch holds at most `comparison_parallelism().max(1)` views.
Each result keeps both sides of one view, its closures, matching trees, and any independent material comparison.
Batch collection preserves view positions, including failed positions.
The ordered consumer finishes an earlier view's Phase B before it reports a later view's Phase A error.
Cancellation checks run before each batch and before ordered consumption.
Worker spans inherit the current comparison span through `parent.in_scope`.

The current graph scheduler returns only `ComparisonDocument`.
It cannot return the comparison crate's Phase A type without reversing the crate dependency.
An indexed task boundary lets the comparison own its bounded result slots.
The graph owns only scheduling on its existing pool.
Both generation wrappers forward scheduling while the supplied task keeps wrapper checks.
The sequential trait defaults remain available to existing providers.
Both sides check cancellation before each batch and before ordered consumption.
The base generation supplies scheduling and capacity, because it carries Serve classification cancellation.
`CancellableWorkers` and `SerialStylesheets` forward scheduling too.
A retained-only input read defaults to no retained input.
`CapturedGeneration` supplies it without source IO.
A checking wrapper declines the lookup when forwarding would bypass checks or require source IO.
The engine then uses that wrapper's checked reads in order.
The base-usage branch can add a separate usage read. Keep both methods.
Transparent wrappers forward that read. `FrozenResources` keeps its checked default.

Workspace orchestrator's call, 2026-11-16: defer uncaptured base work to ordered consumption.
Reason: speculative Git reads can alter the fatal source failure channel or hold Serve workers at its admission gate.
Retained-only parallel reads preserve both the first error and the existing foreground capacity without a new pool.
This is the smallest adaptation of the performance orchestrator's Phase A call that fits these code paths.

Counts in this plan mean `ResourceWork`, parsed CSS cache statistics, and `affected_lookups`.
Render cache statistics remain timing observations, as their existing contract states.
The old capture scheduler stays because capture validation still returns graph-owned inputs.
The new task boundary schedules comparison-owned preparation. Both retain their sequential defaults.
The task explicitly requires forwarding the existing capture scheduler.

Before each delegation batch and the final pull request, fetch and merge `origin/main` under the `git-merge` skill.
Preserve the base-reader, Git-process, sidecar, and `calummoore/mokly-base-usage-without-restore-g972` changes.
Record later main commits and rebuild the baseline from the final merge base when they affect the measured path.
The performance orchestrator identified the profile edit on 2026-11-16.
It changed one React screen title in `mokly-cloud` with `--base HEAD`.
Four views changed. The other 1,504 views stayed unchanged.
The baseline release build at `331bf5d43` is saved as `.context/parallel-compare-views/mokly-before`.
The source diff, SHA-256, and build log stay beside it.

Options-check evidence: `.context/parallel-compare-views/reports/plan-options-full.md` and `retained-options-full.md` in that folder.

### 1. Keep cache-dependent work ordered

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-compare/src/comparison_views.rs`.
- **Background:** Mokly compares rendered views and reuses resource facts and parsed stylesheets. Their work counts form part of the required result.
- **Problem:** Parallel cache use can change cache contents and work counts.
- **Impact if no action:** Parallel classification can give different work counts between runs.
- **Root question:** How can comparison use idle CPUs while preserving deterministic results and work?
- **Options:**
  - **A.** Split independent preparation from ordered cache-dependent work. Effort: Medium.
  - **B.** Run complete views concurrently with deterministic cache transactions. This needs a larger cache redesign. Effort: Large.
  - **C.** Split cache requests from later CSS matching and proofs, then parallelize the latter too. This expands three CSS modules. Effort: Large.
- **Left out:** Sequential views miss the speed goal. Whole-view parallelism with single-flight caches does not preserve cache order or counts.
- **Wider fix:** A. The phase boundary keeps shared cache operations outside parallel work.
- **Previous examples:** `scale_engine_tests.rs` checks resource and parse work counts.
- **Assumptions:** Identical output and counts are task requirements. Both remain in force. Neither option drops them.
- **Recommendation:** A. It isolates most view work without changing cache policy.
- **Action:** Apply A. Performance orchestrator's call, 2026-11-16, under the user's performance authority.

### 2. Bound transient comparison inputs

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/types.rs` and `crates/mokly-compare/src/comparison_views.rs`.
- **Background:** Existing capture batches use the render pool and limit transient inputs to its capacity.
- **Problem:** Preparing every decoded view together can exhaust machine memory.
- **Impact if no action:** Memory can grow with catalogue size.
- **Root question:** How can concurrent view preparation keep a fixed memory bound?
- **Options:**
  - **A.** Prepare one pool-sized batch, then consume it in order. Effort: Medium.
  - **B.** Overlap preparation and consumption with at most two pool-sized batches. Effort: Medium.
  - **C.** Use a pool-sized sliding window and an ordered consumer. This needs a streaming scheduler and slot signals. Effort: Medium.
- **Left out:** Catalogue-wide preparation breaks the memory bound. Another thread pool breaks the explicit constraint. Sequential work misses the speed goal.
- **Wider fix:** A or B. Both make the result lifetime follow bounded batch ownership.
- **Previous examples:** `session_collection.rs` schedules bounded capture inputs.
- **Assumptions:** The existing pool and its size stay unchanged, as the task requires. Neither option drops this constraint.
- **Recommendation:** A for the first measurement. The options check preferred C for throughput.
  Keep A only if Milestone 4 confirms the half-time target. C remains the measured fallback.
- **Action:** Apply A. Performance orchestrator's bounded-batch call, 2026-11-16. The workspace selects the permitted single-batch form.

### 3. Forward scheduling through generation wrappers

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** code structure.
- **Location:** `crates/mokly-server/src/comparison_graph.rs` and `crates/mokly-compare/src/comparison_capture.rs`.
- **Background:** Serve wraps its head in `FrozenResources`. Captured sides use `CapturedGeneration`.
- **Problem:** Both wrappers currently inherit sequential scheduling defaults.
- **Impact if no action:** Serve or build can remain sequential despite the engine change.
- **Root question:** How do build and Serve reach their existing render capacity and retained base inputs without bypassing checks or adding source reads?
- **Options:**
  - **A.** Forward scheduling and capacity through wrappers, with caller-owned tasks. Effort: Small.
  - **B.** Supply scheduling separately to every engine caller. This expands caller interfaces. Effort: Medium.
  - **C.** Require an explicit worker accessor and scheduling implementation from every provider. This removes defaults. Effort: Medium.
  - **D.** Keep Serve sequential until it has a separate background pool. This misses the Serve goal. Effort: Small.
  - **E.** Apply A. Checking wrappers decline retained lookups that bypass checks or need source IO. Keep checked usage defaults. Effort: Small.
  - **F.** Apply A for scheduling. Expose retained input through `ComparisonCapture` and its existing decline rule. This needs shared capture storage. Effort: Medium.
- **Left out:** Unwrapping generations bypasses wrapper checks. Changing the default to a global pool breaks the pool constraint.
  C breaks the task's explicit sequential-default requirement. D breaks its parallel Serve goal.
  Deferred base fallback in decision 4 avoids adding the admission-gate risk.
  An unchecked retained-input forward bypasses validation. A checked forward that reads the source violates the pure lookup boundary.
- **Wider fix:** F. One capture boundary owns retained reads and the deferred recipe.
- **Previous examples:** `Session` forwards capture scheduling to `RenderWorkers`.
- **Assumptions:** Wrapper validation stays active, and the default stays sequential, as the task requires.
  The base capture is outermost in current build and Serve chains. A checking wrapper above it can safely decline and remain sequential.
- **Recommendation:** E. The original recommendation was A. E adds the checking-wrapper rule and matches the incoming usage-read design.
- **Action:** Apply E. Performance orchestrator's scheduling call, 2026-11-16, so Serve uses its existing pool.
  Workspace orchestrator's checking-wrapper call, 2026-11-16, preserves validation without speculative source IO.

### 4. Preserve ordered errors and cancellation

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** product bug.
- **Location:** `crates/mokly-compare/src/comparison_views.rs`.
- **Background:** Sequential classification reports the first error in entry and view order.
- **Problem:** Worker completion order differs from view order.
- **Impact if no action:** The same input can return a different first error.
- **Root question:** How does parallel classification preserve sequential failure behaviour?
- **Options:**
  - **A.** Keep ordered result slots and consume each complete view before the next. Check cancellation before every batch. Effort: Medium.
  - **B.** Run speculative jobs with an ordered commit queue. This is the sliding-window alternative. Effort: Medium.
  - **C.** Stop starting jobs after a known failure. An atomic lowest-failed index reduces speculative work. Effort: Small.
  - **D.** Associate every source failure with its view and commit that channel in order. This reaches Git adapter context. Effort: Large.
  - **E.** Accept a fatal source failure from a later speculative view. This changes the first-error requirement. Effort: Small.
  - **F.** Parallelize retained base inputs only. Defer source fallback and failed retained restores to the ordered caller without a retry. Effort: Medium.
  - **G.** Apply F and prepare the head of deferred views in parallel. This needs a second result shape and merge path. Effort: Medium.
- **Left out:** Returning the first completed error breaks the task requirement. Cancelling all jobs after any worker error can hide an earlier error.
  Retained-only reads on both sides fail the Serve goal because its head is not captured.
  A larger capture breaks the memory constraint. A speculative-source replay adds a retry and the same admission risk.
- **Wider fix:** F. Retained-only preparation keeps speculative base source effects outside the worker stage.
- **Previous examples:** The graph's capture scheduler retains input order and every failure.
- **Assumptions:** The task requires the same first error and generation-specific cancellation error. Both stay in force.
  Only the base Git source writes the fatal failure channel. Head preparation changes caches and digests, but writes no fatal channel.
  A retained restore reads no source. Its failure keeps the captured closure and falls back only for the document.
  Captured base coverage controls speed. Measure the uncaptured share rather than assume all base views are retained.
- **Recommendation:** F, with A's ordered slots. The original recommendation was A. The check exposed a separate fatal source failure channel.
  C alone cannot protect that channel. E breaks the requirement. D reaches Git adapter context that F avoids.
  Use G or a sliding window only if measured retained coverage prevents the target.
- **Action:** Apply F with A. Performance orchestrator's ordered-error call, 2026-11-16.
  Workspace orchestrator's retained-only adaptation, 2026-11-16, preserves that call without the exception proposed as E.

### 5. Keep timing parentage across workers

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/workers.rs`.
- **Background:** Timing tools group view work under `review.compare-views`.
- **Problem:** Worker execution can lose the calling thread's tracing span.
- **Impact if no action:** Profiles can omit comparison work or attach it to the wrong stage.
- **Root question:** How do timings retain classification ownership when work moves between threads?
- **Options:**
  - **A.** Enter the captured parent span around each worker task. Effort: Small.
  - **B.** Pass explicit parent handles through every comparison helper. Effort: Medium.
- **Left out:** Separate unparented spans break the task requirement. A second tracing system adds no benefit.
- **Wider fix:** A. The scheduler preserves context for all tasks it runs.
- **Previous examples:** Existing `ThreadWorkers` methods use `parent.in_scope`.
- **Assumptions:** Existing span names and parentage remain useful to the timing tools. The task requires that parentage.
- **Recommendation:** A. It follows the worker methods already in use.
- **Action:** Apply A. Performance orchestrator's call, 2026-11-16, to preserve profiling evidence.

### 6. Keep comparison results in their owning crate

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** code structure.
- **Location:** `crates/mokly-graph/src/types.rs` and `crates/mokly-graph/src/workers.rs`.
- **Background:** Capture scheduling returns graph-owned documents. Phase A also returns comparison-owned material evidence and matching trees.
- **Problem:** The existing scheduler's result type cannot hold Phase A without a crate dependency cycle.
- **Impact if no action:** The engine cannot schedule the complete independent phase through that API.
- **Root question:** How can the graph schedule comparison work without owning comparison policy?
- **Options:**
  - **A.** Add an indexed task trait with caller-owned bounded result slots. Effort: Small.
  - **B.** Expose a generic scoped executor through a new shared scheduling abstraction. Effort: Medium.
  - **C.** Migrate capture validation to the indexed scheduler and remove its typed scheduler. This expands capture changes and tests. Effort: Medium.
  - **D.** Give the new boundary an ordered streaming consumer for decision 2's sliding window. Effort: Medium.
- **Left out:** Moving comparison policy into the graph reverses responsibility. A graph dependency on the comparison crate creates a cycle.
- **Wider fix:** A. The task boundary separates scheduling from result types.
- **Previous examples:** Existing worker traits keep graph scheduling injectable.
- **Assumptions:** The graph owns its pool and the comparison owns its evidence, as current crate dependencies establish. This boundary remains useful.
- **Recommendation:** A. It is the smallest object-safe extension of the existing worker boundary.
- **Action:** Apply A. Workspace orchestrator's call, 2026-11-16. The current capture-specific result type requires this adaptation.
  The performance orchestrator explicitly accepted this scheduler call on 2026-11-16.

### 7. Carry scoped tracing onto indexed workers

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/workers.rs`.
- **Background:** Production uses a global timing subscriber. The test harness uses a scoped subscriber that worker threads do not inherit.
- **Problem:** `parent.in_scope` enters the span but does not install that dispatcher. The new CLI test observed zero worker records instead of four.
- **Impact if no action:** The scoped test subscriber cannot see worker view spans or verify their comparison parent.
- **Root question:** How do worker spans and events reach the caller's subscriber under the caller's span?
- **Options:**
  - **A.** Capture the current dispatcher at scheduling. Install it around `parent.in_scope` for each indexed task. Effort: Small.
  - **B.** Require a global subscriber from each caller. Production already uses one. The scoped test harness would need to change. Effort: Small.
  - **C.** Add one shared worker context helper and use it in all six pool methods. It carries both context parts at each call. Effort: Small.
  - **D.** Keep span-only scheduling and prove parentage with a global subscriber in a dedicated test process. It adds a process-level harness. Effort: Medium.
- **Left out:** A dispatcher bound to the pool lifetime cannot serve later scoped callers. Task-side tracing repeats scheduler responsibility and breaks the accepted boundary.
- **Wider fix:** C. One helper carries both context parts for every render-worker hop.
- **Previous examples:** Existing worker methods use only `parent.in_scope`. The new scoped CLI tracing test exposes the difference.
- **Assumptions:** The task requires worker span parentage. Scoped subscribers come from the test harness, not a product requirement. D drops scoped support. C drops the earlier scope choice to leave typed methods span-only.
- **Recommendation:** C, changed from A after the options check. It removes the copied incomplete pattern with one small helper in the same file.
- **Action:** Apply C. Workspace orchestrator's call, 2026-11-17. Entering a span alone does not carry a scoped subscriber. One helper prevents the same gap in every pool method.

Replaced ways: monolithic per-view preparation becomes independent preparation plus one ordered consumer.
`comparison_views::collect` and the shared closure caller in `rendered_moves.rs` migrate in Milestone 2.
Milestone 2 removes the replaced monolithic path. No capture API is replaced.

## Milestone 1: Documentation and protocol audit — completed

Depends on: none

Delegate to the `docs implementor`. Keep user-visible comparison behaviour unchanged.

- [x] Verify the saved baseline release binary and unchanged product source evidence before Milestone 2.
- [x] Audit comparison, serving, timing, and crate docs against the approved design.
- [x] Update only stale requirements or entry-point descriptions. Keep implementation mechanics in code comments.
- [x] Record the audit and any needed implementation-time doc edits under `.context/parallel-compare-views/`.

Evidence: `.context/parallel-compare-views/reports/docs-audit-preparation.md`. No stale protocol requirement. README additions wait for final API names.

## Milestone 2: Separate independent view work — completed

Depends on: 1

Delegate to the `non-ui implementor`. Keep the split sequential until the scheduling milestone.

- [x] Extract Phase A documents, closures, matching trees, and non-move material comparison without memo or parsed CSS access.
- [x] Keep Phase B memo and parse calls in their current order, including move aliases and material comparison.
- [x] Release each Phase A result after its Phase B. Remove the replaced monolithic path and unused helpers.
- [x] Update the moved code location in `plans/follow-ups/skip-equal-before-snapshots.md` without changing its historical words.
- [x] Run comparison and scale count tests. Save the result under `.context/parallel-compare-views/`.

Evidence: `.context/parallel-compare-views/reports/phase-split.md`. The root checked the source order, result lifetime, test logs, and clippy result.

## Milestone 3: Schedule bounded concurrent batches — completed

Depends on: 2

Delegate to the `non-ui implementor`. Keep the existing render pool and sequential defaults.

- [x] Add the object-safe task scheduling boundary and use the existing pool with inherited tracing spans.
- [x] Preserve the `review.resource-graph` error outcome when a closure read fails. Cover the discovered span regression.
- [x] Forward capacity and both scheduling operations through `FrozenResources`, `CapturedGeneration`, `CancellableWorkers`, and `SerialStylesheets`.
- [x] Add the retained-only input read. Keep wrapper checks and the incoming base-usage read.
- [x] Defer views that need base source fallback to ordered preparation before Phase B.
- [x] For a failed restore, use a deferred source-and-closure recipe. Attempt the restore once and log its failure only when consumed.
- [x] Prove that Phase A reads no base source and deferred preparation starts only after every earlier view is consumed.
- [x] Prove that later base source failures cannot replace an earlier view error. Cover one failed restore with no source closure read.
- [x] Run Phase A in one pool-sized batch at a time and consume results in view order.
- [x] Check both generation cancellations before each batch and ordered consumption. Preserve the base classification's cancellation error.
- [x] Test the task's required sequential and parallel result, warning, and work-count equality with the mixed-view and stylesheet fixture.
      Include retained and deferred base views. The user explicitly required this regression test, including red-first evidence.
- [x] Run existing exact-count scale fixtures with multiple workers as well as the sequential default.
- [x] Add red-first concurrency and peak-bound coverage with a recording worker double.
- [x] Add red-first ordered-error coverage where the later failure completes first. Cover an earlier Phase B error too.
- [x] Run every new asynchronous test ten times without sleeps, retries, or elapsed-time assertions. Record test costs and red evidence.
- [x] Finish the crate entry-point docs after the final API names are known.

Docs evidence: `.context/parallel-compare-views/reports/final-docs.md`. The root checked API names and wrapper rules. The code delegate owns the discovered closure-error span fix.

Evidence: `.context/parallel-compare-views/reports/scheduling.md`. The root checked source order, batch ownership, all completed mutation failures, repeated-test results, and final clippy. Options evidence: `.context/parallel-compare-views/reports/tracing-options.md`.

## Milestone 4: Performance evidence

Depends on: 3

Delegate measurement preparation and runs to the `non-ui implementor` when implementation is idle.
The orchestrator checks the measurements and decides whether the speed goal is met.
Save every input, command, commit, timing, and RSS sample under `.context/parallel-compare-views/`.

- [ ] Measure before and after on `examples/basic` and the HTML and React large fixtures from `scripts/large/`.
- [ ] Measure Changes build and Serve with one controlled screen-content edit on four CPUs.
      Include `review.compare-views`, `changes.classify`, and peak native-process RSS.
- [ ] Measure a shared stylesheet edit too. Assess both edit kinds. The supplied profile used a one-screen content edit.
- [ ] Record base `uncapturedViews` from `review.capture-side` in every run and report its share with the target assessment.
- [ ] Use the same inputs and settings for both versions. Confirm the large-catalogue comparison stage takes at most half the sequential time.
- [ ] Check the bounded transient-input proof and RSS evidence. Report any unmet target to the performance orchestrator.

## Milestone 5: Verification, review, and pull request

Depends on: 4

The workspace orchestrator owns the combined gate, review, and pull request.
Merge evidence: `.context/parallel-compare-views/reports/main-merge-audit.log` and `main-merge-preservation.txt`.
Fetch and merge `origin/main` before each delegation batch and before the final pull request.
Preserve merged changes from the base-reader, Git-process, and sidecar branches.
Before every large Cargo build, check `df -h` and `free -m`.
Set `CARGO_INCREMENTAL=0`. Run Cargo builds one at a time.

- [ ] Run targeted tests, Rust formatting, clippy, and `cargo xtask check --suite repository`.
- [ ] Smoke-test a Changes build and a Serve edit. Run the required strict example build and smoke check when rendering changes require it.
- [ ] Run `cargo xtask check`. If blocked, record the blocker and each suite that ran.
- [ ] Commit with Conventional Commits and push. Start `scripts/ci-wait.sh` after each CI-triggering action.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push. Run finding checks and both permitted fix rounds.
- [ ] Record all deferred or open findings as follow-up items. Prepare the final evidence and review report for the performance orchestrator.
- [ ] Delete this plan under the `plans` skill after every earlier TODO is complete.
- [ ] Open the pull request into `main`. Preserve the dated calls, plan permalink, checks, measurements, and follow-up items in its description.
