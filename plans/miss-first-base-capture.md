# Miss-first base capture

Status: Active. On branch `calummoore/mokly-first-changes-1-miss-first-capture-66in`, no pull request exists yet. The completing pull request deletes this plan.

On 2026-11-19, the user chose option D for first Changes latency: improve the
first classification through five separate, stacked pull requests. This plan
owns step 1 only. The user authorized design calls that preserve output and
keep memory in check. The user holds all merges. This bottom pull request
targets `main` and must stay open.

Mokly renders the head catalogue before it prepares the historical base.
Changes then captures and compares those views. On `mokly-cloud` at
`6ae96ed08`, 44 base views missed the render cache. Their keys were known at
base preparation completion, but fixed capture batches delayed their renders.
The selected approach starts those misses immediately and captures other
views through a bounded sliding window.

On 2026-11-19, the user chose option D for faster first Changes after Serve starts. Each of five steps gets its own pull request:

1. Miss-first base capture.
2. A byte-equal comparison fast path.
3. Shared base stylesheet records.
4. Busier head-usage sidecars.
5. A render store that survives Serve restart.

This plan covers step 1 only. The user authorized continuous implementation and pull requests while output stays equal and memory stays within 2% of main. The user holds every merge.

Contract owners:

- [Comparison capture and serving](../docs/protocol/mokly-comparison-serving.md).
- [Root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Base lifetime](../docs/protocol/mokly-base-preparation.md).
- [Memory admission](../docs/protocol/mokly-sidecar-memory.md).
- [Graph boundary](../crates/mokly-graph/README.md).
- [CLI runtime](../crates/mokly-cli/README.md).

## Design calls

These calls belong to the performance orchestrator on 2026-11-19. The task
message authorizes their implementation. The options check also reviews them.

### 1. Start known base misses immediately

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/changes_base.rs`, `crates/mokly-graph/src/session_collection.rs`, `crates/mokly-graph/src/collection.rs`, and `crates/mokly-compare/src/capture_collection.rs`.
- **Terms:**
  - **Miss:** A document key absent from all render cache tiers.
  - **Prefetch:** A classification-owned render that starts before ordered capture needs its view.
  - **Sliding window:** A bounded set of capture jobs that admits another job when one finishes.
- **Background:** Base preparation computes every document key. Most base views reuse the head cache. Fixed batches wait for slow renders and root switches.
- **Problem:** Known misses wait behind earlier cached routes. Idle processes cannot help until another batch starts.
- **Impact if no action:** The first Changes keeps avoidable capture latency.
- **Root question:** How can first Changes use ready base capacity sooner while preserving its result and memory bounds?
- **Options:**
  - **A.** Keep demand rendering and use a sliding capture window. Late misses still wait for their routes. Effort: Medium.
  - **B.** Prefetch known misses and keep fixed capture batches. Other slow views still hold each batch. Effort: Medium.
  - **C.** Prefetch known misses and use the bounded sliding capture window of follow-up option C. Preserve ordered capture and failures. Effort: Medium.
  - **D.** Start known misses first within one capture window. No separate prefetch lifetime exists, but misses wait through freshness recording. Effort: Medium.
  - **E.** C with a count bound of twice parallelism on started and unconsumed work. A slow early route can still stop admission. Effort: Medium.
  - **F.** C with waiting encoded results charged within the existing capture byte bound. Admission pauses when that byte budget is spent. Effort: Medium.
  - **G.** F with cache-hit jobs bounded by worker count, independent of sidecar capacity. It changes the task's selected bound. Effort: Medium.
- **Left out:** Whole-side parallel rendering violates transient memory bounds. Early base preparation during head usage violates the task's memory constraint. Change nothing fails the latency goal.
- **Wider fix:** F. Remove fixed batch barriers while bounding both active inputs and waiting encoded results.
- **Previous examples:** `plans/follow-ups/capture-batch-window.md` records the background usage window introduced by PR #225.
- **Recommendation:** F, revised from C after the options check. It bounds waiting results without a fixed batch barrier.
- **Action:** fix now, apply F. The performance orchestrator chose immediate miss-first capture on 2026-11-19. This workspace adds its byte bound.

Shared assumptions and sources:

- Output, warning order, failure order, and retained route order stay equal. Source: task and comparison serving contract.
- The window uses at most the smaller of worker count and sidecar capacity. Source: task's selected follow-up option C.
- Workers encode completed views before ordered consumption. Waiting results share the existing capture byte bound. Source: option F and the task memory constraint.
- Miss discovery reads cached keys without a restore. Source: task design call 1.
- Eviction after discovery changes time only. Source: task design call 5 and render cache contract.
- Capture shares an in-flight prefetch result instead of rendering the same miss twice. Source: bounded early rendering and output equality.
- Capture finishes before comparison so cross-view validation remains complete. Source: comparison serving contract.
- Cache-hit jobs keep the task's selected capacity bound. Option G changes it and is not selected.

### 2. Keep foreground workers available

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/serve_changes_native.rs` and `crates/mokly-cli/src/serve_pool.rs`.
- **Terms:**
  - **Admission gate:** Serve's rule that base sidecar calls wait while foreground work is active.
- **Background:** Base and foreground work share render workers. A base job can wait at admission while it holds one worker.
- **Problem:** Prefetch can occupy workers that foreground work needs to release admission.
- **Impact if no action:** Foreground work can stall while base renders wait.
- **Root question:** How can prefetch and capture use sidecar capacity without delaying a foreground render?
- **Options:**
  - **A.** Acquire cancellable base admission before shared worker dispatch. Keep each claim with its bounded job. Effort: Medium.
  - **B.** Run bounded base capture and prefetch on separate render workers. Keep the existing process pool and admission rules. Effort: Medium.
- **Left out:** Waiting on shared workers violates the task. More processes violate the pool bound. An asynchronous render stack exceeds this step's scope. A separate foreground pool changes the foreground wait rule. A cached read can become a render after eviction, so shared workers cannot safely run it. Option A holds a claim across a job, against the per-call claim rule.
- **Wider fix:** B across every base job. This step covers prefetch and capture. Keep the wider follow-up unless every case is covered.
- **Previous examples:** `plans/follow-ups/background-base-render-pool.md` records the same stall in base capture and kept-base reads.
- **Recommendation:** B. It preserves per-call claims, foreground admission, and root choice.
- **Action:** fix now, apply B. This workspace's call of 2026-11-19, under the user's implementation authority.

Shared assumptions and sources:

- No job waits for admission while it holds a shared render worker. Source: task design call 2.
- At most one render runs per base process. Source: task design call 2.
- The sidecar count, memory admission, cache bound, and root scheduling stay equal. Source: task common rules.
- No new process, setting, gate, retry, or sleep. Source: task common rules. A bounded thread pool adds none of these.
- Base calls wait while foreground work is active. Source: the on-demand contract.

### 3. Scope prefetch to its classification

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** code structure.
- **Location:** Base preparation, graph capture, and classification cancellation boundaries.
- **Terms:**
  - **Classification:** One background Changes calculation that owns its temporary base work.
- **Background:** Serve replaces unfinished Changes calculations after a watched edit. It can retain a completed base for later calculations.
- **Problem:** Detached prefetch could keep rendering after its calculation stops or becomes obsolete.
- **Impact if no action:** Obsolete work consumes memory and process capacity, and can delay shutdown.
- **Root question:** How can early rendering stop with the calculation that owns it?
- **Options:**
  - **A.** Own bounded prefetch within capture and join on every exit. Start after freshness recording, or move capture into the provider. Effort: Medium.
  - **B.** Keep a classification-owned prefetch handle across preparation and capture. Cancel and join it on every exit. Effort: Medium.
- **Left out:** Detached work fails cancellation and memory ownership. A process-wide queue has no classification lifetime. These leave two concrete lifetime placements.
- **Wider fix:** B. Dropping the handle cancels and joins, so no early return can leak work into a kept base.
- **Previous examples:** The comparison serving contract already cancels unfinished base preparation when a newer classification replaces it.
- **Recommendation:** B. It starts at the earliest known miss and follows the existing classification lifetime.
- **Action:** fix now, apply B. Performance orchestrator's call of 2026-11-19, authorized by the task.

Shared assumptions and sources:

- Cancellation, stop, and supersession stop prefetch. Source: task design call 4.
- Prefetch publishes no capture or error ahead of route order. Source: task design call 3 and comparison serving contract.
- Kept-base lifetime and cancellation semantics stay equal. Source: base preparation contract.

## Replaced ways

- Fixed capture batches become an encoded sliding window. Its worker-side collector changes `crates/mokly-graph/src/collection.rs` and `crates/mokly-compare/src/capture_collection.rs`. Consumers: base capture in Serve, build, and publish, and head build capture. Move every consumer in milestone 2. Remove the unused batch loop there.
- Unused batch APIs lose their last caller: `RenderGeneration::schedule_comparison`, `RenderWorkers::comparison`, and their wrapper forwards. Remove them in milestone 2.
- Demand-only base misses gain classification-owned prefetch. Capture remains the sole ordered publisher and shares in-flight results. No compatibility converter remains.

## Milestone 1: Documentation and protocol

Depends on: none

The docs implementor records the authorized scheduling requirements before code changes.

- [ ] State immediate non-restoring miss discovery, bounded prefetch, ordered capture, and cancellation in the relevant protocol docs.
- [ ] Keep root selection, memory admission, output, and freshness rules intact.
- [ ] Update the graph and CLI README entry points and worker ownership where needed.

## Milestone 2: Ordered capture and miss-first rendering

Depends on: 1

The non-ui implementor changes the shared capture path and the base integration.

- [ ] Add tests first and see assertion failures for misses starting before their capture route.
- [ ] Add or extend tests for route commit order and failure order under out-of-order completion.
- [ ] Add tests for cancellation, stop or supersession, and eviction between miss listing and capture.
- [ ] Discover misses after base graph preparation through keys without restoration.
- [ ] Start bounded, classification-owned prefetch immediately. Avoid shared-worker admission waits. Share its in-flight results with capture.
- [ ] Replace fixed capture batches for every consumer with the selected encoded sliding window.
- [ ] Preserve validation facts, error precedence, warning order, and retained route order.
- [ ] Join prefetch on every exit. Preserve kept-base behavior and every existing assertion.
- [ ] Remove the unused fixed-batch loop, batch APIs, and wrapper forwards. Update live references.
- [ ] Run each new asynchronous test ten times and record test costs.

Evidence: `.context/miss-first-base-capture/` holds prompts, red and green tests, and check logs. `reports/options-check.md` holds the options check.

## Milestone 3: Measurements and verification

Depends on: 2

The orchestrator measures release builds in separate checkouts and target directories.

- [ ] Measure baseline and candidate on `examples/basic` and the large HTML and React fixtures, warm and cold, in six interleaved rounds.
- [ ] Compare first Changes, capture stages, exact output, and cgroup anonymous memory plus swap.
- [ ] Measure whole-tree startup and ten-edit peaks against the 2% memory limit.
- [ ] Run targeted tests, the repository suite, and the complete gate. Use Git 2.45 or later, git-lfs, pinned Bun, and locked Cargo.
- [ ] Run large Cargo builds serially, check disk and memory first, and disable incremental builds and dev debug information.

Evidence: `.context/miss-first-base-capture/measurements/` holds raw runs and before/after tables.

## Milestone 4: Commit, review, and pull request

Depends on: 1, 2, 3

- [ ] Commit with Conventional Commits and push the implementation branch.
- [ ] Send the implementation SHA and dist build commit immediately. Obtain the orchestrator's six-run `mokly-cloud` result.
- [ ] Meet the cloud mean targets: capture-side improves by 0.5 seconds and first Changes improves by 0.4 seconds. Output stays equal and memory stays within 2%.
- [ ] Review the complete local diff against `origin/main` with the implementation-review skill after the push. Check findings, apply at most two fix rounds, record follow-ups, and re-review once.
- [ ] Delete this plan under the plans skill after its required work passes.
- [ ] Open the pull request against `main`. Preserve this plan's dated record and permalink in the description. Watch final CI with the finish-work script and report to the performance orchestrator. Do not merge.
