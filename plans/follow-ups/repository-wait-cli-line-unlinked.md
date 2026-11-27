# The repository wait unlinks a known CLI line

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-27, from the check of review finding 1 on the branch `calummoore/multiple-org-configuration-error-9mms`, outside that branch's scope.
- **Location:** `packages/app/src/screens/account/choose-repository-screen.tsx:79` (`ChooseRepositoryWait`), `docs/protocol/cloud/product-mockups-account.md:142-143`, `packages/app/src/_tests_/setup-waits.spec.ts:136-163` (the repository step part of "every setup step waits in its own layout"), `docs/mockups/src/entries/product/account/choose-repository/index.mockup.tsx:56-63` (the `loading` page), `docs/mockups/src/screens/product/account/choose-repository-screen.tsx:56`, `docs/mockups/src/screens/product/account/cli-link.tsx`, `docs/mockups/src/_tests_/onboarding-wait-cases.ts:41-50` and `docs/mockups/src/_tests_/onboarding-waits.test.ts:134-140`.
- **Reason:** A changes the requirement of `product-mockups-account.md:142-143` and the design call of `plans/loading-states-match-content.md:191-193`, and no user decision covers that change.

- **Terms:**
  - **Repository step:** The Mokly Cloud form at `/:workspace/-/new` where a person chooses the GitHub repository of a new project.
  - **CLI line:** The line "Publish with the CLI instead" under the step. It opens the CLI form at `/:workspace/-/new/cli`, which `workspaceCliProjectPath(workspace.slug)` builds.
  - **Wait:** What a screen draws while a read that it needs runs, as the **Wait** paragraph of `docs/protocol/cloud/folio-chrome.md` says.
  - **Reviewer:** A workspace role that creates no project, so the step draws no CLI line for a reviewer.
  - **Free-plan line:** A line that the step draws for a workspace on the free plan.
- **Background:** `ChooseRepositoryWait` draws the step while the session, the workspace or the repositories are read. During the session and workspace reads it has no workspace record, so it does not know the reader's role. During the repositories read it has the record and uses it for the install state, the free-plan line and the reviewer rule. The local `cliLine(workspace?)` draws a link when it gets a workspace and text when it does not. `product-mockups-account.md:142-143` says: "A wait draws the line as text with no link, because its target needs the workspace's slug."
- **Problem:** `ChooseRepositoryWait` calls `cliLine()` with no argument, so the CLI line is text also during the repositories read, when the record is known. The stated reason does not hold on this step, because the address `/:workspace/-/new` holds the slug in every read. **Back** on the install step and **Manage repository access** on this step stay live in their waits.
- **Impact if no action:** While the repositories load, a person who wants the CLI form must wait, though its address and their role are known.
- **Root question:** When should the repository step's wait draw the CLI line as a link?
- **Options:**
  - **A.** Pass `workspace` to `cliLine` in `ChooseRepositoryWait`, so the line is a link during the repositories read. Keep the text form during the session and workspace reads, where the role is not known. Change `product-mockups-account.md:142-143` to give that reason. Add a mockup drawing for the repositories read beside the `loading` page, which now draws the workspace read and the repositories read as one drawing, and change the mockup files and tests in **Location**. Change the spec to expect the link during the repositories read. Effort: Medium.
  - **B.** Change nothing. The doc already requires the text form in every wait. The line keeps waiting for a read that it does not need. Effort: Small.
- **Left out:** A link in every wait, built from the slug in the address. During the session and workspace reads the step does not know whether the reader is a reviewer, who gets no line, so the link could appear and then go.
- **Wider fix:** None in this item. The rule for every link in a wait is the question of `plans/follow-ups/wait-rule-link-clause.md`.
- **Previous examples:** None found of the same problem.
- **Related:**
  - `plans/follow-ups/wait-rule-link-clause.md`, work that waits for the answer: its option A states the rule that this item's option A applies, so answer that item first.
  - `plans/follow-ups/install-step-back-opens-new-workspace.md`, a weak link: it can change where **Back** goes on the install step, which this item uses as the model of a live link.
- **Recommendation:** A. The step knows the address and the role during the repositories read, so the line can be a link as **Back** is.
- **Action:** ask the user, because A changes the requirement of `product-mockups-account.md:142-143`, and no recorded user decision covers it.
