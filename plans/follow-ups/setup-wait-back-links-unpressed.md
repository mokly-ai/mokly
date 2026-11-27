# Setup waits check Back without pressing it

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from the check of review finding 7 of round 2 on the branch `calummoore/multiple-org-configuration-error-9mms`.
- **Location:** `packages/app/src/_tests_/setup-waits.spec.ts:75` (the install step's workspace wait) and `:102` (the CLI form's workspace wait).
- **Reason:** That branch changed only the manage link of the repository step's wait, not these links.

- **Terms:**
  - **Wait:** What a screen draws while a read that it needs runs.
  - **Back:** The link that the install step and the CLI form draw to the step before them. On the install step it opens `/new`. The workspace step and the repository step draw none.
  - **Held read:** The test helper `holdRead` in `setup-waits.spec.ts`, which keeps one API read open until the test releases it.
- **Background:** The install step and the CLI form keep **Back** as a live link while their workspace read runs, because its target needs nothing from the read. The walk "every setup step waits in its own layout" holds each read and checks the wait.
- **Problem:** The walk checks only that **Back** is a visible link. A change that blocks presses during a wait, for example `inert` on the panel or a handler that does nothing, would pass.
- **Impact if no action:** A wait could stop **Back** from working with no failing test.
- **Root question:** How do the tests prove that **Back** works while a setup step waits?
- **Options:**
  - **A.** In the existing walk, press **Back** in one of the two waits before the read is released, and assert the step that opens. Then return with `page.goBack()` and release the held read, because the next parts of the walk (`:77-81` and `:103-104`) expect the step. Effort: Small.
  - **B.** Add a Node render test of each waiting step that presses **Back** with the press doubles of `packages/app/src/_tests_/press-doubles.ts`, with `packages/app/src/_tests_/dom.ts` for the document. It misses blocks from CSS or `inert`. Effort: Small.
- **Left out:** A new browser spec. It would repeat the setup that the walk already has. Only two real places exist: the browser walk and a Node render test.
- **Wider fix:** None. The `testing` skill rule that a test names a realistic break already covers the class.
- **Previous examples:** The repository step's wait presses **Manage repository access** in the same walk (`setup-waits.spec.ts:164`).
- **Recommendation:** A. It tests the press where a person meets it, with the setup that exists.
- **Related:**
  - `plans/follow-ups/wait-rule-link-clause.md`, the same links: its option C turns **Back** into text in the waits, and the branch that applies it replaces this press with a text check.
  - `plans/follow-ups/install-step-back-opens-new-workspace.md`, the same link: its option A makes the install step's **Back** depend on the read, and the branch that applies it changes this check.
  - `plans/follow-ups/repository-wait-cli-line-unlinked.md`, the same walk: both edit `setup-waits.spec.ts`.
- **Action:** fix after merge, apply A, because the links are outside that branch's change, and the test pins the behaviour in force, which each related item's branch would change together with its own check.
