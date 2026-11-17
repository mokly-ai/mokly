# mkc-catalogue-server

The isolated HTTP host for Mokly Cloud publications. Run this binary on the
wildcard catalogue domain; it serves indexed user-authored HTML and assets.
The API and app never serve these publication files.

## Responsibilities

Resolve publication/branch hosts, enforce catalogue access and deliver exact
files with the export contract's routes, MIME types and isolation headers.

## What This Crate Does

Canonical `p-<UUID>` hosts serve ready retained publications. Branch aliases
redirect to the latest ready publication. Directory indexes keep normal
slash semantics. `/view/Product/Screen_1` redirects to
`/view/Product/Screen_1/`, which serves `view/Product/Screen_1/index.html`.
Missing paths serve `404.html` with status 404. Decoded `__mokly` roots are
refused without ASCII case sensitivity, including immutable blob lookups.
These refusals use the indexed `404.html` bytes and `no-store`; HEAD returns
the same metadata without a body. Private files
require a signed cookie exchanged from a one-use API grant. Stale cookies
are cleared with a non-cacheable response; public access remains available.
Path lookup joins through the publication file's project and hash, so equal
bytes in different projects resolve to their separate incarnations and
objects. Physical keys are hash/incarnation values.

Public owned blob URLs are immutable; other public files revalidate and
private responses and `mokly-viewer/diffs/**` resources use `no-store`. Exact admitted-origin CORS, nosniff, referrer
restrictions and `Vary: Origin, Cookie, Accept-Encoding` apply to every
response, including preflight and errors. CSP permits only the same publication
origin and the admitted client origins as frame ancestors, so the standalone viewer
can render its own documents without allowing cross-publication embedding. See
[Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md) for the framing
contract.

`MKC_DESKTOP_CLIENT=true` adds `mokly-app://desktop` to the same typed origin
set used by the grant check, CORS and `frame-ancestors`. Both admitted origins
receive an exact CORS echo with credentials. All others receive no CORS
grant. The flag defaults to `false`; `scripts/cloud/dev-catalogue.sh` defaults it
to `true`. `tests/desktop_origin_tests.rs` runs the binary against Postgres
and checks both flag states on health, errors, HEAD, preflight and grant
requests.

Every indexed file response advertises byte ranges and uses a weak SHA-256
ETag. One satisfiable range returns 206, an unsatisfiable range returns 416,
and malformed or multiple ranges fall back to the full representation.
`If-Range` also selects the full response. Public `If-None-Match` requests can
return 304 before storage is opened; `no-store` responses always return the
authorized representation. Public 200 responses larger than 1 KiB negotiate
Brotli, gzip or identity from RFC quality values and wildcards for the
documented text and structured MIME types. Partial and `no-store` responses
stay identity encoded. HEAD and 304 select the same representation as their
corresponding GET: coded variants carry `Content-Encoding` without a length,
identity HEAD carries the stored length, and 304 never carries a length. When a
request refuses every supported coding, the origin falls back to identity so
negotiation cannot replace the application status.

GET bodies stream from the file store. A full read verifies length and
SHA-256 as the bytes flow, and a storage, length or digest failure is logged
once and ends the body without replacing the response status. HEAD performs
the same authorization, conditional and range selection, returns identical
metadata and never opens an object body. Each process may keep a bounded
cache of verified objects: authorization and exact path lookup run before
every cache lookup, `MKC_CATALOGUE_HOT_CACHE_BYTES` bounds every byte the
cache owns, objects above 8 MiB stream without buffering, and zero constructs
no cache. [Catalogue delivery](../../docs/protocol/cloud/catalogue-delivery.md)
states the header, range, compression and cache rules.

`GET /_health` returns 200 `ok`, no-store and isolation headers without a
publication or cookie lookup. It is reserved even on publication hosts. The
[catalogue image](../../infra/docker/mkc-catalogue-server.Dockerfile) defaults
to `serve`, binds port 8080, runs as UID/GID 65532 and reads the shared signing
key from `/var/run/mokly-secrets/catalogue-signing-key` (stable CSI, PR
namespace Secret under the preview contract). There is no separate `migrate` subcommand; deploy API migrations
before startup and, for stable Cloud SQL, provision the [documented SQL grants](../../docs/ops/secrets.md).

## Quick Start

Compose and serve the catalogue from the process environment, as the binary's
`serve` command does:

```rust
use std::sync::Arc;

use mkc_catalogue_server::application::{ApplicationFactory, SystemApplicationFactory};
use mkc_catalogue_server::error::{ErrorResultExt, Result};
use mkc_config::catalogue::CatalogueConfig;
use mkc_config::settings::{EnvironmentConfig, ProcessEnvironment};

async fn serve() -> Result<()> {
    let settings = EnvironmentConfig {
        environment: Arc::new(ProcessEnvironment),
    }
    .catalogue()
    .context("load catalogue settings")?;
    SystemApplicationFactory.create(settings)?.serve().await
}
```

Run it locally beside the API:

```sh
scripts/cloud/dev-api.sh
# In another terminal:
scripts/cloud/dev-catalogue.sh
cargo run -p mkc-catalogue-server -- --help
```

`serve` applies migrations and listens on `MKC_CATALOGUE_BIND` (default
`127.0.0.1:8082`). Required settings: `MKC_DATABASE_URL`, `MKC_APP_ORIGIN`,
`MKC_CATALOGUE_ORIGIN`, `MKC_CATALOGUE_SIGNING_KEY` (64 lowercase hex digits),
and `MKC_FILE_STORE`. Production uses HTTPS and `gcs` with `MKC_GCS_BUCKET`;
explicit development allows `local` with `MKC_FILE_STORE_ROOT` and localhost.
The launch scripts share `.context/catalogue-signing-key` across processes.
No email provider settings are required by this server. Optional
`MKC_DESKTOP_CLIENT` admits the desktop shell's origin, as above.
`MKC_CATALOGUE_HOT_CACHE_BYTES` accepts a nonnegative integer byte capacity,
defaults to `134217728`, and disables cache allocation at `0`.

Against a local published catalogue, inspect negotiated and ranged delivery
with its publication host:

```sh
curl --compressed -H 'Host: p-<publication-uuid>.localhost:8082' \
  -H 'Accept-Encoding: gzip, br' http://127.0.0.1:8082/mokly-viewer/index.json
curl -H 'Host: p-<publication-uuid>.localhost:8082' \
  -H 'Range: bytes=0-99' http://127.0.0.1:8082/index.html
```

GCS settings are shared with the API:

| Setting          | Behavior                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `MKC_GCS_BUCKET` | Required private bucket when `MKC_FILE_STORE=gcs`.                                                     |
| `MKC_GCS_PREFIX` | Optional namespace: 1–63 lowercase ASCII letters, digits or hyphens. Unset/empty keeps existing names. |

Invalid prefixes fail startup with `Error::Invalid("MKC_GCS_PREFIX")`; values
are never trimmed or normalized. API and catalogue must share the value
(`pr-N` in a PR); stable buckets leave it unset. Logical keys and public URLs
stay unchanged. PR workloads have no bucket-wide list permission. See
[object prefixes](../../docs/protocol/cloud/persistence-boundaries.md#object-prefixes).

## Development

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-catalogue-server -- --nocapture
cargo clippy -p mkc-catalogue-server --all-targets -- -D warnings
```

The compression timing proof asserts the one-second ceiling for a
representative catalogue. It builds only with the `compression-benchmark`
feature, so the gate never runs it. Run it in release mode on one core:

```sh
taskset -c 0 cargo test --release -p mkc-catalogue-server \
  --features compression-benchmark -- \
  representative_five_mib_catalogue_brotli_benchmark --nocapture
```

The `publish_tests` integration test launches the real API and catalogue
application factories as child processes and runs the published CLI against
them. It needs Postgres/psql, Python 3, Node/npm and `npm ci`;
missing dependencies fail with that remedy. A configured unreachable database
fails; an unconfigured developer machine prints its skip reason. Each run owns
a unique Postgres schema and a temporary local store.
[Publish smoke](../../docs/ops/publish-smoke.md) is the runbook.

### Key Code

- [application.rs](./src/application.rs) — `ApplicationFactory` and `SystemApplicationFactory`, the composition root that migrates, connects the store, selects the local or GCS `dyn FileStore`, builds the cache and returns the `Application` that serves.
- [http.rs](./src/http.rs) — `CatalogueHandler`, the bounded HTTP adapter: one Host header, GET/HEAD file requests and the exact-origin `/_access` grant exchange.
- [router.rs](./src/router.rs) — `RouterFactory`, which answers CORS preflight before host routing and sets the isolation headers on every response.
- [routes.rs](./src/routes.rs) — host parsing into a publication or branch alias and single-decoding path validation, including the refused `__mokly` root.
- [catalogue.rs](./src/catalogue.rs) — `Catalogue` and `PublishedCatalogue`, the authorized exact path resolution that selects the status, cache class, ETag, framing and body source.
- [delivery.rs](./src/delivery.rs) — the body selection between the hot cache and a storage stream, including the single-flight fill.
- [cache.rs](./src/cache.rs) and [cache_fill.rs](./src/cache_fill.rs) — `BlobCache` and `LruBlobCache`, the lifetime-accounted LRU keyed by `BlobKey`, with `ENTRY_OVERHEAD_BYTES`, `MAX_CACHED_BLOB_BYTES`, the fill reservations and the waiters.
- [range.rs](./src/range.rs) — pure single-range selection against the indexed length.
- [conditional.rs](./src/conditional.rs) — weak `If-None-Match` comparison.
- [compression.rs](./src/compression.rs) — RFC 9110 content-coding negotiation and the compressible MIME predicate.
- [response.rs](./src/response.rs) — the shared GET, HEAD and 304 framing, the streaming Brotli and gzip encoders, the CSP value and the cookie responses.
- [error.rs](./src/error.rs) — `Error`, the client-safe catalogue failures rendered through the shared RPC envelope.
- [publish_tests.rs](./tests/publish_tests.rs) — the live fixture and published-CLI smoke.

### Related Docs

- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [Catalogue delivery](../../docs/protocol/cloud/catalogue-delivery.md)
- [Desktop application](../../docs/protocol/cloud/desktop-app.md#api-and-catalogue-admission)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Publication ingest](../../docs/protocol/cloud/publication-ingest.md)
- [Publish smoke](../../docs/ops/publish-smoke.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
