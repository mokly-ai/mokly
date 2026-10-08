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
workflow, the suite wrapper, the suite reports, the report schema, the
aggregate script or the Blacksmith CLI.

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
   commit, because the wrapper and the strict runners stay unchanged. Xtask
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

### Contingency

The Milestone 1 spike must show that the CLI syncs a linked worktree and
propagates deletions and renames. If it does not, stop and ask the user before
Milestone 2. The fallback design detaches the checkout's own `HEAD` at the
base commit with `git update-ref --no-deref HEAD <base>` for the run and
restores it after. That design changes the checkout during the run, so it needs
the user's approval.

### Out Of Scope

- Changing the agent rule order or the hosted CI triggers (options A and B).
- Changes to the Testbox workflow, the suite wrapper, the report schema, the
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

## Post-merge follow-up (non-blocking)

- [ ] During the first week after the merge, record under
      `.context/remote-verification-base-commit/` every remote check that fell
      back to local mode because of a probe failure, with the warning text.
- [ ] If Blacksmith adds a CLI option that selects the commit to fetch, a
      later plan can remove the snapshot worktree.
