# Absolute paths reuse evidence

Status: Active. On branch `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, no pull request yet. The completing pull request deletes this plan.

Mokly compiles catalogue JavaScript with native esbuild resolution first.
Its reuse evidence omits mapped targets when an absolute request matches a
TypeScript `paths` key. Adding an earlier target can change fresh output
while reuse still serves the old output.

The performance orchestrator approved this work on 2026-11-18.
The user's 2026-11-16 instruction gives that orchestrator the design calls
for Changes speed and reliability. The instruction also forbids changes
that can exhaust machine memory. This task authorizes implementation,
review, and an open pull request. The performance orchestrator owns merging.

Contract owners:

- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md).
- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Bundle cache](../docs/protocol/mokly-base-cache.md).
- [Mokly package](../packages/mokly/README.md).

## Design

### 1. Absolute mappings must invalidate every reuse owner

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`.
- **Terms:**
  - **Reuse evidence:** File and directory observations that determine whether compiled catalogue JavaScript remains current.
- **Background:** Mokly keeps compiled catalogue JavaScript in memory and on disk. Serve can also keep a resolution plan.
- **Problem:** An absolute request bypasses mapped-target capture. Creating an earlier mapped target leaves the old evidence current.
- **Impact if no action:** A later compile selects a different module while reuse serves stale JavaScript.
- **Root question:** How can each captured owner preserve native-first module selection when a `paths` key matches an absolute import?
- **Options:**
  - **A.** Mark matching absolute requests incomplete. This loses captured reuse for the affected form. Effort: Medium.
  - **B.** Capture all matching mapped targets before the absolute return. Keep written-path observations and whole comparisons. Effort: Medium.
  - **C.** Resolve each import again before every reuse. This adds resolver work to unchanged compilations. Effort: Large.
  - **D.** Add a class test for every mapped request and target addition. This needs approval for a test of the class. Effort: Medium.
- **Left out:** Change nothing fails the correctness goal. Disabling all reuse breaks the requirement to preserve other reuse speed.
- **Wider fix:** The shared evidence producer and whole comparisons already cover the owner class. B fixes its omitted absolute branch directly.
- **Previous examples:** Workspace 54 reproduced stale in-process and disk reuse. Ordinary relative two-target mappings already capture earlier candidates.
- **Recommendation:** B. The options check confirmed conservative capture for exact keys, wildcard patterns, and target order.
- **Action:** fix now, apply B to supported target forms. Apply A when a matching absolute request uses target syntax the reader cannot represent safely.

Shared assumptions:

- Native-first output defines correct selection. Source: this task and the recipe protocol. Kept.
- Every other reuse retains its behavior and speed. Source: this task. Kept.
- No new setting, gate, retry, or memory risk. Source: this task. Kept.
- Marked Serve edit reuse needs a separate probe. Source: the recipe protocol and this task. Kept.

Performance orchestrator calls of 2026-11-18:

- The initial call chose A. The updated call prefers B because the probe graded capture Small and it preserves reuse.
- Prefer B when it stays small. The updated probe graded it Small and it preserves reuse for the rare form.
- Fall back to A if exact and wildcard mapping behavior cannot be confirmed or owner regressions do not pass.
- Probe marked edit reuse with the same addition. Decline only unsafe compilations by the smallest correct rule if needed.
- Record B as a follow-up only if A ships. Ordinary relative mappings and unmatched absolute imports keep reuse.

Options check of 2026-11-18: B is conservative for ordinary exact and wildcard targets. Its code is Small, and the requested owner tests make the milestone Medium.
The check found that `${configDir}` targets remain unsafe under a simple loop move.
The marked owner is independent and belongs to item 2.
The check suggested D. It is not selected because the task requests specific owner regressions, not a new class gate.
The task explicitly requests those owner regressions, so the shared testing skill does not remove them.
Evidence belongs in `.context/absolute-paths-reuse-evidence/options-check.md`.

Orchestrator call of 2026-11-18: keep B for represented targets and use the authorized A fallback for unsupported absolute mapped targets.
Reason: the current reader does not expand `${configDir}`, so literal observations can stay current after native selection changes.
The implementation must also preserve literal target text for exact keys, or decline that unsupported absolute form.
Record any lost exact reuse in a follow-up item rather than extending the shared reader in this defect fix.

### 2. Unknown inherited mappings affect edit reuse

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts`.
- **Terms:**
  - **Package extends:** A TypeScript configuration that inherits settings from an installed package.
- **Background:** Mokly generates absolute imports for catalogue entries. A wildcard mapping can redirect these imports too.
- **Problem:** The existing configuration reader rejects package extends. A conservative marker check would decline their marked edit reuse without knowing whether an absolute mapping exists.
- **Impact if no action:** Keeping those markers can leave stale selection. Declining them can cause extra JavaScript compiles after other edits.
- **Root question:** How should the absolute-mapping fix protect marked edits when the existing reader cannot classify their configuration?
- **Options:**
  - **A.** Withhold the marker when an absolute request's configuration cannot be classified. This preserves correctness but broadens the loss of edit reuse. Effort: Small.
  - **B.** Extend configuration classification to cover native configuration inheritance before deciding about the marker. No native-complete loader exists here. Effort: Large.
  - **C.** Record mapped-target evidence during Serve edits. This changes the chosen edit capture contract and restores work to every edit. Effort: Large.
  - **D.** Defer the marker change. This changes the task goal and leaves demonstrated stale absolute reuse open. Effort: Small.
  - **E.** Make generated entry imports immune to mappings, then classify authored absolute imports. This changes native entry selection. Effort: Medium.
  - **F.** Add mapped-target directories for bare and absolute forms to all live checks. This reaches the wider coherence task. Effort: Large.
- **Left out:** Trusting unchanged consumed files misses earlier unconsumed mapped targets. Ignoring generated imports misses mappings of entry files themselves.
- **Wider fix:** F covers mapped live reuse more broadly. Workspace 63 owns separate coherence work.
- **Previous examples:** The pre-fix probe reused stale marked code after an earlier target appeared. A native probe also redirected a generated entry import through `*`.
- **Recommendation:** A. It closes the required absolute defect with the smallest change. The check recommended D, which fails the current task goal.
- **Action:** ask the user, because A changes the task's requirement to keep every other reuse unchanged.

Shared assumptions:

- Generated absolute entry imports need the same protection. Source: native probe and the task's correctness goal. Kept.
- The fix must preserve native-first selection. Source: this task. Kept.
- Reuse for unrelated configurations stays unchanged unless the performance orchestrator approves an exception. Source: this task. Kept.

The second-pass check also reproduced the marked gap for bare mappings.
That pre-existing gap does not remove this task's requirement to fix the absolute form.
The parent decision was sent on 2026-11-18. It blocks only marker policy changes.

## Milestone 1: Contracts and follow-up record

Depends on: none

- [x] Check the existing contracts and record any required documentation changes through the docs implementor.
- [x] Run the read-only options check and merge its result into this plan.
- [x] Validate, commit, and push the initial plan without implementation changes.

## Milestone 2: Reproduce and fix the omitted targets

Depends on: 1

- [ ] Delegate to the non-ui implementor. Add red-first regressions for in-process reuse, released seeding, restarted disk reuse, strict build, and Serve plan reuse.
- [ ] Probe marked uncaptured Serve edit reuse. Add a red-first regression and the smallest correct fix if needed.
- [ ] Preserve reuse for ordinary relative mappings and unmatched absolute imports.
- [ ] Apply B if its conditions pass. Otherwise apply A and record B in a follow-up item.
- [ ] Protect absolute mapped interpolation and exact targets that the current reader cannot represent. Record deferred exact reuse.
- [ ] Check the delegated result against the design calls and repository rules.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 2

- [ ] Run targeted tests and each new asynchronous test ten times. Record red failures and test cost under `.context/`.
- [ ] Run the repository suite and complete gate. Use Git 2.45 or later, git-lfs, and pinned Bun.
- [ ] Check disk and memory before large Cargo builds. Use one build at a time, `CARGO_INCREMENTAL=0`, and a checkout-specific target directory.
- [ ] Measure `examples/basic` before and after if the change touches a hot path.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` after the push with the implementation-review skill. Apply its finding checks, fixes, and review rounds.
- [ ] Delete this plan under the plans skill. Keep dated calls and a plan permalink in the pull request description.
- [ ] Open the pull request into `main`. Wait for final CI with `scripts/ci-wait.sh`. Report to the performance orchestrator and do not merge.
