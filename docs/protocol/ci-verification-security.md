# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
committed `package-lock.json`. `npm ci` always runs, including after a cache
hit, and every platform's optional native package remains available. A cache
miss is an ordinary cold install and never permits a skipped command.

The live lockfile-only workspace audit runs first in the repository prerequisite
and does not depend on cache state. Complete local and release commands keep
audit-first ordering. The
[baseline audit contract](./dependency-audit-baseline.md#xtask-and-ci-selection)
selects baseline or strict mode for each command and event. Only active
reviewed workspace exceptions cover strict findings, under the exact-path, UTC
expiry, and 31-day rules in
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).
The [update pull request workflow](./dependency-audit-update-pr.md) handles
scheduled findings and exception issues. Operational failures still fail the
run. Updates disable lifecycle scripts and omit API tokens from child processes.
The release workflow's clean-consumer smoke keeps the separate strict
production audit of the freshly resolved packed CLI consumer, which is outside
the workspace lockfile, overrides, and audit exceptions.
Intentionally isolated clean-cache consumer tests keep private empty
npm caches. Release publishing retains its uncached, OIDC-scoped boundary and
exact-artifact checks.

Fixture ownership, test concurrency, failure cleanup, and browser shard
balance follow the separate [suite evidence contract](./ci-suite-evidence.md).

## Testbox Key And Secret Boundary

The [remote verification contract](./remote-verification.md) defines the
remote execution. This section owns its key and secret boundary.
Explicit and automatic modes use the same key handling.

Xtask reads the org key only from `BLACKSMITH_ORG_TOKEN`.
It sends the key to `blacksmith auth login --api-token -` on standard input.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
The key must never appear in arguments, logs, remote commands or reports.

Key login uses standard input, never a child environment variable.
Explicit remote mode can use the current CLI login when the variable is unset
or empty. Automatic mode selects local execution in that case.
The cloud snapshot supplies tools but must not contain
`~/.blacksmith/credentials`. Never copy saved CLI credentials to a box.

The Testbox workflow uses no secrets and has only `contents: read` permission.
Its full-history checkout sets `persist-credentials: false`.
The repository is public. Boxes fetch pushed commits without a token.
Send source files and verification inputs, not the local org key or credential
files. Write only the job `PATH` and `PLAYWRIGHT_CHANNEL=chromium` entries for
Testbox sessions in `/etc/environment`. Do not forward the caller's environment.

GitHub Actions always uses local execution for the complete gate.
An explicit remote request there fails. This boundary also applies to release
publishing, even if an org key is present.

### Child Environment

Xtask removes two lists of variables from the environment of every child
process. The secret list holds only `BLACKSMITH_ORG_TOKEN`. The Git list holds
the 15 repository-local names that `git rev-parse --local-env-vars` prints in
Git 2.50.1. This covers every local runner and remote process request,
including helpers such as `kill` and the Git requests of Rust tests. Git in
each child then finds its repository from the child's own working directory.

Git can export the repository-local variables to hooks, `git rebase -x`
commands and `!` aliases in linked worktrees. They select which repository,
work tree and index Git uses. Inherited repository selection could redirect
snapshot commands to the checkout's index or make test Git commands alter its
config. Settings carried by `GIT_CONFIG_PARAMETERS` or `GIT_CONFIG_COUNT`,
including `git -c` settings, are removed with the Git list. Other variables,
such as `GIT_ASKPASS` and `GIT_SSH_COMMAND`, stay.
