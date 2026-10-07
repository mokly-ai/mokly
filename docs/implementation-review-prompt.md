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
- Give it a category: product bug, security, docs or spec, mockup, repository
  rule, test, performance, code structure, UX wording, or process.
- Give it an effort grade. Small: one change in one or two files with no new
  module, dependency, migration, protocol section, or test file. Medium: a few
  files, and tests may change in existing files. Large: a new module,
  dependency, migration, protocol section, or mockup, a change across a
  package boundary, or more than five files.
- Include the relevant file path and line reference when possible.
- Explain enough codebase and feature context for a reader with no prior
  knowledge.
- State the impact of making no change.
- Give solution options labelled A, B, and so on.
- Recommend one option and explain whether a direct fix is sufficient or a
  broader rule, test, lint, abstraction, or architectural change would better
  prevent the issue from recurring. Give the broader change its own lettered
  option. When a narrow fix and a better broader fix both exist, tag the
  finding `Auto-fix: no` so that the user chooses between them.
- End the finding with `Auto-fix: yes` or `Auto-fix: no, because …`, following
  the review-fix rule and its ask conditions in `AGENTS.md`. A flaky test that
  the diff adds or changes may be `Auto-fix: yes` under the flaky-test rule:
  name the nondeterminism source and the deterministic fix from
  `docs/protocol/ci-test-timing.md`, and require the fixer to reproduce the
  flake and record pass counts before and after. Tag a flaky test that the
  diff does not touch `Auto-fix: no`, so that the user can fix it in a
  separate branch; report its name, failure text, and suspected source. Tag a
  slow, custom, or low-value test, gate, lint, or check `Auto-fix: no` and ask
  whether to fix it or remove it, stating what it protects and how long it
  runs.

If there are no findings, say so clearly and mention residual test risk.

## After The Review

The reviewer stays read-only. The implementer then applies the review-fix rule
from [`AGENTS.md`](../AGENTS.md):

1. Fix the findings tagged `Auto-fix: yes`. The tag is allowed only when the
   finding has one clear fix, for small or medium effort findings about
   product bugs (including edge cases, races, and platform differences),
   security issues, docs or spec drift, mockup mismatches that a protocol doc
   already settles, flaky tests that the diff adds or changes under the
   flaky-test rule, and repository-rule violations such as file size, lint,
   and layout. A flaky-test fix reproduces the flake, records pass counts
   before and after under `.context/`, keeps every existing assertion, and
   adds no retry, sleep, repeat, skip, quarantine, or longer time limit.
2. Leave findings tagged `Auto-fix: no` for the user: large effort, more than
   one option with real trade-offs, a change to the meaning of a protocol contract, a
   choice between the mockup and the product, a user-visible behaviour change
   beyond the contract, a new build error, rejection, gate, or stricter
   validation, a narrow fix beside a better broader fix, deleting or
   weakening a test or gate or raising a time limit,
   a flaky test that the diff does not touch (report it for a separate
   branch), a slow, custom, or low-value test, gate, lint, or check (ask: fix
   or remove?), or a need for an audit exception, credentials, or
   infrastructure. Findings about missing tests, performance, code structure,
   UX wording, and process also wait for the user.
3. Run the checks, commit, push, and run this review once more on the fix. Fix
   any new auto-fixable findings once more, then stop. Do not start a third fix
   round without the user.
4. Report the fixed findings (number, severity, plain explanation, what
   changed, commit) separately from the open findings and their
   recommendations. Name each fixed finding in its commit message, and add
   each open finding as one line under the plan's review TODO. Keep the review
   report and any evidence under the git-ignored `.context/` directory, not in
   the repository.
