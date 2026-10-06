# Remote Verification: Testbox Execution

Continuation of [Remote Verification](./remote-verification.md).

## Delivery Status

The active [Blacksmith remote verification plan](../../plans/blacksmith-remote-verification.md)
approves this target. Explicit remote execution, the fingerprint, suite wrapper
and workflow are implemented. The wrapper selects `--executor local`.
Workflow validation and both box suite smoke checks pass.
Main's dependency fixes are merged. The complete explicit remote check passes.
Automatic remote selection and `cargo xtask executor` are pending.

## Workflow

`.github/workflows/blacksmith-testbox.yml` prepares one Testbox per dispatch.
Use `workflow_dispatch` with an optional `testbox_id` input that defaults to
an empty string. Use `push` with a path filter for this workflow file only.
A push run registers the workflow before merge. The push trigger has no
branch filter.

Set `permissions: contents: read`. Use no workflow secrets.
Run one job on `blacksmith-2vcpu-ubuntu-2404`.
Set `timeout-minutes: 30`.
`Required CI` does not depend on this workflow.

Run the steps in this order:

1. Check out full history and tags with `useblacksmith/checkout`.
   Set `fetch-depth: 0` and `persist-credentials: false`.
   The public repository lets boxes fetch pushed commits without a token.
2. Run `useblacksmith/begin-testbox` with `testbox_id: ${{ inputs.testbox_id }}`.
   An empty input uses validation mode, including on push runs.
3. Install Node 22.14.0 with `actions/setup-node` and npm's download cache.
   Use `cache: npm` and `cache-dependency-path: package-lock.json`.
   Set `package-manager-cache: false`. Then install npm 11.7.0.
4. Install Rust 1.95.0 with rustfmt and Clippy. Select it as the default.
5. Run `npm ci`. Write the lowercase SHA-256 digest of `package-lock.json`
   plus a newline to `$HOME/.mokly-testbox/package-lock.sha256`.
   Create the stamp directory if needed. Write the stamp only after success.
6. Run `npx playwright install --with-deps chromium`.
7. Write the job `PATH` and `PLAYWRIGHT_CHANNEL=chromium` to `/etc/environment`.
   Replace previous entries for those two names. Preserve other entries.
   New Testbox SSH sessions must use Node 22.14.0 and Chromium.
8. Run `useblacksmith/run-testbox`. It keeps the job alive until the idle timeout.

Warmup selects a 30-minute idle timeout. Readiness still uses `10m`.
The pinned action does not detect the SSH session in this environment.
Only the start of each `testbox run` resets the observed idle timer.
Download a report as its command ends. Then clean up that box at once under
the [cleanup contract](./remote-verification.md#cleanup-and-interrupts).
Key login saves the key in the local CLI credential file.
It replaces any saved login for the same organization.
The [key contract](./remote-verification.md#key-and-cli-handling) names that file.

Pin each action to these immutable revisions. Keep the version comments.

| Action                        | Commit                                     | Comment    |
| ----------------------------- | ------------------------------------------ | ---------- |
| `useblacksmith/checkout`      | `25227e61ff9dafe400e22fa487b673eac4e4409a` | `# v1`     |
| `useblacksmith/begin-testbox` | `233448af4bfdc6fca509a7f0974411ac6d8a8043` | `# v2`     |
| `actions/setup-node`          | `249970729cb0ef3589644e2896645e5dc5ba9c38` | `# v6.5.0` |
| `useblacksmith/run-testbox`   | `5ca05834db1d3813554d1dd109e5f2087a8d7cbc` | `# v2`     |

## Remote Commands

Each box runs `node scripts/verification/testbox-suite.mjs` with
`--expect <fingerprint>` and the arguments below. Execute from the synced
repository root. Derive the command name from the suite and optional shard.
Use that name for its report and log.

| Command name     | Wrapper arguments             |
| ---------------- | ----------------------------- |
| `repository`     | `--suite repository`          |
| `package`        | `--suite package`             |
| `unit-1-of-4`    | `--suite unit --shard 1/4`    |
| `unit-2-of-4`    | `--suite unit --shard 2/4`    |
| `unit-3-of-4`    | `--suite unit --shard 3/4`    |
| `unit-4-of-4`    | `--suite unit --shard 4/4`    |
| `browser-1-of-4` | `--suite browser --shard 1/4` |
| `browser-2-of-4` | `--suite browser --shard 2/4` |
| `browser-3-of-4` | `--suite browser --shard 3/4` |
| `browser-4-of-4` | `--suite browser --shard 4/4` |
| `hydration`      | `--suite hydration`           |

The wrapper accepts only the suite and shard forms from
[CI verification](./ci-verification.md#verification-boundary).
Invalid arguments fail before any suite starts.

## Readiness And Sync Probe

`blacksmith testbox run` syncs the local checkout before its command starts.
It fetches local `HEAD` from GitHub and copies uncommitted, non-ignored files.
It does not copy Git-ignored files. The probe command is:

```bash
blacksmith testbox run --id <box-id> --wait-timeout 10m "node scripts/verification/source-tree.mjs --expect <fingerprint> --print-head"
```

The probe uses `--wait-timeout 10m`. Xtask does not retry it.
The CLI prints status lines around the command output. Xtask reads the
fingerprint from the one line that matches `^sha256:[0-9a-f]{64}$`.
It reads `HEAD` from the one line that matches `^[0-9a-f]{40}$`.
Zero or several matches for either value fail the probe.
Any nonzero exit, a missing or different fingerprint line, or a missing or
different `HEAD` line fails the probe phase.
Require successful probes on every box before any suite command starts.
The [executor contract](./remote-verification.md#executor-selection) defines
fallback at this boundary.

## Suite Wrapper

`scripts/verification/testbox-suite.mjs` performs these steps on each box:

1. Compute the fingerprint. Fail immediately if it differs from `--expect`.
2. Check whether the repository is shallow. If it is, run
   `git fetch --unshallow --tags origin`. A failed fetch fails the wrapper.
   The CLI sync uses `git fetch --no-tags --depth 50` and makes the clone
   shallow on every `testbox run`, even after full-history checkout.
   Restore history and release tags in every suite command before its checks.
3. Compare the current `package-lock.json` SHA-256 with the workflow stamp at
   `$HOME/.mokly-testbox/package-lock.sha256`.
   A missing stamp counts as a mismatch. On a mismatch, run `npm ci`, then
   `npx playwright install chromium`. Fail if either command fails.
   Write the new digest stamp only after both commands succeed.
   An equal digest requires neither command.
4. Set `MOKLY_VERIFICATION_REPORT` to
   `.context/verification-reports/remote/<command>.json`.
   Run `cargo xtask check --executor local --suite <suite>`.
   Add `--shard INDEX/4` for a unit or browser shard.
   Explicit local mode prevents recursive remote execution.
5. Return the suite's exit code. A wrapper preparation failure returns nonzero.

Stream child standard output and standard error. Forward SIGINT and SIGTERM
to the running child through the verification process owner.
An interrupted command must not produce a successful wrapper result.

Testbox commands do not receive `GITHUB_SHA`, `GITHUB_ACTIONS` or `CI` from
the workflow session. Keep that behavior. Report writers must read the synced
repository's `HEAD`. Do not replace it with the workflow dispatch commit.
Do not send the local org token or saved CLI credentials to the box.

## Source-Tree Fingerprint

`scripts/verification/source-tree.mjs` uses the same algorithm locally and on
every box. Run it from the repository root.

1. Read Git index entries with `git ls-files --stage -z`.
   Fail on any submodule entry with mode `160000`.
2. List paths with `git ls-files -z --cached --others --exclude-standard`.
   Keep repository-relative path bytes. Remove duplicate paths.
   Sort paths by unsigned byte order, not locale order.
3. Inspect each path without following symbolic links.
   Skip paths that do not exist. Other read errors fail the command.
   Reject directories and other unsupported file types.
4. For a regular file, read its working-tree bytes. Use mode `100755` if any
   executable permission bit is set. Otherwise use `100644`.
   For a symbolic link, use mode `120000`. Hash its link-target bytes.
   Do not read the linked file. Include broken symbolic links.
5. Compute each content digest as lowercase SHA-256 hex.
   Encode a record as ASCII mode, NUL, raw path bytes, NUL, ASCII content
   digest, NUL. Concatenate records in the sorted path order.
6. Hash the concatenated records with SHA-256. Print `sha256:` followed by
   its lowercase hex digest and a newline.

The digest includes content, mode, path, deletion and non-ignored untracked
changes. It excludes Git metadata, commit identity and Git-ignored untracked
files. The same working tree has the same digest whether changes are committed
or uncommitted. Tracked paths still participate if an ignore rule matches them.

`--expect <fingerprint>` requires the computed value to match exactly.
A mismatch returns nonzero. Both scripts include the expected and actual
fingerprints in the mismatch error. `--print-head` adds the full lowercase local
`HEAD` SHA on a separate line after the fingerprint. Read failures return
nonzero. The probe checks that SHA independently from the digest.

## Related Docs

- [Protocol index](./README.md)
- [CI workflow graph](./ci-workflow.md#testbox-workflow-target)
- [CI dependency cache and security](./ci-verification-security.md)
