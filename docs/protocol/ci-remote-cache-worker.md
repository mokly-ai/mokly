# CI Remote Cache Worker

## Delivery Status

This is the approved service contract for the
[remote-cache plan](../../plans/turborepo-cloudflare-remote-cache.md).
The R2 bucket in WEUR and its expiry rule are provisioned. Worker code,
tests, deployment workflow, and local signed-client verification are implemented.
The Worker is not deployed; client wiring remains planned.
The [task contract](./ci-remote-cache.md) owns builds and client credentials.

## Compatibility And Routing

Implement the [published OpenAPI](https://turborepo.dev/api/remote-cache-spec)
with the compatibility additions required by the client at tag `v2.11.7`.
OpenAPI lists unversioned `/artifacts` paths and origin-only servers. The real
client adds `/v8`; serve that prefix and set `apiUrl` to the origin without it or a trailing slash.
Use HTTPS, no redirects, and `remoteCache.preflight: false`.
No browser CORS or OPTIONS preflight support is required for this CLI service.

Authenticate every request with one bearer token. The
[access contract](./ci-remote-cache-access.md) defines the three principals,
constant-time digest checks, configuration failures, namespace validation,
PR read fallback, and pending CI policy. Reject forbidden uploads before body
consumption. All principals may submit discarded events. Mokly uses slug-only
requests with an empty actual team ID; the contract retains the teamId alias.
Ignore unrelated query parameters. Preserve hash spelling in storage and URLs.
Hashes match `^[a-fA-F0-9]{1,128}$`; invalid path or batch hashes return 400.
The 128-character maximum is our limit; OpenAPI has no maximum.

| Route                       | Success contract                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v8/artifacts/status`  | 200 JSON `{"status":"enabled"}` for a valid principal and namespace.                                                                       |
| `HEAD /v8/artifacts/{hash}` | 200 with artifact headers and no body, or 404.                                                                                             |
| `GET /v8/artifacts/{hash}`  | 200 with the original gzip tarball as an octet stream and artifact headers, or 404.                                                        |
| `PUT /v8/artifacts/{hash}`  | 202 JSON `{"urls":["https://WORKER/v8/artifacts/HASH?slug=TEAM"]}` after a successful conditional write, including an existing-key result. |
| `POST /v8/artifacts`        | 200 JSON mapping every requested hash to stored metadata or `null`.                                                                        |
| `POST /v8/artifacts/events` | Validate the event array, discard it, and return 200 with no body.                                                                         |

PUT URLs use the actual request origin and encoded team/hash. The client checks
success without reading the body; OpenAPI requires the `urls` array for 202.
Status values defined by both sources are `enabled`, `disabled`, `over_limit`,
and `paused`. This service reports only `enabled` for authorized requests.
Unknown paths return 404; wrong methods return 405 with `Allow`. Route `/status` first.

## Request Headers And Response Reads

GET, HEAD, PUT, status, and query set Turbo's `User-Agent`; events do not.

| Header                                    | Actual 2.11.7 client behavior                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Type`                            | PUT: `application/octet-stream`; status, query, and events: `application/json`; artifact GET/HEAD do not set it.                          |
| `Content-Length`                          | PUT explicitly sets the compressed body byte count. JSON request lengths come from the HTTP transport. GET/HEAD have no body.             |
| `x-artifact-duration`                     | PUT always sends a decimal nonnegative millisecond duration.                                                                              |
| `x-artifact-tag`                          | PUT sends the base64 signature when signing is enabled.                                                                                   |
| `x-artifact-sha`, `x-artifact-dirty-hash` | PUT sends these optional diagnostic values when resolved Git state is available.                                                          |
| `x-artifact-client-ci`                    | PUT sends the CI vendor constant when in known CI (`GITHUB_ACTIONS` here); events send it too. GET/HEAD, status, and query do not set it. |
| `x-artifact-client-interactive`           | OpenAPI allows `0` or `1`; this client does not send it. Do not require it.                                                               |

CI accepts text up to 50 characters; interactive accepts `0` or `1`. Discard
both headers whether valid or invalid; never reject an upload for either one.
Require PUT content type and an integer `Content-Length` from 0 to 100,000,000.
Reject other media types with 415 and invalid lengths with 400; excess is 413.
Accept duration as a decimal integer from 0 to `Number.MAX_SAFE_INTEGER`;
store it as a string. Missing duration means `"0"`.
Accept an optional tag of at most 600 characters. Preserve tag bytes exactly.
Store and echo SHA/dirty hash only if hexadecimal and at most 128 characters.
Drop invalid values; do not store or echo them. Continue the upload.
The Worker does not decompress, re-sign, or verify a tag.

GET and HEAD return `Content-Type: application/octet-stream`, the R2 object's
actual `Content-Length`, and `x-artifact-duration`. Return `x-artifact-tag`,
`x-artifact-sha`, and `x-artifact-dirty-hash` when stored. Do not send
`Content-Encoding: gzip`; gzip is the archive format, not HTTP encoding.
Use `Cache-Control: private, no-store` on all responses.
GET's client reads duration, tag, SHA, dirty hash, length, and all body bytes.
It uses length when computing the streaming signature and verifies before
extracting or installing the artifact in local cache. HEAD's client reads
duration, SHA, and dirty hash; it does not verify a tag or inspect a body.
A missing duration becomes zero; malformed duration is a cache error.
The status client reads JSON `status`; it reads no artifact headers.

The batch request is `{"hashes":["abc","def"]}`. Its response is a bare map:

```json
{
  "abc": {
    "size": 123,
    "taskDurationMs": 456,
    "tag": "stored-base64-tag",
    "sha": "abc",
    "dirtyHash": "def"
  },
  "def": null
}
```

Omit absent optional fields. An empty hash list returns `{}`. Size and duration
are JSON integers. The client reads `taskDurationMs` as `u64`, plus `sha` and
`dirtyHash`; it ignores size and tag. OpenAPI requires size and duration and
permits tag or per-hash errors. This client's hit parser rejects per-hash errors:
return 500 for storage failure. Unsupported or invalid batches fall back to HEAD.

Events require authentication, a valid team, and a JSON array. Do not validate
individual items or their fields. Discard all items, including unknown shapes.
Accept empty arrays. The client checks status and reads no response body.
Limit JSON bodies to 1 MiB and batch/event arrays to 1,024 items; excess is 413.
Malformed JSON or non-array events are 400; invalid batch fields/hashes are 400.

## Errors And Signatures

OpenAPI specifies flat `{code,message}` errors. The actual client parses PUT,
GET, HEAD, and batch 403 errors as `{error:{code,message}}`. Return both forms
with identical values to meet the schema and the client:

```json
{
  "code": "forbidden",
  "message": "Cache access denied.",
  "error": { "code": "forbidden", "message": "Cache access denied." }
}
```

Use `application/json` for errors except HEAD, which always has no body.
HEAD 403 is a client JSON error, never a hit.
Use codes `bad_request` (400), `unauthorized` (401), `forbidden` (403),
`not_found` (404), `method_not_allowed` (405), `too_large` (413),
`unsupported_media_type` (415), `internal_error` (500), and
`configuration_error` (500) for invalid Worker configuration.
Log every 500-or-higher response through the injected logger; configuration diagnostics name failed checks without secret values or lengths. Never log headers, tokens, or bodies; keep client responses unchanged.
Keep tokens, storage errors, and account details out of responses. `remote_caching_*`
codes signal cache-status changes; do not use them for permission failures.
GET/HEAD 404 is a miss. Other unsuccessful statuses are cache errors.

A parsed 403 with wrapped code `forbidden` triggers token recovery. If access
cannot be restored, `disable_after_forbidden()` turns remote reads and writes
off for the rest of the Turbo run; builds continue. A reader without `remote:r`
loses remote reads after its first upload attempt. A wrong team also disables
remote caching for the run when its JSON 403 is parsed.

Turbo signs with HMAC-SHA256 and base64 encodes the result. Its versioned message
includes length-prefixed `artifact-signature:v2`, hash, team ID, and body bytes.
Use the same signature key of at least 32 bytes for CI and developer reads.
The Worker holds no signature key. Unsigned or invalid downloads are rejected
before extraction; task execution may continue as a cache miss.

## Storage And Limits

Use `ArtifactStore` with `head`, `get`, and `putIfAbsent`. Metadata contains
`duration`, `principal`, optional `tag`, optional `sha`, and optional `dirtyHash`.
Keys and read fallback follow the access contract. Stream PUT and GET bodies; never buffer
an artifact into Worker memory. Store metadata in the same atomic PUT.
Actual length mismatches return 400; size overflow returns 413. Stream counting
must abort the atomic write and discard partial bytes. Drain conditional losers
to validate length too. No failed request may install a partial object.
The core counts a standard stream. The R2 adapter pipes it into a
Workers `FixedLengthStream` to preserve the known length R2 requires. This
bridge buffers no artifact; [stream semantics](https://developers.cloudflare.com/workers/runtime-apis/streams/transformstream/#fixedlengthstream)
define overrun/underrun errors. The conditional binding call is:

```ts
await env.ARTIFACTS.put(key, fixedLengthReadable, {
  onlyIf: new Headers({ "If-None-Match": "*" }),
  customMetadata: metadata,
  httpMetadata: { contentType: "application/octet-stream" },
});
```

The [R2 Workers reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations)
allows `Headers` in `onlyIf`. Success returns `R2Object`; failed conditions return
`null` and preserve the first body and metadata. Return 202 for either result.
Use one atomic put; never head-then-put. Concurrent writes retain one winner.
Exceptions are 500; lifecycle owns deletion. The Worker never lists or deletes.
Local Wrangler R2 simulation may differ from production. The
[provisioning validation](../../plans/turborepo-cloudflare-remote-cache.md#milestone-4-cloudflare-provisioning-and-ci-wiring)
must confirm absent-key writes, repeat writes, and concurrent writes in real R2.

[Workers account limits](https://developers.cloudflare.com/workers/platform/limits/#request-and-response-limits)
cap Free and Pro request bodies at 100 MB; the service's 100,000,000-byte limit
stays within that bound. Cloudflare can reject a request before the Worker runs.
The [Standard R2 free tier](https://developers.cloudflare.com/r2/pricing/#free-tier)
includes 10 GB-month storage, one million Class A and ten million Class B
operations per month, and free egress.

## Configuration And Deployment

Own the modules under `scripts/turbo-cache/`: `worker.ts`, `artifacts.ts`,
`auth.ts`, `store.ts`, `r2.ts`, `stream.ts`, `metadata.ts`, `errors.ts`,
`tsconfig.json`, `README.md`, and this exact Wrangler config:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "mokly-turbo-cache",
  "main": "worker.ts",
  "compatibility_date": "2026-07-21",
  "workers_dev": true,
  "preview_urls": false,
  "r2_buckets": [
    {
      "binding": "ARTIFACTS",
      "bucket_name": "mokly-turbo-cache",
      "remote": false,
    },
  ],
  "vars": { "TURBO_CACHE_TEAM": "mokly" },
  "observability": { "enabled": true },
}
```

Principal secrets and expiry/recovery commands follow the access contract.
The pinned Workerd build supports compatibility date `2026-07-21`; local
Wrangler verification must accept it without a fallback warning.
The dedicated `turbo-cache.yml` uses manual dispatch and `main` pushes touching
`scripts/turbo-cache/**`. It uses immutable action revisions, npm 11.21.0,
`npm ci`, the repository's pinned Wrangler, and a 30-minute timeout.
Validate `vars.CLOUDFLARE_ACCOUNT_ID` and
`secrets.CLOUDFLARE_WORKERS_API_TOKEN`; give that token account-scoped Workers
Scripts and Workers R2 Storage write permissions. Run Worker typecheck/tests
before `npx --no-install wrangler deploy --config scripts/turbo-cache/wrangler.jsonc`.
Never deploy from a fork or supply Cloudflare credentials to build-cache clients.

## Admin Runbook

The [Worker README](../../scripts/turbo-cache/README.md) owns local setup,
authorized provisioning, deployment, and curl commands. The
[access contract](./ci-remote-cache-access.md#expiry-and-recovery-runbook)
owns PR-prefix expiry and poisoned-object recovery. Provisioning commands are
planned; existing bucket/rules must not be recreated without inspection.

## Verified Client Sources

At `v2.11.7`, verify changes against
[API client](https://github.com/vercel/turborepo/blob/v2.11.7/crates/turborepo-api-client/src/lib.rs),
[HTTP cache](https://github.com/vercel/turborepo/blob/v2.11.7/crates/turborepo-cache/src/http.rs),
[signatures](https://github.com/vercel/turborepo/blob/v2.11.7/crates/turborepo-cache/src/signature_authentication.rs),
and [events](https://github.com/vercel/turborepo/blob/v2.11.7/crates/turborepo-api-client/src/analytics.rs).
