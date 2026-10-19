# mokly-compare

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-compare` classifies Mokly Changes from two rendered source trees. Use
its traits to prepare a Git base, compare annotated documents, attribute
component impact, and retain review v8 and change snapshot v4. Its base
preparation also leases extracted sources and selects sidecar dependencies. `mokly-git` owns Git IO. `mokly-platform` owns locks
and process groups. `mokly-sidecar` owns the bundle settings type.

## Responsibilities

- Project a commit-pinned `dyn SourceTree` with bounded batched blob reads.
- Compare canonical trees, paired ignores, caller inputs, and component regions.
- Pair moves, keep removed metadata, and resolve branch-point references.
- Compare reached resources and use catalogue-wide CSS own-page proof.
- Produce strict review v8, private snapshot v4, and affected-consumer chains.
- Share public index state, eligibility, workspace lists, and input-change projection.
- Read regular base files from Git blobs with preserved POSIX paths.
- Extract JavaScript sources only when a caller requests them.
- Store source and dependency caches outside the repository.
- Bound cache bytes, retain active leases, and evict the least used entries.
- Compare all package manifests and lockfiles before dependency selection.
- Install base dependencies with scripts disabled, a deadline, and a size bound.
- Return bundle settings and a configuration warning when an install fails.

## What This Crate Does

`GitSources::new` pins a commit and explicit file and metadata-node bounds.
It indexes configured roots and exact requested paths, retaining every tree
mode. `GitTree` implements `dyn SourceTree` over that index. Exact projections
use cached metadata and bounded path queries. Catalogue inventories and
planning inputs request generation-wide prefetch sets before reading bytes.
Reads retain a byte-bounded file LRU. A miss reads only its requested path;
Git IO holds no cache lock. Unrelated adjacent blobs are not prefetched.
Links and submodules supply no regular source bytes. It lists
regular files below exact configured roots and exposes batched blob reads.
Compose a reader and cancellation graph for each comparison generation. The catalogue applies its roots, globs, and source rules to
these files. HTML reads require no extraction or package manager.

`SystemLocations` hashes the canonical repository path under the operating
system's cache directory; Windows honors an absolute `LOCALAPPDATA` value. `DiskCache` has separate source and dependency
byte bounds. It uses OS locks for namespace mutation and entry leases. A
durable receipt records completion, an access sequence, and bytes. A hit
validates the receipt and recounts data size without hashing content or
flushing. Linux synchronizes new entries with one `syncfs`; macOS uses plain
`fsync` per data file, then a completion barrier. Windows flushes each file.
Eviction renames victims to trash under the namespace lock and deletes them
outside it. Walks check cancellation; later opens sweep interrupted trash.
Leases are shared. Builds hold only their entry lock, so another key can
complete while an install is pending. Deleting the cache permits a rebuild.
The CLI shares one `OnceReporter` across both namespaces and uses
`plain_line` for the exact cache announcement.

`SourceInputs` reads dependency inputs from base blobs.
`SystemWorkingInputs` gets tracked and nonignored candidates through Git and
compares clean object identities. It reuses base bytes for equal inputs. `DependencyTiers`
uses working third-party dependencies when both sets are equal. In every tier,
the sidecar maps resolved repository-owned paths into that side's sources.
Different inputs use
npm's locked install at the root, configuration ancestors, and each explicit package
root in the dependency cache. They share one deadline. Successful installs
remove their private npm download cache before publication. The key includes the exact
lockfiles, manifests, and installed npm version. Local file dependencies and workspaces also
include the immutable source identity. Unsupported managers and failed,
expired, or oversized installs use the working installation with a typed
`base-dependencies` warning. Cancellation propagates without a warning.

The caller retains the source and dependency leases until its sidecar has
finished using their directories. `Resolved` returns the primary
`node_modules` path, the complete `ModuleResolution` value, and typed
`repository_roots` for sidecar mapping. These roots include the working tree
and the base source copy for tier two. Supply
repository-relative package roots in the request; the result names absolute
roots from the selected installation and keeps the other settings. Ancestor
roots precede explicit roots in Node's order. Supply the head's observed
dependency directories in `Request.used_directories`. `ModuleResolution.dependency_root`
names the selected installation repository for per-importer bare imports. If a base
install lacks one of these directories, the result uses working dependencies
with a warning that names the missing directory. Repository-relative importer
directories also map when no package root explicitly lists them. A directory
outside this mapping keeps the fallback warning, including with equal inputs.
Each fallback has a typed trace reason.

`projection_removed::workspaces` initializes historical visual workspaces after
the caller proves base usage. Static output and Serve share this policy.

`Engine` implements `dyn Comparison` over two `dyn RenderGeneration` handles.
Rendered and canonical trees use iterative traversal, equality, move
fingerprinting, and release. Deep rendered trees need no enlarged thread stack.
Its timing spans count final view states and measure changed-path collection,
deduplication, and sorting without recording source data.
It validates and captures the base in one source-root pass. Private compressed
inputs preserve exact document bytes, generated CSS, and trusted annotations.
Before each view is read and encoded, capture checks the generation's
cancellation state and returns its error without processing a later view.
Every generated route that fits retains its digest. Usage, links, resources,
and component metadata stay Rust values, so valid deep props need no recursive
JSON decode.
`DEFAULT_BASE_CAPTURE_BYTES` sets a 256 MiB retention budget. It charges encoded
payloads, Rust metadata, closures, route keys, and conservative map overhead.
Inputs that do not fit read from the pinned source. Head reads use the original
bounded render cache and render again on the head root after eviction. Source
switches stay constant while the base capture fits; fallback can add switches.
Move pairing, view comparison, and snapshot reads restore one base view at a time.
Each result holds at most one base capture. It writes no files and retains no
parsed page set. The API supports capture reuse, which tests exercise;
production callers supply fresh bases. Serve can hold an accepted capture while
building its replacement, so two captures can overlap. The separate 256 MiB
render cache and the sidecar pool keep their own bounds.
Both sides retain trusted sidecar style owners. Owned rule sets are normalized
and deduplicated. Candidate component moves map their source owner identity
before testing style equality. Authored owner attributes supply no trusted proof.
It releases parsed documents after collecting canonical and containment proof.
The retained result holds a bounded base capture over its pinned source, the
original cached head generation, view states, reasons, ownership
records, and immutable historical metadata. Resource facts and byte proofs
are reused per route; public resource bytes and stylesheet diffs have explicit
cache bounds. Opaque resources compare SHA-256 digests; oversized blobs and
working files are streamed without retaining their bytes. Remaining source
budgets make Changes unavailable with the path and limit. Actual-instance implementation reasons preserve own view states. Removed previews read the same
pinned base generation. `Lookup` resolves explicit before/after references,
accepted moves, removed records, counterparts, and variant parents.
Metadata comparison keeps schema, controls, and declared slots on the parent.
Variants compare their own metadata, props, and supplied slots independently.

`GitBaseLookup` implements `dyn BaseLookup` and pins one repository, ref, and
merge base. Static commands retain that `PinnedBase` before current rendering.
`Changes` implements `dyn ChangesService` and reuses the pin when supplied. `BaseProvider` supplies the base
render generation through the common graph. HTML needs no extraction. A
JavaScript provider uses the same request's source and repository handles
for extraction and dependency leases. The CLI supplies `mokly-render::Runtime`
for both sides, sharing its render cache, sidecar pool, and cancellation.
Historical runtime failures follow the typed policy in base preparation.
`mokly-static` consumes the retained result and both graph handles to publish
one complete comparison. `projection_index::apply` projects the retained
classification onto current or historical public records. The index must be
from the same retained catalogue state, with every published record classified.
`projection_workspace::apply` joins ready usage with indexed affected links
and caller-owned input changes. Both Serve and static output use these
functions; neither changes the render bytes. An absent workspace stays absent
until the caller proves usage. `projection_removed` assembles historical records,
details with base usage, and typed preview metadata. Both hosts use its shared
workspace initializer for removed visual details. The static caller owns file inventory and identity;
the engine owns classification, removal selection, and historical snapshot IDs.

Compose the host adapters at the CLI boundary. Consume `dyn Sources`,
`dyn Extraction`, `dyn Dependencies`, and `dyn Cache` in the render graph
and comparison coordinator. Call `InputReader::read` on `GitSources` and
`WorkingInputs::read` on the same `dyn Repository`, with the base inputs,
before dependency selection.
Pass one cancellation token to the caches, Git runner, and install supervisor.

## Quick Start

```bash
cargo test -p mokly-compare
cargo test -p mokly-compare --test dependencies_tests
```

## Development

Consumers enable the `mock` feature to use every public trait with unimock.

```bash
cargo clippy -p mokly-compare --all-targets -- -D warnings
```

Unit tests use `unimock` for IO, processes, and clocks. Integration tests use
isolated Git repositories, OS locks, and a local `file:` npm package. The
fixture enables npm's offline mode and checks that lifecycle scripts did not
run. It needs no registry.

### Key Code

- [Index projection](./src/projection_index.rs) and [workspace projection](./src/projection_workspace.rs).
- [Removed projection](./src/projection_removed.rs).
- [Comparison](./src/comparison.rs), [result types](./src/comparison_types.rs), and [source validation](./src/source_validation.rs).
- [Source reader](./src/sources.rs), [Git tree](./src/git_tree.rs), and [base rendering](./src/base_render.rs).
- [Moves](./src/moves.rs), [branch-point lookup](./src/lookup.rs), and [removal snapshots](./src/snapshots.rs).
- [Extraction](./src/extraction.rs).
- [Cache coordinator](./src/cache.rs), [storage](./src/storage.rs), and
  [OS locations](./src/locations.rs).
- [Dependency inputs](./src/inputs.rs), [tiers](./src/dependencies.rs), and
  [command supervision](./src/commands.rs).

### Related Docs

- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
- [Comparison](../../docs/protocol/mokly-comparison.md#sides).
- [Git runtime](../../docs/protocol/mokly-git.md).
- [Rust architecture](../../docs/architecture/rust-core.md).
