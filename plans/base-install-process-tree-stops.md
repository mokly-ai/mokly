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
and the runtime shutdown rule.
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
- Design call (2026-11-01): the macOS limit of
  `docs/protocol/mokly-base-install-processes.md` says "whose parent exits
  before the stop reaches that parent", not "whose parent exited before the
  stop". On macOS, an orphan moves to launchd, so no parent link leads to it,
  and a parent outside the group can exit while the walk runs. The design
  call of 2026-10-28 already names the class of the limit: an orphan outside
  the manager's process group. The code and the class do not change.
- Design call withdrawn (2026-11-01): the coordinator's review of the same
  day withdrew the design call of 2026-11-01 above.
  - The new words weaken the stop requirement. No user decision covers that
    change, because the design call of 2026-10-28 is an agent's call.
  - The page again says "whose parent exited before the stop".
  - The gap is now the decision item
    `plans/follow-ups/macos-stop-mid-walk-orphans.md`.
    `docs/protocol/mokly-base-install-processes.md` and
    `docs/protocol/mokly-runtime.md` start with a status line that links it.
  - The Milestone 1 TODO stays ticked. Its check ran, and the gap that it
    found is now proposed as a decision.

## Evidence

- `.context/base-install-scripts-managers/probes/item150_yarn_classic_session.log`:
  Yarn Classic scripts and their children survive group signals in three of
  its four stop cases.
- The partial first attempt is commit `a2426a66` on branch
  `wt/base-install-150-process-tree`. It does not compile yet. Its delegate
  stopped on the Codex usage limit on 2026-10-28.

## Milestone 1: Documentation and protocol

The stop requirement and its limits landed with the base install fixes plan.

- [x] Check that `docs/protocol/mokly-base-install-processes.md` states the
      complete stop contract. Propose any change that the implementation
      finds as a decision.
  - Checked on 2026-11-01 against `8ed374c0`. The page states the contract
    of the code on Linux and Windows, and its two limits. The page needs no
    sentence on the repeated passes, because it states only which processes
    a stop must reach. One gap waits for a decision: on macOS, the code also
    misses a descendant outside the group whose parent exits after the stop
    starts and before the walk reaches that parent. The page names only a
    parent that exited before the stop.
  - The design call of 2026-11-01 rewords the macOS limit, so the page now
    states the contract.

## Milestone 2: Process ownership for escaped scripts

The Unix owner of a process tree finds and signals descendants in new
sessions. Windows keeps its kill-on-close job.

- [x] Add failing tests first: a descendant in a new session survives a
      group kill and a terminate-then-kill on the current code.
- [x] Enumerate the descendants through parent links on Linux and macOS,
      stop them before the signal, and signal each one. Keep the identities
      found by a first signal for the second signal.
- [x] Keep the cost of a stop of a reaped or childless tree to a few system
      calls, because the Git runner kills its group after every command.
- [x] Add a `mokly-compare` integration test with a manager that starts a
      detached child, as Yarn Classic does, for the time limit and for
      cancellation.
- [x] Check that the macOS and Windows code compiles.
- [x] On Linux, a stop while the manager runs also signals a descendant
      whose parent exited before the stop.
- Commits `41bde015` and `4b245b40`. The old group-only owner failed all six
  real-process tests, four in `crates/mokly-platform/tests/process_tree_tests.rs`
  and two in `crates/mokly-compare/tests/script_session_tests.rs`. The macOS
  and Windows checks of `mokly-platform` passed. Evidence:
  `.context/base-install-process-tree-stops/`.

## Milestone 3: Docs alignment

- [x] Update `crates/mokly-platform/README.md` for the descendant walk.
- [x] Remove the status lines of `docs/protocol/mokly-runtime.md` and
      `docs/protocol/mokly-base-install-processes.md`.
- [x] Close `plans/follow-ups/yarn-classic-script-stop.md` when the stop
      implementation is complete. Main replaced the completed Rust rebuild
      plan with that follow-up file.
- On 2026-11-01 the branch resolved each fact of that record, apart from its
  post-merge macOS smoke test, which became
  `plans/follow-ups/macos-process-tree-smoke-test.md`. `docs/protocol/mokly-runtime.md`
  and `docs/protocol/mokly-git.md` still match the code, so they did not
  change.

## Milestone 4: Verification, commit, review, and pull request

- [x] Run the targeted tests of `mokly-platform`, `mokly-compare`,
      `mokly-git`, and `mokly-sidecar`.
  - At `4b245b40`: `mokly-platform` 27 passed, the `mokly-compare`
    script-session and program tests 9 passed, `mokly-git` 92 passed, and
    the `mokly-sidecar` library 87 passed. The merge `8ed374c0` changed only
    two `mokly-compare` test files in these crates. Evidence:
    `.context/base-install-process-tree-stops/finding-1/final-checks.json`.
- [ ] Merge `origin/main` with the `git-merge` skill, then run the complete
      gate `cargo xtask check` once on the final commit.
- [ ] Commit with Conventional Commits and push the branch.
- [x] Review the complete diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Round 1 reviewed `41bde015` and found finding 1, High: the walk went one
    level deeper in each pass, so a chain deeper than 64 levels kept its
    deepest process running. Option B fixed it in `4b245b40`. Round 2
    re-reviewed `8ed374c0` and found no new finding. Reports:
    `.context/reviews/conductor/rust-rebuild-150-process-tree-stops/`.
  - Outside the scope: after a stop, the base install waits without a bound
    for its output pipes. Follow-up item:
    `plans/follow-ups/install-pipe-wait-after-stop.md`.
- [ ] The coordinator opens the pull request when every other milestone TODO
      is ticked. Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [x] Run a macOS process-tree smoke test for escaped manager sessions on a
      hosted runner.
- On 2026-11-01 this task became the follow-up item
  `plans/follow-ups/macos-process-tree-smoke-test.md`.
