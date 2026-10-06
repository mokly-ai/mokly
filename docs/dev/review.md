# Review

Rules for the post-push implementation review and for applying its findings.
The reviewer prompt is
[`docs/implementation-review-prompt.md`](../implementation-review-prompt.md).
[`AGENTS.md`](../../AGENTS.md) says when to run the review. This document says
how to run it, how to write findings, and how to apply them.

## When the review runs

- Every implementation plan must end with the post-check commit-and-push step,
  followed by a review item that uses
  [`docs/implementation-review-prompt.md`](../implementation-review-prompt.md)
  to review the complete local diff against `origin/main`; run the review only
  after the push, then apply the review-fix rule below
- Treat existing plan items that name the removed `cargo xtask review` command
  as review items that use `docs/implementation-review-prompt.md`

## Review-fix rule

- Review-fix rule: after the post-push review reports, fix the findings that
  the reviewer tagged `Auto-fix: yes` without waiting for the user. The
  reviewer may use that tag only when the finding has one clear fix, for
  small or medium effort findings in these categories: product bugs
  (including edge cases, races, and platform differences), security issues,
  docs or spec drift, mockup mismatches that a protocol doc already settles,
  and repository-rule violations such as file size, lint, and layout. Effort
  grades: small is one change in one or two files with no new module,
  dependency, migration, protocol section, or test file; medium is a few files
  and may change tests in existing files; large adds a new module, dependency,
  migration, protocol section, or mockup, crosses a package boundary, or
  touches more than five files. Large findings always ask
- The reviewer tags a finding `Auto-fix: no` and the agent asks the user when
  the finding needs a decision: more than one option has real trade-offs and
  the recommendation is not clearly best; the fix changes the meaning of a
  protocol contract or decides which side of a mockup/product mismatch is
  right; the fix changes user-visible behaviour beyond what the contract says;
  the fix adds a new build error, rejection, gate, or stricter validation; a
  narrow fix and a better broader fix (a rule, test, lint, guard, abstraction,
  or architectural change) both exist, so the user chooses between them; the
  fix deletes, skips, or weakens a test or gate, or raises a time
  limit; or the fix needs an audit exception, credentials, or infrastructure.
  Findings about missing tests, performance, code structure, UX wording, and
  process always wait for the user
- Do not fix a flaky, slow, custom, or low-value test, gate, lint, or check
  automatically. Ask the user whether to fix it or remove it, and state what
  it protects and how long it runs
- Keep the review itself read-only. After it reports, fix the `Auto-fix: yes`
  findings, run the checks, commit, push, and re-run the review once on the
  fix. Fix any new `Auto-fix: yes` findings once more, then stop and report.
  Do not start a third fix round without the user
- In the final message, list the auto-fixed findings (number, severity, plain
  explanation, what changed, commit) separately from the findings that need a
  decision, each with a clear recommendation. Name the fixed finding in its
  commit message. Add each open finding as one line under the plan's review
  TODO so that it is not lost when the session ends

## Review output format

- When providing review comments or review output, number each review item, give
  each item a severity, a category (product bug, security, docs or spec,
  mockup, repository rule, test, performance, code structure, UX wording, or
  process), and an effort grade (small, medium, or large, as defined in the
  review-fix rule), and explain it in simple language that assumes the reader has no
  prior codebase or feature context. State the impact of not making the change
  / doing nothing, provide solution options with lettered labels, clearly state
  the recommended option, and end the item with `Auto-fix: yes` or
  `Auto-fix: no, because …` according to the review-fix rule
- When suggesting fixes for review items, evaluate whether the direct fix is
  enough or whether a broader rule, test, lint, abstraction, or architectural
  change would prevent the same class of issue from recurring, and explain the
  tradeoff. Give the broader change its own lettered option and say which
  option best protects the codebase. When a narrow fix and a better broader fix
  both exist, tag the finding `Auto-fix: no`: the choice between them is the
  user's decision
