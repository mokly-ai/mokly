# Stylesheet Store

Status: The stylesheet store does not exist yet. [Milestone 2](../../plans/persistent-stylesheet-records.md#milestone-2-red-tests-and-reusable-storage) adds its entries, its bound, and its faults, and [Milestone 3](../../plans/persistent-stylesheet-records.md#milestone-3-serve-integration) adds its reads and saves in Serve.

The stylesheet store keeps the compiled stylesheet records of `mokly serve`, so
that a later Serve process can reuse them instead of compiling them again. It
is the stylesheet kind of the [Mokly cache](./mokly-base-cache.md). The
[common cache rules](./mokly-base-cache.md#cache-location-and-ownership) give
its location, ownership, receipts, durability, and eviction order. The
stylesheet cache is the memory cache of stylesheet records in each process.
Its 64 MiB bound and its reuse rules follow the
[dependency retention rules](./mokly-imported-styles-postcss.md#dependency-retention).

## Use

Serve reads and writes the store for the head side and for the base side of
Changes. The [comparison contract](./mokly-comparison.md#sides) defines both
sides. `build` and `publish` neither read nor write the store. They compile
each stylesheet root as they do without it. The store has no setting.

## Snapshots

The store keeps at most one entry for each side and each set of effective
stylesheet settings. The entry holds one self-contained snapshot of the
storable records of that side. Each record keeps its delivered stylesheet and
the results of its compile: read evidence, dependency usage, class maps, asset
records, and watch inputs. The snapshot keeps the module evidence of each
PostCSS context once, for all records of that context, as the stylesheet cache
does.

Each record keeps the stamps of its original compile. Each entry of context
evidence also keeps its original stamps. A read never takes new stamps from
the current tree.
Decision: a stored record keeps its original stamps. New stamps at the read
were rejected, because the record would then match the tree that checks it. A
change between the two processes would then go unseen.

A save replaces the entry of its side and settings with a new snapshot. The
new snapshot holds the storable records that the stylesheet cache of the side
keeps when the save runs. A record that the cache no longer keeps is absent.
The head and each base have separate entries, also when their settings are
equal. A save of one side never replaces the entry of another side. A base can
still reuse an equal plain-CSS record of the head in memory, after the checks
of its own side.
Decision: the store keeps one self-contained snapshot for each side and
settings. One entry for each root was rejected, because its scans, durable
writes, foreign-entry warnings, and context copies grow with the number of
roots. Separate entries for context evidence were rejected, because dependent
entries need their own publication, eviction, and fault rules. One entry for
two sides with equal settings was rejected, because a save of one side would
then replace the records of the other side.

## Admission

The store admits each record on its own evidence. A save stores a record only
when its compile succeeded and its evidence is complete and stable. This is the
admission standard of the [bundle cache](./mokly-base-cache.md#stable-capture).
A `postcss` module in the configuration excludes no record by itself.

Evidence is complete when it witnesses every input that the compile read, and
each resolver probe and absence that selected those inputs. A record that holds
a PostCSS result is complete only when the
[read evidence](./mokly-sidecar-postcss.md#read-evidence) of that result
reports complete coverage. A declaration, a late digest, or an equal list of
file names is not a read witness. No step marks evidence complete when its
compile reported it as incomplete.

Evidence is stable when its checked paths keep their identity and change stamps
from their first observation until after the compile. The checked paths are
each directory on the path to a recorded input, and each recorded configuration
or manifest file. The file systems and the known limit of the
[stable capture rule](./mokly-base-cache.md#stable-capture) apply. A stylesheet
compile never waits for stability. A change too recent for the time resolution
of the file system makes the evidence unstable.

Bytes that a base side reads from its pinned commit cannot change. The captured
identity of that commit proves their stability, with no file-system stamp.
Mutable inputs on the file system, such as dependencies, modules, and
configuration files, still need the checks above.

A record with incomplete or unstable evidence stays in memory only. It keeps
each reuse rule of the stylesheet cache inside its process. A later process
compiles it again. Mokly prints nothing for it. This rule includes each record
with an opaque PostCSS result, which is a result whose read evidence reports
incomplete coverage. Under the read evidence rules, every PostCSS result is
opaque.
Decision: the store uses the admission standard of the bundle cache. Storing
incomplete or unstable evidence was rejected, because a later process cannot
check a read that escaped observation or changed during the capture. A rule
that also limits reuse inside a process was rejected, because a process would
then lose reuse that it has without the store.
Decision: the store admits each record on its own evidence. An exclusion of
every record of a `postcss` configuration was rejected, because some roots run
no PostCSS. Proven complete coverage can also admit a PostCSS result.

## Identity

Each entry has a key. The key covers the side, the physical source root of the
side, its effective stylesheet settings, and the build identity. The settings
are the configuration, the module resolution and CSS resolver settings, and
the physical paths of the selected dependency roots and repository roots.
Serve reuses an entry only when each part equals that of the side that it
prepares.

The build identity covers:

- The platform and the build of the native core, as for the
  [render store](./mokly-render-store.md#identity).
- For a configuration with a `postcss` module, the
  [toolchain identity](./mokly-sidecar-recipes.md#reuse-and-identity) of the
  sidecar and a digest of the effective environment of the PostCSS child.

The digest covers each variable that the PostCSS child receives under the
[source worker environment rule](./mokly-sidecar-modules.md#source-root-workers).
Mokly never stores or logs an environment value. A changed digest is a normal
miss. A configuration without a `postcss` module has no environment part, and
the store starts no sidecar process for it.
Decision: the digest covers the whole effective environment of the child. A
list of allowed variables was rejected, because a consumer plugin can read any
variable, and the default `optimize` of Tailwind follows `NODE_ENV`.

When the build identity of a side is unavailable, the side neither reads nor
writes the store. Serve then compiles as it does without the store.

## Reads

Before a side compiles a root that has no record in memory, it reads its
entry. Each side reads its entry at most once in each process. The read adds
records only to the stylesheet cache of its own side. The added records count
toward the 64 MiB bound of that cache and follow its eviction rule. The read
streams the entry and keeps no second complete copy of it. Its other memory is
a fixed amount that does not grow with the entry.

Each loaded record passes the same reuse checks as a record that the process
compiled, against the current tree of its side. A base side checks its records
against its pinned Git sources. No check accepts a record from equal
modification times alone. A record that fails a check compiles again. A record
that passes runs no compile. It gives the stylesheet, evidence, dependency
usage, class maps, assets, and watch inputs of its original compile.

A record in memory whose stamp no longer matches compiles again at once. It
never causes a read of the entry.
Decision: a record in memory that fails its checks compiles without a read of
the entry. A read was rejected, because the entry holds the same record or an
older one, so each edit would read a stale entry.

No read waits for a lock or a save. A held entry lock turns the read into a
miss, also when the holder works on another entry that shares the lock. The
first read of the store in a process reports the cache directory, also when it
finds no entry. The [cache output rule](./mokly-terminal-cache.md#cache-directory)
says when that line prints.

## Saves

After a preparation of a side, Serve offers the side for a save. A save encodes
the snapshot of its side, and then it publishes the entry. Saves use the writer
and the gate of the [render store](./mokly-render-store.md#writes). The writer
starts an encoding or a publication only after Serve completes its first
Changes result, and only while Serve is idle. It checks the gate again before it
starts each publication. An encoding or a publication that already started may
finish. A save that ends before its publication, such as at shutdown, is a
skipped save. No Serve preparation, render, or state publication waits for a
save.

A pending save holds no copy of a record, and it keeps no side alive. A save
takes the records from the stylesheet cache of its side when it runs. When
Serve releases the side first, Mokly drops the save. A save streams its entry.
It keeps no second complete copy of the records or of the entry, and it
releases its buffers when it ends. No save waits for a lock, so a held lock
skips the save. Shutdown drops the pending saves.

When the records of a side equal the records of its entry, the save ends
without a write. It reads no payload and does not change the eviction order. A
snapshot above the [entry ceiling](./mokly-timings.md#budgets) is not written.
The stylesheet store and the render store keep separate bounds, entry formats,
faults, and counts.
Decision: stylesheet saves and render store writes share one writer and its
gate. A writer for each kind was rejected, because the two writers could then
flush to disk at the same time.

## Entry Format

The data of an entry is one file. Its first line is that of a
[bundle entry](./mokly-base-cache.md#bundle-entries). It names the entry format
version 1, the Mokly version that wrote it, and the SHA-256 digest of the
payload. A reader rejects another format or Mokly version before it reads the
payload. A file above the entry ceiling is rejected before its payload is read.
A read checks the payload digest, and then the side and the settings of the
payload against its key, before it uses a record.

The receipt of an entry holds a publication id, under the bundle rule, and a
SHA-256 digest that names the records of its snapshot. One durable receipt
publishes the whole entry, so a reader finds every record of an entry or none
of them.

## Faults

Every rejected entry is a miss, and Serve then compiles as it would without the
store. No store fault fails a preparation, a publication, or a command. The
fault classes and their output are those of the
[bundle cache](./mokly-base-cache.md#bundle-entries). Each store event other
than a hit or a stored save falls into one class:

| Class        | Cases                                                                                                                                                                                                                                              | Output                         | Store afterwards                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------- |
| Entry fault  | A damaged, unreadable, or foreign entry                                                                                                                                                                                                            | The entry warning at each read | Stays on                        |
| Store fault  | A filesystem or platform error outside one entry, or an invalid cache location                                                                                                                                                                     | The directory warning, once    | Off for the rest of the process |
| Normal event | A held lock, no room for a save, a snapshot above the entry ceiling, incomplete or unstable evidence, an unavailable build identity, a changed environment digest, a record that fails its checks, a released side, or a skipped or cancelled save | None                           | Stays on                        |

A damaged entry has a damaged receipt or first line, or a wrong size or digest.
It can also have a size above the entry ceiling, a payload that does not
decode, or a side or settings that do not match its key. A foreign entry has
another format or Mokly version. An unreadable entry has a file that Mokly
cannot read. After an entry fault, Mokly tries once, without waiting, to remove
the rejected entry, under the removal rule of the bundle cache. The
[cache warnings](./mokly-terminal-cache.md#cache-warnings) give the text of both
warnings.

## Bound And Eviction

The stylesheet kind has its own fixed [byte bound](./mokly-timings.md#budgets).
The bound counts complete entries, the staged writes of every process, and
replaced or evicted data that is not yet deleted. Before a save, Mokly makes
room for the whole new entry. It removes the replaced entry first, then evicts
other entries under the common eviction rule. When it cannot make room, it
skips the save.

## Restarts And Deletion

A later Serve process for the same repository and the same build identity reads
the entry of each side. It compiles only the roots that the entry does not hold
and the roots whose records fail their checks. An entry holds no record with
incomplete or unstable evidence. It also lacks each record that the stylesheet
cache dropped before the save, and each record of a skipped or dropped save.

Deleting the cache directory removes every stylesheet entry. A later process
then compiles every root again. The store keeps only records whose evidence a
later process can check. So the deletion changes time only, within the known
limit of the stable capture rule.
