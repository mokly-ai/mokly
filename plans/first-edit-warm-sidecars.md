# Keep Serve sidecars ready for the first edit

Status: Active. On branch `calummoore/mokly-first-edit-warm-sidecars-8npz`, no pull request yet. The completing pull request deletes this plan.

Serve classifies the working catalogue against an extracted base. Each sidecar process serves one source root. Startup base capture can move every process to the base root. The first watched edit then replaces these processes before it can use the head root.

Keep the most useful head process during base work. After base work, replace idle base processes with ready head processes in the background. Keep the configured process bound, source isolation, cancellation, and shutdown rules.

The performance orchestrator made calls 1 to 4 on 2026-11-18. The user authorised it to decide this design on 2026-11-16. The reason was to improve Changes speed and reliability without a change that can exhaust machine memory. This task authorises the plan and implementation to continue without another approval. Do not merge the pull request.

Contract owners:

- [Source root workers](../docs/protocol/mokly-sidecar-modules.md#source-root-workers).
- [Sidecar lifecycle](../docs/protocol/mokly-sidecar.md#lifecycle).
- [Cancellation](../docs/protocol/mokly-sidecar-lifecycle.md).
- [Memory sampling](../docs/protocol/mokly-sidecar-memory.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).

## Design and decisions

The pool launch root identifies the head. A successful head bundle establishes its newest generation. Later successful renders of that generation identify its most recently used process. Protect that process from a different-root request when another slot can serve the request. A one-slot pool keeps its present behaviour. Existing PostCSS affinity still applies.

Background replacement takes only an idle slot, one slot at a time. It ends and reaps the old process before it starts the new process. It does not evaluate base and head code in one process. Waiting demand takes the slot after safe handover. A stopped pool cannot publish a replacement or start another process. Failure leaves the slot available for normal on-demand recovery.

The current queue does not record source roots. The release worker only disposes stale generations. Serve already owns base admission and knows when classification commits. Signal from `Source::finished`, after publication. The signal records work without blocking the classification commit. Do not infer completion from gaps between sequential base calls.

The options check kept calls 1 to 3 and extended call 4 with Serve-level coverage. Its full report is `.context/first-edit-warm-sidecars/options-check.md`. The implementation starts without speculative replay. Measurements must check whether saturation leaves enough warm head state. Missing views in a kept capture can still require later base renders.

This workspace orchestrator makes these implementation calls on 2026-11-18, within the performance orchestrator's design:

- Protect the head slot only when another slot is available now. Do not reduce base throughput under saturation.
- Signal completed base work from `Source::finished`. It follows publication and excludes replaced classifications.
- Hand over after the old process is reaped when a request waits. During hello, head demand can use the replacement after hello. Different-root demand requires safe termination and handover.
- Let a Serve-owned background task call the pool's bounded maintenance operation. The pool owns each slot transition and stop state. Keep blocking process work off the release thread and commit closure.
- Keep the `root-switch` timing reason for both request and background root changes. Expand its cause in the timing contract. Event order distinguishes background and edit work without a new reason or allow-list entry.
- Keep all idle base slots eligible, as the task directs. Do not add capture-completeness plumbing or reserve base capacity in this change. Measure later base misses.
- Keep speculative replay out initially. It adds CPU and retained evaluation state. Reconsider it only if the measurements show the chosen approach misses the goal.
- Keep the existing foreground root-switch path unchanged. The task preserves existing pool tests. Record its missing reap wait separately instead of widening this background change.

### 1. Preserve useful head work during base capture

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs`.
- **Background:** The pool prefers matching roots, then empty slots, then the oldest idle slot. Base capture can take the process that prepared the newest head.
- **Problem:** The first edit loses warm head compilation and evaluation state.
- **Impact if no action:** The first edit continues to pay avoidable process and bundle costs.
- **Root question:** How can the first edit find warm head processes without slowing startup Changes by more than 5%?
- **Options:**
  - **A.** Protect the most recent process for the newest head generation when another slot is available now. Base work uses it under saturation. Effort: Medium.
  - **B.** Partition the existing pool into fixed head and base capacities. This reduces scheduling freedom. Effort: Medium.
  - **C.** Reserve every process with head state until an edit needs it. Base work can lose useful parallelism. Effort: Medium.
  - **D.** Let base work use every slot. Replay the newest head generation into the first replacement after base work. This adds replay work. Effort: Medium.
  - **E.** Wait for a non-protected slot under saturation. This reduces base capacity to N minus one. Effort: Medium.
  - **F.** Keep root selection unchanged and rely on background replacement. Cleanup can expose the useful head process. Effort: Small.
  - **G.** Rank candidates by useful loaded state for every root and request. This changes the wider scheduling policy. Effort: Large.
- **Left out:** Extra processes break the bound. C can block all base work and fails the startup limit. E dominates fixed partition B because it does not limit head capacity. The recorded letters remain for the decision history.
- **Wider fix:** G, added by the options check. It preserves useful state for every root. Record it as a separate follow-up.
- **Previous examples:** `pool_affinity.rs` already preserves PostCSS context affinity.
- **Recommendation:** A, kept after the check. It adds no wait under saturation. It can preserve only the first head request's warm process. The measurements must test whether that is sufficient.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18.

Shared assumptions: the launch root is the working head, from `Pool::new` and its callers. One process serves one root, from the source worker contract. The task requires the one-slot fallback and bounds all processes.

### 2. Restore idle capacity after base work

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_sources.rs` and Serve base admission.
- **Background:** Serve keeps a bounded base capture. Views outside that capture can still need a base render. Idle processes can remain on the base root.
- **Problem:** Head render calls must replace those processes after the first edit.
- **Impact if no action:** Preserving one head process leaves replacement costs on other head renders.
- **Root question:** How can idle pool capacity become ready before the next head edit?
- **Options:**
  - **A.** Replace idle base processes whenever the pool sees no queued or active base demand. Sequential base calls can create false idle gaps. Effort: Medium.
  - **B.** Signal completed base work from Serve, then replace eligible idle base processes in the background. Track later demand and stop state. Effort: Medium.
  - **C.** Replace the processes and restore the current head generation before the next call. This adds replay work and retained state. Effort: Medium.
  - **D.** Keep one idle base process when the capture lacks views. This requires capture-completeness plumbing and leaves less head capacity. Effort: Medium.
  - **E.** Replay and then dispose of the head generation after replacement. Node module caches can remain warm. Heap retention still needs measurement. Effort: Medium.
- **Left out:** Replacement on the next head call fails the goal. A timer adds a machine-speed assumption. Extra processes break the bound. A changes exact spawn orders of existing pool tests and can churn between sequential base calls.
- **Wider fix:** B. Represent the completed work phase instead of inferring it from an empty queue.
- **Previous examples:** Serve already wraps calls with base and foreground admission in `serve_pool.rs`.
- **Recommendation:** B, kept after the check. Signal after committed publication and replace one slot at a time. C and E can add first-edit memory. Start without replay and assess it from measurements. D remains a measured alternative.
- **Action:** fix now, apply B. Performance orchestrator's background replacement call of 2026-11-18. The explicit phase signal is this workspace orchestrator's implementation call of 2026-11-18.

Shared assumptions: background work must finish before the next edit when there is enough idle time, from the task. A new base request can reclaim capacity, from the task. Background preparation must not raise startup Changes by more than 5% or peak RSS beyond noise, from the task. No contract requires speculative generation replay.

### 3. Keep replacement inside the process bound

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Likelihood:** Rare.
- **Location:** `crates/mokly-sidecar/src/pool_state.rs` and `pool_shutdown.rs`.
- **Background:** The pool owns each process through a slot and its control handle. Shutdown and cancellation operate through those handles.
- **Problem:** A background replacement adds ownership transitions that could escape the bound or stop handling.
- **Impact if no action:** A process can survive cancellation or consume unbounded extra memory.
- **Root question:** How can background preparation preserve bounded process ownership?
- **Options:**
  - **A.** Lease an idle slot and keep its replacement under pool controls. End and reap before spawn. Replace one slot at a time. Hand over safely on demand, cancellation, shutdown, and abort. Effort: Medium.
  - **B.** Use one serial maintenance owner for all idle replacements, with the same slot controls and stop rules. Effort: Medium.
  - **C.** Start a Serve-owned blocking task that calls synchronous pool maintenance. Keep slot ownership in the pool. Keep process work off release cleanup. Effort: Medium.
- **Left out:** Independent speculative processes violate the bound. Reusing one process across roots violates isolation.
- **Wider fix:** A. Make the slot own both normal and background process transitions.
- **Previous examples:** `cancel_busy` already finds leased processes through the control map.
- **Recommendation:** A, kept after the check, with C as its execution home. Shared ownership keeps each process visible to stop handling. A waiting call cannot bypass the old process's reap.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18.

Shared assumptions: the pool size bounds running processes at every instant, from the task. Old process termination precedes new spawn, from the task. Pending work must end cleanly when a call takes its slot, from the task. The background path must call `finish` after termination and before spawn. Do not block release cleanup or retain the pool through an idle task.

### 4. Preserve isolation and regression coverage

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Test.
- **Location:** `crates/mokly-sidecar/src/_tests_/`.
- **Background:** Existing tests cover source isolation, leases, retries, cleanup, cancellation, and process ownership.
- **Problem:** New scheduling can pass performance checks while breaking those behaviours.
- **Impact if no action:** A speed improvement can introduce incorrect output or leaked processes.
- **Root question:** How can this change prove its new behaviour without losing existing guarantees?
- **Options:**
  - **A.** Add focused pool regressions with controlled worker events. Keep every existing pool test unchanged. Effort: Small.
  - **B.** Add real-process integration coverage for the new scheduling. It costs more and controls races less directly. Effort: Medium.
  - **C.** Add Serve-level coverage for a signal after committed publication and no signal after replacement. Keep the current timing producer coverage. Effort: Small.
- **Left out:** Time assertions cannot prove ownership and violate the test contract. Replacing or weakening existing tests violates this task.
- **Wider fix:** None. The source-root and ownership contracts already cover the class.
- **Previous examples:** Existing pool tests use `unimock` worker and control boundaries.
- **Recommendation:** A and C, extended from A by the check. Controlled events prove pool behaviour. Serve-level tests prove the completion trigger.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18.

Shared assumptions: new behaviour tests must fail first on an assertion, from the task and testing skill. No sleeps, retries, weakened assertions, or increased deadlines are allowed, from the task. Performance runs are evidence under `.context/`, not timing assertions in tests.

## Milestone 1: Document the source-root scheduling contract

Depends on: none

- [ ] Delegate the protocol update to the docs implementor. State useful head preservation, background return, the process bound, and stop behaviour.
- [ ] Add the required implementation status link while the new contract is pending. Update useful crate entry points where needed.
- [ ] Record separate follow-ups for general loaded-state scheduling and the existing foreground root switch's missing reap wait. Keep their implementation outside this change.

## Milestone 2: Preserve and restore head processes

Depends on: 1

- [ ] Delegate implementation to the non-ui implementor. Keep the newest head generation process when another slot can serve base work.
- [ ] Add the base-work completion signal and idle background replacement under shared slot ownership.
- [ ] Prove red first: useful head preservation, idle return before the next head call, process bound, cancellation, shutdown, and new demand during replacement.
- [ ] Prove the Serve completion trigger after committed publication and its absence for a replaced classification.
- [ ] Preserve one-root-per-process and the one-slot fallback. Keep all existing pool tests unchanged.
- [ ] Run targeted pool, sidecar, and Serve checks. Run new asynchronous tests 10 times and record their test cost.
- [ ] Check the implementation against all TODOs. Remove the pending status link when implemented.

## Milestone 3: Measure the first edit

Depends on: 2

- [ ] Delegate release-build measurements to the non-ui implementor. Use separate main and branch checkouts and target directories.
- [ ] Run Serve with two watched edits on `examples/basic` and the large HTML and React fixtures from `scripts/large/`.
- [ ] Record startup Changes, both edit-to-ready times, root-switch spans, peak RSS, and maximum process count. Keep raw evidence under `.context/first-edit-warm-sidecars/`.
- [ ] Push the implementation and send its SHA to the performance orchestrator at once for its `mokly-cloud` measurement.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3

- [ ] Use Git 2.45 or later first on PATH, installed git-lfs, and the pinned Bun. Check disk and memory before each large Cargo build. Use `CARGO_INCREMENTAL=0` and one Cargo build at a time.
- [ ] Run the early repository suite and the complete gate. Record each failed, skipped, or blocked check and its reason.
- [ ] Fetch and merge current `origin/main` with the git-merge skill before each delegation batch and before the final pull request. Preserve nearby changes.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the implementation-review skill. Check each finding, apply its fix rule for at most two fix rounds, and record follow-up items for the rest.
- [ ] Delete this plan when every earlier TODO is complete and the review rounds are done.
- [ ] Open the pull request into `main`. Preserve the dated decisions and this plan's permalink in its description. Wait for CI with `scripts/ci-wait.sh`. Send the full report to the performance orchestrator. Do not merge.
