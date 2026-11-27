# History casts a row address it can narrow

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch calummoore/click-on-row-ux-0nhj, review round 2.
- **Location:** `packages/app/src/viewer/panels/history.tsx:185` and `packages/app/src/viewer/panels/switcher.tsx:228-231`.
- **Reason:** The cast was on `origin/main` before the branch that found it.
- **Category:** Code structure.

- **Background:** The History panel follows a row with `row.href as string`. The row's type makes `href` optional, because the current entry has none. The switcher does the same job with a check that narrows `href` and needs no cast. The `typescript` skill asks to narrow a value instead of casting it.
- **Problem:** The cast hides a row with no address from the type check.
- **Impact if no action:** A later change that calls the follow path for a row with no address passes the type check and navigates to `undefined`.
- **Root question:** How does History follow a row only when the row has an address?
- **Options:**
  - **A.** Narrow `row.href` before the call, as `switcher.tsx` does, and remove the cast. Effort: Small.
- **Left out:** A shared helper for both panels. Only two callers exist, so one narrowing in each is simpler. Fewer than three approaches are real, because the fix is one check.
- **Wider fix:** None. The `typescript` skill rule against casts is in force.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the cast is older than the branch that found it.
