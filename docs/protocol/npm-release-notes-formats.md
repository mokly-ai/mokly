# npm Format And Tooling Release Notes

Continuation of [npm Release Notes](./npm-release-notes.md).

## Boundary And Tooling Changes

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid`
results and never throws. Callers read the descriptor from a valid result's
`value`. Browser boundary readers throw `MoklyVersionError`; export keeps
`export-invalid`. `ViewerError.code` includes `version`, with optional
diagnostic `details` beside the existing product-facing `message`.

`MoklyVersionError.boundary` now also accepts `"review"`. The review reader
throws that error for numeric versions other than 7 before reading content.
Comparison requests preserve its code, boundary, received version and supported
version. Malformed current results keep a plain invalid-review error with one
`[mokly/review]` prefix. Comparison failures use the existing compatible-viewer
message, with version numbers only in diagnostic details. Embedded viewers emit
`onError` with code `"version"`; Current remains available without comparison panes.

The approved watch-writer change moves successful plain baseline notes and the
earlier-version notice to stdout; errors and requested timing JSON retain
stderr. Referenced authored files are not private solely because of an extension
or build-folder name; source inputs, protected locations, hidden segments and
symlinks remain private.

## Combined Path And Output Formats

The path/output integration uses manifest v10, catalogue v6, review v7, delivery
v5 and bootstrap v2. Live capability descriptors and the inspector wire use v2;
the live index is `live-index-2`, catalogue change snapshots use v3 and baseline
completion markers use v2 with `generated-v10`. Export ownership v3, upload v2
and Plan v1 retain their shapes. See the
[complete format inventory](./mokly-format-versions.md).

File-derived paths replace `id`/`navPath`, and `roots` replaces `entries` and
`entriesDir`. Markdown documents, folders and moves use the incoming path
contract. Every generated file now lives under `mokly-generated/`, including
Markdown resource copies. Manifest v9 and below are earlier baseline output;
catalogue v5 and review v6 and below are unsupported public payloads. Rebuild
with the matching package; no converter is provided. The preview command against
an earlier main base still succeeds with Changes unavailable. Only the explicit
writers take the output lock; immutable in-memory route snapshots replace disk
capture and reject undeclared worker routes.

## Renderer Ownership And Inline Evidence

Renderers may return a complete HTML string or an object with `html` and
optional `resources`. The `RenderResult` type keeps non-CSS resource ownership.
Its `styles` field is typed `never`; at runtime Mokly warns once and ignores
a returned `styles` field. Inline ownership is inferred from rendered markup.
CSS resource declarations are checked, warn and seed the private closure, but
never assign an owner to a stylesheet.

Current manifest v10 usage has no `styles`. It keeps non-CSS `resources`, root
ranges and `insertedStylesheets`. Review v7 views and catalogue v6
`resourceEvidence` carry `inlineStyles`. Rebuild earlier output with the matching
package. No earlier manifest layout is admitted as v10.

Both `@mokly/viewer/data` validators use an options object. Use
`validateComponentViews(value, components, at, { dark, rootId?, historical? })`
and `validateComponentViewRecord(view, components, at, { rootId?, historicalUsage? })`.
The fourth options object is required; pass `{}` for current single-view usage
without a component root. The [usage contract](./mokly-component-usage-records.md#validation)
defines the options and rejection of positional calls.
