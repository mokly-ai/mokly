# mokly-publish

`mokly-publish` prepares immutable static output for Mokly Cloud and implements
the public upload exchange v1. Callers use its traits for the exchange, Git
checks, output snapshots, HTTP, timing, cancellation, and reporting. The CLI
owns publication orchestration and the static output adapter.

## Responsibilities

- Validate upload metadata v2 from the shared output model.
- Validate ownership v3, exact bytes, portable paths, and upload limits.
- Send Plan, missing content blobs, and Complete through one origin.
- Apply bounded retries, one re-plan, cancellation, and digest accounting.
- Check committed HEAD and the complete checkout before and after the build.

## What This Crate Does

`mokly-model::output` owns the shared upload and ownership shapes and the
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
[the developer toolchain rules](../../docs/protocol/developer-test-commands.md#native-tls-build-tools).

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
cargo test -p mokly-publish
```

Unit tests use unimock and fake timing. Integration tests run a local fake
exchange and verify the public protocol fixtures. CLI process tests also compare
received bytes with the installed artifact, including both comparison sides,
imported CSS assets, removed entries, and unavailable Changes. The `mock` feature exposes
trait mocks to downstream tests.

### Key Code

- [Shared output model](../mokly-model/src/output/mod.rs) and
  [prepared output](./src/snapshot.rs), with the
  [index identity check](./src/index_identity.rs).
- [Exchange](./src/exchange.rs), [retry policy](./src/retry.rs), and
  [HTTP adapter](./src/http.rs).
- [Secret redaction](./src/redaction.rs) matches literal and percent-encoded
  credentials.
- [CLI adapter](../mokly-cli/src/publication/mod.rs) and [Git checks](./src/checkout.rs).

### Related Docs

- [Upload metadata and CLI](../../docs/protocol/mokly-upload.md).
- [Exchange v1](../../docs/protocol/mokly-upload-exchange.md).
- [Validation and limits](../../docs/protocol/mokly-upload-validation.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
