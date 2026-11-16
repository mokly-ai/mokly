# Start helper-free Git commands without forking the core

Status: Active. On branch `calummoore/plain-git-spawns`, no pull request yet.
The pull request that completes the work deletes this plan, as the `plans`
skill says.

Every Git command of the core starts through the process-tree setup of
`mokly-platform`: a `pre_exec` hook that starts a new session and, on Linux,
makes the child a subreaper. A `pre_exec` hook forces the standard library to
`fork` the whole core before `exec`, and the fork copies the page tables of the
core's memory. From a process that holds 800 MB, like the Serve core on the
`mokly-cloud` catalogue, one `git rev-parse` then costs 29.7 ms wall, against
1.2 ms through `posix_spawn` with a new process group. Watched Serve polls the
resolved `HEAD` and base commits once per second with two such commands, also
when it is idle, and each classification runs 30 to 70 more. A CPU profile of
one Serve edit cycle put about 8% of the core's samples in the fork and its
exec teardown. The evidence is in `.context/plain-git-spawns/`.

The change starts the Git commands that start no helper process in their own
process group without the `pre_exec` hook, so the standard library uses
`posix_spawn`. The group still gives the owned tree that cancellation signals,
and the identity guard still records the child before it can be reaped. Git
commands that can start a filter, a hook, a credential helper, a network
helper, or an fsmonitor stay on the full process-tree setup. Sidecars, package
managers, and PostCSS children do not change.

Decisions:

- 2026-11-16, user: keep optimising the speed and the reliability of Changes,
  merge without asking, and make no change that can exhaust a machine's
  memory. This approves the plan, its protocol change, and the merge.
- 2026-11-16, my call: each Git request names its process mode in a typed
  field, and only these commands use the plain group: `rev-parse`,
  `merge-base`, `ls-tree`, `rev-list` with lazy fetch disabled, `config`
  without editing, and `check-attr`. They read refs, objects, configuration,
  or attributes, and start no other process. `hash-object --path`, `cat-file`
  with filters, `fetch`, `diff`, and `ls-files` keep the full setup, because a
  clean or smudge filter, a credential or network helper, an external diff, or
  an fsmonitor can start a process there. Rejected: parsing the argument list
  in the runner, because a new call site would get the plain group by accident.
  Rejected: one plain group for every Git command, because a helper that starts
  its own session could then outlive the command, against the Git runtime rule.
- 2026-11-16, my call: Windows keeps its kill-on-close job for every mode,
  because job creation does not fork.
- 2026-11-16, my call: a small trampoline that starts every managed process,
  sidecars included, through `posix_spawn` with the full session and subreaper
  setup is a follow-up item, because it changes how every child starts.

Contract owners:

- [Git command runtime](../docs/protocol/mokly-git.md), section "Cancellation
  And Fetch": a helper-free command owns a process group; every other command
  owns the full tree.
- The [mokly-platform README](../crates/mokly-platform/README.md) and the
  [mokly-git README](../crates/mokly-git/README.md).

## Milestone 1: Plain process groups

Depends on: none

- [x] `mokly-platform`: a plain mode of `ProcessGroups` that sets
      `Command::process_group(0)` on Unix and no `pre_exec` hook, with the same
      `attach` guard. Windows uses its job, as today.
- [x] `mokly-git`: a typed process mode on `Request`, defaulting to the full
      tree. The commands of the decision use the plain mode at each call site,
      including the Serve ref poll in `crates/mokly-cli/src/serve_changes_native.rs`.
- [x] Tests: a plain-mode command runs with its output, exit status, and
      cancellation as before, and a cancellation signals its process group; the
      runner calls the plain setup only for requests that name it (strict
      mocks); a full-mode request still gets the session setup.
- [x] Docs: the Git runtime rule and the two READMEs.
- [x] A follow-up item for the trampoline of the last design call.

## Milestone 2: Measurement

Depends on: 1

- [ ] Release builds of `main` and of the branch. On `mokly-cloud`: the CPU
      time of an idle watched Serve over 60 s, and a Serve run with one edit,
      before and after, with the share of the fork in a CPU profile, under
      `.context/plain-git-spawns/`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the targeted tests, the early check, and the repository suite named
      in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
