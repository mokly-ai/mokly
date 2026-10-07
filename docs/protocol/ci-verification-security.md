# CI Verification: Dependency Cache And Security

Continuation of [CI Verification](./ci-verification.md).

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

Fixture ownership, failure cleanup, browser shard balance, and acceptance
measurement follow the separate
[suite evidence contract](./ci-suite-evidence.md).

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
