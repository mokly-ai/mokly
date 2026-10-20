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

The base input set contains every tracked repository package manifest and
lockfile from blobs, including workspace manifests. The working input set
comes from `git ls-files -z --cached --others --exclude-standard`. It does
not walk ignored trees, nested clones or submodules. Dependency trees under
`node_modules` are excluded on both sides. There is no application-specific
list of excluded build directories.

Each working input must be a confined regular file. Equal working and base
bytes reuse the base identity without a Git process. Hash the remaining
confined paths in one `hash-object --stdin-paths` call, without writing objects,
and compare their Git clean identities with the corresponding base blob ids.
This applies line ending and
clean-filter conversion. Equal identities use the base blob bytes in the
input set. A changed file or path set differs. This normalization is for
dependency identity only; it does not change base render or resource bytes.

Repository-owned workspace and local directory packages always resolve from
the side's own sources, in every tier. During bundling, a resolved real path
inside a repository root and outside every `node_modules` directory maps to
the same relative path under the side's source root. A missing mapped file
fails closed with `bundle-failed`. This covers repository packages for npm,
pnpm, Yarn and Bun without a package manifest inventory. Nested
`node_modules` directories retain the selected third-party dependencies.

Equal dependency identities reuse working third-party dependencies without
install validation, including for outside `file:` packages. Importer lookup
uses the matching directory in the selected dependency repository.
Different inputs install each npm lockfile root selected by configuration
ancestors and `moduleResolution.packageRoots`. A nested app with no root
lockfile is valid.
An independent configured package lock gets its own install. Prefer
`npm-shrinkwrap.json` over `package-lock.json` at each root. Unsupported
managers and absent supported lockfiles use the fallback tier.

The install key length-frames all manifest and lockfile paths and bytes, the
npm version, and the selected install roots. Local package paths, archives,
overrides and workspaces also add the immutable source identity. Recognize
`file:`, `link:`, bare relative and absolute paths, home paths and local
`.tgz`, `.tar.gz` and `.tar` specifications. Normalize relative paths from
the declaring manifest. A local path outside the repository, including a home
or absolute path, uses a typed fallback reason when an install is needed.
No install reads it.

## Installation And Bundle Settings

Configuration ancestors use Node's order, from the configuration directory
through the repository root. Every ancestor `node_modules` maps to the same
relative directory under the selected dependency installation. JavaScript
`nodePaths` and CSS use this order before explicit package roots. Tiers one
and three use working directories; tier two uses the directories created by
its base install. If the head used an ancestor directory absent from tier two,
select tier three with a `base-dependencies` warning naming that directory.
JavaScript, stylesheet, and PostCSS package reads establish this usage.
An unused ancestor directory does not cause a warning.

Tracked base files supply their bytes before installed copies. Other bare
imports start at the matching importer directory in the selected installation,
before configuration and explicit package-root fallback. Source aliases and
tsconfig paths use base files. Working tsconfig paths cannot remap base package imports.
An unmappable lookup selects tier three with a `base-dependencies` warning. Each fallback emits its typed trace reason.

Copy the base sources into the private dependency entry. Run each install
without a shell using `ci --ignore-scripts --no-audit --no-fund`, with explicit
cache, log-directory and prefix arguments inside that entry. Resolve npm in
the parent through absolute PATH entries only. The child also receives only
absolute PATH entries, so a script interpreter cannot select historical code. On Windows a native launcher
runs directly; a standard `.cmd` installation uses its Node CLI. A source
directory or relative PATH entry never supplies npm. Unsupported launchers
fall back. Lifecycle scripts do not run. After successful installs, remove
the private `.npm-cache` before byte counting and durability synchronization.

Version discovery and every selected install share one monotonic deadline.
Size supervision walks the whole private entry at most once per second.
Vanished files or directories do not stop the install. Only a failed spawn
or unavailable executable has the typed command-unavailable result. Tests
use fake time and local offline fixtures without registry access.

The result carries third-party `node_modules`, the install lease when needed,
the complete sidecar `ModuleResolution`, and typed repository root paths.
Package roots name configuration ancestors, then explicit package roots,
all inside the selected tier, in Node's order. Repository roots include the working repository root
in every tier and the copied base repository root inside a tier-two install.
Core `moduleResolution.dependencyRoot` names the selected installation repository.
The sidecar maps repository sources back to its source root. Other settings keep their values. Retain the install and extraction leases while bundling.
Cancellation stops preparation and never becomes a fallback warning.

A fallback returns a configuration-subject `base-dependencies` warning. Use
the first differing lockfile in lexical order, or the selected base lockfile
at the first selected install root for a manifest-only change. Prefer
`npm-shrinkwrap.json` there. Ignore unrelated lockfiles. With no selected
lockfile omit the location clause:

```text
base dependencies at "<lockfile>" could not be installed (time limit); using working-tree dependencies
base dependencies could not be installed (package manager or lockfile unavailable); using working-tree dependencies
base dependencies at "<lockfile>" lack "<directory>"; using working-tree dependencies
base dependency lookup cannot preserve "<directory>"; using working-tree dependencies (configure moduleResolution.packageRoots)
```

Other typed reasons are `installation failed`, `cache size limit`,
`local package outside the repository`, `invalid dependency input` and
`cache unavailable`. The [build warning contract](./mokly-build-warnings.md)
owns strict mode and terminal presentation. Warnings never enter documents
or catalogue JSON.
