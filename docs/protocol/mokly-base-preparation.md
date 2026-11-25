# Base Source And Dependency Preparation

This page defines how Mokly prepares the sources and the dependencies of the
base side. The [comparison contract](./mokly-comparison.md#sides) owns rendered
sides. The [Git runtime](./mokly-git.md) owns history, blobs and extraction.

## Sources

Base preparation reads one pinned commit. Base reads have separate bounds for
regular files and for total tree nodes. A root listing keeps each file's actual
POSIX spelling, lists each file once, and applies the file count bound. An
empty root list reads nothing. An explicit whole-tree root lists all regular
files. Root ownership, globs, and source diagnostics follow the catalogue
rules. Every base read returns checkout-converted bytes.

HTML, Markdown, YAML and CSS need no extraction. A base that needs
JavaScript, a renderer module, consumer PostCSS, or the
[Vite adapter](./mokly-vite-adapter-styles.md#catalogues-without-javascript)
extracts its sources. A base with a root without `dir` extracts them before
discovery, because its `main.*` loads from them under the
[roots from `main.*` rules](./mokly-root-discovery.md#roots-from-main). A
source archive copies checkout-converted regular files
with the pinned commit's attributes, including line endings, smudge filters,
and Git LFS downloads. Network access is allowed within the preparation
limits. The disk use of an extraction stays within the source cache capacity.
Memory use stays bounded independently of repository size. The comparison of
an opaque public resource also uses bounded memory, whatever the size of the
resource. The resource closure checks that each opaque resource is a confined
regular file. Only HTML and CSS files need reference parsing.

While a base preparation leases a complete extraction of the base commit,
base reads use the files of that extraction, which hold the same
checkout-converted bytes. A file that the extraction does not hold, such as a
name that the host cannot store, reads through Git. A read uses an extraction
file only while the file is unchanged since the process first leased that
extraction. Base code, such as a PostCSS plugin, can change a file in the
extraction, and that file then reads through Git, so base witnesses still
compare with the pinned Git bytes. Decision: check each file against its first
fingerprint in the process. Rejected: hashes through Git for every file,
because that is the per-file cost that the extraction removes. Rejected: a
content manifest in the cache entry, because it changes the cache format. A
complete cache entry is trusted when the process first leases it, as the
sidecar trusts it. Before it loads the base
configuration, a preparation leases an existing complete extraction when the
working configuration names a renderer or a PostCSS module. Under the Vite
adapter, a local stylesheet that the working configuration names also selects
that lease. That lookup never builds an extraction. Decision: lease only an
existing extraction before the configuration loads. Rejected: a build at that
point, because a base that needs no sidecar would then get an extraction.
Rejected: a switch only after the dependency step, because configuration and
discovery would keep their Git reads.

If a remaining tree, file, or command budget prevents comparison, Changes is
unavailable. The diagnostic names the requested path or root and the limit.
The current build remains valid. Genuine Git command and object failures
remain fatal `git-failed` errors. A failed, timed out, or oversized conversion
makes that resource unavailable with a `base-conversion` warning, while other
base resources continue. Unavailable bytes cannot prove a resource change.
User-configured filters run with the same Git configuration as dependency
clean conversion. Raw blobs and offline-only smudge are not substitutes for
checkout bytes. Each conversion has a 120-second allowance. A failed fetch of
missing objects names the recovery command.

## Shared Render Runtime

The head and the base render with the current Mokly version. One cancellation
stops both sides of a classification, including Git reads, extraction,
installation, early renders, comparison, and public resource planning. A base
that Serve keeps follows the [kept base cancellation rule](#cancellation)
instead. HTML without a renderer, PostCSS, or the Vite adapter follows the
[HTML dependency policy](./mokly-comparison.md#html-package-styles).

Static commands verify their source evidence before early renders start.
As soon as the fresh base preparation of a classification knows its document keys, it lists each
view whose key is absent from the [render cache](./mokly-runtime.md#render-graph-and-cache)
and the prepared [render store](./mokly-render-store.md). The listing restores no view. Early renders of the listed views then
start immediately. The limit of early renders that run at the same time is at
least one. It cannot exceed the [sidecar capacity](./mokly-sidecar-memory.md#capacity).
Early renders publish nothing. The
[capture](./mokly-comparison-serving.md#base-and-head-capture) takes each result
at the view's turn. It waits for an early render that still runs instead of a
second render.
Decision: early renders start when the keys are known. Rejected: listed views
first in the capture window, because they would wait for the rest of preparation.

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

## Serve Base Lifetime

Serve keeps the last prepared base in memory between classifications. The
kept base is the captured base with its render graph, its sources, its
leases, and its sidecar bundle. Serve keeps at most one base. `build` and
`publish` keep no base.

A classification reuses the kept base while its key and its
[freshness checks](#freshness-checks) hold. The key is the merge-base commit,
the adopted working configuration, and the effective install-scripts setting.
A reuse loads no base configuration, discovers and validates no base sources,
and prepares no base graph. It captures no base view again, and it publishes
no `preparing` status. A view that the kept capture does not hold renders
again through the kept base, as a capture miss does. A failed lookup of the
base ref keeps the kept base.

Serve keeps a prepared base only when its preparation and its capture succeed
without a source failure and without a `base-conversion` warning. It keeps no
base whose files have a `filter` attribute, because an external filter can
give other bytes later, as the
[cache contract](./mokly-base-cache.md#converted-source-identity) says. It
keeps no base whose dependencies fell back for a reason that a later attempt
can fix: a failed install, the time limit, a cache failure, or the cache size
limit. It keeps a base that fell back for a lasting reason, such as an
unsupported package manager.

Decision: keep the captured base with its graph, sources, leases, and bundle.
Rejected: the capture and the catalogue only, because the views that the
capture does not hold could then not render.

### Freshness Checks

Before each reuse, Serve checks that a fresh preparation would give the same
base:

- The working manifests and lockfiles that select the base dependencies are
  unchanged, and the head uses the same dependency directories.
- For a base that reads the working install, the install record and the
  entry list of each working `node_modules` directory that it reads are
  unchanged. Tier 1, tier 3, and an HTML-only base read the working install
  under the
  [package tiers](./mokly-comparison-packages.md#javascript-package-selection).
  A tier-2 base reads its own install.
- For such a base, each installed module that the base bundle and the head
  bundle both read has the same digest on both sides.
- The effective checkout settings of the base commit are unchanged: the Git
  configuration and the attributes of each file. A preparation samples them
  before its first base read.

A failed check releases the kept base, and the classification prepares a new
base. The checks do not see these changes:

- A change to a package stylesheet, an asset, or a file that only the base
  reads, while the install record and the entry list stay equal.
- A Bun install, or a hand edit inside `node_modules`, while the entry lists
  stay equal and the current head bundle shows no change in a module that
  both bundles read.
- An installed-module change after the last head bundle.
- A package manager that the user installs after a lasting fallback.

A Serve restart or a key change prepares the base again. A Git configuration
write that changes no checkout setting, such as a new upstream, also releases
the kept base.

Decision: compare the installed-module digests of the two bundles, with the
install records and the entry lists. Rejected: the input stamps of the base
runtime, and a new digest of each installed file that the base read, because
nobody measured their cost and the stamps still miss inputs. Decision:
compare the checkout settings before each reuse. Rejected: keep the settings
of the preparation, because a fresh preparation reads with the current
settings.

### Cancellation

While Serve prepares a base, the cancellation of its
[owner](./mokly-eager-base-preparation.md#ownership) stops all of its base
work. When Serve keeps the base, the base detaches from that owner, and only
the stop of Serve stops it. Early renders never detach. Each one ends before
its classification ends, so the kept base holds none. Each reader of the kept
base, a classification or a selected capture, checks its own cancellation
before each call to the base. A call that already runs finishes after its
reader is cancelled: a Git read, a sidecar call, a render, or a wait for
sidecar admission. The kept base stays usable for the next reader.

Decision: detach the base when Serve keeps it. Rejected: release the base
after any cancelled read, because each edit during a classification would
lose the base. Rejected: a cancelled read that records no source failure,
because one reader could then stop a read of another reader.
Decision: early renders stay with their classification. Rejected: early
renders that detach with the kept base, because they could then use sidecars
and memory after their classification ends.

### Release

Serve releases the kept base on each of these events:

- a merge-base move or another change of the key,
- a failed freshness check,
- a base error or a source failure,
- a dependency fallback that Serve does not keep,
- a failure of the kept base during a reuse,
- the stop of Serve.

A classification with another key releases the kept base before it prepares
a new one. In-flight work, such as a selected capture, can still hold an
older base until it ends. The kept capture stays within the
[base capture bound](./mokly-comparison-serving.md#base-and-head-capture).

When the kept base fails during a reuse, for example because a resource
changed since its first read or its bundle cannot load again, Serve releases
it. The same classification then prepares a new base once, and not more. A
failure of the head side or a cancelled reader keeps the kept base.

Decision: release the kept base with the state of Serve when Serve stops.
Rejected: a separate release step in the shutdown order, because it frees
nothing more. Rejected: an idle time limit, because the published
classification holds the same base while it is current. Decision: one new
preparation in the same
classification after a failure of the kept base. Rejected: an unavailable
result, because Changes would stay unavailable until the next edit.

## Cache Location And Ownership

The [cache contract](./mokly-base-cache.md) defines the location, bounds,
ownership, completion, reuse, and cleanup of source and dependency entries.

## Dependency Identity

The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines clean identities, supported managers, and installation cache keys.

## Installation And Bundle Settings

See [Base Installation And Bundle Settings](./mokly-base-installation-and-bundle-settings.md).
