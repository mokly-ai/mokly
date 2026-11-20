# REST Requests And Responses

This is the transport sub-contract of [REST API](./rest-api.md).

JSON objects reject unknown fields. Invalid JSON, path IDs, cursors, body
limits and validation failures return the typed envelope, never Axum's plain
text rejection. JSON command bodies are limited to 16 KiB, except signed GitHub
deliveries (2 MiB); streaming publication uploads use the separate limits in
[Publication ingest](./publication-ingest.md). `Content-Type` must be
`application/json` for body-bearing commands. UUID path inputs are parsed
before store access. Entity generation uses UUID v7.

Lists return `items` and nullable `nextCursor`. Platform lists use ascending
record IDs and the last returned UUID as an opaque cursor. Viewer lists use
the compound ordering keys and scoped opaque cursors in
[Viewer read model](./viewer-read-model.md). All lists default to 50 items,
with minimum 1 and maximum 100; unknown/malformed parameters return 400.
The platform skeleton materializes each authorized collection before taking
its page; a remaining row determines `nextCursor`. Members, grants and project
lists also perform N+1 queries; batching and database pagination remain known
platform follow-up work. Viewer branch, PR and history queries paginate in the
database. Permission filtering happens before pagination. Nested IDs are always
scoped to their parent; an ID from another workspace/project cannot mutate
a sibling.

Versions use optimistic concurrency. A mismatch returns `version-conflict`
and `data.currentVersion`. Every write rechecks access in the transaction; no
caller-supplied role, inherited flag or owner ID is trusted. List and read
DTOs never carry stored credential hashes. Tokens return their raw secret
once with 201; listing and revocation cannot recover it.

All responses include `Cache-Control: no-store` and `X-Request-ID`. The public
`rpc-error` crate owns error serialization and standard code/status mapping;
`mkc-api::error::ApiError` owns the HTTP mapping of domain, store, platform policy and auth
errors. Its Axum adapter renders the body; its logging middleware records the
preserved source chain with the request ID. Client errors (4xx) log at warn;
internal and unavailable errors (5xx) log at error. Internal causes never reach clients.

```json
{
  "error": {
    "code": "failed-precondition",
    "reason": "version-conflict",
    "message": "Refresh to see the latest changes.",
    "request_id": "01994f10-0000-7000-8000-000000000001",
    "data": { "currentVersion": 2 }
  }
}
```

The request ID is taken from `x-request-id` when present, otherwise generated
as a UUID; it is always echoed in the response header and every error body.
Callers should supply a UUID. Empty or non-text headers are treated as absent. Nonempty incoming text is preserved by the
upstream request-ID middleware, so clients treat correlation IDs as opaque.
The generated correlation UUID is independent of UUID v7 entity IDs. Request
IDs carry no authority and must never be used for authentication or deduplication.
CORS exposes `X-Request-ID` and `Retry-After` to the configured app origin
and, when `MKC_DESKTOP_CLIENT=true`, to `mokly-app://desktop`. The API echoes
only an admitted origin, permits credentials and sends `Vary: Origin`.
