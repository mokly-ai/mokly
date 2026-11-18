# Keep Serve sidecars ready for the first edit

Status: Active. On branch `calummoore/mokly-first-edit-warm-sidecars-8npz`, no pull request yet. The completing pull request deletes this plan.

Serve classifies the working catalogue against an extracted base. Each sidecar process serves one source root. Startup base capture can move every process to the base root. The first watched edit then replaces these processes before it can use the head root.

Keep the most useful head process during base work. After base work, replace idle base processes with ready head processes in the background. Keep the configured process bound, source isolation, cancellation, and shutdown rules.

The performance orchestrator made calls 1 to 4 on 2026-11-18. The user authorised it to decide this design on 2026-11-16. The reason was to improve Changes speed and reliability without a change that can exhaust machine memory. This task authorises the plan and implementation to continue without another approval. Do not merge the pull request.

Contract owners:

- [Source root workers](../docs/protocol/mokly-sidecar-modules.md#source-root-workers).
- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Sidecar lifecycle](../docs/protocol/mokly-sidecar.md#lifecycle).
- [Cancellation](../docs/protocol/mokly-sidecar-lifecycle.md).
- [Memory sampling](../docs/protocol/mokly-sidecar-memory.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).

## Design and decisions

| Call | Subject                      | Source         | Severity | Effort | Choice        |
| ---- | ---------------------------- | -------------- | -------- | ------ | ------------- |
| 1    | Keep useful head work        | Design         | Medium   | Medium | A             |
| 2    | Return idle capacity         | Design         | Medium   | Medium | B             |
| 3    | Bound process ownership      | Design         | High     | Medium | A with C      |
| 4    | Preserve regression coverage | Design         | High     | Small  | A and C       |
| 5    | Later base demand            | Implementation | Medium   | Medium | E             |
| 6    | Local measurement scope      | Design         | Medium   | Small  | D with B runs |
| 7    | Failed-reap response         | Implementation | Medium   | Medium | E on B        |

The pool launch root identifies the head. A successful head bundle establishes its newest generation. Later successful renders of that generation identify its most recently used process. Protect that process from a different-root request when another slot can serve the request. A one-slot pool keeps its present behaviour. Existing PostCSS affinity still applies.

Background replacement takes only an idle slot, one slot at a time. It ends and reaps the old process before it starts the new process. It does not evaluate base and head code in one process. Waiting demand takes the slot after safe handover. A stopped pool cannot publish a replacement or start another process. A failed start leaves an empty slot for normal on-demand recovery. A failed reap retires only that slot and retains its control for shutdown. It also disables background return for the rest of this pool's life. Healthy slots and warm-head protection continue. Later calls switch roots on demand. When no usable slot remains, the pool enters its existing stopped state. The existing warning path reports lost capacity.

The current queue does not record source roots. The release worker only disposes stale generations. Serve already owns base admission and knows when classification commits. Signal from `Source::finished`, after publication. The signal records work without blocking the classification commit. Do not infer completion from gaps between sequential base calls.

The options check kept calls 1 to 3 and extended call 4 with Serve-level coverage. Its full report is `.context/first-edit-warm-sidecars/options-check.md`. The implementation starts without speculative replay. Measurements must check whether saturation leaves enough warm head state. Missing views in a kept capture can still require later base renders.

The performance orchestrator narrowed the local measurements on 2026-11-18. The fresh main and branch arms cover `examples/basic` and the default large HTML fixture, three runs each. Large React measurements are skipped in both fresh arms because their long renders hide the first-edit cost. The earlier React samples remain historical evidence. The performance orchestrator measures `mokly-cloud` for acceptance. Local runs cover the one-switch path and the no-sidecar control. The cloud trace owns the saturation check, later base misses, and any evidence for speculative replay. With the implementation SHA, request root-switch spans by phase, maximum sidecar count, and peak RSS.

This workspace orchestrator makes these implementation calls on 2026-11-18, within the performance orchestrator's design:

- Protect the head slot only when another slot is available now. Do not reduce base throughput under saturation.
- Signal completed base work from `Source::finished`. It follows publication and excludes replaced classifications.
- Hand over after the old process is reaped when a request waits. During hello, head demand can use the replacement after hello. Different-root demand requires safe termination and handover.
- One publication signal schedules one return pass and replaces unfinished candidates. A later base call cancels that slot's pending return for this pass. Do not reschedule it between sequential base calls. Untouched candidates continue. During a pass, base calls prefer an eligible idle process of the same root that already left the pass. This keeps sequential later calls from touching every candidate. A new publication can schedule a new pass. This applies the task's rule that a new call ends that slot's pending replacement.
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

### 5. Later base demand ends its pending return

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** The per-publication return candidates in the sidecar pool.
- **Background:** A kept-base reader can issue sequential calls after publication. Its idle gaps do not mean that its work has ended.
- **Problem:** A return pass can otherwise take the same base process between those calls.
- **Impact if no action:** Later base reads can repeatedly replace and restore a process.
- **Root question:** How can later base work keep only the base processes that it uses at the same time, while other idle processes return?
- **Options:**
  - **A.** Resume the same return candidate after each call. Sequential calls can churn. Effort: Small.
  - **B.** End the whole return pass after any base call. Untouched slots then stay on the base. Effort: Small.
  - **C.** End only the touched slot's candidate for this publication. A new publication can schedule a new pass. Effort: Medium.
  - **D.** Track the full lifetime of every later base operation and schedule a new return when it ends. Existing capture scopes reduce the plumbing, but sequential captures can still repeat switches. Effort: Large.
  - **E.** Apply C and prefer an eligible idle same-root process that already left the active pass over a candidate. Sequential calls then keep one base slot. Effort: Medium.
- **Left out:** A timer adds a machine-speed assumption. Extra processes break the bound.
- **Wider fix:** E. A pass marker controls both candidate cancellation and the matching-root selection rule.
- **Previous examples:** Decision 2 avoids the same sequential-call gap during startup base work.
- **Related:** Decisions 2 and 3 share the completed-phase and per-slot cancellation rules.
- **Recommendation:** E, changed from C by the options check. It keeps C and stops sequential calls from removing every candidate through queue rotation.
- **Action:** fix now, apply E. This workspace orchestrator's call of 2026-11-18, under the recorded user rule that a new call for the slot ends its pending replacement. The matching-root preference preserves capacity for untouched candidates.

Shared assumptions: the publication signal starts one return pass, from decision 2. It replaces unfinished candidates under one serial owner. A later call ends that slot's pending replacement, from the task's third design call. A head call ends the candidate too, because the process then serves the head. The pass rechecks that candidates remain idle base processes at each handover. Neither rule requires restarting cancelled work before another publication. E drops the current queue rotation order only for matching base slots during a pass.

The item 5 options report is `.context/first-edit-warm-sidecars/later-demand-options-check.md`. Its check added E and clarified when a pass begins. Requests before the signal have no pending replacement to cancel.

### 6. Use focused local performance measurements

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** The local release measurement arms.
- **Background:** Comparison reuse merged into main during the first baseline. The fresh baseline must use that revision. Full-size React renders take minutes and hide the first-edit sidecar cost.
- **Problem:** Repeating those long runs delays the implementation without resolving the acceptance goal.
- **Impact if no action:** The build lane stays occupied by measurements with little useful evidence for this change.
- **Root question:** Which local or cloud evidence covers each measurement duty at a cost that the shared build lane can carry?
- **Options:**
  - **A.** Repeat basic, default HTML, and default React in both arms. The React costs hide the small sidecar difference. Effort: Small.
  - **B.** Measure basic and default HTML three times per arm. Keep the earlier React evidence and use the performance orchestrator's cloud measurement for acceptance. Effort: Small.
  - **C.** Measure only the cloud catalogue. This drops the local controls that the task keeps. Effort: Small.
  - **D.** Keep B and assign the saturation, later-base-miss, and speculative-replay evidence to the cloud trace. Request spans by phase, maximum sidecars, and peak RSS. Effort: Small.
  - **E.** Keep B but remove the saturation and later-base-miss duties. A missed goal would then lack its cause. Effort: Small.
  - **F.** Add one default React run per arm for counts and spans only. This reverses the explicit React skip and requires a new call. Effort: Small.
  - **G.** Add a reduced React fixture with several base slots. This needs calibration and a new scope call. Effort: Medium.
  - **H.** Add a local cloud series in both arms. This needs a new adapter, installation, and resource checks, plus a new scope call. Effort: Large.
- **Left out:** Timing assertions in required tests would violate the test contract. A branch-only React series against the old main rows would mix comparison implementations.
- **Wider fix:** None. These are one-time measurements, not a new verification system.
- **Previous examples:** The historical React runs have much longer edit renders than the basic catalogue.
- **Recommendation:** D, extended from B by the options check. It keeps B's exact runs and React skip while naming the evidence owner for each remaining duty.
- **Action:** fix now, apply D. The performance orchestrator's call of 2026-11-18 authorises B's scope and React skip. This workspace orchestrator assigns the remaining trace duties to the existing cloud acceptance run.

Shared assumptions: both arms use release builds in separate checkouts and targets, from the task. They use the same probe and fixture sizes, from the task. The performance orchestrator measures cloud acceptance, from the task. Its later message explicitly removes React from both fresh local arms. D drops the assumption that the local controls show several base slots. The options report is `.context/first-edit-warm-sidecars/measurement-scope-options-check.md`. Root-switch phase classification alone cannot distinguish a head switch from a later base miss; keep that limitation visible in both arms.

### 7. Failed reaping disables background return

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `crates/mokly-sidecar/src/pool_return.rs`, `retire_return`.
- **Background:** A failed reap leaves a control registered and a slot unavailable. A one-slot pool cannot silently leave later calls waiting forever.
- **Problem:** A whole-pool stop loses healthy capacity. Slot retirement alone lets one shared failure retire every idle candidate.
- **Impact if no action:** A background optimization can remove all useful capacity after one shared termination failure.
- **Root question:** How should Serve stay bounded, promptly serve or fail later calls, and report why after an unconfirmed exit?
- **Options:**
  - **A.** Stop the whole pool and document it. Retain the failed control for shutdown. Healthy slots stop too. Effort: Small.
  - **B.** Retire only the failed slot and retain its control. Other slots continue. Stop only when no usable capacity remains, so later calls terminate. Report the failed reap through the existing warning path. Effort: Medium.
  - **C.** Keep the draft undocumented. The boundary gap stays. Effort: Small.
  - **D.** Apply B and end only the current pass after a failed reap. Later publications can each retire another slot. Effort: Medium overall.
  - **E.** Apply B and disable background return for the rest of the pool's life after its first failed reap. Healthy calls and warm protection continue. Later calls switch roots on demand. Effort: Medium overall, Small beyond B.
- **Left out:** C leaves the contract incomplete. A termination retry or a longer deadline violates the task. An extra process or reuse of the unconfirmed slot violates the bound. Moving a live PostCSS context violates affinity.
- **Wider fix:** E. Explicit retired state keeps the bound. Disabling background return limits its capacity loss to one slot. The shared transition for foreground and recycle remains a follow-up.
- **Previous examples:** The foreground root switch propagates its kill error without stopping healthy slots. The background path has no request to receive its error.
- **Recommendation:** E, extended from B by the options check. A shared termination failure must cost at most one slot from background work.
- **Action:** fix now, apply E on B. The performance orchestrator made both calls on 2026-11-18, under the user's delegation of 2026-11-16. A background optimization must preserve healthy Changes capacity. Report both the failed reap and turn-off through the existing diagnostic path.

Shared assumptions: successful reaping must precede reuse, from the process-bound call. Failed controls remain owned, from the stop contract. Queued and new calls must not be stranded, from the pool's fail-closed boundary. Other slots need not fail with the retired slot; B drops that draft assumption. An affine PostCSS call cannot move its live context and instead returns the existing unavailable error. The driver reports each failure through the command's existing Diagnostics reporter. E drops continued background replacement after the first failed reap. The options report is `.context/first-edit-warm-sidecars/failed-reap-options-check.md`.

## Milestone 1: Document the source-root scheduling contract

Depends on: none

Completed. Evidence: `.context/first-edit-warm-sidecars/docs-report.md`.

- [x] Delegate the protocol update to the docs implementor. State useful head preservation, background return, the process bound, and stop behaviour.
- [x] Add the required implementation status link while the new contract is pending. Update useful crate entry points where needed.
- [x] Record separate follow-ups for general loaded-state scheduling and the existing foreground root switch's missing reap wait. Keep their implementation outside this change.

## Milestone 2: Baseline release measurements

Depends on: none

Completed. Evidence: `.context/first-edit-warm-sidecars/measurements/report.md`.

- [x] Delegate the main baseline and context-only measurement probe to the non-ui implementor. Use the separate baseline checkout and its own target directory.
- [x] Measure startup Changes and two watched edits on `examples/basic` and the default large HTML fixture from `scripts/large/`.
- [x] Record root-switch spans, peak RSS, and maximum sidecar count. Keep the raw evidence under `.context/first-edit-warm-sidecars/`.

## Milestone 3: Preserve and restore head processes

Depends on: 1

Completed. Evidence: `.context/first-edit-warm-sidecars/implementation-report.md` and `.context/first-edit-warm-sidecars/docs-report.md`.

- [x] Delegate implementation to the non-ui implementor. Keep the newest head generation process when another slot can serve base work.
- [x] Add the base-work completion signal and idle background replacement under shared slot ownership.
- [x] Prove red first: useful head preservation, idle return before the next head call, process bound, cancellation, shutdown, and new demand during replacement.
- [x] Prove the Serve completion trigger after committed publication and its absence for a replaced classification. Prove that a new publication safely replaces an unfinished pass.
- [x] Prove that later base demand cancels only its slot's candidate for the current return pass. Prove that sequential base calls prefer the same already-used idle base slot while candidates remain.
- [x] Preserve one-root-per-process and the one-slot fallback. Keep all existing pool tests unchanged.
- [x] Run targeted pool, sidecar, and Serve checks. Run new asynchronous tests 10 times and record their test cost.
- [x] Apply the performance orchestrator's failed-reap outcome and document it.
- [x] Prove that the first failed reap ends background return for the pool's life. A later publication starts no pass. Report the turn-off through the same diagnostics path.
- [x] Check the implementation against all TODOs. Remove the pending status link when implemented.
- [x] Delegate the final sidecar README selection sentence and new Key Code entry points after the implementation settles.

## Milestone 4: Repository gate and implementation push

Depends on: 1, 3

Completed. Implementation commit: `5c682a8bf247f6d6fd14df40bc9e511630718902`.

The performance orchestrator requested this order on 2026-11-18. Push after the targeted 10-run checks and repository gate. Cloud acceptance then runs in parallel with local release measurements and the complete gate. Send each later pool or Serve fix SHA too.

Evidence: `.context/first-edit-warm-sidecars/repository-gate-standard.log`. The extra test-thread environment setting and its correction are in `.context/first-edit-warm-sidecars/gate-environment-note.md`.

- [x] Use Git 2.45 or later first on PATH, installed git-lfs, and the pinned Bun. Check disk and memory before each large Cargo build. Use `CARGO_INCREMENTAL=0` and one Cargo build at a time.
- [x] Run the early repository suite. Record each failed, skipped, or blocked check and its reason.
- [x] Fetch and merge current `origin/main` with the git-merge skill before each delegation batch. Preserve nearby changes.
- [x] Commit with Conventional Commits and push the branch. Send the implementation SHA to the performance orchestrator at once for its `mokly-cloud` measurement.

## Milestone 5: Measure the first edit

Depends on: 2, 3, 4

Main advanced to `bc4f4cc40` with the sidecar JavaScript bundle optimization. The task requires last-merged-main measurements, so refresh the comparable baseline at that revision. Keep the completed `f13a5d979` baseline as historical evidence. The fixture scope and three-run count do not change.

Completed. Evidence: `.context/first-edit-warm-sidecars/measurements/comparison-bc4.md`. The performance orchestrator accepted the cloud results on 2026-11-18. Its evidence is `.context/first-edit-warm-sidecars/cloud-acceptance.md` and will appear in the pull request.

- [x] Delegate release-build measurements to the non-ui implementor. Use separate main and branch checkouts and target directories.
- [x] Refresh the last-main baseline at `bc4f4cc40` so both arms include the merged JavaScript bundle optimization.
- [x] Run Serve with two watched edits on `examples/basic` and the default large HTML fixture from `scripts/large/`.
- [x] Record startup Changes, both edit-to-ready times, root-switch spans, peak RSS, and maximum process count. Keep raw evidence under `.context/first-edit-warm-sidecars/`.

## Milestone 6: Complete gate, review, and pull request

Depends on: 1, 2, 3, 4, 5

Gate evidence: `.context/first-edit-warm-sidecars/full-gate-result.json`. Invocation corrections and prior failed attempts are in `.context/first-edit-warm-sidecars/gate-environment-note.md`. Current `origin/main` remains `bc4f4cc40` and is already merged.

- [x] Run the complete gate. Record each failed, skipped, or blocked check and its reason.
- [x] Fetch and merge current `origin/main` with the git-merge skill before the final pull request. Preserve nearby changes.
- [ ] Commit and push each required follow-up fix. Send a new pool or Serve implementation SHA to the performance orchestrator at once.
- [ ] Review the complete local diff against `origin/main` with the implementation-review skill. Check each finding, apply its fix rule for at most two fix rounds, and record follow-up items for the rest.
- [ ] Delete this plan when every earlier TODO is complete and the review rounds are done.
- [ ] Open the pull request into `main`. Preserve the dated decisions and this plan's permalink in its description. Wait for CI with `scripts/ci-wait.sh`. Send the full report to the performance orchestrator. Do not merge.
