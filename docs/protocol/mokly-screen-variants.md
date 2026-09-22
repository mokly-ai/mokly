# Screen Variants

## Delivery Status

The [screen variants plan](../../plans/screen-variants.md) is complete for its
delivered scope: Milestones 1 to 8 and 10 to 12 implement authoring through
per-view evidence for every saved variant and export, plus the approved review
fixes. The unimplemented design-catalogue conversion, open review findings and
later product ideas belong to the separate
[follow-up plan](../../plans/screen-variants-follow-up.md). The conversion's
route retirements still require explicit approval.

## Purpose And Boundary

A variant records one screen with one deliberate shift: the same route family,
the same place in the catalogue, and one changed state such as an empty
workspace, an error, a loading pass, or a filter applied. Today such states
are authored as sibling screens in the same collection, which places them
near their default but gives the reader no structure. A variant is grouped
under its parent screen in the navigation tree, keeps the parent's breadcrumb,
and is otherwise a complete screen.

A variant is an ordinary screen entry with one extra relationship: `variantOf`
names its parent screen. It has its own global id, its own route, its own
generated documents, its own Changes row, and its own comparison result.
Everything that addresses a screen by id or route addresses a variant the
same way. This document adds no new link grammar, query parameter, manifest
version, or comparison schema.

Light and dark are not variants. Color scheme remains a view axis selected by
the existing switch, and a viewport is likewise a view. Per-view change
evidence is surfaced on the view controls by the
[runtime contract](./mokly-runtime.md#browse-shell); it never creates
navigation rows.

## Authoring

`defineScreen` and nested `screen` accept an optional `variants` list. Each
element declares a screen with its own id, slug, title, and React nodes:

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
  slug: string;
  tags?: readonly string[];
  title: string;
  useCaseIds?: readonly string[];
}

interface ScreenInput extends RoutedEntryInput {
  // Existing fields unchanged.
  variants?: readonly ScreenVariantInput[];
}
```

The helper flattens each variant into a full `ScreenDefinition` carrying
`variantOf: <parent id>`, the way `defineRoot` flattens nested trees. The
parent definition itself is unchanged and never lists its variants; the
relationship is stored on the variant. A module's `mockups` export therefore
contains the parent and every variant as separate entries. A `defineScreen`
call without `variants` returns one `ScreenDefinition`, preserving the existing
typed API. A call with `variants` returns a readonly `ScreenDefinition[]`,
ordered parent first and then variants in authored order. Entry-module exports
may place that result directly in `mockups`; registry preparation flattens that
one array level.

The derived route is `<parent route without .html>.variants/<slug>.html`. For a
parent at `screens/welcome.html`, the variant with slug `empty` lives at
`screens/welcome.variants/empty.html`, and its fragments follow the normal
suffix rule: `screens/welcome.variants/empty.mobile.html`,
`empty.desktop.html`, and the `.dark` pair when dark is effective. This
mirrors the component variant folder and cannot collide with the parent's
viewport fragments. The slug obeys the route-segment grammar, and an author
never supplies `route` on a variant.

A variant inherits the parent's `address`, `colorSchemes`, `dependencies`,
`relatedDocs`, and `tags` unless it declares its own value, which replaces
rather than merges the inherited list. `useCaseIds` defaults to an empty list
and is never inherited because membership is reciprocal with the flow's steps;
a flow that steps through the variant must be listed by that variant. `title`,
`description`, `mobile`, and `desktop` are always the variant's own. `id` is a
global catalogue id written in full by the author; ids never derive from tree
position, so `welcome-empty` is authored as `welcome-empty`.

Validation rejects, with source attribution:

- a variant that declares `variants`, `route`, or `childIds`;
- two variants of one parent sharing a slug;
- a `variantOf` that names an unknown entry, a non-screen, or a screen that
  is itself a variant, so nesting is exactly one level deep;
- a variant id listed in any collection's `childIds`; a variant belongs to
  its parent's collection through the parent and is never claimed directly;
- a page, collection, or use case carrying `variants` or `variantOf`, including
  keys whose value is `undefined`;
- a component carrying `variantOf`. A component's required `variants` field
  remains the unrelated saved-component-view contract.

Every other screen rule applies unchanged: id and tag grammar, color-scheme
subsets, reciprocal use-case membership, dependency paths, and source
attribution to the defining module.

## Generated Output And Manifest

Build renders a variant exactly as it renders any screen: one document per
effective viewport and color scheme through the consumer renderer, with the
same ownership header, link rewriting, fragment validation, resource
validation, compatibility transformation, collision and orphan checks, and
transactional writes. The renderer input carries the variant's own
`ScreenDefinition`; its `variantId` field is unused for screens.

The manifest stays at schema v5. `ManifestScreen` gains one optional field:

```ts
interface ManifestScreen {
  // Existing fields unchanged.
  variantOf?: string;
}
```

`variantOf` is present exactly on variants. Manifest validation requires the
named parent to be a current screen entry without `variantOf`, requires the
variant's route to match the derived form for that parent, and rejects a
variant listed in any `childIds`. Canonical entry sorting follows the manifest
contract; key ordering, `navPath`, and `sourceFiles` are unchanged. Historical
readers accept manifests without the field; a baseline screen without
`variantOf` is an ordinary screen.

The hierarchy analysis exposes variants beside collection membership: each
screen's variants in authored order, and each variant's parent. A variant's
ancestors are its parent's collection ancestors, so its breadcrumbs and its
removed-entry ancestry read the same as the parent's, followed by the parent
title. The parent title is a link when the parent is viewable.

## Links And Flows

`MockLink`, `mockLink`, and raw `mock:<id>[#fragment]` values address a
variant by its ordinary id. The portable rewrite targets the variant's own
fragment for the source viewport and color scheme with the existing light
fallback, and the marker carries the variant id. A use-case step references a
variant through `screenId` like any screen, and the variant's `useCaseIds`
must list that use case. Logical fragments are validated against the variant's
own documents. Nothing in the [navigation contract](./mokly-navigation.md)
changes.

## Navigation

The catalogue tree groups variants under their parent's row in both the
Pages projection and the responsive drawer:

- A screen without variants renders as today.
- A screen with variants renders its row as a container holding the parent
  link and a disclosure button. The link keeps the existing row markup and
  navigates to the parent. The button carries `aria-expanded`,
  `aria-controls`, and an accessible name derived from the parent title, and
  it toggles the list without navigating. The row is not a `<details>`
  summary because a summary cannot also be a link.
- The list renders one ordinary leaf row per variant in authored order, one
  indent step deeper than the parent with the same guide painting and the
  variant icon: a screen outline overlapping a second, partially drawn screen
  outline behind it, so a variant row is distinguishable from its parent
  screen row by more than its indent. It is muted like the screen icon; only
  flow icons take the accent. Its disclosure identity is
  `variants:<section>:<parent id>`, persisted and restored beside collection
  keys, closed by `Collapse all`, and captured by watched-reload recovery.
- The active-row invariant applies to variant rows: opening a variant marks
  its row `aria-current="page"` and opens its variant list, its parent's
  collections, and its section.
- Search matches a variant row by its own id, title, route, and tags. A
  parent row stays visible while any of its variants matches, and a
  filtering constraint that keeps only a variant opens the list. When search
  or the Changes filter hides the parent row, it hides the parent's entire
  leaf container, so no disclosure button remains visible or focusable without
  its row; the container reappears with the row.
- Tag terms, the Changes filter, and free text compose on variant rows
  exactly as on other rows.

## Changes

A variant is its own routed entry for change detection. Material, resource,
metadata, and ancestry changes mark the variant's route, never its parent's,
and the Changes count counts changed variants. Changing `variantOf` or the
parent's title marks the variant changed through its ancestry projection.

The Changes filter shows a changed variant row inside its parent's group with
the group expanded. A parent that is not itself changed still appears while
any variant is changed: its row carries an aggregate mark derived from the
shell's changed-route set and the hierarchy, its row is not a Changes row,
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

A deleted variant is a removed screen. The removed-entry snapshot retains its
`variantOf` and its parent's ancestry so the shell places its Removed row
inside a surviving parent's variant list, after the current variants, hidden
from All and shown in Changes. A parent with no current variants discloses
the list for it. When the parent is gone, or is not a current screen, the
removed variant keeps the flat root-level row the removal rules give it.
Deleting the parent and its variants yields one removed entry each.
Comparison eligibility, the status badge, and the read-only previous version
follow the existing removed-screen rules. The previous version retains the
variant's historical views and opens without comparison controls; it never
falls back to a current empty state.

Use-case propagation, affected-consumer evidence, selected live comparisons,
and publication treat a variant as the screen it is; none of them needs a
variant-specific rule.

## Public Read Model And Viewer

`CatalogueScreen` gains optional `variantOf`, present exactly on variants, and
the public tree carries variants beneath their parent's entry node so hosts
can render the same grouping. A `ViewerSelection.screenId` may name a variant
like any screen; `variantId` remains reserved for component saved variants.
Readers of catalogue v1 tolerate the added field under the existing
additive-field rule.

The Viewer rebuilds `variantOf` for current and removed screens so its rendered
hierarchy, breadcrumbs, details rows, aggregate mark, and removed-variant
adoption match Serve. Activating a shell link while `view` is `changes`
proposes one atomic selection. An aggregate-only parent proposes the
`screenId` of its first visible changed variant. If the current selection is not
itself a changed route, a changed destination also proposes the first changed
view's `viewport` and `colorScheme`, read from the public model's per-view
comparison states in mobile/light, mobile/dark, desktop/light, desktop/dark
order, unless the link names either axis. Once a changed route is selected,
later activations keep the sticky axes while aggregate-parent redirection stays
active. Direct `select` calls and supplied `defaultSelection` or `selection`
props also keep their axes. In controlled mode every such activation remains a
proposal until the host supplies it back.

## Verification

Coverage must prove:

- flattening, derived routes, inheritance and overrides, and every rejected
  shape, for both `defineScreen` and nested `screen`;
- manifest emission and validation of `variantOf`, hierarchy exposure, and
  historical manifests without the field;
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
- [Rendering and generated output](./mokly-rendering.md)
- [Current manifest v5 schema](./mokly-component-manifest.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Shell design contract](./mokly-shell-design.md)
- [Public catalogue read model](./mokly-catalogue.md)
