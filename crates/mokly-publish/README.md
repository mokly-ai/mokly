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

`Artifact::finalize` adds publication metadata and ownership to captured output
bytes. The static builder installs those exact bytes. `OutputSnapshot` returns
that frozen inventory. Publish never walks the installed directory again.
`Artifact::prepare` verifies every size and digest and creates the compressed
USTAR/PAX Plan archive. The archive contains only the manifest, marker, and
optional pinned review file, in that order.

`Client` implements `Exchange`. It consumes `dyn Http`, `dyn Clock`, and
`dyn Reporter`. The HTTP adapter uses reqwest with rustls. This maintained
client supports cancellable async requests, verified TLS, bounded response
reads, and a timeout that includes body reads. Redirects and implicit retries
are disabled. The exchange owns the five-attempt policy and the single
whole-command re-plan. A failed Blob drops the other active requests.
Credentials have a redacted debug representation. Transport failures and
receiver rejections use fixed safe error messages.

`Command` implements `Publish`. It checks the checkout, allocates a private
build directory, reports that directory once, calls `dyn StaticOutput`, checks
HEAD and status again, then uploads. Directory allocation checks the real
temporary parent before any write. It never deletes completed output after
an upload failure. The static builder's typed errors retain their category
and recovery paths through `BuildFailure`. `mokly-git` owns subprocess
execution and cancellation.
The `warnings_are_fatal` function holds the specified always-fatal publish
policy while the user decision about `--strict` remains open.

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

- [Metadata](./src/metadata.rs), [ownership](./src/ownership.rs), and
  [frozen output](./src/snapshot.rs).
- [Exchange](./src/exchange.rs), [retry policy](./src/retry.rs), and
  [HTTP adapter](./src/http.rs).
- [Command](./src/command.rs) and [Git checks](./src/checkout.rs).

### Related Docs

- [Upload metadata and CLI](../../docs/protocol/mokly-upload.md).
- [Exchange v1](../../docs/protocol/mokly-upload-exchange.md).
- [Validation and limits](../../docs/protocol/mokly-upload-validation.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
