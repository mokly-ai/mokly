# Prepare watched Serve generations earlier

Status: Active. On branch `calummoore/mokly-edit-critical-path-o9ma`, no pull request yet. The pull request that completes this work deletes this plan.

Serve compiles a component edit before it validates and prepares the next
catalogue. Other render sidecars load and describe that generation when
the first changed documents reach them. That preparation delays Changes.
The change prepares an existing idle head sidecar during the core's
remaining work. It first disposes their older loaded head generations.
The pool retains the recipes of every live generation for requests that
still use the published state.

The performance orchestrator owns official measurements and every merge.
It approved option K on 2026-11-21, with D as a measured prototype first.
H and C run in separate child workspaces. Their changes have separate PRs.
The original combined goal remains 250 ms. It is not a promise for D alone.

The approved D prototype has these acceptance requirements:

- Mean warm edits on Mokly Cloud reach published Changes at least 80 ms
  sooner than interleaved `main` rounds.
- Later bundles stay equal within noise. Requests that wait for the
  bundling process stay rare and short, as the performance orchestrator judges.
- First Changes and `serve.ready` stay equal within measurement noise.
- Cold ten-edit whole-tree peak memory stays within 2% of `main`.
- Stage 2 proves equal published bytes on basic, full large HTML, full
  large React, and Mokly Cloud. No normalization or file exclusion is permitted.
- A newer edit, failed attempt, or stop cannot publish an early result.
- The PR stays open after review and passing CI. This workspace never
  merges it.

The current measurement setup has four vCPUs and two sidecars. The earlier
four-sidecar trials are historical evidence. They do not size this setup.

PostCSS reuse belongs to workspace 206. The precompile reads, editor-file
compiles, render keys, render-store lock, startup base, and startup class
maps belong to the workspaces named in the task. Incremental esbuild
contexts stay outside this change.

Contract owners:

- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Return warm-up](../docs/protocol/mokly-sidecar-return-warmup.md).
- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md).
- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md).
- [Watch recovery and publication](../docs/protocol/mokly-watch-runtime.md).
- [Sidecar timings](../docs/protocol/mokly-sidecar-timings.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).
- [Render sidecar](../packages/mokly/src/sidecar/README.md).

## Design

The fresh options check recommends option K: bounded early preparation,
then cheaper proof and publication work as measured complements. The first
recommendation was D alone. The two-sidecar throughput model rejects D as
a complete route to the 250 ms goal. The performance orchestrator approved
the scoped protocol exceptions on 2026-11-21. The check has the same date.

The ranking and measurement details live under `.context/edit-critical-path/`.
The separate compile-digest experiment found no helper or reuse read in a
compile window. The parent closed it after its quiet official rerun found
equal compile time. The current control is `origin/main` at `77021d88c`,
after the clean integration of the compact plan and base capture changes.

The candidate starts after the first Changes publication and a successful
head edit bundle. It uses the
existing Serve maintenance worker. It starts no process. It restores the
generation as soon as its recipe is available. It installs class maps
before evaluation. It describes the generation when those maps arrive.
Resolved bindings retain their existing validation and installation order.
Early preparation renders no document and publishes no state.

Only the existing idle other process in the head root qualifies. A process
that holds a live PostCSS context of the current attempt is excluded.
Each selected
process first disposes its older loaded head generations. Its centrally
retained recipes remain available. A selected process keeps at most one
loaded head generation. A cache miss of the older published state waits
for the bundling process when the other process holds only the new state.
The bundling process keeps its existing lifetime rules.

Preparation checks the pool queue, Serve admission waits, and claims that
have not reached the queue before each call. Calls that already run on
another process can continue beside it. The old return warm-up keeps its
idle rule. It uses generation lifetimes and an attempt identity. Each new
head bundle supersedes pending work, including a second bundle in one
attempt or a failed bundle. Publication, final release, and stop end pending work too.
An in-flight call cannot authorize work for another lifetime. Its return
uses the existing cleanup and stop paths.

The early calls are quiet. The core's ordinary describe supplies evaluation output.
The first rendered document that uses a prepared generation counts one
adoption. Diagnostics count started, aborted, and adopted preparations.
They also count published-state waits and sum their milliseconds.

Full capture and first startup keep their current schedule. The change
adds no timeout, retry, sleep, process, cache persistence, or wire field.
It retains the diagnostic spans that explain the measured waits.

Agent design call, 2026-11-21: yield only the early quiet description until
the core starts its visible description. This preserves evaluation output
without another request wait. Restore and class-map installation can run sooner.

Agent design call, 2026-11-21: end pending return warm-up on each successful
bundle lifetime, also with the same content id. Old inputs cannot warm a new
lifetime. Keep its idle, admission, and replay policy.

Agent design call, 2026-11-21: end early work from serialized head failure
paths. A failed same-id candidate can retain the published state's lease,
so final release alone cannot end that work.

The bounded H and C investigations stopped on 2026-11-21 without a production
candidate. Their local diagnostics do not support a safe 30 ms saving.
D remains the measured prototype. The selected parts do not establish the
250 ms combined target on two sidecars.

### 1. Bound early preparation without stale publication

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_preparation.rs` and the Serve maintenance worker.
- **Terms:** A generation is one compiled and evaluated catalogue version. A head process serves the working repository.
- **Background:** Render processes must restore and describe a new generation before they render its documents. Those processes can remain idle during validation.
- **Problem:** Preparation waits until rendering starts. Earlier full preload attempts held two evaluated generations and increased memory.
- **Impact if no action:** The first changed documents keep the preparation wait. The previous preload attempts do not meet the memory and speed requirements.
- **Root question:** How can Serve remove the largest postcompile wait while it keeps exact output and bounded memory?
- **Options:**
  - **A.** Reduce private recipe encoding and transfer. Its measured cost is smaller than the full preparation wait. Effort: Medium.
  - **B.** Reuse declaration parsing or make evaluation cheaper. It avoids work but needs a bounded cache or a broader evaluation change. Effort: Medium.
  - **C.** Reduce watch and snapshot projection work. Its warm local cost is small. Effort: Medium.
  - **D.** Prepare existing idle head processes earlier and dispose older loaded head state first. Live recipes remain available. Effort: Medium.
  - **E.** Return an early compile result and finish metadata later. This needs a protocol for identity, input capture, reuse, and supersession. Effort: Large.
  - **F.** Evaluate and register the other process without returning a full description. This changes the private sidecar boundary. Effort: Medium.
  - **H.** Reduce the guarded proof after compilation, with identical results. Its warm cloud saving remains unmeasured. Effort: Medium.
  - **K.** Apply D under the scheduling rules above. Measure H and C as separate complements for the total target. Effort: Large.
- **Left out:** Unbounded full preload violates the memory requirement. Restore-only preload already lost total edit time. PostCSS reuse belongs to workspace 206. An incremental esbuild context is outside the task.
- **Wider fix:** D removes preparation from the render phase through one bounded pool policy.
- **Previous examples:** Commits `062429a48` and `1e01658c0`, and the `serve-head-generation-preload.md` and `dispose-older-head-generations.md` follow-ups.
- **Recommendation:** K. The check changed the first recommendation, D, because D alone has a smaller two-sidecar throughput ceiling.
- **Action:** Apply the approved stage 1 prototype. The performance orchestrator approved rules 1, 2, and 5 as scoped exceptions on 2026-11-21. The other five rules stand.

The task requires exact bytes, central ownership of official measurements,
no stale publication, correct capture and reuse, and memory within 2%.
The agent proposes no new process starts as a bound on speculative work.
Stage names remain diagnostic details under the existing timing schema.

Options G, I, and J from the first check are withdrawn. They depended on
the incorrect four-sidecar model. Faster metadata and resolution reads
remain outside this change because PR #449 supplies them.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Finish the local measurement ranking and retain useful timing spans.
- [x] Run the fresh second-pass options check and record its corrected report.
- [x] Record the performance orchestrator's protocol choice and its date.
- [x] Write the accepted scheduling and memory requirements in a focused protocol page.
- [x] Link the area README to the accepted scheduling protocol.

Evidence: `.context/edit-critical-path/baseline-report.md`,
`postcss-candidate.md`, and `options-check.md`.

## Milestone 2: Measured prototype

Depends on: 1

- [x] Write failing pool tests through the existing public request and maintenance boundaries.
- [x] Prove restore and describe can run before the first render, after their required inputs arrive.
- [x] Prove older loaded head state is disposed before early loading and remains recoverable from live recipes.
- [x] Prove a newer attempt, failed compile, final release, and stop end pending work.
- [x] Prove ordinary queue and admission work prevent another early call.
- [x] Implement the accepted pool policy without a new worker or wire field.
- [x] Add counters for starts, aborts, first-render adoption, and published-state wait count and summed milliseconds.
- [x] Check the startup and full-capture paths retain their schedule.
- [x] Run each new asynchronous test ten times without changing the test.
- [x] Run targeted cancellation and stale-publication checks. The parent explicitly defers the full gate until acceptance.
- [x] Commit and push the prototype. Send its SHA to the performance orchestrator.

Evidence: `.context/edit-critical-path/prototype/` holds the red tests,
targeted checks, stability counts, test costs, and main integration audit.

## Milestone 3: Official prototype acceptance

Depends on: 2

- [ ] Record six warm one-line rounds, four warm unchanged rounds, and four cold ten-edit memory pairs from the performance orchestrator.
- [ ] Record its decision on the 80 ms net gain, later bundles, first Changes, waits, and memory within 2%.
- [ ] Start stage 2 only after acceptance. If the parent rejects D, close the prototype and keep the follow-up items.

Evidence: `.context/edit-critical-path/` holds commands, raw traces, check
logs, byte manifests, and the official measurement report.

## Milestone 4: Production checks

Depends on: 3

- [ ] Complete production fixes and run their targeted checks.
- [ ] Close or update the head-preload and older-generation-disposal follow-ups for the accepted scope.
- [ ] Run the repository suite and the complete gate.
- [ ] Compare local basic and full large React edit timelines with the current main control.
- [ ] Prove every published file is byte-identical on all four catalogues.
- [ ] Smoke-test Serve after the build.
- [ ] Commit and push the final implementation.

## Milestone 5: Review and pull request

Depends on: 4

- [ ] Review the pushed complete diff against `origin/main` with `implementation-review`.
- [ ] Check each finding, fix confirmed fix-now findings, and record other outcomes.
- [ ] Re-review once after a fix. Use no more than two fix rounds without the user.
- [ ] Finish the final commit and push, then watch CI with the finish-work script.
- [ ] Delete this plan when the plans skill permits it. Preserve its dated decisions in the PR.
- [ ] Open the PR into `main`, wait for Required CI, and report its link and final SHA.

Site Lighthouse is outside Required CI. Rerun its existing unrelated
failure at most once. Record it separately. Do not merge the PR.
