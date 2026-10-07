# CI Remote Cache Access

## Delivery Status

This is the approved access contract for the
[remote-cache plan](../../plans/turborepo-cloudflare-remote-cache.md).
The three-principal authorization, namespace fallback, and local verification
are implemented. CI policy selection and
remote provisioning remain planned. Current workflows remain local only.
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

## Pending CI Policy

The user chooses A, B, or C during remote provisioning. B is recommended.
The Worker implements all three principals; CI credential wiring is planned.
All authorized remote clients also receive the shared signature key.

| Policy              | Main jobs                                                                                            | Same-repository PR jobs                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A: main-only writes | Trusted token through a GitHub environment restricted to `main`; `local:rw,remote:rw`, team `mokly`. | Reader token; `local:rw,remote:r`, team `mokly`.                         |
| B: scoped PR writes | Same as A.                                                                                           | PR token; `local:rw,remote:rw`, `TURBO_TEAM=mokly-pr-<number>`.          |
| C: shared writes    | Trusted token; `local:rw,remote:rw`, team `mokly`.                                                   | Trusted token and trusted namespace; explicitly accepted poisoning risk. |

The preview workflow follows the same rule: its main job is a trusted writer
under every policy; its PR job follows the selected PR column. Forks receive no
cache secrets. Release jobs force execution; native jobs use local cache only.
Use repository/environment secret names matching the Worker principal secrets;
map the chosen value to `TURBO_TOKEN`. The signature secret remains
`TURBO_CACHE_SIGNATURE_KEY`, mapped to `TURBO_REMOTE_CACHE_SIGNATURE_KEY`.
Never select a remote mode unless both token and signature key are available.

Under A, a PR job can restore trusted hits but cannot upload its new task hashes.
Each job must execute those misses. B lets one PR job populate its scoped cache
for later jobs on that PR; C permits the same reuse in the trusted namespace.

B protects trusted objects from PR writes. Its shared PR token still lets one
PR job write another PR's namespace. Per-PR tokens or identity-bound tokens
would close that residual boundary and require a separate decision. C lets any
eligible PR job seed signed trusted artifacts for later main, preview, and
developer reads. Write-once storage and signatures do not prevent that attack.

Turbo 2.11.7 signs the team ID, not the slug. Keep the team ID empty in every
client, including PR clients, so one key verifies trusted fallback across
namespaces. Do not set `TURBO_TEAMID` or configure `remoteCache.teamId`.

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
