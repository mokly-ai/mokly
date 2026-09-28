# Component Review Validation

This spec validates and emits the [component comparison result schema](./mokly-component-review.md).
Canonical order enforcement and the shared affected-consumer key are approved
for Milestone 12 of the active
[id-derived routes plan](../../plans/id-derived-routes.md).

## Validation And Canonical Output

Use one result schema and reason policy in Browse's lightweight classification,
comparison generation, publishing, and client decoding. Validate against both
source manifests while generating/publishing so evidence cannot name an unknown
entry, view, instance, or dependency. Require every component/screen ChangedEntry
to match its result record's side addresses. Use-case addresses and screen
reasons must match the source manifests' use-case steps. Unknown fields in new
structures, inconsistent sides, duplicate records/reasons, missing view evidence,
and invalid values fail rather than being silently dropped.

For each entry, the classifier records the dependency paths added by the
[path rule](./mokly-component-changes.md#dependencies-and-styles) after
excluding stylesheets in analysis scope, its own view comparisons, an exact
screen declaration of a stylesheet its view retained, and owned CSS propagated
from an actual invocation. Source validation accepts an entry `dependency`
reason only when that entry's recorded sources contain its path. It never
re-evaluates the path rule or treats the result's own records as sources.
The classifier keys these sources exactly as it keys entry pairs: by kind and
id for every entry, including variants of both kinds.

Source validation also receives the implementation-impact set computed from
the classifier's paired material, unchanged inputs and dependency policy. It
requires exact equality with the complete affected-consumer evidence derived
from that set and both manifests. Neither a subset nor the set of every changed
component is sufficient: saved-variant/control metadata edits can be direct
changes without implementation impact. Every classification path performs this
validation before returning results, including lightweight Browse updates.

The [selected live endpoint](./mokly-selected-comparisons.md) projects a validated
complete result onto one screen or component variant entry. Its response uses
this schema's record and reference validation, while catalogue-wide source
coverage and affected evidence remain owned by the original background
classification and shell inspector.

Entry ids use the portable entry-id grammar. `ignoredIds` use the
[Review-ignore grammar](./mokly-changes.md#review-ignore). The result
stores no snapshot path: files are derived with the shared builders in the
[artifact path contract](./mokly-artifact-paths.md). When those files are
written or served, reject absolute paths, traversal, encoded
separators, source-root access, and non-regular files using existing
snapshot/resource validation. Props in variant addresses use
the corresponding side's schema and canonical wire codec. Instance keys are
opaque validated identifiers and never become filesystem paths or selectors.

Serving filesystem-backed retained snapshots repeats regular-file and confinement checks at
request time. Symlinks at the retained root, any descendant directory, or the
file itself return 404, including artifacts modified after generation.
Diagnostic Markdown renders authored titles as escaped single-line text and
uses safe code-span delimiters for refs and paths; JSON retains original values.
Selected live generations instead serve an immutable captured byte map; they do
not reopen filesystem paths when delivering a retained snapshot.

Lexical ordering uses UTF-16 code units. This paragraph exclusively owns
`review.json` array order: `screens` and `components` sort by id; each
`components[].variants` array contains current variants in current authored
order followed by baseline-only variants in baseline authored order; each
entry's views are mobile/light, mobile/dark, desktop/light, desktop/dark;
`changes` sorts by kind then `(after ?? before).id`; and affected consumers sort
by changed component id, consumer kind, then consumer id. The shared
`@mokly/viewer/data` export `affectedConsumerOrderKey(record)` joins that tuple
with `\u0000` and is used by producer and reader. Reasons sort by kind then
path/id. Affected
evidence sorts by side (before then after), context entry id, variant id when
present, viewport/scheme order, and canonical JSON of `via`; `via` itself keeps
dependency-chain order. Path/id sets are sorted and unique, and `ignoredImpact`
uses viewport/scheme/id order. Readers enforce every stated order and reject
duplicates rather than reordering input.

New object keys sort lexically; optional fields are omitted and required empty
arrays remain explicit. Emit two-space JSON and a final LF, with no timestamp,
absolute checkout path, or transient controls result. Serve no-store/nosniff
headers and retain immutable snapshot generations and unmodified documents.

Emit schema v4 for every result. Readers accept only v4; older and unknown
versions fail. Shared fixture tests must
cover valid/invalid schemas, deterministic round trips, current and removed
variants/consumers, metadata-only changes, zero Changes with affected screens,
and identical served/published membership. These are Milestone 3 requirements.
