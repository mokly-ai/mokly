# Plan exactness requires a copied resolver model

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-19, from the checked wider alternative of review finding 1 on branch `calummoore/mokly-plan-reuse-editor-files-6dni`.
- **Location:** `packages/mokly/src/sidecar/plan-candidates.ts`; `crates/mokly-render/src/plan_inputs.rs`; `crates/mokly-render/src/edit_plans.rs`.
- **Reason:** The performance orchestrator chose plan-only candidate filtering on 2026-11-18. Replacing its whole-record and resolver-model decisions needs another call.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Plan record:** Saved import targets and filesystem observations from one stable compilation.
  - **Candidate model:** The audited esbuild lookup names that narrow directory comparisons only for plan admission.
  - **Per-import evidence:** Observations linked to the individual resolution requests that depend on them.
- **Background:** Serve captures its first published compilation. Later edits capture and store nothing. A current plan permits one esbuild attempt. An import absent from that plan resolves normally inside the attempt.
- **Problem:** Exact candidate filtering must copy every relevant native lookup rule. A hidden basename exposed one missing extension rewrite. The branch repairs that suffix rule and checks captured native selections, but the selection check cannot prove every hidden preferred sibling.
- **Impact if no action:** Each esbuild change needs another candidate audit. Unproved forms safely lose plan narrowing. A missed proved form can select a stale target during the current Serve session.
- **Root question:** How can Serve keep exact edit reuse without using a copied resolver model to admit saved targets?
- **Options:**
  - **A.** Keep the approved plan-only model, version pin, conservative fallbacks, native-selection check, and oracle cases. This keeps the current implementation and its audit cost. Effort: Small.
  - **B.** Replace candidate filtering with per-import evidence. Check each import's observations in Rust. Send current imports only, and resolve stale imports inside the same planned attempt. Retain whole directory observations for every reuse owner. Effort: Large.
  - **C.** Refresh the whole record during an idle captured compile. This adds scheduling and memory work. Edits before the refresh still fall back. Effort: Large.
- **Left out:** Whole comparisons alone fail the editor-file goal. Capturing every edit violates the no-capture rule. Esbuild's JavaScript API supplies no resolver probe trace. A kept build context does not remove classification by itself.
- **Shared assumptions:** Exact output, recorded inputs, and errors stay. Both 8 MiB bounds stay. Edits capture and store nothing. Source: `docs/protocol/mokly-sidecar-plans.md` and the performance orchestrator's call of 2026-11-18. Whole-record admission and copied candidate names are design choices. B removes both. C changes when stable capture occurs.
- **Wider fix:** B removes the copied candidate model from admission. Its dependency index must include shared and hidden observations without exceeding either bound.
- **Previous examples:** Extension-only `.js` omitted `.ts` and `.tsx` candidates until the checked suffix repair. [marked-hidden-basename-reuse.md](./marked-hidden-basename-reuse.md) records a related safe miss in the independent marked scan.
- **Related:** [serve-pause-warm-head.md](./serve-pause-warm-head.md), linked alternatives. It owns idle refresh. [serve-plan-record-start-cost.md](./serve-plan-record-start-cost.md), the same record and byte bounds. A new per-import index changes retained size and start work.
- **Recommendation:** B for a future replacement. It removes the resolver-model dependence instead of detecting individual omissions. The current approved branch keeps A.
- **Action:** ask the user before replacing the approved design, because B changes whole-record admission and plan-only candidate filtering. This follow-up does not block the approved G change.

Before choosing B, measure its index on the real mokly-cloud head and base.
The earlier example had 5,137 planned imports and 14,530 observations.
Four direct imports depended on the edited Action directory. That count is a proxy, not an evidence ownership index.
The real catalogue had 13,057 imports and 22,927 head observations before the indexed-path change.
Keep one esbuild attempt for a usable plan and full resolution for every uncovered or stale import.
Prove output, recorded inputs, and errors against the native-first path before changing the decision.
