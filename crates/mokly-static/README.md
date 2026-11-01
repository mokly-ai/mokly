# mokly-static

`mokly-static` assembles complete static catalogues from a validated render
generation. Use it from the CLI for local builds and the private build used
by publish. It reads documents from `mokly-graph` and comparison results from
`mokly-compare`. It shares output formats with `mokly-model` and has no
dependency on the upload client in `mokly-publish`.

## Responsibilities

- Write every shell route, current detail, document, and reached resource.
- Capture comparison documents, resources, removed records, and preview metadata.
- Insert bounded inspector metadata into current document heads.
- Validate package module requests against the exact browser inventory.
- Compute deterministic deployment identities and finalize the ownership marker.
- Reserve output and use exclusive moves for capture, installation, and recovery.
- Detect changed selected inputs before installation. Missing unrelated files and
  unreadable unrelated paths do not fail a build.

## What This Crate Does

`CatalogueAssembler` implements `dyn Assembler`. It consumes a render generation
and the matching viewer package bytes, plus the command's retained `dyn ChangeState`. It omits only logical links that cannot cross the inspector wire boundary.
Other ranges and links stay inspectable. Inspector failures carry a typed reason
and the document route. It builds the canonical index and entry detail files
with revision zero and no live capability, then writes the static deployment
file after computing the deployment identity. The
[format inventory](../../docs/protocol/mokly-format-versions.md) gives their
versions. The shared model writer adds publication metadata when requested and
writes the ownership marker last. Ready Changes supplies the base commit, the
generation root, detail-root reasons, each view's state, ignore ids, and
evidence, the base side, workspace lists, and removed records from the same
comparison result. The review result and the change snapshot stay private; no
generation file holds them. Both pinned graph sides supply immutable documents
and resources. Removed details carry their historical snapshot ID and content
id. Removed page and document previews carry typed preview metadata.
`mokly_compare::projection_removed` owns these records, details, and metadata.
The caller uses its shared workspace initializer for removed visual details
before applying the comparison workspace projection.
The comparison inventory is finalized before deployment identity. Disabled or
unavailable Changes writes no generation; both states remain explicit in the index.
The strict index reader runs before installation and retains its diagnostic on failure.
Publication takes its base ref and commit from that same result.

`OutputTransactions` implements `dyn Transactions` over injected `Files` and
`mokly_platform::rename::Rename` boundaries. It accepts missing, empty, or owned output.
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
Capture rejects a different digest before document callbacks. PostCSS witnesses
retain every observed whole-file version and byte range through cache reuse and worker replacement.
The [evidence verifier](./src/fingerprint_evidence.rs) checks them before callbacks
and at final verification. Pinned historical sources use their Git digests
without reading head aliases. Late baselines remain explicit for opaque reads.
Descriptor identities detect equal-byte target changes before callbacks and installation.
`CapturedTree` records the node observation of each path of a `project_batch`
call for the final identity check, also for a path that only the batch observed.
Observation never makes PostCSS coverage complete. A missing module
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
types, directory indexes, revalidation, and `X-Content-Type-Options: nosniff`
under the [static delivery contract](../../docs/protocol/mokly-export-delivery.md).

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

- [`src/assembly.rs`](./src/assembly.rs) defines `Assembler` and
  `CatalogueAssembler`, which capture every document and reached resource of
  a generation into one `Artifact`.
- [`src/changes.rs`](./src/changes.rs) defines `ChangeState`, the retained
  comparison state that assembly reads.
- [`src/transaction.rs`](./src/transaction.rs) defines `Transactions`,
  `Transaction`, and `OutputTransactions`, which reserve, stage, install, and
  recover the output directory.
- [`src/filesystem.rs`](./src/filesystem.rs) defines `Files` and
  `SystemFiles`, the non-following filesystem boundary of the transaction.
- [`src/identity.rs`](./src/identity.rs) provides `finalize`, which stamps the
  deterministic deployment identity.
- [`src/fingerprint.rs`](./src/fingerprint.rs) defines `CapturedTree`, which
  records selected input digests and checks them before installation.
- [`src/inspector.rs`](./src/inspector.rs) provides `inject`, which writes the
  inspector metadata into a document head.
- [`src/modules.rs`](./src/modules.rs) provides `validate`, which checks
  package module requests against the browser inventory.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed static-output
  failure with its retained recovery paths.

### Related Docs

- [Static build](../../docs/protocol/mokly-export.md).
- [Output safety](../../docs/protocol/mokly-export-safety.md).
- [Recovery](../../docs/protocol/mokly-export-recovery.md).
- [Deployment identity](../../docs/protocol/mokly-export-browser.md).
- [Static delivery](../../docs/protocol/mokly-export-delivery.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
- [Format inventory](../../docs/protocol/mokly-format-versions.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
