# Variants

## Delivery Status

Screen variants were delivered by the
[screen variants plan](../../plans/screen-variants.md) and its
[follow-up](../../plans/screen-variants-follow-up.md). The
[id-derived routes plan](../../plans/id-derived-routes.md) generalizes this
contract to component variants, so both kinds share one identity model, one
route grammar, and one presentation.

## Purpose And Boundary

A variant records one entry with one deliberate shift: the same kind, the same
place in the catalogue, and one changed state. For a screen that is an empty
workspace, an error, a loading pass, or a filter applied; for a component it is
one saved set of props such as a disabled or secondary state. A variant is
grouped under its parent's row in the navigation tree, keeps the parent's
breadcrumb, and is otherwise a complete entry of its parent's kind.

A variant is an ordinary entry with one extra relationship: `variantOf` names
its parent. It has its own global id, its own derived route, its own generated
views, its own Changes row, and its own comparison result. Everything that
addresses an entry by id addresses a variant the same way, including `mock:`
links and use-case steps. This document adds no link grammar, query parameter,
or comparison schema.

Light and dark are not variants. Color scheme remains a view axis selected by
the existing switch, and a viewport is likewise a view. Per-view change
evidence is surfaced on the view controls by the
[runtime contract](./mokly-runtime.md#browse-shell); it never creates
navigation rows.

## Authoring

`defineScreen` and nested `screen` accept an optional `variants` list. Each
element declares a screen with its own id, title, and React nodes:

```ts
interface ScreenVariantInput {
  address?: string;
  colorSchemes?: readonly ColorScheme[];
  dependencies?: readonly string[];
  description: string;
  desktop: ReactNode;
  id: string;
  mobile: ReactNode;
  rationale?: string;
  relatedDocs?: readonly string[];
  tags?: readonly string[];
  title: string;
  useCaseIds?: readonly string[];
}

interface ScreenInput extends EntryInput {
  // Existing fields unchanged.
  variants?: readonly ScreenVariantInput[] | undefined;
}
```

`defineComponent` requires a non-empty `variants` list whose elements declare
`id`, `title`, optional `description`, and `props`, as defined by the
[component contract](./mokly-components.md). Both helpers flatten each variant
into a full definition carrying `variantOf: <parent id>`, the way `defineRoot`
flattens nested trees. The parent definition never lists its variants; the
relationship is stored on the variant. A module's `mockups` export therefore
contains the parent and every variant as separate entries, parent first and
then variants in authored order.

A `defineScreen` call whose input omits `variants`, or whose `variants`
property is definitely `undefined`, returns one `ScreenDefinition`. A call
with a definitely present `variants` array returns a readonly
`ScreenDefinition[]`, ordered parent first; this includes a definitely empty
array, whose result contains only the parent. When the input type permits
either an array or `undefined`, including the exported broad `ScreenInput`
type, the return type is the union of those two results. The conditional
result distributes over unions and preserves these precise results through
generic helpers, so broad or optional input cannot be assigned unsafely to one
definition. Entry-module exports may place any array result directly in
`mockups`; registry preparation flattens that one array level.
`defineComponent` always returns its entries as an array beside the renderable
facade.

A variant's route derives from its own id under the
[derived route rule](./mokly-authoring.md#derived-routes): a screen variant
lives at `screens/<variant id>.html` with views
`screens/<variant id>.<viewport>[.dark].html`, and a component variant lives at
`components/<variant id>.html` with the same view suffixes. The parent's route
plays no part.

Variant paths follow the
[navigation path contract](./mokly-nav-paths.md#variants-and-historical-paths).
A screen variant inherits the parent's `address`, `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags` unless it declares its own value,
which replaces rather than merges the inherited list. `useCaseIds` defaults to
an empty list and is never inherited because membership is reciprocal with the
flow's steps; a flow that steps through the variant must be listed by that
variant. `title`, `description`, `mobile`, and `desktop` are always the
variant's own. A component variant inherits the parent's `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags`, and owns its `title`,
`description`, and `props`. `id` is a global catalogue id written in full by
the author; ids never derive from tree position, so `welcome-empty` is
authored as `welcome-empty` and `action-disabled` as `action-disabled`.

Validation rejects, with source attribution:

- a variant that declares `variants` or `navPath`, even when `undefined`;
- a `variantOf` that names an unknown entry, an entry of another kind, or an
  entry that is itself a variant, so nesting is exactly one level deep;
- a variant whose `navPath` differs from its parent's;
- a page or use case carrying `variants` or `variantOf`, including keys whose
  value is `undefined`;
- a component with no variants.

Each forbidden variant field produces an `invalid-variants` registry violation
with text `a variant cannot declare <field>`, attributed to the variant's
source module; the authored-field marker survives the consumer bundle through
`Symbol.for` even if flattening discards that field's value. Duplicate variant
ids are duplicate ids and fail under `duplicate-id`.

Every other rule of the parent's kind applies unchanged: id and tag grammar,
color-scheme subsets, reciprocal use-case membership, dependency paths, prop
validation against the component schema, and source attribution to the
defining module.

## Generated Output And Manifest

Build renders a variant exactly as it renders any entry of its kind: one
document per effective viewport and color scheme through the consumer
renderer, with the same ownership header, link rewriting, fragment validation,
resource validation, compatibility transformation, collision and orphan
checks, and transactional writes. A component parent has no views; its page
shows its first variant entry.

The current manifest is schema v7. `ManifestScreen` and `ManifestComponent`
have one optional field:

```ts
interface ManifestScreen {
  // Existing fields unchanged.
  variantOf?: string;
}
```

`variantOf` is present exactly on variants. Manifest validation requires the
named parent to be a current entry of the same kind without `variantOf` and
requires the variant's `navPath` to equal the parent's. The component parent
and variant entry shapes are defined by the
[manifest contract](./mokly-component-manifest.md). Canonical entry sorting
places a parent's variants directly after it in authored order.

The hierarchy analysis exposes each parent's variants in authored order and
each variant's parent. The [path contract](./mokly-nav-paths.md#variants-and-historical-paths)
owns their breadcrumbs; the parent title links when the parent is viewable.

## Links And Flows

`MockLink`, `mockLink`, and raw `mock:<id>[#fragment]` values address a
variant by its ordinary id. The portable rewrite targets the variant's own
view for the source viewport and color scheme with the existing light
fallback, and the marker carries the variant id. A use-case step references a
screen variant through `screenId` like any screen, and the variant's
`useCaseIds` must list that use case. Logical fragments are validated against
the variant's own documents. Nothing in the
[navigation contract](./mokly-navigation.md) changes.

## Navigation

The catalogue tree groups variants under their parent's row in both sections
and in the responsive drawer:

- An entry without variants renders as today.
- An entry with variants renders its row as a container holding the parent
  link and a disclosure button. The link keeps the existing row markup and
  navigates to the parent. The button carries `aria-expanded`,
  `aria-controls`, and an accessible name derived from the parent title, and
  it toggles the list without navigating. The row is not a `<details>`
  summary because a summary cannot also be a link.
- The list renders one ordinary leaf row per variant in authored order, one
  indent step deeper than the parent with the same guide painting and the
  variant icon: an outline of the parent's kind overlapping a second,
  partially drawn outline behind it, so a variant row is distinguishable from
  its parent row by more than its indent. It is muted like the screen and
  component icons; only flow icons take the accent. Its disclosure identity
  is `variants:<section>:<parent id>`, persisted and restored beside folder
  keys, closed by `Collapse all`, and captured by watched-reload recovery.
- The active-row invariant applies to variant rows: opening a variant marks
  its row `aria-current="page"` and opens its variant list, its parent's
  folders, and its section.
- Search matches a variant row by its own id, title, and tags. A parent row
  stays visible while any of its variants matches, and a filtering constraint
  that keeps only a variant opens the list. When search or the Changes filter
  hides the parent row, it hides the parent's entire leaf container, so no
  disclosure button remains visible or focusable without its row; the
  container reappears with the row.
- Tag terms, the Changes filter, and free text compose on variant rows
  exactly as on other rows.

Selecting a component variant is navigation to that variant entry. The
component page's variant bar links to the parent's variant entries; there is no
`variant` query parameter.

## Changes

A variant is its own entry for change detection. Material, resource, metadata,
and ancestry changes mark the variant, never its parent, and the Changes count
counts changed variants. Changing `variantOf` or the parent's title marks the
variant changed through its ancestry projection.

The Changes filter shows a changed variant row inside its parent's group with
the group expanded. A parent that is not itself changed still appears while
any variant is changed: its row carries an aggregate mark derived from the
shell's changed-entry set and the hierarchy, its row is not a Changes row,
and activating it from the Changes filter opens its first changed variant
rather than the parent. Activation follows the rows the reader can see, so a
variant the current constraints hide is never the destination, and a parent
that changed on its own stays its own destination. The parent's status beside
the title describes the parent only.

The mark is the same trailing dot a changed row carries, drawn from the row's
own attributes so it moves with background evidence, and it never marks a
Removed row, whose label already names its state. Beside the dot the row
carries the wording a screen reader announces; it is visually hidden, and
free text in the search box never matches it.

A deleted variant is an ordinary removed entry of its kind. The removed-entry
snapshot retains its `variantOf` and its parent's ancestry so the shell places
its Removed row inside a surviving current non-variant parent's variant list,
after the current variants, hidden from All and shown in Changes. A parent
with no current variants discloses the list for it. When the former parent's
id is absent, belongs to another kind, or now names a variant, the removed
variant keeps the flat root-level row the removal rules give it. Hierarchy
construction must represent every removed entry exactly once: adoption
removes that entry from flat fallback only after attaching it to an eligible
parent. Deleting the parent and its variants yields one removed entry each.
Comparison eligibility, the status badge, and the read-only previous version
follow the existing removed-entry rules of the kind: a removed screen variant
opens its previous version without comparison controls, and a removed
component variant remains eligible for comparison with an explicit missing
current side.

Use-case propagation, affected-consumer evidence, selected live comparisons,
and publication treat a variant as the entry it is; none of them needs a
variant-specific rule.

## Public Read Model And Viewer

`CatalogueScreen` and the component variant entry carry `variantOf`, present
exactly on variants, and the public tree carries variants beneath their
parent's entry node so hosts can render the same grouping. A viewer selection
may name a variant like any entry. Catalogue v3 readers validate the
parent/variant relationship and path.

The Viewer rebuilds `variantOf` for current and removed entries so its rendered
hierarchy, breadcrumbs, details rows, aggregate mark, and removed-variant
adoption match Serve. Activating a shell link while `view` is `changes`
proposes one atomic selection. An aggregate-only parent proposes the id of its
first visible changed variant. If the current selection is not itself a changed
entry, a changed destination also proposes the first changed view's `viewport`
and `colorScheme`, read from the public model's per-view comparison states in
mobile/light, mobile/dark, desktop/light, desktop/dark order, unless the link
names at least one valid explicit axis. A valid explicit axis has exactly one
query value from its supported enum. Each axis is parsed independently: a
valid `viewport` or `scheme` applies while the other sticky axis is retained,
and invalid or repeated values are ignored. One or two valid axes form part of
the same atomic navigation proposal, including when the link points to the
already selected entry. Invalid or repeated values do not suppress
first-changed-view landing. Once a changed entry is selected, later
activations keep the sticky axes while aggregate-parent redirection stays
active. Direct `select` calls and supplied `defaultSelection` or `selection`
props also keep their axes. In controlled mode every such activation remains a
proposal until the host supplies it back.

## Verification

Coverage must prove:

- flattening, derived routes, inheritance and overrides, and every rejected
  shape, for `defineScreen`, nested `screen`, and `defineComponent`;
- manifest emission and validation of `variantOf` for both kinds and
  hierarchy exposure;
- rendering, link rewriting, fragment validation, and use-case steps that
  address a variant;
- the tree markup, disclosure persistence, `Collapse all`, search, the
  active-row invariant, Back and Forward, the drawer, and the exported shell
  without a server;
- variant-only edits, aggregate marks, landing on the first changed variant,
  count behavior, and removed variants under surviving and deleted parents;
- the public projection and reader round trip with the conformance fixture.

## Related Docs

- [Public authoring API](./mokly-authoring.md)
- [Registered components](./mokly-components.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Current manifest v7 schema](./mokly-component-manifest.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Shell design contract](./mokly-shell-design.md)
- [Public catalogue read model](./mokly-catalogue.md)
