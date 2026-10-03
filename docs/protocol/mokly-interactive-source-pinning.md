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

The build records every resolution whose target is one of those files. A
request key is its normalized importer, exact resolver specifier, esbuild
resolution kind, and sorted import attributes. A repository importer uses its
safe repository-relative logical path. Node and browser virtual entries share
one stable `entry` importer identity. Configured aliases key the original
specifier and store the resolved target. Conflicting targets for one key reject
the candidate.

`ComponentRuntime.interactiveSources` carries the decoded capture. Runtime IPC
uses this exact projection:

```ts
interface InteractiveSourceCaptureMessage {
  files: readonly {
    bytes: string; // canonical padded RFC 4648 base64
    paths: readonly string[];
  }[];
  resolutions: readonly {
    attributes: readonly { key: string; value: string }[];
    importer: { type: "entry" } | { type: "repository"; path: string };
    kind:
      | "entry-point"
      | "import-statement"
      | "require-call"
      | "dynamic-import"
      | "require-resolve"
      | "import-rule"
      | "composes-from"
      | "url-token";
    specifier: string;
    target: string;
  }[];
}
```

Every path is safe repository-relative POSIX. Paths within a blob and blobs by
their first path are strictly sorted and nonempty; no path occurs twice. The
resolution list is strictly sorted by complete request key with no duplicate.
It has at most 16,384 records and 8 MiB of UTF-8 string data. A nonempty
specifier is at most 2,048 UTF-8 bytes. Each record has at most 16 uniquely
named, sorted attributes; each nonempty key is at most 256 bytes, each value at
most 2,048, and one record's keys and values total at most 4,096. Strings
contain no NUL. Repository importer and target paths are safe, each target is a
captured path, and only the listed kinds are valid.

The child validates shape, canonical base64, ordering, limits, and referential
integrity before exposing the runtime. The field is required when interactive
Serve is enabled and absent when off. Build, Check, export, publication, and an
off Serve neither install the capture hook nor retain or transfer source data.

## Browser Resolution Replay

The browser compiler uses the accepted `config.entryModules`; it never repeats
entry discovery. Before filesystem resolution it replays each recorded request
to its captured target. This covers relative, absolute, bare, configured-alias,
and repository-package requests, including extension and index selection. A
recorded Node identity remains authoritative even when browser conditions or a
repository package's `browser` field would otherwise select another file.
Unrecorded relative and absolute repository requests remain capture-only and
never probe source files.

An unrecorded bare request is resolved only to classify its target. An
installed-package target proceeds through normal browser resolution; a
repository-owned target fails as not captured, even if another captured path
has the same bytes. A linked `node_modules` package is repository-owned when
its physical target lies inside the repository and outside Mokly's runtime; a
physically installed package is not. Installed-package imports, package-local
files, Mokly runtime, and consumer React peers remain unpinned.

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
documented resolution-metadata limitation.

## Related Docs

- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Watched development](./mokly-watch.md)
- [Source protection](./mokly-source-protection.md)

## Imported Stylesheet Modules

The accepted Node graph records the JavaScript returned by Mokly's stylesheet
loader for each confined `.css` input, including installed-package CSS. A CSS Module blob contains the exact
default class map and named exports used by Static. A plain stylesheet blob is
empty JavaScript. The configured `empty` opt-out records the same empty module
or empty default map used by the Node graph. Logical and physical stylesheet
resolutions use the existing capture and IPC rules. A stylesheet symlink retains
its own logical-path module blob: Static hashes that logical path, so merging
it with the physical stylesheet's blob would change one accepted class map.
Ordinary raw-source aliases still share their physical byte blob. Installed
package JavaScript remains filesystem-resolved; only its accepted stylesheet
modules are replayed. This does not add package paths to public source inventory.

Live loads these blobs as JavaScript. It does not read stylesheet sources, run
PostCSS, scope names, emit CSS, or inject styles. The accepted Static document's
head links the generated stylesheets. Editing, deleting or breaking a source
stylesheet after acceptance cannot change that generation's bundle or generated
resources. The next accepted generation records new modules and resource bytes.
An unrecorded repository stylesheet request fails with `source-not-captured`.
Nested CSS imports and assets belong to the accepted stylesheet outputs; Live
never traverses them as JavaScript inputs.

The capture exists only in interactive Serve. It remains absent from generated
output, static evidence, public catalogue JSON, exports and publication.
