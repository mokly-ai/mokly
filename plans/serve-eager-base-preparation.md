# Prepare the Serve base before head usage completes

Status: Active. On branch `calummoore/mokly-eager-base-preparation-5dkn`, no pull request yet. The pull request that completes the work deletes this plan.

Serve currently waits for the complete head usage pass before it prepares the base catalogue.
This change moves independent base preparation into head startup and head usage.
Base capture, comparison, and publication still require completed head usage.

The performance orchestrator owns the acceptance measurements and every merge.
The user requires a cold first Changes gain of at least 1.5 seconds on `mokly-cloud`.
The warm restart gain must be at least 0.5 seconds.
The means come from interleaved rounds against `main`.
Readiness, head usage, and edits must not become slower beyond measurement noise.
The whole-process-tree peak of cold ten-edit sessions must remain within 2% of `main`.
Every published byte must remain equal on all four required fixtures.

## Authority and implementation hold

The task message of 2026-11-20 authorizes this approach and its ordering protocol change.
It does not authorize product code before the performance orchestrator confirms that step 1 has merged.
Step 1 is the miss-first base capture change from workspace 193.
It changes `changes_base.rs`, `base_render.rs`, `base_classification.rs`, and graph collection.
After the signal, integrate that `origin/main` before writing red tests or product code.
The current source audit uses `cb233fb50af71725ed464bfb1df08ab5463c5280`.
Recheck this design against the integrated source before implementation.
The performance orchestrator accepted owner 1C, phases 2B, and admission 3B on 2026-11-20 under the user's delegation.

Contract owners:

- [On-demand Serve](../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
- [Base preparation](../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md#claims).
- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Comparison package selection](../docs/protocol/mokly-comparison-packages.md).
- [Terminal comparison steps](../docs/protocol/mokly-terminal-steps.md).
- [Changes state](../docs/protocol/mokly-changes.md).
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

## Milestone 1: Documentation and protocol

Depends on: step 1 merge signal and plan approval

- [ ] Integrate the signalled `origin/main` and audit its additions before implementation.
- [ ] Recheck the dependency boundary, kept-base rules, and test seams after step 1.
- [ ] Update the on-demand and base preparation contracts with the authorized order and reason.
- [ ] Update Changes state, source root scheduling, and terminal steps for silent work and adoption.
- [ ] Update crate entry points and status lines for requirements not yet implemented.

Evidence: `.context/eager-base-preparation/` holds the timeline audit, options check, and baseline provenance.

## Milestone 2: Cancellable eager preparation

Depends on: 1

- [ ] Write red tests at the existing server, provider, and pool boundaries before product code.
- [ ] Prove preparation can start before head usage ends while capture and comparison remain blocked.
- [ ] Prove queued head priority, capacity-one fallback, shared claim limits, and warm-head protection.
- [ ] Prove replacement, base-key changes, and stop cancel pending work and reject stale results.
- [ ] Preserve kept-base reuse, detachment, freshness, failed-ref behavior, and exact-identity release.
- [ ] Split preparation from capture and start safe phases during head startup and usage.
- [ ] Own and join the eager task through initial failure, watcher replacement, ref refresh, and stop.
- [ ] Preserve typed failures, warnings, progress publication, and render store write suppression.
- [ ] Keep eager status and diagnostics silent until the current classification adopts them.
- [ ] Preserve every inventory row, including ordered replay of buffered statuses, progress steps, cache notices, and warnings.
- [ ] Remove the obsolete serial-only start and any unused state.
- [ ] Run targeted tests, async tests ten times, and a real Serve smoke test.

## Milestone 3: Measurements and byte proof

Depends on: 2

- [ ] Build a frozen main control and candidate with identical native profile, Node, npm, and esbuild.
- [ ] Record cold and warm first Changes, readiness, and head usage on basic and the full large React fixture.
- [ ] Use stable caches outside the repository and `/tmp`. Retain every interleaved sample, cache state, source SHA, and binary digest.
- [ ] Compare exact file membership, size, and digest for every published file on basic, large HTML, large React, and `mokly-cloud`.
- [ ] Include deployment metadata, comparison data, removed routes, assets, and encoding variants without normalization or exclusions.
- [ ] Measure startup and cold ten-edit whole-tree memory with the same process accounting as the orchestrator.
- [ ] Send the candidate SHA to the performance orchestrator for its cloud speed, edit, and memory acceptance.
- [ ] Apply any required phase or resource bound and rerun affected proofs before acceptance.

## Milestone 4: Verification, review, and pull request

Depends on: 3

- [ ] Run the repository suite and complete gate from `AGENTS.md`, one heavy job at a time.
- [ ] Commit with Conventional Commits and push the workspace branch.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push.
- [ ] Run fresh finding checks, apply the fix rounds, and record each result and follow-up.
- [ ] Await final CI with `scripts/ci-wait.sh` after each push and after PR creation.
- [ ] Rerun unrelated Site Lighthouse at most once and record its result separately from Required CI.
- [ ] Report the PR link, tested SHA, measurement acceptance, checks, and remaining items. Do not merge.
- [ ] Delete this plan when the `plans` skill permits it.
- [ ] Open the pull request into `main`. Preserve the dated design calls and plan permalink in its description.
