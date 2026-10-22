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
- Read checkout-converted base files with preserved POSIX paths.
- Extract JavaScript sources only when a caller requests them.
- Store source and dependency caches outside the repository.
- Bound cache bytes, retain active leases, and evict the least used entries.
- Compare all package manifests and lockfiles before dependency selection.
- Install base dependencies with scripts disabled by default, a deadline, and a
  size bound. The working-tree configuration or CLI can opt into scripts.
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
these files. HTML reads require no extraction or package manager. Conversion failures become
`SourceError::Unavailable` and `base-conversion` warnings. The resource memo
keeps unavailable bytes distinct from missing paths. Independent resources can
still prove changes. Partial source extraction leases have no durable receipt.
Their staging data is removed when the lease ends. Source keys include effective
checkout settings. External filters get a new source key for each preparation.
HTML-only comparison uses working dependencies for package stylesheets on both
sides. The CLI compares dependency identities through Git and emits
`base-dependencies` when governing inputs differ, including a package-only upgrade.
`dependency_paths::governing` selects manifests and lockfiles beside the
head's used dependency directories and their repository ancestors. The
`read_paths` methods on `InputReader` and `WorkingInputs` read only those
paths. They preserve Git clean identities without repository inventories.
An HTML comparison uses its head generation's completed dependency inventory.
With no used dependency directory, it reads no dependency inputs.

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

`SourceInputs` reads dependency inputs from converted base blobs.
`SystemWorkingInputs` gets tracked and nonignored candidates through Git and
compares clean object identities. It reuses base bytes for equal inputs. `DependencyTiers`
uses working third-party dependencies when both sets are equal. In every tier,
the sidecar maps resolved repository-owned paths into that side's sources.
Different inputs use
locked npm, pnpm 10 through 12, Yarn Classic 1, or Yarn Berry 4 node-modules installs at
configuration and package-root ancestors in the dependency cache. They share one deadline. Successful installs
remove their private download caches before publication. Every manager may
download from the registry that the base and user configuration select, as
npm does, with that configuration's credentials. Scripts, pnpmfile hooks, Git
transports, and Corepack downloads stay off, and Yarn Berry Git and GitHub
sources fall back. Managers use installed executables or cached Corepack shims and check
exact `packageManager` pins. Yarn Plug'n'Play retains a specific fallback reason. The key includes the exact
lockfiles, manifests, manager configurations, manager families, and actual versions. Local file dependencies and workspaces also
include the immutable source identity. Unsupported managers and failed,
expired, or oversized installs use the working installation with a typed
`base-dependencies` warning. Cancellation propagates without a warning.

Yarn planning collects repository ancestor settings. Berry uses the nearest
linker setting and rejects the existing restricted keys anywhere in that chain.
It checks catalog and package-extension ranges like manifest specifications,
and it requires the `npm:` default protocol.
Classic reads its project and user configuration. Command-line flags and
environment settings fix its folders, mirror, and lock file inside the private
entry, and a confined committed mirror stays in use. Each install starts from
an allowed list of environment variables — paths, proxies, certificates,
process-start names, and the names that Mokly fixes — and Mokly removes every
other inherited variable, so no base configuration can read an inherited
secret such as `MOKLY_TOKEN` or `GITHUB_TOKEN`. Yarn Berry also reads no
project environment file.

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
Affected Usage links resolve each evidence entry from its own side. They keep
current variants through accepted moves and retain selected historical variants.
Canonical impact groups stay at the consumer level. A different entry kind
at an old path supplies no destination. Each link's destination is the entry
whose views its evidence names, and that entry's own detail names the changed
component and can compare, so a variant does not borrow its parent's. A link
to an Added view is marked ineligible and opens Current without a comparison
request because that view has no base side.
Eligibility follows the displayed scheme, including Light fallback when the
destination has no Dark view.

`Engine` implements `dyn Comparison` over two `dyn RenderGeneration` handles.
Its timing spans count final view states without recording source data.
It validates and captures the base through one ordered collector. Each base
view supplies its validated document and closure without a second render.
Base preparation passes that result to `Comparison::compare_prepared`.
An uncaptured fallback also uses that entry point, so a summary that exceeds
the capture bound does not start another pass.
Private compressed
inputs preserve exact document bytes, generated CSS, and trusted annotations.
The validation timing includes streamed encoding. Document, closure, and
encoding spans retain their separate measurements under that validation span.
They contain no source data or error payloads.
Capture schedules bounded batches on the generation's existing render workers.
Each batch contains at most one transient input per worker. It releases each
parsed input after encoding and retains results in authored route order.
Before each view starts and before each encoding, capture checks cancellation.
Queued cancelled inputs return the generation's error without starting work.
Every generated route that fits retains its digest. Usage, links, resources,
and component metadata stay Rust values, so valid deep props need no recursive
JSON decode.
`DEFAULT_BASE_CAPTURE_BYTES` sets a 256 MiB retention budget. It charges encoded
payloads, Rust metadata, closures, route keys, and conservative map overhead.
The collector accounts for each batch's growing summary storage before
retaining its inputs. Later kept candidates yield space to summary and generated-resource charges.
Final retention uses the original charges in route order. A partial capture
can use fallback sooner when final summary storage removes candidate space.
Inputs that do not fit read from the pinned source. Head reads use the original
bounded render cache and render again on the head root after eviction. Source
switches stay constant while the base capture fits; fallback can add switches.
Move pairing, view comparison, and snapshot reads restore one base view at a time.
Each result holds at most one base capture. It writes no files and retains no
parsed page set. The API supports capture reuse, which tests exercise;
production callers supply fresh bases. Serve can hold an accepted capture while
building its replacement, so two captures can overlap. The separate 256 MiB
render cache and the sidecar pool keep their own bounds.
The static build's captured source forwards opaque asset streams and membership
checks to its pinned source.
Rendered-tree walks implemented by this crate, canonical equality, move
fingerprinting, and canonical-value release use explicit stacks. CSS selector
matching runs in `mokly-css` under its own contract.
Both sides retain trusted sidecar style owners. Owned rule sets are normalized
and deduplicated. Candidate component moves map their source owner identity
before testing style equality. Authored owner attributes supply no trusted proof.
Owned rules enter the same catalogue-wide evidence reducer as linked and
ownerless head CSS. Equal rule identities join across document routes and
owner sets. Physical containment claims matches for every CSS source. Owned
rules use supplier ancestry only for nested filtering, preserving a supplier's
own rule without preventing a receiver from styling supplied content.
Self-nested copies keep their matches. Each source uses matched, unresolved,
or excluded records.
Physical and supplier ancestry use separate shared paths. Each instance key
retains one supplier path. Linked and ownerless proof retain only physical
ancestry; owned proof also retains a shared supplier path.
The engine transfers observations into catalogue attribution without cloning them.
Exact owned-instance proof uses the same unfiltered own-page sets after the
catalogue pass, and retains only paired instances with unchanged caller inputs.
Own render, resource, and rule impact share one unchanged-input check. Saved
prop edits retain their view records without marking unchanged consumers affected.
Own CSS states and dependency reasons use kept own-page source proof.
Details can retain a nested component record without promoting its source to
an own-page dependency reason.
It releases parsed documents after collecting canonical and containment proof.
The retained result holds a bounded base capture over its pinned source, the
original cached head generation, view states, reasons, ownership
records, and immutable historical metadata. Resource facts and byte proofs
are reused per route; public resource bytes and stylesheet diffs have explicit
cache bounds. Opaque resources compare SHA-256 digests; oversized blobs and
working files are streamed without retaining their bytes. Remaining source
budgets make Changes unavailable with the path and limit. Actual-instance implementation reasons preserve own view states. Removed previews read the same
pinned base generation. `Lookup` indexes kind-aware, case-folded identities once per projection batch.
It resolves explicit before/after references,
accepted moves, removed records, counterparts, and variant parents.
`projection_reference::References` uses this lookup for original metadata and
current or retained destinations. It owns no second identity index.
Affected usage groups a variant under its own resolved destination when its
original parent has none. Evidence keeps the original side's paths, and no
group links to a different-kind replacement at the parent's path.
Metadata comparison keeps schema, controls, and declared slots on the parent.
Variants compare their own metadata, props, and supplied slots independently.

Opaque Git asset delivery buffers one converted blob under the 64 MiB Git
limit and copies it to the destination. Digest cache misses stream checkout-
converted bytes into SHA-256. Delivery uses the same commit-pinned conversion
context and byte bounds. Hash-only preparation does not fill the source-byte LRU.

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
`projection_detail::apply_evidence` supplies included entry reasons and resource
evidence independently of workspace readiness for current and removed details.
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
isolated Git repositories, OS locks, and local packages. The Node tests in
`tests/static_base_managers.test.ts` run cold builds with pnpm and both Yarn
families from local archives. `tests/static_base_registry.test.ts` runs one
cold build per manager from a local registry that requires the user token.
Pinned test CLIs come from development dependencies, and no test uses the
internet. Tests cover script suppression, timing tiers, registry access,
comparison output, cache reuse, executable selection, and fallback reasons.
Fixture setup updates pnpm lockfiles explicitly, including after a manifest
change. `tests/static_base_manager_ci.test.ts` runs the four base-manager
files and `tests/static_cold_base_tiers.test.ts` with `CI=true` and
`GITHUB_ACTIONS=true`. This coverage runs in local and Testbox gates.

Registry rule ownership stays separate from delivery style groups. Both the
private capture codec and the head comparison retain these rule records.

### Key Code

- [Index projection](./src/projection_index.rs) and [workspace projection](./src/projection_workspace.rs).
- [Removed projection](./src/projection_removed.rs).
- [View attribution](./src/comparison_attribution.rs) applies the shared CSS reduction and exact instance proof.
- [Comparison](./src/comparison.rs), [result types](./src/comparison_types.rs), and [source validation](./src/source_validation.rs).
- [Source reader](./src/sources.rs), [Git tree](./src/git_tree.rs), and [base rendering](./src/base_render.rs).
- [Moves](./src/moves.rs), [branch-point lookup](./src/lookup.rs), and [removal snapshots](./src/snapshots.rs).
- [Extraction](./src/extraction.rs).
- [Cache coordinator](./src/cache.rs), [storage](./src/storage.rs), and
  [OS locations](./src/locations.rs).
- [Dependency inputs](./src/inputs.rs), [tiers](./src/dependencies.rs), and
  [command supervision](./src/commands.rs).
- [Manager plans](./src/manager_plan.rs), [versions](./src/manager.rs), and
  [install commands](./src/manager_command.rs), and
  [the install environment allowlist](./src/manager_environment.rs), and
  [local path confinement](./src/manager_local.rs), and
  [wrapped package specifications](./src/local_specifications.rs).
  [Berry configuration ranges](./src/manager_yarnrc.rs) check the catalog and
  package-extension settings.
  [Workspace patterns](./src/workspace_patterns.rs) confine every brace and
  `**` expansion in one linear pass.
  [Berry Git sources](./src/berry_sources.rs) detect the Git and GitHub ranges
  that fall back.
- [Lockfile source confinement](./src/manager_lockfiles.rs) checks each
  lockfile value from the folder its manager reads it from.
  [pnpm lockfile positions](./src/pnpm_lockfile.rs) give each pnpm value its
  importer or lockfile folder, and
  [Yarn Classic scalar inputs](./src/manager_classic.rs) read Classic tokens.
- [npm lockfile confinement](./src/npm_lockfiles.rs) checks package folders,
  link targets, and versions from the npm lockfile folder.

### Related Docs

- [Base preparation](../../docs/protocol/mokly-base-preparation.md) and
  [dependency installation](../../docs/protocol/mokly-base-dependencies.md).
- [Comparison](../../docs/protocol/mokly-comparison.md#sides).
- [Git runtime](../../docs/protocol/mokly-git.md).
- [Rust architecture](../../docs/architecture/rust-core.md).
