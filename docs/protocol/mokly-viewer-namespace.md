# Portable Viewer Namespace And Version Gates

## Delivery Status

The `mokly-viewer/` namespace and its version gates are implemented in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
Delivery uses catalogue v6, delivery v5, bootstrap v2, ownership v3 and upload v2.
Content-delta uploads and Plan v1 remain unchanged. The current Cloud service
must support those versions and paths before accepting a publication.

## Paths And Single Ownership

Define `VIEWER_DIRECTORY = "mokly-viewer"` alongside `GENERATED_DIRECTORY` in
`packages/viewer/src/catalogue/delivery_paths.ts`, exported from
`@mokly/viewer/data`. Every CLI, viewer and preview-script path builder imports
it directly. The [directory lint](./mokly-directory-lint.md) covers both names.
Identifiers, DOM attributes and protocol names containing `mokly` do not change.

All package-owned public and private Serve routes use this root:

| Path below `mokly-viewer/`            | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `catalogue.json`                      | Complete public catalogue                                |
| `client/**`, `shell.css`, `fonts/**`  | Browser modules, inspector, appearance, styles and fonts |
| `diffs/review.json`                   | Live comparison endpoint only                            |
| `diffs/generations/<generation>/**`   | Immutable review and snapshot resources                  |
| `components/**`                       | Live controls and transient component renders            |
| `views/**`, `navigation/**`, `events` | Live evidence, navigation and watch capabilities         |

Every descendant endpoint uses this prefix, including retained
local generation aliases, with their authentication, retention and
generation identity rules. The nested generation segment is `generations`;
no deployed Mokly-owned path segment starts with `_`.
Retain generation-local `snapshots/before/`, `snapshots/after/` and page metadata
paths. Use path-derived names and the current review-v7 content shape.

Exports, publication captures, ownership inventory entries, upload metadata,
Plan archives and Blob reconstruction use those exact paths without a leading
slash. HTTP URLs prepend `/`. In particular:

```text
mokly-viewer/catalogue.json
mokly-viewer/diffs/generations/<64 lowercase hex>/review.json
static/mokly-generated/<generated-relative file>
static/<catalogue-relative authored closure file>
```

The static artifact never includes event, control or other live capabilities.
The upload Plan contains only `mokly-upload.json`, `.mokly-export-artifact`,
and the optional pinned review file, without a
full-artifact upload. Blob digest, size and snapshot accounting stay unchanged.

Update every producer and consumer together: SSR/hydration bootstraps,
catalogue references, source descriptors, frame URLs, inspector scripts,
geometry and navigation checks, CORS allowlists, static input fingerprints,
deployment hashing, export capture, receiver fixtures, archive assertions and
provider adapters. `/view/` and `/static/` keep their meanings. No old namespace
file or redirect alias is written. `/__mokly/catalogue.json` is intentionally
removed; hosts must not rewrite it to the new catalogue.

## Version Matrix

Versions identify meaning before readers interpret any paths. The supported versions
are:

| Boundary                            | Writer | Reader policy                                       |
| ----------------------------------- | ------ | --------------------------------------------------- |
| Private source manifest             | 10     | Accept 10; earlier output makes Changes unavailable |
| Public complete or scoped catalogue | 6      | Accept 6 before entry/path validation               |
| Static delivery descriptor          | 5      | Accept 5 with four required fields                  |
| Shell bootstrap envelope            | 2      | Require root version 2                              |
| Export ownership marker             | 3      | Accept 3 for upload and replacement                 |
| Upload metadata envelope            | 2      | Strict current fields and namespace                 |
| Plan response                       | 1      | Content-delta exchange                              |
| Comparison result                   | 7      | Current path-addressed snapshots                    |

The [combined version inventory](./mokly-format-versions.md) also defines
private IPC, inspector, preview and cache formats. Unknown versions fail closed.

Catalogue v6, delivery v5 and bootstrap v2 identify the unified layout.
Only the current `mokly-viewer/` namespace is accepted. Upload v2 and ownership
v3 require that namespace even for current-only artifacts. Strict version gates
apply before reading paths; unsupported versions never authorize a content read.
A v5 catalogue reader cannot interpret a v6 model.

Catalogue v6 retains identity-only entries. It contains no layout-prefix field,
per-entry routes, `documentPath` or `fragmentPath`. Derive current files from
path/viewport/scheme and `GENERATED_DIRECTORY`. The schema version is 5. Public models remain
complete; `omitted` usage is permitted only in the strictly scoped live reader.
Bootstrap v2 requires its root version field and validates its scope;
its external reference
is exactly `/mokly-viewer/catalogue.json`. Static descriptor v5 keeps
`canonicalPath`, `comparisonUrl`, `deploymentId`, and `schemaVersion`; only
the pinned comparison namespace is valid. Catalogue comparison paths are
root-relative without `/`; descriptor URLs include `/`.

Ownership v3 uses the `{ path, sha256, size }` inventory and all limits,
collision rules, classification precedence, content-delta semantics and
duplicate-JSON-key checks. Upload v2 requires the strict field list, limits,
metadata identity and null-without-comparisons rule. Version changes are
deliberate even when comparisons are disabled. A current-only artifact must
not bypass the gate simply because it contains no comparison path.

## Compatibility Failure

An older conforming receiver rejects ownership v3 or upload v2 with HTTP 426
before validating paths or creating a publication. Preserve bounded
archive parsing, authentication and upload-limit checks before version checks.
The CLI maps 426 to `upload-unsupported-version`, with this exact message:

```text
The catalogue service does not support this Mokly version. Update the service and try again.
```

Do not retry, send Blobs, call Complete, downgrade, or expose a response body.
An old-format artifact offered to the current receiver also fails 426. For local
export replacement, a regular marker with an unsupported version fails before
mutation with `[mokly/export-invalid] Invalid export ownership inventory: <output>.`
Missing ownership and unsafe filesystem entries retain separate errors.
The marker remains required for upload and local recovery.

An independently hosted older viewer given catalogue v6 must reject its
unsupported version before deriving `/static/` URLs or reading entry fields.
The current viewer exposes a typed version failure that a host can distinguish
from malformed data; its diagnostic is `Unsupported Mokly catalogue version <version>; this viewer supports version 6.`
Unknown delivery/bootstrap versions likewise fail before any resource request
or hydration. Use `Unsupported Mokly <boundary> version <version>; this viewer supports version <supported>.`
with boundary `delivery` or `bootstrap` and the table's supported version.
Do not infer a version from file existence or silently fall back to a live URL.

First-party loaders and embedding hosts present a version failure through their
existing error surface as `This catalogue needs a compatible Mokly viewer. Update the viewer and reload.`
Keep version numbers in diagnostic details. A static page retains its server
render and ordinary links if hydration is rejected; it must not install partial
interaction. Atomic exports ship their own matching browser bundle, so a host
must not substitute a cached, independently versioned client. An older viewer's
existing unsupported-version exception is the compatibility boundary; this
repository cannot change the wording in an already installed older binary.

The embedded viewer reports `onError` with `code: "version"`, the product
message above and optional `details` containing the typed version diagnostic.
Other error codes and messages stay unchanged. `ViewerError` is:

```ts
interface ViewerError {
  code:
    "catalogue" | "version" | "selection" | "frame" | "comparison" | "markers";
  message: string;
  details?: string;
}
```

Standalone loading places the same product line in an alert within the existing
page and logs the diagnostic separately. No React hydration starts after a
rejected delivery, bootstrap or catalogue. Existing server markup and links remain.

There is no automatic conversion of older public artifacts. They keep their
original bundled viewer at their original deployment, or are re-exported.
The separate private baseline boundary also reads only v10. Older manifest
envelopes are checked solely to produce the approved earlier-baseline outcome;
they cannot authorize content reads or a mixed public artifact.
Mokly Cloud must update upload validation, stored path lookup, catalogue fetch
URLs and embedded viewer/version-error handling before accepting this format.
A receiver that does not support this contract rejects publication with 426.
Receiver deployment is independent of local catalogue compilation and export.

## Names And Acceptance

Fixed deployed names that Mokly chooses must not start with `.`, `_`, `#` or
`~`. This applies to the generated tree, viewer namespace, `generations`, and
other fixed path segments written by Mokly. It adds no validation rule for
authored closure names, entry paths, or repository paths mirrored below `styles/`
and `assets/`. Those user-chosen names retain existing path validation
and diagnostics, including its hidden-segment rejection. Do not reject or
rename an otherwise accepted authored path to enforce this naming policy.

The plain Mokly directory names do not guarantee that every consumer path is
portable to every host. For example, GitHub Pages with Jekyll can also omit a
user-chosen name starting with `_`. Consumers must configure their host or
choose compatible authored names; Mokly adds no build error for this caveat.

A root `.mokly-export-artifact` is the optional deployment marker: a static
host may omit it because the viewer never reads it. Upload and local export
recovery still require it. Other dot-prefixed fixed Mokly names identify
local-only cache and transaction state. Provider metadata is optional host
configuration and must not become a visitor dependency.

Regression tests cover failure cases for an old receiver rejecting new
current-only and Changes-enabled uploads, new readers rejecting old/unknown
versions before path use, and a strict older catalogue reader rejecting v6.
The ownership-v3 fixtures retain v2 digest coverage and explicit
unsupported-v2 cases; preserve Plan v1 retry, keep-first, delta and cancellation
tests. Update installed-package fixtures for catalogue v6, ownership v3 and
upload v2. No source or private manifest enters any artifact.

Smoke-test Serve, a plain static-server export with the optional marker removed,
and a publication Plan/Blobs/Complete round trip. Keep the export and upload
regression on the example artifact: inspect every segment in its complete
exported and reconstructed inventories for `.`, `_`, `#` or `~` prefixes,
with only the root marker exception. This is an assertion about that fixture,
not a validator for arbitrary consumer names. Add a unit test that enumerates
the fixed deployed names Mokly chooses and checks the same rule. Include
Changes-enabled example artifacts so `generations/`, removed previews and
binary CSS resources are covered. Stop every server after testing.

The approved [path/output integration](./mokly-path-output-integration.md)
defines the current path-derived layout. Its
[format inventory](./mokly-format-versions.md) defines manifest v10, catalogue v6,
review v7 and all other boundaries. Only v10 baseline content is readable after
that integration; the earlier-version product outcome remains unchanged.
