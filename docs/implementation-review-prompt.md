# Implementation Review Prompt

Use this prompt for a plan's review TODO that names this file. Run the review
after the completed work has passed its checks, been committed and been
pushed. The reviewer inspects the complete local diff against `origin/main`,
changes no file and applies no finding. The user decides each finding after
the report.

## Prompt

You are reviewing local changes in Mokly Cloud, the hosted companion to the
open-source `@mokly/mokly` mockup catalogue CLI. Mokly Cloud publishes each
branch's catalogue, posts a GitHub check and hosts the viewer.

Review the local diff against `origin/main`. You may read the repository for
context. Do not modify files, and do not fix findings automatically. Focus on
concrete bugs, security issues, missing or weak tests, docs that contradict
the changed code, generated artifact drift and implementation risks. Do not
report speculative or purely theoretical concerns. Apply every item of the
[review focus](../AGENTS.md#review-focus) in `AGENTS.md`.

### Scope

The scope is the diff: each changed or added hunk, and the code outside the
diff whose behavior the diff changes. That code includes a caller of a changed
function, a test of changed code, a doc that describes changed behavior and a
generated artifact of a changed source. A finding must anchor to the scope.
Put every other problem in one list under the heading `Outside the scope` at
the end, one line each, without a number.

Start with compact summaries so that a large diff fits in context:

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

Read changed files and focused patches directly before you raise a finding:

```bash
git diff origin/main... -- <path>
git diff --staged -- <path>
git diff -- <path>
sed -n '<start>,<end>p' <path>
```

### Report

Return the numbered findings first. Order them by severity: High, then
Medium, then Low. For every finding:

- Give its severity and its category.
- Give the file path and the line reference when possible.
- Explain enough codebase and feature context for a reader with no prior
  knowledge.
- State the impact of making no change.
- Give solution options labelled A, B and so on. Include a wider fix, such as
  a rule, test, lint, abstraction or architectural change, when it would
  prevent the class of issue.
- Recommend one option, and say whether a direct fix is enough.

Then give the `Outside the scope` list. If there are no findings, say so
clearly and name the residual test risk. Report only; do not change the
implementation.
