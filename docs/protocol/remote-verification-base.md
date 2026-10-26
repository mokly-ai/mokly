# Remote Verification: Base Commit Sync

Continuation of [Remote Verification](./remote-verification.md).

## Base Commit

Use the local `refs/remotes/origin/*` refs to find a pushed ancestor of the
checkout's `HEAD`. Never fetch inside xtask. Accept Git commit identities only
as full 40-character lowercase hex SHAs read from Git output.

Select the base with these rules:

1. Skip symbolic refs, including `refs/remotes/origin/HEAD`, so they do not
   add duplicate candidates.
2. Each remaining ref that shares history with `HEAD` adds its merge base with
   `HEAD` as a candidate. A ref without a common ancestor adds nothing.
   Duplicate candidates count once.
3. Drop each candidate that is an ancestor of another candidate. No candidate
   means no base.
4. When `refs/remotes/origin/main` shares history with `HEAD`, let M be their
   merge base. Keep only the candidates that contain M. M, or a candidate that
   contains M, always remains. Without a shared main history, keep the
   candidates unchanged.
5. Select the candidate with the lowest ahead count: the number of commits
   from the candidate to `HEAD`. Break a count tie with the smallest SHA in
   byte order.

A Git failure other than a missing common ancestor fails preparation.

If an origin ref contains `HEAD`, the selected base is `HEAD` and ahead is 0.
Stacked branches can use another pushed branch as their base.
An unpushed merge or rebase can use the main merge base instead of the old
pushed branch tip. A base B is an ancestor of checkout `HEAD` and contains M,
so `git merge-base B origin/main` equals M. This preserves the checkout's
comparison base for repository ratchets and the baseline dependency audit.

If GitHub does not have a selected commit, the sync probe fails.
Use the preparation fallback; do not fetch or change the base mid-run.

## Snapshot Worktree

Every remote run uses a fresh detached linked worktree, including a run whose
base equals checkout `HEAD`. Reuse the
[run identifier](./remote-verification-testbox.md#report-download-and-aggregation)
for the snapshot and temporary index:

- Snapshot: `.context/verification-snapshots/<run>/`.
- Temporary index: `.context/verification-snapshots/<run>.index`.

Allocate these paths under the checkout's ignored `.context/` directory.
The index path must be absolute and must not select the checkout's index.
If either run-specific path already exists, fail preparation. Never reuse it
or delete it. Reserve the run name with exclusive directory creation.
Partial-build cleanup removes only resources this run acquired, also after a
raced collision.

The snapshot holds the checkout's working tree: current content, deletions,
additions, renames, file modes, symbolic links and non-ignored untracked
files. It includes working-tree content for staged paths. Existing tracked
paths stay included when an ignore rule matches them. The snapshot's `HEAD`
and index are the base, so every source difference is unstaged or untracked
for CLI sync. A developer's `post-checkout` hook must not run in the snapshot.
The checkout's `HEAD`, index, files and status stay unchanged.
A detached checkout `HEAD` follows the same rules.
After removal, its worktree list and reflog must also match their initial state.

An interrupt never stops the snapshot build part way, because a killed
`git worktree add` can leave a locked admin entry that prune cannot remove.
An interrupt during the build takes effect when the build ends: it removes the
snapshot and prevents warmup and local fallback. Snapshot Git requests follow
the [child environment rule](./ci-verification-security.md#child-environment).

Compute the source-tree fingerprint from the checkout and from the snapshot.
Require equal values before warmup. A mismatch fails preparation.
The [fingerprint contract](./remote-verification-testbox.md#source-tree-fingerprint)
owns the algorithm and unsupported file types.

### Known Limit

A file that is new since the base can be tracked in checkout `HEAD` despite
an ignore rule because it was force-added. Resetting the snapshot index to the
base makes that file untracked and ignored. The CLI does not sync it.
The snapshot fingerprint differs from the checkout fingerprint, so preparation
fails and `auto` falls back to local. Explicit `remote` fails instead.
Do not add special handling for this case.

## Sync Source And Probe

Run each probe and all seven commands with the snapshot directory as the
local working directory. The Blacksmith CLI fetches its `HEAD`, which is the
base, then copies its non-ignored source differences to the box.
Before any build, each remote command gives every regular copied path that
differs from `HEAD` a fresh modification time. Unchanged paths keep their
warmup times, so Cargo can reuse unchanged native artifacts and rebuild every
changed crate.
Keep the checkout root for warmup, download, SSH disconnect, status and stop.
Keep local aggregation, logs and reports under the checkout root too.

Each probe must return the checkout fingerprint and the selected base SHA.
The [Testbox probe](./remote-verification-testbox.md#readiness-and-sync-probe)
defines the command, readiness bound, parsing and all-box barrier.
The wrapper stages the synced tree under the [box index rule](#box-index).
Suite reports therefore name the box `HEAD`, which is the base.
Run the aggregate with that same base and exactly five downloaded reports.
The final fingerprint check reads the checkout, so it detects local edits
made during remote execution.

## Box Index

The CLI copies files, not the index. After sync, box HEAD and index equal the base.
Deleted files stay cached. Renames show a deletion plus an untracked path.
Rename detection cannot pair them. After its fingerprint check, the wrapper
stages the synced tree with `git add -A`. Index readers (`git ls-files --cached`
and rename detection against the merge base) see a committed checkout's changes.
HEAD stays at the base, and reports and the aggregate still name it. Staging
does not change the fingerprint. A box checks the tree that `git add -A` records.
A deletion on disk that is not staged can fail a local run and pass on a box.

## Identity Output And File

Before warmup, print this executor line:

```text
[xtask/executor] information: run=<run> ref=<ref> HEAD=<head> base=<base> ahead=<n>
```

`HEAD` names the checkout commit. `base` names the pushed snapshot commit.
`ahead` is the selected base's commit count to checkout `HEAD`.
Append `base=<base>` and `cleanup=<count>` to the remote summary line.
The cleanup count names boxes neither stopped nor proven completed.

Write `.context/verification-logs/remote/<run>/identity.json` before warmup.
It holds these fields, in this order:

| Field         | JSON type | Value                               |
| ------------- | --------- | ----------------------------------- |
| `run`         | String    | Shared run identifier               |
| `head`        | String    | Validated full checkout SHA         |
| `base`        | String    | Validated full pushed base SHA      |
| `ahead`       | Integer   | Nonnegative commit count to `HEAD`  |
| `fingerprint` | String    | Validated checkout `sha256:` digest |

Use UTF-8 JSON with two-space indentation and one final newline.
Keep this file with the logs after cleanup.
Do not put it in the report directory; the aggregate accepts suite reports only.

## Executor Decision And Fallback

The base check runs after the Blacksmith access checks.
No shared origin history selects local mode in `auto`, with one warning:

```text
no origin ref shares history with HEAD; fetch origin or push the branch
```

Explicit `remote` fails with the same reason. A valid base allows this decision:

```text
remote: Blacksmith access and a pushed base commit are available
```

In automatic mode, no base prints this executor decision. `cargo xtask check`
writes it to standard error. `cargo xtask executor` writes it to standard output:

```text
local: a pushed base commit is unavailable
```

A failed Git lookup selects local mode with the same reason and a warning that
carries the command error. Explicit remote mode returns that command error.
Never infer no history from command failure text.

`cargo xtask executor` performs this lookup without building a snapshot.
`MOKLY_TESTBOX_REF` selects the warmup workflow ref only.
It changes neither the fingerprint nor the base commit.
Snapshot build, fingerprint or probe failures follow the
[preparation fallback](./remote-verification.md#executor-selection).
Snapshot removal errors only warn. They do not change the verification result
or the box cleanup count. Box cleanup failures and interrupts still prevent fallback.

## Snapshot Cleanup

Remove the snapshot and temporary index on success, preparation failure,
interrupt and panic unwind, also after a partial build. Cleanup during a panic
unwind must not panic again.

Cleanup removes the snapshot worktree, its admin entry, and the temporary index
file. It attempts every step even if an earlier step fails, also when the
snapshot path is already gone. A failed step prints one warning for the run.
The warning includes the manual cleanup commands:

```bash
git worktree remove --force --force <snapshot>; git worktree prune; rm -f <index>
```

A cleanup warning never fails the check. Preserve the log and report
directories. Box cleanup still follows the
[cleanup contract](./remote-verification-cleanup.md).

## Related Docs

- [Protocol index](./README.md)
- [Testbox execution](./remote-verification-testbox.md)
- [CI report evidence](./ci-verification.md#inventory-and-report-evidence)
- [Repository ratchets](./verification-ratchets.md)
