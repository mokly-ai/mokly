# Prepare the Serve base during current usage

Status: Active. On branch `calummoore/mokly-startup-base-overlap-rae7`, no pull request yet. The completing pull request deletes this plan.

Serve renders current usage before it prepares the base for Changes. Call 12
narrows this change to cold start, as a last attempt. Every Changes request,
reference check, classification, and reference poll keeps main's inline path
after current usage. Only when the first head needs a sidecar, one separate
startup owner prepares its base beside the first usage. The configuration and
discovery of the base identify its kind. An HTML-only base pauses after
discovery, and the same preparation resumes after usage. No base captures
early. After usage, the task leaves one keyed outcome: a kept base, an unkept
capture, or an error. The ordinary classification takes it once, only with the
same key.
Keep the same published content, base freshness checks, capture bounds, and
sidecar pool bound. Keep the warm head process and background return rules.

The performance orchestrator chose the twelve calls below on 2026-11-18. Some
calls also record design and evidence calls of the workspace orchestrator. On
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

- At cold start with a sidecar head, the serial base preparation after the
  first usage becomes one separate startup task beside that usage. Consumers:
  `UsagePass` starts its owner once for the first head, and the CLI `Source`
  takes its one keyed outcome through `StartupProvider`. The generation-owned
  early preparation of Milestone 2 and its early Changes request are gone.
  `ChangesPass` keeps main's inline path after usage. Static commands keep
  their ordinary single classification path.

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

On 2026-11-18, the after batch on the pushed `4ce1d83cf` stopped during the
second React edit at the 3,000,000 KiB RSS guard. A complete first-edit capture
also failed the deployment-only byte proof. The performance orchestrator then
withdrew acceptance. Call 9 closes the identity cause of the byte failure.
Calls 10 and 11 set the new memory and speed evidence. No pull request opens
before the acceptance evidence passes. The cloud acceptance keeps the 1.5-second target
and the RSS rule above. The performance orchestrator owns the cloud sampling.
The PSS rule of call 10 applies only to the local diagnosis. The analysis is
`.context/startup-base-overlap/control-stage-analysis-and-options.md`.

The call 11 pairs completed on 2026-11-18, and their result blocks acceptance
of that candidate. Call 12 makes a narrowed last attempt. Its clean pairs
replace the call 11 pairs as the local acceptance evidence. They build one
sidecar and viewer asset set from contained main `d4df04aa5` or later. They do
not use the `e60c16532` assets. Their local memory metric is the cgroup demand
of anon plus swap on the same tick, against the paired main. The cloud
remeasurement stays required, and its acceptance belongs to the performance
orchestrator. Under option L of call 12, the same failed acceptance check in
all three pairs of one fixture closes the change under option C. Other results
without acceptance go to the performance orchestrator.

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

The after batch on `4ce1d83cf` stopped on 2026-11-18. Calls 9, 10, and 11
record the later calls of the performance orchestrator on 2026-11-18, under
the user's delegation of 2026-11-16. Calls 10 and 11 keep the text and the
letters of their items in
`.context/startup-base-overlap/control-stage-analysis-and-options.md`.
Call 11 supersedes the early HTML-only capture of call 2 option E and of
Milestone 2. Those records stay unchanged as history.

### 9. Close the edit identity difference

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation. Item 1 of the control-stage analysis.
- **Category:** process.
- **Location:** `docs/protocol/mokly-sidecar-recipes.md:91` and `tests/sidecar_edit_policy.test.ts:138`.
- **Background:** The one-time byte proof compares published Changes with the non-overlap baseline. Its only exception was the per-start root `deploymentId`. An incomplete Serve edit compilation gets a fresh identity at each compile.
- **Problem:** A complete React first-edit capture of `4ce1d83cf` differed at root `comparisonUrl` and `live.generation` of `index.json`. The fresh compilation identity enters these published identity fields.
- **Impact if no action:** The byte proof fails on identity values that main also changes. The candidate then cannot pass the byte requirement.
- **Root question:** How can the byte proof show unchanged Changes when two main binaries publish different identities for the same edit?
- **Options:**
  - **A.** Keep the deployment-only proof. Edit captures then fail on fresh identity values. Effort: Small.
  - **B.** Exclude exactly root `comparisonUrl` and `live.generation` in edit `index.json` captures. Apply this only when contained main `2e6bde9c2` shows the same two differences. Replace only their encoded JSON value tokens. Effort: Medium.
  - **C.** B, plus compare both masked values with their own run's head generation, where that record exists. This adds an internal consistency check to the one-time proof. It is optional evidence beyond the closed call. Effort: Small.
- **Left out:** A wider mask or a reserialized JSON comparison weakens the exact proof. A deterministic identity breaks the fresh-identity requirement for incomplete compilations. A diagnostic seed needs rebuilt binaries. Another edit breaks the fixed workload.
- **Wider fix:** None. The fresh identity is a requirement in force.
- **Previous examples:** The workspace orchestrator's byte proof call above reports `deploymentId` separately.
- **Recommendation:** B. Contained-main edit captures differ from the e60 main captures at the same two fields.
- **Action:** fix now, apply B. Performance orchestrator's conditional call of 2026-11-18. The contained-main control met its condition, so this item is closed.

Startup captures exclude only root `deploymentId`. Edit `index.json` captures
also exclude exactly root `comparisonUrl` and `live.generation`. Every other
byte stays exact, `revision` included. The React second-edit capture of
`4ce1d83cf` is absent, so the complete expected proof stays incomplete.
Records: `.context/startup-base-overlap/identity-proof-conditional-decision.md`
and `.context/startup-base-overlap/authorized-edit-identity-exact-token-proof.json`.
The options check added C. It retained B and the closed identity call.

### 10. Diagnose the React memory stop

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation. Item 2 of the control-stage analysis.
- **Category:** performance.
- **Location:** `.context/startup-base-overlap/after-e60c16532-run1/large-react/run.json` and the saved stop sample in `.context/startup-base-overlap/after-report.md`.
- **Background:** The candidate stopped during its second edit at the original 3,000,000 KiB sum-of-RSS guard. The contained-main control completed the same workload with that guard unchanged. The allowed peak rise remains 5%.
- **Problem:** The candidate recorded 3,295,800 KiB against contained main's 2,295,368 KiB, a 43.6% increase. The stop sample includes a new child with the parent's exact RSS and a blank command. Its later high-water read is 8 KiB.
- **Impact if no action:** The candidate cannot claim the memory requirement or complete its planned after evidence. The PR remains blocked.
- **Root question:** How should this change establish the memory bound before it can ship?
- **Options:**
  - **A.** Limit overlap to sidecar bundle, describe, and graph preparation. Give HTML bases the serial path and permit no early capture. This can reduce HTML startup overlap. React already follows this capture rule, so it does not address the failed second-edit sample. Effort: Medium.
  - **B.** Permit overlap only after measured CPU and memory headroom establishes a safe reserve. Use serial preparation when that evidence is absent. This needs a resource admission policy and validated thresholds. It cannot by itself explain an ordinary second-edit process transition. Effort: Large.
  - **C.** Close the scheduling change and retain the evidence. Consider any independent diagnostic span in a separate change. This drops the potential startup gain and introduces no overlap policy. Effort: Small.
  - **D.** Keep the candidate frozen. Run separate diagnostic React workloads on both binaries with exact fork, exec, and exit tracing. Add shared/private-memory evidence while retaining the original RSS guard as the controlling stop. This can identify the child and its memory accounting. It does not convert the current failed sample into a pass. Effort: Medium.
  - **E.** D, plus count each proved shared address space once beside the raw RSS and PSS sums. Establish shared address spaces from clone flags or `kcmp` with `KCMP_VM`. Keep the raw guard and the closing rule. This needs additional observation support. Effort: Small.
  - **F.** Count a proved shared address space once in the guard, at the same 3,000,000 KiB limit. This changes the controlling guard and needs the performance orchestrator's call. Effort: Small.
  - **G.** Use one cgroup for each diagnostic Serve tree. Record its anonymous and file memory at the same ticks. This avoids a per-process duplicate charge. It needs cgroup delegation and changes the selected metric. Effort: Medium.
- **Left out:** Raising the guard, dropping the sample, or weakening the 5% limit breaks the recorded requirement. Summing individual lifetime high-water values does not measure a concurrent tree peak.
- **Wider fix:** None established. The accounting and ownership cause must be identified before a structural memory change can be justified.
- **Previous examples:** None proved. Ordinary process starts also exist on main, but the contained-main control did not capture the same duplicate-parent observation.
- **Related:** Call 11 shares options A, B, and C. Its option D supplies controlled timing evidence after this diagnosis.
- **Recommendation:** D. Identify the process transition before changing scheduling or resource limits. C is the bounded alternative if further investigation is not wanted.
- **Action:** fix now, apply D with PSS. Performance orchestrator's call of 2026-11-18, under the user's delegation of 2026-11-16.

The performance orchestrator's PSS rules for D:

- Keep `4ce1d83cf` frozen. Run separate diagnostic React workloads on it and on contained main `2e6bde9c2`, with exact fork, exec, and exit tracing.
- Sum `Pss` from `smaps_rollup` over the Serve process tree beside RSS. Record PSS, RSS, and `MemAvailable` at the same sample times.
- The 3,000,000 KiB RSS guard stays the controlling stop.
- Close the memory item on PSS only when the trace proves the fork transition and the candidate PSS tree peak is at most 105% of main. Then report the RSS peak as an artifact.
- When the candidate PSS tree peak is more than 105% of main, stop the dependent runs. Report the process and phase that own the PSS rise to the performance orchestrator. When the causal ownership is unproved, name the limits of the evidence.

The workspace orchestrator gave this meaning of the last rule on 2026-11-18.

Its reason: the stopped new child duplicated the parent's 1,202,276 KiB RSS,
with a blank command and a later high-water mark of 8 KiB. `MemAvailable` fell
only 12,392 KiB. A fork before exec shares pages copy-on-write, so the RSS sum
can count them twice. Both full-tree Git spawns and sidecar spawns fork the
core.

The options check added E to G. It kept D and recommended E as added
evidence. A plain Git spawn can use a shared address space before exec.
That can duplicate PSS as well as RSS. This is a source inference, not a
proved cause of the old sample. The frozen diagnostic records that limit.
E to G add no exception to the authorized PSS rule or raw RSS guard.
Without the required transition evidence, the memory item stays open.
A guard stop remains a stop, including a suspected accounting artifact.

Performance orchestrator's measurement call of 2026-11-18 refines D with E:

- A proved `vfork` or `CLONE_VM` child shares its parent's address space until exec. Its raw RSS and PSS rows can therefore count the same address space twice.
- Prove that shared address space with trace clone flags or live `kcmp` with `KCMP_VM`. Equal memory values alone prove no such relationship.
- Count a proved shared address space once in both arms' RSS and PSS sums, for samples between clone and exec.
- Report raw sums and corrected sums side by side. This corrects accounting and adds no acceptance exception.
- No transition evidence means no memory closure. Any guard stop still stops the run. The corrected PSS peak must stay within 5% of main.

The call does not make an older trace contain clone flags or a past `kcmp`
read. An interval without that evidence stays uncorrected and is reported
with its limit.

The performance orchestrator authorized two extra diagnostic runs under D
on 2026-11-18. Keep the current main run and its audit as a raw baseline.
Add `task:task_newtask` with `clone_flags` to the recorder. Then run the
frozen candidate once and main once more with that same recording. Keep
every guard and the sampler unchanged. These are extra diagnostics, not
retries of a failed acceptance run. Report raw and corrected sums. The
current main recording cannot supply a shared-address-space correction.

The performance orchestrator clarified the reference on 2026-11-18. The
5% comparison uses the matched v2 main run, never v1. Compare raw candidate
PSS with raw v2 main PSS, and corrected candidate PSS with corrected v2
main PSS. Use the same tick rules. Run the v2 candidate and main diagnostics
back to back, with no other work on this machine between them. V1 stays
the raw baseline because the recorders and their observer costs differ.

The performance orchestrator closed the memory item under D on 2026-11-18.
The matched v2 diagnostics satisfy the PSS and raw guard conditions.
The original RSS stop remains unexplained in retrospect.
Shared-address-space Git spawning is its likely mechanism.
No proved shared interval was sampled or deduplicated in the new diagnostics.
The evidence proves sampled sums, not continuous physical peaks.

The performance orchestrator also authorized the unused main workload after
its preflight port probe failed before starting a workload.
The probe repair kept the recorder, sampler, guards, and candidate evidence
unchanged. The failed preflight and its repair stay in the evidence record.

The performance orchestrator accepted the Git-spawn explanation on 2026-11-18.
Earlier Changes requests start the existing reference poll earlier.
The extra processes do not show repeated base preparation.
Make no product change for this cost in this branch.
The performance orchestrator claims
`plans/follow-ups/serve-reference-poll-git-spawns.md` for the performance queue.
Its two directions check reference files cheaply or watch those files.
Both must preserve the exact reference result.

### 11. Give HTML-only bases the serial path

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation. Item 3 of the control-stage analysis.
- **Category:** performance.
- **Location:** The React and HTML stage tables of the control-stage analysis, derived from `.context/startup-base-overlap/after-report.md` and `.context/startup-base-overlap/contained-main-2e6bde9c2-control-stage-peak-job-analysis.json`.
- **Background:** The brief requires edits to stay as fast as main. The first candidate pair showed slower large-fixture startup, HTTP, and edits. The unchanged contained-main control also ran slower than the original e60 baseline.
- **Problem:** HTML startup capture overlaps usage, but both slower HTML edits reuse a base and perform no capture. React first-edit usage dominates its increase despite similar work counts. The available single sequential runs do not isolate the overlap's speed cost.
- **Impact if no action:** Neither an unchanged-edit claim nor an accepted startup gain is proved. A scheduling change could target the wrong stage.
- **Root question:** Which next step can show faster first Changes, with edits and HTTP no slower than main?
- **Options:**
  - **A.** Keep only sidecar early bundle, describe, and graph preparation. Use the serial HTML path and permit no early capture for any base. This removes HTML capture contention but leaves the measured React schedule unchanged. It does not promise faster retained-base edits. Effort: Medium.
  - **B.** Enable overlap only with measured CPU and memory headroom, with a serial fallback. Calibrate the admission evidence and thresholds on both large fixtures. This can avoid constrained machines but adds a new resource policy and still needs edit proof. Effort: Large.
  - **C.** Close the scheduling change. Keep the measurement record and isolate any useful diagnostics for a separate branch. This preserves main's serial scheduling and loses the possible cold-start gain. Effort: Small.
  - **D.** After the memory investigation, run three interleaved main/candidate pairs for large HTML and React. Use the same source pair, frozen assets, original two edits, HTTP request, fresh cache, and unchanged guards. Stop on the first guard failure. This is a new controlled evidence set, not a resumed failed schedule. It may still reject the candidate. Effort: Medium.
  - **E.** Narrow HTML early work to source extraction only. Defer dependency work, validation, graph preparation, and capture until usage settles. Keep the bounded sidecar preparation path. This reduces possible HTML contention and limits its gain to extraction time. It leaves the React and retained-base edit questions open. Effort: Medium.
  - **F.** Keep early HTML capture, but yield to HTTP renders at each batch boundary. Then run D. This keeps capture overlap and its contention with usage. It cannot resolve the retained-base edit cost. Effort: Small, plus D.
  - **G.** If D shows a repeatable edit cost, profile one edit on each binary with a CPU sampler and stage spans. This adds diagnostic runs before a policy decision. Effort: Medium.
  - **H.** Remove only early HTML capture. Keep HTML preparation through graph work early, then pause before capture. Run D. This can keep part of the 2,334 ms pre-capture stage, but graph work can still use shared render workers. Effort: Small, plus D.
- **Left out:** A larger render pool exceeds the selected scope and does not explain retained-base edit cost. F returns the HTTP-only HTML batch check to the alternatives. A new retry or a byte exception beyond the conditional call breaks decisions in force. A kept capture across starts does not fit fresh caches.
- **Wider fix:** None demonstrated. B controls the early admission class, but the measured edit increase occurs with no early base lease.
- **Previous examples:** The historical cloud A/B accepted a usage cost for a startup gain. Its acceptance is withdrawn, and its catalogue differs from these large fixtures.
- **Related:** Call 10 blocks further acceptance. A, B, and C are shared policy choices. D depends on the memory diagnostic choice.
- **Recommendation:** The HTML part of A, then D. The first recommendation was D. The options check retained the selected HTML change and controlled pairs. H is a possible narrower alternative after evidence. C remains the bounded alternative to further investigation.
- **Action:** fix now, apply the HTML part of A, then D. Performance orchestrator's call of 2026-11-18, under the user's delegation of 2026-11-16.

The HTML part of A gives HTML-only bases the serial path and permits no early
capture for any base. Sidecar bases keep their early bundle, describe, and
graph preparation, and they pause before capture. The performance
orchestrator's reason: early HTML capture shared the render workers with
usage, without the HTTP boundary check of usage. An HTML-only base also has no
base bundle, so its early preparation gains little. This is a product change.
Push its SHA for a cloud remeasurement. No pull request opens yet.

The evidence of D, after the memory diagnosis of call 10:

- Run three interleaved pairs of contained main `2e6bde9c2` and the new candidate on each large HTML and React fixture.
- Use the same source pair, assets, two edits, HTTP request, and fresh caches.
- Keep the guards unchanged and add PSS. Stop at the first guard failure.
- Accept when first Changes is no later than main, edits and HTTP are no worse beyond the spread of main, and the PSS peak is at most 105% of main.
- When a repeatable cost remains, stop. Report it for a choice between closing the change and a narrower option.
- Report every pair and the spread of each arm. Keep the acceptance wording literal, and add no statistical pass rule. Only an ambiguous final result may need a later call.

The options check added F to H. The old HTML pre-capture stage took 2,334 ms.
Its identifying reads and later work were not split, so no saving for H is
proved. The cause of the slower kept-base edits also stays unproved.
The unchanged guard still stops D at its first failure. There is no
permission to discard an artifact, retry, or continue an incomplete pair.

Workspace orchestrator's boundary call of 2026-11-18 for the serial HTML path:

- The loaded configuration and discovery of the base itself decide its kind. The kind of the head does not, because the head and the base can differ.
- The base lookup, base reads, configuration, and discovery identify that kind. So they run before the wait, and they are the only early work of an HTML-only base.
- The base reads can reuse a complete cached extraction of the base commit. They never build an extraction. A fresh extraction stays in the dependency step of a sidecar base, after its kind is known.
- The HTML part of A needs these identifying reads. They do not add the fresh HTML extraction of option E.
- An HTML-only base waits as soon as Serve knows that it needs no sidecar. Its dependency-directory selection, HTML dependency check, catalogue validation and preparation, graph preparation, and capture follow usage.
- After usage, the same preparation continues with the same tree, configuration, and inventory. It does not restart.
- Remove the early capture bypass of HTML-only bases, so that no base captures before usage settles.
- Sidecar bases keep their existing early preparation and capture pause.
- The change adds no scheduling policy and no setting.

The options check retained this boundary. Identifying reads use no render
worker or sidecar. The wait holds no base-slot or warnings lock. It keeps
the same tree, configuration, inventory, extraction lease, and preparation
thread. HTML dependency selection reads the fixed head catalogue, so this
deferral follows the serial policy and adds no freshness claim.

Options check record:
`.context/startup-base-overlap/post-measurement-options-check.md`.

Review round 1 of `4ce1d83cf` found one test gap: no test cancels a request
that waits for early admission. Its option C adds that cancellation test. It
also gives the unavailable-slot test an expected-state wait and an independent
cleanup. Both changes are in
`crates/mokly-cli/src/_tests_/serve_early_pool_tests.rs` and change no product
code. The user accepted this test-only fix on 2026-11-18. It commits with the
HTML change of call 11. Record:
`.context/reviews/calummoore/mokly-startup-base-overlap-rae7/findings.md`.

The call 11 pairs completed on 2026-11-18 with a blocking result. Call 12
records the performance orchestrator's last-attempt call of 2026-11-18, under
the user's delegation of 2026-11-16. It keeps the letters of item 3 of
`.context/startup-base-overlap/interleaved-large-blocking-report.md`, and the
text of options B, C, G, and I. Call 12 narrows the early preparation of call 2
option E and of Milestone 2 to cold start. It returns every Changes request to
main's order after usage. Ordinary Changes also regains main's cancel-and-drain
before the next usage. The independent drain of call 5 option C and the
newest-request rule of call 7 now cover only the startup task. Those records
stay unchanged as history.

### 12. Narrow early preparation to cold start

- **Severity:** High. **Effort:** Small for the recommended C.
- **Source:** Implementation. Item 3 of the interleaved large-fixture blocking report, after the controlled pairs of call 11.
- **Category:** performance.
- **Location:** `crates/mokly-server/src/background.rs:105` to line 110, and the paired stage tables and the React pair-3 peak evidence in `.context/startup-base-overlap/interleaved-large-45efa06e6-runs/audit/final-report-v2.md`.
- **Background:** The change seeks faster first Changes while keeping edits and HTTP as fast as main. HTML capture is already serial. Sidecar preparation still overlaps usage.
- **Problem:** HTML startup is later in every pair. React startup is later in two pairs. React pair 3 exceeds the PSS limit. Causal ownership remains incomplete.
- **Impact if no action:** The branch cannot support the required acceptance claim. Opening its pull request would bypass the decision boundary of the performance orchestrator.
- **Root question:** Which remaining scope can justify further work toward faster startup without slower edits or higher memory?
- **Options:**
  - **B.** Keep overlap only with measured CPU and memory headroom, with a serial fallback. It could avoid constrained hosts. No threshold or benefit is proved. It adds a resource policy and requires new validation. Effort: Large.
  - **C.** Close the scheduling change. Retain the measurement records and performance follow-ups. Review any independent diagnostic span separately. This restores main's serial path and loses the cloud cold-start gain. Effort: Small.
  - **E.** Early HTML source extraction only remains an older alternative. It adds fresh work absent from the present HTML path and leaves React unresolved. Effort: Medium.
  - **F.** Restore early HTML capture with HTTP yields. It reintroduces usage contention and leaves retained-base edits and React memory unresolved. Effort: Small, plus measurements.
  - **G.** Authorize matched CPU/scheduler and allocation diagnostics before choosing a product variant. These could separate request-order cost, observer pressure, and retained data. They do not themselves improve the product. Effort: Medium.
  - **H.** Early HTML graph work, with capture deferred, remains an older alternative. It adds work during usage and leaves React unresolved. Effort: Small, plus measurements.
  - **I.** Restore main's request order for proven historical HTML bases and retained-base edits. Keep early cold sidecar preparation. Use conservative serial fallback when historical type is unknown. This removes early Changes work in those serial cases. It preserves possible overlap only where identified. Its gain is unmeasured, and it does not establish a fix for React cold startup or pair-3 PSS. Effort: Medium, plus measurements.
  - **J.** The narrowed I of the Action, as recorded below the item. Every ordinary Changes request, reference check, classification, and poll runs after usage in main's order. One server-owned task starts at Serve start, only when the first head needs a sidecar. A sidecar base prepares bundle, describe, and graph under the early lease. An HTML-only base pauses after discovery. Capture follows usage. Handover uses the ordinary kept-base key and freshness checks. J is a letter for the chosen shape, not a new variant. Cost: a new task owner, a command-owned record, a base-only compare seam, rewritten tests, a cgroup launch adapter, 12 clean runs, and the cloud run. Under the literal rule, its HTML arm passes first Changes in all three pairs only by chance (see K). Effort: Large.
  - **K.** Before Milestone 5 code, record that every clean result without acceptance applies C. This includes a failed check in any pair, a guard stop in either arm, and an incomplete set. Cost: noise alone can close the change. If each HTML pair falls either way with equal chance, and the pairs are independent, all three HTML pairs pass first Changes with a chance of one in eight. A main-arm stop or a raw RSS double count also closes it. Effort: Small.
  - **L.** Before Milestone 5 code, record that the same failed check in all three pairs of one fixture applies C. Every other result without acceptance goes to the performance orchestrator, with every pair and any stop sample, as call 11 D allowed for an ambiguous result. Cost: a likely further decision round in a last attempt. "All three pairs" is a reading of "repeatable" that only the performance orchestrator can confirm. Effort: Small.
  - **M.** Name the byte proof of the clean set in Milestone 6. Compare the clean captures with only the exceptions of call 9. Apply the two edit exceptions only after the `d4df04aa5` main arms show the same two differences among themselves. Otherwise, report before any acceptance claim. Cost: one derivation over captures that the frozen driver already writes. It can show an identity change from PR #316, but `d4df04aa5:docs/protocol/mokly-sidecar-plans.md:93-97` keeps the fresh identity of each edit compile. Effort: Small.
- **Left out:** A, the HTML capture deferral of call 11, is applied and did not satisfy acceptance. D, the interleaved set of call 11, is complete, and an unchanged rerun is no remedy. An HTML-order-only change cannot cover all blockers. A blanket memory correction has no transition proof. Discarding main pair 3 or averaging away its limit changes the acceptance rule. More pairs, an aggregate, or a statistical test for the HTML arm add a statistical pass rule, which the user excluded. An HTML-specific pass, such as a trace proof in place of timing, adds an acceptance exception. Another fixture breaks the fixed workloads of the user's call. A clean rerun of the unchanged `45efa06e6` as acceptance evidence retries a failed acceptance candidate, which calls 10 and 11 forbid. G covers its diagnostic use. A cheaper reference poll stays with `plans/follow-ups/serve-reference-poll-git-spawns.md`, because J moves every poll after usage. A persistent base cache across starts is a separate feature with a new stored format. HTTP priority during an active early lease is no real choice, because the fixed HTTP request ends before the first possible lease. The raw RSS rule of call 6 stays with the reconciliation of Milestone 4.
- **Wider fix:** None proved. B could control constrained-machine admission, but its policy and thresholds remain unvalidated.
- **Previous examples:** The cloud catalogue gains 2.4 seconds cold and 0.45 seconds warm on `45efa06e6`. Its evidence remains valid for that catalogue.
- **Related:** The diagnostic memory closure of call 10 stays closed. The React pair-3 memory result blocked the call 11 candidate. It is now a superseded record and does not block the clean set.
- **Recommendation:** C. No tested narrower variant meets all requirements. If more investigation is wanted, G can support a later choice between B and I.
- **Action:** fix now, apply a narrowed I as the last attempt. When the clean evidence shows a repeatable cost on either fixture, apply C without another variant. Performance orchestrator's call of 2026-11-18, under the user's delegation of 2026-11-16.

The narrowed I has this preferred shape. The options check labels it J. J
names the chosen shape and is not another variant:

- Every Changes request, classification, and one-second reference poll runs after current usage, in main's order, for the whole session.
- Only at cold start, and only when the head catalogue needs a sidecar, Serve starts a separate early base preparation beside startup usage.
- That task runs the base bundle, describe, and graph preparation under the early lease. It captures after usage and fills the kept base slot.
- The later classification, in main's order, reuses that kept base only through the unchanged freshness checks.
- A historical HTML-only base stops its early work after discovery. The kind of the head is only a scheduling guess.
- The early lease, reaped starts and ends, the shared failed-reap latch, HTTP yields, the capture pause, and the pool bound stay.
- Tests show that each edit keeps main's order.

Before any code, the code delegate reports whether this shape is practical.
When it is not, the code delegate first tells the performance orchestrator.
Only then does the fallback apply: the prior I, plus the condition on the kind
of the head. The read-only report of 2026-11-18 found the shape practical. It
reads "stops after discovery" as a pause through usage, so the same HTML
preparation resumes after usage. Report:
`.context/startup-base-overlap/last-attempt-shape-feasibility.md`.
After the merge of main `d4df04aa5`, a refreshed read-only check of the merged
source passed on 2026-11-18. It confirms the same shape and design. Report:
`.context/startup-base-overlap/last-attempt-shape-feasibility-refreshed.md`.

Workspace orchestrator's design call of 2026-11-18 accepts that source
design. The refreshed check of the merged source confirms it:

- Ordinary Changes keeps main's inline order. Usage ends first. Then the Changes request, the reference check, classification, status, terminal progress, and the one-second poll run.
- Ordinary Changes also keeps main's cancel-and-drain. A replacement cancels the ordinary classification, and the next usage starts after it ends. The independent drain below covers only the startup task.
- One cold-start task starts with the usage of the first installed head. The kind of the first head decides only whether it starts. The opportunity is used once.
- One server owner holds the task. It observes replacement and stop apart from usage. A command-owned record carries one keyed outcome: retained, unkept, failed, cancelled, or consumed.
- The task pins the base by itself and prepares through the existing native base path. It holds its warnings and cache notices until the accepted handover.
- A sidecar base prepares through graph preparation under the early lease, which ends and is reaped before capture. An HTML-only base pauses after discovery.
- After usage, the task checks the selected dependency directories, captures, and attempts the normal keep. A stale selection follows the existing one-restart rule.
- After its own usage, the ordinary classifier waits for or takes the matching record before any second preparation. That wait is cancellable.
- A retained outcome passes only through the ordinary kept-base key and freshness checks. An unkept outcome or a keyed error passes once to its originating attempt.
- The post-usage pin stays authoritative. It rejects a moved base, so no reference poll runs before usage.
- A replacement cancels the task at once. The next usage does not wait for its drain. Stop cancels the task and joins it.
- A base-only seam in the comparison crate gives preparation and capture without comparison. No early call reaches classification.
- The early lease and the pool policy stay unchanged.

The clean evidence replaces the old instrumented acceptance pairs:

- Run three interleaved pairs on each large HTML and React fixture, in the rotation of call 11. Use the original two edits, the HTTP request, and fresh caches.
- Compare the new candidate with the main commit that it contains, at `d4df04aa5` or later.
- Build the sidecar and viewer assets once from that contained main. Use that one asset set in both arms. Record its source commit and digests in the evidence.
- Timing runs use no PSS reader and no clone recorder. Read `/proc/PID/status` each second.
- Each timing run has an exclusive CPU grant. No other work runs on the machine during the clean set.
- The 3,000,000 KiB raw RSS guard and the 1,000,000 KiB `MemAvailable` floor stay. Stop at the first guard failure.
- Run the Serve tree of each arm in its own cgroup, through `systemd-run --user --scope`. Each second, sample `memory.current`, the `anon` and `file` values of `memory.stat`, and `memory.swap.current`.
- The memory demand of an arm is its peak of anon plus swap, both read on the same tick. It must be at most 105% of the peak of the paired main.
- The cgroup preflight passed, so the PSS plus `SwapPss` fallback is not adopted. Record: `.context/startup-base-overlap/clean-last-attempt/feasibility-v2.md`.
- Accept only when first Changes is equal to the paired main or faster on both fixtures. Edits and HTTP must be no worse beyond the spread of main. The memory demand must be at most 105% of the paired main.
- The cloud remeasurement of the new candidate is also required. Its acceptance belongs to the performance orchestrator.
- A repeatable cost applies C, as option L below defines it. Keep the records and the follow-ups. Start no further variant.
- The clean set needs no comparability with the old pairs. The old instrumented pairs stay as superseded records. Old pair 3 is one of them and does not block the clean set.

The first wording of call 12 kept the frozen `e60c16532` assets for the clean
pairs. The performance orchestrator corrected it on 2026-11-18, before any
clean run. Its reason: a core with PR #316 and PR #319 beside the old sidecar
assets is an unsupported and unproved mix. The shipped edit plans of PR #316
and bundle cuts of PR #319 must be active in both arms.

Measurement findings behind call 12. They do not change an earlier result:

- In each React pair, the arm with the slower first Changes and slower edits also spent more CPU in the PSS reader. This held also in the pair where main was slower. HTTP did not follow this pattern in pairs 1 and 3.
- A PSS walk of a shared-address-space child can traverse the whole memory of the core. The earlier reference poll adds such children during usage.
- So observer cost can explain part of the slower timing. This stays a hypothesis.
- At the PSS-peak sample of each arm of old pair 3, main's core had swapped memory, and the candidate's core had none. PSS plus swap at those two samples is within the 5% limit. No record derives a peak of PSS plus swap over all samples.
- This explains the demand metric of anon plus swap. The failed PSS result of pair 3 stays recorded as failed. It is a superseded result and does not block the clean set.
- The cloud run of `45efa06e6` gained more cold-start time than the 1.5-second target, with equal edits.

Record: `.context/startup-base-overlap/call-12-docs-report.md`.

Options check: `.context/startup-base-overlap/call-12-options-check.md`. It
kept the Recommendation C and the Action. It labelled the chosen shape J,
brought back E, F, and H as options, and added K, L, and M. It found seven
text problems in this record, which the text above now corrects. It also notes
an inference: under the literal per-pair rule, the HTML arm of J passes first
Changes in all three pairs only by chance, because J leaves HTML on main's
schedule.

Performance orchestrator's call of 2026-11-18, under the user's delegation of
2026-11-16: L, with a memory addition.

- Close under C when the same acceptance check fails in all three pairs of one fixture.
- Report every other result without acceptance: a single later pair, an incomplete set, or a guard stop of a main arm. Include every pair, the stage split, and any stop sample.
- Keep the branch stopped while the performance orchestrator decides. Run no retry and no new variant.
- The memory addition: a guard stop of a candidate arm closes under C at once, unless the main arm of the same pair also stopped. Then report. An immediate stop does not authorize another arm run to get that comparison.
- Cloud acceptance belongs to the performance orchestrator.
- For HTML, traces must prove no early task and a Changes order equal to main. Its timing uses the same L rule.

Its reason: the earlier main React arms spread 81 seconds in first Changes, so
one later pair can be noise. K would close the change on noise. L keeps the
repeatable-cost trigger and an explicit decision for an ambiguous result.

The performance orchestrator also approved M on 2026-11-18:

- Apply only the exceptions of call 9.
- Before using the two edit identity fields, revalidate them among the new contained-main captures.
- Startup excludes only `deploymentId`. Every other edit field stays exact.
- Use the captures that the frozen workload already writes. Run no extra workload.

The performance orchestrator approved the safe text corrections of the options
check. It releases the clean measurements when the implementation and its
checks are ready. Send the new SHA and the asset commit for the cloud run.

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

## Milestone 3: Serial HTML-only base path

Depends on: 2

Apply call 11 with its boundary call. Delegate the non-UI implementation and
tests to one non-ui implementor. Delegate the internal docs to the docs
implementor. Change no preparation, lease, or pause rule of sidecar bases.
Commit the accepted test-only review fix with this change.

- [x] Identify the kind of the base from its own loaded configuration and discovery, never from the head.
- [x] Hold an HTML-only base as soon as its kind is known. Run its dependency selection, validation, graph preparation, and capture after usage.
- [x] Continue the same preparation after usage with the same tree, configuration, and inventory. Do not restart it.
- [x] Remove the early capture bypass of HTML-only bases, so that no base captures during usage.
- [x] Add deterministic tests for the HTML-only wait, capture after usage, a head and a base of different kinds, and cancellation during the wait.
- [x] Observe assertion failures for the new behaviour, then pass every new asynchronous test in ten runs. Keep synchronous `NativeBase` tests synchronous. They need no repeated runs.
- [x] Update the early preparation protocol page and the CLI README entry points with the implementation's names.
- [x] Run the focused tests and `cargo xtask check --suite repository`.
- [x] Commit the HTML change and the accepted test-only review fix together. Push the branch, then send the new SHA to the performance orchestrator for the cloud remeasurement.

Evidence: `.context/startup-base-overlap/html-serial-docs-report.md` records the docs change.
Evidence: `.context/startup-base-overlap/html-serial-validation-report.md` and `.context/startup-base-overlap/html-serial-repository-summary.json` record the Rust checks and the combined repository suite.

## Milestone 4: Release evidence

Depends on: 2, 3

Delegate the after measurements to the non-ui implementor. Use the same
fixtures, edits, sampling, and output readers as the baseline. Build the
branch in its own checkout and target directory. Run Cargo builds one at a
time with `CARGO_INCREMENTAL=0`. Check disk and free memory before large builds.
The memory diagnosis of call 10 runs on the frozen `4ce1d83cf` and contained
main `2e6bde9c2`. The timing pairs of call 11 run on the Milestone 3 candidate
after that diagnosis. They are a new evidence set, not a resumed after batch.
Each byte proof uses only the exceptions of call 9. The earlier TODOs of this
milestone stay open. The remaining required evidence is reconciled after the
clean result of Milestone 6.

- [ ] Measure first Changes, `serve.background`, CPU, two edits, and process-tree peak RSS on every baseline fixture.
- [ ] Measure HTTP view latency during usage, early gate wait, root switches, and capture's extra process start and generation restore.
- [ ] Report three peak measurements, sampler gaps, kernel high-water cross-checks, and a large React edit during preparation.
- [ ] Record the stress edit latency and its phase on each side.
- [ ] Measure one basic and one large React start with two sidecar slots on each side.
- [ ] Trace exact exec and exit events in a separate run per fixture on each side. Check the live-process bound during overlap.
- [ ] Compare the published Changes bytes with the non-overlap baseline as a one-time proof.
- [ ] Stop and ask the performance orchestrator if RSS rises by more than 5%.
- [ ] Report a gain below one second on the large fixtures before widening the change.
- [x] Run the React memory diagnosis of call 10 on both binaries, with exact fork, exec, and exit tracing.
- [x] Sum the tree PSS beside RSS, and record `MemAvailable` at the same sample times. Keep the 3,000,000 KiB RSS guard as the controlling stop.
- [x] Close the memory item on PSS only when the trace proves the fork transition and the candidate PSS tree peak is at most 105% of main. Otherwise stop and report.
- [x] Count the excess Git spawns by phase on both arms. Identify their call sites and repeated work before choosing a product change.
- [x] Run the three interleaved pairs of call 11 on each large HTML and React fixture. Stop at the first guard failure.
- [x] Check first Changes, edits, HTTP, and PSS against the acceptance of call 11. Report every pair and the spread of each arm. Stop and report a repeatable cost.

The call 11 schedule and audit completed. The startup and PSS evidence blocks
acceptance. The full report answers the HTML request-order and React peak-owner
questions. No product change follows from that analysis. Call 12 then chose a
narrowed last attempt. The clean set of Milestone 6 replaces the call 11 pairs
as acceptance evidence. The call 11 pairs stay as superseded records. The
earlier diagnostic memory closure of call 10 stays closed.

The checked TODOs above stay as history. Every unchecked TODO above stays
open. They include the basic fixture, the stress edit, the two-slot starts,
and the exact exec and exit runs of call 7 option G. Milestone 6 reconciles
them with the clean result. Call 12 waives none of them.

Evidence: `.context/startup-base-overlap/after-report.md` records the before and after table and byte comparison.
Evidence: `.context/startup-base-overlap/memory-diag-v2-pair-report/final-report.md` records the closed memory item, transition proof, limits, and preserved preflight repair.
Evidence: `.context/startup-base-overlap/git-spawn-investigation/report.md` records the phase counts, source-supported attribution, and its limits.
Evidence: `.context/startup-base-overlap/interleaved-large-blocking-report.md` records the complete pair report and the remaining policy choice.
Evidence: `.context/startup-base-overlap/interleaved-large-45efa06e6-runs/audit/final-report-v2.md` records the paired values, both arms' spreads, coverage, observer cost, byte proof, and peak owners.
The native-main refresh and integration are recorded in
`.context/startup-base-overlap/cache-merge-audit.txt` and the matched baseline report.
The generation-affinity integration is recorded in
`.context/startup-base-overlap/affinity-merge-audit.txt`.
The document placement and preservation check is recorded in
`.context/startup-base-overlap/docs-affinity-integration-report.md`.

## Milestone 5: Narrowed cold-start preparation

Depends on: 3

Apply call 12 and its design call. Delegate the refreshed feasibility check,
then the non-UI implementation and tests, to one non-ui implementor. Delegate
the internal docs to the docs implementor after the refreshed check. Keep
every rule that call 12 keeps.

- [x] Report whether the preferred shape of call 12 is practical, before any code change. When it is not, tell the performance orchestrator before the fallback.
- [x] After the main merge at `d4df04aa5` or later, refresh the feasibility check on the merged source before any code change.
- [x] Write each new test first. Observe its assertion failure before the implementation.
- [x] Restore main's inline order for every ordinary Changes request, reference check, classification, status, terminal progress, and one-second poll. Restore main's cancel-and-drain of the ordinary classification before the next usage.
- [x] Start one cold-start task with the usage of the first installed head, only when that head needs a sidecar. Use the opportunity once.
- [x] Give the task one server owner and one command-owned record with a single keyed outcome. Hold its warnings and cache notices until the accepted handover.
- [x] Prepare a sidecar base through graph preparation under the early lease. Pause an HTML-only base after discovery. Capture only after usage.
- [x] Hand over through the ordinary classifier after usage, with a cancellable wait. Keep the kept-base key and freshness checks, and pass an unkept outcome or an error once.
- [x] Cancel the task at once on a replacement, without a wait in the next usage. Join it at stop.
- [x] Keep the early lease, reaped starts and ends, the shared failed-reap latch, HTTP yields, the capture pause, and the pool bound.
- [x] Add a base-only preparation seam in the comparison crate. Make no early call to classification.
- [x] Add deterministic tests for the main-order edit, the replaced startup drain, the cold-start handover, an HTML base under a sidecar head, failed and unkept outcomes, and a stale or moved outcome.
- [x] Change the existing tests that expect Changes before usage to main's order. Keep their warning and error guarantees at the new handover.
- [x] Pass every new asynchronous test in ten runs. Keep synchronous tests synchronous.
- [x] Update the protocol pages and the READMEs after the refreshed check. In the timing page, separate the review spans of the startup task, which have no `changes.classify` parent.
- [x] Update the summary and the replaced ways of this plan with the confirmed flow.
- [x] Hold retained startup warnings and the cache notice until ordinary freshness accepts the base. Drop them on a miss or error. Add a regression test through the startup provider.
- [x] Run the focused tests and `cargo xtask check --suite repository`.
- [x] Replace the helper-only startup eligibility test with the real startup hook and an unused-record assertion after rejection. Preserve production code. Prove both guard removal and registration-before-rejection fail on assertions.
- [x] Commit and push the change. Send the new SHA and the asset commit to the performance orchestrator for the required cloud remeasurement.

Evidence: `.context/startup-base-overlap/last-attempt-implementation-report.md` records the implementation, assertion failures, ownership fixes, focused checks, and repeats.
Evidence: `.context/startup-base-overlap/call-12-final-docs-report.md` records the final protocol and entry-point alignment.
Evidence: `.context/startup-base-overlap/call-12-finding-2-check.md` records the confirmed test gap and the chosen test-only option D.
Evidence: `.context/startup-base-overlap/finding-2-fix/report.md` records the real-hook regression test, both assertion failures, byte-exact production restoration, and focused checks.
Evidence: `.context/startup-base-overlap/call-12-cloud-acceptance-2c28d9677.md` records cloud acceptance of the narrowed candidate. The final merged SHA still needs the confirming pair.
Evidence: `.context/startup-base-overlap/retained-diagnostics-implementation-report.md`, `call-12-repository-after-diagnostics-summary.json`, and `call-12-smoke/root-command-result-v3.json` record the final handover correction, combined checks, and feature smoke.

## Milestone 6: Clean release evidence

Depends on: 5

Delegate the clean measurements to the non-ui implementor. Call 12 replaces
the old instrumented acceptance pairs of call 11 with this set. Each pair
compares the Milestone 5 candidate with the main commit that it contains, at
`d4df04aa5` or later. Follow the build rules of Milestone 4. The clean set
needs no comparability with the old pairs. Options L and M of call 12 decide
the outcome rules and the byte proof.

- [x] Build the sidecar and viewer assets once from the contained main. Use that one asset set in both arms. Record its source commit and digests.
- [ ] Run three interleaved pairs on each large HTML and React fixture, in the rotation of call 11. Use the original two edits, the HTTP request, and fresh caches.
- [ ] Run with no PSS reader and no clone recorder. Read `/proc/PID/status` each second.
- [ ] Give each timing run an exclusive CPU grant. Run no other work on the machine during the clean set.
- [ ] Keep the 3,000,000 KiB raw RSS guard and the 1,000,000 KiB `MemAvailable` floor. Stop at the first guard failure.
- [ ] Run the Serve tree of each arm in its own cgroup through `systemd-run --user --scope`. Sample `memory.current`, the `anon` and `file` values of `memory.stat`, and `memory.swap.current` each second. Read anon and swap on the same tick.
- [ ] Use only the cgroup demand metric. The preflight passed, so adopt no PSS plus `SwapPss` fallback.
- [ ] Check first Changes and the memory demand against the paired main, and edits and HTTP against the spread of main, under the acceptance of call 12. Report every pair and the spread of each arm.
- [ ] For the HTML fixture, prove from the traces that no early task ran and that the Changes order equals main. Judge its timing under the same L rule.
- [ ] Derive the byte proof from the captures that the frozen workload already writes. First revalidate the two edit identity fields of call 9 among the new contained-main captures. Exclude only `deploymentId` at startup, and keep every other edit field exact.
- [ ] Apply C when the same acceptance check fails in all three pairs of one fixture. Apply C at once after a guard stop of a candidate arm, unless the main arm of the same pair also stopped. Keep the records and the follow-ups. Start no further variant.
- [ ] Report every other result without acceptance, with every pair, the stage split, and any stop sample. Keep the branch stopped until the performance orchestrator decides.
- [ ] Reconcile each open TODO of Milestone 4 with the clean result. Waive none without an explicit call.

## Milestone 7: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5, 6

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
