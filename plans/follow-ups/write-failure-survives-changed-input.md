# A failure survives a changed input

- **Severity:** Low (estimate). **Likelihood:** Common. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 12N of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/settings/write.ts:117-122`, `:145` and `:175-177`, `apps/app/src/settings/panes/account-pane.tsx:75-89`, `apps/app/src/_tests_/settings/undoable-writes.ts` and `apps/app/src/_tests_/settings/writes.spec.ts:7-43`.
- **Reason:** The legacy backlog recorded it on 2026-09-18 for a later UI change, and its wider fix is Large.
- **Checked:** 2026-10-31, at commit `f568853e`. The bug is still open. `failureAfterInput` still keeps a failure while `sendable` stays true, so a changed valid input keeps the old failure.
- **Category:** Product bug.

- **Terms:**
  - **Undo property:** A failure belongs to the attempt that made it, so undoing the input of that attempt takes the failure with it.
- **Background:** `failureAfterInput(error, sendable)` keeps a failure while `sendable` is true. It runs on every change of `sendable`. The test "an undone input takes its failure with it" uses only rows that empty an input. Two forms carry local workarounds. The CLI form clears its refusal when the repository or the slug changes. The repository step clears it only when the slug changes.
- **Problem:** A reader who changes a refused input to a different non-empty value still sees the old refusal. For example, in the Account pane, a reader who changes a refused name to another non-empty name keeps the refusal. On the repository step, another repository or config path keeps it too. There, a changed slug or a short unsendable state clears it.
- **Impact if no action:** The screen shows a refusal for a value that the reader no longer sends. Each new form adds its own workaround.
- **Root question:** How does a failure leave when the input that caused it changes?
- **Options:**
  - **A.** Add the local workaround to each remaining form. Effort: Small.
  - **B.** Key `failureAfterInput` on what the attempt was made from, not on the boolean `sendable`. Add a "changed, not emptied" variant to `undoable-writes.ts`, and assert it in `writes.spec.ts`. Then remove the two local workarounds. Effort: Large (estimate).
    - `useWrite(done, sendable)` gets no input today. 31 production calls in 25 files use it, so a required input key changes every call. The source graded B Medium.
    - A key on the whole input clears the failure at the first change of that input. That is close to the left-out option. So B must also say when the failure leaves: at the first change of the sent value, or at the next attempt.
- **Left out:** Clear every failure on any keystroke. The reader then loses the cause while they correct it.
- **Wider fix:** B. One rule in `write.ts` replaces every local workaround.
- **Previous examples:** `apps/app/src/screens/account/cli-form-screen.tsx:95-100` and `apps/app/src/screens/account/choose-repository-screen.tsx:97-113`.
- **Related:** The list below gives the links.
  - `plans/follow-ups/cli-form-create-project-lacks-undo-row.md` adds a row to the same `undoable-writes.ts` table.
  - The confirmation rows in `apps/app/src/_tests_/settings/undoable-writes.ts:255-291` assert the undo rule that this fix changes. `writes.spec.ts:13-41` runs them.
- **Recommendation:** B. It fixes the property where it lives.
- **Action:** ask the user, because condition 3 holds: B changes the `useWrite` calls in 25 files, which is Large. No requirement says when a failure leaves after its input changes to another valid value.

Source: [Milestone 12N](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L397-L438) of the deleted plan.
