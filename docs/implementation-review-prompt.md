# Implementation Review Prompt

## Delivery Status

Use this prompt for the final review item in every implementation plan. Run the
review after the completed work has passed its checks, been committed, and been
pushed. The reviewer must inspect the complete local diff against `origin/main`
without changing files or automatically applying findings.

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
