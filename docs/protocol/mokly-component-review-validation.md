# Component Review Validation

This spec validates and emits the [component comparison result schema](./mokly-component-review.md).

## Validation And Canonical Output

Use one result schema and reason policy in Browse's lightweight classification,
comparison generation, publishing, and client decoding. Validate against both
source manifests while generating/publishing so evidence cannot name an unknown
entry, view, instance, or dependency. Require every component/screen ChangedEntry
to match its result record's side addresses. Use-case addresses and screen
reasons must match the source manifests' use-case steps. Unknown fields in new
structures, inconsistent sides, duplicate records/reasons, missing view evidence,
and invalid values fail rather than being silently dropped.

Source validation accepts an entry `dependency` reason only when the classifier
collected that path through the [dependency path rule](./mokly-component-changes.md#dependencies-and-styles),
dependency paths retained by the entry's own view comparisons, or owned CSS
propagated from an actual invocation. The result's own view and entry records
cannot justify that reason.
The classifier keys per-entry evidence exactly as it keys entry pairs: by kind and
route for screens and flows, and by kind and id for components.

Source validation also receives the implementation-impact set computed from
the classifier's paired material, unchanged inputs and dependency policy. It
requires exact equality with the complete affected-consumer evidence derived
from that set and both manifests. Neither a subset nor the set of every changed
component is sufficient: saved-variant/control metadata edits can be direct
changes without implementation impact. Every classification path performs this
validation before returning results, including lightweight Browse updates.

The [selected live endpoint](./mokly-selected-comparisons.md) projects a validated
complete result onto one screen or saved variant. Its response uses this schema's
record and reference validation, while catalogue-wide source coverage and affected
evidence remain owned by the original background classification and shell inspector.

Entry ids and routes use normal catalogue validation. Snapshot paths are exact
artifact-root-relative paths under `snapshots/before/` or `snapshots/after/`,
as appropriate, retaining the selected fragment's relative path. Reject absolute
paths, traversal, encoded separators, source-root access, and non-regular files
using existing snapshot/resource validation. Props in variant addresses use
the corresponding side's schema and canonical wire codec. Instance keys are
opaque validated identifiers and never become filesystem paths or selectors.

Serving filesystem-backed retained snapshots repeats regular-file and confinement checks at
request time. Symlinks at the retained root, any descendant directory, or the
file itself return 404, including artifacts modified after generation.
Diagnostic Markdown renders authored titles as escaped single-line text and
uses safe code-span delimiters for refs and paths; JSON retains original values.
Selected live generations instead serve an immutable captured byte map; they do
not reopen filesystem paths when delivering a retained snapshot.

Lexical ordering uses UTF-16 code units, not a locale-sensitive collator.
Sort screens by route and components by id. Variants follow current authored
order, followed by removed variants in baseline order. Views retain
mobile/light, mobile/dark, desktop/light, desktop/dark order. Sort changes by
preferred side's route, then kind and id. Reasons sort by kind then path/route.
Affected records sort by changed component id, consumer kind, then route/id.
Evidence sorts by side (before then after), context route, variant id when
present, viewport/scheme order, and canonical JSON of the `via` list. The list's
own order is its dependency-chain order. Sort path/id sets uniquely and retain
the existing viewport/scheme/id ordering for `ignoredImpact`.

New object keys sort lexically; optional fields are omitted and required empty
arrays remain explicit. Emit two-space JSON and a final LF, with no timestamp,
absolute checkout path, or transient controls result. Serve no-store/nosniff
headers and retain immutable snapshot generations and unmodified documents.

Emit schema v3 when either source manifest has component metadata; otherwise
retain schema-v2 output. Readers keep the existing v2 contract without inventing
component usage or suppression. Unknown versions fail. Shared fixture tests must
cover valid/invalid schemas, deterministic round trips, current and removed
variants/consumers, metadata-only changes, zero Changes with affected screens,
and identical served/published membership. These are Milestone 3 requirements.
