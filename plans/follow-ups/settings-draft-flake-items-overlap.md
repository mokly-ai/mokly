# Two items record one settings draft flake

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the check of review finding 11 of the branch `calummoore/ci-fix-site-lighthouse-hn4n`.
- **Location:** `plans/follow-ups/flaky-settings-surface-address.md` and `plans/follow-ups/settings-draft-rotation-test-flakes.md`.
- **Reason:** Both items are on `main`, and the branch that found the overlap changes neither.

- **Terms:**
  - **Follow-up item:** one Markdown file under `plans/follow-ups/` that holds every fact of work that waits until after a merge.
- **Background:** The `plans` skill says that when one item covers the problem of another, the two items merge. When two linked items stay apart, each gets a **Related** line that names the other.
- **Problem:** Both items record the test "a draft survives the surface changing under it" in `packages/app/src/_tests_/settings/drafts.spec.ts`, with the same expected and received query of the address. Neither item names the other. `settings-draft-rotation-test-flakes.md` says "Related: None."
- **Impact if no action:** A fixer of one item can miss the evidence of the other, and the two items can get different fixes for one flake.
- **Root question:** How do the records of this flake hold all their evidence in one place?
- **Options:**
  - **A.** Merge the two items into the older one, `settings-draft-rotation-test-flakes.md`. Keep every fact of both, and delete the other file. Effort: Small.
  - **B.** Keep both items, and give each a **Related** line that names the other. Effort: Small.
- **Left out:** A third approach is not real: the records either merge or link.
- **Wider fix:** None. The rule of the `plans` skill already covers the case.
- **Previous examples:** `plans/follow-ups/item-fields-after-added-facts.md` records missing **Related** lines between items.
- **Recommendation:** A. One record of one flake holds its evidence together.
- **Action:** fix after merge, apply A, because both items are outside the scope of the branch that found them.
