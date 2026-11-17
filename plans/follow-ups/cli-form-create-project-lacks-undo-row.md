# CLI form Create project has no undo row

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 9 of the Milestone 5 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/app/src/_tests_/settings/undoable-writes.ts:5-18` and `ts/app/src/_tests_/settings/writes.spec.ts`.
- **Reason:** PR #69 merged on 2026-10-28 with the finding open, and the workspaces change left it with that plan. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `undoable-writes.ts` still has no CLI form row. The CLI form writes through `useWrite`, as the row needs.
- **Category:** Test.

- **Terms:**
  - **Undoable write:** A write whose input the reader can take back. A failure then goes away with the input that caused it.
  - **CLI form:** The step at `/:workspace/-/new/cli` that creates a project from a typed repository identity.
- **Background:** `undoable-writes.ts` lists every write whose input the reader can undo, and `writes.spec.ts` asserts the property for each. PR #69 removed the typed repository path, so its create-project row left the list. The repository step is a select, and its header says that a choice has no way back. The review of PR #69 found two live paths untested. One was the install refusal. The other was create-project with a typed input.
- **Problem:** The install refusal now has a test at `ts/app/src/_tests_/viewer-mobile.spec.ts:395-408`. The workspaces change then added the CLI form, which has a typed Repository field and Create project. `undoable-writes.ts` has no row for it. The form clears a failure when the repository or the slug changes, so no current product failure is known.
- **Impact if no action:** A regression that keeps a stale refusal after the reader changes the typed repository passes the suite.
- **Root question:** Does the suite prove the undo property for every typed project input?
- **Options:**
  - **A.** Add a CLI form row to `undoable-writes.ts`: fill Repository, make Create project fail, then empty the field. Effort: Small.
  - **B.** Leave the property untested for the CLI form. Effort: Small.
- **Left out:** A test for every write in the app. The list already names the rule and its owners.
- **Wider fix:** None. The list is already the one place for this property.
- **Previous examples:** The removed typed repository path had such a row before PR #69.
- **Related:** `plans/follow-ups/write-failure-survives-changed-input.md`, same table. Its fix adds a "changed, not emptied" variant to `undoable-writes.ts`.
- **Recommendation:** A. The review recommended a create-project row, and the CLI form is the typed path today.
- **Action:** ask the user, because condition 6 holds: the finding concerns a missing test, a category that the review-fix rule does not let an agent fix alone.

The review graded the finding Low severity and Small effort. The CLI form writes through `useWrite` at `ts/app/src/screens/account/cli-form-screen.tsx:89-114`, so a row can drive it.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L244-L261) of the deleted plan.
