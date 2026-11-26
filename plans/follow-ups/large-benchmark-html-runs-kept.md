# Large benchmark specs keep their HTML runs

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #574), test-scope item 19B.
- **Location:** `tests/browser/large_watch.spec.ts`, `tests/browser/large_changes.spec.ts`, `scripts/large/watch_edits.ts:40-42`, `tests/fixtures/large/html.ts:124`.
- **Reason:** The user's test-scope decision removes the HTML runs, but its break proof failed, and the testing rules keep a test whose removal leaves a requirement untested.

- **Terms:**
  - **Large benchmark tool:** the opt-in tool under `scripts/large/` that builds a large catalogue, makes edits, and measures Serve and Changes. The two specs run it on a small catalogue in the required browser suite.
- **Background:** Each spec runs the tool twice, once with an HTML catalogue and once with a React catalogue. A recorded decision in `docs/protocol/ci-test-timing.md` keeps the React watch journey as one combined test. On 2026-11-26 the user's test-scope decision 19B chose to keep the React runs only.
- **Problem:** No kept test covers the HTML path of the tool. A break of the HTML component edit text in `scripts/large/watch_edits.ts:40-42` failed only `large watch delivers browser evidence for html`. A break that gives HTML screens the class of the unrelated CSS rule in `tests/fixtures/large/html.ts:124` failed only `large changes delivers browser evidence for html`, with "The unrelated CSS edit produced Changes". The React runs, `large_watch_failure`, and 55 Node tests passed with each break.
- **Impact if no action:** The HTML runs stay. They cost about 4.5 s and 6.0 s of test time. Removing them saved only about 2 s locally, because the React runs then start without the HTML warm-up.
- **Root question:** Should the HTML path of the large benchmark tool keep a required test?
- **Options:**
  - **A.** Keep both HTML runs. Effort: Small.
  - **B.** Add a Node test of the tool's HTML edit definitions and HTML fixture classes, then remove the HTML runs. Effort: Small.
  - **C.** Remove the HTML runs and accept that the HTML path has no test. Effort: Small.
- **Left out:** Make both specs opt-in. The user did not choose that option of item 19 on 2026-11-26, and it changes the recorded decision of `docs/protocol/ci-test-timing.md`.
- **Wider fix:** None. The removal rule of the `testing` skill already keeps a test whose proof fails.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/large-benchmark-memory-default.md` names the same tool. It is not linked to this question.
- **Recommendation:** A. The measured saving is about 2 s, which is less than the cost of B or the gap that C leaves.
- **Action:** ask the user, because the user's decision 19B removes these runs and only the user can confirm that they stay.
