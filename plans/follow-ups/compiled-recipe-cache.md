# Cache unused compiled recipes

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Design.
- **Category:** performance.
- **Background:** Compiled recipes are reusable JavaScript build plans. Mokly currently drops a recipe when its active use ends.
- **Problem:** Recompilation repeats work. Reuse needs input revalidation and a byte limit that the user has not selected.
- **Impact if no action:** Repeated compilations keep the current startup cost. Memory use stays bounded by the current lifetime.
- **Root question:** How should Mokly cache unused compiled recipes?
- **Options:**
  - **A.** Keep the current lifetime. Do not cache unused recipes. Effort: Small.
  - **B.** Measure recipe sizes. Add one fixed byte budget with input revalidation. Effort: Medium.
  - **C.** Add a user-configurable cache budget with input revalidation. This adds configuration behavior. Effort: Large.
- **Left out:** An unbounded cache fails the memory-bound requirement.
- **Wider fix:** B.
- **Previous examples:** F8 decision 59 in the completed plan selected a bounded cache as later work.
- **Recommendation:** B. A measured fixed limit adds reuse without a new public setting.
- **Action:** ask the user, because condition 4 holds. The cache byte budget has a real memory and reuse trade-off.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5417).
