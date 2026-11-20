# Workspace pane mockup lacks the role fact

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from Milestone 5 of [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77). Updated on 2026-10-30 with Milestone 13L of the deleted `plans/mokly-cloud-follow-ups.md`, which recorded the same gap.
- **Location:** `packages/app/src/settings/panes/workspace-pane.tsx:228-241`, `docs/mockups/src/screens/product/settings/workspace-pane.tsx:73-100`, `docs/protocol/cloud/product-mockups-settings.md:24` and `docs/protocol/cloud/settings-dialog.md:106`.
- **Reason:** The mismatch is already on `origin/main`, so a separate branch fixes it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still shows Your role, and the drawn facts still list only Plan, Slug and GitHub accounts. Both doc rows still omit the role.
- **Category:** Mockup.

- **Terms:**
  - **Fact row:** A label and value pair that a settings pane shows, such as **Your role**.
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
- **Background:** The list below gives the facts.
  - The app's Workspace settings pane draws a **Your role** fact at `packages/app/src/settings/panes/workspace-pane.tsx:167`, as the Organization pane on `main` did before PR #77 renamed it.
  - The Workspace pane mockup has no such fact. Its loaded drawings list Plan, Slug and GitHub accounts. No file under `docs/mockups/src` writes "Your role".
  - The legacy backlog, in Milestone 13L, first found the gap on the Organization pane. It asked to draw the role on the pane's canonical, state and installation pages. Every drawing of the pane then carries the facts that it reads.
  - Today those drawings are `product/settings/workspace` and its state screens, from `docs/mockups/src/screens/product/settings/workspace-pane.tsx`.
  - The backlog also asked to record the fact in the docs. Both rows omit it today: `docs/protocol/cloud/product-mockups-settings.md:24` and `docs/protocol/cloud/settings-dialog.md:106`.
- **Problem:** Every loaded drawing of the Workspace pane is one fact short of the running pane, and the docs do not name the fact. The loading and failed drawings show no loaded facts, so the role does not belong there.
- **Impact if no action:** Reviewers judge the pane without one of its facts. The parity suite compares control labels and state titles, not the facts that a pane reads, so a change to the role fact stays unseen.
- **Root question:** Does the Workspace pane show the reader's role, and do its drawings show it too?
- **Options:**
  - **A.** Draw the role fact on every loaded drawing of the Workspace pane, and add it to both doc rows. Leave the loading and failed drawings as they are. Effort: Small.
  - **B.** Remove the role fact from the app, so that the pane matches its drawings. It removes shipped behaviour. Effort: Small.
- **Left out:** Keep the difference. The drawings then stay short of the pane, which fails the goal.
- **Wider fix:** `plans/follow-ups/parity-skips-pane-facts-and-links.md` widens the parity suite to fact rows. It is stricter validation, so it waits for the user.
- **Previous examples:** On 2026-10-29 the workspaces change found that the projects panel mockup named one GitHub account, while the app named every account. Its Milestone 5A redrew the mockup.
- **Related:** `plans/follow-ups/parity-skips-pane-facts-and-links.md`, same cause. That check would hold the role fact once it is drawn.
- **Recommendation:** A. The app has always shown the role, and the backlog asked for the drawing.
- **Action:** ask the user, because condition 3 holds: the fix decides between the mockup and the product, which the review-fix rule leaves to the user.

The review of PR #77 said that a fix decides which side is right, so it needs the user's answer.

Source: [Milestone 13L](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L342-L363) of the deleted plan.
