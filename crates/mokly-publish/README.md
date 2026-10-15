# mokly-publish

`mokly-publish` prepares immutable static output for Mokly Cloud and implements
the public upload exchange v1. Callers use its traits for publication, Git
checks, static output, HTTP, timing, cancellation, and reporting.

## Responsibilities

- Build upload metadata v2 before ownership finalization.
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
Review identity validation streams through the review JSON and rejects nested
duplicate keys without constructing its full value tree.

`Client` implements `Exchange`. It consumes `dyn Http`, `dyn Clock`, and
`dyn Reporter`. The HTTP adapter uses reqwest with rustls and AWS-LC.
Redirects and implicit retries are disabled. The exchange owns five attempts
and one re-plan. A failed Blob drops the other active requests. Progress
counts a digest once even when `missing` overlaps a Plan-archive digest.
Credentials have a redacted debug representation. Transport failures and
receiver rejections use fixed safe messages.

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
as `&dyn Exchange`. Supply a prepared `Artifact`, validated `Settings`, and
`&dyn Cancellation`. The receipt contains the upload counts, publication
outcome, and an optional normalized viewer URL.

## Development

```bash
cargo clippy -p mokly-publish --all-targets -- -D warnings
cargo test -p mokly-publish
```

Unit tests use unimock and fake timing. Integration tests run a local fake
exchange and verify the public protocol fixtures. The `mock` feature exposes
trait mocks to downstream tests.

### Key Code

- [Shared output model](../mokly-model/src/output/mod.rs) and
  [prepared output](./src/snapshot.rs).
- [Exchange](./src/exchange.rs), [retry policy](./src/retry.rs), and
  [HTTP adapter](./src/http.rs).
- [CLI adapter](../mokly-cli/src/publication/mod.rs) and [Git checks](./src/checkout.rs).

### Related Docs

- [Upload metadata and CLI](../../docs/protocol/mokly-upload.md).
- [Exchange v1](../../docs/protocol/mokly-upload-exchange.md).
- [Validation and limits](../../docs/protocol/mokly-upload-validation.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
