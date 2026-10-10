# Remote Verification Base Commit

Status: Active

Let the remote complete gate run when local `HEAD` is not on GitHub.
The previous policy selected Testboxes only when an `origin` branch contained
`HEAD`. Unpushed checkpoint commits, fix commits, main merges and rebases
therefore selected local execution. The bootstrap trials took 40 to 47 minutes
locally and 9 to 13 minutes remotely. The agent rules order the work as gate,
commit, push. The previous policy added about 30 minutes for agents that
followed that order. The bootstrap review reported this as a Medium process
finding. Base selection and snapshot sync now remove that policy restriction.

On 2026-10-08 the user chose option C, the nearest pushed ancestor variant:
each box fetches the nearest commit that is already on GitHub, and the local
changes are applied on top. The agent rules keep their order.

The Blacksmith CLI already does most of this. Its sync fetches local `HEAD`
from GitHub and copies the non-ignored, uncommitted files on top. Xtask
therefore prepares a snapshot worktree whose `HEAD` is the base commit and
whose files equal the checkout. The CLI syncs that snapshot. The checkout's
`HEAD`, index and files never change.

This change covers xtask, the remote verification contract and the xtask
README. It has no product UI or mockup work. It does not change the Testbox
workflow, the suite reports, the report schema, the aggregate script or the
Blacksmith CLI. The suite wrapper changes only to stage the synced box tree.

Contract owners:

- [Remote verification](../docs/protocol/remote-verification.md).
- [Base commit sync](../docs/protocol/remote-verification-base.md).
- [Testbox execution](../docs/protocol/remote-verification-testbox.md).
- [Cleanup and interrupts](../docs/protocol/remote-verification-cleanup.md).
- [CI verification](../docs/protocol/ci-verification.md) for the report
  evidence rules.
- The [xtask README](../xtask/README.md).

## Findings

These facts were confirmed on 2026-10-08 from the code and the trial evidence
of the [Blacksmith remote verification plan](./blacksmith-remote-verification.md#trial-evidence):

1. The CLI sync fetches local `HEAD` with `git fetch --no-tags --depth 50` and
   copies non-ignored uncommitted files. When GitHub does not have `HEAD`, the
   box keeps its old `HEAD` and gets the new commits as uncommitted changes.
   The suite wrapper unshallows the box clone before each suite.
2. The source-tree fingerprint ignores commit identity. An unpushed commit and
   the same uncommitted change give the same fingerprint.
3. Before this plan, Xtask's `Published` check ran
   `git for-each-ref --contains HEAD` over `refs/remotes/origin/`.
   A miss selected local mode with the warning
   `local HEAD is not published; push the branch first`. The probe required
   the box `HEAD` to equal local `HEAD`. The aggregate used local `HEAD`.
4. Suite reports take their commit from `GITHUB_SHA` or `git rev-parse HEAD`
   on the box and reject a mismatch. The wrapper removes `GITHUB_SHA`. The
   report commit is therefore always the box `HEAD`.
5. The repository ratchets and baseline dependency audit use
   `M = git merge-base HEAD origin/main`. An ancestor of local `HEAD` alone
   does not preserve M after a local, unpushed merge of `main`. The old
   pushed branch tip can have fewer commits ahead than M. The base must also
   contain M when it exists. Then `git merge-base <base> origin/main` equals
   M, so the box uses the checkout's ratchet base. A newer main tip that is
   not an ancestor of local `HEAD` would also add reversed main changes.
6. The earlier protocol listed execution without a pushed `HEAD` and copying
   unpushed commits as out of scope. This plan removes both items.
7. `remote-verification-testbox.md` has 250 lines, the protocol cap. The new
   contract needs its own page.

## Decisions

1. **Base commit.** Select a pushed ancestor of local `HEAD` that satisfies
   the main merge-base rule below. Read the local `refs/remotes/origin/*` refs
   only. Do not fetch. Skip symbolic refs, including `origin/HEAD`. For each
   origin ref, take `git merge-base HEAD <ref>` and skip refs without a common
   ancestor. Deduplicate the candidates. Reduce them with
   `git merge-base --independent`. When `refs/remotes/origin/main` exists and
   shares history with `HEAD`, compute
   `M = git merge-base HEAD refs/remotes/origin/main`. Keep only candidates
   for which `git merge-base --is-ancestor M <candidate>` succeeds. M itself,
   or a candidate that contains it, always remains. Then choose the candidate
   with the fewest commits in `git rev-list --count <candidate>..HEAD`, then
   the smallest SHA. Accept only full 40-character lowercase hex SHAs from
   Git output. Pass SHAs and paths as separate process arguments. When an
   origin ref contains `HEAD`, the base is `HEAD` and the ahead count is 0.
   When no origin ref shares history with `HEAD`, there is no base.
2. **Snapshot worktree.** Xtask builds a tree object from the checkout: a
   temporary index seeded with `git read-tree HEAD`, then `git add -A`, then
   `git write-tree`. Tracked paths that match an ignore rule stay included.
   Xtask adds a detached linked worktree at the base commit under
   `.context/verification-snapshots/<run>/`, with
   `-c core.hooksPath=/dev/null` to disable checkout hooks. It loads the tree with
   `git read-tree -u --reset <tree>`, then resets the snapshot index to the
   base. Every difference is then unstaged or untracked, like a developer
   checkout. The checkout's `HEAD`, index and files never change, and a
   detached local `HEAD` works the same way. Before warmup, the snapshot
   fingerprint must equal the checkout fingerprint. A different value is a
   preparation failure. Put the temporary index beside the snapshot at
   `.context/verification-snapshots/<run>.index`. Set `GIT_INDEX_FILE` only
   on requests that need it. Create the snapshot parent before the first index
   write. Reject existing run-specific paths. Reserve the run name by exclusive
   directory creation. Keep the index path absent for Git to create. Check it
   again before the first Git write and mark it owned immediately before that
   request. Remove only resources this run created. Apply the index override
   on the three checkout tree-build requests. If `Request` needs an environment
   field, make it typed and retain shared secret variable removal. All snapshot
   build Git requests use `cancellable: false`. Check the interrupt flag
   after the build, before warmup.
3. **Sync source.** The probe and the 11 suite commands run with the snapshot
   directory as the working directory, so the CLI fetches the base commit and
   copies the differences. Warmup, download, disconnect, status and stop keep
   the workspace directory. Every run uses the snapshot, including runs where
   the base equals `HEAD`, so one path covers all cases.
4. **Probe identity.** The probe requires the checkout fingerprint and the
   base commit on every box. The final fingerprint check still reads the
   checkout, so changes made during the run still fail the check.
5. **Evidence identity.** Suite reports and the aggregate name the base
   commit, because box HEAD stays at the base and the strict runners stay
   unchanged. Xtask
   prints `information: run=<run> ref=<ref> HEAD=<head> base=<base> ahead=<n>`
   before warmup and adds `base=<base>` to the summary line. It also writes
   `identity.json` with the run, `HEAD`, base, ahead count and fingerprint to
   `.context/verification-logs/remote/<run>/`, not the report directory, so
   the aggregate still sees exactly nine reports. Model the identity as a typed
   struct with `run`, `head`, `base`, `ahead` and `fingerprint` fields. Use
   serde with derive and serde_json, added with `cargo add` without versions,
   or a pure formatter over validated fields. Test the exact file bytes.
   The summary also reports the existing remaining-box count as `cleanup=<n>`.
6. **Executor decision.** The `Published` check becomes a `Base` check. No
   base selects local mode in `auto` with the warning
   `no origin ref shares history with HEAD; fetch origin or push the branch`,
   and fails explicit `remote` mode. The remote decision line becomes
   `remote: Blacksmith access and a pushed base commit are available`.
   `cargo xtask executor` reports the same decision without building a
   snapshot.
7. **Snapshot cleanup.** Every path removes the snapshot and the temporary
   index: success, preparation failure, interrupt and panic unwind. Use
   `git worktree remove --force --force <path>`. Always run
   `git worktree prune`, also when the path is already gone. Remove the
   temporary index too. All removal Git requests use `cancellable: false`.
   Attempt every cleanup step even if an earlier step fails. A failed step
   prints one warning that names the manual worktree removal, prune and index
   removal commands. It never fails the check. Logs stay.
8. **Rules.** The agent rules keep the order gate, commit, push. The xtask
   README describes the implemented code at every commit. Keep
   `Push local HEAD before a remote check` until Milestone 3 changes the
   policy. Add snapshot behavior text in Milestone 2. Replace the push sentence
   and the `MOKLY_TESTBOX_REF` identity note with the base rule in Milestone 3.
   Protocol Delivery Status can name the approved target and link this plan
   until the implementation lands.
9. **Known limit.** A new file since the base that is tracked in `HEAD` and
   force-added despite an ignore rule becomes untracked and ignored in the
   snapshot. The CLI does not sync it. Its fingerprint then differs from the
   checkout, so preparation fails and `auto` falls back to local. Document the
   limit. Add no code for it.
10. **Git child environment.** On 2026-10-09 the user chose option B for
    review finding 1. Define one shared `GIT_REPOSITORY_VARIABLES` list beside
    `SECRET_VARIABLES` in `xtask/src/child_environment.rs`. Use the 15 names
    from `git rev-parse --local-env-vars` with Git 2.50.1:
    `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_CONFIG`, `GIT_CONFIG_PARAMETERS`,
    `GIT_CONFIG_COUNT`, `GIT_OBJECT_DIRECTORY`, `GIT_DIR`, `GIT_WORK_TREE`,
    `GIT_IMPLICIT_WORK_TREE`, `GIT_GRAFT_FILE`, `GIT_INDEX_FILE`,
    `GIT_NO_REPLACE_OBJECTS`, `GIT_REPLACE_REF_BASE`, `GIT_PREFIX`,
    `GIT_SHALLOW_FILE` and `GIT_COMMON_DIR`. Hooks, `git rebase -x` and aliases
    in linked worktrees can export repository variables. Every local runner,
    remote process request and helper such as `kill` removes the list. Rust
    test Git helpers follow the same rule. Remove the list before applying a
    request's temporary index. Retain secret removal. Preserve other variables,
    including Git network and prompt settings. Do not change findings 2 or 3.
11. **Box index.** On 2026-10-10 the user chose option B for finding 2.
    The CLI copies files, not the index. After its sync, box HEAD and index
    name the base. Deleted paths stay cached, and renamed paths appear as a
    deletion plus an untracked file. After fingerprint validation, the suite
    wrapper runs `git add -A` through its cleaned command boundary before
    history, installs or cargo. A failed or signalled staging command fails
    preparation. Index readers and rename detection then see the synced tree
    as a committed checkout. HEAD, reports, fingerprint and aggregate commit
    remain the base. A deletion on disk that is not staged can fail a local
    check and pass on a box, which checks the tree recorded by `git add -A`.
12. **Test Git and re-exec.** On 2026-10-10 the user chose finding 3 option B,
    finding 5 option A and finding 7 option A. One test-only Git runner uses
    an empty global config file in its temporary directory, disables system
    config, and removes the shared Git repository and secret variables for
    every fixture setup and inspection command. Code under test stays on
    SystemProcess with real global config behavior. Recorded requests include
    only code under test. Snapshot captures use `--untracked-files=all` and
    keep raw index byte comparisons. Re-exec helpers require `running 1 test`.

### Contingency

The Milestone 1 spike must show that the CLI syncs a linked worktree and
propagates deletions and renames. If it does not, stop and ask the user before
Milestone 2. The fallback design detaches the checkout's own `HEAD` at the
base commit with `git update-ref --no-deref HEAD <base>` for the run and
restores it after. That design changes the checkout during the run, so it needs
the user's approval.

### Out Of Scope

- Changing the agent rule order or the hosted CI triggers (options A and B).
- Changes to the Testbox workflow, the report schema, the
  aggregate script or the Blacksmith CLI.
- Remote execution for a selected `--suite`.
- A base commit that GitHub no longer has, for example after a force push from
  another clone. The probe fails and the existing preparation fallback applies.
- Fetching `origin` inside xtask.

## Milestone 1: Spike and contract — completed

The spike proves the sync behavior with a real box. The protocol then defines
the complete contract for the work that follows.

Evidence: `.context/remote-verification-base-commit/spike.md`.

- [x] In a scratch clone of this repository, create an unpushed commit that
      modifies, adds, deletes and renames a file, and add one uncommitted
      change and one untracked file on top. Compute the base commit with the
      Decision 1 commands and the checkout fingerprint.
- [x] Build the snapshot worktree with the Decision 2 commands. Check that
      `git status` in the checkout is unchanged, that the snapshot fingerprint
      equals the checkout fingerprint and that `git status` in the snapshot
      shows only unstaged and untracked differences.
- [x] Warm up one box from `main` with
      `blacksmith testbox warmup blacksmith-testbox.yml --ref main --idle-timeout 30`.
      Run the probe command from the snapshot directory with
      `blacksmith testbox run`. Require the checkout fingerprint and the base
      commit in its output. This proves that the CLI syncs a linked worktree
      and propagates the deletion and the rename.
- [x] On the box, run `git merge-base HEAD origin/main` and
      `git status --short` through `blacksmith testbox run`. Record that the
      change set equals the branch's changes.
- [x] Remove the snapshot with the Decision 7 commands. Check that the
      checkout, `git worktree list` and the reflog are unchanged. Stop the box
      and close its connection under the cleanup contract.
- [x] Record the spike in `.context/remote-verification-base-commit/spike.md`.
      Apply the contingency rule if any step fails.
- [x] Add `docs/protocol/remote-verification-base.md`, titled
      `Remote Verification: Base Commit Sync`, as a continuation of
      `remote-verification.md`. Define the base commit rule, the snapshot
      worktree steps, the sync source, the probe identity, the identity
      output and file, the executor decision, the snapshot cleanup and the
      no-base fallback. Keep it at or below 250 lines and free of plan
      milestone references.
- [x] Update `remote-verification.md`: the `Base` row of the executor table,
      the base lookup commands, steps 1 and 3 of the run sequence, the
      `MOKLY_TESTBOX_REF` note and the out-of-scope list. Link the new page.
- [x] Update `remote-verification-testbox.md`: the sync probe section and the
      aggregate paragraph that requires the box `HEAD` to equal local `HEAD`.
      Keep the page at or below 250 lines.
- [x] Add the new page to the protocol index in `docs/protocol/README.md` and
      to the split page list in `tests/protocol_split_links.test.ts`.
- [x] Link the base sync contract from the xtask README. Keep its quick start
      and behavior text true for the current code, including the pushed-HEAD
      requirement. Add the new behavior in the milestone that implements it.
- [x] Run the Markdown link test, the protocol structure, split-link and
      history tests, the protocol size check and `npm run format:check`.
      Commit and push.

## Milestone 2: Base lookup and snapshot sync — completed

Xtask syncs every remote run from a snapshot worktree at the base commit. The
`Published` check still requires a pushed `HEAD` in this milestone, so the base
always equals `HEAD` and the product keeps today's behavior while the new path
gets exercised.

Evidence: `.context/remote-verification-base-commit/milestone-2.md`.

- [x] Extend the `Git` boundary with a base lookup that returns the base SHA
      and the ahead count, or no base. Implement it in `SystemScripts` with
      the Decision 1 commands. Keep the full SHA validation of `head`.
- [x] Add a `Snapshot` boundary with create and remove operations. Implement
      it with the Decision 2 and Decision 7 commands through the existing
      process boundary, so the secret variable list and redaction apply. Put
      it in a new module under `xtask/src/remote/`, and keep every Rust file
      under 300 lines.
- [x] Give the fingerprint boundary a working-directory parameter, and give
      the Blacksmith `run` boundary a working-directory parameter. Keep the
      workspace directory for warmup, download, disconnect, status and stop.
- [x] In the runner, read `HEAD` and the base, build the snapshot, compare
      both fingerprints, then warm up, probe against the base, run the suites
      from the snapshot and aggregate with the base. Print the identity line
      and the summary `base=` field. Write `identity.json` through the logs
      boundary.
- [x] Remove the snapshot in every path. Track it in the cleanup guard or a
      sibling guard with the same unwind protection, so interrupts, preparation
      failures and panics remove it. A failed removal warns once.
- [x] Add unit tests with unimock. Use event order and captured inputs, not
      elapsed time. Cover: base equal to `HEAD`; base behind `HEAD` with an
      ahead count; no base; snapshot built before warmup; a fingerprint
      mismatch as a preparation failure with snapshot removal; probe commands
      and suite commands with the snapshot directory; aggregate with the base;
      the identity line, summary field and file; removal on success, on
      preparation failure, on interrupt and on panic; and a failed removal that
      only warns.
- [x] Add adapter tests in the existing adapter test style for the exact
      `git` arguments of the base lookup, the snapshot build and the snapshot
      removal, including the scoped temporary index variable, disabled hooks
      and non-cancellable requests.
- [x] Add real-Git adapter tests in temporary directories for the base rule:
      pushed `HEAD` with ahead 0; unpushed commits on a pushed branch; a local
      unpushed merge of `main` with more own commits than main's delta; a rebase
      onto newer `main` with the old origin branch tip; a stacked branch on a
      pushed branch; no shared history; symbolic `origin/HEAD` without duplicate
      candidates; and independent pushed candidates with unequal ahead counts,
      then equal counts resolved by the smallest SHA.
- [x] Add real-Git adapter tests for snapshot creation and removal: deletion,
      rename, mode change, symbolic link, untracked file, staged change and
      detached checkout `HEAD`. Require unchanged checkout `HEAD`, index,
      `git status --porcelain` and `git worktree list` after removal.
- [x] Test parent creation before index writes and existing-path collisions.
      Require unchanged foreign paths and cleanup of only acquired resources.
- [x] Update the xtask README key code section for the new module and its
      implemented snapshot behavior. Keep the pushed-HEAD policy text.
- [x] Run the xtask tests, `cargo fmt --all -- --check`, Clippy and the length
      lints, the local repository gate and the Markdown checks. Commit and
      push.

## Milestone 3: Unpushed commits select remote — completed

The executor policy accepts any `HEAD` with a base commit. A branch with
unpushed commits now runs the complete gate on Testboxes.

Evidence: `.context/remote-verification-base-commit/milestone-3.md` and
`.context/remote-verification-base-commit/smoke.md`.

- [x] Fix review R1 in its own commit. Reserve only the run directory.
      Leave the temporary index absent until Git creates it. Keep the index
      absence check and claim its cleanup immediately before the first write.
- [x] Replace the `Published` check with the `Base` check in the policy, the
      availability selector, the local reasons, the decision text and the
      typed error. Remove the `published` boundary method and its
      `UnpublishedHead` error.
- [x] Update the unit tests for the policy order, the `auto` warning, the
      explicit `remote` error and the `cargo xtask executor` output.
- [x] Update the xtask README executor text. Replace the pushed-HEAD
      requirement with the base rule. State that `MOKLY_TESTBOX_REF` changes
      neither the fingerprint nor the base commit.
- [x] Split the near-cap runner test and snapshot fixture modules. Keep every
      assertion and scenario.
- [x] Smoke test from this branch with one unpushed commit that modifies,
      adds, deletes and renames files, plus one uncommitted change. Run the
      complete `cargo xtask check`. Require the remote decision, the identity
      line with `ahead` above 0, 11/11 commands, 9/9 reports, a passed
      aggregate for the base, an unchanged tree and `cleanup=0`. Check that
      `git status`, `git symbolic-ref HEAD` and `git worktree list` are
      unchanged after the run and that the snapshot directory is gone.
      First commit and push the policy code and a separate small text fixture
      directory. Modify, add, delete and rename fixtures in one unpushed commit.
      Apply one uncommitted fixture change. Require the pushed fixture commit
      as the base with ahead 1, rather than the main tip.
- [x] Smoke test an interrupt: send SIGINT during the probe phase. Require
      stopped boxes, a removed snapshot and the existing interrupted result.
- [x] Smoke test `cargo xtask executor` with the same unpushed commit. Require
      the remote decision. Then run it in a clone without origin refs that
      share history. Require the local decision and the no-base warning.
      Run Cargo inside the scratch clone so its manifest selects that checkout.
- [x] After the smoke checks, discard only the unpushed fixture commit and its
      uncommitted change. Keep every pushed commit. Commit fixture removal,
      tick this milestone and push. Leave no fixture directory in the final tree.
- [x] Record the smoke results in
      `.context/remote-verification-base-commit/smoke.md`.
- [x] Run the xtask tests, `cargo fmt --all -- --check`, Clippy and the length
      lints, the local repository gate and the Markdown checks. Commit and
      push.

## Milestone 4: Verification, close-out and review — completed

The complete gate passes on Testboxes from a branch with unpushed commits. The
review runs after the push.

Evidence: `.context/remote-verification-base-commit/gate.log`,
`.context/remote-verification-base-commit/merge-audit.md` and the review files
under `.context/remote-verification-base-commit/`.

- [x] Run all tests for this change with a 100% pass rate. Run
      `cargo fmt --all -- --check`, Clippy and the length lints.
- [x] Run the complete `cargo xtask check` with at least one unpushed commit
      on the branch. Require the remote executor, 11/11 commands, 9/9 reports,
      a passed aggregate, an unchanged tree and `cleanup=0`. Save the output
      as `gate.log`.
- [x] Update the delivery status of the new protocol page and of
      `remote-verification.md`.
- [x] Inspect the diff and the deletions against `origin/main`. Run the
      mainline preservation audit from the Git rules.
- [x] After the checks pass, run `git add -A`, commit with Conventional
      Commits and push the branch.
- [x] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and reports the
      findings. Keep the review read-only. The implementer then applies the
      review-fix rule in [the review rules](../docs/dev/review.md): fix the
      `Auto-fix: yes` findings, run the checks, commit and push, re-review
      once, fix any new `Auto-fix: yes` findings once more, then stop and
      report the rest. Add each open finding as one line under this TODO.

  - Finding 1 (High): inherited Git variables can corrupt checkout state. Recommend B: clear repository variables in remote and local children and test Git helpers.
  - Finding 2 (Medium): synced renames and deletions break index-based checks. Recommend B: stage the synced tree in the suite wrapper after the fingerprint check.
  - Finding 3 (Medium): real-Git tests depend on global settings. Recommend B: isolate global and system Git config in test helpers.

## Milestone 5: Git repository variables (review finding 1) — completed

Xtask removes inherited Git repository variables from its children. These
variables select which repository, work tree and index Git uses. Git in each
child then finds its repository from the child's own working directory.
Linked-worktree snapshot commands preserve the checkout and its index when a
hook, rebase command or alias starts xtask.

Evidence: `.context/remote-verification-base-commit/finding1.md`.

- [x] Define the shared 15-name Git repository variable list. Name
      `git rev-parse --local-env-vars` and Git 2.50.1 in its doc comment.
- [x] Remove the list in both remote spawn builders and the local builder.
      Apply the temporary index afterwards. Preserve secrets, network and
      prompt rules. Cover Rust test Git helpers through the same boundary.
- [x] Add structural tests for both builders and the kill helper. Require
      every removal, scoped temporary indexes, secret removal and preserved
      network and prompt variables. Record failures before the fix and passes
      after it.
- [x] Add a re-exec real-child test for inherited `GIT_DIR`, `GIT_WORK_TREE`,
      `GIT_INDEX_FILE` and `GIT_PREFIX`. Record its failing and passing runs.
- [x] Add re-exec snapshot regressions with a linked checkout, one pushed
      commit, one unpushed commit and a staged file. Test `GIT_DIR` alone and
      with `GIT_WORK_TREE`. Require expected snapshot files and unchanged
      checkout HEAD, index, status, config and worktree list. Record both runs.
- [x] Keep every Rust file at or below 300 lines. Split support modules when
      needed. Keep tests under `_tests_`.
- [x] Define the Git child environment rule in the security protocol. Link
      it from the base snapshot section. Update both READMEs. Keep the base
      protocol under 250 lines. Add no lines to the protocol index or Testbox
      page, which are at their caps.
- [x] Run the full xtask tests before and after the fix with `GIT_DIR` naming
      only a scratch linked worktree under `/tmp`. Record config, status and
      worktree list before and after each run. Require damage before the fix
      and unchanged state afterwards. Never use this checkout or its hooks.
- [x] Run xtask tests, Rust fmt, Clippy, both length lints, the repository
      suite, Markdown and protocol tests, and `npm run format:check`.
- [x] Run the complete default automatic gate from the unpushed fix commit.
      Require the pushed branch tip as base, ahead 1, 11/11 commands, 9/9
      reports, a passed aggregate, an unchanged tree and cleanup=0. Save
      `finding1-gate.log`. Require no box, snapshot or extra worktree remains.
- [x] Commit with a Conventional Commits title of at most 50 characters that
      names finding 1. Keep it unpushed for the complete gate. After the gate
      passes, record the completed TODOs and push. Keep all evidence ignored.
- [x] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and reports the
      findings. Keep the review read-only. The implementer then applies the
      review-fix rule in [the review rules](../docs/dev/review.md): fix the
      `Auto-fix: yes` findings, run the checks, commit and push, re-review
      once, fix any new `Auto-fix: yes` findings once more, then stop and
      report the rest. Add each open finding as one line under this TODO.

  - Finding 5 (Low): default status rewrites raw index bytes with `core.untrackedCache=true` or `feature.manyFiles=true`; `commit.gpgsign=true` also fails (finding 3). Recommend A: add `--untracked-files=all` to the snapshot capture status call.
  - Finding 7 (Low): `isolated_environment` can pass when the child filter matches no test. Recommend A: require `running 1 test` in child output.

## Milestone 6: Box index staging and test isolation (review findings 2, 3, 5 and 7)

The box index records the synced tree before suites run. Fixture Git commands
use isolated config. Snapshot and re-exec regressions retain their assertions.

Evidence: `.context/remote-verification-base-commit/milestone6.md`.

- [x] Fix finding 7 in the first commit with Decisions 11 and 12 and this
      skeleton. Record a wrong caller name passing before the guard and failing
      afterwards. Restore the caller and require `running 1 test`.
- [x] Fix finding 5 in its own commit. Record both snapshot regressions with
      global untracked cache failing before the status flag and passing after
      it. Disable repository variable removal briefly and require both to fail.
      Restore production bytes and keep the raw index comparisons.
- [ ] Fix finding 3 in its own commit. Audit every fixture Git call. Use one
      test-only runner with an empty global config file, no system config and
      shared variable removal. Keep SystemProcess for code under test and its
      request recording. Record the before and after global and system matrix.
- [ ] Fix finding 2 in its own commit. Add wrapper staging after fingerprint
      validation with the existing failure boundary. Add injected order and
      failure tests and a real-Git rename, deletion and fingerprint regression.
      Audit repository index readers. Define the box index contract and update
      wrapper docs without removing rules or exceeding file caps.
- [ ] Run xtask tests, Rust fmt, Clippy, both length lints, the repository
      suite, Markdown and protocol tests, wrapper tests and Prettier. Push
      exactly the four finding commits after all checks pass.
- [ ] Merge origin/main locally under the preservation audit. Resolve only
      the approved index conflict. Preserve the verification index entry,
      remove our split-list entry and keep main's test logic. Inspect every
      auto-merged path and save `merge-2-audit.md`. Stop for another conflict.
- [ ] Run the repository suite and Markdown and protocol tests on the merge
      tree. Keep the merge unpushed.
- [ ] Create one unpushed smoke commit. Delete the unlinked completed plan.
      Rename a capped protocol page that no code or test reads by path, its cap
      key and every inbound Markdown link. Require both local checks to pass.
- [ ] Build the contract snapshot at the gate base. Link ignored node_modules.
      Require real Markdown links and protocol caps to fail before staging and
      pass after `git add -A`. Remove the snapshot under the cleanup contract.
- [ ] Run the complete automatic gate with the merge and smoke commit
      unpushed. Require origin/main as base, the Git ahead count, 11/11 commands,
      9/9 reports, a passed aggregate, unchanged tree and cleanup=0. Save
      `finding2-gate.log`. Stop if snapshot failure selects local mode.
- [ ] Discard only the unpushed smoke commit. Require the tree to equal the
      merge commit and push the merge. Preserve all pushed commits.
- [ ] Record final delivery status and completed TODOs after the gate. Require
      no owned box, snapshot or extra worktree and unchanged checkout config.
      Run the Markdown checks. Commit with Conventional Commits and push.
- [ ] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and reports the
      findings. Keep the review read-only. The implementer then applies the
      review-fix rule in [the review rules](../docs/dev/review.md): fix the
      `Auto-fix: yes` findings, run the checks, commit and push, re-review
      once, fix any new `Auto-fix: yes` findings once more, then stop and
      report the rest. Add each open finding as one line under this TODO.

## Post-merge follow-up (non-blocking)

- [ ] During the first week after the merge, record under
      `.context/remote-verification-base-commit/` every remote check that fell
      back to local mode because of a probe failure, with the warning text.
- [ ] If Blacksmith adds a CLI option that selects the commit to fetch, a
      later plan can remove the snapshot worktree.
- [ ] TypeScript test helpers still inherit `GIT_DIR` when a hook runs
      `npm test` directly; `tests/verification_source_tree.test.ts` is one
      example. This issue already exists on main. A separate plan can isolate
      those helpers.
