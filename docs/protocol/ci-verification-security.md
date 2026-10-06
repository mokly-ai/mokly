# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Delivery Status

The npm download cache and audit rules are implemented. The signed Turbo task
cache and credential policy below are planned in [CI Task Cache](./ci-remote-cache.md).

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
committed `package-lock.json`. `npm ci` always runs, including after a cache
hit, and every platform's optional native package remains available. A cache
miss is an ordinary cold install and never permits a skipped command.

The live workspace audit runs first in the repository prerequisite and does not
depend on cache state. The complete local and release commands retain the same
audit-first ordering. Only active reviewed workspace exceptions can cover
findings, under the exact path and UTC expiry rules in
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).
Every selected package-runtime job also preserves the
separate production audit of the freshly resolved ESM consumer, which is outside
the workspace lockfile, overrides, and audit exceptions; it stays strict.
The release profile proves it on both
runtimes. Intentionally isolated clean-cache consumer tests keep private empty
npm caches. Release publishing retains its uncached, OIDC-scoped boundary and
exact-artifact checks.

## Planned Task Cache Security

The task cache stores viewer, package, and example outputs in a repository-owned
Worker and R2 bucket. It does not cache `npm ci`, audits, tests, or reports.
Every job keeps its lockfile-keyed download cache and fresh install. Missing,
unavailable, or rejected artifacts require task execution, not skipped checks.

Same-repository CI has a writer token. Approved developers receive a reader
token and the shared signature key through a private password-manager share.
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
first use of Turbo; developers can opt out through their environment.

Fixture ownership, failure cleanup, browser shard balance, and acceptance
measurement follow the separate
[suite evidence contract](./ci-suite-evidence.md).
