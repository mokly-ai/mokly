# Base Preparation Cache

The [base preparation contract](./mokly-base-preparation.md) defines source
conversion and dependency selection. This page defines their retained storage.

## Cache Location And Ownership

Both cache kinds live in a SHA-256 namespace under the operating system's
cache directory. Windows honors an absolute `LOCALAPPDATA` value. The key
hashes the canonical repository path's OS encoding. On Windows, canonical
paths use the plain drive form without the `\\?\` prefix when that form can
name the location. npm and Node do not treat the two forms as one root.
The namespace path resolves the links at or above it. A cache location inside
the repository is invalid. Below that canonical root, directory links are
rejected before writes. Dependency links remain data entries; traversal does
not follow them.

Source and dependency namespaces have separate byte bounds. Each complete
entry reserves 1,024 bytes for its receipt. Retained size counts regular-file
bytes and link targets without following links. A hit checks the bounded
completion receipt and recounts the data bytes. Only receipt schema 1 is
valid; another schema or unknown field is incomplete. Hits do not hash file
contents: a durable completion receipt replaces repeated content verification.
A completed entry survives a crash, because its data and directory metadata
are durable before its receipt is published. A valid entry may retain
consumer cache files as long as its recounted size fits the bound. An entry
that exceeds the bound rebuilds.

Any number of callers may lease one completed entry. One caller at a time
builds or repairs an entry. A caller that waits for that build uses the
completed entry. An unfinished key does not block access to another key.

Shared leases and active builds are never evicted. Eviction removes the least
recently used entries first. That order does not depend on wall-clock time.
Active entries that leave insufficient room cause the typed cache-limit
result. Each concurrent build has its own staged disk bound. Completed entries
obey the namespace bound at adoption. Cleanup never removes the staged data of
an active build. A later cache open removes the data that cancellation or an
interrupted process left behind. Unrecognized names such as `.DS_Store` are
ignored. A symlinked entry is rejected. A file that vanishes while Mokly
measures a changing install does not fail the measurement.

No other caller leases an entry before its receipt marks it complete.
Missing, damaged or incomplete receipts and missing data roots rebuild. Failed
builds remove partial data. A lock ends when its holder exits. Lock files
remain. Deleting the cache is safe.

Mokly reports the cache directory once per process for both caches. Plain
stdout is exactly `Mokly cache: <directory>` followed by LF. Rich output
follows the [terminal rule](./mokly-terminal-output.md#cache-directory).

## Converted Source Identity

A source entry identifies the base commit and the effective checkout settings.
Attribute overrides include repository, worktree, global, and system settings.
A change to effective attributes invalidates the entry, even when the commit
and the configured attribute-file path stay unchanged.

External checkout filters can depend on files, environment, or remote data.
Their converted source entries are private to one preparation. A later
preparation runs the filters again. A partial extraction with conversion
warnings has no completion receipt. Its lease keeps independent files usable
until release, then removes the partial directory. A later preparation can
retry while the older generation remains active.
