# Turborepo cache Worker

This Worker serves the Turborepo 2.11.7 Remote Cache API over one R2 bucket.
Its core runs on Web-standard APIs in Workers and Node 22.14 or newer. The R2
adapter and fetch entry contain the platform-specific boundary.

## Delivery Status

The core, R2 adapter, configuration, tests, and local curl/signed-client
verification are implemented. The first deploy ran on 2026-10-07 from the
admin's login at commit `11b207d`: `https://mokly-turbo-cache.calum-785.workers.dev`. The policy B
access tokens were set on 2026-10-07. Policy B CI and preview wiring are
implemented; hosted checks and developer sharing remain open.

## Development

```bash
npm ci
npm run typecheck:turbo-cache
node --import tsx --test tests/turbo_cache_*.test.ts
```

The root typecheck also checks tests that import the core and adapter, using
only the existing Node/DOM program. The separate Worker tsconfig uses Workers
ambient types. Do not add Workers globals to the root `types` array.

Wrangler is pinned at 4.113.0, with Workerd 1.20260721.1. The compatibility date
is `2026-07-21`; the local runtime accepts it without a fallback warning.

Before creating `scripts/turbo-cache/.dev.vars`, confirm its ignore rule:

```bash
git check-ignore -v scripts/turbo-cache/.dev.vars
```

Put three independent local tokens in that ignored file. Each must contain at
least 32 UTF-8 bytes; generate them privately with `openssl rand -hex 32`.
Use these names, with no committed values:

```text
TURBO_CACHE_TRUSTED_WRITE_TOKEN
TURBO_CACHE_PR_WRITE_TOKEN
TURBO_CACHE_READ_TOKEN
```

Run local R2 only. This command does not use the Cloudflare account:

```bash
WRANGLER_SEND_METRICS=false npx --no-install wrangler dev --local --config scripts/turbo-cache/wrangler.jsonc --ip 127.0.0.1 --port 8799 --persist-to .context/turbo-cache-local
```

Bindings have `remote: false` for local development. The deployed R2 binding
still names the real bucket. Never add remote development to local smoke steps.
Do not log tokens or include them in transcripts.

## Local Curl Smoke

Load local token values privately into shell variables named after the secrets.
Use the trusted writer to store and the reader to retrieve. Check all responses:

```bash
cache_url=http://127.0.0.1:8799
curl -i -H "Authorization: Bearer ${TURBO_CACHE_TRUSTED_WRITE_TOKEN}" "${cache_url}/v8/artifacts/status?slug=mokly"
curl -i -X PUT -H "Authorization: Bearer ${TURBO_CACHE_TRUSTED_WRITE_TOKEN}" -H 'Content-Type: application/octet-stream' -H 'x-artifact-duration: 42' --data-binary 'first artifact' "${cache_url}/v8/artifacts/abc?slug=mokly"
curl -I -H "Authorization: Bearer ${TURBO_CACHE_READ_TOKEN}" "${cache_url}/v8/artifacts/abc?slug=mokly"
curl -i -H "Authorization: Bearer ${TURBO_CACHE_READ_TOKEN}" "${cache_url}/v8/artifacts/abc?slug=mokly"
curl -i -X PUT -H "Authorization: Bearer ${TURBO_CACHE_TRUSTED_WRITE_TOKEN}" -H 'Content-Type: application/octet-stream' --data-binary 'replacement' "${cache_url}/v8/artifacts/abc?slug=mokly"
curl -i -H "Authorization: Bearer ${TURBO_CACHE_READ_TOKEN}" "${cache_url}/v8/artifacts/abc?slug=mokly"
```

Status is enabled; PUTs return 202. HEAD has no body. The final GET must still
contain the first bytes and metadata. Also check query/events, reader PUT 403,
PR fallback and writes, and PR-to-trusted PUT 403.

The core counts bytes while streaming. A length mismatch returns 400 and cannot
install partial data. Excess beyond the artifact limit returns 413. The R2
adapter pipes into a Workers `FixedLengthStream`, because R2 requires a known
stream length. No artifact is collected in memory. Conditional losers are
validated too; their discarded bytes cannot replace the winner.

Every response with status 500 or higher logs through the injected logger.
Configuration diagnostics name duplicate secrets, a missing team, or an invalid
team, with no secret values or lengths. Other errors log their name and message.
Client responses stay unchanged. Never log request headers, tokens, or bodies.

## Local Real-Client Smoke

Use a separate clone with an independent Git directory and npm install.
Do not use a linked worktree, which shares the main checkout's Turbo cache.
The committed client config points to the deployed origin and team mokly.
Override only the clone process to use local R2:

```bash
export TURBO_API=http://127.0.0.1:8799
export TURBO_TEAM=mokly
export TURBO_TOKEN="${TURBO_CACHE_TRUSTED_WRITE_TOKEN}"
export TURBO_REMOTE_CACHE_SIGNATURE_KEY="${private_local_signature_key}"
export TURBO_TELEMETRY_DISABLED=1
export TURBO_CACHE=local:rw,remote:rw
npm run prepare:verification
```

The private signature key is another independent 64-hex-character value. Clear
only the clone's `.turbo/cache`, switch to `TURBO_CACHE_READ_TOKEN` and
`TURBO_CACHE=local:rw,remote:r`, then prepare again. All three tasks must restore
remotely and product outputs must match byte for byte. Check `AGENTS.md` after
every Turbo command. A wrong key must miss and execute rather than restore.

For scoped PR access, select the PR token and `TURBO_TEAM=mokly-pr-1`. Verify
trusted fallback, then change one declared input and verify new writes occur
only under the PR namespace. A PR token with team `mokly` must get 403.
Keep transcripts under `.context/turborepo-cloudflare-remote-cache/`.

## Provisioning And Protected Deployment

These commands are documentation only for Milestone 4. An administrator must
use the selected policy B. Read the
[access contract](../../docs/protocol/ci-remote-cache-access.md) for the policy,
namespace boundaries, GitHub environment restrictions, and residual risk.
Inspect the existing bucket and all-prefix 30-day rule before changing them.
Do not recreate existing resources or replace the full lifecycle configuration.

```bash
npx --no-install wrangler r2 bucket create mokly-turbo-cache
npx --no-install wrangler r2 bucket lifecycle add mokly-turbo-cache expire-artifacts --expire-days 30
npx --no-install wrangler r2 bucket lifecycle list mokly-turbo-cache
npx --no-install wrangler r2 bucket lifecycle add mokly-turbo-cache expire-pr-artifacts mokly-pr- --expire-days 7
# Pipe one JSON object with the three token names on standard input.
npx --no-install wrangler secret bulk --config scripts/turbo-cache/wrangler.jsonc
npx --no-install wrangler deploy --config scripts/turbo-cache/wrangler.jsonc
```

Generate four independent values: three tokens and the Turbo signature key.
The Worker never receives the signature key. The workflow uses
`vars.CLOUDFLARE_ACCOUNT_ID` and the turbo-cache-deploy environment secret
`CLOUDFLARE_WORKERS_API_TOKEN`. That
account API token has the Workers `Editor` role scoped to the
`mokly-turbo-cache` Worker, plus Workers `Metadata Read-Only` for all Workers
so that Wrangler can read the account's `workers.dev` subdomain. Deploys need
no R2 permission. The token lives only in the GitHub environment
`turbo-cache-deploy`, which allows only `main`.
It deploys only from main in this repository, after Worker typecheck/tests and
the dependency audit. A new dispatch workflow is unavailable before it enters
the default branch; the authorized first deployment can use the checked pinned
CLI command from the branch. Record the origin URL, then wire clients in M4.

PR keys match both expiry rules. The 7-day target follows the earlier-expiry
interpretation in the access contract. Confirm the production expiry metadata
and conditional-write behavior before enabling
remote writes. Local R2 simulation can differ. For one poisoned object:

```bash
npx --no-install wrangler r2 object delete mokly-turbo-cache/<namespace>/<hash> --remote
```

Delete only the identified object. Clear the affected client's local cache
before verification. Rotate an access token by replacing its Worker secret and
all corresponding private/GitHub consumers; old tokens must get 401.
Check a known old version's preview URL after rotation. It must not reach the
Worker. Keep `preview_urls: false`; disabled version URLs prevent old versions
from serving their earlier secrets. This production check requires the admin.
Rotate the signature key with a new team namespace and populate it from authorized CI.
Update the Worker team, every client's team setting, and the PR lifecycle prefix
together, as the access runbook specifies.
Existing objects cannot be re-signed; let the old namespace expire.

## Key Code

- `artifacts.ts`: six routes, read fallback, response shapes, upload boundary.
- `auth.ts`: principal checks, fail-closed configuration, namespace rules.
- `store.ts`: runtime-neutral storage interface and metadata.
- `r2.ts`: atomic conditional write, known-length streaming, R2 metadata.
- `stream.ts` and `metadata.ts`: bounded JSON, stream counting, wire validation.
- `worker.ts`: Workers composition; no Node crypto or filesystem dependency.

## Related Docs

- [Task contract](../../docs/protocol/ci-remote-cache.md)
- [Worker wire contract](../../docs/protocol/ci-remote-cache-worker.md)
- [Access contract](../../docs/protocol/ci-remote-cache-access.md)
- [Active plan](../../plans/turborepo-cloudflare-remote-cache.md)
