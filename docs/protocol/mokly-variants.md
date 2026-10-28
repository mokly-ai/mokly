# Variants

## Purpose And Boundary

A variant records one entry with one deliberate shift: the same kind, the same
place in the catalogue, and one changed state. For a screen that is an empty
workspace, an error, a loading pass, or a filter applied; for a component it is
one saved set of props such as a disabled or secondary state. A variant is
grouped under its parent's row in the navigation tree, keeps the parent's
breadcrumb, and is otherwise a complete entry of its parent's kind.

A variant is an ordinary entry with one extra relationship: it is declared
inside its parent, its path is the parent's path plus its slug, and the
catalogue model and the read model record the parent's path as `variantOf`.
It has its own views, its own Changes row, and its own comparison result.
Everything that addresses an entry by path addresses a variant the same way,
including `mock:` links and use-case steps. Variants have no link grammar,
query parameter, or comparison schema of their own.

Light and dark are not variants. Color scheme is a view axis selected by the
appearance switch, and a viewport is likewise a view. Per-view change
evidence is surfaced on the view controls by the
[runtime contract](./mokly-runtime.md#browse-shell); it never creates
navigation rows.

## Authoring

A variant is a props set under the
[entry props contract](./mokly-entry-props.md): every screen and component is
a render over props, and each variant declares `slug`, `title`, and `props`
that replace top-level keys of the parent's props and never deep merge. The
variant renders the parent's render with the merged props and has no render of
its own; a state that needs another tree is a separate entry.

`defineScreen` and `defineComponent` accept an optional `variants` list.
`.screen.html` and `.component.html` files declare `variants` in front matter
under the [HTML screens](./mokly-html-screens.md#variants) and
[HTML components](./mokly-html-components.md#variants) contracts, and each
story of a stories file is a variant of its component entry under the
[render sidecar contract](./mokly-sidecar.md#storybook). A screen variant may
also declare `description`, `tags`, `colorSchemes`, `address`, `rationale`,
`relatedDocs`, `useCasePaths`, and `movedFrom`; a component
variant may also declare `description`, `tags`, `movedFrom`, and `slots`.

```tsx
export default defineScreen({
  title: "Invoice",
  description: "The invoice detail screen.",
  props: { status: "paid", lines: 3 },
  render: (props) => <Invoice {...props} />,
  variants: [
    {
      slug: "overdue",
      title: "Invoice, overdue",
      props: { status: "overdue" },
    },
  ],
});
```

Every definition flattens its variants into full entries whose derived path is
the parent's path plus the variant's slug and whose `variantOf` is the parent's
path, parent first and then variants in authored order. An export contributes
exactly one definition under the
[entry module contract](./mokly-entry-modules.md); the definition carries its
variants, and the catalogue model flattens them. A component needs no variant:
its page renders its own props first, then each variant.

Fresh variant literals in direct calls keep excess-key checks. Generic
inference can accept extra top-level keys. Registry preparation rejects every
unknown field regardless of TypeScript inference.

A variant's document routes derive from its own path under the
[artifact path contract](./mokly-artifact-paths.md); the parent's path is the
prefix and plays no other part.

A variant's `title` is its own. Its `description`, `tags`, `relatedDocs`, and
`colorSchemes` default to the parent's, and a screen variant's `address` does
too; a declared list replaces rather than merges the inherited one. A
component variant's declared slots default to the parent's and its supplied
slots to empty. `useCasePaths` defaults to an empty list and is never
inherited, because membership is reciprocal with the flow's steps; a flow that
steps through the variant must be listed by that variant. `slug` is one
segment under the [segment grammar](./mokly-paths.md#segment-grammar);
`overdue` under `account/billing/invoice` gives
`account/billing/invoice/overdue`. Variants have no `path` input. Their path
always consists of the parent's final path and their own slug; a declared
parent path moves every variant with it.

Validation rejects, with source attribution:

- a variant that declares `variants`, even when `undefined`;
- a variant without a slug, or whose slug is outside the segment grammar;
- two variants of one parent with equal slugs, which derive one path and fail
  as a [duplicate path](./mokly-paths.md#diagnostics);
- undeclared input keys such as `path` under the general unknown-field rule,
  including keys whose value is `undefined`;
- merged props that the parent's prop schema rejects, under the
  [entry props validation](./mokly-entry-props.md#validation).

Nested `variants` produces an `invalid-variants` registry violation with the
exact text `a variant cannot declare variants`. All other undeclared input
fields use the authoring contract's general `invalid-field` rule, after
registry path resolution, so the attributed variant path always includes the
final parent path; no provisional label is used.

If a parent's own definition is invalid, preparation reports that parent's
root-cause violations without also reporting a relationship violation for each
child. Nesting is exactly one level deep because a variant cannot declare
variants; there is no authored parent reference to misname. A component
parent with invalid metadata reports no violation of its component definition.
A parent that fails either check keeps those parent violations, and no child's
props or slots are validated against it; the parent stays present for the
relationship rules and the inheritance checks above. Once both parent checks
succeed, each variant's merged props and slots are validated against the parent
exactly once.

Every other rule of a valid parent's kind applies unchanged: path and tag
grammar, color-scheme subsets, reciprocal use-case membership, prop validation against the schema, and source attribution to the
defining module or file.

## Rendering And Catalogue Model

A variant renders exactly as any entry of its kind: one document per effective
viewport and color scheme through the parent's render with the merged props,
with the same link rewriting, fragment validation, resource validation, and
composition into the render cache. A component parent renders its own props
first on its page, then each variant.

The catalogue model records `variantOf` exactly on variant entries of either
kind and holds the parent's path. Validation requires the named parent to be a
current entry of the same kind without `variantOf` and requires the variant's
path to be the parent's path plus exactly one segment. Canonical entry sorting
places a parent's variants directly after it in authored order.

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
the light fallback, and the marker carries the variant path. A
use-case step references a screen variant through `screenPath` like any
screen, and the variant's `useCasePaths` must list that use case. Logical
fragments are validated against the variant's own documents. The
[navigation contract](./mokly-navigation.md) applies to a variant like any
other entry.

## Navigation, Changes, And Viewer Projection

The [variant navigation contract](./mokly-variant-navigation.md) owns grouped
rows, parent-kind icons, sibling navigation, comparison-mode retention,
aggregate Changes behavior, removed-variant order and breadcrumbs, Dark
availability, and public Viewer parity. The public model carries `variantOf`
exactly on variants and places current variants in their parent's tree node;
catalogue v8 readers validate those relationships.

## Related Docs

- [Entry props and variants](./mokly-entry-props.md)
- [Public authoring API](./mokly-authoring.md)
- [Entry modules](./mokly-entry-modules.md)
- [Registered components](./mokly-components.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Rendering](./mokly-rendering.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Public catalogue read model](./mokly-catalogue.md)
