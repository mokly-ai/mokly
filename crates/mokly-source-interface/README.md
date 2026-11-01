# mokly-source-interface

`mokly-source-interface` defines read-only access to an authored source tree.
Discovery and rendering depend on its `SourceTree` trait. Working-tree and
Git-tree adapters use the same path, node, and error contract. Depend on it to
read authored sources or to add a source adapter. The crate has no internal
dependency and opens no filesystem paths itself.

## Responsibilities

- Project repository, root, and source identities.
- List direct directory children without following symbolic links.
- Read authored bytes through an object-safe boundary.
- Preserve typed IO failures and portable diagnostic codes.

## What This Crate Does

`SourceTree::project` returns a canonical `Node`, or `None` when a path is
missing or replaced. A node keeps both its lexical kind and its target kind,
so an entry replaced by a symlink is dropped while an explicit root alias
remains valid. `project_batch` returns one metadata result for each requested
path, in request order, and reads no source payload. Its default calls
`project` for each path and continues after an error, so working adapters can
keep it. The Git adapter batches the exact metadata lookups and keeps the
ordinary outcome of each path. The CLI's `CancellableTree` and `InjectedTree`,
`SourceSnapshot`, `CapturedTree`, and `LeasedTree` forward the batch.
`children` returns lexical child kinds. `read` returns
owned bytes. `read_shared` returns immutable `Arc<[u8]>` storage, with a default
adapter over `read`. A caching implementation shares that storage on hits.
`digest` returns a SHA-256 hash through the same boundary. Snapshot adapters
can retain only that hash for dependency, resource, and watch stamps.
`observe_input` forwards an external consumer baseline without rereading its file.
Static admission retains these witnesses. Other adapters can use the default
no-op. `observe_pinned_input` compares historical witnesses with an immutable
source digest without reading the matching working-tree path. [Read evidence](./src/read_evidence.rs) distinguishes observed whole-file
versions, exact byte ranges, and late hashes. It keeps coverage incomplete.
`observe_inputs` forwards all observations for one path together. The
[range verifier](./src/range_evidence.rs) checks them in one streamed pass.
It retains hashes and offsets without retaining another file payload.
`file_object` supplies live native identity separately from a path projection.
Observed file identities retain an optional verified resolved name. Historical
bytes keep their Git proof while extracted-file identities remain distinct.
The byte-reading methods read bytes from an inventoried regular file and reject a replacement symlink.
Callers project an explicit alias and read its target identity. Paths are private source-tree paths; public catalogue JSON uses
repository-relative metadata instead.

`SourceError` retains the source operation, path, and original IO error.
`Unavailable` identifies a recoverable historical checkout failure. It carries
the affected path and warning. It is distinct from a missing source and from
fatal repository IO.
Its `Internal` variant retains adapter-specific errors without converting
those errors to IO errors. Discovery treats `ENOENT` and `ENOTDIR` as benign
races. Unix `ELOOP` and `ENAMETOOLONG` retain their codes. Other failures keep
an error code, with `unknown` as the fallback. A Git adapter never follows a
symbolic-link blob as a regular source file.

The working-tree adapter is `mokly_catalogue::working_tree::WorkingTree`.
Consumers inject it as `Arc<dyn SourceTree>`. The Git adapter is
`mokly_compare::git_tree::GitTree`. It uses one commit index and bounded blob
batches for these operations. It never follows link blobs.

`prefetch` accepts an exact confined read set for batched adapters. Its default
is a no-op. `read_public` bypasses private source-snapshot retention; the caller
must first apply the same public-path policy as resource delivery.
Working and Git adapters implement `digest` with bounded streaming reads.
Snapshot and static admission wrappers retain the resulting hash without the
resource bytes. `digest_unretained` hashes an opaque input without promoting bytes into a
private payload cache. Snapshot adapters share one digest cell with `digest`.
`digest_unretained_batch` hashes several opaque inputs and returns one result
for each path, in request order. Its default calls `digest_unretained` for
each path and continues after a failed digest. The Git adapter overrides it
with one batch, and wrapper adapters forward it.
`open_stream` returns a `dyn SourceStream` with a length and checked-copy
operation. It reads bounded chunks into private destination storage and
returns `SourceError::Changed` on a digest or length mismatch. Callers expose
the destination only after success. Working-tree streams open the captured
physical identity through non-following directory handles. Git streams use
checkout-converted immutable sources under the bounded Git IO contract.
Opening a non-regular asset returns `SourceError::Changed`. Other open failures
retain their IO cause. `is_symlink_error` identifies stopped symbolic-link
resolution and loops. Checked copies retry interrupted reads. Cancellation
uses `SourceError::Cancelled`, separate from an interrupted system call.

## Quick Start

```rust
use std::path::Path;
use mokly_source_interface::tree::SourceTree;

fn read_source(tree: &dyn SourceTree) -> mokly_source_interface::error::Result<Vec<u8>> {
    tree.read(Path::new("/repository/specs/home.screen.html"))
}
```

## Development

```bash
cargo test -p mokly-source-interface
cargo clippy -p mokly-source-interface --all-targets -- -D warnings
```

Enable the `mock` feature to use `SourceTreeMock` with unimock. Adapter tests
live beside the implementation. Discovery tests mock races and assert call
counts without using the disk.

### Key Code

- [`src/tree.rs`](./src/tree.rs) defines `SourceTree`, the object-safe
  boundary that projects, lists, reads, hashes, and streams source paths, and
  its `Node`, `Child`, and `FileKind` records.
- [`src/error.rs`](./src/error.rs) defines `SourceError`, which keeps the
  operation, the path, and the IO cause, and gives a portable code through
  `SourceError::code`.
- [`src/stream.rs`](./src/stream.rs) defines `SourceStream`, which copies one
  opened source into private storage and checks its captured digest.
- [`src/read_evidence.rs`](./src/read_evidence.rs) defines `ReadEvidence` and
  `ReadBaseline`, which keep each observed whole-file, byte-range, and late
  version of an input.
- [`src/range_evidence.rs`](./src/range_evidence.rs) provides `verify`, which
  checks all observed byte ranges of one path in one streamed pass.
- [`src/identity_evidence.rs`](./src/identity_evidence.rs) provides `matches`,
  which compares an opened-file witness with the current file object.

### Related Docs

- [Root discovery](../../docs/protocol/mokly-root-discovery.md).
- [Source protection](../../docs/protocol/mokly-source-protection.md).
- [Rust architecture](../../docs/architecture/rust-core.md).
