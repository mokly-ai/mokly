# Portable Viewer Namespace And Version Gates

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Paths And Single Ownership

`mokly-viewer/` is the root of every package-owned public and Serve route.
The model crate defines the directory names once in `namespace`, beside the
`mokly-generated` document prefix, and the generated TypeScript of
`@mokly/viewer/data` carries them in its generated `Namespace` module; every path builder of the binary and of
the viewer uses that one definition. Identifiers, DOM attributes, and
protocol names that contain `mokly` are fixed.

| Path below `mokly-viewer/`                                   | Purpose                                                         | Where         |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------- |
| `index.json`                                                 | the catalogue index v7                                          | Serve, output |
| `entries/<entry path>.json`                                  | one entry detail v1 per current entry                           | Serve, output |
| `diffs/generations/<generation>/review.json`                 | review result v8                                                | Serve, output |
| `diffs/generations/<generation>/entries/<entry path>.json`   | the entry detail v1 of a removed entry                          | Serve, output |
| `diffs/generations/<generation>/snapshots/**`, `previews/**` | snapshot documents and resources, removed page preview metadata | Serve, output |
| `client/**`, `shell.css`, `fonts/**`                         | the shell bundle, the inspector, styles, and fonts              | Serve, output |
| `live.json`                                                  | the live descriptor v3                                          | Serve only    |
| `events`                                                     | the event stream, one message per publication                   | Serve only    |
| `diffs/review.json`                                          | the on-demand selected comparison and removed preview endpoint  | Serve only    |
| `components/**`                                              | live controls and transient component renders                   | Serve only    |

The [shell delivery contract](./mokly-shell-delivery.md#routes) owns the
first two rows and the stub routes `/`, `/view/<route>`, and `/404.html`; the
[comparison serving](./mokly-comparison-serving.md),
[removed previews](./mokly-removed-previews.md),
[on-demand](./mokly-on-demand.md), and
[component controls](./mokly-component-controls.md) contracts own the others,
with their authentication, retention, and generation identity rules. Per-view
usage, resource evidence, and the workspace lists travel in the entry
details, and the navigation tree and the Changes marks in the index; no route
exists for them beside those two. `<generation>` is 64 lowercase hex
characters for a complete generation; the nested segment is `generations`,
and no deployed segment that Mokly chooses starts with `_`. Snapshot and
preview names come from the
[artifact path contract](./mokly-artifact-paths.md).

The static output, the ownership inventory, the upload metadata, Plan
archives, and Blob reconstruction use these exact paths without a leading
slash; HTTP URLs prepend `/`:

```text
mokly-viewer/index.json
mokly-viewer/entries/<entry path>.json
mokly-viewer/diffs/generations/<64 lowercase hex>/review.json
mokly-viewer/diffs/generations/<64 lowercase hex>/entries/<entry path>.json
static/mokly-generated/<document route>
static/<catalogue-relative authored closure file>
```

The static output never contains `live.json`, `events`, `diffs/review.json`,
`components/**`, or any other live capability. The upload Plan contains only
`mokly-upload.json`, `.mokly-export-artifact`, and the optional pinned review
file, without a full-artifact upload; Blob digest, size, and snapshot
accounting follow the [upload exchange](./mokly-upload-exchange.md). Every
producer and consumer uses the one path definition: catalogue references,
frame URLs, the inspector, geometry and navigation checks, CORS allowlists,
deployment hashing, receiver fixtures, archive assertions, and provider
adapters. `/view/` and `/static/` keep their meanings. No other file or alias
exists under `mokly-viewer/`, and a host does not rewrite another path to the
index.

## Public Paths

The public paths of a catalogue are `mokly-viewer/index.json`,
`mokly-viewer/entries/**`, `static/**`, `mokly-viewer/client/**`,
`mokly-viewer/shell.css`, `mokly-viewer/fonts/**`, and the immutable
generations under `mokly-viewer/diffs/generations/**`. Serve answers
`live.json`, `events`, `diffs/review.json`, and `components/**` to the
same-origin shell only, outside the public paths. The public paths keep ordinary path confinement and grant no
access to sources, controls, or the watcher.

## Version Matrix

Versions identify meaning before a reader interprets any path. The supported
versions are:

| Boundary                      | Writer | Reader policy                                |
| ----------------------------- | ------ | -------------------------------------------- |
| Catalogue index               | 7      | Require 7 before entry and path validation   |
| Entry detail                  | 1      | Require 1 before reading entry fields        |
| Live descriptor               | 3      | Require 3 before using the render capability |
| Review result                 | 8      | Require 8 before reading comparison content  |
| Removed page preview metadata | 3      | Require 3 before resolving a document        |
| Export ownership marker       | 3      | Accept 3 for upload and output replacement   |
| Upload metadata envelope      | 2      | Strict current fields and namespace          |
| Plan response                 | 1      | Content-delta exchange                       |

The [combined version inventory](./mokly-format-versions.md) lists every
boundary, including the inspector wire version. Unknown versions fail closed.
The index carries `deploymentId`, `revision`, and `comparisonUrl`, and a page
embeds no state; no other envelope exists.

Index v7 carries identity-only entries: no layout prefix, per-entry route,
`documentPath`, or `fragmentPath`. A reader derives every file from the
entry's path, viewport, and scheme through the artifact path contract. The
index carries no `usage` and no `resourceEvidence`, and its reader rejects
either field anywhere; the detail carries them. Ownership v3 uses the
`{ path, sha256, size }` inventory with its limits, collision rules,
classification precedence, content-delta semantics, and duplicate-JSON-key
checks. Upload v2 requires the strict field list, limits, metadata identity,
the `mokly-viewer/` namespace, and the null-without-comparisons rule, even for
a current-only output; an output without a comparison path does not bypass
the gate.

## Compatibility Failure

A receiver that does not support ownership v3 or upload v2 rejects the upload
with HTTP 426 before it validates paths or creates a publication, after
bounded archive parsing, authentication, and upload-limit checks. The CLI
maps 426 to `upload-unsupported-version` with this exact message:

```text
The catalogue service does not support this Mokly version. Update the service and try again.
```

It does not retry, send Blobs, call Complete, downgrade, or expose a response
body. For local output replacement, a marker with an unsupported version
fails before mutation with
`[mokly/export-invalid] Invalid export ownership inventory: <output>.`
Missing ownership and unsafe filesystem entries have separate errors. The
marker is required for upload and local replacement.

A viewer given an index, a detail, a live descriptor, or a review with
another version rejects it before it derives a `/static/` URL or reads an
entry field. The viewer exposes a typed version failure that a host can
distinguish from malformed data; its diagnostic is
`Unsupported Mokly <boundary> version <version>; this viewer supports version <supported>.`
with boundary `catalogue`, `detail`, `live`, or `review` and the table's
supported version. A rejected review produces no comparison panes and leaves
Current available; a malformed current result is invalid data, not a version
failure. No reader infers a version from file existence or falls back to
another URL.

The standalone shell presents a version failure in its mount element as
`This catalogue needs a compatible Mokly viewer. Update the viewer and reload.`
and logs the diagnostic separately; it renders no navigation and no frame
after a rejected index or detail. The embedded viewer reports `onError` with
`code: "version"`, the same product message, and optional `details` with the
typed diagnostic. Other error codes and messages are unchanged. `ViewerError`
is:

```ts
interface ViewerError {
  code:
    "catalogue" | "version" | "selection" | "frame" | "comparison" | "markers";
  message: string;
  details?: string;
}
```

One build ships its own matching browser bundle, so a host must not
substitute a cached, independently versioned client. An existing static
output keeps its own bundled viewer at its own deployment; running `build`
again updates both. Mokly Cloud implements upload validation, stored path
lookup, index and detail fetch URLs, and the embedded viewer's version error
for these versions; a receiver that does not rejects publication with 426.
Receiver deployment is independent of a local build.

## Names And Acceptance

Fixed deployed names that Mokly chooses must not start with `.`, `_`, `#`, or
`~`. This applies to the viewer namespace, `entries`, `generations`,
`snapshots`, `previews`, `mokly-generated`, and every other fixed segment
Mokly writes. It adds no validation rule for authored closure names, entry
paths, or repository paths mirrored below `styles/` and `assets/`; those
user-chosen names keep their path validation and diagnostics, including
hidden-segment rejection, and no accepted authored path is rejected or
renamed for this policy.

Plain Mokly directory names do not make every consumer path portable to every
host. GitHub Pages with Jekyll, for example, omits a user-chosen name that
starts with `_`. Consumers configure their host or choose compatible authored
names; `build` adds no error for this caveat.

The root `.mokly-export-artifact` is the optional deployment marker: a static
host may omit it because the viewer never reads it, while upload and local
output replacement require it. Other dot-prefixed fixed names belong to the
static build's output transaction; they are local state and are never
deployed. Provider metadata is optional host configuration and never a
visitor dependency.

Regression tests cover an old receiver rejecting a new current-only and a
Changes-enabled upload, new readers rejecting old and unknown versions before
any path use, and ownership v3 fixtures with explicit unsupported-v2 cases;
Plan v1 retry, keep-first, delta, and cancellation tests stay. No source
enters any output. Smoke-test Serve, a plain static server with the optional
marker removed, and a publication Plan, Blobs, and Complete round trip. Keep
the build and upload regression on the example output: inspect every segment
of its complete built and reconstructed inventories for `.`, `_`, `#`, or `~`
prefixes, with only the root marker exception; this asserts the fixture, not
arbitrary consumer names. A unit test enumerates the fixed deployed names
Mokly chooses and checks the same rule. Include a Changes-enabled example
output so `generations/`, removed previews, and binary CSS resources are
covered. Stop every server after testing.
