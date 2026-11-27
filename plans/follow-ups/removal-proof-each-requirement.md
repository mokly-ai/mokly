# Removal proofs can miss a row's second requirement

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #567), the wider fix of its review findings on removed rows.
- **Location:** `skills/testing/references/removing-tests.md` of the shared skills repository `Firna-AI/skills`.
- **Reason:** The rule lives in another repository, so this branch cannot change it.

- **Terms:**
  - **Removal proof:** the step of the shared `testing` skill that breaks the product code once and shows that a kept test fails before a test is removed.
- **Background:** The test-scope change of 2026-11-26 removed browser rows of `packages/app/src/_tests_/settings/writes.spec.ts`. Each removed row needed a proof.
- **Problem:** A row can check two requirements, such as the busy binding of a button and the operation text that a screen reader hears. Two proofs broke only one requirement, and the review found the second requirement uncovered: the operation text of `members/save-role` and `tokens/confirm-revoke`, and the ordinary failure branch of `project/confirm-visibility`. The rows went back.
- **Impact if no action:** A later removal can pass its proof and still lose the only check of a second requirement.
- **Root question:** How does a removal proof cover every requirement of the removed test?
- **Options:**
  - **A.** Add a rule to `removing-tests.md`: list each requirement of the removed test, and break each one on the same code path. Effort: Small.
  - **B.** Do A, and add an example from this case. Effort: Small.
- **Left out:** A lint, because no tool can list the requirements of a test.
- **Wider fix:** A. The rule prevents the class.
- **Previous examples:** The three rows above, 2026-11-26. The Browser and
  Viewer test audit of the same day, branch
  `calummoore/test-audit-mokly-browser-and-viewer-din6`, review findings 2,
  3, 5, 6, 7, and 8: each removal, port, or merge passed its one break and
  still lost a check, such as visibility, a computed colour, an end-of-file
  flag, a first-load state, a directory index, or a version floor. Each lost
  check came back in that branch.
- **Recommendation:** B. The example shows the class better than the rule alone.
- **Action:** fix after merge, apply B, in the shared skills repository.
