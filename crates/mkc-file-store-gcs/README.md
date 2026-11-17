# mkc-file-store-gcs

Google Cloud Storage JSON API implementation of Mokly Cloud's immutable file
store. Construct `GcsFileStore` at the composition root and inject its
`Arc<dyn FileStore>` into publication services.

## Responsibilities

Persist and verify private content through bounded authenticated HTTP requests.

## What This Crate Does

`FileStore` media inserts use `ifGenerationMatch=0`; a 412 requests only the existing
object's `size` metadata and accepts its decimal string only when it equals the
verified local byte length. A missing object, malformed metadata or size
mismatch is an internal failure; the adapter never downloads a duplicate body.
One injected-clock operation budget covers credential acquisition, insert and
any 412 metadata confirmation. Each provider request receives only the
remaining time, and exhaustion prevents a follow-up request.
Buffered `get` reads use `alt=media` and verify before returning. Stream
opens also use `alt=media`; full opens require 200 and `Content-Length`, while
ranged opens send `Range: bytes=a-b`, require 206 and cross-check both
`Content-Length` and `Content-Range`. Missing objects return `None`. Deletes
accept 204 or 404. Listing preserves Google's page token and server creation
timestamps. URLs encode the entire object name as one path segment.

Buffered JSON operations use finite whole-request deadlines. Streamed media
uses a 10-second connect timeout, a separate 60-second header timeout and a
60-second provider idle limit that counts only time spent waiting on the
provider, so a consumer that pauses never loses a healthy response. Every
response stream and buffered body has a finite byte limit, and redirects are
disabled. Credentials come from the injected `AccessToken` boundary and are
never logged.

Production credentials come from the Google metadata server with
`Metadata-Flavor: Google`, fetched for each operation through `dyn AccessToken`.
Configure a private `MKC_GCS_BUCKET` and workload identity with object
create/read/delete permissions, plus list permission for callers that enumerate
objects. This crate has no publication authorization or database reference
policy.

The [PR preview contract](../../docs/protocol/cloud/persistence-boundaries.md#object-prefixes)
defines optional `MKC_GCS_PREFIX`, parsed by `mkc-config` into the file-store
interface's `ObjectPrefix`: unset/empty keeps existing names; otherwise use
1–63 lowercase ASCII letters, digits or hyphens, without normalization.
Invalid values fail startup with `Error::Invalid("MKC_GCS_PREFIX")`.
Every physical content name becomes
`<prefix>/sha256/<hash>/<incarnation>`, including conditional-create conflict
reads. Listing filters by `<prefix>/sha256/`, strips only the exact prefix and
ignores foreign names while preserving pagination and timestamps. Logical keys
and public URLs never change. Prefix-restricted PR IAM does not grant bucket
listing; only an independently authorized caller may use `list`.

`GcsFileStore` also implements `SeedStore` for preview seed inputs and results.
Seed names are `seed/<run>/<file>`, or `<prefix>/seed/<run>/<file>` with a
configured prefix. Seed media inserts omit `ifGenerationMatch`, so puts
replace existing objects. Seed reads use `alt=media` and the interface's byte
limits. Oversized objects fail with an integrity error, and missing objects
return `None` even when their error body exceeds the read limit.

Seed storage uses no list request and needs no bucket list permission.
Content listing continues to filter only `<prefix>/sha256/`, so it ignores
seed objects.

## Quick Start

Construct the adapter with a validated prefix at the composition root:

```rust
use std::sync::Arc;

use mkc_file_store_gcs::credentials::{CredentialsFactory, MetadataCredentialsFactory};
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{HttpFactory, ReqwestHttpFactory};
use mkc_file_store_interface::prefix::ObjectPrefix;
use mkc_file_store_interface::store::FileStore;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let prefix: ObjectPrefix = "pr-123".parse()?;
    let _files: Arc<dyn FileStore> = Arc::new(GcsFileStore::new(
        "https://storage.googleapis.com".to_owned(),
        "mokly-508518-preview-blobs".to_owned(),
        Some(prefix),
        ReqwestHttpFactory.build(MetadataCredentialsFactory.metadata()?)?,
    ));
    Ok(())
}
```

Use `prefix: None` for existing unprefixed buckets. The API and catalogue server
set this field from the same optional `MKC_GCS_PREFIX` environment variable.

```sh
cargo test -p mkc-file-store-gcs
```

The tests use recorded provider-shaped responses over a loopback HTTP double;
no Google credentials or live bucket are needed.

## Development

```sh
cargo clippy -p mkc-file-store-gcs --all-targets -- -D warnings
```

### Key Code

- [store.rs](./src/store.rs) — `GcsFileStore`, the JSON API behavior; it prefixes every object name, lists beneath `<prefix>/sha256/` and strips exactly `<prefix>/` before `BlobKey::from_object_name`, ignoring foreign names.
- [seed.rs](./src/seed.rs) — the `SeedStore` implementation for bounded reads and replacing media inserts under the configured object prefix.
- [media.rs](./src/media.rs) — the streamed `alt=media` open and its exact status, `Content-Length` and `Content-Range` validation.
- [transport.rs](./src/transport.rs) — `Http`, `AccessToken` and `HttpFactory`, the buffered JSON, streamed media and OAuth seams, and `ReqwestHttpFactory`, their production transport with the connect, header and body limits.
- [idle_timeout.rs](./src/idle_timeout.rs) — `IdleTimeout`, the demand-started provider idle timer that wraps every media body.
- [credentials.rs](./src/credentials.rs) — `CredentialsFactory` and `MetadataCredentialsFactory`, the workload-identity token source.
- [deadline.rs](./src/deadline.rs) — `Clock` and `RequestBudget`, the injected monotonic measurement of one operation budget.
- [json_api_tests.rs](./tests/json_api_tests.rs) — recorded HTTP exchanges against a loopback double.
- [seed_tests.rs](./tests/seed_tests.rs) and [seed_limits_tests.rs](./tests/seed_limits_tests.rs) — seed HTTP methods, exact names, replacement, absence, read ceilings and provider failures.

### Related Docs

- [Storage interface](../mkc-file-store-interface/README.md)
- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [Blob durability](../../docs/protocol/cloud/publication-blob-durability.md)
- [Google JSON API](https://cloud.google.com/storage/docs/json_api)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
