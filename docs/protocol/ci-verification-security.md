# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Delivery Status

The npm download cache, local task cache, and audit rules are implemented.
The [CI Task Cache](./ci-task-cache.md) defines GitHub Actions cache sharing without credentials. Hosted verification remains open.
Baseline and strict modes share the live lockfile audit.
Scheduled strict failures use the dependency update pull request workflow.

## Dependency Cache And Security

CI caches npm downloads for dependency installation. `actions/setup-node` keys it from the
committed `package-lock.json`. `npm ci` always runs, including after a cache
hit, and every platform's optional native package remains available. A cache
miss is an ordinary cold install and never permits a skipped command.

The live lockfile-only workspace audit runs first in the repository prerequisite
and does not depend on cache state. Complete local and release commands keep
audit-first ordering. Under the [baseline audit contract](./dependency-audit-baseline.md),
ordinary pull requests, every push, and default local checks fail only on new
findings or exception issues; inherited issues print as notices. Report and
input failures always fail. Release Please and dependency update pull requests,
the daily scheduled audit on `main`, and the release publish audit stay strict.
The release complete fallback uses `cargo xtask check --dependency-audit strict`.
Only active reviewed workspace exceptions cover strict findings, under the
unchanged exact-path, UTC expiry, and 31-day rules in
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).
The [update pull request workflow](./dependency-audit-update-pr.md) handles
scheduled findings and exception issues. Operational failures still fail the
run. Updates disable lifecycle scripts and omit API tokens from child processes.
Every selected package-runtime job also preserves the
separate production audit of the freshly resolved ESM consumer, which is outside
the workspace lockfile, overrides, and audit exceptions; it stays strict.
The release profile proves it on both
runtimes. Intentionally isolated clean-cache consumer tests keep private empty
npm caches. Release publishing retains its uncached, OIDC-scoped boundary and
exact-artifact checks.

## Task Cache Security

The local task cache stores viewer, package, and example outputs. Hosted jobs
share `.turbo/cache` through the GitHub Actions cache. It does not cache
`npm ci`, audits, tests, or reports. Every job keeps its lockfile-keyed download
cache and fresh install. A cache miss or failure requires task execution.

Repository read access permits cache reads. Never store secrets in cached
outputs or task logs. GitHub scope rules isolate pull request writes in each
merge-ref scope, including forks; those runs can restore from their base branch.
Only the CI preparation job saves. Suites and both preview jobs restore only.
No task-cache secrets or protected environments are required. Pages deployment
credentials remain separate and must lack Workers or R2 write permissions;
the admin owns permission verification.

Turbo disables remote caching in `turbo.json` and supplies no endpoint or team.
Developer login files alone send no requests. Developers, native jobs, and Testboxes use local
cache only. Release forces task execution and uses no shared task cache.
Hosted workflows disable telemetry. Developers can opt out through their
environment. Historical example baselines use direct commands with no Turbo
cache or telemetry. Builds must pass with no cache.

Fixture ownership, test concurrency, failure cleanup, unit shard balance and
scenario grouping, browser shard balance, and acceptance measurement follow the
separate [suite evidence contract](./ci-suite-evidence.md).

## Testbox Key And Secret Boundary

The [remote verification contract](./remote-verification.md) is an approved
target under the [plan](../../plans/blacksmith-remote-verification.md).
The workflow secret boundary and executor key handling are implemented.
Explicit and automatic modes use the same key handling.

Xtask reads the org key only from `BLACKSMITH_ORG_TOKEN`.
It sends the key to `blacksmith auth login --api-token -` on standard input.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
The key must never appear in arguments, logs, remote commands or reports.
One shared list defines secret environment variables for xtask children.
The list currently contains only `BLACKSMITH_ORG_TOKEN`.
Every local runner and remote process request removes each listed variable
from its child environment. This includes helper processes such as `kill`.
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
