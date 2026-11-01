# Base Install Process Tree Stops

Status: Active. On branch `conductor/rust-rebuild-150-process-tree-stops`, no pull request yet. The plan closes when its implementation pull request merges.

This plan resolves user item 150 of the Rust rebuild. When Mokly stops a base
dependency install, because of cancellation, the time limit, or a byte or
output bound, its Unix owner of process trees signals only the process group
of the package manager. Yarn Classic 1.22.22 starts each dependency lifecycle
script in a new session on Linux and macOS, so the group signal misses the
script and its children. Lifecycle scripts run only when
`review.baseInstallScripts` or `--base-install-scripts` turns them on.

The work moved here from the
[base install fixes plan](https://github.com/mokly-ai/mokly/blob/4038a17bdcd3114dd5db70ec27593fac8efbb6d5/plans/base-install-scripts-and-manager-fixes.md) on
2026-10-29, when the coordinator split it out under decision 9 D. That plan
ships the stop requirement in
[Base Install Processes](../docs/protocol/mokly-base-install-processes.md#bounds-and-stops)
and the runtime shutdown rule, each with a status line that names this plan.
Windows needs no change, because its kill-on-close job already holds every
descendant.

Contract owners:

- [Base Install Processes](../docs/protocol/mokly-base-install-processes.md).
- [Runtime shutdown](../docs/protocol/mokly-runtime.md#shutdown).
- [Git command runtime](../docs/protocol/mokly-git.md), because Git commands
  use the same owner of process trees.
- The [mokly-platform README](../crates/mokly-platform/README.md).

## Decisions

- User decision 150 (2026-10-28): C. The Unix owner of process trees finds
  the descendants of the owned process through parent links, also in new
  sessions, and signals every one. Rejected: A, document the limit, because
  the runtime shutdown contract already says that no orphan process
  survives; B, keep scripts off for Yarn Classic on Unix, because Classic
  projects would lose the opt-in.
- Design call (2026-10-28): the two limits that option C leaves stay
  documented limits: a new-session process that a finished script leaves
  behind, and on macOS an orphan outside the manager's process group. No
  answered decision asks for more, and both need a new tracking design.
- Design note: the stopped first attempt makes the manager a Linux child
  subreaper, so an orphan inside the owned tree stays reachable through parent
  links while the manager runs. Record the mechanism in code comments, not in
  the protocol page.

## Evidence

- `.context/base-install-scripts-managers/probes/item150_yarn_classic_session.log`:
  Yarn Classic scripts and their children survive group signals in four stop
  cases.
- The partial first attempt is commit `a2426a66` on branch
  `wt/base-install-150-process-tree`. It does not compile yet. Its delegate
  stopped on the Codex usage limit on 2026-10-28.

## Milestone 1: Documentation and protocol

The stop requirement and its limits landed with the base install fixes plan.

- [ ] Check that `docs/protocol/mokly-base-install-processes.md` states the
      complete stop contract. Propose any change that the implementation
      finds as a decision.

## Milestone 2: Process ownership for escaped scripts

The Unix owner of a process tree finds and signals descendants in new
sessions. Windows keeps its kill-on-close job.

- [ ] Add failing tests first: a descendant in a new session survives a
      group kill and a terminate-then-kill on the current code.
- [ ] Enumerate the descendants through parent links on Linux and macOS,
      stop them before the signal, and signal each one. Keep the identities
      found by a first signal for the second signal.
- [ ] Keep the cost of a stop of a reaped or childless tree to a few system
      calls, because the Git runner kills its group after every command.
- [ ] Add a `mokly-compare` integration test with a manager that starts a
      detached child, as Yarn Classic does, for the time limit and for
      cancellation.
- [ ] Check that the macOS and Windows code compiles.
- [ ] On Linux, a stop while the manager runs also signals a descendant
      whose parent exited before the stop.

## Milestone 3: Docs alignment

- [ ] Update `crates/mokly-platform/README.md` for the descendant walk.
- [ ] Remove the status lines of `docs/protocol/mokly-runtime.md` and
      `docs/protocol/mokly-base-install-processes.md`.
- [ ] Close `plans/follow-ups/yarn-classic-script-stop.md` when the stop
      implementation is complete. Main replaced the completed Rust rebuild
      plan with that follow-up file.

## Milestone 4: Verification, commit, review, and pull request

- [ ] Run the targeted tests of `mokly-platform`, `mokly-compare`,
      `mokly-git`, and `mokly-sidecar`.
- [ ] Merge `origin/main` with the `git-merge` skill, then run the complete
      gate `cargo xtask check` once on the final commit.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] The coordinator opens the pull request when every other milestone TODO
      is ticked. Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Run a macOS process-tree smoke test for escaped manager sessions on a
      hosted runner.
