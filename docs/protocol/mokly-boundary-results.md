# Check, Export And Frame Boundary Results

## Delivery Status

Static-delivery parsing and export refusals are implemented. Git-state and
frame-identity changes are approved targets in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
Format gates detect unsupported data; they do not convert it.

## Git State For Check

Status: Approved target.

After successful compilation, Check asks Git whether the configured directory
is inside a work tree. Use `git rev-parse --is-inside-work-tree` and interpret
only its exit status and the exact machine values `true` and `false`. Never
inspect or match Git's human message text, regardless of locale. A successful
`false` result means no work-tree index; validate as untracked. A successful
`true` result requires the normal top-level validation and NUL-delimited literal
index query. Unexpected output, a signal, an unreadable/corrupt repository or
an index-query failure is a typed `build-invalid` error, never untracked output.

An outside-repository probe can exit 128 without a machine value. That result
alone does not prove absence: it also represents repository failures. Check
the configured directory and its real ancestors for Git metadata without
reading human diagnostics. Only exit 128 with empty stdout, no `.git` marker
or bare-repository metadata, no explicit Git-directory/work-tree override and
no filesystem error proves an ordinary directory outside a repository. Any
existing or unreadable marker keeps the typed failure. This conservative
fallback never treats corrupt metadata or ownership rejection as untracked.
A missing executable is identified by its process-launch
`ENOENT`, and reports `build-invalid` with `could not check tracked generated
output: Git executable was not found; install Git and retry.` Preserve the
underlying launch error as the cause. Other failures keep the existing typed
`could not check tracked generated output: <detail>` context.

When the configured catalogue root is an alias, retain the real Git-relative
generated path selected by the index query for missing-file diagnostics and
suggestions. The recommended `git rm -r --cached -- <path>/` and `.gitignore`
entry must name Git's actual indexed path. Do not suggest an alias that Git
will not match. Display paths for current filesystem checks can remain relative
to the configured catalogue; distinguish them from the suggested index path.

Tests use non-English stderr without matching it, missing Git, corrupt and
inaccessible repository metadata, bare repositories, ordinary non-repository
directories, nested configured roots and alias paths. Only proven absence or
`false` yields untracked; other failures stay typed.

## Static Delivery Parser

Status: Implemented.

`parseStaticDelivery` returns a discriminated result and never throws:

```ts
type StaticDeliveryParseResult =
  | { kind: "valid"; value: StaticDelivery }
  | { kind: "unsupported-version"; version: unknown }
  | { kind: "invalid" };
```

Preserve the exact v5 field list and canonical-path/comparison-path validators.
Non-object input, an absent version or malformed current-version input is
invalid. Only a present non-5 `schemaVersion` is unsupported-version before path use.
Do not coerce values or let hostile property access escape the parser; catch
unreadable input as invalid. JSON decoding remains the caller's responsibility.

Browser boundary readers convert unsupported-version into `MoklyVersionError`
with boundary `delivery` and supported version 5. They retain the existing
product copy and server-rendered fallback. Export treats invalid and
unsupported results alike as `export-invalid`, naming the captured shell with
`Invalid or changed static shell metadata: <name>`. A version error must not
escape the export error boundary. Test each result and both consumer surfaces.
Upload's separate HTTP 426 handling remains unchanged.

## Export Refusals

Status: Implemented.

Local replacement accepts only an empty directory or current valid ownership.
It never adopts older output or deletes it to repair an error. Every ownership
refusal includes the destination path. Use these details under `export-invalid`:

```text
Export ownership requires a real directory: <output>.
Export ownership is missing: <output>; choose an empty directory.
Invalid export ownership inventory: <output>.
Export output contains unowned files or directories: <output>:
- <relative path>
Move these files or directories before exporting.
```

List unexpected paths once in code-unit order. Unsafe filesystem entries also
name the destination and relative entry. Do not expose secrets or source bytes.
The path gives users of export, publish and repository preview the location
they must inspect. Keep read-only preflight, reservations, rollback and the
existing typed error code. Test that every refusal preserves all files.

## Delivered Frame Identity

Status: Approved target.

One browser-safe helper compares an assigned URL with a delivered same-origin
document URL. It requires exact origin and query, decodes each URL path once,
and accepts the exact path or its provider-normalized form: removal of the
final `.html` suffix, or an `index.html` document's containing directory with
or without its trailing slash. Preserve these existing index-page forms.
The fragment is positioning, not resource identity. Invalid escapes, separators
decoded into a different path, dot segments, another route or another query do
not match. Percent text remaining after one decode is not decoded again.

Use this helper for same-origin document access, mount/load readiness,
inspection, geometry and highlighting. No later exact-string check may reject
the supported extensionless form. Keep weak document provenance, generation
ownership and the exclusion of an untrusted starting document. The shared
current-frame path decoder likewise decodes once before route validation.

The cross-origin adapter can validate the assigned route, origins, nonce and
authenticated message source. It cannot read a cross-origin frame's final path
or prove its HTML contents. State that boundary without promising access to
unobservable response paths. Preserve the existing origin-pinned handshake,
sandbox and usage validation; add no backend or new transport permission.

Tests cover single- and double-encoded paths, invalid escapes, encoded
separators, query/origin mismatches and fragments. A static host redirects
`x.html` to `x`; highlight and pick must work there through the same-origin
adapter. Record a real browser smoke and close its host and browser afterward.
