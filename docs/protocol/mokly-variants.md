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

A variant's paths derive from its own kind and id under the
[artifact path contract](./mokly-artifact-paths.md); the parent's id plays no
part.

Variant paths follow the
[navigation path contract](./mokly-nav-paths.md#variants-and-baseline-paths).
A screen variant inherits the parent's `address`, `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags` unless it declares its own value,
which replaces rather than merges the inherited list. `useCaseIds` defaults to
an empty list and is never inherited because membership is reciprocal with the
flow's steps; a flow that steps through the variant must be listed by that
variant. `title`, `description`, `mobile`, and `desktop` are always the
variant's own. A component variant inherits the parent's `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags`, and owns its `title` and `props`. An
authored nonempty `description` replaces the parent's; omission copies the
parent description into the flattened entry. `id` is a global catalogue id
written in full; `welcome-empty` and `action-disabled` are authored in full.

Validation rejects, with source attribution:

- a variant that declares `variants` or `navPath`, even when `undefined`;
- a `variantOf` that names an unknown entry, an entry of another kind, or an
  entry that is itself a variant, so nesting is exactly one level deep;
- a variant whose `navPath` differs from its parent's;
- a page or use case carrying `variants` or `variantOf`, including keys whose
  value is `undefined`;
- a component with no variants.

For screen definitions, each forbidden field produces an `invalid-variants`
registry violation with exact text `a variant cannot declare <field>`,
attributed to the source module; its authored-field marker survives bundling
through `Symbol.for`. `defineComponent` validates its authored variant object
earlier and throws `ComponentValidationError` with detail
`Component <parent id>: unknown variant field <field>`. Duplicate variant ids
are duplicate ids and fail under `duplicate-id`.

If a named parent exists but its own definition is invalid, preparation reports
that parent's root-cause violations without also reporting `variant parent does
not exist` for each child. Missing, wrong-kind, and nested valid parents retain
their relationship violations.

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

The current manifest is schema v7. `ManifestScreen` has this optional field:

```ts
interface ManifestScreen {
  // Existing fields unchanged.
  variantOf?: string;
}
```

`variantOf` is present exactly on screen variants. Component parents and
variants use the separate shapes in the
[manifest contract](./mokly-component-manifest.md). Validation requires the
named parent to be a current entry of the same kind without `variantOf` and
requires the variant's `navPath` to equal the parent's. The component parent
and variant entry shapes are defined by the
[manifest contract](./mokly-component-manifest.md). Canonical entry sorting
places a parent's variants directly after it in authored order.

The hierarchy analysis exposes each parent's variants in authored order and
each variant's parent. The [path contract](./mokly-nav-paths.md#variants-and-baseline-paths)
owns their paths; [variant navigation](./mokly-variant-navigation.md) owns rows,
breadcrumbs, icons, and removed-parent fallback.

## Links And Flows

`MockLink`, `mockLink`, and raw `mock:<id>[#fragment]` values address a
variant by its ordinary id. The portable rewrite targets the variant's own
view for the source viewport and color scheme with the existing light
fallback, and the marker carries the variant id. A use-case step references a
screen variant through `screenId` like any screen, and the variant's
`useCaseIds` must list that use case. Logical fragments are validated against
the variant's own documents. Nothing in the
[navigation contract](./mokly-navigation.md) changes.

## Navigation, Changes, And Viewer Projection

The [variant navigation contract](./mokly-variant-navigation.md) owns grouped
rows, parent-kind icons, sibling navigation, comparison-mode retention,
aggregate Changes behavior, removed-variant order and breadcrumbs, Dark
availability, and public Viewer parity. The public model carries `variantOf`
exactly on variants and places current variants in their parent's tree node;
catalogue v3 readers validate those relationships.

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
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Current manifest v7 schema](./mokly-component-manifest.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Shell design contract](./mokly-shell-design.md)
- [Public catalogue read model](./mokly-catalogue.md)
