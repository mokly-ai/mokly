# mkc-file-store-interface

Immutable content storage contracts for Mokly Cloud. Depend on this crate from
publication services and storage adapters; inject `Arc<dyn FileStore>`.

## Responsibilities

Own bounded put/get/open/delete/list behavior, stream metadata, object
pagination and storage errors.

## What This Crate Does

Every `FileStore` adapter verifies exact bytes against their SHA-256 identity and the
64 MiB regular-file ceiling. An object key combines the hash with a UUID
incarnation so delayed garbage collection cannot delete a later upload of the
same content. Repeated writes of identical content and deletes of missing
objects succeed. Missing reads return `None`; dependency failures preserve
tracked context in `Internal`. Listing returns at most 1000 dated canonical
objects and an opaque continuation.

`get` returns a fully buffered object only after its size and SHA-256 have been
verified; viewer artifact readers use this path. Asynchronous `open` returns a
`BlobStream` whose body is a sendable stream of `Bytes` chunks for catalogue
delivery. A full stream verifies length and SHA-256 as chunks pass and
releases its final byte only once EOF has proved the digest, so a reader can
receive a prefix but never a complete corrupt body. A ranged stream enforces
its selected length but does not recompute the whole-object digest.
`ByteRange` can only represent inclusive offsets that are satisfiable for the
total object length carried with the value, so adapters never receive an
unsatisfiable selection.

`put` consumes `bytes::Bytes`, allowing validators, parallel writers and HTTP
transports to share one owned allocation. It also receives an
`OperationDeadline`, derived as the smaller of 60 seconds and the time left on
the upload attempt. Its one budget covers all provider interactions for that
operation; a zero or consumed budget is an internal adapter failure, while the
publication service rejects an exhausted attempt before calling storage.

`ObjectPrefix` validates an optional physical storage namespace: 1–63 lowercase
ASCII letters, digits or hyphens, with no slash or normalization. Parse it at
configuration boundaries and keep it separate from logical `BlobKey` values.
`mkc-config` maps an unset or empty `MKC_GCS_PREFIX` to `None`; the GCS adapter
applies a configured prefix to its object names and listing filter.

`SeedStore` reads and writes preview seed inputs and results without listing.
`SeedName::new` validates the run key and the declared file path once, producing
`seed/<run>/<file>`. The seed boundary keeps `BlobKey` and immutable content
storage separate. Seed puts atomically replace existing objects.

Seed reads return `None` for missing objects. Each read uses the caller's byte
limit, capped at 100 MiB for `catalogue/plan.tar.gz` and 64 MiB for other seed
objects. Larger objects fail with an integrity error before the adapter buffers
their complete body. Seed puts enforce the same object ceilings.

`mkc-domain` owns hash/key values; `mkc-publications` owns reference policy and
collection. The GCS and local crates implement this boundary.

## Quick Start

Store one verified object through any adapter, then stream a range of it:

```rust
use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::error::{ErrorResultExt, Result};
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_interface::stream::ByteRange;
use uuid::Uuid;

async fn store_then_read(files: Arc<dyn FileStore>) -> Result<Option<Vec<u8>>> {
    let bytes = Bytes::from_static(b"<!doctype html><title>Start</title>");
    let key = BlobKey {
        hash: BlobHash::digest(&bytes),
        incarnation: Uuid::now_v7(),
    };
    files.put(&key, bytes.clone(), OperationDeadline::new(Duration::from_secs(60)))?;
    let range = ByteRange::new(0, 14, bytes.len() as u64);
    let Some(stream) = files.open(&key, range).await? else {
        return Ok(None);
    };
    let mut body = stream.into_body();
    let mut output = Vec::new();
    while let Some(chunk) = body.next().await {
        output.extend_from_slice(&chunk.context("read blob range")?);
    }
    Ok(Some(output))
}
```

## Development

```sh
cargo test -p mkc-file-store-interface
cargo clippy -p mkc-file-store-interface --all-targets -- -D warnings
```

### Key Code

- [store.rs](./src/store.rs) — `FileStore`, the object-safe adapter trait: `put` takes shared `Bytes` and an `OperationDeadline` and accepts an identical repeated write; `get`, `open`, `delete` and `list` enforce the 64 MiB ceiling and digest verification; `verify` is the shared check every adapter runs before a write.
- [stream.rs](./src/stream.rs) — `ByteRange`, the validated inclusive range, and `BlobStream`, whose `full` constructor verifies length and digest as the body flows and whose `ranged` constructor bounds the selected length.
- [deadline.rs](./src/deadline.rs) — `OperationDeadline`, the one-operation storage budget; `for_attempt` derives the smaller of 60 seconds and the time left on the attempt, and `remaining_after` hands each provider request the rest.
- [prefix.rs](./src/prefix.rs) — `ObjectPrefix`, the validated optional namespace that `mkc-config` parses from `MKC_GCS_PREFIX` and the GCS adapter applies, so both share one validation.
- [seed.rs](./src/seed.rs) — `SeedStore` and `SeedStoreMock`, the object-safe get/put boundary for bounded, replaceable seed objects.
- [seed_name.rs](./src/seed_name.rs) — `SeedName` and its validation `Error`, the canonical run and file names with their object size ceilings.
- [error.rs](./src/error.rs) — `Error`, `IntegrityError` and `OperationDeadlineExceeded`, the error contract shared by every adapter.

### Related Docs

- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [Blob durability](../../docs/protocol/cloud/publication-blob-durability.md)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Object prefixes](../../docs/protocol/cloud/persistence-publication-storage.md#object-prefixes)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
