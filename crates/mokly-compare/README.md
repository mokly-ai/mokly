# mokly-compare

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-compare` prepares the base side of Mokly Changes. Use its traits to
read historical sources, lease an extracted commit, and select dependencies
for a sidecar bundle. `mokly-git` owns Git IO. `mokly-platform` owns locks
and process groups. `mokly-sidecar` owns the bundle settings type.

## Responsibilities

- Read regular base files from Git blobs with preserved POSIX paths.
- Extract JavaScript sources only when a caller requests them.
- Store source and dependency caches outside the repository.
- Bound cache bytes, retain active leases, and evict the least used entries.
- Compare all package manifests and lockfiles before dependency selection.
- Install base dependencies with scripts disabled, a deadline, and a size bound.
- Return bundle settings and a configuration warning when an install fails.

## What This Crate Does

`GitSources` lists regular files below exact configured roots. It keeps the
commit fixed. The catalogue applies its roots, globs, and source rules to
these files. HTML reads require no extraction or package manager.

`SystemLocations` hashes the canonical repository path under the operating
system's cache directory. `DiskCache` has separate source and dependency
byte bounds. It uses OS locks for namespace mutation and entry leases. A
receipt records completion, an access sequence, bytes, and a full tree
digest. A hit verifies that digest. Deleting the cache permits a rebuild.
The CLI shares one `OnceReporter` across both namespaces and uses
`plain_line` for the exact cache announcement.

`SourceInputs` reads dependency inputs from base blobs.
`SystemWorkingInputs` reads their working-tree counterparts. `DependencyTiers`
uses the working installation when both sets are equal. Different inputs use
npm's locked install in the dependency cache. The key includes the exact
lockfiles, manifests, and installed npm version. Local file dependencies and workspaces also
include the immutable source identity. Unsupported managers and failed,
expired, or oversized installs use the working installation with a typed
`base-dependencies` warning. Cancellation propagates without a warning.

The caller retains the source and dependency leases until its sidecar has
finished using their directories. `Resolved` returns the primary
`node_modules` path and the complete `ModuleResolution` value. Supply
repository-relative package roots in the request; the result names absolute
roots from the selected installation and keeps the other settings.

## Quick Start

```bash
cargo test -p mokly-compare
cargo test -p mokly-compare --test dependencies_tests
```

Compose the host adapters at the CLI boundary. Consume `dyn Sources`,
`dyn Extraction`, `dyn Dependencies`, and `dyn Cache` in the render graph
and comparison coordinator. Call `InputReader::read` on `GitSources` and
`WorkingInputs::read` on the current repository before dependency selection.
Pass one cancellation token to the caches, Git runner, and install supervisor.

## Development

```bash
cargo clippy -p mokly-compare --all-targets -- -D warnings
```

Unit tests use `unimock` for IO, processes, and clocks. Integration tests use
isolated Git repositories, OS locks, and a local `file:` npm package. The
fixture enables npm's offline mode and checks that lifecycle scripts did not
run. It needs no registry.

### Key Code

- [Source reader](./src/sources.rs) and [extraction](./src/extraction.rs).
- [Cache coordinator](./src/cache.rs), [storage](./src/storage.rs), and
  [OS locations](./src/locations.rs).
- [Dependency inputs](./src/inputs.rs), [tiers](./src/dependencies.rs), and
  [command supervision](./src/commands.rs).

### Related Docs

- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
- [Comparison](../../docs/protocol/mokly-comparison.md#sides).
- [Git runtime](../../docs/protocol/mokly-git.md).
- [Rust architecture](../../docs/architecture/rust-core.md).

Consumers enable the `mock` feature to use every public trait with unimock.
