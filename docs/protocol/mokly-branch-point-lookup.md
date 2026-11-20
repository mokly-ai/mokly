# Branch-Point Entry Lookup

## Scope

This page owns the lookup between base identities and the current
catalogue. It consumes validated entries, removed records, and accepted
[move pairs](./mokly-moves.md). It does not infer moves, change evidence paths,
or read Git. Each lookup belongs to one accepted catalogue generation.

An identity is an entry path and its `kind`. Component parents and
component variants both have kind `component`. Match paths under the
[path contract's case folding](./mokly-paths.md#segment-grammar), while retaining the
selected entry's actual spelling in results and URLs. Another kind at the
same path never matches. A title is display text, never identity.

## Reference Sides

A branch-point reference comes from a base entry, a removed variant's
`variantOf`, or `before`-side usage evidence. Resolve it in this order:

1. The current entry reached by an accepted move pair of that kind whose
   previous path matches the reference.
2. The current entry of that kind whose path matches the reference.
3. The removed record of that kind whose path matches the reference.
4. No destination.

The result distinguishes a current entry from a removed record. A removed
result keeps its record, including its snapshot identity and display titles.
An accepted pair's previous path cannot also name a current entry of the same
kind: move candidates exclude existing identities. Case-only renames are
existing identities, not move pairs, and carry no `previousPath`.

A current-side reference, including `after`-side evidence, looks up only a
current entry of its kind. It never uses move pairs or removed records. The
reference side must be explicit; consumers must not guess it from the path.

`AffectedConsumer.consumer.path` already uses the accepted current identity
for a surviving consumer. Its evidence keeps each side's original context
and chain paths under the [review contract](./mokly-component-review.md).
Resolve each evidence destination using that evidence's side. A build
succeeds when a screen or component consumer moves while a component that it
uses changes. A before-side
reference with no destination yields no usage row. A different kind can reuse
the path and suppress its removal under the
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence).
Never link that evidence to the replacement entry.

When a component variant's original parent has no destination, group its
affected-usage evidence under the resolved variant itself as the canonical
consumer. Keep each evidence item's original context and chain paths.
The variant's destination can be current or removed. If it has no destination,
omit that usage row. Never restore a parent suppressed by removal precedence
or link to the entry that replaced it. When the original parent has a
destination, the evidence stays grouped under that parent.

## Counterparts And Previous Paths

The counterpart of a current entry is its base identity:

1. Use the base path named by its accepted pair, with the same kind.
2. Otherwise find the base entry of that kind with a case-folded equal
   path, and return that entry's actual spelling.
3. Otherwise return no counterpart. The current entry is new.

A pair proves the counterpart identity even when base entries are not
available to the caller. Without a pair or a supplied [base inventory](./mokly-source-protection.md#complete-source-inventory),
the lookup cannot prove a counterpart and returns none. The embedded public
catalogue has no base usage; its input details follow the
[viewer boundary](./mokly-viewer.md).

Use counterparts to match base variants, view identities and instance
component identities. Matching also checks the viewport, scheme, instance key
and ownership. A variant that changes parent still uses its own pair;
the current parent's former variant list is not a substitute.

The previous-path operation returns a path only for a paired current entry.
It never returns the same-path counterpart of an unchanged or case-renamed
entry. `Moved` rows use this operation.

## Variant Parents

For a current variant, resolve its `variantOf` as a current-side reference.
For a removed variant, resolve its base `variantOf` as a branch-point
reference. In both cases the result must be a non-variant of the variant's
kind. If the resolved entry is itself a variant, it is not an eligible parent;
do not search for a different fallback entry at that identity.

A parent result distinguishes a current parent from a removed parent. If no
eligible parent exists, a removed variant uses its stored `parentTitle` as
plain text, with no link or workspace identity. A non-variant has no parent.
The [variant navigation contract](./mokly-variant-navigation.md#changes-rows)
owns row attachment, flat fallback and breadcrumb presentation.

The removal snapshot captures `parentTitle` from the validated base
parent before any current path reuse or removal selection. Every removed
screen or component variant requires it. Removed non-variants must omit it.
The [read model](./mokly-catalogue.md#projection-and-privacy) owns wire
validation. A surviving parent's new title never changes this stored title.

## Consumers

In Serve, the static build, and the embedded viewer, affected-consumer
destinations, the variant bar, Before and Current props, supplied-input
pairing, removed-variant tree attachment, component workspace keys, and
parent breadcrumbs follow the rules of this page. A workspace
key uses the resolved eligible parent's identity. It must not use the old
`variantOf` of a removed child when that parent moved or changed letter case.

Changes activation follows the visible row order of the navigation tree. The
row that navigation shows is also the row that container activation can
reach. Filter and activation presentation stay
under [navigation](./mokly-viewer-selection.md#active-catalogue-visibility) and
[variant navigation](./mokly-variant-navigation.md#changes-rows).

## Related Docs

- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
