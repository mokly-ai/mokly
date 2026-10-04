# Portable Viewer Namespace And Version Gates

## Delivery Status

The `mokly-viewer/` namespace and its version gates are implemented in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
Delivery uses catalogue v4, delivery v4, bootstrap v1, ownership v3 and upload v2.
Content-delta uploads and Plan v1 remain unchanged. The current Cloud service
requires the separate post-merge receiver and viewer update before publishing.

## Paths And Single Ownership

Define `VIEWER_DIRECTORY = "mokly-viewer"` alongside `GENERATED_DIRECTORY` in
`packages/viewer/src/catalogue/delivery_paths.ts`, exported from
`@mokly/viewer/data`. Every CLI, viewer and preview-script path builder imports
it directly. The [directory lint](./mokly-directory-lint.md) covers both names.
Identifiers, DOM attributes and protocol names containing `mokly` do not change.

All package-owned public and private Serve routes move to this root:

| Path below `mokly-viewer/`            | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `catalogue.json`                      | Complete public catalogue                                |
| `client/**`, `shell.css`, `fonts/**`  | Browser modules, inspector, appearance, styles and fonts |
| `diffs/review.json`                   | Live comparison endpoint only                            |
| `diffs/generations/<generation>/**`   | Immutable review and snapshot resources                  |
| `components/**`                       | Live controls and transient component renders            |
| `views/**`, `navigation/**`, `events` | Live evidence, navigation and watch capabilities         |

Apply the prefix change to every descendant endpoint, including any retained
local generation aliases, without changing their authentication, retention or
generation identity rules. Rename the nested `__generations` segment to
`generations` too; otherwise a Mokly-owned path segment would still start with `_`.
Retain generation-local `snapshots/before/`, `snapshots/after/` and page metadata
paths. Do not change their identity-derived names or review-v4 content shape.

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
and the optional pinned review file, as on `main`; it does not revert to a
full-artifact upload. Blob digest, size and snapshot accounting stay unchanged.

Update every producer and consumer together: SSR/hydration bootstraps,
catalogue references, source descriptors, frame URLs, inspector scripts,
geometry and navigation checks, CORS allowlists, static input fingerprints,
deployment hashing, export capture, receiver fixtures, archive assertions and
provider adapters. `/view/` and `/static/` keep their meanings. No old namespace
file or redirect alias is written. `/__mokly/catalogue.json` is intentionally
removed; hosts must not rewrite it to the new catalogue.

## Version Matrix

Versions identify meaning before readers interpret any paths. The final target
is:

| Boundary                            | New writer | Reader policy                                                               |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Private source manifest             | 8          | Read current and baseline v8 only; older baselines yield incompatibility    |
| Public complete or scoped catalogue | 4          | Accept 4 only; reject 1–3 and unknown versions before entry/path validation |
| Static delivery descriptor          | 4          | Accept 4 only; retain the four v3 fields and their types                    |
| Shell bootstrap envelope            | 1          | Add a required root `schemaVersion: 1`; reject absent/other versions        |
| Export ownership marker             | 3          | Accept 3 only for new uploads and local export replacement                  |
| Upload metadata envelope            | 2          | Retain v1 fields; new comparison-path namespace                             |
| Plan response                       | 1          | Unchanged content-delta exchange                                            |
| Comparison result                   | 4          | Unchanged identity-derived snapshot schema from `main`                      |

The unified layout already emits catalogue v4, delivery v4 and bootstrap v1:
moving static generated paths is incompatible with v3 readers. Its intermediate
`__mokly/` format was branch-only and has no compatibility reader. The namespace rename finalizes the paths below and bumps
upload/ownership together. Strict version gates apply throughout; no v3 parser
may interpret a v4 model.

Catalogue v4 retains `main`'s identity-only entries and adds required
`generatedPathPrefix: "mokly-generated"`, typed from the shared constant.
It contains no per-entry routes, `documentPath` or `fragmentPath`. Derive current
files from kind/id/viewport/scheme and that prefix. Public models remain
complete; `omitted` usage is permitted only in the strictly scoped live reader.
Bootstrap v1 adds its version to `main`'s previously unversioned envelope and
keeps its scopes; its external reference
is exactly `/mokly-viewer/catalogue.json`. Static descriptor v4 keeps
`canonicalPath`, `comparisonUrl`, `deploymentId`, and `schemaVersion`; only
the new pinned comparison namespace is valid. Catalogue comparison paths are
root-relative without `/`; descriptor URLs include `/`.

Ownership v3 retains v2's `{ path, sha256, size }` inventory and all limits,
collision rules, classification precedence, content-delta semantics and
duplicate-JSON-key checks. Upload v2 retains v1's strict field list, limits,
metadata identity and null-without-comparisons rule. Version changes are
deliberate even when comparisons are disabled. A current-only artifact must
not bypass the gate simply because it contains no comparison path.

## Compatibility Failure

An older conforming receiver rejects ownership v3 or upload v2 with HTTP 426
before validating paths or creating a publication. Preserve `main`'s bounded
archive parsing, authentication and upload-limit checks before version checks.
The new CLI maps 426 to `upload-unsupported-version`, with this exact message:

```text
The catalogue service does not support this Mokly version. Update the service and try again.
```

Do not retry, send Blobs, call Complete, downgrade, or expose a response body.
An old-format artifact offered to the new receiver also fails 426. For local
export replacement, an old marker fails `export-invalid` before mutation with
the existing move-added-files/delete-directory remedy, now naming the
unsupported version. The marker remains required for upload and local recovery.

An independently hosted older viewer given catalogue v4 must reject its
unsupported version before deriving `/static/` URLs or reading entry fields.
`main`'s strict v3 reader already rejects a non-3 version. The updated viewer
must expose a typed version failure that a host can distinguish from malformed
data; its diagnostic is `Unsupported Mokly catalogue version <version>; this viewer supports version 4.`
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
The separate private baseline boundary also reads only v8. Older manifest
envelopes are checked solely to produce the approved earlier-baseline outcome;
they cannot authorize content reads or a mixed public artifact.
Mokly Cloud must update upload validation, stored path lookup, catalogue fetch
URLs and embedded viewer/version-error handling before accepting this format.
That external rollout is a post-merge follow-up, not an implicit code change
or prerequisite to completing this branch. Until then, publish fails 426.

## Names And Acceptance

Fixed deployed names that Mokly chooses must not start with `.`, `_`, `#` or
`~`. This applies to the generated tree, viewer namespace, `generations`, and
other fixed path segments written by Mokly. It adds no validation rule for
authored closure names, entry ids, or repository paths mirrored below `styles/`
and `assets/`. Those user-chosen names retain `main`'s existing path validation
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
versions before path use, and an old strict catalogue reader rejecting v4.
The ownership-v3 fixtures retain v2 digest coverage and explicit
unsupported-v2 cases; preserve Plan v1 retry, keep-first, delta and cancellation
tests. Update installed-package fixtures for catalogue v4, ownership v3 and
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
