# Variants

## Delivery Status

Variants use slugs and derived parent paths. The manifest and public tree retain
those relationships and authored sibling order.

## Purpose And Boundary

A variant records one entry with one deliberate shift: the same kind, the same
place in the catalogue, and one changed state. For a screen that is an empty
workspace, an error, a loading pass, or a filter applied; for a component it is
one saved set of props such as a disabled or secondary state. A variant is
grouped under its parent's row in the navigation tree, keeps the parent's
breadcrumb, and is otherwise a complete entry of its parent's kind.

A variant is an ordinary entry with one extra relationship: it is declared
inside its parent, its path is the parent's path plus its slug, and the
manifest and read model record the parent's path as `variantOf`. It has its
own generated views, its own Changes row, and its own comparison result.
Everything that addresses an entry by path addresses a variant the same way,
including `mock:` links and use-case steps. This document adds no link grammar,
query parameter, or comparison schema.

Light and dark are not variants. Color scheme remains a view axis selected by
the existing switch, and a viewport is likewise a view. Per-view change
evidence is surfaced on the view controls by the
[runtime contract](./mokly-runtime.md#browse-shell); it never creates
navigation rows.

## Authoring

`defineScreen` accepts an optional `variants` list. Each element declares a
screen with its own slug, title, and React nodes:

```ts
interface ScreenVariantInput {
  address?: string;
  colorSchemes?: readonly ColorScheme[];
  dependencies?: readonly string[];
  description: string;
  desktop: ReactNode;
  mobile: ReactNode;
  movedFrom?: string;
  rationale?: string;
  relatedDocs?: readonly string[];
  slug: string;
  tags?: readonly string[];
  title: string;
  useCasePaths?: readonly string[];
}

interface ScreenInput extends EntryInput {
  // Existing fields unchanged.
  variants?: readonly ScreenVariantInput[] | undefined;
}
```

`defineComponent` requires a non-empty `variants` list whose elements declare
`slug`, `title`, optional `description`, optional
`movedFrom`, and `props`, as defined by the
[component contract](./mokly-components.md). Both helpers flatten each variant
into a full definition whose derived path is the parent's path plus the
variant's slug and whose `variantOf` is the parent's path. The parent
definition never lists its variants; the relationship is stored on the
variant. A module's exports therefore contain the parent and every variant as
separate entries, parent first and then variants in authored order, under the
[entry module contract](./mokly-entry-modules.md).

A `defineScreen` call whose input omits `variants`, or whose `variants`
property is definitely `undefined`, returns one `ScreenDefinition`. A call
with a definitely present `variants` array returns a readonly
`ScreenDefinition[]`, ordered parent first; this includes a definitely empty
array, whose result contains only the parent. When the input type permits
either an array or `undefined`, including the exported broad `ScreenInput`
type, the return type is the union of those two results. The conditional
result distributes over unions and preserves these precise results through
generic helpers, so broad or optional input cannot be assigned unsafely to one
definition. Exporting either result directly is valid; collection flattens
the one array level. `defineComponent` always returns its entries as an array
beside the renderable facade.

A variant's file names derive from its own path under the
[artifact path contract](./mokly-artifact-paths.md); the parent's path is the
prefix and plays no other part.

A screen variant inherits the parent's `address`, `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags` unless it declares its own value,
which replaces rather than merges the inherited list. `useCasePaths` defaults
to an empty list and is never inherited because membership is reciprocal with
the flow's steps; a flow that steps through the variant must be listed by that
variant. `title`, `description`, `mobile`, and `desktop` are always the
variant's own. A component variant inherits the parent's `colorSchemes`,
`dependencies`, `relatedDocs`, and `tags`, and owns its `title` and `props`. An
authored nonempty `description` replaces the parent's; omission copies the
parent description into the flattened entry. `slug` is one segment under the
[segment grammar](./mokly-paths.md#segment-grammar); `overdue` under
`account/billing/invoice` gives `account/billing/invoice/overdue`. Variants have no `path` input. Their path always consists of the parent's final
path and their own slug; a declared parent path moves every variant with it.

Validation rejects, with source attribution:

- a screen variant that declares `variants`, even when `undefined`;
- a variant without a slug, or whose slug is outside the segment grammar;
- two variants of one parent with equal slugs, which derive one path and fail
  as a [duplicate path](./mokly-paths.md#diagnostics);
- undeclared input keys such as `path` under the general unknown-field rule, including keys
  whose value is `undefined`;
- a component with no variants.

For screen variants, nested `variants` produces an `invalid-variants`
registry violation with exact text `a variant cannot declare variants`.
All other undeclared input fields use the authoring contract's general
`invalid-field` rule. The nested-variant diagnostic is
attributed to the source module; its authored-field marker survives bundling
through `Symbol.for`. Unknown component-variant fields use the same general
`invalid-field` rule after registry path resolution. The attributed variant path
therefore always includes the final parent path; no provisional label is used.

If a parent's own definition is invalid, preparation reports that parent's
root-cause violations without also reporting a relationship violation for each
child. Nesting is exactly one level deep because a variant cannot declare
variants; there is no authored parent reference to misname.

For a component parent, preparation runs metadata validation first and runs
`validateComponentDefinition` only when the metadata is valid. A parent that
fails either check keeps those parent violations and does not have any child's
props, controls, or slots validated against it. The parent remains present for
the inherited `dependencies`, `relatedDocs`, `colorSchemes`, and `tags` checks
above. Once both parent validations succeed, preparation validates each
component variant's props, controls, and slots against that parent exactly
once.

Every other rule of a valid parent's kind applies unchanged: path and tag
grammar, color-scheme subsets, reciprocal use-case membership, dependency
paths, prop validation against the component schema, and source attribution to
the defining module.

## Generated Output And Manifest

Build renders a variant exactly as it renders any entry of its kind: one
document per effective viewport and color scheme through the consumer
renderer, with the same ownership header, link rewriting, fragment validation,
resource validation, compatibility transformation, collision and orphan
checks, and transactional writes. A component parent has no views; its page
shows its first variant entry.

The manifest is schema v8. `variantOf` is present exactly on variant entries
of either kind and holds the parent's path under the
[manifest contract](./mokly-component-manifest.md). Validation requires the
named parent to be a current entry of the same kind without `variantOf` and
requires the variant's path to be the parent's path plus exactly one segment. Canonical entry sorting places a parent's
variants directly after it in authored order.

The hierarchy analysis exposes each parent's variants in authored order and
each variant's parent. The [path contract](./mokly-paths.md#folders-and-leaves)
owns the leaf-with-children rule; [variant navigation](./mokly-variant-navigation.md)
owns rows, breadcrumbs, icons, and removed-parent fallback. When a parent and
its variants are paired by the [move contract](./mokly-moves.md), each variant
pairs through its slug before the ordinary signals run.

## Links And Flows

`MockLink`, `mockLink`, and raw `mock:<path>[#fragment]` values address a
variant by its ordinary path, complete or relative. The portable rewrite
targets the variant's own view for the source viewport and color scheme with
the existing light fallback, and the marker carries the variant path. A
use-case step references a screen variant through `screenPath` like any
screen, and the variant's `useCasePaths` must list that use case. Logical
fragments are validated against the variant's own documents. Nothing in the
[navigation contract](./mokly-navigation.md) changes.

## Navigation, Changes, And Viewer Projection

The [variant navigation contract](./mokly-variant-navigation.md) owns grouped
rows, parent-kind icons, sibling navigation, comparison-mode retention,
aggregate Changes behavior, removed-variant order and breadcrumbs, Dark
availability, and public Viewer parity. The public model carries `variantOf`
exactly on variants and places current variants in their parent's tree node;
catalogue v4 readers validate those relationships.

## Verification

Coverage must prove:

- flattening, derived paths, inheritance and overrides, and every rejected
  shape, for `defineScreen` and `defineComponent`;
- manifest emission and validation of `variantOf` for both kinds and
  hierarchy exposure;
- rendering, link rewriting, fragment validation, and use-case steps that
  address a variant;
- the tree markup, disclosure persistence, `Collapse all`, search, the
  active-row invariant, Back and Forward, the drawer, and the exported shell
  without a server;
- variant-only edits, aggregate marks, landing on the first changed variant,
  count behavior, removed variants under surviving and deleted parents, and
  variants paired through a moved parent;
- the public projection and reader round trip with the conformance fixture.

## Related Docs

- [Public authoring API](./mokly-authoring.md)
- [Entry modules](./mokly-entry-modules.md)
- [Registered components](./mokly-components.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Manifest schema](./mokly-component-manifest.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Public catalogue read model](./mokly-catalogue.md)
