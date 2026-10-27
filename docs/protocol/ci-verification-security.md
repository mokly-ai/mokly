# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Dependency Cache And Security

CI caches npm's download cache and Rust dependency builds. `actions/setup-node`
keys the npm cache from the committed `package-lock.json`. `npm ci` always
runs, including after a cache hit, and every platform's optional native
package remains available. A cache miss is an ordinary cold install or build
and never permits a skipped command.

The [Rust build cache](#rust-build-cache) section gives the rules for Rust.

The live lockfile-only workspace audit runs first in the CI repository job and
does not depend on cache state. Complete local and release commands keep
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

### Rust Build Cache

Every CI job that runs cargo restores a Rust build cache after it installs the
toolchain and before cargo runs. The cache holds the Cargo registry and the
builds of crates.io dependencies. It holds no build of a workspace crate. The
Repository job's cache also holds the installed Rust audit tool. Each key
covers the runner platform, the toolchain, the Cargo environment, the
lockfile, and the workspace manifests. The Repository job's key also covers
the audit tool lockfile and installer. Jobs that build the same artifacts
share one cache.

Only CI runs on `main` save a Rust build cache. Pull requests, including fork
pull requests, restore the `main` copy and never save. The cache scopes each
entry to its branch, so no pull request can change what `main` or another pull
request restores. A restored cache is the job's private copy. Cargo rebuilds
every artifact whose inputs differ, so cache state never changes a check
result. The release, release-check, release-prepare, and native bootstrap
workflows use no build cache, so no published binary holds cached build output.

CI builds Rust without debug info and without incremental compilation.
Without debug info, the test build takes about a third less time and each
cache is about half the size. Panic messages keep their file and line.

CI caches dependency builds instead of compiler output through sccache.
sccache alone saves about the same time, but it needs storage secrets, fork
pull requests build without it, and every holder of a write key could change
what CI reads. Its GitHub Actions store also bypasses the runner provider's
colocated cache and exceeds GitHub's cache upload rate limit on a cold run.

A tooling test checks that every CI cargo job restores the cache, that only
`main` saves it, and that the audit tool key covers the tool inputs. It also
checks the CI build settings and that the release workflows use no build cache.

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
