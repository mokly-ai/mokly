# mkc-upload-memory

Atomic process-wide upload-memory accounting for Mokly Cloud. Composition roots
construct this implementation and inject it through
`mkc-upload-memory-interface`.

## Responsibilities

- Enforce one weighted byte capacity across concurrent uploads.
- Refuse exhausted reservations immediately.
- Release held bytes when the final shared reservation is dropped.

## What This Crate Does

`ProcessUploadMemoryBudget` uses compare-and-exchange accounting so concurrent
callers cannot over-reserve. Successful reservations are shared guards; their
capacity is returned exactly once after the final owner is dropped. A gzip Blob
can hold two guards, one for the encoded body and one for the decoded file.
The crate does not block or queue callers.

## Quick Start

```rust
use std::sync::Arc;

use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use mkc_upload_memory_interface::budget::UploadMemoryBudget;

let budget: Arc<dyn UploadMemoryBudget> =
    Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024));
let _reservation = budget.reserve(1024)?;
# Ok::<(), mkc_upload_memory_interface::budget::Error>(())
```

## Development

```sh
cargo test -p mkc-upload-memory
cargo clippy -p mkc-upload-memory --all-targets -- -D warnings
```

### Key Code

- [budget.rs](./src/budget.rs) — atomic capacity and release behavior.

### Related Docs

- [Publication ingest](../../docs/protocol/cloud/publication-ingest.md)
- [Environment settings](../../docs/ops/environment.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
