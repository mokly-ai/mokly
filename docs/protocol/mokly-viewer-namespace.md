# Portable Viewer Namespace And Version Gates

## Delivery Status

Approved target for Milestone 12 of
[Generated Output Simplification](../../plans/generated-output-simplification.md),
after Milestone 11 merges `main`. Current implementation still uses `__mokly/`.
This contract replaces path and version clauses in
[generated delivery](./mokly-generated-delivery.md),
[catalogue](./mokly-catalogue.md), [export delivery](./mokly-export-delivery.md),
[ownership](./mokly-export-ownership.md) and [upload](./mokly-upload.md).
The content-delta exchange on `main` is preserved.

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
`generations` too; otherwise visitor-needed paths would still start with `_`.
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
| Private source manifest             | 8          | Current: 8; historical: versioned readers in the manifest contract          |
| Public complete or scoped catalogue | 4          | Accept 4 only; reject 1–3 and unknown versions before entry/path validation |
| Static delivery descriptor          | 4          | Accept 4 only; retain the four v3 fields and their types                    |
| Shell bootstrap envelope            | 1          | Add a required root `schemaVersion: 1`; reject absent/other versions        |
| Export ownership marker             | 3          | Accept 3 only for new uploads and local export replacement                  |
| Upload metadata envelope            | 2          | Retain v1 fields; new comparison-path namespace                             |
| Plan response                       | 1          | Unchanged content-delta exchange                                            |
| Comparison result                   | 4          | Unchanged identity-derived snapshot schema from `main`                      |

Milestone 11 must already emit public catalogue v4, delivery v4 and versioned
bootstrap v1 because moving the static generated paths is itself incompatible with
`main`'s v3 readers. It may still use the old viewer root until Milestone 12.
That intermediate format is branch-only, must not be published as a supported
package, and has no compatibility reader. Milestone 12 finalizes their path
rules above and bumps upload/ownership together. Both milestones use strict
version checks; no new format is passed through a v3 or earlier parser.

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

There is no automatic conversion of older public artifacts. They keep their
original bundled viewer at their original deployment, or are re-exported.
Historical private manifest readers are a separate comparison facility and
remain required; their support does not authorize a mixed public artifact.
Mokly Cloud must update upload validation, stored path lookup, catalogue fetch
URLs and embedded viewer/version-error handling before accepting this format.
That external rollout is a post-merge follow-up, not an implicit code change
or prerequisite to completing this branch. Until then, publish fails 426.

## Names And Acceptance

No deployed path segment needed by a visitor may start with `.`, `_`, `#` or
`~`. This covers generated output, authored closure destinations, package
assets and comparison generations. Validate decoded names before publication;
reject an authored asset that violates the rule, without silently renaming it.
Retain `main`'s portable-output diagnostics. A root `.mokly-export-artifact`
is the sole optional deployment marker: a static host may omit it because
the viewer never reads it. Leading dots otherwise identify local-only cache
and transaction state. Provider metadata is optional host configuration and
must not become a visitor dependency.

Before implementation, add failure tests for an old receiver rejecting new
current-only and Changes-enabled uploads, new readers rejecting old/unknown
versions before path use, and an old strict catalogue reader rejecting v4.
Keep the v2 ownership digest tests with their version updated, plus explicit
unsupported-v2 cases; preserve Plan v1 retry, keep-first, delta and cancellation
tests. Update installed-package fixtures for catalogue v4, ownership v3 and
upload v2. No source or private manifest enters any artifact.

Smoke-test Serve, a plain static-server export with the optional marker removed,
and a publication Plan/Blobs/Complete round trip. Check the full exported and
reconstructed path inventories for prohibited segments, with only the root
marker exception. Include Changes-enabled artifacts so `generations/`, removed
previews and binary CSS resources are covered. Stop every server after testing.
