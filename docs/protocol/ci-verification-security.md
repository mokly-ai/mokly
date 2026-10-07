# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Delivery Status

The npm download cache, local task cache, and audit rules are implemented.
Remote signing and credentials remain planned in [CI Task Cache](./ci-remote-cache.md).
Baseline and strict modes share the live lockfile audit.
Scheduled strict failures use the dependency update pull request workflow.

## Dependency Cache And Security

CI persists only npm's download cache across jobs and runs. `actions/setup-node` keys it from the
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

## Task Cache Security And Remote Target

The local task cache stores viewer, package, and example outputs. The remote
Worker is deployed with policy B credentials, but CI does not use it yet; it
uses the repository R2 bucket. It does not cache `npm ci`, audits, tests, or reports.
Every job keeps its lockfile-keyed download cache and fresh install. Missing,
unavailable, or rejected artifacts require task execution, not skipped checks.

The [access contract](./ci-remote-cache-access.md) defines trusted writers,
scoped PR writers, and readers. CI policy A/B/C awaits the user; B is recommended.
Developers receive the reader and signature key through a private password-manager share.
They set `TURBO_CACHE=local:rw,remote:r` to prevent forbidden upload attempts.
The signing key alone does not grant Worker write access. The Worker stores
signatures without holding that key. Turbo verifies downloads before extraction.
The key has at least 32 bytes; configuration enforces the minimum.

Forks and clients without both credentials use local cache only and must pass
builds without either value. Release publishing forces task execution with no
remote credentials. Native jobs also receive no remote credentials.
Write-once R2 keys prevent later clients from replacing the first artifact or
its metadata. Expiry and key rotation follow the
[Worker contract](./ci-remote-cache-worker.md). Access credentials never enter
Git, task hashes, or logs. Telemetry is disabled in hosted workflows from the
first use of Turbo; developers can opt out through their environment. Historical
example baselines use direct commands, with no Turbo cache or telemetry, even
though the baseline environment strips Turbo opt-out variables.

Fixture ownership, failure cleanup, browser shard balance, and acceptance
measurement follow the separate
[suite evidence contract](./ci-suite-evidence.md).

## Testbox Key And Secret Boundary

The [remote verification contract](./remote-verification.md) is an approved
target under the active [plan](../../plans/blacksmith-remote-verification.md).
The workflow secret boundary and executor key handling are implemented.
Explicit and automatic modes use the same key handling.

Xtask reads the org key only from `BLACKSMITH_ORG_TOKEN`.
It sends the key to `blacksmith auth login --api-token -` on standard input.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
The key must never appear in arguments, logs, remote commands or reports.
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
