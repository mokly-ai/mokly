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

Reads by entry use the proved object id and run in bounded cat-file batches.
Dependency input reads use this batch API. HTML, Markdown, YAML and CSS need
no extraction. JavaScript, a renderer module and consumer PostCSS acquire an
extraction lease. Keep that lease while a sidecar uses its root. A source
archive copies exact regular blobs, including files that export attributes
would omit or substitute. It writes and releases each batch before reading
the next. A blob larger than one batch streams directly to disk. The total
disk bound follows the source cache capacity; memory stays bounded by the
blob batch or stream buffer, independently of total repository size.

Opaque public resources use SHA-256 digests. Oversized Git blobs and working
files are hashed as streams with bounded memory. They need no full byte read
for planning or comparison. Resource closure checks their confined regular
file identity; only HTML and CSS files need reference parsing.

If a remaining tree, file, or command budget prevents comparison, Changes is
unavailable. The diagnostic names the requested path or root and the limit.
The current build remains valid. Genuine Git command and object failures
remain fatal `git-failed` errors.

## Shared Render Runtime

The CLI constructs head and base definition and graph factories through
`mokly-render::Runtime`, with the current npm package `VERSION`. They share
one sidecar pool, one render cache, and one cancellation state. A base that
needs JavaScript, a renderer, or PostCSS acquires a `BaseSide`: its source
lease, dependency `Resolved` value, repository mappings, and commit identity.
The graph holds these leases while it can request a render. HTML without a
renderer or PostCSS uses Git sources without extraction or a Node process.

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

Both cache kinds live in a SHA-256 namespace under the operating system's
cache directory. Windows honors an absolute `LOCALAPPDATA` value. The key
hashes the canonical repository path's OS encoding.
Resolve the complete namespace path once at composition, including links at
or above it. A cache location inside the repository is invalid. Below that
canonical root, directory links are rejected before writes. Dependency links
remain data entries; traversal does not follow them.

Source and dependency namespaces have separate byte bounds. Each complete
entry reserves 1,024 bytes for its receipt. Retained size counts regular-file
bytes and link targets without following links. Hits check the bounded
completion receipt and recount data bytes. Only receipt schema 1 is valid;
another schema or unknown field is incomplete. Hits do not hash file contents.
Data and directory metadata are flushed before receipt publication. Linux
uses one `syncfs` barrier for the entry's filesystem. macOS uses plain `fsync`
for each data file and directory, then the completion receipt's drive-cache
barrier. Windows flushes each file and uses a write-through rename. Unix
flushes the receipt directory before and after rename. Cache hits update
access order by atomic replacement with no file or directory flushes. This
completion boundary replaces repeated
content verification. A valid entry may retain consumer cache files as long
as its recounted size fits the bound. An entry that exceeds the bound rebuilds.

Readers hold shared `mokly-platform` locks. Any number of callers may lease
one completed entry. Build and repair take the exclusive entry lock, then
recheck completion. They release the namespace lock before extraction, copy,
installation, counting and data flushes. An unfinished key does not block
access to another key. Namespace mutation, receipt access order and eviction
use the short exclusive namespace lock. A waiter holds no namespace lock.

Eviction acquires each candidate's exclusive entry lock without waiting.
Shared leases and active builds are never evicted. Least-recently-used order
uses a sequence, independent of wall-clock timestamps. Active entries that
leave insufficient room cause the typed cache-limit result. Each concurrent
build has its own staged disk bound; completed entries obey the namespace
bound at adoption. Staging cleanup selects only names whose entry lock is
free. Under the
namespace lock, eviction and cleanup rename victims into unique trash names.
They delete trash outside that lock, with cancellation checks at each node.
Later cache opens sweep any trash left by cancellation or an interrupted
process. Unrecognized names such as `.DS_Store` are ignored. A symlinked entry
is rejected. Every traversal checks cancellation and tolerates vanished
nodes when it measures a changing install.

Sources publish a complete staged directory by rename. Installs build at
their final locked location so local links remain valid. Receipt rename
publishes completion. Missing, damaged or incomplete receipts and missing
data roots rebuild under the entry lock. Failed builds remove partial data.
OS locks release on close; lock files remain. Deleting the cache is safe.

One reporter guard covers both caches and reports the directory once per process. Plain stdout is exactly
`Mokly cache: <directory>` followed by LF. Rich output follows the
[terminal rule](./mokly-terminal-output.md#cache-directory).

## Dependency Identity

The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines clean identities, supported managers, and installation cache keys.

## Installation And Bundle Settings

The [dependency contract](./mokly-base-dependencies.md#installation-and-bundle-settings)
defines npm, pnpm, and Yarn installs, their registry access and configuration,
version discovery, manager fallback reasons, and sidecar directory mappings.
