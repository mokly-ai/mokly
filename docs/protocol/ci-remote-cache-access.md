# CI Remote Cache Access

## Delivery Status

This is the approved access contract for the
[remote-cache plan](../../plans/turborepo-cloudflare-remote-cache.md).
The three-principal authorization, namespace fallback, and local verification
are implemented. The user selected policy B on 2026-10-07; its Worker secrets,
GitHub secrets, and PR expiry rule are provisioned. Policy B CI and preview
wiring is implemented. Hosted confirmation and developer sharing remain open.
The [Worker contract](./ci-remote-cache-worker.md) owns routes and wire formats.

## Principals And Namespaces

One Worker secret identifies each principal. Missing or empty secrets disable
that principal. No principal can list or delete objects through the Worker.

| Principal        | Worker secret                     | Allowed namespace and access                                                                                                                                            |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trusted-writer` | `TURBO_CACHE_TRUSTED_WRITE_TOKEN` | The requested namespace equals `TURBO_CACHE_TEAM`. Read and write `<team>`.                                                                                             |
| `pr-writer`      | `TURBO_CACHE_PR_WRITE_TOKEN`      | The requested namespace is `<team>-pr-<n>`, with a positive decimal integer and no leading zero. Read that namespace first, then `<team>`. Write only the PR namespace. |
| `reader`         | `TURBO_CACHE_READ_TOKEN`          | The requested namespace equals `<team>`. Read only; PUT is forbidden.                                                                                                   |

`TURBO_CACHE_TEAM` is 1–64 lowercase ASCII letters, digits, or hyphens, with
an alphanumeric first and last character. A PR suffix is 1–20 decimal digits;
parse it as text, not a JavaScript number. These bounds keep R2 keys portable.
A missing or invalid team returns 500 `configuration_error` on every request.

The wire namespace comes from one `slug` or `teamId` query parameter, preserving
the existing API alias. Missing or duplicate values return 403. If both occur,
both must name the same authorized namespace. Mokly clients use `slug`; their
actual Turbo team ID stays unset. A namespace outside a principal's rule is 403.
A reader's PUT returns 403 before any body consumption.

GET, HEAD, and each hash in a batch follow the principal's read order. A PR
object wins even when a trusted object with the same hash exists. A missing PR
object falls back to trusted; storage errors do not silently fall back. PUT
never writes through the read fallback. The key is `<namespace>/<hash>`.
Store the authenticated `principal` in atomic custom metadata beside duration,
tag, SHA, and dirty hash. Never echo the principal in artifact headers or query
results. First-writer metadata and bytes remain immutable.

## Token Checks And Failure Handling

Tokens are private opaque values. Generate independent tokens with
`openssl rand -hex 32`; each result has 64 ASCII bytes. Do not print values,
commit them, hash them as task inputs, or include them in error messages.

A configured secret shorter than 32 UTF-8 bytes disables its principal and logs
a warning containing only the principal name. A duplicate nonempty secret is
500 `configuration_error`, including duplicates among short secrets. Missing
credentials and unknown tokens return 401. All disabled principals means every
otherwise well-configured request is unauthorized.

Hash the supplied bearer and each configured secret with Web Crypto SHA-256.
Compare all fixed 32-byte digests with a constant-time loop on every request;
do not stop when one principal matches. Missing and malformed bearers still
run the digest comparisons before returning 401. Do not use Node-only crypto
or Workers-only `timingSafeEqual`. Validation and storage code use Web-standard
APIs; only the R2 adapter and fetch entry use Workers-specific types.

HEAD is bodyless in every outcome, including configuration errors. Other errors
use the matching flat and wrapped fields in the Worker contract. Turbo treats
configuration/storage errors as cache errors and continues builds. Forbidden
access can disable remote reads and writes for the rest of that Turbo run.

## CI Policy B

The user selected scoped PR writes. The deployed origin is
`https://mokly-turbo-cache.calum-785.workers.dev`; trusted team is `mokly`.
Keep `TURBO_TEAMID` and `remoteCache.teamId` unset. Turbo signs the empty team
ID, so one signature key verifies trusted fallback across PR namespaces.

| Event              | Principal and namespace                 | GitHub secret scope                                    |
| ------------------ | --------------------------------------- | ------------------------------------------------------ |
| Push to main       | Trusted writer; committed team mokly    | TURBO_CACHE_TRUSTED_WRITE_TOKEN in turbo-cache-trusted |
| Same-repository PR | PR writer; TURBO_TEAM=mokly-pr-<number> | TURBO_CACHE_PR_WRITE_TOKEN in repository scope         |
| Fork PR            | Local cache only                        | No cache credentials                                   |

The signature key is the repository secret `TURBO_CACHE_SIGNATURE_KEY`.
The five CI preparation jobs and both preview build jobs configure credentials
only after `npm ci`. Main and PR steps have separate event guards. Each calls
`scripts/verification/turbo-cache-env.mjs` with private candidate values.
It writes `TURBO_TOKEN`, `TURBO_REMOTE_CACHE_SIGNATURE_KEY`, and
`TURBO_CACHE=local:rw,remote:rw` to `$GITHUB_ENV` only when both candidates exist.
Only the PR step writes `TURBO_TEAM`. Missing either candidate writes local:rw
and leaves both credential variables unset. Forks skip both credential steps.
No value is printed. The root launcher also removes incomplete credential pairs
before calling the installed Turbo entry; otherwise even local mode can probe
status with a token alone. Native, release, and Testbox jobs get no cache token.

CI jobs select the trusted environment through this exact expression:

```yaml
environment:
  name: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 'turbo-cache-trusted' || '' }}
  deployment: false
```

PRs resolve the name to empty and request no environment. Preview main uses the
literal trusted name; preview PR declares no environment. GitHub permits
[name expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idenvironment)
and [deployment: false](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments#using-environments-without-deployments).
Branch policies still apply; no deployment record is created for cache use.
Custom GitHub App protection rules require deployment records and are incompatible
with false. The configured environments use main-only branch policies.
The first main push must confirm access and suppression of deployment records.
A hosted PR run must confirm the empty-name path is accepted.

The PR writer reads its namespace before trusted and populates only its own
namespace for later jobs. Its shared PR token still permits another PR's
namespace. Per-PR or identity-bound tokens require a separate decision.
Signatures and write-once storage do not close that residual boundary.

## Deployment Credential Boundary

No Cloudflare account/API credential with Workers or R2 write permission may
be a repository secret or reach a pull_request or pull_request_target job.
`CLOUDFLARE_WORKERS_API_TOKEN` exists only in `turbo-cache-deploy`; the deploy
job declares that main-only environment and accepts only main refs.
`TURBO_CACHE_TRUSTED_WRITE_TOKEN` exists only in `turbo-cache-trusted` and only
main-push steps in jobs using that environment may reference it. Neither token
may be a workflow-wide value or a fallback for PRs.
The PR service bearer remains repository-scoped; the Worker confines its writes
to PR namespaces. The signature key remains repository-scoped too.

The Pages secret `CLOUDFLARE_PAGES_API_TOKEN` may reach eligible preview jobs.
The admin must keep its permissions free of Workers and R2 writes, including
inherited roles. On 2026-10-07 the user replaced it with
`github-actions-mokly-preview-pages`, limited to Pages Read and Pages Write.
Mac checks verified project/deployment access and upload-token creation, with
cache Worker settings and R2 bucket listing denied. This boundary is delivered;
future token replacements must preserve it.
The deploy token uses Workers Editor scoped to this Worker plus Workers Metadata
Read-Only. The environment branch policies are administrator-owned controls;
workflow tests check references and guards, not the live GitHub secret inventory.

## Forbidden Repository Secret Aliases

These legacy or broad aliases are forbidden repository credentials and must
never appear in any workflow secret reference. Use the exact scoped names above.

| Secret name               | Rule                                        |
| ------------------------- | ------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | No workflow reference or repository secret  |
| `CLOUDFLARE_R2_API_TOKEN` | No workflow reference or repository secret  |
| `TURBO_CACHE_TOKEN`       | No shared writer alias or repository secret |

`tests/workflow_cache_credentials.test.ts` checks every workflow and rejects
protected tokens outside their matching environments or exposed PR steps.
It also rejects every alias listed here. Administrators must apply the same
permission rule to newly named credentials; changing a name cannot grant access.
The guard normalizes secret names to uppercase because GitHub
[references them without regard to case](https://docs.github.com/en/actions/reference/security/secrets#naming-your-secrets).

## Expiry And Recovery Runbook

These are documentation-only commands for an authorized administrator during
remote provisioning. Do not run them during local implementation.

```bash
npx --no-install wrangler r2 bucket lifecycle add mokly-turbo-cache expire-pr-artifacts mokly-pr- --expire-days 7
npx --no-install wrangler r2 object delete mokly-turbo-cache/<namespace>/<hash> --remote
```

Pinned Wrangler 4.113.0 uses `add <bucket> [name] [prefix]`; the
[R2 command reference](https://developers.cloudflare.com/r2/reference/wrangler-commands/#r2-bucket-lifecycle-add)
records the positional prefix. Keep the existing all-prefix 30-day
`expire-artifacts` rule. PR keys match both rules; earlier expiry takes
precedence, so the target is 7 days for PR artifacts and 30 days for trusted
artifacts. The [lifecycle guide](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
illustrates earlier-expiration precedence for overlapping multipart rules.
Applying that precedence to artifact expiry is an inference; production
validation confirms effective expiry; deletion is asynchronous and may occur after the age
threshold. No bucket lock rule is part of this cache.

Delete only the named poisoned object after identifying its namespace/hash.
The next authorized writer can fill that absent key. Client local caches can
retain an earlier artifact; clear only the affected client/fixture cache before
verification. Rotate a compromised access token and its consumers.
After rotation, confirm a known old version's preview URL cannot reach the
Worker. Explicit `preview_urls: false` disables version URLs, which otherwise
can serve old secrets outside Workers Logs. Run this check during provisioning.
Rotate the signature key with a new team namespace; old objects cannot be re-signed.
Update `TURBO_CACHE_TEAM` and every client's team setting together. Add the
7-day lifecycle rule for the new `<team>-pr-` prefix; let the old rules expire
old namespaces.
