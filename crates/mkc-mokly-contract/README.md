# mkc-mokly-contract

`mkc-mokly-contract` validates the Mokly upload artifacts for a receiver: the
plan archive, the upload envelope, the ownership marker and the catalogue
index. Depend on it when accepting `mokly publish` plan requests or checking
compatibility with the workspace Mokly packages. It never touches HTTP, the
database or the filesystem and does not depend on Mokly internals;
`mkc-publications` owns idempotency and storage, and `mkc-api` owns
authentication, repository authorization and request deadlines.

## Responsibilities

- Decode bounded single-member gzip and USTAR/PAX streams without extraction.
- Type and validate upload envelope 3, ownership marker 3 and the index 9
  fields that publication consumers read.
- Validate a plan archive against the catalogue its marker declares: exact
  artifact set, declared digests, hosting policy and comparison generation.
- Return shared, reservation-backed artifact bytes and typed HTTP rejection
  categories.

## What This Crate Does

`bundle::UploadValidator` consumes an authenticated plan body through an
injected `archive::TarballReader`. `archive::GzipTarReader` checks byte, file
count, path and derived-index ceilings before accepting a body, and charges
every retained file to the injected `UploadMemoryBudget` that the publication
blob handlers share; exhaustion is the typed retryable `Unavailable` result.
Alternate readers build the same immutable result with
`ScannedArchive::from_files`. `bundle::ContractValidator` then requires exactly
`mokly-upload.json`, `.mokly-export-artifact` and `mokly-viewer/index.json`,
and returns a `PlanBundle` with read-only access to the envelope, the parsed
`inventory::Inventory` marker, the validated `index::CatalogueIndex` and the artifacts'
exact bytes. Other catalogue files arrive later as blobs. The marker's
`{ path, sha256, size }` entries describe them. The publication service
verifies each blob body against its entry.

The rules the crate enforces are in
[Publication upload validation](../../docs/protocol/cloud/publication-upload-validation.md)
and [Publication index](../../docs/protocol/cloud/publication-review.md). At the
API of this crate, `Limits::lowered(Quotas { .. })` builds immutable quotas
clamped to the documented ceilings, and the standalone `parse` methods of the
envelope, marker and index take the same `Limits`, so lowered quotas apply to
every artifact and path. Marker parsing alone is a shape check; the hosting
policy and the reserved roots apply at plan validation, so upstream valid
marker cases stay valid marker shapes. Marker and index unknown fields are
ignored. Envelope unknown fields are rejected. The index reader checks only
the fields that the receiver reads: the base fields, the record paths and
titles, `changes`, and the screen view axes. It does not validate the
catalogue tree, details, usage, resource evidence or producer attribution.

`PlanBundle::index()` returns the validated index facts. `index_bytes()`
returns its exact, digest-checked bytes. `artifacts()` returns the envelope,
marker and index in the CLI's Plan order. `CatalogueIndex::parse` reads a
stored index under the same quotas. Its `comparison_generation()` returns the
validated generation root. `changes_count()` returns the ready changed,
added, removed and moved counts, or `None` without a ready comparison.
`counted_records()` preserves check order: current components, documents,
pages, screens and use cases, then removed records. Each record keeps its
path and title. `current_screens()` returns current screens and variants with
the axes of each view in index order. No consumer needs to validate these
facts again. The reader has no review types or derived snapshot list.

`error::Error` maps invalid bundles to 400, limits to 413, unsupported
envelope, marker or index versions to 426, upload-memory exhaustion to 503
and internal failures to 500. `UnsupportedVersion` carries the `ArtifactKind`
and the received version for internal diagnostics; the API answers with one
fixed recovery message.

## Quick Start

Construct the concrete adapters only at your composition root:

```rust
use std::sync::Arc;

use mkc_mokly_contract::archive::GzipTarReader;
use mkc_mokly_contract::bundle::{ContractValidator, UploadValidator};
use mkc_mokly_contract::limits::{Limits, Quotas};
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;

let receiver: Arc<dyn UploadValidator> = Arc::new(ContractValidator {
    reader: Arc::new(GzipTarReader::new(Arc::new(
        ProcessUploadMemoryBudget::new(512 * 1024 * 1024),
    ))),
    limits: Limits::lowered(Quotas { files: 10_000, ..Quotas::default() }),
});
```

In an authenticated plan request, call `receiver.validate(&mut body)`. Receivers
needing rejection attribution call `validate_with_envelope(&mut body, &mut envelope)`;
the out parameter retains a parsed envelope even if later scanning or validation
fails. This is producer input, never authorization: check the token, repository
and config path before using its head identity. Errors and accepted bytes are
the same as `validate`; a malformed or not-yet-read envelope leaves the output
empty.

Run the real fixture as a smoke test:

```sh
cargo test -p mkc-mokly-contract --test dogfood
npm ci
cargo xtask mokly-fixtures --check
```

`mkc-domain::entry_path::entry_path` owns the shared portable identity grammar.
This receiver applies its artifact byte and segment limits to that grammar.
Cloud selections use the domain's validated `EntryPath` with their own bound;
the domain has no dependency on this receiver.

## Development

Enable the optional `openapi` feature to derive `utoipa::ToSchema` for
`Viewport` and `ColorScheme`. `mkc-api` enables it for viewer
schemas. The default build has no `utoipa` dependency.

```sh
cargo build -p mkc-mokly-contract
cargo test -p mkc-mokly-contract
cargo clippy --workspace --all-targets -- -D warnings
cargo xtask mokly-fixtures       # deliberate regeneration
cargo xtask check
```

Unit tests use unimock at the injected reader boundary; byte-level tests
exercise in-memory compressed streams. The integration tests validate the real
frozen plan archives and refuse a complete export as a plan. The allocation
test bounds memory for maximum-size archives and JSON artifacts. The fixture
generator captures envelope 3 and index 9 from the real workspace CLI. The Rust
and Node checks run the shared index Changes-count corpus, both captured
indexes and the published catalogue. Each corpus case checks its exact input
hash before decoding. Both readers derive the same Changes counts. The
corpus and fixture layout are in the [fixture guide](./fixtures/README.md).
A Mokly change that changes these artifacts regenerates the fixtures and
updates the corpus deliberately, in the same change.

The CLI failure fixture captures uncommitted-file and refused-upload codes from
real failed workspace CLI publish commands in a separate temporary checkout. Its checksum
is in `checksums.json`. The publications worker tests its typed mappings
against these observed codes; the `cloud-fixtures` suite regenerates and
rejects byte drift.

The cloud uses the workspace `@mokly/mokly` and `@mokly/viewer` packages, so
a Mokly change reaches this crate in the same commit. When a change touches
the upload artifacts or the viewer readers: update the Mokly protocol docs,
run `npm run build` and `cargo xtask mokly-fixtures`, review the fixture
metadata and content changes as compatibility input, update this crate and
the docs where the contract requires it, and run `cargo xtask check` before
committing. The `cloud-fixtures` suite fails while the committed fixtures
differ from the workspace build. A bump of the fixture packer `tar` also
updates the toolchain-pins table and reviews the archive header differences.
A viewer-only change does not regenerate producer fixtures unless its
contract also requires a producer change. Never regenerate merely to suppress
a failing decoder.

### Key Code

- [bundle.rs](./src/bundle.rs) — `UploadValidator`, `ContractValidator` and `PlanBundle`, the receiver entry point and its immutable validated result.
- [archive.rs](./src/archive.rs) — `TarballReader` and `GzipTarReader`, the injected reader boundary and the gzip/USTAR implementation.
- [stream.rs](./src/stream.rs) and [tar_scan.rs](./src/tar_scan.rs) — the single-member gzip framing, the bounded tar scan and the per-file memory reservations.
- [scanned_archive.rs](./src/scanned_archive.rs) — `ScannedArchive::from_files`, the validated-namespace result an alternate reader builds.
- [bundle_validation.rs](./src/bundle_validation.rs) — the plan checks: exact artifact set, declared digests, hosting policy, reserved roots and the comparison generation.
- [manifest.rs](./src/manifest.rs), [inventory.rs](./src/inventory.rs) and [index.rs](./src/index.rs) — `UploadManifest`, `Inventory` and `CatalogueIndex`, each with its version probe and `parse`.
- [index_records.rs](./src/index_records.rs) and [index_values.rs](./src/index_values.rs) — the validated record, count, screen and view-axis types for publication consumers.
- [index_validation.rs](./src/index_validation.rs) and [index_projection.rs](./src/index_projection.rs) — the documented read-field checks and the ordered publication facts.
- [json_guard.rs](./src/json_guard.rs) — the streaming JSON preflight that bounds nodes, retained key digests and depth (`JSON_DEPTH`, 256 levels) and rejects duplicate keys before typed decoding.
- [json.rs](./src/json.rs) — the strict typed decoding helpers and the version probe shared by the three artifacts.
- [limits.rs](./src/limits.rs) — `Quotas` and `Limits::lowered`, the clamped receiver quotas.
- [error.rs](./src/error.rs) — `Error`, `Rejection`, `Limit` and `ArtifactKind`, the typed rejections and their HTTP statuses.
- [tests/dogfood.rs](./tests/dogfood.rs), [tests/compatibility](./tests/compatibility) and [tests/memory.rs](./tests/memory.rs) — the frozen-fixture, moves, index corpus and allocation tests.
- [xtask/scripts/mokly-fixtures.mjs](../../xtask/scripts/mokly-fixtures.mjs) — the fixture generator, the CLI failure probes and the Node side of the index Changes-count corpus check, run by `cargo xtask mokly-fixtures`.

### Related Docs

- [Publication upload](../../docs/protocol/cloud/publication-upload.md), its [validation](../../docs/protocol/cloud/publication-upload-validation.md) and [Publication index](../../docs/protocol/cloud/publication-review.md)
- [Upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md)
- [Artifact compatibility](../../docs/protocol/cloud/mokly-artifact-compatibility.md) and [fixture regeneration](../../docs/protocol/cloud/mokly-fixture-regeneration.md)
- [Upload memory interface](../mkc-upload-memory-interface/README.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
