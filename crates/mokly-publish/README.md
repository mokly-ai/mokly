# mokly-publish

`mokly-publish` prepares immutable static output for Mokly Cloud and implements
the public upload exchange. Callers use its traits for the exchange, Git
checks, output snapshots, HTTP, timing, cancellation, and reporting. The CLI
owns publication orchestration and the static output adapter.

## Responsibilities

- Validate the upload metadata from the shared output model.
- Validate the ownership marker, exact bytes, portable paths, and upload limits.
- Send Plan, missing content blobs, and Complete through one origin.
- Apply bounded retries, one re-plan, cancellation, and digest accounting.
- Check committed HEAD and the complete checkout before and after the build.

## What This Crate Does

`mokly_model::output` owns the shared upload and ownership shapes and the
single marker writer. The static builder installs its exact immutable bytes.
The CLI adapter constructs `Finalized` once and retains both the artifact and
its prepared upload. Repeated `OutputSnapshot::capture` calls share parsed
metadata, hashes, and the compressed Plan body. No directory walk occurs.
Index identity validation streams through the catalogue index and rejects
nested duplicate keys without constructing its full value tree. It checks the
index's `baseCommit` against the upload's `baseSha` and its `base` against
`baseRef`. The Plan archive carries the envelope, the ownership marker, and the
index, so a receiver reads Changes from the index without another request.
The installed index and every generation file enter the same upload inventory.
Disabled or unavailable Changes has no generation and null comparison metadata.
The index still records unavailable Changes and its selected base ref.

`Client` implements `Exchange`. It consumes `dyn Http`, `dyn Clock`, and
`dyn Reporter`. The HTTP adapter uses reqwest with rustls and AWS-LC.
TLS trusts both the operating system certificate store and bundled Mozilla
roots. An empty operating system store does not prevent public HTTPS uploads.
Redirects and implicit retries are disabled. The exchange owns five attempts
and one re-plan. A failed Blob drops the other active requests. The reporter resets the phase label at every Plan, including an empty re-plan.
Progress counts a digest once even when `missing` overlaps a Plan-archive digest.
When a Plan lists gzip, each Blob uses gzip only when the compressed body is
smaller than the file. Otherwise it sends the exact file bytes. Progress size
counts decoded file bytes.
Credentials have a redacted debug representation. Transport failures and
receiver rejections use fixed safe messages. Completion URLs and CLI output
redaction match literal and percent-encoded credentials without depending on
the case of percent digits.

`mokly-git` supplies bounded process execution and cancellation. `GitCheckout`
checks committed HEAD and complete fixed-argv status. It excludes only pinned
owned paths and reservation namespaces whose regular `.owner` contains the
exact ownership signature. The CLI owns static build orchestration and
private-directory allocation. Neither the static crate nor this crate depends
on the other; both use `mokly-model` output shapes.

The TLS provider compiles bundled C and assembly with a target C compiler and
archiver. Linux normally uses the cc builder; CMake is a fallback. Rustls
enables prebuilt NASM objects for Windows x64. The workspace forces
`AWS_LC_SYS_USE_SYSTEM=0` to disable automatic host libcrypto discovery. See
[the native TLS requirements](../../docs/protocol/developer-test-commands.md#native-tls-build-tools).

## Quick Start

```bash
cargo test -p mokly-publish
cargo run -p mokly-cli --bin mokly -- publish --help
```

For a client integration, construct `Client` at the composition root. Pass it
as `&dyn Exchange`. Supply a `Prepared` upload, validated `Settings`, and
`&dyn Cancellation`. The receipt contains the upload counts, publication
outcome, and an optional normalized viewer URL.

## Development

```bash
cargo clippy -p mokly-publish --all-targets -- -D warnings
```

Unit tests use unimock and fake timing. Integration tests run a local fake
exchange and verify the public protocol fixtures. CLI process tests also compare
received bytes with the installed artifact, including both comparison sides,
imported CSS assets, removed entries, and unavailable Changes. The `mock` feature exposes
trait mocks to downstream tests.

### Key Code

- [`src/exchange.rs`](./src/exchange.rs) defines `Exchange` and `Client`,
  which send Plan, the missing Blobs, and Complete with bounded retries.
- [`src/snapshot.rs`](./src/snapshot.rs) defines `Finalized`, `Prepared`, and
  `OutputSnapshot`, which validate finished output once and keep the prepared
  upload.
- [`src/index_identity.rs`](./src/index_identity.rs) defines `IndexIdentity`,
  which streams the catalogue index and keeps its base and base commit for the
  check against the upload metadata.
- [`src/settings.rs`](./src/settings.rs) defines `Settings` and `Token`, the
  validated endpoint, credential, and concurrency.
- [`src/http.rs`](./src/http.rs) defines `Http` and `ReqwestHttp`, the
  one-attempt HTTP boundary and its rustls adapter.
- [`src/blob_body.rs`](./src/blob_body.rs) prepares a deterministic gzip Blob
  body and keeps raw bytes when gzip is not smaller.
- [`src/runtime.rs`](./src/runtime.rs) defines the injected `Clock`,
  `Cancellation`, and `Reporter` traits.
- [`src/checkout.rs`](./src/checkout.rs) defines `Checkout` and `GitCheckout`,
  which check committed `HEAD` and a clean checkout.
- [`src/accounting.rs`](./src/accounting.rs) defines `Receipt` and
  `Progress`, the digest-based upload accounting.
- [`src/redaction.rs`](./src/redaction.rs) defines `SecretMatcher`, which
  matches literal and percent-encoded credentials.
- [`../mokly-cli/src/publication/mod.rs`](../mokly-cli/src/publication/mod.rs)
  holds the CLI orchestration that calls this crate.

### Related Docs

- [Upload metadata and CLI](../../docs/protocol/mokly-upload.md).
- [Upload exchange](../../docs/protocol/mokly-upload-exchange.md).
- [Validation and limits](../../docs/protocol/mokly-upload-validation.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
