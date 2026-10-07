# Dependency Audit Baseline

## Delivery Status

The strict and baseline scripts, structured issues, byte comparison, JSON
reports, xtask defaults, and CI mode selection are implemented. The scheduled
strict audit and update script maintain the
[dependency update pull request](./dependency-audit-update-pr.md).
The [dependency security contract](./dependency-security.md) owns reviewed
exceptions and dependency update policy.

## Modes And Command

`npm run dependencies:check` runs the strict workspace audit.
`npm run dependencies:check -- --baseline` runs the baseline-relative audit.
Either mode accepts optional `--report <file>` to write a JSON summary.
These are the only accepted options. An unknown argument or a missing report
path fails before npm starts.

Both modes run the same live registry command:

```bash
npm audit --json --audit-level=low --package-lock-only --include=prod --include=dev --include=optional --include=peer --prefix .
```

The explicit `--prefix .` and cleaned `npm_config_*` keys make npm audit
the working-directory tree, even when a parent `npm run` exported another
project prefix. Set the command's working directory to the tree under audit.
Before spawning npm, remove inherited `npm_config_local_prefix`,
`npm_config_prefix`, `npm_config_workspace`, `npm_config_workspaces`, and
`npm_config_global` keys, regardless of their case. Set `INIT_CWD` to that
directory. Preserve registry, user configuration, and authentication settings.
This applies to both head and temporary audits invoked through `npm run`.
The relative prefix also keeps paths with spaces outside Windows shell arguments.

The root lockfile supplies the dependency tree. Installed packages do not
supply audit input. All four categories stay explicit even when local npm
configuration omits one. Strict mode fails on every uncovered Low-or-higher
advisory or exception issue. Active reviewed exceptions retain their exact
path, inclusive UTC expiry, and maximum 31-day window.

## Comparison Commit And Tree

Baseline mode uses `GitWorkspace.requireBase()` from
`scripts/verification/ratchets/git.mjs`. The comparison commit is
`git merge-base HEAD origin/main`, with the same uncommitted-merge rules as
the [repository ratchets](./verification-ratchets.md).

Use `MERGE_HEAD` only when it equals `origin/main`. If `MERGE_HEAD` is an
ancestor of a newer `origin/main`, fail and ask for a refreshed merge. For
other uncommitted merges, retain the normal merge-base rule. Outside such a
merge, a moved `origin/main` does not replace the branch point with its tip.
CI must fetch `origin/main` and enough history to resolve this commit.

After an inheritable head issue, read these three files from the comparison
commit and compare each with its working-tree file byte for byte:

- `package.json`
- `package-lock.json`
- `scripts/verification/dependency-audit-exceptions.json`

If all three match, inherit every head finding and exception issue without
a second registry call. This covers a clean push to `main` and every pull
request that leaves these inputs unchanged. Otherwise write the baseline
manifest and lockfile into a new temporary directory and run the same
lockfile-only npm audit there, even when the comparison commit equals `HEAD`.
Workspace manifests and `npm ci` are not required. Evaluate the result with
that commit's exceptions and lockfile. Always dispose of the temporary
directory, including after a failure.

On a push to `main`, `HEAD` and `origin/main` are the pushed commit. The audit
compares that commit with itself, so it fails only on audit errors (report,
input, or registry). The daily strict audit and the strict release audit own
new advisories on `main`.

## Order And Structured Issues

Run the head audit first. Evaluate it strictly with the current lockfile and
exception file. Capture the clock once and use that value for both trees.

The evaluator returns `ok`, `issues: AuditIssue[]`, and accepted-risk
`notices`. Each issue has a `kind` and an actionable `message`:

| Kind        | Meaning and additional fields                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finding`   | Uncovered advisory: `package`, `advisoryUrl`, optional GHSA `advisoryId`, `severity`, `title`, and `installLocations: string[]`.                                                                                                                                                                        |
| `exception` | Single-record schema, duplicate, expiry or review-window issue; stale record; invalid reviewed dependency path or coverage.                                                                                                                                                                             |
| `report`    | Non-JSON npm output; invalid report version, entries, advisories, references, or effects; registry error object; unexpected exit status or report/status disagreement.                                                                                                                                  |
| `input`     | File read or JSON parse failure; invalid lockfile inventory, entry, location, or dependency map; non-array exception file; invalid clock, including its record messages; launch failure or signal; comparison resolution/read; temporary-directory creation, write, or disposal; summary write failure. |

Classify each error at its source. A file-level exception-array error is
`input`, even though its message names exceptions. An invalid clock is also
`input` for both its global message and each affected record. If an invalid
lockfile prevents a reviewed path check, that derived failure is `input`.

The strict evaluator's `ok` is true only when `issues` is empty. Report
validation and exception coverage keep their existing rules. Informational
advisories do not become findings. Package-name-only effect entries do not
create separate findings when their referenced advisory objects are covered.

If the head has any `report` or `input` issue, fail without resolving the
baseline or running its audit. Print every head issue as an error, including
any findings and exception issues. None is inherited on this path.

If the head has no issue, return success without resolving the comparison
commit or making a second registry call. Otherwise resolve the comparison
commit and read all three baseline files. Skip the second audit only when
all three are byte-identical to the working-tree files. A matching commit
hash alone does not prove inheritance for uncommitted dependency changes.

When any input differs, run the baseline audit second. This includes a dirty
working tree whose comparison commit equals `HEAD`. An advisory published
between the two calls can appear only in the second report. It cannot create
a false new head finding. Tests must cover identical inputs and a changed
working-tree lockfile at the same comparison commit that creates a new finding.

## Inheritance

A head finding is inherited only when a baseline finding has the same package
and advisory URL, and its install locations include every head location.
The GHSA identifier alone does not establish a match. Removing a vulnerable
location is allowed. Adding a location creates a new issue, even for the same
advisory. An advisory covered by a valid baseline exception is not a baseline
finding and cannot cover a new uncovered head finding.

A head exception issue is inherited only when the strict baseline evaluation
has an exception issue with the identical message. That evaluation uses the
baseline report, lockfile, exception file, and shared clock. An unchanged
expired or stale record can be inherited. A changed path or record that
changes the issue message cannot be inherited.

`report` and `input` issues are never inherited. A baseline report or input
failure prevents a valid comparison and fails the run. Preserve the head
issues as errors and add the baseline failure with its action.

The baseline run succeeds only when every head issue is inherited and the
comparison has no operational failure. It keeps those issues in the result
and report with `inherited: true`. Any unresolved or new issue has
`inherited: false` and fails the run.

## Output And JSON Summary

Print one comparison-commit line when baseline mode resolves the commit.
Print each inherited issue as a notice that names the commit and tells the
maintainer to fix the issue on `main` through the dependency update pull
request. Print each new issue as an error with its current message. Keep
accepted-risk notices with the existing review details.

When a comparison passes, finish with a pass line that names the comparison
commit and inherited issue count. When no comparison is needed, keep the
existing clean-audit or accepted-risk success output. A failed run exits
with status 1.

When `--report <file>` is present, write a JSON summary on every completed
run, including command, registry, file, and comparison failures:

| Field              | Contract                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `mode`             | `strict` or `baseline`.                                                                           |
| `ok`               | Boolean final run outcome. Strict: no issues. Baseline: all issues inherited.                     |
| `comparisonCommit` | Commit hash when a comparison was resolved; omit it otherwise.                                    |
| `issues`           | Structured issues described above. In baseline mode each also has a required boolean `inherited`. |

Strict reports have no inheritance flags. Accepted risks are notices, so they
are not summary issues. Invalid CLI input does not start an audit run. A
summary write failure adds an `input` issue, prints an action that names the
file, and fails. The scheduled workflow requests
`--report .context/dependency-audit.json`; its update script consumes this
file under the [update pull request contract](./dependency-audit-update-pr.md).

## Failure Actions

Missing `origin/main`, missing history, or merge-base errors must print an
audit-specific message that tells the caller to run `git fetch origin main`
and retry. A moved target during an uncommitted merge must ask the caller to
fetch and merge it again. Append the Git cause to that audit message, including
its nested command diagnostics. A `Repository ratchet` error alone is not the
audit's required message.

A missing baseline file asks the caller to restore the required file in the
comparison tree or fetch the required history and retry. A baseline registry
or report failure asks the caller to restore registry access or check npm's
output and retry. These failures never become inherited notices.

Unit tests inject commands, byte reads, comparison resolution, temporary-directory
creation and disposal, report writing, the clock, and logging. They make no
registry calls. Live smoke tests use fixture-owned Git histories outside the
repository and keep evidence under `.context/`.

## Xtask And CI Selection

`cargo xtask check [--dependency-audit <baseline|strict>]` defaults to
`baseline`. The flag is valid for the complete gate and `--suite repository`.
An explicit flag with another suite returns a typed error before any subprocess
starts. The repository suite calls `npm run dependencies:check -- --baseline`
or `npm run dependencies:check` for the selected mode.

The CI repository job passes `--dependency-audit "$DEPENDENCY_AUDIT"`:

- Select `strict` for a same-repository pull request whose head ref starts
  with `dependency-audit/` or whose labels include `dependency-audit`.
- Select `strict` for a same-repository Release Please pull request under
  the existing `release-please--` head-ref or `autorelease:` label detection.
- Select `baseline` for all other pull requests and every push. A fork
  cannot select strict mode through a matching branch name or label.

Adding the `dependency-audit` label does not start CI. The label takes effect
at the next `opened`, `synchronize`, or `reopened` pull request event. After
adding it, a maintainer pushes a commit or closes and reopens the pull request.
The bot pull request selects strict mode from its head ref before the label
is added.

The Release workflow's direct `npm run dependencies:check` publish step stays
strict. It runs before reusable evidence or the complete fallback is selected.
The complete fallback runs `cargo xtask check --dependency-audit strict`, so
its repeated workspace audit also stays strict.
The scheduled audit and dependency update pull requests stay strict. On every
strict surface, an expired exception requires a new risk review or removal;
a stale exception requires removal. The packed-consumer production
audit stays strict and has no workspace exceptions.

Related contracts: [CI verification](./ci-verification.md),
[CI workflow graph](./ci-workflow.md), and
[local verification](../../xtask/README.md).
