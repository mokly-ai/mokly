# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
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
The [update pull request contract](./dependency-audit-update-pr.md) owns strict
scheduled failures, token use, and update lifecycle isolation.
Every selected package-runtime job also preserves the
separate production audit of the freshly resolved ESM consumer, which is outside
the workspace lockfile, overrides, and audit exceptions; it stays strict.
The release profile proves it on both
runtimes. Intentionally isolated clean-cache consumer tests keep private empty
npm caches. Release publishing retains its uncached, OIDC-scoped boundary and
exact-artifact checks.

Fixture ownership, failure cleanup, browser shard balance, and acceptance
measurement follow the separate
[suite evidence contract](./ci-suite-evidence.md).
