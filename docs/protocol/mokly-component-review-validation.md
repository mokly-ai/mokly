# Component Review Validation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This contract validates and emits the
[component comparison schema](./mokly-component-review.md). The producer and
the strict path-keyed review v8 reader enforce the same canonical order and
share one affected-consumer order key.

## Validation And Canonical Output

One result schema and one reason policy serve Serve's background
classification, the selected comparison, `build`, `publish`, and the viewer's
decoding. The producer validates the result against both sides' catalogue
models, so evidence cannot name an unknown entry, view, instance, or rendered
resource. Every screen, component, variant, and use case record must match its
side addresses; use case addresses and screen reasons must match the sides'
use case steps. Unknown fields, inconsistent sides, duplicate records or
reasons, missing view evidence, and invalid values fail rather than being
dropped.

For each entry, the classifier records the owner-attributed rule and resource
records of its actual view comparisons. For CSS, it records the unfiltered
and kept own-page match sets of every rule identity before any entry's
evidence is decided. Nested filtering uses the unfiltered sets; a component
owner requires kept matches on that component's or variant's own pages. The
[ownership rule](./mokly-component-changes.md#rendered-resources-and-styles)
excludes unrendered source paths and declared paths. Source validation accepts
a `dependency` reason only when a view of that entry carries a rule or
resource record owned by the entry for that path; a reachable path alone never
justifies a reason. A component parent's non-CSS dependency can instead use
recorded consumer-view proof at a paired instance with unchanged props and
supplied slot content. That proof retains the exact instance, view, side,
referring route, written URL, and resolved target. Inline rules use their
containing public document route and recorded containment proof.
An `implementation` reason requires the corresponding actual-instance render
proof. These reasons never alter the component's own view states.
Validation uses the recorded classifier evidence, never the
result's own rows or a fresh path match. Source keys use kind and path,
flattened variants included; a moved entry uses its current path.

Source validation receives the accepted move pairs of classification. It
requires exact `previousPath` coverage, both original side addresses, and one
record for every moved screen, component, variant, or use case. Readers reject
a case-only `previousPath`, duplicate historical identities, and a paired
historical identity that is also listed as removed. Catalogue readers
additionally require ready, included, unmodified-or-changed current records
for prior paths. Empty reasons are valid only for a paired move. Page and
document moves are catalogue evidence under the
[move contract](./mokly-moves.md#result).

Source validation also receives the implementation-impact set computed from
the classifier's paired canonical forms, unchanged inputs, and
rendered-resource policy. It requires exact equality with the complete
affected-consumer evidence derived from that set and both sides' usage.
Neither a subset nor the set of every changed component is sufficient:
variant or control metadata edits can be direct changes without
implementation impact, and a wrapper-only or unresolved entry reason has no
component impact unless another rule proves a kept own-root match. The CSS
impact set is never built from consumer-instance matches. An included variant with proven render, resource, or CSS impact permits its
parent identity in affected evidence without a parent Changes row. Every
classification path performs this validation before it returns a result.

The [selected comparison](./mokly-selected-comparisons.md) of Serve projects
a validated complete result onto one screen or component variant entry. Its
response uses this schema's record and reference validation; catalogue-wide
source coverage and affected evidence stay with the background classification
and the shell inspector.

Entry paths follow the [path grammar](./mokly-paths.md#segment-grammar);
`ignoredIds` use the
[Review-ignore grammar](./mokly-changes-serving.md#review-ignore). The result
stores no snapshot path: files are derived with the shared builders of the
[artifact path contract](./mokly-artifact-paths.md). When those files are
written or served, absolute paths, traversal, encoded separators, source-root
access, and non-regular files are rejected under the
[comparison serving contract](./mokly-comparison-serving.md). Props in entry
addresses use the side's own schema and the canonical JSON of the
[entry props contract](./mokly-entry-props.md). Instance keys are opaque
validated identifiers and never become filesystem paths or selectors.

A generation written by `build` is served by a static host as plain files;
Serve's selected generations serve an immutable captured byte map and reopen
no filesystem path. Diagnostic text renders authored titles as escaped
single-line text and uses safe code-span delimiters for refs and paths; JSON
keeps original values.

Lexical ordering uses UTF-16 code units. This paragraph exclusively owns the
array order of `review.json`: `entries` sorts by kind, then path; a
component's `variants` lists its current variants in current authored order,
then its base-only variants in base authored order; each record's views are
mobile/light, mobile/dark, desktop/light, desktop/dark; reasons sort by kind,
then by `path` or `screenPath`; `rules` and `resources` records sort as the
[evidence schema](./mokly-css-attribution-membership.md#evidence-schema)
states; `affected` sorts by `changedComponentId`, consumer kind, then consumer
path, and its evidence by side (before, then after), context kind, context
entry path, view order, and the canonical JSON of `via`, which keeps its chain
order; `diagnostics` keep the order in which the comparison produced them.
Path sets are sorted and unique. Readers enforce every stated order and reject
duplicates rather than reordering input.

The result is the canonical JSON of the model crate: keys in lexical order,
optional fields omitted, required empty arrays explicit, no timestamp,
absolute path, or transient control result. Generation routes carry
`no-store` and `nosniff`, and a generation's files never change.

Every producer emits review result v8, and every reader accepts only version
8; another or an unknown number fails before any field is read. Fixture tests
cover valid and invalid results, deterministic round trips, current and
removed variants and consumers, metadata-only changes, zero Changes with
affected screens, and identical served and built membership.

## Path Identity

Pair entries by kind and case-folded path. A case-only rename keeps one
identity and has no removed record; classify it by metadata and material
content. Component parents and variants share this pairing namespace, so a
change between the two shapes produces one changed record with both sides.
Grouped component records keep the views that belong to each component side.

## Sides

Both sides are the composed documents of the
[comparison contract's sides](./mokly-comparison.md#sides), rendered by the
current Mokly version and read from the render cache with their real bytes;
ownership regions are node annotations of those trees. The base is the merge base of `HEAD` and the configured base; staged,
unstaged, and untracked edits participate on the head side. No command checks
the base commit out. Cross-kind path reuse and moves follow the
[comparison engine](./mokly-changes-serving.md#comparison-engine) and the
[move contract](./mokly-moves.md); title edits are metadata changes.

New and removed components and variants keep explicit missing sides. Usage is
the union of both sides, so removing a component does not erase its former
consumers. A component with no variant affected by a render edit can still be
changed through an owned non-CSS resource or a proven render difference at a
paired instance with unchanged inputs; this exception never supplies a
stylesheet-rule component reason. For that instance, parent-owned child inputs
are kept and caller-owned slots excluded under the same ownership policy as
the component's own pages. Metadata-only edits invent no affected consumers,
and no variant is invented for every possible prop combination.

When a side lacks a component's regions, because the component is registered
on one side only, its real content is compared conservatively. Initial
registration or one-sided ownership must not hide a simultaneous edit or
create synthetic empty components.
