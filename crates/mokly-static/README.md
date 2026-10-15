# mokly-static

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-static` assembles complete static catalogues from a validated render
generation. Use it from the CLI for local builds and the private build used
by publish. It shares output formats with `mokly-model` and has no dependency
on the upload client.

## Responsibilities

- Write every shell route, current detail, document, and reached resource.
- Insert bounded inspector metadata into current document heads.
- Validate package module requests against the exact browser inventory.
- Compute deterministic deployment identities and finalize ownership v3.
- Reserve output and use exclusive moves for capture, installation, and recovery.
- Detect changed source inputs before installation.

## What This Crate Does

`CatalogueAssembler` implements `dyn Assembler`. It consumes a render generation
and the matching viewer package bytes. It builds canonical index v7 and detail
v1 files with revision zero and no live capability. The shared model writer
adds publication metadata when requested and writes the ownership marker last.

`OutputTransactions` implements `dyn Transactions` over injected `Files` and
`mokly-platform::Rename` boundaries. It accepts missing, empty, or owned output.
It validates the captured backup before installation. Cleanup removes only the
validated old files and empty directories. A destination that appears during
installation or recovery survives. Cleanup errors retain their recovery paths. On Windows, directory identity
comes from a non-following handle and `GetFileInformationByHandle`. The identity
retains the volume, file index, and creation time.

The CLI owns configuration, complete rendering, sidecar shutdown, and publish
orchestration. The comparison engine supplies generation output at the same assembly boundary.

## Quick Start

```bash
npm run build
npx mokly build --config examples/basic/mokly.config.json --no-changes --out ../../.context/site
```

Deploy the output contents as an HTTP origin's document root. Configure MIME
types, directory indexes, revalidation, and `X-Content-Type-Options: nosniff`.

## Development

```bash
cargo test -p mokly-static
cargo clippy -p mokly-static --all-targets -- -D warnings
```

Unit tests mock filesystem boundaries with unimock. Integration tests exercise
real exclusive directory moves and injected installation races.

### Key Code

- [Assembly](./src/assembly.rs) and [deployment identity](./src/identity.rs).
- [Output transaction](./src/transaction.rs) and [ownership checks](./src/ownership.rs).
- [Source fingerprints](./src/fingerprint.rs) and [inspector](./src/inspector.rs).

### Related Docs

- [Static build](../../docs/protocol/mokly-export.md).
- [Output safety](../../docs/protocol/mokly-export-safety.md).
- [Recovery](../../docs/protocol/mokly-export-recovery.md).
- [Deployment identity](../../docs/protocol/mokly-export-browser.md).
