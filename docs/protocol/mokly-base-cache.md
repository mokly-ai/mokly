# Base Preparation Cache

Status: The render kind does not exist yet. [Milestone 2: Durable store and bounded writer](../../plans/persistent-render-store.md#milestone-2-durable-store-and-bounded-writer) adds it.

The [base preparation contract](./mokly-base-preparation.md) defines source
conversion and dependency selection. This page defines their retained storage.
It also defines the bundle cache of compiled JavaScript, which both comparison
sides use. The render kind keeps the [render store](./mokly-render-store.md)
of Serve under the common rules of the next section.

## Cache Location And Ownership

The source, dependency, bundle, and render kinds live in a SHA-256 namespace under the
operating system's cache directory. Windows honors an absolute `LOCALAPPDATA`
value. The key hashes the canonical repository path's OS encoding. On Windows,
canonical paths use the plain drive form without the `\\?\` prefix when that
form can name the location. npm and Node do not treat the two forms as one root.
The namespace path resolves the links at or above it. A cache location inside
the repository is invalid. Below that canonical root, directory links are
rejected before writes. Dependency links remain data entries; traversal does
not follow them.

Source, dependency, bundle, and render namespaces have separate byte bounds. Each
complete entry reserves 1,024 bytes for its receipt. Retained size counts
regular-file bytes and link targets without following links. A hit checks the
bounded completion receipt and recounts the data bytes. Only receipt schema 1 is
valid; another schema or unknown field is incomplete. A bundle receipt also
holds a random 256-bit publication id from its write and the SHA-256 digest of
the runtime import key of its compilation. An access-order update keeps both.
Source and dependency hits do not hash file contents: a durable
completion receipt replaces repeated content verification. A completed entry
survives a crash, because its data and directory metadata are durable before its
receipt is published. A valid entry may retain consumer cache files as long as
its recounted size fits the bound. An entry that exceeds the bound rebuilds.

Any number of callers may lease one completed entry. One caller at a time builds
or repairs an entry. A caller that waits for that build uses the completed
entry. In the source and dependency kinds, an unfinished key does not block
access to another key. A source or dependency lookup without a build leases a
completed entry or returns nothing. It creates no directory, and it reports the
cache directory only when it leases an entry. The first bundle lookup of a
process reports the cache directory, also when it finds no entry. The line of
that report can wait under the
[cache output rule](./mokly-terminal-cache.md#cache-directory).

Shared leases and active builds are never evicted. Eviction removes the least
recently used entries first. That order does not depend on wall-clock time. In
the source and dependency kinds, active entries that leave insufficient room
cause the typed cache-limit result, and each concurrent build has its own staged
disk bound. Completed entries obey the namespace bound at adoption. Cleanup
never removes the staged data of an active build. A later cache open removes the
data that cancellation or an interrupted process left behind. Unrecognized names
such as `.DS_Store` are ignored. A symlinked entry is rejected. A file that
vanishes while Mokly measures a changing install does not fail the measurement.

No other caller leases an entry before its receipt marks it complete.
Missing, damaged or incomplete receipts and missing data roots rebuild. Failed
builds remove partial data. A lock ends when its holder exits. Lock files
remain. Deleting the cache is safe.

Mokly reports the cache directory at most once per process for all cache
kinds. Plain stdout is exactly `Mokly cache: <directory>` followed by LF. The
[cache output rule](./mokly-terminal-cache.md#cache-directory) says when the
line prints and how rich output shows it.

## Bundle Entries

The bundle cache keeps compiled JavaScript bundles under the
[compiled recipe rules](./mokly-sidecar-recipes.md).
It keeps one entry for each set of bundle settings: the latest compilation
that a command served and could store. The settings include the source root,
so the head, the base, and each base extraction have separate entries.
Decision: the cache keeps compiled bundles only, and each side keeps its own
entries. Stored descriptions were rejected, because a description also depends
on peers, the environment, and the time, so a stored one can be stale. One
entry shared by equal head and base sources was rejected, because it rewrites
the paths in compiled code.

The data of a bundle entry is one file. Its first line names the entry format
version 1, the Mokly version that wrote it, and the SHA-256 digest of the
payload. The payload is the compiled bundle with its settings and module
graph. It can also keep the [resolution plan](./mokly-sidecar-plans.md) of
that compilation, beside the compiled bundle. A reader rejects another format
or Mokly version before it reads the payload. A file above the
[frame limit](./mokly-sidecar.md#transport) is rejected before its payload is
read. A bundle hit hashes the payload and compares the digest with the first
line. A write stores the plan that it receives with the compilation. When the
plan would take the file above the frame limit, the write stores the entry
without the plan. A reader drops a stored plan above the
[record bound](./mokly-sidecar-plans.md#plan-records). A missing or dropped
plan never makes an entry damaged.

Each bundle cache event other than a hit or a stored write falls into one
class:

| Class        | Cases                                                                                                              | Output                         | Bundle cache afterwards         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------- |
| Entry fault  | A damaged, unreadable, or foreign entry                                                                            | The entry warning at each read | Stays on                        |
| Store fault  | A filesystem or platform error outside one entry, or an invalid cache location                                     | The directory warning, once    | Off for the rest of the process |
| Normal event | A held lock, no room for a write, incomplete or unstable reuse evidence, a failed bundle, or a cancelled operation | None                           | Stays on                        |

A damaged entry has a damaged receipt or first line, a wrong size or digest, a
payload that does not parse or lacks complete and stable reuse evidence,
settings that do not match its key, or a receipt digest that does not match the
runtime import key of its payload. A stored
compilation is damaged too when its `restoreGeneration` request returns an
error, crashes the sidecar, or times out. A reuse check that declines a restored
compilation, because its inputs changed, is a normal miss with no warning. The
sidecar then compiles, and the new compilation replaces the entry when a write
is allowed. A foreign entry has another format or Mokly version. An unreadable
entry has a file that Mokly cannot read. A store fault is an error on a
directory of the bundle namespace, a lock file, a staged write, a rename, or
data that waits for deletion, during a read or a write. It makes the bundle
cache directory unusable for the rest of the process. The
[cache warnings](./mokly-terminal-cache.md#cache-warnings) give the text of the
entry warning and the directory warning.

After an entry fault, Mokly tries once, without waiting, to remove the rejected
entry. It removes the entry only while the entry keeps the publication id that
the read found, or while its receipt still does not mark it complete. A complete
replacement by another writer stays. Then it compiles again. In the `full`
capture mode, it stores the new compilation, unless a normal event or a store
fault prevents the write. The removal keeps a rejected entry from warning
again when the new compilation cannot be stored. When the `restoreGeneration`
request of a stored compilation fails, the request compiles without that stored
compilation. A sidecar crash or timeout during the restore keeps only the
existing [recovery](./mokly-sidecar.md#fail-closed-rules), and Mokly adds no
retry. No bundle cache fault fails a command.

In the `full` mode of the
[capture modes](./mokly-sidecar-recipes.md#capture-modes), Mokly offers each
served compilation with complete and stable reuse evidence to the bundle
cache, also one served from memory. A Serve head preparation in the
`serveEdit` mode offers nothing, also for a retained state that it serves
without a `bundle` request. Before the bundle cache encodes the
compilation, it reads only the receipt of the entry, under one shared attempt
of the entry lock. It reads no payload and does not change the eviction order. When the
receipt holds the digest of the served compilation's runtime import key, the
write ends without a change, and it counts as a stored write. A held entry
lock skips the write. In every other case, the write replaces the entry under
the rules below. A damaged or unreadable receipt is also an entry fault. Each
compile gets a new runtime import key, so an equal digest names the same
compilation. The check trusts the receipt, and the next read still checks the
payload.
Decision: the receipt of an entry names its compilation, so the bundle cache
decides whether a write is needed. A record of the last entry that each process
read or wrote was rejected, because completion order, eviction, another
process, and the deletion of the cache directory can each make it stale. Such a
record checked against the publication id was rejected, because it keeps a
table and its lifetime. A write of each served compilation was rejected,
because it adds a full write after each hit.

Bundle entries share a fixed set of entry locks. A write replaces the entry of
its settings under its entry lock, so no reader sees a partial entry. No bundle
cache operation waits for a lock. A held lock skips a write, and a held entry
lock turns a read into a miss, also when the holder works on another entry that
shares the lock. A read that cannot update the eviction order still serves its
entry. A failure of the bundle cache, including a cancelled operation, never
fails a bundle.
Decision: a fixed set of entry locks bounds the lock files of the bundle kind. A
lock file for each set of settings was rejected, because the files grow with
each new source root, and deleting one can split one lock between two files. One
lock for all entries was rejected, because it adds contention.

The bundle namespace [bound](./mokly-timings.md#budgets) counts complete
entries, the staged writes of every process, and replaced or evicted data that
is not yet deleted. Before a write, Mokly makes room for the whole new entry.
It removes the replaced entry first, then evicts other entries under the
eviction rule above. When it cannot make room, it skips the write. Deleting
the cache directory removes every bundle entry. After the deletion, a running
process stores again each compilation that it serves in the `full` capture
mode. A later process compiles each other bundle again.
Decision: compiled bundles use a third kind of the same cache. The Mokly
version in the first line keeps each release from parsing the entries of
another release. A separate single-file store and an embedded database were
rejected, because each adds a second set of cache rules.

### Stable Capture

The bundle cache stores a compilation only when its reuse evidence is
complete and stable. Evidence is stable when the sidecar finds the same
identity and the same change stamps, at its first observation and after
the compile, for each directory on the path to a recorded input and for
each recorded configuration or manifest file. This check detects a change
during the capture and the compile, with the one limit below. The sidecar
makes this check only for a command that keeps a bundle cache, and only on
a local volume of a supported file system:

| Platform | File systems                                   |
| -------- | ---------------------------------------------- |
| Linux    | ext2, ext3, ext4, xfs, btrfs, tmpfs, overlayfs |
| macOS    | APFS and HFS+                                  |
| Windows  | NTFS and ReFS, on a fixed volume               |

Evidence on any other volume, such as a network, FUSE, FAT, or exFAT volume,
is never stable. On a supported volume, an unrelated change in a directory on
the path to a recorded input can also prevent the store. A change too recent
for the time resolution of the file system has the same effect. Before a
compile, the sidecar waits once, for at most 50 ms, when a recent change could
otherwise make its evidence unstable. It never waits before a reuse.

The check has one known limit. A path can be replaced and restored after its
first observation, inside one timestamp tick of the file system. When every
checked identity and stamp then returns to its first value, and the recorded
evidence matches the files at the final read, the evidence counts as stable.
The bundle cache can then store a compilation whose module selection came
from the intermediate state. A Serve edit can then also reuse its plan. The
likelihood is Rare: both changes of the path must fall inside one tick after
its first observation, and every checked identity and stamp must return to
its first value. No production case is known. The rule for recent changes
applies only at each first observation, where it rejects a stamp too recent
for the time resolution. It does not exclude a replace and restore after that
observation.

A compilation with unstable evidence keeps every in-process reuse rule of the
[compiled recipe rules](./mokly-sidecar-recipes.md).
A later process cannot reuse it, no Serve edit reuses its plan, and Mokly
prints nothing for it.
Decision: stability decides whether the bundle cache stores a compilation and
whether a Serve edit can reuse its plan. It never limits the reuse of a
compiled result inside a process. A rule that also limits that reuse was
rejected, because a process would lose reuse that it has without the bundle
cache. A Linux-only proof was rejected, because it turns the bundle cache off
on macOS and Windows. A compile from an immutable copy of the inputs, and a
second resolve in a mirror directory, were rejected, because the sidecar
performs no file writes.

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
