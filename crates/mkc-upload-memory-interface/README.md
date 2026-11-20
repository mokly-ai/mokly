# mkc-upload-memory-interface

Shared upload-memory admission contracts for Mokly Cloud. The archive reader
in `mkc-mokly-contract` and the publication blob handler in `mkc-api` depend
on this crate, so one API process applies one byte budget to every upload body
without a dependency cycle. `mkc-upload-memory` is the process-wide
implementation that the API composition root constructs and injects.

## Responsibilities

- Reserve upload bytes without blocking.
- Retain reservations behind shared lifetime guards.
- Report typed capacity exhaustion.

## What This Crate Does

`UploadMemoryBudget` is the injected admission boundary: `reserve` either
returns a shared `UploadMemoryReservation` guard at once or fails with
`Error::Exhausted`, which names the requested bytes and the capacity. A
reservation stays charged while any clone of its guard lives, and the
implementation releases it when the final owner is dropped. Callers translate
`Exhausted` to their retryable outcome; the upload routes answer HTTP 503
with the `upload-unavailable` reason.

## Quick Start

Reserve a body's declared length before reading it, and keep the guard with
the buffered bytes. A gzip Blob reserves its encoded and decoded lengths as
two guards:

```rust
use std::sync::Arc;

use mkc_upload_memory_interface::budget::{Error, UploadMemoryBudget, UploadMemoryReservation};

fn admit(
    budget: &dyn UploadMemoryBudget,
    declared_length: u64,
) -> Option<Arc<dyn UploadMemoryReservation>> {
    match budget.reserve(declared_length) {
        Ok(reservation) => Some(reservation),
        // The upload routes answer 503 here; nothing waits for capacity.
        Err(Error::Exhausted { .. }) => None,
    }
}
```

`mkc-upload-memory` provides `ProcessUploadMemoryBudget` for the
composition root; see its [README](../mkc-upload-memory/README.md).

## Development

```sh
cargo test -p mkc-upload-memory-interface
cargo clippy -p mkc-upload-memory-interface --all-targets -- -D warnings
```

### Key Code

- [budget.rs](./src/budget.rs) — `UploadMemoryBudget`, the `reserve` contract; `UploadMemoryReservation`, the shared guard; and `Error::Exhausted`, the typed capacity failure.

### Related Docs

- [Publication ingest](../../docs/protocol/cloud/publication-ingest.md#http-boundary) — the `MKC_UPLOAD_MEMORY_BYTES` budget and its admission rules.
- [Upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md#blob-upload) — raw Blob requests hold their declared length, and gzip requests hold both encoded and decoded lengths from the budget.
- [Environment settings](../../docs/ops/environment.md)
- [mkc-upload-memory](../mkc-upload-memory/README.md) and [mkc-mokly-contract](../mkc-mokly-contract/README.md), the implementation and the first consumer.
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
