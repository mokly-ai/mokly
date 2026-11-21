# Prepare fresh PostCSS contexts during Serve bundles

Status: Active. On branch `calummoore/mokly-postcss-reuse-across-edits-pra6`, no pull request yet. The pull request that completes this work deletes this plan.

Serve starts a fresh PostCSS child after each changed JavaScript bundle.
Module loading dominates the first stylesheet request on `examples/basic`.
Prepare the current attempt's child during the bundle instead.
Keep fresh consumer modules and plugin instances for every context.
Run each stylesheet at its existing point in preparation.

On 2026-11-21, the performance orchestrator chose a production implementation
with direct context affinity and preparation at Bundle start.
The orchestrator owns official measurements and every merge.
Do not merge this branch.

Contract owners:

- [Consumer contexts and evidence](../docs/protocol/mokly-sidecar-postcss.md).
- [PostCSS and dependency inventory](../docs/protocol/mokly-imported-styles-postcss.md).
- [Sidecar lifecycle](../docs/protocol/mokly-sidecar.md).
- [Render runtime](../crates/mokly-render/README.md).
- [Sidecar package](../packages/mokly/src/sidecar/README.md).

## Design and recorded choices

The initial measurements used main `e69db4ce8`.
The branch now includes main `e331ad64b`, which reduces bundle reuse reads.
Final comparisons must use matching toolchains from the current main and branch.

### Chosen approach

User choice, 2026-11-21: prepare a fresh current-attempt PostCSS context at
Bundle start. Record the bundle sidecar as the context owner.
Later stylesheet requests use that same sidecar and its prepared child.
The child has processed no stylesheet before the first real request.

The request contains optional preparation metadata beside its capture and
resolution plan. It does not enter persisted bundle parameters or generation
identity. This placement is my design call, dated 2026-11-21.

Only eligible head Serve edits prepare a child. A project without PostCSS
does no extra work. Preserve lazy processing for other calls and attempts.
Prefer a guard that identifies a stored PostCSS root whose evidence fails.
Keep its cache lookup work for the rest of the attempt.

A failed or cancelled bundle releases its child at once.
A newer attempt cannot adopt the child of an abandoned attempt.
An unused preparation ends with its attempt, including successful attempts.
A used context keeps the existing graph-owned lifetime.
An asynchronous preparation cannot fork after its owner is disposed.
Memory admission must discover a child that a Bundle request creates.

User choice, 2026-11-21: apply decision 1D. Keep the original CPU priority
on every platform. Add no nice, CPU affinity, or scheduler changes.
Measure contention on the orchestrator's snapshot-idle machine.

### Alternatives and acceptance

- Retaining consumer processors or module instances across edits was rejected.
  Tailwind retains removed candidates in module-level state.
- Consumer modules loaded before an edit cannot prove freshness for opaque
  native load-time inputs. Keep consumer loading within the current attempt.
- Node bytecode caching alone showed no useful controlled end-to-end gain.
  Do not add it to this change.
- Full root overlap needs speculative roots and later evidence checks.
  Module preparation keeps the original stylesheet sequence and a smaller proof.
- The late-start experiment lost part of its window through a diagnostic bridge.
  The user chose direct affinity and Bundle-start preparation for production.

The user's decision rule remains: prefer the narrow approach when its measured
saving is at least 80% of full root overlap's saving.
The final target is at least 0.4 seconds per warm basic label edit.
The bundle must not become slower.
The cold ten-edit whole-tree peak must stay within 2% of main.
The performance orchestrator confirms these measurements on an idle machine.

The frozen diagnostic bridge and full PostCSS proxy are not production proofs.
They do not implement direct affinity or overlap all Rust root work.
Keep every measured outlier and every inclusive memory peak.
Evidence lives under `.context/edit-critical-path/` and
`.context/postcss-reuse-across-edits/`.

### 1. Priority restoration needs platform permission

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/postcss.ts`.
- **Terms:**
  - **Nice value:** the Unix CPU priority value. A larger value gets less CPU time under contention.
  - **CPU affinity:** the set of CPUs that a thread or process can use.
- **Background:** The user requested lower priority during preparation and normal priority for stylesheet processing.
  This workspace runs as an unprivileged Linux user.
- **Problem:** Nice 0 to 10 succeeds, but 10 to 0 fails with `uv_os_setpriority EACCES`.
  The process has a zero `RLIMIT_NICE` limit.
- **Impact if no action:** An unconditional priority change can leave real stylesheet processing at low priority.
- **Root question:** How can preparation give CPU to the bundle while every thread and helper uses the original priority for real stylesheets?
- **Options:**
  - **A.** Lower priority only when the platform permits a verified restoration.
    Otherwise retain the original priority. Restore every thread and helper before real stylesheet work.
    Discard the preparation if restoration fails. Effort: Medium.
  - **B.** Require the operator to raise the nice limit or grant priority permission.
    This adds privileged setup to normal use. Effort: Medium.
  - **C.** Add a platform scheduler helper with a reversible preparation policy.
    This adds native platform work and a distribution boundary. Effort: Large.
  - **D.** Keep the original priority on every platform. Measure bundle contention on the idle official machine.
    This gives up priority lowering and removes restoration risk. Effort: Small.
  - **E.** Limit the child's CPU affinity during the bundle. Restore all CPUs for every thread and helper before stylesheet work.
    This needs platform-specific native code and keeps normal priority on macOS. Effort: Large.
- **Left out:** Always applying nice 10 breaks restoration on normal Linux installations.
  Timer throttling cannot pause synchronous module loading. Leaving `SCHED_IDLE` needs priority permission.
  A user cgroup changes service ownership. Smaller thread pools leave the main-thread load unchanged.
  Delaying preparation changes the user's Bundle-start choice.
- **Wider fix:** D. Without lowering, no worker or helper can remain at a lower priority.
- **Previous examples:** None found in the PostCSS worker code.
- **Recommendation:** D, changed from A after the options check. A does not lower priority on ordinary Linux or macOS users.
  D avoids platform code and helper restoration risks.
- **Action:** apply D, approved by the user on 2026-11-21. Priority lowering cannot be safely restored for every thread and helper on ordinary Unix users.

## Milestone 1: Documentation and contract — completed

Depends on: none

- [x] Run the fresh Claude Opus max options check over this plan.
- [x] Merge the options check into the plan. Evidence: `.context/postcss-reuse-across-edits/options-check.md`.
- [x] State the approved preparation, affinity, fresh-state, and release rules in the protocol.
- [x] Update the memory contract for children created by Bundle.
- [x] Update the relevant README entry points.

The new contract lives in the prepared-context section of the PostCSS page.
My design call, 2026-11-21: add the field name to the Methods table after the
generated type exists. This keeps the existing 250-line page within its cap.
Evidence: `.context/postcss-reuse-across-edits/m1-docs-report.md`.

## Milestone 2: Fresh preparation and ownership

Depends on: 1

- [ ] Add failing event-order and lifecycle tests before implementation.
- [ ] Add optional Rust-owned preparation metadata and regenerate TypeScript.
- [ ] Prepare the child during Bundle without delaying the bundle on configuration loading.
- [ ] Pin subsequent stylesheet calls and disposal to the preparation's sidecar.
- [ ] Prepare eligible sidecar bundle-reuse calls, and keep rendering placement ready without unnecessary restore work.
- [ ] Keep read evidence, errors, source roots, and class-map behavior equal to fresh processing.
- [ ] Release on failure, cancellation, replacement, and unused attempt completion.
- [ ] Count the prepared child in memory admission and retain bounded process ownership.
- [ ] Compare class addition and removal with fresh output.
- [ ] Compare config, plugin, imported-file, and toolchain changes with fresh output.
- [ ] Cover head and base with different configs, and stop during processing.
- [ ] Run each new asynchronous test ten times without changing its runner policy.

## Milestone 3: Scheduling policy, verification, and performance confirmation

Depends on: 2

- [x] Record the user's priority decision: D. Existing priority behavior needs no protocol change.
- [x] Keep the original priority. D adds no priority or scheduler code, so no restoration test is needed.
- [ ] Align the final field name and helper entry points. Remove the preparation status lines after implementation.
- [ ] Build matching main and branch toolchains with the required resource checks.
- [ ] Run targeted tests and the repository suite.
- [ ] Run the complete repository gate.
- [ ] Run local basic label and utility edits, plus the large React fixture comparison.
- [ ] Prove every published byte on basic, large HTML, large React, and the cloud catalogue.
- [ ] Count PostCSS children and measure cold ten-edit tree memory.
- [ ] Commit and push the implementation and send the SHA and harness commands to the orchestrator.
- [ ] Receive official basic, cloud, and memory confirmation without weakening the targets.

Before every large Cargo build, check `df -h` and `free -m`.
Require at least 15 GB of free disk.
Set `CARGO_INCREMENTAL=0` and `CARGO_PROFILE_DEV_DEBUG=0`.
Run one heavy job at a time.
Do not add a timeout, retry, or sleep.
Do not skip a test or weaken an assertion.

## Milestone 4: Review and pull request

Depends on: 3

- [ ] Review the pushed diff against `origin/main` with `implementation-review`.
      Check findings, apply the fix rounds, and record each outcome.
- [ ] Run checks for fixes, commit, push, and complete the required re-review.
- [ ] Delete this plan after all earlier tasks and review rounds finish.
- [ ] Open the pull request into main with dated decisions and a permalink to this plan.

Wait for final CI with the shared skill's `scripts/ci-wait.sh`.
Fix each branch-caused CI failure.
Record Site Lighthouse as unrelated and do not rerun it.
Send the final PR link and SHA to the performance orchestrator.
Leave every merge to that session.
