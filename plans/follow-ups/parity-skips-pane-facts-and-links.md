# Parity skips pane facts and external links

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 13N of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/_tests_/app-parity-reads.ts:37-45`, `docs/mockups/src/_tests_/control-labels.ts:6-22` and `docs/mockups/src/_tests_/app-parity-allowances.ts`.
- **Reason:** The fix widens a check, which is stricter validation, and it needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `drawnLabels` still reads control labels, pending labels and state titles only. No new validation is approved.
- **Category:** Test.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Pane fact:** A value that a settings pane shows in a fact row, such as "Your role".
- **Background:** `drawnLabels` collects control labels, pending labels and state titles. `controlLabels` reads Firna buttons and radios. Fact values and the labels of external links are not compared. That is how the Workspace pane's role fact stayed undrawn. `plans/follow-ups/workspace-pane-mockup-lacks-role.md` records that gap.
- **Problem:** A pane fact or an external link can differ between the mockup and the app, and no check reports it.
- **Impact if no action:** Gaps like the role fact keep appearing in panes, and only a review finds them.
- **Root question:** Which text that a screen shows must the parity suite compare?
- **Options:**
  - **A.** Keep the current scope. Effort: Small.
  - **B.** Widen the comparison to fact values and external-link labels. Effort: Medium.
    - The first run reports the fact copy of every pane at once.
    - Fix the product or the drawing for each difference, or allow it with an owner. An allowance must name a file under `plans/follow-ups/`.
    - Once the role fact is drawn, the check then holds it.
- **Left out:** Compare all visible text. It would report every layout sentence that the parity rules leave to review.
- **Wider fix:** B. It finds the class instead of each case.
- **Previous examples:** `plans/follow-ups/workspace-pane-mockup-lacks-role.md`.
- **Related:** `plans/follow-ups/workspace-pane-mockup-lacks-role.md`, same cause.
- **Recommendation:** B. Fact rows are part of what a pane says.
- **Action:** ask the user, because condition 3 holds: B adds stricter validation.

Source: [Milestone 13N](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L719-L746) of the deleted plan.
