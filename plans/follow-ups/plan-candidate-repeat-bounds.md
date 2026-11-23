# Repeat shortcuts use hand-written room bounds

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from review finding 2 of branch `calummoore/mokly-plan-candidates-cpu-khht`: the wider fix that its finding check split off.
- **Location:** `packages/mokly/src/sidecar/plan-candidates.ts`, the room tests of `PlanCandidates.path`, `PlanCandidates.file`, and `PlanCandidates.add`; `packages/mokly/src/sidecar/plan-candidate-names.ts`, `nameChargeBound`; `tests/sidecar_plan_candidates_reference.test.ts`.
- **Reason:** The fix changes product code, and the performance orchestrator measured that code at `ab38cf844` and asked to keep it unchanged until the merge.

- **Terms:**
  - **Collector:** `PlanCandidates`, which collects the plan-only candidate names of a captured compile under a charge budget of 8,388,608 bytes. When a charge does not fit, it sets `overflow`, and the plan keeps no candidate names.
  - **Repeat shortcut:** one of three tests that skip work whose names are already stored: the walk stop of `path`, the duplicate test first in `add`, and the marker of completed `file(base)` calls.
  - **Room bound:** the free room that a shortcut requires before it skips. Today each shortcut computes it with `nameChargeBound(length)`, `3 + 6 × length`, from a length that the call site picks: the current path for the walk stop, the name for a duplicate, and the base length plus the longest extension plus 5 for a repeated `file(base)`.
- **Background:**
  - The earlier collector tests the JSON bytes of a duplicate name before its duplicate test, so a duplicate sets `overflow` when the free room is smaller than its bytes. The shortcuts keep that decision exactly: they skip only when the room covers every test that the skipped work would run.
  - Each bound is a hand-written formula. Two review rounds of the branch above found weakened forms of these formulas that the differential test missed: a `file` bound without the longest extension or without the base length, a walk-stop bound with the name length, 5 bytes per code unit instead of 6, and a bound without the container byte. The test now checks each repeat shape at its exact decision room, so these forms fail.
  - Nothing ties a formula to the checks that it covers. A new check in the skipped work can need more room than the formula gives, and only a test can find that.
- **Problem:** The room bounds repeat the arithmetic of the checks that they skip, so a change to one of those checks can make a bound too small.
- **Impact if no action:** A later change to the name checks, the extension loop, or the walk can leave a bound too small. A repeat near the budget then keeps candidate names that the earlier collector dropped, unless the differential test reaches that room.
- **Root question:** How do the repeat shortcuts know the room that the skipped checks need, without a second formula?
- **Options:**
  - **A.** Change nothing. The differential test checks each repeat shape at its exact decision room. Effort: Small.
  - **B.** Derive the bound from the checks. Each name charge and each `fit` value of a completed `file` call goes through one helper that keeps a collector-wide maximum. A shortcut skips only when the room is at least that maximum. Keep the directory and selected-target charges out of the maximum, because one large charge would turn every shortcut off. It needs no per-directory state. Measure the CPU of a fresh mokly-cloud bundle again, because the helper runs in the hot path. Effort: Medium.
- **Left out:** A per-directory maximum: it adds state for each charged directory, and a collector-wide maximum covers every repeat. Letting a repeat never overflow is `plans/follow-ups/plan-candidate-repeat-overflow.md`, which needs the user's decision; if the user chooses it, the bounds and this item go.
- **Wider fix:** B, because the bound then follows the checks.
- **Previous examples:** None found before the two review findings above.
- **Related:** `plans/follow-ups/plan-candidate-repeat-overflow.md`: its option B removes the room bounds, so this item waits for that answer.
- **Recommendation:** B, after `plans/follow-ups/plan-candidate-repeat-overflow.md` is answered. It removes a second copy of the check arithmetic, at the cost of one comparison per charge.
- **Action:** fix after merge, apply B, because it changes product code that the performance orchestrator measured, and its CPU cost needs a new measurement.
