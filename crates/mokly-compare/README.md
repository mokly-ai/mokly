# mokly-compare

`mokly-compare` classifies Mokly Changes from two rendered source trees. Use
its traits to prepare a Git base, compare annotated documents, attribute
component impact, and retain the review result and the change snapshot. Its
base preparation also leases extracted sources and selects sidecar
dependencies. `mokly-git` owns Git IO. `mokly-platform` owns locks and process
groups. `mokly-sidecar` owns the bundle settings type and the bundle store
boundary, which this crate implements. `mokly-render` renders both sides. `mokly-server` and `mokly-static` publish the retained result.

## Responsibilities

- Project a commit-pinned `dyn SourceTree` with bounded batched blob reads.
- Compare canonical trees, paired ignores, caller inputs, and component regions.
- Share the document work of an unmoved paired view whose base and head
  codec inputs are equal.
- Pair moves, keep removed metadata, and resolve branch-point references.
- Compare reached resources and use catalogue-wide CSS own-page proof.
- Reuse the proven view comparisons of one accepted Serve classification
  under a fixed byte bound.
- Produce the typed review result, the private change snapshot, and
  affected-consumer chains.
- Let a base provider keep one captured base between classifications, and
  compare a reuse through a reader with its own cancellation.
- Record the checkout and dependency evidence of a prepared base, and check
  whether that evidence is still current.
- Share public index state, eligibility, workspace lists, and input-change projection.
- Read checkout-converted base files with preserved POSIX paths.
- Extract JavaScript sources only when a caller requests them.
- Store source, dependency, bundle, and render caches outside the repository.
- Implement the sidecar's bundle store over the bounded `bundles` kind.
- Implement the render store of `mokly-graph` over the bounded render kind,
  with one writer outside the render path.
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
cached metadata and bounded path queries. `SourceTree::hint_projections` loads
the metadata of many exact paths with one query, and leaves out a path that has
a descendant in the set; a failed hint loads nothing, so each projection runs
its own query and keeps its own error. Catalogue inventories and planning
inputs request generation-wide prefetch sets before reading bytes. Reads retain
a byte-bounded file LRU, and a miss reads only its requested path. Links and
submodules supply no regular source bytes. HTML reads need no extraction or
package manager. `Sources::attach` gives `GitSources` a leased extraction of
the same commit: it lists the whole tree once, and later reads and digests use
the extracted files, with Git for each file that the extraction lacks or that
changed since its first fingerprint in the process. `GitSources::sharing` and
`GitSourceFactory` share one `dyn Snapshots`, `ProcessSnapshots` in the CLI,
which keeps the first fingerprints of each extraction for the process.
Conversion failures become `SourceError::Unavailable` and
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
entry and `extract` for a build. `Extraction::existing` and `Cache::lease`
lease a complete entry without a build, so base preparation can read an
earlier extraction before it knows whether the base needs one. `DiskCache` keeps the source, dependency, bundle, and
render namespaces under the directory that `SystemLocations` selects, with OS locks
for namespace mutation and entry leases. When `SystemLocations` checks that the
cache lies outside the repository, it compares both paths in one form,
without a Windows verbatim drive or network prefix. The
[base cache contract](../../docs/protocol/mokly-base-cache.md) owns the
location, the byte bounds, the receipts, the leases, and eviction. The CLI
shares one cache announcement across the namespaces that it opens. `build`
and `publish` share it through one `OnceReporter`. The CLI uses `plain_line`
for the exact cache announcement.

`CachedBundles` implements the `BundleStore` of `mokly-sidecar` over a
`dyn BundleCache`. `CachedBundles::new` takes that cache and the running Mokly
version, and `settings_key` gives the entry key of one set of bundle settings.
`DiskCache` implements `BundleCache` for the `bundles` kind of the same
namespace. Each entry streams as one file through `BundleInput` and
`RawEntry`, with bounded receipt and inventory values. The codec writes a
versioned header line and a typed payload, hashes the payload while it
streams, and checks the size of the whole file and of the exact
`restoreGeneration` request against their limits. The payload can keep the
optional plan of the compilation beside the recipe. When the file with the
plan would pass its limit, the codec writes the entry without the plan. A
`load` hit attaches a stored plan through `DurableRecipe::with_plan`, which
drops a plan above the record bound. The inventory, storage, and
receipt code confines every path, bounds each scan, writes durable receipts,
and draws the publication nonce. Each bundle receipt also holds
`runtimeDigest`, the 32-byte SHA-256 digest of the runtime key of its
compilation. `BundleCache::replace` takes that digest for the new receipt, and
access-order updates keep the digest and the nonce. Source and dependency
receipts hold neither field. `save` takes a `DurableRecipe`, and a `load` hit
returns one. Before `save` encodes a recipe,
`BundleCache::compilation` reads only the receipt of the entry, with one
nonblocking shared stripe attempt, through `Storage::bundle_compilation`. An
equal digest returns `Unchanged`, and a held stripe skips the write. In every
other case, `save` replaces the entry. A damaged or unreadable receipt makes
the result `WriteOutcome::EntryFault`, which adds that entry fault to the
effects of the write. A `load` hit also checks that the receipt digest matches
the decoded recipe, or it rejects the entry as damaged. A payload whose recipe
lacks captured and durable reuse evidence, or carries the `uncaptured` marker,
is damaged too, because the decoder accepts only a `DurableRecipe`. The CLI
adds this store to the sidecar pool of each command when `SystemLocations`
gives a cache location. The
[bundle cache contract](../../docs/protocol/mokly-base-cache.md#bundle-entries)
owns the entry format, the fault classes, the locks, and the bound.

`RenderDisk` implements `SegmentCache` over the `renders` kind of the same
namespace. It shares the receipts, the durable publication, the stripes, and
the eviction of the bundle kind, under its own fixed bound,
`render_store::CAPACITY`. `CachedDocuments` implements `DocumentBackend` over
it. Each entry is one segment of at most 64 documents and 2 MiB, keyed by the
digest of its bytes. A process inventories the kind once, checks each whole
segment, and indexes at most 16,384 documents, from the most recently used
segment down. Each read then checks the identity of its segment and the digest
of its document. An access counter under the namespace lock orders the
segments, so a read scans no entries. Only a segment publication scans the
kind, to make room under the bound.
`DocumentWriter` implements the `DocumentStore` of `mokly-graph`. It admits
only keys, under the bounds of `WriterLimits`. `DocumentWriter::activity` gives
the `WriteActivity` whose leases Serve work holds while it runs, and
`DocumentWriter::bind_readiness` takes the `WriteReadiness` of the current
Changes result. Its one writer thread starts a new export or save only while
that readiness holds and no lease is held, and work that already started
finishes. Each batch builds its segment in place in one `SegmentBuffer`, whose
fixed capacity with its owner stays within 4 MiB inside the workspace of the
render cache, and saves the `BuiltSegment` through the unchanged storage path.
The state records carry the known capacities and the charges of the writer's
buffers in `StoreMemory`.
`DocumentWriter::prepared` starts that thread with its writes paused. The
thread first prepares the native identity of its `Startup` and the index, and
`resume` then releases the writes. `ImageIdentity` reads the identity once
through `SystemImage`. On Linux, it digests the embedded build nonce and the
running image through `/proc/self/exe`, and it gives no identity when the image
changes during the read. On other targets, it digests the nonce alone.
The [render store contract](../../docs/protocol/mokly-render-store.md) owns the
identity, the read rules, the entry format, the fault classes, and the bound.

`entry_lock_path` in `cache_lock.rs` maps each kind and key to its lock file in
one place. The bundle and render kinds use 256 fixed stripes, selected by the
first byte of the key. The source and dependency kinds keep one lock file for
each key, because their callers wait for locks and hold long leases. A shared
stripe there could make a build wait for an unrelated lease, or for its own. The
stripe layout is fixed for the `bundles` and `renders` directories, because
every release must use the same lock file for an entry. A later layout needs a
new directory.

`DependencyTiers` implements `dyn Dependencies`. `InputReader` and
`WorkingInputs` read manifests and lockfiles from the base blobs and from the
working tree, and compare their Git clean identities. Equal inputs use the
working third-party dependencies. Different inputs install locked npm, pnpm,
Yarn Classic, or Yarn Berry dependencies into the dependency cache. In every
tier, the sidecar maps resolved repository-owned paths into that side's
sources. The
[base dependencies contract](../../docs/protocol/mokly-base-dependencies.md)
owns the supported managers, registry access, lifecycle scripts, cache keys,
and fallback reasons. The
[base install processes contract](../../docs/protocol/mokly-base-install-processes.md)
owns the install environment, the manager executables, the bounds, and the
stops. `NodeExecutable` resolves the shim-supplied Node or searches absolute
`PATH` entries. The CLI uses the same resolver for rendering and for the
scripts-on runtime probe.

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
bytes, generated CSS, and trusted annotations in compressed form. Its collector
gives the graph workers a `ComparisonEncoder` through
`ComparisonCollector::encoder`. So each worker encodes its view with
`mokly_graph::document_codec::EncodedView`, the codec that the compact tier of
the render cache also uses. The encoder calls `EncodedView::encode_identified`,
so each view also gets the 32-byte identity of its codec input.
`ComparisonCollector::remaining` gives the bytes that the capture bound has
left for the views that wait for their turn. Each waiting view and each kept
view holds its identity, and the capture budget charges it. The render cache
keeps no identity. Inputs that do not fit the capture budget, and kept views
that fail to restore, read from their side's source.
A usage read of a kept view returns its retained usage without a restore, so
it needs no source fallback. Serve head reads use the bounded render cache and
render again on the head root only when neither cache tier holds the document.
Build head reads use the head capture. Each result holds at most one base
capture, and a build result also holds one head capture. A result that reuses
a kept base reads that capture and adds no second base capture. The
[comparison serving contract](../../docs/protocol/mokly-comparison-serving.md)
owns the capture budget and its overlap with the render cache. Capture checks
cancellation before each view and each encoding. Its timing spans contain no
source data or error payloads.

`compare_prepared` streams the views of all entry pairs, in pairing and view
order, through the base generation's `schedule_comparison_stream`. Each started
view keeps its inputs in a comparison-owned slot. At most twice
`comparison_parallelism().max(1)` views are started and not yet consumed by the
ordered pass. The calling thread completes each view in entry and view order
and then releases its inputs. Each completion lets one more view start.

A task reads the head side and the base input that
`retained_comparison_input` returns. It makes no base source read and no base
sidecar call. The base capture answers that lookup from its kept views. A kept
view that fails to restore returns a deferred source read, so classification
restores it once. The reader of a kept base checks its own cancellation, then
forwards the lookup to the kept capture. Through that reader, a failed restore
returns no retained input, and the ordered pass reads the view through the
reader, with its cancellation and failure checks.

`Pairing::preserves_document_paths` holds when no entry moved and every
paired entry keeps its exact path spelling. Then a paired view whose two
routes are equal asks the base for `retained_document_evidence` before any
restore. The reader of a kept base checks its own cancellation before it
forwards this request too. The task reads the checked head document once and
hashes it with `EncodedView::comparison_identity`. An equal identity proves
equal bytes, trees, annotations, and retained metadata. This codec identity
differs from the `comparison_identity` proofs of view comparison reuse, which
a prepared generation derives from plan keys.

With an equal identity, the view uses the head document for both sides, with
the base's own kept closure, and restores no base document. It builds one
matching tree and skips the canonical and in-document style comparisons,
because equal inputs give no difference. Usage that is not ready still gives
conservative input signals. Both sides' closures, every resource comparison,
the recorded proof reads, and the memo calls stay as in a full comparison.
Without equal evidence, the task restores the retained base input.

A view with a base route whose input is deferred or not retained gets all
of its reads in the ordered pass, after every earlier view. An ordered failure
stops new views, and the comparison waits for the views that already started.
The comparison checks both generations for cancellation before each task and
each ordered view. Results, warnings, the first error, `resource_work`, and the
parsed CSS cache counts do not depend on the worker count.

`MemoryComparisons` implements `dyn ComparisonReuse` for one Serve process.
`MemoryComparisons::new` takes the fixed byte bound. `begin` takes an
`Engine` and an optional `ReuseFence` of the adopted settings, and returns a
`dyn ReuseAttempt`. `Changes` calls the attempt as its `dyn Comparison`.
Without a fence, the attempt reuses and keeps nothing. Admission finds the
kept view of each route. The worker of that view then checks its read set
before preparation, through `comparison_identity` and the checked head
document proof, with no base source read. Complete head validation supplies
that proof when it read the document or adopted its kept checks, and
`comparison_document_proof` supplies it otherwise. A proven view skips
preparation and takes its current head usage from that proof. The ordered
pass adds its shared evidence, its warnings, and the current usage of both
sides. Call
`ReuseAttempt::accept` after the Ready publication and `discard` after a
failure. `ReuseWork` returns the work and the charges of the timing span. The
[reuse rules](../../docs/protocol/mokly-comparison-serving.md#view-comparison-reuse)
own the admission, the invalidation, and the bound.

The [comparison contract](../../docs/protocol/mokly-comparison.md) owns
materiality, style ownership, resources, and Changes membership. Both sides
retain trusted sidecar style owners. Authored owner attributes supply no
trusted proof. Owned rules enter the same catalogue-wide evidence reducer of
`mokly-css` as linked and ownerless head CSS, under the
[CSS attribution contract](../../docs/protocol/mokly-css-attribution.md).
Registry rule ownership stays separate from delivery style groups. Both the
shared document codec and the head comparison retain these rule records.
The head comparison names each viewer face by its artifact path on both
sides, so a Markdown document that moves to another depth, and with it its
relative face address, changes no rule.
Saved prop edits retain their view records without marking unchanged
consumers affected. Own CSS states and dependency reasons use kept own-page
source proof. Actual-instance implementation reasons preserve own view states.
Removed previews read the same pinned base generation, through the reader when
the result reuses a kept base. Serve retains the original cached head
generation and one bounded base capture, its own or a kept one. Build retains
the captured head and the bounded base capture. Both
results keep view states, reasons, ownership records, and immutable historical
metadata.

`Lookup` borrows one comparison's catalogues and indexes kind-aware,
case-folded identities once per projection batch
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
sidecar pool, and cancellation. `BaseRequest::source_request` gives the
source-only `BaseSourcesRequest`, which carries no head. So a provider can
start source work as soon as the working configuration validates.
A fresh preparation first asks `BaseProvider::historical_sources`, after the
kept-base lookup misses. A
provider that adopts a pending preparation returns its source readers there.
The default returns `None`, and `Changes` creates the sources itself.

`BaseProvider` can also keep one captured base between classifications. After
the pin and before any base read, `Changes` calls `BaseProvider::find_kept`
with a `BaseRetentionRequest`: the `PinnedBase`, the working configuration,
the head, and the effective install-scripts setting. A hit returns a
`BaseReuse`, and `Changes` compares through a per-classification reader. It
prepares and captures no base. A miss prepares and captures a fresh base, and
offers it to `BaseProvider::keep` as a `KeptBase` with its source-failure
record, its scripts-off flag, and its freshness evidence. When `keep` returns a
`BaseReuse`, that classification also compares through a reader. The reader
checks the reuse's own cancellation before each call. Its first failed read,
while that cancellation is not set, releases that exact `KeptBase` through
the `BaseRelease` of the reuse. The reader keeps only its `BaseReuse`, not the
provider. A reused base that fails this way gets one fresh preparation in the
same classification. A reused base with a recorded source failure is
released, and the classification fails with `Error::Base`. A head
failure or a cancelled reader keeps the base. `review.base-tree` records
`action`, `reuse` or `prepare`. The default methods keep nothing, so `build`,
`publish`, and a provider without retention prepare and capture the base in
each classification. The
[Serve base lifetime rule](../../docs/protocol/mokly-base-preparation.md#serve-base-lifetime)
owns what a provider may keep, the freshness checks, and the release events.

Only a provider that can keep a base records freshness evidence while it
prepares one. In the CLI, only the Serve provider has a `Freshness`, so `build`
and `publish` take no checkout sample and record no evidence. The Serve
provider records none after a dependency fallback that a later attempt can
fix. It also records none when the checkout sample or `Freshness::record`
fails for a reason other than cancellation, and that preparation continues. A
cancellation stops the preparation.

`Freshness::record` returns `PreparationInputs` with the checkout sample that
the provider took before its first base read, and the `DependencySelection` of
working manifests, lockfiles, and dependency directories. A base that reads
the working install also records the install state of each working
`node_modules` root and the installed-module digests of its bundle. A tier-two
base reads its own install, so it passes no working roots. `record` returns
`None` when a file has a `filter` attribute or the install state of a root is
not available.

A provider must not keep a base without evidence. `PreparedBase` and
`KeptBase` carry the evidence of the preparation unchanged.
`Freshness::current` says whether that evidence still holds for the current
checkout identity, dependency directories, working inputs, install records,
and head bundle. The
[freshness checks rule](../../docs/protocol/mokly-base-preparation.md#freshness-checks)
owns what the checks cover and what they miss.

`Changes` announces each comparison `Step` through its `dyn Steps` as the step
starts, so a command can name the running step on its progress line. It
announces reading and comparing, and the base provider announces rendering.
`CachedExtraction` and `DependencyTiers` each take a required `dyn Steps`.
`CachedExtraction` announces extracting when a source build starts.
`DependencyTiers` announces installing when a dependency build starts. A
complete entry announces nothing.

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
It reads base usage through `RenderGeneration::comparison_usage`, so a kept
base view needs no document restore. The reader of a kept base checks its own
cancellation, then forwards this read to the kept capture. When the forwarded
read fails or returns no usage, the reader falls back to its own checked
`comparison_document`, with its failure checks and its release of an owned
failure. An absent workspace stays absent. An absent list stays absent until
the caller proves usage.
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
Git runner, and the install supervisor of one preparation. A provider that
keeps a base detaches it from that token in `keep`. It gives each `BaseReuse`
its own token and a `BaseRelease` that holds no preparation service and no
status callback. Then run the crate tests:

```bash
cargo test -p mokly-compare
cargo test -p mokly-compare --test dependencies_tests
```

## Development

```bash
cargo clippy -p mokly-compare --all-targets -- -D warnings
cargo test -p mokly-compare --test pnpm_modules_purge_tests
```

Consumers enable the `mock` feature to use every public trait with unimock.
Unit tests use `unimock` for IO, processes, and clocks. Integration tests use
isolated Git repositories, OS locks, and local packages. Command tests pin
every manager's complete scripts-off argument list.

The `dependencies_tests` and `package_roots_tests` fixtures copy npm
lockfiles from `tests/fixtures/`. To refresh a lockfile, use the test's
manifest and local dependency files with
`npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`.

On Unix, `tests/pnpm_modules_purge_tests.rs` installs the dependencies of a
base commit that tracks a pnpm `node_modules` state, which pnpm must recreate.
It runs the pinned pnpm 10.34.7, 11.20.0, and 12.14.0 CLIs from the
repository's development dependencies, with and without `CI` and
`GITHUB_ACTIONS` in the parent environment. The cases for one pnpm version
read the same Git commit and use separate extraction and install caches.
Two cases run at a time. Run `npm ci` at the repository root before you run
the crate tests. The test fails when a pinned CLI is missing.

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
- [`src/comparison_preparation.rs`](./src/comparison_preparation.rs) defines
  `Preparation`, which reads the inputs of one paired view. It admits an equal
  document through the base's retained evidence. The private
  `comparison_documents` and `equal_material` modules build the shared
  matching tree and the material of that view.
- [`src/comparison_reuse.rs`](./src/comparison_reuse.rs) defines
  `ComparisonReuse`, `ReuseAttempt`, `MemoryComparisons`, `ReuseFence`, and
  `ReuseWork`, the bounded view comparison reuse of Serve. The private
  `reuse_*.rs` modules record proof reads, charge the bound, and collect the
  candidate.
- [`src/validation_head.rs`](./src/validation_head.rs) defines the private
  `Head`, the `HeadValidation` of one Serve reuse attempt. `Engine` passes it
  to `RenderGeneration::validate_head` before pairing, and it calls
  `render_all` when it has no reuse collection. `Head` checks each head
  document once. It validates a view without a document read only when the
  document key and the policy identity are equal, every link-target read of
  its fragment links and then every recorded walk read are equal in order,
  and the generation adopts the kept document checks. That view takes its
  anchors, links, warnings, and usage from its kept outputs. Any other view
  takes its checked read. Its closure facts are still proven when the key, the
  policy identity, the document checks, and every walk read are equal.
  Otherwise it replays the background walk of the same generation, or records
  a new walk. Each view keeps its proof, with usage, for the view stream.
  Facts never depend on pairing. The private `validation_*.rs` modules keep
  the facts, the kept outputs, and their reads.
- [`src/reuse_optional.rs`](./src/reuse_optional.rs) defines the private
  `Arena`, the optional store of the facts and kept outputs of one
  classification inside the comparison bound. The bound clears every optional
  arena before it refuses a comparison charge, so facts and kept outputs never
  displace kept comparisons.
- [`src/base_render.rs`](./src/base_render.rs) defines `ChangesService`,
  `Changes`, `BaseProvider`, `PreparedBase`, and `BasePreparationError`, which
  pin the base, prepare its sources, report whether its tier-two install ran
  with lifecycle scripts off, carry its freshness evidence, and compare it with
  the head. The default `BaseProvider::find_kept`, `keep`, and `release`
  methods keep nothing. `PreparedBase::prefetch` holds the `PrefetchGuard` of
  the early renders of a fresh base. `BaseProvider::historical_sources` lets a
  provider adopt pending source readers.
- [`src/base_sources.rs`](./src/base_sources.rs) defines
  `BaseSourcesRequest`, the inputs of base source work that need no head
  generation, and `BaseRequest::source_request`.
- [`src/base_retention.rs`](./src/base_retention.rs) defines
  `BaseRetentionRequest`, `KeptBase`, `BaseReuse`, and `BaseRelease`: the
  inputs of the kept base's key and freshness checks, the kept capture with
  its source-failure record, scripts-off flag, and freshness evidence, one
  classification's access to it with its own cancellation, and the
  release-only capability that frees that exact base.
- [`src/base_freshness.rs`](./src/base_freshness.rs) defines `Freshness`,
  `FreshnessChecks`, `PreparationInputs`, `DependencySelection`,
  `FreshnessRequest`, and `InstallInputs`: the evidence of one preparation and
  the check that says whether a kept base is still current.
- [`src/install_inputs.rs`](./src/install_inputs.rs) defines
  `SystemInstallInputs`, the host reader that digests the install records and
  the package entries of one working `node_modules` root, without package
  file contents.
- [`src/base_classification.rs`](./src/base_classification.rs) holds the
  classification path of `Changes`: one kept base or one fresh capture, the
  `review.base-tree` action, and the single fresh preparation after a failed
  reuse. Each fresh preparation takes the provider's historical sources when
  it has them. It holds the `PrefetchGuard` of a fresh base until the capture
  of that base returns, so each exit stops its early renders and waits for them.
- [`src/base_reader.rs`](./src/base_reader.rs) defines `BaseReader`, the
  per-classification reader of a kept base. It keeps only its `BaseReuse`,
  checks its cancellation before each call, and forwards retained inputs,
  retained document evidence, and captured usage to the kept capture after
  that check. It releases the base through its `BaseRelease` after its own
  first failed read. Its `comparison_identity` forwards only
  `ProofMode::Retained` proofs to the kept base generation, between two
  cancellation checks. A failed reader proves nothing.
- [`src/comparison_steps.rs`](./src/comparison_steps.rs) defines `Step` and
  `Steps`, the comparison steps that a command shows while Changes runs.
- [`src/base_selection.rs`](./src/base_selection.rs) defines `BaseLookup`,
  `GitBaseLookup`, and `PinnedBase`, the one pinned repository, ref, and merge
  base. `PinnedBase::resolved` pins a merge base that the caller already
  resolved, with the repository errors of a lookup.
- [`src/sources.rs`](./src/sources.rs) and
  [`src/git_tree.rs`](./src/git_tree.rs) define `GitSources` and `GitTree`,
  the commit-pinned source reader and its `SourceTree` adapter.
- [`src/extraction.rs`](./src/extraction.rs) defines `Extraction` and
  `CachedExtraction`, the on-demand commit extraction.
- [`src/cache.rs`](./src/cache.rs) and
  [`src/locations.rs`](./src/locations.rs) define `DiskCache`, the leased
  source and dependency caches and the `BundleCache` of the bundle kind, and
  `SystemLocations`, which selects their directory.
  [`src/cache_lock.rs`](./src/cache_lock.rs) holds the one lock-path mapping
  of every kind.
- [`src/bundle_store.rs`](./src/bundle_store.rs) defines `CachedBundles`, the
  `BundleStore` implementation, which checks the receipt digest before it
  encodes a recipe, and `settings_key`, the entry key of one set of bundle
  settings.
- [`src/bundle_cache_types.rs`](./src/bundle_cache_types.rs) defines
  `BundleCache`, with `compilation`, the receipt-only read that returns a
  `CompilationRead`, the streaming `BundleInput` and `RawEntry`, and the
  bounded receipt and inventory values. `DiskCache` implements `BundleCache` in the
  private [`src/bundle_cache.rs`](./src/bundle_cache.rs) module and its read,
  write, and maintenance modules.
- [`src/bundle_codec.rs`](./src/bundle_codec.rs) and its read and write
  modules encode the versioned header and the typed payload, stream the
  hashes, and check the file and request sizes. They write and decode only a
  `DurableRecipe`. The payload's `StoredGeneration` keeps an optional
  `ResolutionPlan` beside the restore fields. `Codec::encode` writes again
  without the plan when the file with it would not fit.
- [`src/bundle_inventory.rs`](./src/bundle_inventory.rs),
  [`src/bundle_storage.rs`](./src/bundle_storage.rs), and
  [`src/bundle_receipts.rs`](./src/bundle_receipts.rs) hold the confined IO,
  the bounded scans, and the durable receipts with their publication nonce and
  compilation digest.
- [`src/render_store.rs`](./src/render_store.rs) defines `RenderDisk`,
  `SegmentCache`, `CachedDocuments`, `DocumentBackend`, `WriteOutcome`, and
  `CAPACITY`, the render kind and its document backend. The private
  [`src/render_disk.rs`](./src/render_disk.rs) runs the one inventory.
  [`src/render_store_state.rs`](./src/render_store_state.rs) prepares the
  index from that inventory and handles entry and store faults.
  [`src/render_store_read.rs`](./src/render_store_read.rs) reads one position
  from the published snapshot before segment IO.
  [`src/render_store_index.rs`](./src/render_store_index.rs) adopts validated
  replacement positions in one snapshot while preserving keys that moved.
  [`src/render_store_write.rs`](./src/render_store_write.rs) publishes a built
  segment and adds its batch to the index with one snapshot copy.
- [`src/render_segment.rs`](./src/render_segment.rs) checks format 1 of a
  segment: the prefix, the bounded header, and the digests.
  [`src/render_segment_buffer.rs`](./src/render_segment_buffer.rs) defines
  `SegmentBuffer` and `BuiltSegment`, the fixed buffer in which a batch builds
  its segment, and the private
  [`src/render_segment_header.rs`](./src/render_segment_header.rs) writes the
  bounded header into it.
  [`src/render_sequence.rs`](./src/render_sequence.rs) advances the access
  counter.
- [`src/render_writer.rs`](./src/render_writer.rs) defines `DocumentWriter` and
  `WriterLimits`, the bounded key admission and the one writer.
  [`src/render_batch.rs`](./src/render_batch.rs) builds one batch inside its
  workspace. [`src/render_pending.rs`](./src/render_pending.rs) defines
  `StoreObserver`, `StoreWarning`, and `TraceStoreObserver`. The private
  [`src/render_admission.rs`](./src/render_admission.rs) holds the admission
  state that implements `WriteActivity`, and
  [`src/render_memory.rs`](./src/render_memory.rs) updates the `StoreMemory` of
  the state records.
- [`src/render_writer_control.rs`](./src/render_writer_control.rs) defines
  `Startup` and `DocumentWriter::prepared`, the paused writer start that
  prepares the identity and the index, and `DocumentWriter::activity` and
  `DocumentWriter::bind_readiness`.
- [`src/render_identity.rs`](./src/render_identity.rs) defines
  `NativeIdentity`, the native build identity that the writer prepares, and
  [`src/render_image.rs`](./src/render_image.rs) defines `ImageIdentity`,
  `ImageSource`, and `SystemImage`, its implementation.
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
- [`src/commands.rs`](./src/commands.rs) defines `Commands`, `TimedCommands`,
  and `Command`, the bounded install supervisor and one manager invocation,
  whose `scripts` field selects the scripts mode of the install environment.
- [`src/lookup.rs`](./src/lookup.rs) and [`src/moves.rs`](./src/moves.rs)
  define `Lookup` and the move `Detector`.
- [`src/projection_index.rs`](./src/projection_index.rs),
  [`src/projection_detail.rs`](./src/projection_detail.rs),
  [`src/projection_workspace.rs`](./src/projection_workspace.rs), and
  [`src/projection_removed.rs`](./src/projection_removed.rs) hold the shared
  projections that Serve and static output call.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed failure of base
  preparation and its IO boundaries, and `Error::Base` records whether a
  tier-two install with lifecycle scripts off came before the failure.

### Related Docs

- [Comparison](../../docs/protocol/mokly-comparison.md).
- [Comparison serving](../../docs/protocol/mokly-comparison-serving.md) and
  [Changes serving](../../docs/protocol/mokly-changes-serving.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md),
  [eager base preparation](../../docs/protocol/mokly-eager-base-preparation.md),
  [base cache](../../docs/protocol/mokly-base-cache.md),
  [render store](../../docs/protocol/mokly-render-store.md),
  [Serve edit plans](../../docs/protocol/mokly-sidecar-plans.md),
  [dependency installation](../../docs/protocol/mokly-base-dependencies.md),
  and [install processes](../../docs/protocol/mokly-base-install-processes.md).
- [Package selection](../../docs/protocol/mokly-comparison-packages.md).
- [CSS change attribution](../../docs/protocol/mokly-css-attribution.md).
- [Moves](../../docs/protocol/mokly-moves.md) and
  [branch-point lookup](../../docs/protocol/mokly-branch-point-lookup.md).
- [Git runtime](../../docs/protocol/mokly-git.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
