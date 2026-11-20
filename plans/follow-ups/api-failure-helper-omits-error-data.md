# API failure helper omits the error data

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope note of the Milestone 6 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/app/src/_tests_/api-responses.ts:7-28`.
- **Reason:** The helper predates the merge of PR #64 into PR #69, so that review left it for a separate branch. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `apiFailure` still accepts any reason and writes no `data` field. The generated contract requires `data` for `version-conflict`, `duplicate-project` and `plan-required`.
- **Category:** Test.

- **Terms:**
  - **Error envelope:** The `rpc-error` response body: `code`, `reason`, `message`, `request_id` and optional `data`.
- **Background:** PR #64 typed the `data` of the error envelope in the generated contract on 2026-10-27. Some reasons now carry required data, for example `duplicate-project`, which the repository step reads through `dataFor("duplicate-project")`. The browser test helper `apiFailure` builds an error body from a reason and a message only.
- **Problem:** For a reason that carries data, `apiFailure` builds an envelope that the typed contract forbids. The problem is what the helper allows. This item does not claim that a current call routes a data-carrying reason.
- **Impact if no action:** A test can route a failure that the API never sends, and pass while the product's data path stays untested. Each new data-carrying reason adds a caller that needs the fix.
- **Root question:** How do routed test failures match the typed error contract?
- **Options:**
  - **A.** Give `apiFailure` a `data` parameter typed by the reason, and require it for reasons that carry data. Effort: Small.
  - **B.** Forbid `apiFailure` for data-carrying reasons, and route those failures by hand. Effort: Small.
- **Left out:** None. A and B are the two shapes of the helper.
- **Wider fix:** A. The type then makes a wrong envelope fail to compile.
- **Previous examples:** None found.
- **Recommendation:** A. It makes the compiler check every routed failure.
- **Action:** ask the user, because condition 6 holds: the finding concerns a test helper, a category that the review-fix rule does not let an agent fix alone.

Source: [the Milestone 6 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L265-L279) of the deleted plan.
