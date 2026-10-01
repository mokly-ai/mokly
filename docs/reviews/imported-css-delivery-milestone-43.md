# Imported CSS Delivery Milestone 43 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 43. It ran on 2026-10-01 after `ce8fc067` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main` at `b4a02a30`. One read-only reviewer examined the changes since
`b5d4ad54`:

- `7f64f8b0` (Milestone 41) replaced the custom merge-preservation check with
  a review of `git show --remerge-diff HEAD` in `AGENTS.md`, by the user's
  decision.
- `beab8560` (Milestone 42) merged `main`'s release-runner fix.
- `ce8fc067` updated the plan and review records.

Findings that remain open in earlier records are not repeated.

The changes work as intended:

- On `d72abaeb`, the remerge diff shows both `mokly-css-attribution.md`
  clauses that the merge lost. It also shows every one of the 20 files that
  only `main` changed but that differ from `main` in the merge result. These
  were exactly the gaps of the removed check.
- `main`'s release-runner fix survived. `release.yml` and both tests are
  identical to `b4a02a30`, and the moved wording is correct. No test or page
  expects that text in `npm-release.md`.
- The deleted test file tested only the deleted script, and neither file
  existed on `main`.
- The remerge diff of `beab8560` shows exactly the two intentional changes,
  and nothing from `main` was deleted.
- The full gate passed on its second run. The first run failed on a flaky
  watcher test; see the addition to Milestone 40 finding 12 below.
- PR #125's CI passed after one hydration job was re-run. That test also
  fails on `main`'s own CI.

The parent session confirmed finding 1 on this branch. Findings later resolved
carry a resolution note; the others remain open for the user's decision.

## Findings

1. **Medium — the new merge-review step can review the wrong commit without
   warning, and it no longer covers fixes made after the merge.**
   - What happens: `git show --remerge-diff HEAD` redoes Git's automatic merge
     for the merge commit's two parents and shows what the recorded merge did
     differently. It only does that when `HEAD` is the merge commit. When
     `HEAD` is an ordinary commit, it prints that commit's normal diff, with
     no warning.
   - The step allows any time "before pushing", and this branch usually adds
     a commit in that window. On this branch now, `HEAD` is the bookkeeping
     commit `ce8fc067`. The documented command shows its three-file plan
     diff, not the merge `beab8560`.
   - Reproduction: in a scratch repository, a merge dropped `main`'s side of a
     conflict, accepted deleting a file that `main` had edited, and undid
     `main`'s only change to another file. One more commit followed. The
     documented command then showed only the last commit, while
     `git show --remerge-diff HEAD~1` showed all three losses. The removed
     check refused this case with "is not a merge commit".
   - Further gaps:
     - A fix committed after the merge appears in no remerge diff.
     - For merges of three or more branches, Git prints only "Skipping
       remerge-diff for octopus merges".
     - "A committed merge message cannot be changed later" is not true before
       pushing. `git commit --amend` keeps both parents, and the remerge diff
       then reflects the restored content.
     - The step says nothing about where justifications go before a PR
       exists. This branch's own first merge was made before PR #125 opened.
   - The Milestone 40 resolution notes for findings 1 and 11 present the
     replacement as free of these problems. That holds only when `HEAD` is the
     merge.
   - Impact: an agent that runs the step just before pushing can see a
     normal-looking diff and push a merge that dropped `main` content.
   - Options:
     - A) Rewrite the step around a named merge commit:
       - right after committing it, record `merge=$(git rev-parse HEAD)` and
         check that it has exactly two parents;
       - review `git show --remerge-diff "$merge"`;
       - restore lost content by amending the merge before pushing, then run
         the review again;
       - review any later commits with `git diff "$merge" HEAD`;
       - put justifications in the PR description, or in the plan milestone
         when no PR exists yet;
       - drop the "cannot be changed later" sentence.
     - B) Only add "run it immediately after the merge, before any other
       commit, and amend fixes into the merge".
     - C) Add a small wrapper command that rejects these cases, which would
       bring back custom tooling.
   - Recommended: A. Naming the merge removes the cause: the step no longer
     depends on where `HEAD` happens to be.
2. **Low — the step gives no way to review a large merge, and "justify each
   intentional change" does not match how PR #125 records justifications.**
   - For `d72abaeb`, the remerge diff is about 9,900 lines across 134 paths,
     67 of them with conflicts. That is far more than one command's output
     can usefully show.
   - Git already supports `--stat`, `--name-status` and `-- <path>` with
     `--remerge-diff`, but the step mentions none of them.
   - PR #125 justifies merges in grouped bullets, partly by example. The rule
     asks for every change.
   - Impact: agents justify whatever part of the output they happened to read,
     and a reviewer cannot tell whether a PR description meets the rule.
   - Options: A) in the same rewrite as finding 1, start with `--stat`, review
     each path with `-- <path>`, and justify each decision, naming every
     affected path; B) require a table with one row per path; C) leave as is.
   - Recommended: A. It matches the existing "Merge decisions" practice.
3. **Low — two bookkeeping statements now contradict the records.** The
   Milestone 40 record still says "All twelve remain open", although four of
   its findings are now marked resolved. `plans/README.md` lists the Milestone
   42 merge among the findings "addressed selectively", although the merge
   addressed no finding. Options: A) use summaries without counts in review
   records, here and in the Milestone 37 record (open Milestone 40 finding
   6), and split the README sentence; B) change "twelve" to "eight"; C) leave
   both as snapshots. Recommended: A, because wording without a count does
   not go stale each time a finding is resolved.

## Addition To Milestone 40 Finding 12

This is not a new finding. A third imported-CSS watcher test is flaky: "watched
PostCSS module and reported file edits refresh the accepted CSS". The reviewer
found its cause:

- The test edits `postcss.config.mjs`. That counts as a configuration change,
  which restarts the Serve child process, and the old child closes all
  connections on shutdown.
- The test's wait helper returns on an update the old child sends just before
  the restart, so the test keeps polling the stylesheet through the restart.
- The polling loop tolerates only `ECONNREFUSED` and `ECONNRESET`. A request in
  flight when the connections close fails with `fetch failed`
  (`UND_ERR_SOCKET`), and the loop re-throws it.
- Under CPU load, the unmodified test failed once in 48 runs with exactly this
  error. An instrumented copy failed 2 or 3 milliseconds after the old child's
  event stream ended.
- `tests/helpers/watched_catalogue.ts` and another loop in
  `tests/catalogue_watch.test.ts` already tolerate `UND_ERR_SOCKET`, but two
  other local loops do not.

That finding's recommendation still applies: one shared helper that waits for
the restarted server's ready event, replacing the separate polling loops.
