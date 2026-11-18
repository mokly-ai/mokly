# Prepare the Serve base during current usage

Status: Active. On branch `calummoore/mokly-startup-base-overlap-rae7`, no pull request yet. The completing pull request deletes this plan.

Serve renders current usage before it prepares the base for Changes. Prepare
the next base during current usage. A sidecar base waits before capture until
current usage settles. An HTML-only base also captures early. Compare only
after current usage settles.
Keep the same published content, base freshness checks, capture bounds, and
sidecar pool bound. Keep the warm head process and background return rules.

The performance orchestrator chose the six calls below on 2026-11-18. On
2026-11-16, the user authorised more Changes speed and reliability work. The
user delegated these design choices to that orchestrator and prohibited work
that can exhaust memory. This task authorises the plan and its implementation.
It authorises an open pull request into `main`. It does not authorise a merge.

Contract owners:

- [Base preparation and lifetime](../docs/protocol/mokly-base-preparation.md).
- [Early base preparation](../docs/protocol/mokly-base-early-preparation.md).
- [Changes in Serve](../docs/protocol/mokly-changes.md#changes-in-serve).
- [On-demand background work](../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
- [Sidecar root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md).
- [CLI composition](../crates/mokly-cli/README.md).
- [Server background work](../crates/mokly-server/README.md).
- [Comparison base selection](../crates/mokly-compare/README.md).

Replaced ways:

- Serial Serve base preparation becomes generation-owned preparation during
  current usage. Consumers: `UsagePass`, `ChangesPass`, and the CLI `Source`.
  Milestone 2 moves these consumers and removes their serial preparation trigger.
  Static commands keep their ordinary single classification path.

## Evidence and acceptance

The baseline starts from `origin/main` at `24b238ca4`. The isolated checkout
is `.context/startup-base-overlap/main-checkout`. Its release target directory
is `.context/target-main`. All three dependency probes are stable. Basic and
large React use `node_modules` at ready and after usage. Large HTML uses no
dependency directories. Every unmapped directory set is empty. These results
permit the chosen start point. Raw CPU samples and startup timelines stay in
the evidence folder.

Evidence: `.context/startup-base-overlap/baseline-report.md` records call 1.
The branch integrates `origin/main` at `2e6bde9c2`, including the compiled
bundle cache and generation affinity. The performance orchestrator's call
of 2026-11-18 keeps `e60c16532` valid as the local before baseline. Both local
releases use the same `e60c16532` sidecar assets. Preserve the call 1 evidence
and original fixture roots. Cloud acceptance compares the pushed branch with
the main commit that the branch contains.
The repeated starts show substantial timing spread. The matched repeats
also record an HTTP render, process high-water marks, and a cancellation
stress edit. Gate-gap bounds come from existing call spans. Exact gate
wait needs a new timing span. Sampled process counts do not prove the bound.

The performance orchestrator measures the `mokly-cloud` catalogue after the
implementation push. Its first Changes must arrive at least 1.5 seconds sooner.
The Serve peak RSS must rise by at most 5%. No extra sidecar may exceed the
pool size. Two edit cycles must show no slowdown. Published Changes must have
the same bytes. Local release measurements cover `examples/basic` and the
large HTML and React fixtures from `scripts/large/`.

## Design calls

Shared assumptions come from the task: current usage remains authoritative,
classification waits for that usage, and every existing bound stays in force.
The base retention contract requires the existing key and freshness checks.
The source root scheduling contract requires the existing pool admission.
Call 7 below adds the early-only admission exception that the performance
orchestrator authorised after the options check.

Options check: `.context/startup-base-overlap/options-check.md`.
The check found that head usage takes foreground sidecar leases. It also
found that base capture can hold the render workers while waiting at the
gate. The performance orchestrator chose E for call 2 and the bounded
exception of call 7 on 2026-11-18. These choices supersede full early capture.
The focused check is `.context/startup-base-overlap/focused-options-check.md`.
It found kill-only root switches and separate gate and slot decisions.
The performance orchestrator then chose the early lease and exact process
tracing of call 7 E and G. This replaces the earlier per-call exception.

### 1. Measure dependency stability before implementation

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/changes_base.rs`.
- **Background:** Head renders can add dependency directories after Serve listens. Base dependency selection reads those directories.
- **Problem:** An early selection can differ from selection after current usage. The benefit then shrinks because freshness requires another preparation.
- **Impact if no action:** An unsuitable start point can add work and memory without the required gain.
- **Root question:** What evidence shows that early preparation selects the same dependencies and gets capacity?
- **Options:**
  - **A.** Measure exact ready and completed directory sets, CPU, and startup stages on the requested fixtures. Effort: Medium.
  - **B.** Measure only the target cloud catalogue before choosing a start point. This needs the performance orchestrator's machine. Effort: Medium.
  - **C.** A, plus a dependency probe on the cloud catalogue before implementation. Effort: Small.
  - **D.** A, plus gate-gap bounds from the existing usage traces. Effort: Small.
- **Left out:** No measurement fails the explicit task. Static inspection alone cannot establish runtime directory stability.
- **Wider fix:** None. This is a one-time performance check, not a permanent gate.
- **Previous examples:** The task gives the 2026-11-18 cloud catalogue timeline at `bc4f4cc40`.
- **Recommendation:** A and D. Local evidence establishes the requested start point. The task assigns cloud acceptance to the performance orchestrator after push.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18, under the delegated optimisation authority above.

### 2. Overlap the complete base preparation

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-server/src/background.rs` and `crates/mokly-compare/src/base_classification.rs`.
- **Background:** The base needs extraction, validation with its bundle, graph preparation, and bounded capture. Classification requires completed head usage.
- **Problem:** Serve starts those steps only after current usage. Early sidecar capture can block head render workers at the gate.
- **Impact if no action:** The first Changes retains the full serial base preparation cost.
- **Root question:** Which base steps can overlap usage without blocking head progress or changing output?
- **Options:**
  - **A.** Prepare and capture during usage through one path. Transfer each result once after a final freshness check. This needs separate base render workers. Effort: Medium.
  - **B.** Start only base extraction and the bundle early. Capture still follows usage, so the potential gain is smaller. Effort: Medium.
  - **C.** Pipeline base capture behind each matching head view. This couples two schedulers and changes more lifecycle code. Effort: Large.
  - **D.** Overlap work before the first sidecar call. An HTML-only base also captures early. The potential gain is smaller. Effort: Medium.
  - **E.** Overlap extraction, dependencies, base bundle, and graph preparation. A sidecar base pauses before capture until usage settles. An HTML-only base captures early. Effort: Medium.
  - **F.** E, with HTML-only capture yielding to HTTP renders at each batch boundary. Early capture takes longer while a user browses. Effort: Small.
- **Left out:** Comparing before current usage completes violates the required head evidence. More processes violate the pool bound. No overlap fails the requested change.
- **Wider fix:** E. One preparation path has a pause point before sidecar capture.
- **Previous examples:** Existing `classify_base` already separates preparation from comparison within one call.
- **Recommendation:** E, changed from A after the options check. It avoids early capture jobs that block shared render workers. Consider F if measured HTML HTTP latency rises.
- **Action:** fix now, apply E with call 7. The performance orchestrator chose this refinement on 2026-11-18.

The performance orchestrator's reason: on the cloud catalogue, validation with
the base bundle takes 3.3 seconds and usage takes 5.2 seconds. The bounded
admission exception lets those steps overlap. The CPU estimate gives about
2.3 seconds of gain on four cores. Capture stays after usage, so this change
needs no second render pool. HTTP priority protects Browse latency.

### 3. Stop when dependency growth defeats the start point

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-compare/src/base_freshness.rs`.
- **Background:** A retained base records the directories used for dependency selection. Its freshness check compares those directories with current head usage.
- **Problem:** Frequent directory growth can make a ready-time base stale before classification begins.
- **Impact if no action:** Serve can repeat costly work on normal starts.
- **Root question:** What should happen if measured dependency growth invalidates early preparation?
- **Options:**
  - **A.** Stop dependent implementation and ask the performance orchestrator for another start point. Effort: Small.
  - **B.** Choose a later start point from the evidence without asking. This exceeds the explicit decision boundary. Effort: Medium.
  - **C.** Check final selection directories at the pause point before capture. Restart stale preparation through the normal path. Effort: Small.
  - **D.** Defer dependency selection until usage ends. Only extraction and independent reads overlap. Effort: Medium.
- **Left out:** Ignoring new directories violates freshness. Always preparing twice adds work and fails the performance goal.
- **Wider fix:** C. A final check before capture avoids capturing a base whose early dependency selection is stale.
- **Previous examples:** `FreshnessChecks::current` already rejects a changed directory or unmapped directory set.
- **Recommendation:** A and C. Keep the reserved start-point choice and validate early selection before capture.
- **Action:** fix now, apply A and C. The original call remains. C follows the chosen pause point without changing freshness policy.

### 4. Share the existing sidecar capacity

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/serve_pool.rs`.
- **Background:** Head and base runtimes share one bounded sidecar pool and the render workers. The gate counts background head calls as foreground.
- **Problem:** Base capture can hold shared workers while waiting for head calls. Full early capture would expose that stall during normal startup.
- **Impact if no action:** Extra processes can exhaust memory or displace required head work.
- **Root question:** How should concurrent base and usage work share machine capacity?
- **Options:**
  - **A.** Keep existing pool admission, except the early-only exception of call 7. Keep sidecar capture after usage. Effort: Small.
  - **B.** Reserve a slot for the base within the same pool. This changes existing scheduling and can slow current usage. Effort: Medium.
  - **C.** Make no base sidecar call during usage. This is call 2 option D. Effort: Small.
  - **D.** Give base jobs a separate bounded render thread pool. It starts no sidecar process, but expands this change. Effort: Medium.
  - **E.** Count only HTTP leases at the gate for all base work. Capture could then compete with usage. Effort: Medium.
- **Left out:** A separate pool or process type violates the task. A new setting adds a boundary the task excludes.
- **Wider fix:** D. The existing background-base-render-pool follow-up owns the shared-worker stall. This change avoids early capture on those workers.
- **Previous examples:** PR #313 adds warm head protection and background return. The generation affinity branch also changes pool selection.
- **Recommendation:** A with call 7 and call 2 option E. The performance orchestrator keeps D as a later step for larger machines.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18, under the delegated optimisation authority above.

### 5. Own early work through its full lifetime

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** code structure.
- **Location:** `crates/mokly-server/src/changes_background.rs` and `crates/mokly-cli/src/serve_base_cancel.rs`.
- **Background:** A preparing base follows its generation's cancellation. A successfully kept base detaches and follows Serve stop.
- **Problem:** An early task introduces a period before current usage finishes. New heads, base changes, cancellation, and stop must end obsolete work.
- **Impact if no action:** Obsolete work can publish late, retain files, or leave processes and tasks alive.
- **Root question:** Who owns early work until classification can use it?
- **Options:**
  - **A.** Extend the generation-owned background lifecycle across preparation and usage. Cancel and join obsolete work before its owner ends. Effort: Medium.
  - **B.** Give preparation a separate supervisor. This duplicates lifecycle and cancellation responsibilities. Effort: Large.
  - **C.** Keep cancellation cleanup off the next usage pass. Bound draining work and retain only the newest pending preparation. Effort: Medium.
  - **D.** Own preparation by base key across head changes. This changes the preparing-base cancellation contract. Effort: Large.
- **Left out:** Detached tasks cannot meet cleanup requirements. Cancelling valid kept bases on each edit violates existing retention rules.
- **Wider fix:** C. One bounded owner prevents unjoined work and an unbounded drain set.
- **Previous examples:** `ChangesPass` already cancels and joins classification. `PreparingBase` detaches only under the accepted keep guard.
- **Recommendation:** A and C. Extend cancellation, while the next head usage can progress during cleanup.
- **Action:** fix now, apply A and C. C is the workspace orchestrator's call of 2026-11-18, to preserve edit latency and memory bounds.

### 6. Measure and enforce the memory decision boundary

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** None.
- **Background:** Prepared bases and current usage will coexist. HTML-only capture can also overlap usage. Existing capture, worker, and process limits still apply.
- **Problem:** Fixed component bounds alone do not prove unchanged Serve peak memory.
- **Impact if no action:** The optimisation can exceed the authorised memory increase.
- **Root question:** What evidence permits the overlap to proceed to a pull request?
- **Options:**
  - **A.** Compare sampled Serve process-tree peak RSS with isolated release baselines. Stop and ask if the increase exceeds 5%. Effort: Medium.
  - **B.** Add a runtime memory controller for this overlap. This changes limits and scheduling beyond the task. Effort: Large.
  - **C.** A, with three peak measurements and an edit during preparation on large React. Report the spread. Effort: Medium.
  - **D.** A, with higher sampler priority and per-process kernel RSS high-water marks as a cross-check. Effort: Small.
- **Left out:** Parent-process RSS alone omits sidecars. A larger memory budget violates the task. Permanent performance assertions are not correctness tests.
- **Wider fix:** None. Keep existing structural memory bounds and use one-time evidence for the additional overlap.
- **Previous examples:** `scripts/large/memory.ts` samples process-tree RSS.
- **Recommendation:** A with C and D. Observed sampling gaps make a single sampled peak too weak for the 5% limit.
- **Action:** fix now, apply A with C and D. C and D are the workspace orchestrator's evidence calls of 2026-11-18.

### 7. Admit one early base call

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/serve_pool.rs` and `crates/mokly-sidecar/src/pool_leases.rs`, `pool_affinity.rs`, and `pool_sources.rs`.
- **Background:** Existing admission holds base calls until every head sidecar call ends. Usage calls also take those head leases.
- **Problem:** Unchanged admission blocks early work. Per-call admission separates capacity from slot choice and can add kill-only switches during usage.
- **Impact if no action:** The cloud catalogue can miss its required startup gain.
- **Root question:** Which admission gives early preparation one process during usage, with HTTP priority, warm head capacity, and no extra live process?
- **Options:**
  - **A.** Keep admission unchanged. This limits the benefit of early preparation. Effort: Small.
  - **B.** Admit at most one early base sidecar call during usage. HTTP leases keep strict priority. Capture uses no exception. Effort: Medium.
  - **C.** Give every base call equal admission with usage. This also lets capture compete and increases root switches. Effort: Medium.
  - **D.** B, with one early lease from its first sidecar call through graph preparation. Atomically acquire an idle non-warm or empty slot. Keep it between calls. Each call yields to HTTP leases. Effort: Large.
  - **E.** D, with reaped starts and ends. Wait for the old process to be reaped before starting the base. At the pause point, stop and reap the base, then leave the slot empty. Effort: Large.
  - **F.** Wait for reap before every replacement start, including ordinary root switches, retries, and failed recycles. This broadens ordinary lifecycle behaviour. Effort: Large.
  - **G.** Count live sidecars from exact exec and exit events in a separate run per fixture on each side. This adds evidence, not a permanent test. Effort: Small.
  - **H.** Close early admission while a head rebuild prepares, as for HTTP. This can delay obsolete preparation. Effort: Small.
- **Left out:** A separate sidecar pool violates the process bound. A permanent reservation takes capacity even when no early preparation needs it.
- **Wider fix:** D bounds the early scope without a method list. F covers every replacement. The separate root-switch-reap-wait follow-up owns F.
- **Previous examples:** Call 4 records the existing shared admission. PR #313 records warm head and return rules.
- **Recommendation:** E with G, changed from B after the focused options check. This bounds the added switches and avoids repeated switches between preparation calls.
- **Action:** fix now, apply E with G. Performance orchestrator's call of 2026-11-18, under the user's delegation of 2026-11-16.

The early lease replaces the performance orchestrator's earlier per-call
exception. It covers preparation through graph preparation, including
stylesheet calls. It starts at the first early sidecar call. The atomic
decision checks HTTP leases and takes an idle non-warm or empty slot.
An early waiter holds neither pool admission nor a FIFO position while
waiting for such a slot. Each call yields to HTTP leases. No capture call
uses the early lease.

The lease starts its base process only after the replaced process is
reaped. At the pause point, it stops and reaps the base process. It then
leaves the slot empty for usage. Ordinary pool behaviour, warm head rules,
and return passes remain. The pool size remains the bound during overlap.

The performance orchestrator's reason of 2026-11-18: the live-process bound
is the user's memory guard. The change must establish it without sampled
counts. E closes the gap for added switches and prevents head calls from
taking the base process between preparation calls. F changes ordinary
replacement paths and stays in its separate follow-up.

Workspace orchestrator's calls of 2026-11-18:

- An owner holds at most one running or draining early preparation and the
  newest pending request. New head usage need not wait for that cleanup.
  This avoids an unbounded task set during rapid edits.
- A one-slot pool defers its early sidecar call until usage finishes. The
  sole process is warm, so this preserves both the strict early warm-head
  rule and the ordinary one-slot pool behaviour after usage.
- Preparation transfers an unretained result or an error once, with its
  warnings, after the final dependency-directory check. That check also
  covers sidecar preparation errors and missing retention evidence. A stale
  outcome follows the existing fresh-preparation rule. No new retry follows
  an early error. The performance orchestrator confirmed the existing
  unavailable timeout contract on 2026-11-18.
- Byte proof reports the per-start `deploymentId` separately. Control runs
  of the unchanged binary already differ at that identifier. Stable Changes
  payloads and rendered bytes must compare exactly. The performance
  orchestrator confirmed this proof on 2026-11-18.

The focused check adds these workspace evidence calls of 2026-11-18:

- Record stress edit latency through completed new-head usage and ready
  Changes. Record whether the edit occurs during usage or after it.
  This checks the cost of a draining call.
- Measure one basic and one large React start with two sidecar slots on
  each side. This checks the larger capacity share of an early lease.
- Keep `revision` in the exact byte proof. If it differs, record both
  publication sequences. The check's option to exclude it is not adopted.
  Any further byte exception needs the performance orchestrator's call.
- Add an early-admission timing span for gate wait. Main has no exact gate
  wait span. This measures the authorised scheduling change without changing
  published output.

The performance orchestrator adds these measurements: usage duration, one
HTTP view render during usage, the early base gate wait, root switches per
start, and peak RSS. Report before widening the change if the first Changes
gain is less than one second on the large fixtures because usage slowed.
The 1.5-second cloud acceptance target and the 5% RSS limit remain.
Measure the extra process start and generation restore for capture after
the early lease frees its slot. Report them beside the net startup gain.
Compare HTTP latency with the matched baseline and its spread. Report an
increase before changing the chosen scheduling policy.

### 8. Bound loss after a failed background reap

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** docs or spec.
- **Location:** `docs/protocol/mokly-sidecar-root-scheduling.md` and `crates/mokly-sidecar/src/pool_return.rs`.
- **Background:** The early lease adds reaps before its base starts and when it ends. A failed reap retires that slot. The return pass also disables later background return.
- **Problem:** The early trigger needs a disable scope. A lasting termination failure can otherwise retire more slots.
- **Impact if no action:** Later preparations can exhaust usable slots and stop JavaScript rendering.
- **Root question:** How much capacity may one termination failure remove through background slot work, and how does Serve report it?
- **Options:**
  - **A.** Use one shared end-and-reap step and one disable latch. The first failed reap of either background path disables early leases and return passes for the pool lifetime. Retire only the affected slot. Report the step diagnostic and the existing disabled warning once. Further base calls wait for usage and use ordinary admission. Effort: Small.
  - **B.** Disable each kind of background work separately. Report diagnostics or choose a separate warning. A lasting cause can cost two slots and stop a two-slot pool. Effort: Small.
  - **C.** Continue later early leases after each failed reap. Keep the return rule and report diagnostics. A lasting cause can retire every slot. Effort: Small.
- **Left out:** Starting in an unreaped slot breaks the process bound. Stopping healthy slots breaks the healthy-slot rule. Reporting maintenance failure in Changes breaks the same-content rule.
- **Wider fix:** A. One shared step owns retirement and the disable latch.
- **Previous examples:** The performance orchestrator's failed-reap B and refinement E in PR #313, dated 2026-11-18.
- **Recommendation:** A. It keeps the rule that one background termination failure costs at most one slot.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-18, under the user's delegation of 2026-11-16.

The performance orchestrator's reason: B can take two slots and C can take
every slot. Either can stop JavaScript rendering. The existing warning needs
no new user text. Keep the completed preparation work. Start no second
preparation and no second early lease. Remaining base work waits for usage
and uses ordinary admission. Runtime call errors keep their existing outcomes.

Options check: `.context/startup-base-overlap/reap-options-check.md`.
It confirms that the shared step also keeps the current preparation's work.
The shared-latch test must show one retired slot and no later return pass or
early lease after a failed early reap.

Workspace orchestrator's documentation placement call of 2026-11-18:
document `review.base-gate-wait` with the core sidecar spans, and link from
the existing timing pointer. The main timing page is at its 250-line cap.
The sidecar page already owns core spans and has room. The options check in
`.context/startup-base-overlap/timing-placement-options-check.md` confirms A.
Renaming the span offers no required benefit. Splitting the timing page
moves unrelated fixture and budget content. Both the stage and reason must
enter the existing diagnostic allowlists.

After the generation-affinity merge on 2026-11-18, the workspace
orchestrator keeps main's ranking section unchanged. The early lease section
moves to the early preparation page, which has room under the protocol cap.
All lease rules and links remain. This is a placement change with no policy
change. The shared failed-reap rule stays on the root scheduling page.

Capture's generation restore uses the diagnostic span
`sidecar.restore-generation` around its actual request. Existing render and
capture spans do not isolate that cost. The timing page owns this span too.
After integrating the compiled bundle cache, the workspace orchestrator
keeps this span on restores of generations and recipes held by the pool.
Disk-cache restore stays inside `catalogue.bundle`. This preserves the
capture-restore measurement without extending the diagnostic scope.

The performance orchestrator's shutdown harness call of 2026-11-18 is A.
Keep the original Unimocks on the test thread until joined workers and
resource owners release their clones. Keep cancellation, join, and no early
error publication assertions. Change no production code for this correction.
The three failures came from test ownership and teardown. The correction
uses the existing mock ownership rules. Run the focused check and ten repeats.

## Milestone 1: Documentation and protocol

Depends on: none

Delegate internal documentation to the docs implementor. Audit the existing
contracts. Correct descriptions of serial background work in the crate READMEs.
Change protocol text only where the authorised timing change requires it.

- [x] Audit Changes status, on-demand background work, base lifetime, and sidecar scheduling requirements against the selected design.
- [x] Update the CLI, server, and comparison README entry points and background descriptions as needed.
- [x] Keep the same published content, current usage, retained-base eligibility, freshness, and bounds in the requirements.

Evidence: `.context/startup-base-overlap/docs-report.md` records the contract audit and Markdown checks.

## Milestone 2: Generation-owned preparation and handover

Depends on: 1

Delegate non-UI implementation and tests to one non-ui implementor. Use one
base preparation path for early preparation and ordinary classification.
Keep a captured base in the existing slot when eligible. Do not add a second capture,
another retry, or repeated work after an unretained result or a preparation error.
Classification waits for usage and checks freshness against completed usage.
A sidecar base pauses before capture. An invalid early base follows the
existing fresh-preparation rule. Transfer early errors and unretained results
once, rather than silently preparing them again.

- [x] Add a preparation boundary that uses the existing preparation, capture, and retention services.
- [x] Start it when the head generation is installed and the base is selected, alongside current usage.
- [x] Pause a sidecar base before capture until usage settles. Let an HTML-only base capture early.
- [x] Acquire one early non-warm or empty slot atomically. Hold it through graph preparation. Yield to HTTP before each call. Exclude capture.
- [x] Reap before the early base starts. Stop and reap it at the pause point, then leave its slot empty. Preserve ordinary replacement paths.
- [x] Share the failed-reap disable latch between early leases and return passes. Preserve prepared work, report once, and test that only one slot is retired.
- [x] Preserve the usual path when a kept base is current, and when early preparation fails or cannot be retained.
- [x] Keep base-ref polling, cancellation, progress, warnings, and accepted-result publication under the generation owner.
- [x] Cancel and join early preparation on a new head, base change, cancellation, and stop.
- [x] Keep cleanup off the next usage pass, with one running or draining preparation and only the newest pending request.
- [x] Add deterministic event-order tests for overlap, capture pause, freshness, reuse, HTTP priority, one early call, one-slot progress, and cancellation by head, base, and stop.
- [x] Preserve the existing pool bound, warm head process, background return, and generation affinity rules.
- [x] Document the early admission wait, generation restore, and early process stop diagnostics with the implementation's names.
- [x] Update the sidecar README entry points and its shared background failure rule.
- [x] Observe assertion failures for new behaviour, then pass every new asynchronous test in ten runs.

Evidence: `.context/startup-base-overlap/implementation-report.md` records the red tests, repeated runs, and test costs.

## Milestone 3: Release evidence

Depends on: 2

Delegate the after measurements to the non-ui implementor. Use the same
fixtures, edits, sampling, and output readers as the baseline. Build the
branch in its own checkout and target directory. Run Cargo builds one at a
time with `CARGO_INCREMENTAL=0`. Check disk and free memory before large builds.

- [ ] Measure first Changes, `serve.background`, CPU, two edits, and process-tree peak RSS on every baseline fixture.
- [ ] Measure HTTP view latency during usage, early gate wait, root switches, and capture's extra process start and generation restore.
- [ ] Report three peak measurements, sampler gaps, kernel high-water cross-checks, and a large React edit during preparation.
- [ ] Record the stress edit latency and its phase on each side.
- [ ] Measure one basic and one large React start with two sidecar slots on each side.
- [ ] Trace exact exec and exit events in a separate run per fixture on each side. Check the live-process bound during overlap.
- [ ] Compare the published Changes bytes with the non-overlap baseline as a one-time proof.
- [ ] Stop and ask the performance orchestrator if RSS rises by more than 5%.
- [ ] Report a gain below one second on the large fixtures before widening the change.

Evidence: `.context/startup-base-overlap/after-report.md` records the before and after table and byte comparison.
The native-main refresh and integration are recorded in
`.context/startup-base-overlap/cache-merge-audit.txt` and the matched baseline report.
The generation-affinity integration is recorded in
`.context/startup-base-overlap/affinity-merge-audit.txt`.
The document placement and preservation check is recorded in
`.context/startup-base-overlap/docs-affinity-integration-report.md`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3

The orchestrator owns the combined gate, review rounds, plan deletion, and
pull request. Use Git 2.45 or later, Git LFS, and pinned Bun. Put a separate
Git tool directory first on PATH so manager fixtures cannot filter Git out.

- [ ] Run targeted Serve, comparison, and pool tests without weakening existing assertions.
- [ ] Run `cargo xtask check --suite repository` and the complete `cargo xtask check` gate.
- [ ] Commit with Conventional Commits and push the branch. Immediately send the implementation SHA to the performance orchestrator for cloud catalogue acceptance.
- [ ] Review the complete diff against `origin/main` after push with the implementation-review skill. Check each finding, apply its fix rule, and complete the two allowed fix rounds as needed.
- [ ] Record follow-up items for every deferred or open finding and every problem outside the review scope.
- [ ] Wait for cloud catalogue acceptance.
- [ ] Delete this plan when all earlier TODOs and review rounds are complete.
- [ ] Open the pull request into `main`. Preserve the dated calls, plan permalink, measurements, and follow-up items in its description. Do not merge.

After the pull request opens, watch final CI through the finish-work
`scripts/ci-wait.sh`. Fix branch failures before the final report.
