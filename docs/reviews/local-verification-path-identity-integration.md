# Path Identity Main Integration Verification

On October 5, 2026, merge `f7ace878` integrated `origin/main` at `781da7ae`
into `calummoore/newport-beach-v3`, from source tip `e53dd431`.
[PR #136](https://github.com/mokly-ai/mokly/pull/136) records the path-by-path
integration decisions. The user approved fixing cold preview loading before
checking and pushing the merge.

## Post-push Review

The complete 68-path diff at pushed head `f7ace878` was reviewed against
`781da7ae` using the [implementation review prompt](../implementation-review-prompt.md).
No implementation or existing protocol finding was changed during review.

1. **P2: Support file/folder replacements in verification snapshots.**
   [Snapshot copying](../../scripts/verification/local-snapshot.mjs), line 121,
   removes old tracked files but leaves empty parent directories. A staged
   refactor that replaces a directory with a file then fails with `EISDIR`.
   The complete check stops before testing an otherwise valid refactor.
   **A:** remove stale directories only in the copy path.
   **B (recommended):** handle both file/folder transition directions in capture
   and copying, with staged and unstaged regression coverage. B prevents related
   transitions from failing elsewhere in the same workflow. This is the existing
   finding from the [previous integration review](./local-verification-main-integration.md#post-push-review).

2. **P3: Align the CI evidence guide with the preview setup budget.**
   [CI suite evidence](../protocol/ci-suite-evidence.md), lines 44 and 51,
   still says ordinary publication setup has a five-minute limit. The fixture
   now uses seven minutes, and frame-load assertions use the 30-second resource
   budget. Leaving both descriptions makes timeout diagnosis and future changes
   harder because the contracts disagree.
   **A:** update both outdated paragraphs to match the current limits.
   **B (recommended):** keep one authoritative timeout table and link the CI
   guide and developer documentation to it. B needs a slightly wider doc edit
   but prevents the same values drifting across several descriptions.

Both findings remain for the user's decision. They do not invalidate the final
passing gate on the merged tree. Native macOS/Windows and a final Node 22 gate
were not run in this Linux workspace.

## Complete Gate

The final `cargo xtask check` passed in **51m21.661s**, with exit code zero.
Environment: Linux x86_64, Node 24.21.0, npm 11.19.0, Cargo 1.98.1; seven
available CPUs on an eight-logical-CPU VM. Two suites ran concurrently; unit
runners kept two-file concurrency and Playwright kept one worker and zero retries.

| Suite                 | Passing tests | Complete inventory           |
| --------------------- | ------------: | ---------------------------- |
| Node unit/integration |         4,233 | 761 files across four shards |
| Browser               |           851 | 169 specs across four shards |
| Hydration             |           263 | 14 specs, unsharded          |
| Rust                  |            17 | xtask tests                  |

All **5,364 tests** passed. The nine reports had no failures, skips,
cancellations, missing files or duplicate assignments. The gate also passed
formatting, lint, source/export checks, type checks, example and package builds,
generated-output validation, dependency audits and packed-consumer smoke tests.
This is one integration gate, not a new pair of performance benchmark runs.

## Preview Fix And Regression Evidence

Same-origin current and temporary previews now have a finite 30-second window
for HTML and blocking resources. Their navigation remains attached while the
accepted document loads; cancellation and expiry remove the handlers. The
cross-origin handshake remains five seconds. Shared frame URL and loaded-state
assertions use the resource-load budget; other UI assertions and whole-test
limits are unchanged.

Seven browser regressions cover delayed stylesheets and HTML, successful mount
completion, cancellation, expiry and late responses. The real-delay tests failed
before their corresponding fixes. The final focused set passed 15 cases, and
all seven regressions passed again in the complete gate. Existing frame
compatibility checks also passed in a separate 22-case run.

Ordinary preview setup shares the existing seven-minute preview-build budget.
Its export measured 288.3 seconds alone and exceeded five minutes twice in an
earlier parallel run. All real fixture work and assertions remain. In the final
gate, export took 269.400 seconds and serving took 1.650 seconds; all 14 ordinary
preview browser cases passed.

Earlier attempts are excluded from passing evidence. One stopped on the cold
example-link failure. Another passed 849 of 850 browser cases but exposed the
old five-second frame-source assertion in an appearance test. The final gate
ran every suite again after the helper fix.

## Source Identity And Preservation

The complete gate used detached commit `a3ce0252`, with tree
`48aff552e4aad9ee3e46de5a65e48362e8b42e09`. A matching committed baseline was
needed because browser comparisons use `HEAD`, while the previous branch tip
had the older catalogue format. The actual merge has exactly that tested tree
and the two intended parents, `e53dd431` and `781da7ae`.

All 23 paths in its remerge diff were inspected before pushing. No file was
deleted relative to main. All five mainline design-attribution test bodies were
preserved exactly across their split files. The complete same-origin protocol
text was preserved in its new [owning document](../protocol/mokly-same-origin-loading.md).
Subsequent completion records change Markdown only.

Logs, nine reports, source/merge audits and timing summaries are retained under
`.context/merge-main-781da7ae/`: `full-check.log`, `full-check-result.json`,
`reports/`, `report-summary.json`, `merge-audit.json` and `post-push-review.json`.
