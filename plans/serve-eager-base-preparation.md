# Prepare the Serve base before head usage completes

Status: Active. On branch `calummoore/mokly-eager-base-preparation-5dkn`, no pull request yet. The pull request that completes the work deletes this plan.

Serve currently waits for the complete head usage pass before it prepares the base catalogue.
This change moves independent base preparation into head startup and head usage.
Base capture, comparison, and publication still require completed head usage.

The performance orchestrator owns the acceptance measurements and every merge.
The initial target was a cold first Changes gain of at least 1.5 seconds on `mokly-cloud`.
The warm restart target is at least 0.5 seconds.
On 2026-11-21 the performance orchestrator accepted Ready-only with a 0.72-second cold gain.
It chose readiness and first-edit safety over the larger cold gain of the rejected bundle-end bound.
The accepted warm gains are 0.65 seconds for one-line rounds and 0.54 seconds for unchanged rounds.
The means come from interleaved rounds against the control.
The targets of 2026-11-20 named `main` as the control.
On 2026-11-21 the performance orchestrator set the frozen step 1 runtime `fb8b20f77` as the control of this stacked round.
After the step 1 merge at 03:10 UTC, the control is core and dist built from main `77021d88c`.
The initial targets permit no readiness, head usage, or edit regression beyond noise.
On 2026-11-21 the performance orchestrator accepted a repeatable warm readiness cost of 65 to 79 milliseconds.
It also accepted the confirming warm unchanged gain of 0.33 seconds below the initial 0.5-second target.
Edits remain unchanged in that confirmation.
The whole-process-tree peak of cold ten-edit sessions must remain within 2% of the control.
Every published byte must remain equal on all four required fixtures.

## Authority and implementation hold

The task message of 2026-11-20 authorizes this approach and its ordering protocol change.
On 2026-11-20 it held product code until the performance orchestrator confirmed that step 1 had merged.
Step 1 is the miss-first base capture change from workspace 193.
It changes `changes_base.rs`, `base_render.rs`, `base_classification.rs`, and graph collection.
The baseline source audit used `cb233fb50af71725ed464bfb1df08ab5463c5280`.
The performance orchestrator accepted owner 1C, phases 2B, and admission 3B on 2026-11-20 under the user's delegation.

On 2026-11-21 the performance orchestrator authorized stacked implementation before the step 1 merge.
This replaces the hold of 2026-11-20. Red tests and product code start on the stacked branch.
The branch merged the frozen step 1 runtime `fb8b20f77d65642602f773e322ee5e6e9846a27f` once.
The local merge is `32852f553271c2b263d7c47c72af565699386aef`, and its remerge audit is clean.
That frozen runtime contains main `cb233fb50`. The branch already held main `1a5d2b241`.
`origin/main` `e69db4ce8` also holds the sidecar-only #448. The branch does not merge it yet.
Take no later step 1 commit by hand.
When the performance orchestrator reports that step 1 has merged, merge `origin/main` once more and audit it.
Open no pull request before that signal.
The performance orchestrator owns every merge and the cloud speed and memory acceptance.
The recheck of the stacked source on 2026-11-21 kept the dependency boundary, the kept-base rules, and the test seams.
It found one new boundary: step 1 starts early base renders inside base preparation, as the next section says.

At 03:10 UTC on 2026-11-21, the performance orchestrator confirmed that step 1 merged in PR #452 as `77021d88c`.
The branch then merged `origin/main` once at `068ba0629d0570e753ef360d243fab364649d671`.
The merge has two parents and no remerge diff.
It keeps the wire types and plan reuse changes of #449 and #450.
The eager code changes none of those wire types.
The branch removes the inherited step 1 plan, which its completed pull request already removed from main.
Rerun the targeted tests and the repository suite on this merged tree.
Use the new main control and matching dist for local measurements and byte proof.
Open the pull request only after the performance orchestrator accepts the candidate.

Contract owners:

- [Eager base preparation](../docs/protocol/mokly-eager-base-preparation.md).
- [On-demand Serve](../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
- [Base preparation](../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md#claims).
- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Comparison package selection](../docs/protocol/mokly-comparison-packages.md).
- [Terminal comparison steps](../docs/protocol/mokly-terminal-steps.md).
- [Changes state](../docs/protocol/mokly-changes.md).
- [Review timing records](../docs/protocol/mokly-review-timings.md).
- [CLI crate](../crates/mokly-cli/README.md) and [comparison crate](../crates/mokly-compare/README.md).

## Current sequence and data dependencies

`ServeServices::new` resolves the working configuration and creates one shared sidecar pool.
`entry_serve::run` then calls `serve_preparation::initial`.
That call prepares the head catalogue and graph and adopts the watcher inputs.
`serve_delivery::states` creates the Changes source and its single shared `BaseSlot`.
The command creates its snapshot, binds the server, and reports `serve.ready`.
It then starts `UsagePass::run` from `entry_serve`.

`UsagePass::fill_window` renders or restores every head view and publishes completed usage.
Only then does `AfterUsage::run`, implemented by `ChangesPass`, start Changes.
`ChangesPass` probes the Git references and runs `Source::classify_native`.
`Changes::classify_base` pins the merge base and checks for a kept base.
On a miss, it creates historical sources and calls `NativeBase::prepare`.
It immediately captures that prepared generation, keeps eligible bases, compares, and publishes.

Step 1 starts early base renders inside `NativeBase::prepare`.
After graph preparation, the default `BaseRenderAdmission::admit` calls `prefetch_comparison`.
Serve uses `ImmediateBaseRenders`, and `PreparedBase` carries `prefetch: Option<PrefetchGuard>`.
Eager preparation stops before that admission, not only before `capture_base`.
No base prefetch, render callback, or capture runs before head usage completes.
Validation and graph preparation can still read catalogue and graph metadata.
After adoption, keep the step 1 prefetch guard, admission, miss-first capture, and early render lifetime unchanged.

The independent work includes pinned Git sources, extraction, and historical configuration discovery.
It also includes dependency identity reads, dependency selection, and catalogue validation when their head inputs exist.
Base validation includes its bundle, stylesheet class maps, description, and model validation.
The base graph can be prepared before document capture.
It uses the same current Mokly version and the existing source and dependency policies.

The head graph is not required to read or extract the pinned historical sources.
Dependency tier selection does need the working manifests, lockfiles, and actual dependency directory evidence.
The runtime records that evidence during describe, class maps, PostCSS, and the graph's stylesheet roots.
The general safe boundary is the final adopted head preparation, after the watcher recheck and adoption.
The end of the head bundle is too early.
Document usage adds no new dependency roots after the adopted preparation.
An evicted stylesheet can compile again from the same roots.
HTML dependency warnings use `head.catalogue().dependency_directories` after graph preparation.
Do not assume an empty or partial dependency list equals the final list.
Do not change a tier, a warning, or an install decision to permit overlap.
Base capture, head usage attribution, and comparison require the settled head usage and stay after it.

Start independent source work when the working configuration of its preparation attempt validates.
Pin the base, sample checkout settings, create historical sources, and try an existing extraction lease.
Load the base configuration and discover sources before building an extraction that the base needs.
An HTML base without a renderer or PostCSS still builds no extraction and starts no sidecar.
Clean dependency identity reads can follow extraction.
In the first candidate, selection, installation, validation, and graph preparation wait for adopted head evidence.

## Retained inputs and cancellation

The kept key contains the merge-base commit, the adopted resolved configuration, and effective install scripts.
`ServeBase::find_kept` checks that key and the existing freshness evidence before reuse.
Freshness covers working dependency inputs, install records, module overlap digests, and checkout settings.
Keep all of those checks and their existing limits.
Do not capture an eligible kept base again or publish a new `preparing` state for its reuse.

`KeptBase` owns its capture, graph, source failure record, and preparation evidence.
The graph retains the bundle and PostCSS contexts.
`BaseSide` retains extraction and dependency leases.
The base services initially observe command, generation, and selected capture cancellation through `PreparingBase`.
The keep commits under the preparing generation's publication guard.
Only then does `PreparingBase::detach` leave the base owned by the command stop.
Each later reader checks its own cancellation before a base call.
An admitted call on that kept base can finish after its reader is cancelled.

An eager preparation is pending work, not a kept capture.
It remains attached to the originating head attempt until the normal successful capture and keep.
A replacement cancels uncaptured work and joins its task before releasing process and lease owners.
A command stop cancels both pending and kept work and drains Git and sidecar work under existing rules.
A new key discards the pending result and releases the old kept identity before a new preparation.

Clarification of 2026-11-21, a root call under the existing classification-release rule and the unchanged-status inventory:
The normal post-usage classification keeps an existing kept base and its freshness decision.
Eager work never releases a kept base. The plan chose no earlier release point.
With the kept key, eager work does no base configuration or source work after the pin.
With another key, eager work can run the source phase.
It runs no dependency or graph phase until the classification releases the old base.
A first start without a kept base keeps the full eager work.
This avoids repeated preparation on ordinary kept reuse and keeps the reuse and status states of an edit and its revert.
Adoption still rechecks the exact key, head dependency evidence, and working inputs.

A failed Git ref lookup preserves the existing kept base.
Late results carry both the originating generation and pinned key.
Only that current generation can consume or publish them.
Release compares the exact retained identity, so late cleanup cannot clear a newer base.
Retain no extra historical graph after the normal capture adopts or rejects its preparation.

## Design calls and options

All options keep the four-fixture byte contract, the one shared capacity budget, and existing cancellation and retention rules.
These are requirements from the task and the linked protocol contracts.
The task also requires a separate base sidecar and head priority.
The choices below are agent calls within that authority unless the options check exposes a new requirement.

### 1. Keep eager work owned by its head attempt

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** code structure.
- **Location:** `Source`, `ServeBase`, `PreparingBase`, and Serve shutdown and replacement.
- **Background:** A kept base survives cancelled readers only after successful capture and an eligible keep. Pending preparation has no such retention promise.
- **Problem:** A detached eager task could outlive its head and publish or retain inputs from a superseded state.
- **Impact if no action:** Stale Changes or leaked source leases can follow an edit, ref move, or shutdown.
- **Root question:** Who owns prepared base work until the current head can use it?
- **Options:**
  - **A.** Keep one attempt-owned task and typed result. Cancel pending work on replacement and adopt it through the existing capture and keep. Effort: Medium.
  - **B.** Extend the global kept slot with uncaptured states and give each reader its own lease. This widens the retained-base state machine. Effort: Large.
  - **C.** Let the usage pass own one typed handle for its origin snapshot. Move the startup attempt into it. Cancel and join through existing replacement and stop checks. Effort: Medium.
  - **D.** Fill the source cache before readiness and drop the lease. Start in-memory work after readiness. This repeats cheap reads and prevents the early equal-identity option. Effort: Medium.
- **Left out:** A free-standing cache of prepared graphs violates the kept-base limit. Unconditional detach changes the cancellation contract. These leave only two compatible owners.
- **Wider fix:** C. One owned handle and the existing origin checks reject a superseded result.
- **Previous examples:** `Keep::apply` already fences detach and retention with the preparing generation's commit guard.
- **Recommendation:** C, changed from A by the options check. The usage and Changes passes already receive replacement and stop signals for each origin.
- **Action:** Agent call, 2026-11-20. Apply C without changing successful capture, retention, or detached-reader rules.

The startup attempt owns the task until state creation moves it into the origin's typed handle.
The usage pass starts its post-adoption phase and joins it before classification consumes the result.
Replacement and shutdown cancel and join the thread, Git work, installations, and cache work before releasing owners.
Dropping a change source is not the cancellation or join mechanism.
Pending work publishes no status, warning, terminal step, or error.
Keep its status, step, and diagnostic events in one ordered record.
Current post-usage classification replays that record through the normal publication guard and reporting paths.
Keep the existing event order, text, deduplication, and cancelled-attempt suppression.
Do not replace the record with only its latest step.
Clarification of 2026-11-21: an existing kept base stays with the post-usage classification, as [Retained inputs and cancellation](#retained-inputs-and-cancellation) says.

### 2. Prepare independently before head usage completes

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `entry_serve`, `UsagePass`, `Source`, and `Changes::classify_base`.
- **Terms:** The head is the working catalogue. The base is the catalogue at the pinned merge-base commit.
- **Background:** The current classifier combines base preparation, capture, and comparison in one call. Only the latter work needs completed head usage.
- **Problem:** Base validation starts after the head usage pass. Its cost remains on the first Changes path, including a cache hit.
- **Impact if no action:** The measured cold and warm preparation costs remain serial.
- **Root question:** How can the first Changes arrive sooner without delaying head work or changing its result?
- **Options:**
  - **A.** Start all base preparation after readiness, beside head usage. This is simple but loses startup overlap. Effort: Medium.
  - **B.** Split preparation from capture. Start pinned source work during head startup. Start validation when its exact dependency inputs exist. Join only after head usage. Effort: Medium.
  - **C.** Run an independent full comparison pipeline beside the head. This needs a second capture and publication coordination path. Effort: Large.
  - **D.** Start early work for the first head only. Replacement heads and ref refreshes keep the serial path. An edit during startup loses that session's gain. Effort: Medium.
  - **E.** For equal clean dependency identities, validate early against the invariant working dependency root. Finalize tier, warnings, selection, and freshness after head adoption. Effort: Large.
- **Left out:** Serial preparation fails the requested gain. Capture before completed head usage violates the task. Placeholder head data can change dependency selection.
- **Wider fix:** B. A typed prepared-base result separates work that needs head usage from work that does not.
- **Previous examples:** `PreparedBase` already separates graph preparation from capture. Step 1 will further change this boundary.
- **Recommendation:** B, unchanged by the options check. Use the adopted head boundary. Keep dependency resolution separate from classification so E remains possible without another base compile.
- **Action:** Agent call, 2026-11-20. Apply B after the merge signal and options check.

Option E uses no placeholder head evidence.
For equal clean identities, both working dependencies and the unmapped fallback resolve through the same working root.
Only the tier, warning, selection, and freshness need head adoption.
Tier-two and HTML bases still wait.
Changed working identities invalidate the pending result before consumption.
This needs resolution data separate from the warnings that describe and graph preparation currently read.
It can repeat stylesheet work that the normal base borrows from the finished head.
Escalate to E only if the first candidate misses the cold target and the performance orchestrator accepts the wider implementation.

### 3. Admit eager work from spare shared capacity

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `serve_pool`, `serve_gate`, and shared pool admission and source root selection.
- **Terms:** A claim holds one sidecar call's place in the memory-permitted pool capacity.
- **Background:** The current gate waits for every active head request before it admits a base call. That rule prevents useful startup overlap.
- **Problem:** Eager work needs a second sidecar without removing head priority or multiplying the pool's memory budget.
- **Impact if no action:** The new task either waits until too late or competes with head work without a bound.
- **Root question:** How can early base work use resources left by the head while readiness, HTTP renders, head usage, and edits keep their speed?
- **Options:**
  - **A.** Start eager calls through the current base gate. This preserves admission but can serialize them behind the head pass. Effort: Small.
  - **B.** Add bounded eager admission to the shared pool. Permit one eager sidecar call at a time when a separate slot fits. Queued head calls go first. Effort: Medium.
  - **C.** Create a separate base pool with a common admission owner and explicit head reservation. This needs cross-pool claims and cleanup. Effort: Large.
  - **D.** Start the eager process tree at a lower OS CPU priority, with shared admission. It cannot necessarily raise priority before process replacement. Effort: Medium.
  - **E.** Admit eager sidecar work after the head pass dispatches its last view, with no HTTP render and capacity of at least two. This can miss the cold target. Effort: Small.
- **Left out:** A second unaccounted pool breaks the memory contract. Increasing the configured pool size changes the user's limit. CPU sampling delays add a new scheduling policy.
- **Wider fix:** B. One role-aware admission owner can preserve the existing budget and ordering across the eager and capture phases.
- **Previous examples:** Existing per-call claims prevent queued base calls from bypassing later foreground work.
- **Recommendation:** B, unchanged by the options check. Preserve shared claims and use the precise rules below. E is the first fallback.
- **Action:** Agent call, 2026-11-20. Apply B subject to the measured readiness, head usage, and memory limits.

Admit at most one eager call at a time.
Check its owner cancellation, claim, and eligible slot together in the pool.
Admit it only with no queued head call and no active whole HTTP render.
Count whole HTTP leases separately from the existing counter of all head calls.
Use only an empty slot or an idle process in the base root.
Never replace the warm head process for eager work.
Replace no other head process while the head pass has views left to dispatch.
At capacity one, defer the sidecar phase to the existing serial path.
Use E at capacities two and three unless measurements prove B preserves head throughput there.
An active call finishes under existing deadlines.
Cancellation wakes an eager admission wait without a new timer.
One call does not bound CPU because its Node and esbuild processes both run.
Add no render workers and keep base stylesheet work serial.
Measure B before choosing a new CPU policy.
Use E when overlap slows the head or exceeds the memory bound.
If that gate loses the required gain, raise D and the early equal-identity option with the performance orchestrator.
Do not change OS priority or weaken a target before that decision.
Measure each head phase, queue behavior, and the combined process tree.
If startup overlap exceeds a bound, narrow admission by a work phase or resource bound.
Do not hide a readiness or usage regression inside a faster total Changes time.

## Protocol change to report

Replace the serial ordering sentence in the on-demand contract.
Clarify that pre-readiness cache work publishes no catalogue output or Changes evidence.
Allow independent base preparation during startup and head usage.
Require base capture and comparison to follow completed head usage.
State head priority, shared admission, and the reason for early preparation.
Clarify pending preparation ownership in the base preparation contract without changing kept-base eligibility or cancellation.
Update Changes state and terminal steps for silent work and adoption of its ordered events.
Add the eager scheduling exception that protects head processes while views remain to dispatch.
The user's design calls authorize this protocol change on 2026-11-20.
Any further protocol requirement goes to the performance orchestrator before dependent work.

Docs call, 2026-11-21: the eager rules live on one new protocol page, and the named pages link to it.
Reason: base preparation and source root scheduling are at the 250-line protocol cap.
The pages state the phase gate at capacities two and three.
A measured relaxation of that gate changes the requirement and its page.

Options check: fresh Claude Opus 5.5 max, 2026-11-20.
It kept the split and shared admission, refined their safety rules, and changed the pending owner from A to C.
The report is `.context/eager-base-preparation/options-check.md`.
OS priority and early equal-identity validation remain conditional decisions, not implemented policy.

## User-visible difference inventory

The performance orchestrator requested this inventory on 2026-11-20.
No published byte, status message, warning text, or non-timing event order is approved to change.
Each row states the intended behavior after implementation.
Any implementation that needs a changed or new item returns here as a decision before that change proceeds.

| Surface                                   | Classification            | Required behavior                                                                                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static build and publish files            | Unchanged                 | Equal file membership, paths, bytes, metadata, deployment identity, comparison data, removed views, assets, and encoding variants. No proof excludes or normalizes a file.                                                                                                  |
| Serve documents and resources             | Unchanged                 | Same rendered bytes, routes, content types, warnings, and error envelopes for the same admitted inputs.                                                                                                                                                                     |
| Serve public payload shape and copy       | Unchanged                 | No added field, label, status value, warning code, or warning text. Existing per-process identity and revision rules stay.                                                                                                                                                  |
| Browse readiness and initial view         | Unchanged                 | Same validation, navigation, preview behavior, ready layout, and listening line. Pending base work cannot fail or block Browse.                                                                                                                                             |
| Initial Changes state                     | Unchanged                 | `pending` remains visible until the current post-usage classification publishes its next state. Eager work publishes nothing.                                                                                                                                               |
| Base `preparing` state                    | Unchanged                 | It first appears only after head usage completes and classification adopts a fresh sidecar base attempt. It never appears during startup or head usage. Kept reuse and HTML-only preparation add no `preparing` state.                                                      |
| Changes state order                       | Unchanged                 | Replay the original `pending`, optional `preparing`, and return to `pending` before the final `ready` or `unavailable`. Preserve the branch that each existing error takes. Only durations can differ.                                                                      |
| Comparison spinner                        | Unchanged                 | Begin `Comparing with {base}` at the existing post-usage boundary. Replay buffered steps in their original order. Keep `reading base catalogue`, `extracting base sources`, `installing base dependencies`, `rendering base catalogue`, and `finding changes` exactly.      |
| Durable progress lines                    | Unchanged                 | Early work adds no line. Keep the text and relative order of `Changes ready`, `Changes unavailable`, and existing command summaries. Their elapsed values can differ.                                                                                                       |
| Base warnings and failures                | Unchanged                 | Keep the exact text, code, base commit, scripts hint, ordering, deduplication, and unavailable or fatal outcome. Publish them through the current attempt after head usage.                                                                                                 |
| Cache notices and cache warnings          | Unchanged                 | Keep one shared directory notice and its exact text. Head notices follow normal readiness reporting. Buffer base notices and warnings until adoption. Commit the shared announcement flag only when reporting. Initial failure or cancelled work releases no buffered line. |
| Source replacement and ref refresh        | Unchanged                 | Publish no stale base result or diagnostic. Keep last-good head behavior, kept-base reuse, and failed-ref preservation.                                                                                                                                                     |
| Selected comparisons and removed previews | Unchanged                 | Keep capture selection, generation routes, retention bounds, and reader cancellation. Early work publishes no comparison evidence.                                                                                                                                          |
| Stop and cancellation                     | Unchanged                 | Keep exit behavior, typed cancellation, process cleanup, and suppressed output from replaced work. Join pending work before release.                                                                                                                                        |
| CLI and configuration                     | Unchanged                 | Add no option, environment variable, setting, timeout, retry, sleep, or user-selected capacity change.                                                                                                                                                                      |
| Debug timing records                      | Unchanged text and fields | Existing base span starts and parent relationships can move to describe actual overlap. Keep existing stage names, cache outcomes, and opt-in behavior. No authored data or new status text appears.                                                                        |

Scheduling and elapsed values are the intended differences.
Base source cache work starts earlier, and an admitted base sidecar can run beside the head.
The shared pool, memory admission, byte bounds, and cleanup rules stay in force.
The protocol updates describe that scheduling change and the silent event record.
They authorize no copy change or event-order change.

## Replaced ways

- The monolithic prepare-and-capture sequence becomes separate preparation and capture phases in Milestone 2.
  Consumers are Serve Changes, static Changes, and their provider tests.
  Static build and publish keep the same ordered behavior through the shared phases.
- The unconditional post-usage preparation start becomes one attempt-owned early start in Milestone 2.
  Consumers are startup, replacement, ref refresh, no-watch Serve, and shutdown.
  Remove obsolete preparation state and move affected tests with every assertion preserved.

## Milestone 1: Documentation and protocol (complete)

Depends on: none. The stacked authorization of 2026-11-21 replaces the step 1 merge signal.

- [x] Integrate the frozen step 1 runtime `fb8b20f77` once, under the stacked authorization, and audit the merge.
- [x] Recheck the dependency boundary, kept-base rules, and test seams after step 1.
- [x] Update the on-demand and base preparation contracts with the authorized order and reason.
- [x] Update Changes state, source root scheduling, and terminal steps for silent work and adoption.
- [x] Add protocol status lines for the requirements not yet implemented.

Evidence: `.context/eager-base-preparation/` holds the timeline audit, options check, and baseline provenance.
Evidence: `.context/eager-base-preparation/stack-merge-audit.log` holds the stacked merge audit, and `ledger.md` there records the recheck.

## Milestone 2: Cancellable eager preparation (complete)

Depends on: 1

- [x] Write red tests at the existing server, provider, and pool boundaries before product code.
- [x] Prove preparation can start before head usage ends while capture and comparison remain blocked.
- [x] Prove queued head priority, capacity-one fallback, shared claim limits, and warm-head protection.
- [x] Prove replacement, base-key changes, and stop cancel pending work and reject stale results.
- [x] Preserve kept-base reuse, detachment, freshness, failed-ref behavior, and exact-identity release.
- [x] Split preparation from capture and start safe phases during head startup and usage.
- [x] Own and join the eager task through initial failure, watcher replacement, ref refresh, and stop.
- [x] Preserve typed failures, warnings, progress publication, and render store write suppression.
- [x] Keep eager status and diagnostics silent until the current classification adopts them.
- [x] Preserve every inventory row, including ordered replay of buffered statuses, progress steps, cache notices, and warnings.
- [x] Remove the obsolete serial-only start and any unused state.
- [x] Update the CLI and comparison crate README entry points after the eager code exists.
- [x] Qualify the Serve parent context in the review timing contract when eager spans start before `changes.classify`.
- [x] Run targeted tests, async tests ten times, and a real Serve smoke test.

Evidence: `.context/eager-base-preparation/source-ready-fix-report.md` records the final cancellation fix, targeted tests, and repeated concurrency checks. The basic cold and warm pilot summaries record the real Serve smoke test.

## Diagnostic bounds requested on 2026-11-21

The first four interleaved rounds found slower cold readiness on both local fixtures.
The performance orchestrator requires removal of that cost before acceptance.
It prefers a cold bound at the end of the head bundle, or at readiness.
It requires the warm path and the basic warm gain to stay.
Each diagnostic bound will run on basic and large React, cold and warm.
If neither meets the conditions, it also requests an idle-slot bound for the base bundle.
The final scheduling policy waits for the performance orchestrator's decision after these measurements.
No OS priority change, early equal-identity validation, pool-size change, or visible output change is authorized by this diagnostic request.
The source-only options check is `.context/eager-base-preparation/cold-overlap-check/report.md`.
Its report separates facts, single observations, and predictions.
The completed unbounded means and phase analysis are under `.context/eager-base-preparation/interleaved-main770-results/`.

On 2026-11-21 the performance orchestrator stopped further local timing rounds because the workspace runner uses substantial CPU.
Finish the active `HeadBundleOrReady` set and retain every sample and its spread.
Do not start the planned `Ready` set or the idle-slot diagnostic.
Push both cold-source policies after their targeted checks pass on main `36cfd7cf7`.
Label `Ready` as unmeasured locally.
The performance orchestrator measures both against that main control and selects the final policy.
The final gate, byte proof, implementation review, and pull request still remain required.

## Final policy acceptance, 2026-11-21

The performance orchestrator accepted Ready-only `2b7b1b9b5be8b62333d701839595d1df1b6354fa` against main `36cfd7cf7`.
It rejected HeadBundleOrReady because cold readiness was slower.
Cold discovery and extraction therefore wait for successful Serve readiness unless a complete extraction lease already exists.
The pin, checkout sample, and configuration load keep their early start.
The warm path and every other base rule stay unchanged.
The cold 0.72-second gain replaces the original 1.5-second acceptance target for this change.
The first acceptance treated the readiness and edit differences as within its noise bound.
The accepted cold ten-edit whole-tree peak is 3,166 MiB against its own 3,171 MiB control.
The performance orchestrator owns the final PR merge after Required CI.

Orchestrator call, 2026-11-21: keep one sticky readiness latch and remove the unselected bundle-end policy and its producer callbacks.
The Ready-only admission never uses the recorded bundle or attempt state.
Keep every live readiness, warm lease, cancellation, and later-attempt assertion.
Retire only the test of the discarded bundle-completion producer.

On 2026-11-21 the performance orchestrator approved that cleanup and requested its SHA before the complete gate.
After the targeted checks, push the cleanup for four warm one-line and four warm unchanged confirming rounds.
The performance orchestrator runs those rounds against main `36cfd7cf7` while this workspace runs the gate.
It requires no new byte proof when the runtime diff only removes the unused producer and its experiment test.
The pull request must state that scope.

The performance orchestrator confirmed cleanup `237c1785b` on 2026-11-21 against the same main control and dist.
Its four one-line warm rounds gain 0.67 seconds and its four unchanged warm rounds gain 0.33 seconds.
Warm readiness is 65 to 79 milliseconds later in all eight rounds.
This cost repeats and is accepted, rather than classified as noise.
Edits are unchanged at 2.00 and 1.98 seconds.
The pull request includes both official tables and names the remaining readiness cost.
The performance orchestrator requests a source-only check of work before readiness and a post-merge follow-up.
Its first option considers deferring that work while keeping the warm gain.
Code can establish scheduling safety, but only a future measurement can establish the retained gain.
Change no product code for that follow-up in this branch.

Large React contention remains a post-merge task owned by Cal.
Its first option is an idle-slot base bundle bound.
Local runner load prevents a conclusion about small scale regressions.
The PR includes the local means and their spread and does not claim local Ready-only timing measurements.

Evidence: `.context/eager-base-preparation/cold-overlap-check/diagnostic/official-ready-acceptance.md` holds the complete official table. `four-fixture-proof-summary.json` there gives the exact real publication proof on basic and cloud and the full static artifact proof on the two large fixtures. Both large fixtures exceed the unchanged Publish file-count limit.

## Milestone 3: Measurements and byte proof

Depends on: 2

- [x] Build the main control `77021d88c`, its matching dist, and the candidate with identical native profile, Node, npm, and esbuild. Keep the earlier frozen step 1 evidence separately.
- [x] Record cold and warm first Changes, readiness, and head usage on basic and the full large React fixture.
- [x] Use stable caches outside the repository and `/tmp`. Retain every interleaved sample, cache state, source SHA, and binary digest.
- [x] Compare exact file membership, size, digest, and actual bytes on all four fixtures. Use full native Build artifacts for the large fixtures, which exceed the unchanged Publish limit.
- [x] Include every emitted metadata, comparison, removed, and asset file without normalization or exclusions. Prove real publication envelope and encoding bytes on basic and cloud.
- [x] Measure startup and cold ten-edit whole-tree memory with the same process accounting as the orchestrator.
- [x] Send the candidate SHA to the performance orchestrator for its cloud speed, edit, and memory acceptance.
- [x] Finish the active cold-source bound measurements with red tests and warm bypass. Record the parent stop of the unstarted Ready and idle-slot measurement sets.
- [x] Push both cold-source candidate SHAs with targeted checks passing after the main `36cfd7cf7` integration. Mark Ready as unmeasured locally.
- [x] Report measured option effects and receive the performance orchestrator's final policy choice.
- [x] Apply the chosen phase or resource bound and rerun affected proofs before acceptance.

## Milestone 4: Verification, review, and pull request

Depends on: 3. The step 1 merge signal arrived on 2026-11-21. The pull request waits for performance acceptance.

- [x] Run the merged-tree repository suite, one heavy job at a time.
- [x] Remove the unselected bundle-end experiment and its unused state, while preserving the accepted Ready-only behavior and every live assertion.
- [x] Receive the performance orchestrator's warm confirmation after the cleanup SHA is pushed.
- [x] Record the remaining pre-readiness work and the accepted warm readiness cost in a post-merge follow-up.
- [ ] Run the complete gate from `AGENTS.md`, one heavy job at a time.
- [x] Commit with Conventional Commits and push the workspace branch.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push.
- [ ] Run fresh finding checks, apply the fix rounds, and record each result and follow-up.
- [x] After the step 1 merge signal, merge `origin/main` once and audit its additions.
- [x] Rerun the targeted tests and repository suite after the main integration.
- [ ] Await final CI with `scripts/ci-wait.sh` after each push and after PR creation.
- [ ] Rerun unrelated Site Lighthouse at most once and record its result separately from Required CI.
- [ ] Report the PR link, tested SHA, measurement acceptance, checks, and remaining items. Do not merge.
- [ ] Delete this plan when the `plans` skill permits it.
- [ ] Open the pull request into `main`. Preserve the dated design calls and plan permalink in its description.

Evidence: `.context/eager-base-preparation/main-integration-merge-audit.log` and `main-integration-preservation.md` record the main integration and preservation check.
