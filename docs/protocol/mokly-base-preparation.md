# Base Source And Dependency Preparation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines the `mokly-compare` preparation APIs. The
[comparison contract](./mokly-comparison.md#sides) owns rendered sides. The
[Git runtime](./mokly-git.md) owns history, blobs and extraction.

## Sources

A source reader pins one commit and one cancellation generation. It loads
a commit index for configured roots and explicitly requested paths, with
directories, regular files, symbolic links and submodule modes. Exact path
queries do not enumerate descendants or unrelated repository files. Composition selects separate regular-file and total-node bounds.
Repeated root queries use that index. Regular-file listings retain
actual POSIX spelling, return each file once and apply the selected count
bound. An empty root list starts no query; an explicit whole-tree root lists
all regular files. The catalogue applies its root ownership, globs and
source diagnostics. `GitTree` implements `SourceTree` over that index. Projection and direct-child
queries reuse cached metadata. Exact catalogue inventories, generation-wide
planning inputs, and discovered closure targets use bounded blob batches. A byte-bounded file LRU serves repeated reads;
a miss reads only its requested path, without holding the cache mutex during IO.
Reads by entry use the proved object id in bounded checkout-converted batches.
HTML, Markdown, YAML and CSS need no extraction. JavaScript, a renderer module
and consumer PostCSS acquire an extraction lease. Keep that lease while a
sidecar uses its root. A source archive copies checkout-converted regular files
with the pinned commit's attributes, including line endings, smudge filters,
and Git LFS downloads. Network access is allowed within the existing limits.
Missing blobs and required attribute objects are fetched together before
parallel conversion reads. It writes and releases each batch before reading the next. A
converted blob larger than one batch streams directly to disk. The total disk
bound follows the source cache capacity; memory stays bounded independently of
repository size.
Opaque public resources use SHA-256 digests. Oversized Git blobs and working
files are hashed as streams with bounded memory. They need no full byte read
for planning or comparison. Resource closure checks their confined regular
file identity; only HTML and CSS files need reference parsing.
If a remaining tree, file, or command budget prevents comparison, Changes is
unavailable. The diagnostic names the requested path or root and the limit.
The current build remains valid. Genuine Git command and object failures
remain fatal `git-failed` errors. A failed, timed out, or oversized conversion
makes that resource unavailable with a `base-conversion` warning, while other
base resources continue. Unavailable bytes cannot prove a resource change.
User-configured filters run with the same Git configuration as dependency
clean conversion. Raw blobs and offline-only smudge are not substitutes for
checkout bytes. Each conversion uses the existing 120-second preparation
allowance. A failed batch fetch names the recovery command.

## Shared Render Runtime

The CLI constructs head and base definition and graph factories through
`mokly-render::Runtime`, with the current npm package `VERSION`. They share
one sidecar pool, one render cache, and one cancellation state. A base that
needs JavaScript, a renderer, or PostCSS acquires a `BaseSide`: its source
lease, dependency `Resolved` value, repository mappings, and commit identity.
The graph holds these leases while it can request a render. HTML without a
renderer or PostCSS follows the [HTML dependency policy](./mokly-comparison.md#html-package-styles).

The CLI sets separate disk cache bounds and one shared allowance for
dependency preparation. Extraction and installation use the
same cancellation token as Git. Cancellation checkpoints also surround
comparison and public resource planning. All source wrappers forward exact
prefetch sets, public reads, and streamed digests.

Sidecar working directories follow the [fixed source-root rule](./mokly-sidecar.md#lifecycle).
Each PostCSS context runs in a child process whose working directory is its
side's source root. This confines relative file reads and automatic Tailwind
source discovery to that side. The head and base can use the same installed
third-party dependencies while reading separate repository sources. The child
puts selected dependency directories before inherited `NODE_PATH` entries. CSS
package resolvers that read `NODE_PATH` can use those directories without
links in the source lease. Node's ESM resolver does not read `NODE_PATH`.

Historical runtime failures keep typed diagnostic codes through catalogue,
HTML, CSS, and graph wrappers. The following policy applies only to Changes;
current-side failures retain the sidecar's fail-closed command policy.

| Runtime category                     | Historical outcome                                 |
| ------------------------------------ | -------------------------------------------------- |
| Configuration, build, bundle, render | Changes unavailable: base validation failed        |
| Unavailable                          | Changes unavailable: base runtime unavailable      |
| Version                              | Changes unavailable: base runtime version mismatch |
| Cancelled                            | Fail the interrupted build                         |
| Protocol                             | Fail the build with the protocol diagnostic        |
| Timeout                              | Changes unavailable: base runtime timed out        |

A fatal failure inside a grouped attempt takes precedence over recoverable
historical validation. Internal failures remain comparison failures. A
missing base configuration still denotes an empty catalogue. Base diagnostics
are detail lines that name the full base commit and original terminal code.
A successful build has no error block. Genuine Git and internal comparison
failures use error blocks and fail the command.

## Cache Location And Ownership

Source and dependency leases use separate bounded namespaces outside the
repository. The [cache contract](./mokly-base-cache.md) defines ownership,
completion, reuse, and cleanup. Converted source reuse follows the effective
checkout settings. Partial extractions never publish a reusable receipt.

## Dependency Identity

The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines clean identities, supported managers, and installation cache keys.

## Installation And Bundle Settings

The [dependency contract](./mokly-base-dependencies.md#installation-and-bundle-settings)
defines npm, pnpm, and Yarn installs, their registry access and configuration,
version discovery, manager fallback reasons, and sidecar directory mappings.
Lifecycle scripts stay off by default. The working-tree `review.baseInstallScripts`
setting or its command-line override enables them for one invocation.
