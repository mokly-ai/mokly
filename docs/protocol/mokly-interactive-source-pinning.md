# Interactive Views: Generation-Pinned Sources

## Status And Scope

Implemented for Live browser bundles in watched Serve. This contract owns the
accepted repository-byte capture, recorded resolution replay, limits,
retention, and failure behavior. The
[Serve delivery contract](./mokly-interactive-views-serve.md) owns the listener,
bundle lifecycle, and readiness transport.

## Accepted Source Capture

When Serve resolves `interactive: "serve"`, the Node consumer-graph build
captures the exact bytes returned for every repository-owned file input before
tree shaking. The capture uses the source-inventory ownership rule: entry,
renderer, transformer, local helper, JSON, and configured-loader inputs are
included. Ordinary Mokly runtime and installed-package files are excluded;
accepted stylesheet JavaScript follows the exception below. Logical and
physical in-repository aliases share ordinary raw-source blobs. Stylesheet
modules retain the logical identity defined below. Capture occurs
in the same load that produces the accepted graph, never in a second disk pass,
and is sealed only after graph evaluation and registry/index validation
succeed. A capture failure rejects that candidate generation.

The build records requests from entry and repository importers whose target is
one of those files. It also records requests from installed importers when the
target is a saved stylesheet module or a captured repository-owned file,
including a linked workspace package reached through `node_modules`. A
request key is its normalized importer, exact resolver specifier, esbuild
resolution kind, and sorted import attributes. A repository importer uses its
safe repository-relative logical path. Node and browser virtual entries share
one stable `entry` importer identity. An installed importer uses
`{ type: "installed", path }`, with the same safe logical path relative to
`repoRoot`. Both builds preserve symlinks and use the same path-location helper:
physical paths under a symlinked root map back to that root's logical path;
both logical and physical paths must stay inside the root; physical package
code must lie under `node_modules` and outside Mokly's runtime. This preserves
package aliases and pnpm layouts without merging distinct logical importers.
Installed records cannot target physically installed JavaScript or a target
that the capture loader did not save. Configured aliases key the original
specifier and store the resolved target. Conflicting targets for one key reject
the candidate.

`ComponentRuntime.interactiveSources` carries the decoded capture. The
[accepted capture IPC contract](./mokly-interactive-source-capture-ipc.md)
defines the exact projection, canonical base64, ordering, shapes and bounds.
Installed targets must be saved `.css` modules or repository-source blobs
with a physical alias outside `node_modules`; logical linked-package aliases
of those blobs are valid targets. The existing request limits and retention
are unchanged. The field is required in interactive Serve and absent while
off. Build, Check, export and publication do not capture or transfer it.

## Browser Resolution Replay

The browser compiler uses the accepted `config.entryModules`; it never repeats
entry discovery. Before filesystem resolution it replays each recorded request
to its captured target. This covers relative, absolute, bare, configured-alias,
and repository-package requests, including extension and index selection. A
recorded Node identity remains authoritative even when browser conditions or a
repository package's `browser` field would otherwise select another file.
Unrecorded relative and absolute repository-source requests fail as not
captured, including requests for already saved blobs. Stylesheet modules keep
the captured-path fallback below.

Live skips installed importer lookup when the record has no installed requests.
Otherwise it indexes their importer paths. An importer inside the logical root
has the same POSIX relative path in the cheap check and full normalization;
only a recorded path triggers full package and confinement validation. Paths
outside the logical root use full normalization because a symlinked root's
physical path can still map to a recorded logical importer. Only a validated
recorded identity can replay a request. Positive and negative results are cached
for that resolver instance; no specifier-extension filter limits this lookup.

An unrecorded bare request is resolved only to classify its target. An
installed-package target proceeds through normal browser resolution; a
repository-owned target fails as not captured, even if another captured path
has the same bytes. A linked `node_modules` package is repository-owned when
its physical target lies inside the repository and outside Mokly's runtime; a
physically installed package is not. Installed JavaScript, package-local
non-stylesheet files, Mokly runtime, and consumer React peers remain unpinned.

Every unrecorded repository file load is checked before esbuild can read source bytes.
The Go-side filter includes logical and physical repository roots, captured
aliases and every symlink prefix under the root's `node_modules`. It scans
ordinary installed directories recursively without following links. A module
under that installed root can be repository-owned only through a symlink;
the filter includes the entire subtree at its first link. This also covers
file links, nested dependencies, pnpm aliases and outside links back into the
repository. A failed scan includes the affected subtree. Other repository
paths stay eligible, including nested `node_modules` outside the scanned root.
The filter is rebuilt for each bundle. Windows uses a broad filter and the
full ownership check to preserve its path case rules.
Directory entries, ownership and symlink projections are cached for one bundle; ordinary
installed modules need no per-module realpath. File and directory symlinks
still follow the same physical ownership rule. A missing entry or metadata
error falls back to full classification. Only a refused repository load
uses an extra resolution pass to identify its incoming importer. A module that
only browser conditions or an installed `browser` field selects has no accepted
requests. Its linked-repository imports fail with `source-not-captured`, even
when the target's blob was saved through a different importer. Outside-root
installed importers also lack a confined identity and fail this way when their
unrecorded request resolves to repository source. Outside-root non-CSS source
is outside repository pinning; installed JavaScript remains unpinned.

Recorded requests do not reread resolution metadata. `tsconfig.json` settings
and repository-package imports, exports, conditions, or browser fields can
affect only a request absent from the record. Such a request may resolve
differently or fail until the next accepted generation; captured module and
loader-input bytes remain pinned.

A browser request for an uncaptured repository module fails with typed code
`interactive-bundle`, reason `source-not-captured`, and repository-relative
`module` plus optional `importer`. Its terminal message is
`accepted Live sources do not contain <module>` followed by
` (imported by <importer>)` when known. Classification never matches message
text. The generation enters ordinary cached `failed` state and returns its
consumer-text-free 503; Static documents and rebuild status remain healthy.

## Retention And Memory Bounds

The interactive child retains the current and immediately previous captures,
including resolutions, and evicts each with its bundle state when a third
generation arrives. Reload/restart generations reuse the capture object;
distinct records do not copy it. Eviction aborts obsolete compilation and
releases the capture after the request settles. The supervisor retains only
the current capture required to recover a child.

If `Sg` is the sum of distinct decoded blobs for generation `g`, steady child
bytes are bounded by `Scurrent + Sprevious`, parent bytes by `Scurrent`, and
candidate preparation adds only its capture. Resolution metadata follows the
same two/one-generation retention. IPC adds one transient padded-base64
projection plus bounded resolution, path, and JSON metadata, discarded after
decoding. File bytes have no lower arbitrary ceiling: accepted consumer input
defines `Sg`, while generation count and copies remain bounded.

## Verification

Tests accept generation G, then edit, delete, and syntactically break source
before G's first Live request and require byte-identical G output; the next
accepted generation must see the edit. Coverage includes entry discovery,
configured aliases, linked repository packages, browser-only repository
resolution, symlink retargeting, installed packages, uncaptured-request failure,
strict IPC validation, reuse and eviction, complete absence while off, and the
documented resolution-metadata limitation. Installed stylesheet tests cover
relative and package-name self-references through `exports`, CSS Modules and
plain CSS, repository importers of installed CSS, edits, deletion, syntax
errors, and later accepted generations. They also cover symlinked roots, pnpm
package aliases, unpinned JavaScript, browser-only installed modules, outside
root boundaries, empty-loader modules, importer lookup fast paths, strict
installed-importer IPC bounds, and exclusion from
generated output, static evidence, public JSON, export and publication. The
installed-to-linked-source tests cover edits, deletion, syntax errors, later
generations, export metadata, all unrecorded source requests, browser-only
importers, symlinked roots, pnpm paths, unpinned installed code, IPC repository
alias validation, cached ownership parity, and Go-filter coverage of every
repository path, including unreadable directories and new file links. The example Live bundle must
retain its previous bytes; first and repeat timings measure the extra checks.

## Related Docs

- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Watched development](./mokly-watch.md)
- [Source protection](./mokly-source-protection.md)

## Imported Stylesheet Modules

The accepted Node graph records the JavaScript returned by Mokly's stylesheet
loader for each confined `.css` input, including installed-package CSS. A CSS Module blob contains the exact
default class map and named exports used by Static. A plain stylesheet blob is
empty JavaScript. The configured `empty` opt-out records the same empty module
or empty default map used by the Node graph. Entry, repository and installed
stylesheet requests use one capture-and-replay rule: save the exact request
identity and replay its recorded target before filesystem resolution. This
covers relative and package-name imports, including package self-references
through `exports`. A stylesheet symlink retains
its own logical-path module blob: Static hashes that logical path, so merging
it with the physical stylesheet's blob would change one accepted class map.
Ordinary raw-source aliases still share their physical byte blob. Installed
package JavaScript remains filesystem-resolved; its accepted stylesheet and
repository-source requests are replayed. Stylesheet capture does not add
installed package paths to public source inventory.

Live loads these blobs as JavaScript. It does not read stylesheet sources, run
PostCSS, scope names, emit CSS, or inject styles. The accepted Static document's
head links the generated stylesheets. Editing, deleting or breaking a source
stylesheet after acceptance cannot change that generation's bundle or generated
resources. The next accepted generation records new modules and resource bytes.
An unrecorded request keeps the existing captured-path fallback and normal
resolution. A resolved stylesheet loads only its captured JavaScript; an absent
blob fails with `source-not-captured`. Live never reads CSS from disk.
Nested CSS imports and assets belong to the accepted stylesheet outputs; Live
never traverses them as JavaScript inputs.

An installed `browser` condition or field can select JavaScript that the Node
graph did not load. Its identity has no recorded requests. A relative request
that matches a captured path can still replay it. A package-name request must
resolve normally before the CSS load hook can find a captured blob. It can
succeed with a captured target that still resolves, but deletion or changed
metadata can fail resolution. An existing uncaptured target fails with the
typed diagnostic. These unrecorded requests have no resolution-pinning promise.

Imported-style processing rejects stylesheet inputs outside `repoRoot`,
including links that escape the root. Outside stylesheets never have captured
blobs. The `empty` opt-out can accept an extensionless outside-root stylesheet
request without processing CSS, but its Live load still fails with
`source-not-captured` when normal resolution succeeds. Installed
importers outside the root have no safe confined identity. They can import
confined CSS, but their requests stay unrecorded and follow the fallback above.
An outside-root stylesheet selected only by the browser also lacks a blob and
fails with `source-not-captured` if normal resolution succeeds.

The capture exists only in interactive Serve. It remains absent from generated
output, static evidence, public catalogue JSON, exports and publication.
