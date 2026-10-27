# Remote Verification: Testbox Execution

Continuation of [Remote Verification](./remote-verification.md).

## Workflow

`.github/workflows/blacksmith-testbox.yml` prepares one Testbox per dispatch.
Use `workflow_dispatch` with an optional `testbox_id` input that defaults to
an empty string. Use `push` with `branches: ["**"]` and a path filter for this
workflow file only. A branch push must match both filters. Tag pushes do not
start the workflow. A push run registers the workflow before merge.

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
3. Install Node 22.15.0 with `actions/setup-node` and npm's download cache.
   Use `cache: npm` and `cache-dependency-path: package-lock.json`.
   Set `package-manager-cache: false`. Then install npm 11.21.0.
4. Run `rustup toolchain install` in the checkout. It installs Rust 1.95.0 with
   rustfmt and Clippy from `rust-toolchain.toml`. That file also selects the
   toolchain for every command in the checkout.
5. Run `npm ci`.
6. Run `cargo xtask build-native` to build the host native artifact.
7. Write the lowercase SHA-256 digest of `package-lock.json`
   plus a newline to `$HOME/.mokly-testbox/package-lock.sha256`.
   Create the stamp directory if needed. Write the stamp only after both
   installation and the native build succeed.
8. Run `npx playwright install --with-deps chromium`.
9. Write the job `PATH` and `PLAYWRIGHT_CHANNEL=chromium` to `/etc/environment`.
   Replace previous entries for those two names. Preserve other entries.
   New Testbox SSH sessions must use Node 22.15.0 and Chromium.
10. Run `useblacksmith/run-testbox`. It keeps the job alive until the idle timeout.

Warmup selects a 30-minute idle timeout. Readiness uses `10m`. The pinned
action does not detect the SSH session, so only the start of each
`testbox run` resets the idle timer.
Download a report as its command ends. Then clean up that box at once under
the [cleanup contract](./remote-verification-cleanup.md#cleanup-and-interrupts).

Blacksmith's "Complete runner" step waits for open SSH sessions before
shutdown, and Blacksmith bills that wait. The CLI's shared SSH connection stays
open after a command ends. Cleanup therefore closes it under the
[close step](./remote-verification-cleanup.md#close-the-shared-ssh-connection).

Workflow action revisions and their version comments require review.
The [verification reference](../../scripts/verification/README.md#testbox-workflow-reference)
lists the revisions.

## Remote Commands

Each box runs `node scripts/verification/testbox-suite.mjs` with
`--expect <fingerprint>` and the arguments below. Execute from the synced
repository root. Derive the command name from the suite and optional shard.
Use that name for its report and log.

| Command name      | Wrapper arguments                              |
| ----------------- | ---------------------------------------------- |
| `repository`      | `--suite repository --dependency-audit <mode>` |
| `viewer`          | `--suite viewer`                               |
| `browser-1-of-4`  | `--suite browser --shard 1/4`                  |
| `browser-2-of-4`  | `--suite browser --shard 2/4`                  |
| `browser-3-of-4`  | `--suite browser --shard 3/4`                  |
| `browser-4-of-4`  | `--suite browser --shard 4/4`                  |
| `static-delivery` | `--suite static-delivery`                      |

The wrapper accepts the suite and shard forms from
[CI verification](./ci-verification.md#verification-boundary), plus the
independent `static-delivery` command without a shard.
`<mode>` is the complete gate's `--dependency-audit` value, `baseline` by
default or `strict`. The wrapper accepts that option only with the repository
suite and passes it to `cargo xtask check`. The command name stays
`repository`. Invalid arguments fail before any suite starts.
An invalid `--expect` value fails with the same error in the wrapper and in
the fingerprint script. Each script follows that error with its own usage line.

Static delivery runs on its own box. It builds the source and checks the
example through static HTTP and file URLs. Both modes must pass.
These selected delivery checks do not replace any of the five suite reports.
No browser shard runs delivery after its ordinary specs. Browser work and portable
delivery use separate 30-minute Testbox job guards.

## Readiness And Sync Probe

Run `blacksmith testbox run` from the
[snapshot worktree](./remote-verification-base.md#snapshot-worktree).
The CLI fetches its `HEAD`, the base commit, then copies uncommitted,
non-ignored files. The synced `rust-toolchain.toml` selects the suite toolchain.
Without it, the box uses its default toolchain. Merge `main` into the branch
before remote verification. Run this probe from the snapshot directory:

```bash
blacksmith testbox run --id <box-id> --wait-timeout 10m "node scripts/verification/source-tree.mjs --expect <fingerprint> --print-head"
```

The probe uses `--wait-timeout 10m`. Xtask does not retry it.
Read whole lines that match `^sha256:[0-9a-f]{64}$` for the fingerprint or
`^[0-9a-f]{40}$` for `HEAD`. Ignore other CLI status lines.
Zero or several matches for either value fail the probe.
A nonzero exit, missing or different fingerprint, missing `HEAD`, or `HEAD`
that differs from the base fails the probe phase.
Require successful probes on every box before any suite command starts.
The [executor contract](./remote-verification.md#executor-selection) defines
fallback at this boundary.

## Suite Wrapper

The suite wrapper runs these steps on each box, in this order:

1. It computes the fingerprint and fails at once if the value differs from
   `--expect`.
2. It stages the synced tree under the
   [box index rule](./remote-verification-base.md#box-index). Failed or
   signalled staging fails before history, installs, cargo or stamp writes.
3. It restores full history and release tags when the clone is shallow. A
   failed fetch fails the wrapper. The CLI sync makes the clone shallow on
   every `testbox run`, even after a full-history checkout, so every suite
   command restores history before its checks.
4. It reinstalls dependencies when the SHA-256 digest of `package-lock.json`
   differs from the workflow stamp at `$HOME/.mokly-testbox/package-lock.sha256`.
   A missing stamp counts as a difference. The reinstall runs `npm ci`, then
   `npx playwright install chromium`, and fails if either command fails. It
   writes the new digest stamp only after both commands succeed. An equal
   digest requires neither command.
5. It sets `MOKLY_VERIFICATION_REPORT` to
   `.context/verification-reports/remote/<command>.json` and runs
   `cargo xtask check --executor local --suite <suite>`, with
   `--shard INDEX/4` for a browser shard. Explicit local mode prevents
   recursive remote execution. For `static-delivery`, it runs
   `npm run build`, then `npm run test:delivery:prepared` instead. A failed or
   interrupted build prevents delivery. The wrapper validates both delivery
   reports before it exits.
6. It returns the suite's exit code. A wrapper preparation failure returns
   nonzero.

The wrapper streams the child's standard output and standard error. It
forwards SIGINT and SIGTERM to the running child. An interrupted command must
not produce a successful wrapper result.

Testbox commands do not receive `GITHUB_SHA`, `GITHUB_ACTIONS` or `CI` from
the workflow session. Report writers must read the synced repository's `HEAD`.
Do not replace it with the workflow dispatch commit.
Do not send the local org token or saved CLI credentials to the box.

## Source-Tree Fingerprint

`node scripts/verification/source-tree.mjs` computes the fingerprint locally
and on every box with the same algorithm. Run it from the repository root. It
prints `sha256:` followed by a lowercase hex SHA-256 digest and a newline.

The digest covers every index path and every non-ignored untracked path: its
repository-relative path bytes, its mode, and its content. A regular file has
mode `100755` when any executable permission bit is set, and `100644`
otherwise. A symbolic link has mode `120000`. Its content is its link target,
so a broken link still counts. The digest therefore includes content, mode,
path, deletion and non-ignored untracked changes. It excludes Git metadata,
commit identity and Git-ignored untracked files. The same working tree has the
same digest whether changes are committed or uncommitted. Tracked paths still
participate if an ignore rule matches them.

A submodule entry fails. A directory with a `.git` file or directory fails, and
so do untracked directories and other unsupported file types. The error names
the relative path and tells the caller to ignore or remove a nested repository
or worktree. `.gitignore` ignores `.claude/worktrees/`; other non-ignored
nested repositories still fail. Never silently omit them. Other read errors
fail.

`--expect <fingerprint>` requires the computed value to match exactly.
A mismatch returns nonzero. Both scripts include the expected and actual
fingerprints in the mismatch error. `--print-head` adds the full lowercase local
`HEAD` SHA on a separate line after the fingerprint. Read failures return
nonzero. The probe checks that SHA independently from the digest.

## Report Download And Aggregation

The suite wrapper writes each report on its box to
`.context/verification-reports/remote/<command>.json`.
Only the viewer command and browser shards 1 through 4 produce the five
required reports. Repository and static-delivery outcomes use their command exits.

Allocate a new local report directory for each run:
`.context/verification-reports/remote/<run>/`.
The `<run>` value is UTC time in `YYYYMMDDTHHMMSSZ` format, a hyphen and the
xtask process ID in decimal. For example, `20261006T134131Z-1234`.
Compute it once at run start. Report and log directories use the same value.
Download each report there under its command name. Do not use reports from
another run. A missing or failed download fails remote verification.
Download each report as its command ends, before stopping that box.

Use the CLI download command for each required report:

```bash
blacksmith testbox download --id <box-id> .context/verification-reports/remote/<command>.json .context/verification-reports/remote/<run>/<command>.json
```

Run the aggregate after box cleanup:

```bash
node scripts/verification/aggregate.mjs --reports .context/verification-reports/remote/<run> --commit <base> --runtimes node-22.15.0
```

The [evidence rules](./ci-verification.md#inventory-and-report-evidence)
apply. The aggregate must accept
exactly five reports for the expected commit and runtime profile.
It must prove complete browser shard coverage.
The box `HEAD` and reports name the base; the
[identity contract](./remote-verification-base.md#identity-output-and-file) records
checkout `HEAD`. Fingerprints cover source changes and reject edits during the run.

## Related Docs

- [Protocol index](./README.md)
- [Cleanup and interrupts](./remote-verification-cleanup.md)
- [CI workflow graph](./ci-workflow.md#testbox-workflow-target)
- [CI dependency cache and security](./ci-verification-security.md)
