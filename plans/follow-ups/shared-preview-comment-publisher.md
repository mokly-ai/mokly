# Preview comment steps copy one upsert rule

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, the wider fix of its review finding about duplicate preview comments.
- **Location:** `.github/workflows/preview.yml`, the steps "Comment on pull request", "Mark preview inactive", "Publish running comment", and "Publish final comment". `.github/workflows/site.yml`, the steps "Comment on pull request" and "Mark preview inactive". `infra/tests/test_release.py:411-413`, which checks strings of the workflow text.
- **Reason:** The direct fix stays inside the six steps of the diff. One shared publisher needs a new script, its test, and a checkout in the `close-pr` job.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Preview comment:** the bot comment that shows the state and the links of the preview of a pull request. `docs/ops/preview.md:35` asks for one such comment.
  - **Upsert rule:** list the comments, update the first bot comment with the marker, or create one.
- **Background:**
  - Six `actions/github-script` steps each hold their own copy of the upsert rule, with slightly different matches: four match `comment.user?.type === 'Bot'` and a body that contains the marker, two match `github-actions[bot]` and a body that starts with it.
  - On 2026-11-26 the steps got `retries: 3`, because GitHub lost the reply of a `createComment` call twice on 2026-11-25. The client then reports status 500 with "Unexpected end of JSON input". A retried create can save the comment twice, so each create now lists the comments again and deletes every match except the oldest.
  - No test runs the scripts. A change to the rule must be copied into six places.
- **Problem:** The rule of one current preview comment lives in six copies of inline workflow code, with no test.
- **Impact if no action:** A later change can fix one copy and miss another, and a duplicate or stale comment then returns.
- **Root question:** How do all preview comment steps share one tested way to keep one current comment?
- **Options:**
  - **A.** Keep the six copies, and align their matches to one predicate. Effort: Small.
  - **B.** Move the rule into one publisher script that every comment step loads. Keep request retries. Add a unit test with a fake client that saves a comment, loses the reply, and checks that one current comment remains. Replace the string checks of `infra/tests/test_release.py:411-413` with that test. Effort: Medium.
- **Left out:** A third-party sticky-comment action moves the same code outside the repository and still needs this rule, in jobs that hold write tokens.
- **Wider fix:** B. One tested publisher covers every caller, also a new one.
- **Previous examples:** Commit `37b7dc341` added the marker lookup to the first Preview workflow.
- **Related:** `plans/follow-ups/preview-jobs-share-one-comment-marker.md`. Both change the same steps, so one branch can do both.
- **Recommendation:** B. The rule then has one place and one test.
- **Action:** fix after merge, apply B, because it needs a new script, a test, and a checkout outside the steps that the finding changed.
