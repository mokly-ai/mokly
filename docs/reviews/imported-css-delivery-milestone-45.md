# Imported CSS Delivery Milestone 45 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 45. It ran on 2026-10-01 after `690c0410` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main` at `b4a02a30`. One read-only reviewer examined the documentation
changes since `dc4d0946`:

- `8729ec16` (Milestone 44) rewrote the merge-review step in `AGENTS.md`
  around a named merge commit, by the user's decisions on the Milestone 43
  findings. It also made review-record introductions and the plan status
  count-free.
- `f8d42185` and `690c0410` updated the review records and the plan.

The reviewer also checked PR #125's "Merge decisions" section, which now names
every path of each merge. Findings that remain open in earlier records are not
repeated.

These parts hold:

- PR #125 names every path that `git show --remerge-diff --name-only` lists
  for each of the three merges.
- No other document, README, test or plan describes merge review.
- The count-free introductions match their records' notes. The plan status
  and `plans/README.md` are accurate.
- Run once, right after the merge, the documented commands behave as
  described in Bash for conflicting, clean, evil and octopus merges and for a
  commit that is not a merge.

The reviewer reproduced each finding in scratch repositories, using a full
clone because the working repository is a partial clone. The parent session
confirmed the zsh behaviour, the shortened and moved `--stat` entries, the
removed size caps and the stale statements. Findings later resolved carry a
resolution note; the others remain open for the user's decision.

## Findings

1. **Medium — the merge-review block can still review the wrong commit
   without warning, and its comments break in zsh.**
   - Context: `git show --remerge-diff` shows what a merge did beyond Git's
     automatic merge. For an ordinary commit, it prints that commit's normal
     diff with no warning. The step in `AGENTS.md` (lines 513–533) therefore
     names the merge and checks that it has two parents.
   - What happens:
     - The prose says to name the merge right after committing it. But the
       naming line, `merge=$(git rev-parse HEAD)`, is the first line of a
       block that the text introduces with "Review every listed path before
       pushing". Run then, after another commit, the block names that later
       commit.
     - The two-parent check prints nothing, and the commands after it run
       anyway. They also run under `set -e`, because Bash does not stop for a
       failed `&&` list or a `!` command.
     - Agent tool calls do not keep shell variables between calls, so a later
       review must name the merge again. The step only shows how to name it
       from `HEAD`.
     - Interactive zsh, the default macOS shell, treats `#` as a comment only
       when `interactivecomments` is set. Pasted there, the two-parent check
       succeeds on a three-parent merge, and
       `git diff "$merge" HEAD # review …` fails with
       `fatal: ambiguous argument '#'`. The `# after commit` line of the
       deletion check (line 540), which also exists on `main`, fails the same
       way.
   - Reproduction: a merge dropped `main`'s side of a conflict and undid
     `main`'s only edit to another file, and a bookkeeping commit followed.
     Run before pushing, as one non-interactive shell, pasted into interactive
     Bash and under `set -e`, the block showed only the bookkeeping diff and
     exited 0.
   - The Milestone 43 finding 1 resolution note and the Milestone 44 summary
     ("independent of the current `HEAD`") claim more than the text achieves.
   - Impact: an agent can see a normal-looking review and push a merge that
     dropped `main` content.
   - Options:
     - A) Split the step in two:
       - Right after the merge commit, print its parents visibly, for example
         with `git log -1 --format='%H parents: %P' HEAD`, and record the
         merge hash in the active plan milestone.
       - Before pushing, set `merge=<recorded hash>` and run a check that
         prints a clear stop message, and skips the review commands, when the
         commit does not have exactly two parents.
       - Move every `#` comment out of command lines, including `main`'s
         `# after commit` line.
     - B) A, plus a documentation test that extracts the block from
       `AGENTS.md` and runs it in scratch repositories: conflicting, clean,
       evil, octopus, amended, later-commit, moved-file and non-merge cases.
       The test checks the documented commands. It does not inspect real
       merges, so it does not bring back the removed custom merge check.
     - C) Leave as is.
   - Recommended: B. This step has needed corrections after three reviews in a
     row (Milestones 40, 43 and 45), and each problem was found by hand. A
     alone fixes today's text, but the next edit can break it again without
     any test failing.
2. **Medium — moved files and long paths escape the per-path review, and the
   deletion check misses a `main` file that a merge moves.**
   - Context: the step starts with `git show --remerge-diff --stat "$merge"`
     and then reviews each listed path with `-- <path>`. The next bullet's
     deletion check runs `git diff --diff-filter=D --name-status origin/main`.
   - What happens:
     - `--stat` shortens long paths with `...` and shows a moved file as
       `{old => new}`. On `d72abaeb`, 5 of the 134 entries cannot be used as
       paths, and 2 of them are moves. A shortened entry passed to
       `-- <path>` prints nothing and exits 0.
     - Reviewed by its new path alone, the moved
       `tests/build_mainline_navigation.test.ts` shows the whole file as new.
       Reviewed with its old path `tests/build_output.test.ts`, it shows the
       real change: 12 lines added and 24 removed.
     - Git reports a moved file as a rename, not a deletion, so
       `--diff-filter=D` does not list a `main` file that a merge moved.
   - Reproduction: a merge moved a `main` page and dropped one of its rules.
     The `--stat` entry was shortened, the per-path review showed no removed
     lines, and the deletion check printed nothing. Only `--name-status`,
     passing both paths, or `--no-renames` showed the dropped rule.
   - PR #125 has the same gap. Its path lists came from `--name-only`, which
     names only the new path of a move, so the move sources
     `tests/build_output.test.ts` and
     `tests/component_material_reader_projection.test.ts` are not named. Both
     exist only on this branch. With `--no-renames`, the branch still deletes
     or moves no `main` file, so no `main` content is lost.
   - Impact: a merge that moves files, as this branch's merges did, can drop
     `main` lines while every documented check passes.
   - Options:
     - A) Keep `--stat` as an overview, but take the paths from
       `--name-status` and review both paths of a move together. Add
       `--no-renames` to the deletion check, which also exists on `main`, and
       name the two move sources in PR #125.
     - B) Use `--no-renames` everywhere. A move then shows as a full deletion
       plus a full addition, so dropped lines must be compared by hand.
     - C) Only stop `--stat` from shortening paths. This does not fix moves.
   - Recommended: A, with a moved-file case in the finding 1 test. It closes
     the same blind spot in both steps.
3. **Low — amending restores the merge only while the merge is still
   `HEAD`.**
   - What happens: the text ties only the naming to "before another commit".
     The review happens "before pushing", and `git diff "$merge" HEAD`
     expects later commits. With a later commit present, `git commit --amend`
     rewrites that one-parent commit, not the merge, so the merge review
     keeps showing the loss. After a correct amend, `$merge` still holds the
     old commit, and the step does not say to name the amended merge again.
   - Impact: confusing review loops, and fixes hidden in unrelated commits.
     Nothing is lost silently.
   - Options: A) say that if the merge is still `HEAD`, amend it and name it
     again; otherwise restore the content in a new commit and review it with
     `git diff "$merge" HEAD`; B) require the whole review, and any fixes,
     before any other commit.
   - Recommended: A, in the same rewrite as finding 1. It covers both cases,
     including gate failures found after bookkeeping commits.
4. **Low — three PR #125 decisions do not describe what their path's remerge
   diff shows.** The reviewer compared 21 sampled `d72abaeb` paths with their
   own remerge diffs. These three are described wrongly:
   - `tests/protocol_doc_sizes.test.ts` is listed under "Preserve
     verification and packed-consumer tooling". The test exists on `main`,
     and the merge removed seven of `main`'s page-size caps:
     `ci-verification.md`, `mokly-changes.md`, `mokly-configuration.md`,
     `mokly-css-attribution.md`, `mokly-export.md`, `mokly-watch.md` and
     `npm-release.md`. The branch's page splits brought those pages under 250
     lines, and the test's stale-cap rule then requires removing their caps.
     No decision says so, and the removal is still in the diff against
     `origin/main`.
   - `src/server/watch_paths.ts` is listed under "Make unused internal
     exports local", whose text calls them branch-only helpers. But
     `entryGlobRoots` was exported at the merge base `2ec4d837`, and `main`
     itself made it local. The merge kept `main`'s signature with the
     branch's cached body.
   - `docs/protocol/mokly-css-attribution.md` is listed under "Merge both
     protocol contracts", whose text says the merge retained imported CSS. The
     merge dropped two of the branch's clauses, which were missing from the
     whole merged tree until `c260b5b2` restored them.
   - Impact: the record of how the merges changed `main` content is
     incomplete, including for a test that `main` owns.
   - Options: A) correct these three decisions and add the two move sources
     from finding 2; B) leave them.
   - Recommended: A. The rule already asks for this; the gap is in following
     it, not in the rule.
5. **Low — stale status statements.**
   - PR #125's "Also in this PR" says the merge procedure reviews
     `git show --remerge-diff HEAD`. That is the old form, and it contradicts
     the PR's own "Before merging" item.
   - The Milestone 43 finding 2 note says the per-path decisions are "ready
     for the user to copy into PR #125". PR #125 now contains them.
   - `AGENTS.md` asks every milestone for a short summary, but no "Commit,
     push, and review" milestone in the plan has one: Milestones 9, 12, 14,
     17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 40, 43 and 45. The reviewer
     named Milestones 35, 37, 40, 43 and 45; the parent session found the
     rest.
   - Options: A) correct the PR statement and the Milestone 43 note, and add
     a summary to each of these milestones; B) A, plus write future
     resolution notes against where a record lives, such as the PR section,
     rather than against a pending step.
   - Recommended: B.

## Addition To Milestone 40 Finding 12

This is not a new finding. On `690c0410`, the unit test "watched Serve closes
after a PostCSS worker exits during rebuild" failed with "worker request hung",
both on the first CI run and when the failed job was re-run. The code it tests
is unchanged since `dc4d0946`, whose CI passed. The parent session found the
cause:

- The test passes `serve()` startup through the same 2-second limit that
  detects a hung PostCSS worker request. Startup includes the first build and
  the worker start.
- On an idle 8-core machine, startup took 1.4–1.5 seconds and the test passed
  in 1.8–1.9 seconds. With six copies running at once, startup took 3.1–3.7
  seconds, and all 24 runs failed. Closing Serve took under 0.6 seconds in
  every run, so the close path the test is about did not cause the failures.
- The test therefore fails whenever the CI runner is slow, not when a worker
  request hangs.

That finding's recommendation still applies. For this test, start Serve
without the 2-second limit, wait for the rebuild to report the worker exit
instead of pausing for 300 ms, and keep the limit only on the close that
follows.
