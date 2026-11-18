# Admit default sidecars within the memory budget

Status: Active. On branch `calummoore/mokly-sidecar-memory-guard-cf9n`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly uses Node sidecars for JavaScript rendering and PostCSS. The default pool can grow to the core count. Many cores can therefore admit more workers than the machine can hold. This change checks memory before default pool growth. Explicit counts keep their current meaning.

The performance orchestrator owns the design decisions. Its authority comes from the user's decision of 2026-11-16: improve Changes speed and reliability, without a change that can exhaust memory. The task of 2026-11-18 authorizes this plan, its implementation, and the open pull request. The performance orchestrator will merge it.

Contract owners:

- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md).
- [Sidecar lifecycle](../docs/protocol/mokly-sidecar.md#lifecycle).
- [Sidecar crate](../crates/mokly-sidecar/README.md).

## Evidence and requirements

The initial measurement baseline is `bc858df427b0ffe2cb53dbf3fe35a44e032475cc`. It has its own checkout and Cargo target directory. The Linux machine has four cores and 8,131,944 KiB physical memory. Baseline Serve sessions include a start, a visible edit, and its restoration. Each waits for the published Changes result.

Basic used four sidecars and peaked at 2,498,232 KiB. Large React used four and peaked at 2,211,068 KiB. Large HTML used none and peaked at 1,145,408 KiB. No safety stop fired. The largest worker tree was 716,916 KiB on basic and 507,004 KiB on React. All sessions restored the exact authored bytes and reaped every owned process. The measured workers fit below the existing one-GiB recycling reference.

The same Rust probe on Linux reported `total - used` exactly equal to `MemAvailable`. It fell by about 488 MiB during a 512 MiB anonymous allocation, then recovered after release. Evidence: `.context/sidecar-memory-guard/linux-signal.json`.

The macOS probe ran on `blacksmith-6vcpu-macos-26`, with six cores and 24 GiB. A 512 MiB anonymous allocation reduced `total - used` by 523.58 MiB. The nominal available value increased by 1.78 MiB. Adding 512 MiB file cache reduced `total - used` by only 16.03 MiB. Thus the signal responds to program memory and preserves file-cache headroom. The disposable measurement branch is deleted.

Evidence: `.context/sidecar-memory-guard/baseline-report.md`, the baseline samples, and `.context/sidecar-memory-guard/mac/report.md`.

The performance orchestrator made these calls on 2026-11-18 for the reason above:

- Measure per-worker and core memory before choosing the rule. Include basic, large fixtures, Linux, and macOS background programs.
- Keep explicit `--sidecars` and `MOKLY_SIDECARS` counts exact. Keep the core count as the default upper bound.
- Admit default growth only when memory can hold another sidecar. Otherwise reuse or wait for a slot. Always permit one worker for progress.
- Preserve the default count on healthy machines. A file cache alone must not reduce the macOS count.
- Compare a fixed physical-memory default, growth admission, and admission with idle retirement. Ask before reducing the four-core, eight-GiB case.
- Document the rule in the memory protocol. Add no setting.

## Design decisions

### 1. Fit default sidecars to current memory

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-sidecar/src/pool_leases.rs` and `pool_affinity.rs`.
- **Terms:**
  - **Sidecar:** An owned Node process that renders JavaScript and manages PostCSS children.
  - **Pool:** The shared process owner used by Serve and build.
- **Background:** The pool starts workers only when work needs them. Serve shares it between the current catalogue and its comparison base.
- **Problem:** Core count alone does not bound resident memory on a machine with many cores.
- **Impact if no action:** A default command can enter swap or receive an out-of-memory kill.
- **Root question:** How can default sidecars fit the memory available to the command?
- **Options:**
  - **A.** Fix the default from physical memory at startup. For example, allocate half of physical memory at the per-worker budget. It cannot react to other programs. Effort: Small.
  - **B.** Check memory at each pool growth. Reserve the budget of admitted workers. Reuse or wait when growth is denied. Effort: Medium.
  - **C.** Use B and retire idle workers while memory remains low. This can release warm bundles and add later compilation. Effort: Medium.
  - **D.** Use B and share the memory-permitted capacity with Serve admission and the background work window. This preserves foreground priority under pressure. Effort: Medium.
- **Left out:** A new setting conflicts with the task. Keeping the core-only rule fails the goal. An external process limit does not implement portable default admission.
- **Wider fix:** D. Share the capacity rule between the pool and the Serve scheduler.
- **Previous examples:** The existing one-GiB recycling rule bounds completed worker requests, not pool admission.
- **Recommendation:** D, changed from B after the options check. It preserves the existing foreground-priority contract while applying the performance orchestrator's growth rule.
- **Action:** fix now, apply D. The performance orchestrator chose growth admission on 2026-11-18. Sharing its capacity is the workspace orchestrator's call of 2026-11-18, to preserve the existing Serve contract.

Shared assumptions: explicit counts bypass admission, cores bound the default, one worker remains possible, and no setting is added. The task requires each assumption. Option A must not use literal half-RAM rounding that reduces the four-worker reference case. No option promises control over arbitrary future allocations in unrelated programs.

### 2. Measure usable memory without rejecting caches

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** The host memory adapter in `crates/mokly-sidecar`.
- **Background:** Linux and macOS give different meanings to available memory. The macOS measurement includes normal background programs and file-cache activity.
- **Problem:** Raw free memory rejects healthy caches. The macOS nominal available value also includes active anonymous pages.
- **Impact if no action:** The pool can lose healthy capacity or admit growth under pressure.
- **Root question:** Which memory estimate preserves healthy capacity and responds to other programs?
- **Options:**
  - **A.** Use raw free memory. It is simple but counts reclaimable caches against the pool. Effort: Small.
  - **B.** Use the nominal available-memory API everywhere. It misses the measured macOS allocation. Effort: Small.
  - **C.** Use physical total minus used memory through the existing `sysinfo` dependency. Honor a tighter Linux process cgroup limit. Effort: Small.
  - **D.** Add native pressure APIs and separate platform rules. The tested macOS per-process API returns zero. Pressure alone does not give a worker budget. Effort: Medium.
  - **E.** Use C with a cache-aware Linux cgroup estimate. Apply actual finite limits and credit reclaimable file cache. Ignore unbounded cgroups. Effort: Medium.
  - **F.** Keep core-count growth when the reading is unknown. It preserves concurrency but gives no memory evidence for extra workers. Effort: Small.
- **Left out:** New platform dependencies add no measured benefit over C. Counting swap as capacity conflicts with the goal.
- **Wider fix:** E. The injected boundary supplies one cache-aware estimate within actual host and cgroup limits.
- **Previous examples:** The current sidecar crate already uses `sysinfo` for owned-process memory.
- **Recommendation:** E, changed from C after the options check. Raw cgroup free memory includes file-cache charges and can reduce healthy capacity.
- **Action:** fix now, apply E. This is the workspace orchestrator's call of 2026-11-18, to preserve cache-aware capacity under finite Linux limits.

Shared assumptions: use resident physical memory, preserve healthy caches, and use no swap capacity. The task and existing resident-memory contract support them. Unknown or invalid memory denies extra default growth. It still permits the first worker and existing worker reuse. This conservative behavior follows the task's progress and memory requirements. If no cgroup memory controller applies, use the host value. An unreadable applicable memory limit makes the estimate unknown. Never treat missing limit data as evidence of unlimited capacity.

### 3. Reserve memory for workers still growing

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** Pool admission and its host memory boundary.
- **Background:** A new sidecar starts with less memory than its later render workload. Concurrent callers can reach admission before a new process allocates its budget.
- **Problem:** A check for only the next worker can repeatedly admit against the same remaining memory.
- **Impact if no action:** The pool can overcommit memory during startup.
- **Root question:** How does each admission account for the memory its admitted workers can still consume?
- **Options:**
  - **A.** Check only the next one-GiB worker budget. It leaves other new workers unreserved. Effort: Small.
  - **B.** Require current headroom for every full worker budget again. It double-counts existing resident memory and can reduce healthy capacity. Effort: Small.
  - **C.** Reserve one GiB for the new worker, each existing worker's unused budget, and one GiB of remaining host headroom. Account under the pool lock. Effort: Medium.
  - **D.** Set the worker budget from the observed resident-memory peak, capped at one GiB. This admits more workers but does not reserve later growth. Effort: Medium.
  - **E.** Recycle workers at their admitted memory share. This can enforce smaller shares after requests, but changes the existing recycle requirement. Effort: Medium.
- **Left out:** Waiting for a handshake or first request does not reserve later worker growth. A fixed small pool loses healthy concurrency.
- **Wider fix:** C. A shared reservation calculation protects concurrent starts and replacements without changing explicit pools.
- **Previous examples:** The pool already reserves slots before starting processes. The current memory recycle threshold is one GiB.
- **Recommendation:** C, retained after the check recommended D. An early observed peak can understate later request memory and admit too many workers. Existing reservations keep four workers through recycling.
- **Action:** fix now, apply C. This is the workspace orchestrator's call of 2026-11-18.

Shared assumptions: one-GiB worker budgets and one-GiB spare host memory. Measurements support the worker budget. The current recycle threshold supplies a conservative reference. Spare memory covers core growth and native helpers. These are implementation choices within the authorized admission rule. Check the four-worker reference case before retaining them. Ask the performance orchestrator before any change that reduces that case.

## Design and integration

### 4. Preserve priority when memory changes

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** performance.
- **Location:** `crates/mokly-cli/src/serve_pool.rs`, `serve_delivery.rs`, and `crates/mokly-sidecar/src/pool_admission.rs`.
- **Terms:**
  - **Reservation:** A pool slot whose worker budget passed memory admission and remains available through worker replacement.
- **Background:** Serve checks pool capacity before it starts background views or admits sidecar calls. The pool checks memory again when a call needs a slot.
- **Problem:** Memory can fall between those checks. An accepted background call can then queue for an unreserved slot ahead of foreground work.
- **Impact if no action:** A foreground request can wait for two background calls in sequence instead of the first busy worker alone.
- **Root question:** How do Serve calls stay within admitted sidecars while foreground requests keep priority over queued background work?
- **Options:**
  - **A.** Keep capacity queries alone. It changes nothing but leaves the demonstrated interleaving. Effort: Small.
  - **B.** Reserve the needed slots atomically when Serve admits calls and background views. Keep capacity queries read-only and reuse the same budget calculation. Effort: Medium.
  - **C.** Carry foreground and background priority into the core pool queue. This changes queue ownership and every relevant call boundary. Effort: Medium as first recorded; the check estimates Large when it includes propagation through graph workers.
  - **D.** Use temporary claims at both Serve boundaries, with one gate owner. Count base calls separately from the larger of started views and admitted head calls. Convert claims only when a new sidecar slot starts. Release unused claims with their demand. This prevents unused reservations, but leaves a started view's calls equal to HTTP calls at the gate. Effort: Medium.
  - **E.** Use temporary claims at the Serve call gate and carry a background-view call class through the render workers. Waiting HTTP calls take priority over waiting background-view calls. Keep the background window's read-only capacity bound. An unused claim ends with its call. A new worker converts its claim into a retained reservation. This preserves priority when memory falls and when an old base call overlaps a replacement pass. Effort: Large.
- **Left out:** Serializing all work loses healthy concurrency. A smaller fixed pool can reduce the required four-worker case. Returning denied calls to the gate leaves head-background calls equal to HTTP calls. Checking a permanent empty reservation at first spawn restores the same pool-queue gap. Per-view claim identities require the propagation of E with more ownership state.
- **Wider fix:** E. All Serve call classes share atomic resource admission and keep their priority through worker boundaries.
- **Previous examples:** The pool already creates reservations under its state lock. The first three decisions preserve the foreground-priority contract.
- **Recommendation:** E, changed from B after the check recommended D. D still leaves the checked priority races. E preserves the existing requirement without permanent unused reservations or a changed progress rule.
- **Action:** fix now, apply E. This is the workspace orchestrator's call of 2026-11-18. The existing foreground-priority and memory-admission requirements settle the outcome.

Shared assumptions: explicit sizes remain exact, first-worker progress remains possible, and reservations of workers that started survive a later low reading. The task requires these rules. A capacity query remains read-only. A temporary call claim does not become a permanent reservation unless a new worker starts. Preserve cancellation, retirement, generation ranking, root changes, and the core-count bound. Propagate background priority through graph thread-pool work; a marker on only the original thread is insufficient.

The non-ui implementor traced the gap with a busy base call, a second base call, and a later foreground request. The options check confirmed it, the head-background variant, permanent unused reservations, and overlapping base and head work. The check recommended D. The workspace orchestrator chose E because D leaves HTTP calls equal to queued background-view calls, including when the progress rule starts one view while base calls hold all slots. E also avoids the separate claim count and wake mechanism that D needs at the view window. It adds no new requirement. An HTTP request that shares an already active view still waits for that view under the existing coalescing rule.

Options-check evidence: `.context/sidecar-memory-guard/decision-4-options-check.md`. The out-of-gate return and cleanup waits also exist on main. They do not depend on memory admission and are outside this correction.

Preserve whether the count came from the command, the environment, or the default before option normalization loses that fact. Inject the system memory boundary only for a default pool. Keep the integer count as the scheduler's upper bound.

Check admission only for additional live or reserved processes. A matching idle worker needs no new reservation. A root change replaces an owned worker in its existing reservation. The first usable reservation always succeeds. Unknown worker memory reserves its whole remaining budget. Unknown host memory allows no extra reservation.

Denied growth follows existing queue and wake behavior. It must preserve PostCSS affinity, root selection, cancellation, shutdown, failed-worker replacement, and background head return. Serialize reservations with slot allocation. Count starting workers before they reach hello. Retain each reservation through recycling, failed-worker replacement, and root replacement. Release it only when the slot permanently retires or the pool stops. Do not retire idle workers for pressure in this change.

Serve uses the same memory-permitted ceiling for its gate and sliding background window. The ceiling includes prospective starts, so a healthy one-worker pool can grow. It never falls below existing reserved capacity. Existing reservations stay valid through recycling and root replacement. Thus a low later sample does not shrink a healthy admitted pool. Recompute prospective capacity after ordinary work wakes the queues. This avoids a fixed one-worker background window after memory recovers.

The options check recommended an observed-peak budget after replaying all React samples. The replay tests a fourth admission after the pool already reserved four slots. It does not require those reservations again. The initial four-worker admission fits the baseline. Keep the fixed budget to protect later worker growth. A smaller observed peak is not an upper bound on the next render. The alternate recycling rule waits for a separate user decision if ever proposed.

Use trace-level admission data for measurement if needed. A new user-facing diagnostic is not required by this change.

Options-check report: `.context/sidecar-memory-guard/plan-options-check.md`. The workspace orchestrator accepted the scheduler and cgroup corrections. The workspace orchestrator rejected the observed-peak recommendation because its report acknowledges that concurrent later growth can overcommit memory. The user explicitly forbids that risk. The check's suggested new recycle threshold is an alternative, not required work or a deferred finding.

Use `unimock` at the memory boundary. Use channel handshakes for concurrent tests. Do not use time-based assertions, sleeps, or retries. Keep the existing pool and Serve tests and their assertions.

## Replaced ways

The fixed Serve gate bound and `UsagePass::batch` become live capacity boundaries. The consumers are CLI delivery composition and the background constructors in the server unit and HTTP tests. Move every consumer in this branch. Keep fixed-capacity test inputs behind the same boundary, with every existing assertion. No external converter remains.

## Milestone 1: State the memory contract

Depends on: none

The docs implementor records the authorized default admission rule before the code changes.

- [x] Update the memory protocol with default admission, budgets, cache-aware signal, progress, overrides, and unknown readings.
- [x] Align the lifecycle default-count sentence and the sidecar crate's public behavior.
- [x] Mark pending protocol behavior with the single required plan status line. Keep mechanics in code or the crate README.

Evidence: `.context/sidecar-memory-guard/docs-report.md`.

## Milestone 2: Implement default admission

Depends on: 1

The non-ui implementor changes the shared pool and its CLI composition.

- [x] Add failing behavior tests for low memory, recovery, first-worker progress, exact overrides, and healthy full capacity.
- [x] Cover simultaneous reservations, unknown readings, and foreground priority under reduced memory capacity without timing assertions. Capture the red output.
- [x] Keep explicit-count provenance through CLI and environment validation.
- [x] Add the injected host signal and per-worker budget accounting. Honor finite process cgroup limits without charging reclaimable file cache twice.
- [x] Share memory-permitted capacity with the Serve gate and its sliding background window. Preserve foreground priority and allow growth after recovery.
- [x] Move CLI delivery composition from the captured batch to the live capacity boundary.
- [x] Move the background constructors in `background_tests`, `quiet_background_tests`, `background_batch/script`, and HTTP `evidence_tests` to that boundary. Keep every assertion.
- [x] Remove the fixed gate field and `UsagePass::batch` after all consumers move.
- [x] Gate default growth without blocking existing reusable workers or the first usable worker.
- [x] Preserve the current affinity, root, recycle, cancellation, shutdown, and return behavior.
- [x] Run the targeted sidecar, pool, option, and Serve tests. Run each new concurrent test ten times.
- [x] Align the sidecar and CLI crate READMEs with actual entry points and capacity behavior. Update the server crate README if its public background boundary changes. Remove pending status lines when implementation meets the contract.

Evidence: `.context/sidecar-memory-guard/implementation-report.md` and `.context/sidecar-memory-guard/integration-report.md`. The orchestrator checked the capacity calculation, composition, reservation lock, caller migrations, and protocol text.

## Milestone 2a: Bind scheduling to reservations

Depends on: 2

The non-ui implementor closes the confirmed scheduling gap before measurements. The docs retain the existing priority and memory requirements.

- [x] Complete the options check for decision 4 and save its report.
- [x] Add failing event-order regressions for stale gate capacity and background-view priority when memory falls or base work overlaps.
- [x] Add atomic temporary call claims under the pool lock. Retain the read-only capacity query. Convert only actual new worker slots to durable reservations. Release unused claims on completion and cancellation.
- [x] Use claims in Serve gate admission. Carry background-view priority through the graph worker boundary. Keep the live background window, exact counts, and healthy concurrency.
- [x] Keep generation ranking from PR #315 within the admitted slots. Preserve cancellation, root changes, recycling, and retirement.
- [x] Align public entry-point documentation. Run targeted checks and each affected new concurrent test ten times.

Evidence: `.context/sidecar-memory-guard/priority-correction-report.md` and `.context/sidecar-memory-guard/priority-protocol-report.md`. The orchestrator checked the claim budget, claim forwarding, call order, class restoration, generation ranking, and mutation restoration. The strict release build smoke passed.

## Milestone 3: Measure and verify

Depends on: 2a

The orchestrator runs the combined checks and compares separate release builds.

PR #315 advanced `main` to `2e6bde9c2`. The final comparison rebuilds that baseline in its separate checkout and target directory. Each run uses its own empty external cache directory, so the bundle disk cache starts in the same state. The initial measurements above remain the evidence for the budget choice. The partial `e60c16532` comparison is superseded. Its interrupted HTML run and full cleanup proof remain under `.context/sidecar-memory-guard/`.

- [ ] Measure branch Serve start and two edits on basic and default large HTML and React fixtures with the baseline harness.
- [ ] Compare count, process tree peak, first Changes, and edit times against the baseline. Confirm the healthy four-worker count.
- [ ] Complete a bounded memory-limit run that shows reduced default growth and successful Changes. Include charged file cache, cgroup events, and owned process cleanup.
- [ ] Check cache-aware capacity under a larger finite limit where four workers fit after reclaiming file cache.
- [ ] Send the implementation SHA to the performance orchestrator immediately after push for its `mokly-cloud` measurement.
- [ ] Run targeted tests, formatting, `cargo xtask check --suite repository`, and `cargo xtask check` with the required tools.

Evidence: `.context/sidecar-memory-guard/`. Use Git 2.47.3 in its own first PATH directory, git-lfs, and Bun 1.4.4. Use `CARGO_INCREMENTAL=0`, separate target directories, and one Cargo build at a time. Check disk and memory before each large build.

## Milestone 4: Commit, review, and open the pull request

Depends on: 3

The orchestrator owns the gate, reviews, and the pull request. Merge updated `origin/main` with preservation audits when necessary. Keep nearby generation affinity, startup base overlap, and bundle-cache changes.

Integration evidence: `.context/sidecar-memory-guard/pre-main-merge/merge-audit.log`. Merge `d9c0678c0` preserves PR #312. The saved memory changes are then integrated path by path.

Generation-affinity integration evidence: `.context/sidecar-memory-guard/pre-affinity-merge/merge-audit.log`. Merge `285460e8f` preserves PR #315. Memory admission sets the growth bound. Generation ranking selects an available slot within it.

- [ ] Commit with Conventional Commits and push the branch. Start `ci-wait.sh` after every push.
- [ ] Review the complete diff against `origin/main` with the implementation-review skill. Check each finding in a fresh second pass.
- [ ] Apply the fix rule and its two fix rounds. Record each deferred finding as a follow-up item. Re-run affected checks.
- [ ] Wait for CI and the performance orchestrator's `mokly-cloud` evidence. Fix branch-caused failures. Record unrelated failures and rerun them once.
- [ ] Delete this plan under the plans skill when the other required work is complete.
- [ ] Open the pull request into `main`. Keep the dated decisions, the plan permalink, and follow-up items in its description. Wait for final CI. Send the full report to the performance orchestrator. Do not merge.
