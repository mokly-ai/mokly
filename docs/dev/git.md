# Git

Commit message format, title limits, and the mainline feature preservation
procedure. [`AGENTS.md`](../../AGENTS.md) repeats the rules that apply to
every commit; this document holds the procedure, the audit commands, and the
examples.

This project uses the **Conventional Commits** format for all commit messages. This standardized format improves readability, enables automated changelog generation, and makes it easier to understand the project history.

## Mainline Feature Preservation

Do not delete or override anything already on `origin/main`—code, APIs, tests,
docs, mockups, plans, migrations, or schema—without explicit user approval.

- Before integration begins, fetch main and audit its additions from the source
  tip. Capture that tip before merging or rebasing; never recalculate it from a
  rebased `HEAD` (when merging into main, use the other branch's tip):

  ```sh
  git fetch origin main
  source_tip=$(git rev-parse HEAD)
  base=$(git merge-base "$source_tip" origin/main)
  git diff --name-status "$base"..origin/main
  ```

- Resolve conflicts path-by-path; never bulk-take `--ours` or `--theirs` for a
  tree, directory, or feature. Passing CI does not prove preservation.
- Immediately after committing each merge, before another commit, name it and
  confirm it has exactly two parents; merge one branch at a time because Git
  skips remerge diffs for octopus merges. Stop if the parent check fails.
  Review every listed path before pushing:

  ```sh
  merge=$(git rev-parse HEAD)
  git rev-parse --verify --quiet "$merge^2" >/dev/null &&
    ! git rev-parse --verify --quiet "$merge^3" >/dev/null # succeeds only for exactly two parents
  git show --remerge-diff --stat "$merge"
  git show --remerge-diff "$merge" -- <path> # repeat for every listed path
  git diff "$merge" HEAD # review commits made after the merge
  ```

  The remerge diff shows conflict resolutions, edits to one-sided files,
  undone changes and deletions. Restore lost content before pushing with
  `git commit --amend`, which keeps both parents; then review the merge again.
  After pushing, use a follow-up commit.
  Justify each intentional decision in the PR description, naming every path
  it affects. If no PR exists yet, save the justifications under
  `.context/<plan-name>/`, name that file in the active plan milestone, and
  copy them into the PR description when it opens.

- Before commit and after commit, inspect the diff and deletions against main:

  ```sh
  git diff --name-status origin/main
  git diff --diff-filter=D --name-status origin/main
  git diff --name-status origin/main..HEAD # after commit
  ```

  Stop unless each deletion or feature-wide reduction is authorized, and record
  every approved removal plus related cleanup in the commit or PR description.

- When a change removes or renames a feature, test, fixture, scenario,
  command, or file, search `docs/`, `plans/`, and every `README.md` for its
  name. Update each stale reference in live content in the same change.
  Record each plan edit in the commit or PR description.
- `docs/` and every `README.md` are live content. In an active plan,
  completed milestones and checked TODOs are history; all other content is
  live. In a completed plan, open review findings and unchecked post-merge
  follow-ups are live; all other content is history. Do not change the
  words of history.
- `tests/markdown_links.test.ts` checks the local links in `AGENTS.md`,
  `docs/`, `plans/`, and every `README.md`. If a history link fails this
  check, replace it with a GitHub permalink at a commit where the target still
  matches the text. Start with the commit that wrote the link. For a
  squash-merged PR, look for that commit in `refs/pull/<number>/head`. For a
  line in a Markdown file, put `?plain=1` before `#L<number>`.

## Rules

Use at most 50 characters for individual commit titles (the first line).
Pull request titles and their squash commit titles may use at most 72 Unicode
code points. Keep the Conventional Commits format for both.
Commit body (subsequent lines, after a blank line) has no strict length limit.
If a merge produces conflicts, resolve every conflict and verify the resulting
worktree before saying the merge or work is complete.

You may include MULTIPLE entries in a single commit message if there are distinct change types.
If you use multiple entries (feat/fix/refactor/...):

- Separate multiple entries with a blank line.
- Order them by Conventional Commits type priority.

## Examples from the Codebase

These are compact examples of commit titles that don't include the commit descriptions, please include descriptions in your messages:

```
feat: add cargo xtask lint command
fix(linear-webhook): include check run URLs in failure handling
build(ios): skip device arch in dev builds
chore: update app version to 2.0.11
refactor(linear-webhook): extract reusable webhook actions
feat(wallet): add rewards transfer to merge_wallet_admin endpoint
fix(bungee): enforce $1.00 minimum USD output amount threshold
docs(claude): prefer `dyn T` over generics
perf(bungee-client-http): optimize request batching
```

## Cherry-picked example (one commit message that has both `refactor` and `chore`):

This is a commit that has multiple distinct change types - refactor and chore:

```
refactor: adopt Rust 1.90 idioms, fix new lints

- Replace nested conditionals with if-let chains across crates (bungee-client-http, contracts, guild, merge-cli, node, providers, wallet-core, wallet-mobile, zk-primitives)
- Remove unused structs/imports and dead test helpers (panic_handler, utxo, firebase, p2p tests, node rpc/http_error, client tests, smirk iterator, wallet-core send_link, element serde)
- Add #[expect(dead_code)] with reasons where code is gated by features (util, rollup, doomslug)
- Inline include_bytes! for verification key fields and drop redundant constants (barretenberg circuits)
- Tighten lifetimes and return types (Tree::elements, middle_truncate Cow, diesel BoxedQuery lifetime, SemaphorePermit borrows)
- Use .is_multiple_of and from_ref helpers; simplify assertions and formatting utilities
- Minor logic cleanups and early returns; no functional changes intended

chore(rust): bump workspace to Rust 1.90

- Update codebase to compile cleanly under Rust 1.90 and new lints
```
