# Render Store

Status: The sidecar release thread and finite file response bodies do not pause the writer yet. The [remaining writer activity owners item](../../plans/follow-ups/render-store-idle-work-owners.md) adds them. A read still takes an index lock, so another operation that reads or updates the index can turn the read into a miss. The [index publication milestone](../../plans/render-store-read-lock.md#milestone-2-regression-and-index-publication) removes that lock from reads.

The render store keeps the complete documents that `mokly serve` renders, so
that a later Serve process reuses them instead of rendering them again. It is
the render kind of the [Mokly cache](./mokly-base-cache.md). The
[common cache rules](./mokly-base-cache.md#cache-location-and-ownership) give
its location, ownership, leases, receipts, durability, damaged-entry rule, and
eviction order. The [render cache](./mokly-runtime.md#render-graph-and-cache)
of each process keeps its own bound and its own rules.

## Stored Documents

Serve reads and writes the store for the head side and the base side of
Changes. `build` and `publish` neither read nor write it, so static output and
uploads render every document from sources. The store has no setting.

A stored document keeps its exact bytes and every record that a fresh render
keeps with it: the ownership tree, usage, resource evidence, instance
identities, links, build warnings, and content type. The store keeps no
description, fragment, live prop render, catalogue state, or Changes result.
Decision: the store keeps the complete documents of Serve only. Stored
descriptions were rejected, because a description depends on peers, the
environment, and the time, so a stored one can be stale. Stored sidecar
fragments were rejected, because a restart would still compose every document.
A stored Serve state with the index, the details, and Changes was rejected,
because it would store descriptions too. A store in `build` and `publish` was
rejected, because static output and uploads would then keep the stored results
of unsupported inputs.

## Identity

Each stored document has a key that covers its
[document key](./mokly-rendering.md#document-assembly) and its build identity.
Serve reuses a stored document only when both are equal to those of the
document that it would render, so the documents of another build are absent.
The build identity covers:

- the platform: the operating system and the architecture;
- the build of the native core, so two builds at one Mokly version never share
  a document;
- for a document with a sidecar render, the
  [toolchain identity](./mokly-sidecar-recipes.md#reuse-and-identity) of its
  generation and the compilation inputs that the document key does not cover,
  such as `jsconfig.json` candidates, `extends` targets, peer manifests, and
  the `tsconfig.json` and `package.json` candidates above the source root.

A document without a sidecar render has no sidecar part. JavaScript source
bytes are not part of the build identity, because the document key covers
them, so an edit misses only the documents whose keys moved. The sidecar part
is unknown when the compilation lacks the complete and stable reuse evidence
that the [bundle cache](./mokly-base-cache.md#stable-capture) needs. Serve then
neither reads nor writes the documents that need that part. When Serve cannot
read the native build identity, the store is off for the process, as after a
store fault. The head side and the base side share a stored document when both
keys are equal.
Decision: the build identity reuses the toolchain identity and the compilation
evidence of the recipe rules, and adds the native core build. A short list of
the Node version, the Mokly version, and the `jsconfig.json` chain was
rejected, because a local rebuild at one version, an `extends` file, or a peer
manifest could then serve an older document. The whole bundle as the identity
was rejected, because one source edit would then miss every unchanged view.

## Reads

Serve opens and prepares the store while it starts, outside the render path:
it reads the native build identity and indexes the stored documents. A lookup
before that preparation ends is a miss. Opening the store announces the cache
directory, also when the store holds no entry. The
[cache output rule](./mokly-terminal-cache.md#cache-directory) decides when
that line prints: a line from Serve's startup waits for its ready output. The
preparation never waits for the line.

Serve reads the store after a render cache miss and before it renders the
document. A stored read and a fresh render of the same side give equal results:
the same bytes, public closure, link check results, build warnings, usage, and
resource evidence. A read updates the access order of the entry that holds the
document.

A read takes no index lock to look up its document. No read waits for the entry
reads, the store writes, or the index updates of another operation. A held
entry lock turns a read into a miss, also when the holder works on another
entry that shares the lock. After preparation ends, another operation that
reads or updates the index never turns a read of an indexed document into a
miss.
Decision: each index update publishes a complete snapshot of the index, and a
lookup uses the last published snapshot. This keeps renders from waiting for
the entry reads and store writes of an update, and adds no miss while other
operations use the index. A miss while another operation holds the index was
rejected, because it loses hits on stored documents. A wait for the index was
rejected, because a render would then wait for those entry reads and store
writes, or for one paused update.

A head hit can also feed the
[return warm-up record](./mokly-sidecar-return-warmup.md#recorded-renders),
which owns the feed rules. The store keeps no data for the warm-up. The feed
changes neither which documents the store keeps nor the entry format.

## Writes

Serve offers each document that it renders to the store, after the document
passes the closure walk and the link checks of its side. The writer may write
only after Serve completes its first Changes result, ready or unavailable.
After that, it starts a new encoding or save only while Serve is idle. Serve is
idle when the `changesStatus` of the current revision is `ready` or
`unavailable`, under [Changes in Serve](./mokly-changes.md#changes-in-serve),
and no other Serve work is in flight. That work includes a foreground request,
a watch action, also one that the `r` shortcut starts, a base ref refresh, a
render worker job, a comparison capture, and any sidecar pool work, calls and
maintenance included. An encoding or a save that already started may finish. A
render and a publication never wait for a store write.

While the writer may not start, offers wait in the pending set. The pending
writes have a fixed count and a fixed byte bound, and an offer that finds no
room is dropped. No write waits for a lock, so a held lock drops the write.
Shutdown drops the pending writes. A later process renders a dropped document
again.

A pending write holds no copy of its document. The writer takes each document
from the render cache when it writes, and a document that has left the render
cache is not written. The writer encodes one document at a time. Its batch
and its segment buffer together stay within the
[writer budget](./mokly-timings.md#budgets). The writer's work, its segment
buffer included, uses the transit reserve of the render cache. The writer takes
an encoder lease only to encode a document that is not compact yet. A document
that finds no room or no free lease is dropped. A write never promotes,
refreshes, or counts a lookup of the render cache. So the store adds no
document memory outside the render cache bound.
Decision: pending writes name documents that the render cache keeps, so the
render cache stays the one owner of document memory. A queue of documents with
its own byte bound was rejected, because it keeps documents alive after the
render cache evicts them. A write during the render was rejected, because it
delays the render. An unbounded queue was rejected, because it breaks the
memory bound. Writes wait for the first Changes result and for idle Serve
work. Writes during other Serve work were rejected, because they compete with
it for the encoder leases, the transit reserve, and the disk. A pause around
sidecar calls alone was rejected, because render worker jobs and Changes would
then still compete.

Each [`render.store` record](./mokly-timings.md#core-spans) also reports the
writer's memory in bytes of capacity. `memory_queue_peak` is the highest
capacity of the pending set and the active batch. `memory_segment_peak` is the
highest capacity of the segment buffer with its fixed owner.
`memory_export_peak` is the highest simultaneous capacity of the temporary
encoding buffers, the encoder's known buffers included, and
`memory_codec_peak` is the highest capacity of those encoder buffers.
`memory_known` is the current simultaneous total of all of them, and
`memory_known_peak` is its highest value, not a sum of the separate peaks.
These fields leave out allocator rounding, free pages, the nodes of tree maps,
and the opaque workspace of the compressor. `queue_bookkeeping_charge` allows
for the tree map nodes of the pending set, and `codec_charge_peak` is the
highest encoder reservation, its opaque workspace included. Both are charges,
not measured memory.

## Entry Format

An entry holds a bounded batch of complete documents. It names the entry
format version 1, the Mokly version that wrote it, the SHA-256 digest of its
payload, and the SHA-256 digest of each document. A reader rejects another
format or Mokly version before it reads the payload. Before the store indexes
an entry that this process did not write, it checks the size of the entry and
the digest of its whole payload. Before it serves a document, it checks the
digest of that document and that the entry is still the one that it indexed.
A replaced entry is checked as a whole again. The payload is lossless: a read restores the exact bytes and
every record of the document.

One durable receipt publishes the whole entry, after all of its data is
durable, under the common rules. So a reader finds every document of an entry
or none of them.
Decision: an entry holds a batch of documents. One entry for each document was
rejected, because one durable publication for each document stores too few
documents of a render pass. Entries without durable flushes were rejected,
because they break the common durability rule. A read refreshes the whole
entry, and eviction removes the whole entry, so eviction is coarser than one
document.

## Faults

Every rejected entry is a miss, and Serve then renders the document as it
would without the store. No store fault fails a render, a publication, or a
command. The fault classes and their output are those of the
[bundle cache](./mokly-base-cache.md#bundle-entries). Each store event other
than a hit or a stored write falls into one class:

| Class        | Cases                                                                                                                                                                                                                          | Output                         | Store afterwards                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------- |
| Entry fault  | A damaged, unreadable, or foreign entry                                                                                                                                                                                        | The entry warning at each read | Stays on                        |
| Store fault  | A filesystem or platform error outside one entry, or an invalid cache location                                                                                                                                                 | The directory warning, once    | Off for the rest of the process |
| Normal event | A held entry lock at a read, a held lock at a write or at an index or access-order update, a full set of pending writes, no room or no free lease for a write, a document that left the render cache, or a cancelled operation | None                           | Stays on                        |

A damaged entry has a damaged receipt or header, a wrong size or digest, or a
document that does not decode or does not match its key. A foreign entry has another
format or Mokly version. An unreadable entry has a file that Mokly cannot
read. After an entry fault, Mokly tries once, without waiting, to remove the
rejected entry, under the removal rule of the bundle cache. The
[cache warnings](./mokly-terminal-cache.md#cache-warnings) give the text of
both warnings.

## Bound And Eviction

The render kind has its own fixed [byte bound](./mokly-timings.md#budgets).
The bound counts complete entries, the staged writes of every process, and
replaced or evicted data that is not yet deleted. Before a write, Mokly makes
room for the whole new entry: it evicts the least recently used entries first,
under the common eviction rule. When it cannot make room, it drops the write.
Decision: a fixed byte bound with access-order eviction keeps the entries that
recent Serve processes read or wrote. Its value holds several complete passes
of a large catalogue: a cold pass of a 1,508-view catalogue stored 1,494
documents in about 21 MiB. A fixed count of entries was rejected, because
document sizes vary. A setting was rejected, because no other cache bound has
one.

## Restarts And Deletion

A later Serve process for the same repository and the same build reads each
stored document whose keys are equal. It renders only the documents that are
new, changed, evicted, or dropped, and the documents that it needs before the
store is prepared.

For supported inputs, a stored document equals a fresh render, so deleting the
cache changes time only. A render that reads files, environment variables, the
clock, or random values is
[unsupported](./mokly-watch.md#invalidation-through-the-render-graph). It keeps
its stored result across restarts until its key moves, its entry leaves the
store, or the cache is deleted. Deleting the cache can then change its result.
Decision: a restart reuses the stored result of a render with unsupported
inputs. Keying these inputs was rejected, because Mokly does not observe them.
Rendering every document again after a restart was rejected, because the first
Changes then waits for the whole render pass.
