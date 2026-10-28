# mokly-compare

`mokly-compare` classifies Mokly Changes from two rendered source trees. Use
its traits to prepare a Git base, compare annotated documents, attribute
component impact, and retain the review result and the change snapshot. Its
base preparation also leases extracted sources and selects sidecar
dependencies. `mokly-git` owns Git IO. `mokly-platform` owns locks and process
groups. `mokly-sidecar` owns the bundle settings type. `mokly-render` renders
both sides. `mokly-server` and `mokly-static` publish the retained result.

## Responsibilities

- Project a commit-pinned `dyn SourceTree` with bounded batched blob reads.
- Compare canonical trees, paired ignores, caller inputs, and component regions.
- Pair moves, keep removed metadata, and resolve branch-point references.
- Compare reached resources and use catalogue-wide CSS own-page proof.
- Produce the strict review result, the private change snapshot, and
  affected-consumer chains.
- Share public index state, eligibility, workspace lists, and input-change projection.
- Read checkout-converted base files with preserved POSIX paths.
- Extract JavaScript sources only when a caller requests them.
- Store source and dependency caches outside the repository.
- Bound cache bytes, retain active leases, and evict the least used entries.
- Compare all package manifests and lockfiles before dependency selection.
- Install base dependencies with scripts disabled by default, a deadline, and a
  size bound. The working-tree configuration or CLI can opt into scripts.
- Return bundle settings and a configuration warning when an install fails.

## What This Crate Does

`GitSources::new` pins a commit with explicit file and metadata-node bounds.
It indexes configured roots and exact requested paths and retains every tree
mode. `GitTree` implements `dyn SourceTree` over that index, so the catalogue
applies its roots, globs, and source rules to base files. Exact projections use
cached metadata and bounded path queries. Catalogue inventories and planning
inputs request generation-wide prefetch sets before reading bytes. Reads retain
a byte-bounded file LRU, and a miss reads only its requested path. Links and
submodules supply no regular source bytes. HTML reads need no extraction or
package manager. Conversion failures become `SourceError::Unavailable` and
`base-conversion` warnings. The resource memo keeps unavailable bytes distinct
from missing paths. The
[base preparation contract](../../docs/protocol/mokly-base-preparation.md)
owns the read bounds and the failure outcomes. Opaque Git assets use the same
commit-pinned conversion context and byte bounds. Hash-only preparation does
not fill the source-byte LRU.

`CachedExtraction` implements `dyn Extraction`. It extracts one commit into
the source cache only when JavaScript, a renderer module, or consumer PostCSS
needs files on disk. Its `review.base-extraction` span times the source key,
the cache lookup, and a build, and records `action`: `reuse` for a complete
entry and `extract` for a build. `DiskCache` keeps the source and dependency namespaces
under the directory that `SystemLocations` selects, with OS locks for
namespace mutation and entry leases. The
[base cache contract](../../docs/protocol/mokly-base-cache.md) owns the
location, the byte bounds, the receipts, the leases, and eviction. The CLI
shares one `OnceReporter` across both namespaces and uses `plain_line` for the
exact cache announcement.

`DependencyTiers` implements `dyn Dependencies`. `InputReader` and
`WorkingInputs` read manifests and lockfiles from the base blobs and from the
working tree, and compare their Git clean identities. Equal inputs use the
working third-party dependencies. Different inputs install locked npm, pnpm,
Yarn Classic, or Yarn Berry dependencies into the dependency cache. In every
tier, the sidecar maps resolved repository-owned paths into that side's
sources. The
[base dependencies contract](../../docs/protocol/mokly-base-dependencies.md)
owns the supported managers, registry access, the install environment,
lifecycle scripts, cache keys, and fallback reasons. `NodeExecutable` resolves
the shim-supplied Node or searches absolute `PATH` entries. The CLI uses the
same resolver for rendering and for the scripts-on runtime probe.

`Resolved` returns the primary `node_modules` path, the complete
`ModuleResolution` value, and typed `repository_roots` for sidecar mapping.
These roots include the working tree and the base source copy for tier two.
Supply repository-relative package roots in the request. The result names
absolute roots from the selected installation and keeps the other settings.
Ancestor roots precede explicit roots in Node's order. Supply the head's
observed dependency directories in `Request.used_directories`.
`ModuleResolution.dependency_root` names the selected installation repository
for per-importer bare imports. The caller retains the source and dependency
leases until its sidecar has finished using their directories.

HTML-only comparison follows the
[HTML package styles policy](../../docs/protocol/mokly-comparison.md#html-package-styles).
`dependency_paths::governing` selects the manifests and lockfiles beside the
head's used dependency directories and their repository ancestors. The
`read_paths` methods on `InputReader` and `WorkingInputs` read only those
paths.

`Engine` implements `dyn Comparison` over two `dyn RenderGeneration` handles.
`Comparison::capture_base` validates and captures the base through one ordered
collector. `Comparison::capture_head` uses the same collector for the build
head. Each view supplies its validated document and closure without a second
render. `Comparison::compare_prepared` classifies the prepared base and head.
An uncaptured fallback uses the source generation, so a summary that exceeds
the capture bound does not start another pass. The capture keeps exact document
bytes, generated CSS, and trusted annotations in compressed form. Inputs that
do not fit the capture budget read from their side's source. Serve head reads
use the bounded render cache and render again on the head root only after
cache eviction. Build head reads use the head capture. Each result holds at
most one base capture, and a build result also holds one head capture. The
[comparison serving contract](../../docs/protocol/mokly-comparison-serving.md)
owns the capture budget and its overlap with the render cache. Capture checks
cancellation before each view and each encoding. Its timing spans contain no
source data or error payloads.

The [comparison contract](../../docs/protocol/mokly-comparison.md) owns
materiality, style ownership, resources, and Changes membership. Both sides
retain trusted sidecar style owners. Authored owner attributes supply no
trusted proof. Owned rules enter the same catalogue-wide evidence reducer of
`mokly-css` as linked and ownerless head CSS, under the
[CSS attribution contract](../../docs/protocol/mokly-css-attribution.md).
Registry rule ownership stays separate from delivery style groups. Both the
private capture codec and the head comparison retain these rule records.
Saved prop edits retain their view records without marking unchanged
consumers affected. Own CSS states and dependency reasons use kept own-page
source proof. Actual-instance implementation reasons preserve own view states.
Removed previews read the same pinned base generation. Serve retains the
original cached head generation and one bounded base capture. Build retains the
captured head and the bounded base capture. Both
results keep view states, reasons, ownership records, and immutable historical
metadata.

`Lookup` indexes kind-aware, case-folded identities once per projection batch
under the [branch-point lookup contract](../../docs/protocol/mokly-branch-point-lookup.md).
It resolves explicit before and after references, accepted moves, removed
records, counterparts, and variant parents. Metadata comparison keeps schema,
controls, and declared slots on the parent. Variants compare their own
metadata, props, and supplied slots independently.

`GitBaseLookup` implements `dyn BaseLookup` and pins one repository, ref, and
merge base. Static commands retain that `PinnedBase` before current rendering.
`Changes` implements `dyn ChangesService` and reuses the pin when supplied.
The CLI implements `BaseProvider`, which supplies the base render generation
through the common graph. A JavaScript provider uses the same request's source
and repository handles for extraction and dependency leases. The CLI supplies
`mokly_render::runtime::Runtime` for both sides, sharing its render cache,
sidecar pool, and cancellation.

The projection functions publish one retained result, and neither Serve nor
`mokly-static` changes the render bytes. `projection_index::apply` projects the
classification onto current or historical public records of the same retained
catalogue state, with every published record classified, and names the base
commit. `projection_detail::apply_evidence` supplies included entry reasons,
each view's state, ignore ids, and resource evidence, and a current screen's or
component's base side, for current and removed details. These records carry
every public fact of the review result, which no file holds.
`projection_workspace::apply`
joins ready usage with indexed affected links and caller-owned input changes.
An absent workspace stays absent. An absent list stays absent until the caller
proves usage.
`projection_removed` assembles historical records, details with base usage,
and typed preview metadata. Its `workspaces` initializer prepares removed
visual details after the caller proves base usage. The static caller owns file
inventory and identity. The engine owns classification, removal selection, and
historical snapshot IDs.

Affected Usage links resolve each evidence entry from its own side. They keep
current variants through accepted moves and retain selected historical
variants. Each link's destination is the entry whose views its evidence names.
A variant groups under its own resolved destination when its original parent
has none, and no group links to a different-kind replacement at the parent's
path. The [Changes controls contract](../../docs/protocol/mokly-changes-controls.md)
owns link eligibility.

## Quick Start

Compose the host adapters at the CLI boundary. Consume `dyn Sources`,
`dyn Extraction`, `dyn Dependencies`, and `dyn Cache` in the render graph and
the comparison coordinator. Call `InputReader::read` on `GitSources` and
`WorkingInputs::read` on the same `dyn Repository`, with the base inputs,
before dependency selection. Pass one cancellation token to the caches, the
Git runner, and the install supervisor. Then run the crate tests:

```bash
cargo test -p mokly-compare
cargo test -p mokly-compare --test dependencies_tests
```

## Development

```bash
cargo clippy -p mokly-compare --all-targets -- -D warnings
```

Consumers enable the `mock` feature to use every public trait with unimock.
Unit tests use `unimock` for IO, processes, and clocks. Integration tests use
isolated Git repositories, OS locks, and local packages. Command tests pin
every manager's complete scripts-off argument list.

The Node tests in `tests/static_base_managers.test.ts` run cold builds with
pnpm and both Yarn families from local archives.
`tests/static_base_registry.test.ts` runs one cold build per manager from a
local registry that requires the user token. Pinned test CLIs come from
development dependencies, and no test uses the internet.
`tests/static_base_manager_ci.test.ts` runs the four base-manager files and
`tests/static_cold_base_tiers.test.ts` with `CI=true` and
`GITHUB_ACTIONS=true`. This coverage runs in local and Testbox gates.

### Key Code

- [`src/comparison_types.rs`](./src/comparison_types.rs) defines
  `Comparison`, `ComparisonRequest`, and `ComparisonResult`, the comparison
  boundary and its retained output.
- [`src/comparison.rs`](./src/comparison.rs) defines `Engine`, the one
  catalogue-wide comparison for build, Serve, and static projection.
- [`src/base_render.rs`](./src/base_render.rs) defines `ChangesService`,
  `Changes`, and `BaseProvider`, which pin the base, prepare its sources, and
  compare it with the head.
- [`src/base_selection.rs`](./src/base_selection.rs) defines `BaseLookup`,
  `GitBaseLookup`, and `PinnedBase`, the one pinned repository, ref, and merge
  base.
- [`src/sources.rs`](./src/sources.rs) and
  [`src/git_tree.rs`](./src/git_tree.rs) define `GitSources` and `GitTree`,
  the commit-pinned source reader and its `SourceTree` adapter.
- [`src/extraction.rs`](./src/extraction.rs) defines `Extraction` and
  `CachedExtraction`, the on-demand commit extraction.
- [`src/cache.rs`](./src/cache.rs) and
  [`src/locations.rs`](./src/locations.rs) define `DiskCache` and
  `SystemLocations`, the leased source and dependency caches.
- [`src/dependencies.rs`](./src/dependencies.rs) and
  [`src/dependency_types.rs`](./src/dependency_types.rs) define
  `Dependencies`, `DependencyTiers`, `Request`, and `Resolved`, the dependency
  tier selection.
- [`src/inputs.rs`](./src/inputs.rs) and
  [`src/working_inputs.rs`](./src/working_inputs.rs) define `InputReader` and
  `WorkingInputs`, the base and working dependency identities.
- [`src/manager_plan.rs`](./src/manager_plan.rs) selects every locked install
  root among the configuration directory, the package roots, and their
  ancestors, and returns each root with its package manager. The other
  `manager_*.rs` files hold the per-manager rules.
- [`src/lookup.rs`](./src/lookup.rs) and [`src/moves.rs`](./src/moves.rs)
  define `Lookup` and the move `Detector`.
- [`src/projection_index.rs`](./src/projection_index.rs),
  [`src/projection_detail.rs`](./src/projection_detail.rs),
  [`src/projection_workspace.rs`](./src/projection_workspace.rs), and
  [`src/projection_removed.rs`](./src/projection_removed.rs) hold the shared
  projections that Serve and static output call.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed failure of base
  preparation and its IO boundaries.

### Related Docs

- [Comparison](../../docs/protocol/mokly-comparison.md).
- [Comparison serving](../../docs/protocol/mokly-comparison-serving.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md),
  [base cache](../../docs/protocol/mokly-base-cache.md), and
  [dependency installation](../../docs/protocol/mokly-base-dependencies.md).
- [Package selection](../../docs/protocol/mokly-comparison-packages.md).
- [CSS change attribution](../../docs/protocol/mokly-css-attribution.md).
- [Moves](../../docs/protocol/mokly-moves.md) and
  [branch-point lookup](../../docs/protocol/mokly-branch-point-lookup.md).
- [Git runtime](../../docs/protocol/mokly-git.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
