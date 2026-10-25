# Base Preparation Cache

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

The [base preparation contract](./mokly-base-preparation.md) defines source
conversion and dependency selection. This page defines their retained storage.

## Cache Location And Ownership

Both cache kinds live in a SHA-256 namespace under the operating system's
cache directory. Windows honors an absolute `LOCALAPPDATA` value. The key
hashes the canonical repository path's OS encoding. On Windows, canonical
paths use the plain drive form without the `\\?\` prefix when that form can
name the location. npm and Node do not treat the two forms as one root.
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

## Converted Source Identity

A source entry identifies the base commit and the effective checkout settings.
Attribute overrides include repository, worktree, global, and system settings.
A change to effective attributes invalidates the entry, even when the commit
and the configured attribute-file path stay unchanged.

External checkout filters can depend on files, environment, or remote data.
Their converted source entries are private to one preparation. A later
preparation runs the filters again. A partial extraction with conversion
warnings has no completion receipt. Its lease keeps independent files usable
until release, then removes the partial directory. Its private lease key
allows a later preparation to retry while the older generation remains active.
