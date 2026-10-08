# Remote Verification: Base Commit Sync

Continuation of [Remote Verification](./remote-verification.md).

## Delivery Status

Base lookup, snapshot sync, cleanup and identity evidence are implemented under
the [base commit sync plan](../../plans/remote-verification-base-commit.md).
Linked-worktree sync has passed a real Testbox spike. Automatic and explicit
remote checks accept unpushed checkout commits when a pushed base is available.
The executor command uses the same implemented base selection.
The complete automatic gate passed after a local, unpushed merge of `main`.
It selected the main tip as the base. All 11 commands and nine reports passed.
The aggregate passed. The checkout stayed unchanged. Cleanup stopped every
box and removed the snapshot and temporary index.

## Base Commit

Use the local `refs/remotes/origin/*` refs to find a pushed ancestor of the
checkout's `HEAD`. Never fetch inside xtask. Accept Git commit identities only
as full 40-character lowercase hex SHAs read from Git output.

1. Read `HEAD` with `git rev-parse HEAD`.
2. List origin refs with
   `git for-each-ref --format=%(refname) %(symref) refs/remotes/origin/`.
   Pass the complete format as one argument. Skip symbolic refs, including
   `refs/remotes/origin/HEAD`, so they do not add duplicate candidates.
3. For each remaining ref, run `git merge-base HEAD <ref>`.
   Exit 1 means no common ancestor; skip that ref. Other command failures
   fail preparation. Deduplicate the returned SHAs.
4. If no candidates exist, return no base. Otherwise run
   `git merge-base --independent <candidate>...` to remove candidates that
   are ancestors of another candidate.
5. If `refs/remotes/origin/main` exists and shares history with `HEAD`, read
   `M = git merge-base HEAD refs/remotes/origin/main`. Keep only candidates
   for which `git merge-base --is-ancestor M <candidate>` exits 0.
   M, or a candidate that contains M, always remains. Exit 1 excludes a
   candidate. Other failures fail preparation. Without a shared main history,
   keep the independent candidates unchanged.
6. For each remaining candidate, read the nonnegative ahead count with
   `git rev-list --count <candidate>..HEAD`. Select the lowest count.
   Break a count tie with the smallest SHA in byte order.

If an origin ref contains `HEAD`, the selected base is `HEAD` and ahead is 0.
Stacked branches can use another pushed branch as their base.
An unpushed merge or rebase can use the main merge base instead of the old
pushed branch tip. A base B is an ancestor of checkout `HEAD` and contains M,
so `git merge-base B origin/main` equals M. This preserves the checkout's
comparison base for repository ratchets and the baseline dependency audit.

Pass Git SHAs, refs and paths as separate process arguments.
Never put Git data in a shell command string.
If GitHub no longer has a selected commit, the sync probe fails.
Use the existing preparation fallback; do not fetch or change the base mid-run.

## Snapshot Worktree

Every remote run uses a fresh detached linked worktree, including a run whose
base equals checkout `HEAD`. Reuse the
[run identifier](./remote-verification-testbox.md#report-download-and-aggregation)
for the snapshot and temporary index:

- Snapshot: `.context/verification-snapshots/<run>/`.
- Temporary index: `.context/verification-snapshots/<run>.index`.

Allocate these paths under the checkout's ignored `.context/` directory.
The index path must be absolute and must not select the checkout's index.
Create `.context/verification-snapshots/` before the first index write.
If either run-specific path already exists, fail preparation. Never reuse it
or delete it. Reserve the run name with exclusive directory creation.
Check the index path again before the first Git write. Leave it absent so
Git creates a valid index. Mark that path as owned immediately before the
first `read-tree` request. Track directory ownership before the next operation. Partial-build
cleanup removes only resources this run acquired, also after a raced collision.
Run these three commands from the checkout root. Set `GIT_INDEX_FILE` to the
temporary index only on these process requests:

```bash
git read-tree HEAD
git add -A
git write-tree
```

`read-tree` seeds the temporary index with tracked paths from `HEAD`.
`add -A` captures current content, deletions, additions, renames, file modes,
symbolic links and non-ignored untracked files. It includes working-tree
content for staged paths. Existing tracked paths stay included when an ignore
rule matches them. `write-tree` returns the tree SHA; validate it as Git data.

Create the linked worktree from the checkout root:

```bash
git -c core.hooksPath=/dev/null worktree add --detach <snapshot> <base>
```

Disabling hooks prevents a developer's `post-checkout` hook from running there.
Run these commands from the snapshot root, without `GIT_INDEX_FILE`:

```bash
git read-tree -u --reset <tree>
git read-tree <base>
```

The first command installs the checkout tree. The second resets only the
snapshot index to the base. The snapshot's `HEAD` remains the base.
Every source difference is now unstaged or untracked for CLI sync.
The checkout's `HEAD`, index, files and status stay unchanged.
A detached checkout `HEAD` follows the same steps.
After removal, its worktree list and reflog must also match their initial state.

All snapshot build Git requests use `cancellable: false`.
A killed worktree-add process can leave a locked admin entry that prune cannot
remove. Check the interrupt flag immediately after construction finishes.
An interrupt removes the snapshot and prevents warmup and local fallback.
If the process request needs an environment field, keep it typed.
Retain the shared secret environment removal and input redaction.

Compute the source-tree fingerprint from the checkout and from the snapshot.
Require equal values before warmup. A mismatch fails preparation.
The [fingerprint contract](./remote-verification-testbox.md#source-tree-fingerprint)
continues to own the algorithm and unsupported file types.

### Known Limit

A file that is new since the base can be tracked in checkout `HEAD` despite
an ignore rule because it was force-added. Resetting the snapshot index to the
base makes that file untracked and ignored. The CLI does not sync it.
The snapshot fingerprint differs from the checkout fingerprint, so preparation
fails and `auto` falls back to local. Explicit `remote` fails instead.
Do not add special handling for this case.

## Sync Source And Probe

Run each probe and all 11 suite commands with the snapshot directory as the
local working directory. The Blacksmith CLI fetches its `HEAD`, which is the
base, then copies its non-ignored source differences to the box.
Keep the checkout root for warmup, download, SSH disconnect, status and stop.
Keep local aggregation, logs and reports under the checkout root too.

Each probe must return the checkout fingerprint and the selected base SHA.
The [Testbox probe](./remote-verification-testbox.md#readiness-and-sync-probe)
defines the command, readiness bound, parsing and all-box barrier.
Keep the suite wrapper, strict report runners and aggregate schema unchanged.
Suite reports therefore name the box `HEAD`, which is the base.
Run the aggregate with that same base and exactly nine downloaded reports.
The final fingerprint check reads the checkout, so it detects local edits
made during remote execution.

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
Use a typed struct with these fields, in this order:

| Field         | JSON type | Value                               |
| ------------- | --------- | ----------------------------------- |
| `run`         | String    | Shared run identifier               |
| `head`        | String    | Validated full checkout SHA         |
| `base`        | String    | Validated full pushed base SHA      |
| `ahead`       | Integer   | Nonnegative commit count to `HEAD`  |
| `fingerprint` | String    | Validated checkout `sha256:` digest |

Use UTF-8 JSON with two-space indentation and one final newline.
Serialize the struct, or use a pure formatter over its validated fields.
Tests must check the exact bytes. Keep this file with the logs after cleanup.
Do not put it in the report directory; the aggregate accepts suite reports only.

## Executor Decision And Fallback

The availability policy uses a `Base` check after Blacksmith access.
No shared origin history selects local mode in `auto`, with one warning:

```text
no origin ref shares history with HEAD; fetch origin or push the branch
```

Explicit `remote` fails with the same reason. A valid base allows this decision:

```text
remote: Blacksmith access and a pushed base commit are available
```

In automatic mode, no base prints this executor decision on standard output:

```text
local: a pushed base commit is unavailable
```

A failed Git lookup uses the same local reason and its typed command warning.
Explicit remote mode returns that command error. Never infer no history from
command failure text.

`cargo xtask executor` performs this lookup without building a snapshot.
`MOKLY_TESTBOX_REF` selects the warmup workflow ref only.
It changes neither the fingerprint nor the base commit.
Snapshot build, fingerprint or probe failures follow the existing
[preparation fallback](./remote-verification.md#executor-selection).
Snapshot removal errors only warn. They do not change the verification result
or the box cleanup count. Box cleanup failures and interrupts still prevent fallback.

## Snapshot Cleanup

Remove the snapshot and temporary index on success, preparation failure,
interrupt and panic unwind. Track them before construction can leave partial
state. Use the cleanup guard or a sibling guard with the same unwind protection.
The guard must never panic while another panic unwinds the runner.

From the checkout root, remove the worktree and prune its admin entry:

```bash
git worktree remove --force --force <snapshot>
git worktree prune
```

Use `cancellable: false` for both Git requests. Always run prune, also when
the snapshot path is already gone or removal fails. Remove the temporary index
file too. Attempt each cleanup step even if an earlier step fails.
A failed step prints one warning for the run. Include the manual worktree
removal, prune and index-file removal commands. It never fails the check.
Preserve the log and report directories. Box cleanup still follows the
[cleanup contract](./remote-verification-cleanup.md).

## Related Docs

- [Protocol index](./README.md)
- [Testbox execution](./remote-verification-testbox.md)
- [CI report evidence](./ci-verification.md#inventory-and-report-evidence)
- [Repository ratchets](./verification-ratchets.md)
