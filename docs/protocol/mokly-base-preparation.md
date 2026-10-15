# Base Source And Dependency Preparation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines the `mokly-compare` preparation APIs. The
[comparison contract](./mokly-comparison.md#sides) owns rendered sides. The
[Git runtime](./mokly-git.md) owns history, blobs and extraction.

## Sources

A source reader pins one commit and one cancellation generation. It loads
one tree index, with directories, regular files, symbolic links and submodule
modes. Repeated root queries use that index. Regular-file listings retain
actual POSIX spelling, return each file once and apply the selected count
bound. An empty root list starts no query; an explicit whole-tree root lists
all regular files. The catalogue applies its root ownership, globs and
source diagnostics. The later `SourceTree` adapter uses the same index.

Reads by entry use the proved object id and run in bounded cat-file batches.
Dependency input reads use this batch API. HTML, Markdown, YAML and CSS need
no extraction. JavaScript, a renderer module and consumer PostCSS acquire an
extraction lease. Keep that lease while a sidecar uses its root. A source
archive copies exact regular blobs, including files that export attributes
would omit or substitute. It writes and releases each batch before reading
the next. Its total disk bound follows the source cache capacity; memory
stays bounded by the blob batch, independently of total repository size.

## Cache Location And Ownership

Both cache kinds live in a SHA-256 namespace under the operating system's
cache directory. The key hashes the canonical repository path's OS encoding.
Resolve the complete namespace path once at composition, including links at
or above it. A cache location inside the repository is invalid. Below that
canonical root, directory links are rejected before writes. Package overlay
links are data entries and may point into the leased extraction.

Source and dependency namespaces have separate byte bounds. Each complete
entry reserves 1,024 bytes for its receipt. Retained size counts regular-file
bytes and link targets without following links. Hits check the bounded
completion receipt and recount data bytes. Only receipt schema 1 is valid;
another schema or unknown field is incomplete. Hits do not hash file contents.
Data and directory metadata are flushed before receipt publication. Unix
flushes directories before and after rename; Windows flushes file contents
and uses a write-through rename. This completion boundary replaces repeated
content verification. A valid entry may retain consumer cache files as long
as its recounted size fits the bound.

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
bound at adoption. Staging cleanup removes only names whose entry lock is
free. Unrecognized names such as `.DS_Store` are ignored. A symlinked entry
is rejected. Every traversal checks cancellation and tolerates vanished
nodes when it measures a changing install.

Sources publish a complete staged directory by rename. Installs build at
their final locked location so local links remain valid. Receipt rename
publishes completion. Missing, damaged or incomplete receipts and missing
data roots rebuild under the entry lock. Failed builds remove partial data.
OS locks release on close; lock files remain. Deleting the cache is safe.

One reporter guard covers both caches and the package overlays. The first
open reports the directory once per process. Plain stdout is exactly
`Mokly cache: <directory>` followed by LF. Rich output follows the
[terminal rule](./mokly-terminal-output.md#cache-directory).

## Dependency Identity

The base input set contains every tracked repository package manifest and
lockfile from blobs, including workspace manifests. The working input set
comes from `git ls-files -z --cached --others --exclude-standard`. It does
not walk ignored trees, nested clones or submodules. Dependency trees under
`node_modules` are excluded on both sides. There is no application-specific
list of excluded build directories.

Each working input must be a confined regular file. Compare its Git clean
object identity, computed with `hash-object --path --stdin` without writing
objects, with the corresponding base blob id. This applies line ending and
clean-filter conversion. Equal identities use the base blob bytes in the
input set. A changed file or path set differs. This normalization is for
dependency identity only; it does not change base render or resource bytes.

Repository-owned workspace and local directory packages always resolve from
the side's own sources, in every tier. A small per-commit overlay links each
package name to its directory inside the leased extraction. Put that overlay
first in the bundle's package roots. Tier one and tier three never resolve
these packages through the working tree's links. Third-party dependencies
keep the three tiers of the comparison contract.

Equal dependency identities reuse working third-party dependencies. Different
inputs install each npm lockfile root selected by the repository root and
`moduleResolution.packageRoots`. A nested app with no root lockfile is valid.
An independent configured package lock gets its own install. Prefer
`npm-shrinkwrap.json` over `package-lock.json` at each root. Unsupported
managers and absent supported lockfiles use the fallback tier. Support for
other managers remains an open review decision in the rebuild plan.

The install key length-frames all manifest and lockfile paths and bytes, the
npm version, and the selected install roots. Local package paths, archives,
overrides and workspaces also add the immutable source identity. Recognize
`file:`, `link:`, bare relative and absolute paths, home paths and local
`.tgz`, `.tar.gz` and `.tar` specifications. Normalize relative paths from
the declaring manifest. A local path outside the repository, including a home
or absolute path, uses a typed fallback reason. No install reads it.

## Installation And Bundle Settings

Copy the base sources into the private dependency entry. Run each install
without a shell using `ci --ignore-scripts --no-audit --no-fund`, with explicit
cache, log-directory and prefix arguments inside that entry. Resolve npm in
the parent through absolute PATH entries only. The child also receives only
absolute PATH entries, so a script interpreter cannot select historical code. On Windows a native launcher
runs directly; a standard `.cmd` installation uses its Node CLI. A source
directory or relative PATH entry never supplies npm. Unsupported launchers
fall back. Lifecycle scripts do not run.

Version discovery and every selected install share one monotonic deadline.
Size supervision walks the whole private entry at most once per second.
Vanished files or directories do not stop the install. Only a failed spawn
or unavailable executable has the typed command-unavailable result. Tests
use fake time and local offline fixtures without registry access.

The result carries third-party `node_modules`, the overlay lease, the install
lease when needed, and the complete sidecar `ModuleResolution`. Package roots
name the overlay first, then the selected third-party root and configured
package roots there, in order. Other settings keep their values. Retain these
leases and the extraction lease while the bundle uses their files.
Cancellation stops preparation and never becomes a fallback warning.

A fallback returns a configuration-subject `base-dependencies` warning. Use
the first differing lockfile in lexical order, or the selected base lockfile
for a manifest-only change. With no lockfile omit the location clause:

```text
base dependencies at "<lockfile>" could not be installed (time limit); using working-tree dependencies
base dependencies could not be installed (package manager or lockfile unavailable); using working-tree dependencies
```

Other typed reasons are `installation failed`, `cache size limit`,
`local package outside the repository`, `invalid dependency input` and
`cache unavailable`. The [build warning contract](./mokly-build-warnings.md)
owns strict mode and terminal presentation. Warnings never enter documents
or catalogue JSON.
