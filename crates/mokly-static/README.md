# mokly-static

`mokly-static` assembles complete static catalogues from a validated render
generation. Use it from the CLI for local builds and the private build used
by publish. It shares output formats with `mokly-model` and has no dependency
on the upload client.

## Responsibilities

- Write every shell route, current detail, document, and reached resource.
- Capture comparison documents, resources, removed records, and preview metadata.
- Insert bounded inspector metadata into current document heads.
- Validate package module requests against the exact browser inventory.
- Compute deterministic deployment identities and finalize ownership v3.
- Reserve output and use exclusive moves for capture, installation, and recovery.
- Detect changed selected inputs before installation. Missing unrelated files and
  unreadable unrelated paths do not fail a build.

## What This Crate Does

`CatalogueAssembler` implements `dyn Assembler`. It consumes a render generation
and the matching viewer package bytes, plus the command's retained `dyn ChangeState`. It omits only logical links that cannot cross the inspector wire boundary.
Other ranges and links stay inspectable. Inspector failures carry a typed reason
and the document route. It builds canonical index v7 and detail
v1 files with revision zero and no live capability. The shared model writer
adds publication metadata when requested and writes the ownership marker last.
Ready Changes supplies review v8, detail-root reasons, view evidence, workspace lists,
and removed records from the same comparison result. Snapshot v4 stays private. Both pinned graph sides
supply immutable documents and resources. Removed details carry their historical
snapshot ID and generation; removed page and document previews carry metadata v3.
`mokly-compare::projection_removed` owns these records, details, and metadata.
The caller uses its shared workspace initializer for removed visual details
before applying the comparison workspace projection.
The comparison inventory is finalized before deployment identity. Disabled or
unavailable Changes writes no generation; both states remain explicit in the index.
The strict index reader runs before installation and retains its diagnostic on failure.
Publication takes its base ref, commit, and comparison path from that same result.

`OutputTransactions` implements `dyn Transactions` over injected `Files` and
`mokly-platform::Rename` boundaries. It accepts missing, empty, or owned output.
It validates the captured backup before installation. Cleanup removes only the
validated old files and empty directories. A destination that appears during
installation or recovery survives. Cleanup errors retain their recovery paths. On Windows, directory identity
comes from a non-following handle and `GetFileInformationByHandle`. The identity
retains the volume, file index, and creation time.

Input capture and final verification use digest reads for hash-only inputs.
The snapshot keeps bytes only for actual parsing and delivery.
Capture walks each configured root with its own discovery file patterns. It
records matching regular files and folder records, then hashes those files and
the configured inputs through `CapturedTree`. Inventoried sidecar modules retain the digests of the exact bundled bytes.
Capture rejects a different digest before document callbacks. A missing module
digest is an internal failure. Other inventoried
sources and reached resources use that same digest path. Unreadable markers
leave required-input diagnostics to catalogue discovery and validation. The final check compares root
membership, selected identities, and live digests. It streams selected file
contents only for hashing and confines directory walks to the configured roots.
Output and reservation directories
stay outside root membership. Explicit inputs beneath excluded directory names
remain protected.

Opaque CSS assets enter the final `Artifact` through digest-checked streams.
The existing per-file output bound is checked before allocating a payload.
Only the final immutable output bytes remain; preparation and render caches
hold asset metadata. A mismatch returns `InputsChanged` before inventory
admission or installation. Publish consumes those same immutable bytes.

The CLI owns configuration, complete rendering, sidecar shutdown, and publish
orchestration. The comparison engine supplies generation output at the same assembly boundary.

Public source reads forward without retaining their bytes. The captured tree
records their hashes for the final live verification. Digest-only capture uses
the same streaming adapter and per-path snapshot hash as graph planning.
Unused projected paths do not become fingerprint inputs. A consumed alias keeps
its identity check even when both possible targets have equal bytes.

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
real exclusive directory moves and injected installation races, including
owned substitutions, empty destination conflicts, unowned captured files,
reservation mutations, Unicode paths, and cancellation. CLI process tests
exercise retained recovery bytes through debug-only fault adapters.

### Key Code

- [Assembly](./src/assembly.rs), [comparison generation writer](./src/comparison_output.rs),
  and [deployment identity](./src/identity.rs).
- [Output transaction](./src/transaction.rs) and [ownership checks](./src/ownership.rs).
- [Source fingerprints](./src/fingerprint.rs) and [inspector](./src/inspector.rs).

### Related Docs

- [Static build](../../docs/protocol/mokly-export.md).
- [Output safety](../../docs/protocol/mokly-export-safety.md).
- [Recovery](../../docs/protocol/mokly-export-recovery.md).
- [Deployment identity](../../docs/protocol/mokly-export-browser.md).
