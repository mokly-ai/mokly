# mokly-source-interface

`mokly-source-interface` defines read-only access to an authored source tree.
Discovery and rendering depend on its `SourceTree` trait. Working-tree and
Git-tree adapters use the same path, node, and error contract. The crate has
no internal dependency and performs no IO itself.

## Responsibilities

- Project repository, root, and source identities.
- List direct directory children without following symbolic links.
- Read authored bytes through an object-safe boundary.
- Preserve typed IO failures and portable diagnostic codes.

## What This Crate Does

`SourceTree::project` returns a canonical `Node`, or `None` when a path is
missing or replaced. A node keeps both its lexical kind and its target kind,
so an entry replaced by a symlink is dropped while an explicit root alias
remains valid. `children` returns lexical child kinds. `read` returns
bytes. Paths are private source-tree paths; public catalogue JSON uses
repository-relative metadata instead.

`SourceError` retains the source operation, path, and original IO error.
Discovery treats `ENOENT` and `ENOTDIR` as benign races. Other failures keep
an error code, with `unknown` as the fallback. A Git adapter never follows a
symbolic-link blob as a regular source file.

The working-tree adapter lives in `mokly-catalogue::working_tree`. Consumers
inject it as `Arc<dyn SourceTree>`. The Git adapter belongs to the Git source
boundary and supplies the same operations over commit trees.

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

- [Tree trait and node types](./src/tree.rs).
- [Error contract](./src/error.rs).

### Related Docs

- [Root discovery](../../docs/protocol/mokly-root-discovery.md).
- [Source protection](../../docs/protocol/mokly-source-protection.md).
- [Rust architecture](../../docs/architecture/rust-core.md).
