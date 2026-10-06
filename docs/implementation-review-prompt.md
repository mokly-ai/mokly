# Implementation Review Prompt

Use this prompt for the final review item in every implementation plan. Run the
review after the completed work has passed its checks, been committed, and been
pushed. The reviewer must inspect the complete local diff against `origin/main`
without changing files or automatically applying findings. Fixing happens in a
separate step after the report; see [After The Review](#after-the-review).

The prompt preserves the former `cargo xtask review` instructions. It replaces
the command's injected review request with explicit commands that the reviewer
can run directly.

## Prompt

You are reviewing local changes for the Mokly package repository.

Review the local diff against `origin/main`. You may inspect the repository
read-only for context. Focus on concrete bugs, security issues, missing tests,
stale docs, generated artifact drift, and implementation risks. Pay particular
attention to app independence, generated-output safety, server and watcher
lifecycle, comparison behavior, and protocol alignment. Do not treat
speculative or purely theoretical concerns as findings. Do not modify files or
automatically fix findings.

Start by collecting compact summaries so large diffs fit in context:

```bash
git status --short
git diff --stat origin/main...
git diff --name-status origin/main...
git diff --staged --stat --
git diff --staged --name-status --
git diff --stat --
git diff --name-status --
git ls-files --others --exclude-standard
```

Inspect changed files and focused patches directly from the repository before
raising findings. Useful commands:

```bash
git diff origin/main... -- <path>
git diff --staged -- <path>
git diff -- <path>
sed -n '<start>,<end>p' <path>
```

Return numbered findings first. For every finding:

- Give it a severity.
- Include the relevant file path and line reference when possible.
- Explain enough codebase and feature context for a reader with no prior
  knowledge.
- State the impact of making no change.
- Give solution options labelled A, B, and so on.
- Recommend one option and explain whether a direct fix is sufficient or a
  broader rule, test, lint, abstraction, or architectural change would better
  prevent the issue from recurring.

If there are no findings, say so clearly and mention residual test risk.

## After The Review

The reviewer stays read-only. The implementer then applies the review-fix rule
from [`AGENTS.md`](../AGENTS.md):

1. Fix the findings in the auto-fix categories with the recommended option:
   product bugs (including edge cases, races, and platform differences),
   security issues, docs or spec drift, mockup mismatches that a protocol doc
   already settles, flaky or slow tests when the fix corrects the test itself,
   and repository-rule violations such as file size, lint, and layout.
2. Leave findings that need a decision for the user: more than one option with
   real trade-offs, a change to the meaning of a protocol contract, a choice
   between the mockup and the product, deleting or weakening a test or gate or
   raising a time limit, a user-visible behaviour change beyond the contract,
   or a need for an audit exception, credentials, infrastructure, or a new
   milestone. Findings about missing tests, performance, code structure, UX
   wording, and process also wait for the user.
3. Run the checks, commit, push, and run this review once more on the fix. Fix
   any new auto-fixable findings once more, then stop. Do not start a third fix
   round without the user.
4. Report the fixed findings (number, severity, plain explanation, what
   changed, commit) separately from the open findings and their
   recommendations. Name each fixed finding in its commit message, and add
   each open finding as one line under the plan's review TODO. Keep the review
   report and any evidence under the git-ignored `.context/` directory, not in
   the repository.
