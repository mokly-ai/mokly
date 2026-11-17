# Harness comment reads "an `Workspace`"

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77), review finding 5.
- **Location:** `apps/app/src/_tests_/harness.ts:30`.
- **Reason:** Code structure findings wait for the user under the review-fix rule.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. Line 30 still reads "the Milestone 1 review found an `Workspace`". The problem is in a comment only, not in runtime behaviour.
- **Category:** Code structure.

- **Terms:**
  - **`ApiBody`:** A helper type in `apps/app/src/_tests_/harness.ts` that types the answer body a browser test fakes for one API operation.
- **Background:** The browser tests under `apps/app/src/_tests_` sometimes stand in for an API answer. The `ApiBody` type makes such an answer carry every field of the contract. Its doc comment records why: an earlier review found a hand-written literal without the `plan` field. The rename of PR #77 changed the noun in that sentence from `Organization` to `Workspace`.
- **Problem:** Line 30 now reads "found an `Workspace` literal". The article "an" does not fit the new word. The sentence also names a type that did not exist when that review happened.
- **Impact if no action:** No user sees the text. A reader of the comment stumbles on the grammar and may doubt the history it records.
- **Root question:** How does the comment record the past review in correct words?
- **Options:**
  - **A.** Change "an `Workspace` literal" to "a `Workspace` literal". The comment then names the current type. Effort: Small.
  - **B.** Restore "an `Organization` literal". The comment then records the history as it was, like the mockup ids that PR #77 kept. Effort: Small.
  - **C.** Search the repository once for "an workspace", "an `Workspace`" and "a organization", and fix each hit. On the PR #77 branch, this option was a step before the pull request opened. Effort: Small.
  - **D.** Write "the Billing plan's Milestone 1 review found an `Organization` literal". The history keeps its words, and the plan name makes the review findable. The Billing plan is no longer on `main`, so a reader finds it only in the Git history. Comment only. Effort: Small.
  - **E.** End the sentence at "a fixture nobody re-read." and drop the clause after the colon. Comment only. Effort: Small.
- **Left out:** A grammar lint. It adds a new gate, which the repository rules block without the user's approval.
- **Wider fix:** C. It is a one-time detection step. No structural fix exists for an article that a mechanical rename leaves behind. The PR #77 review ran the search over the paths of its branch and found only this case.
- **Previous examples:** None found. The PR #77 review found no comparable fix in the commit history of `origin/main`.
- **Recommendation:** D. The sentence records a past event, so it keeps the past name and gains the plan name. The first pass recommended A.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves code-structure findings to the user.
