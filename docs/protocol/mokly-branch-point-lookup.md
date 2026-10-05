# Branch-Point Entry Lookup

## Scope

This page owns the lookup between baseline identities and the current
catalogue. It consumes validated entries, removed records, and accepted
[move pairs](./mokly-moves.md). It does not infer moves, change evidence paths,
or read Git. Each lookup belongs to one accepted catalogue generation.

An identity is an entry path and its manifest `kind`. Component parents and
component variants both have kind `component`. Match paths under the
[path contract's case folding](./mokly-paths.md#segment-grammar), while retaining the
selected entry's actual spelling in results and URLs. Another kind at the
same path never matches. A title is display text, never identity.

## Reference Sides

A branch-point reference comes from a baseline entry, a removed variant's
`variantOf`, or `before`-side usage evidence. Resolve it in this order:

1. The current entry reached by an accepted move pair of that kind whose
   previous path matches the reference.
2. The current entry of that kind whose path matches the reference.
3. The removed record of that kind whose path matches the reference.
4. No destination.

The result distinguishes a current entry from a removed record. A removed
result retains its record, including its snapshot identity and display titles.
An accepted pair's previous path cannot also name a current entry of the same
kind: move candidates exclude existing identities. Case-only renames are
existing identities, not move pairs, and carry no `previousPath`.

A current-side reference, including `after`-side evidence, looks up only a
current entry of its kind. It never uses move pairs or removed records. The
reference side must be explicit; consumers must not guess it from the path.

`AffectedConsumer.consumer.path` already uses the accepted current identity
for a surviving consumer. Its evidence keeps each side's original context
and chain paths under the [review contract](./mokly-component-review.md).
Resolve each evidence destination using that evidence's side. A before-side
reference with no destination yields no usage row. A different kind can reuse
the path and suppress its removal under the
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence).
Never link that evidence to the replacement entry.

## Counterparts And Previous Paths

The counterpart of a current entry is its baseline identity:

1. Use the baseline path named by its accepted pair, with the same kind.
2. Otherwise find the baseline entry of that kind with a case-folded equal
   path, and return that entry's actual spelling.
3. Otherwise return no counterpart. The current entry is new.

A pair proves the counterpart identity even when baseline entries are not
available to the caller. Without a pair or a supplied baseline inventory,
the lookup cannot prove a counterpart and returns none. The embedded public
catalogue has no baseline usage; its input details follow the
[viewer boundary](./mokly-viewer.md).

Use counterparts to match baseline variants, view identities and instance
component identities. Keep the existing viewport, scheme, instance key and
ownership checks. A variant that changes parent still uses its own pair;
the current parent's former variant list is not a substitute.

The previous-path operation returns a path only for a paired current entry.
It never returns the same-path counterpart of an unchanged or case-renamed
entry. `Moved` rows use this operation.

## Variant Parents

For a current variant, resolve its `variantOf` as a current-side reference.
For a removed variant, resolve its baseline `variantOf` as a branch-point
reference. In both cases the result must be a non-variant of the variant's
kind. If the resolved entry is itself a variant, it is not an eligible parent;
do not search for a different fallback entry at that identity.

A parent result distinguishes a current parent from a removed parent. If no
eligible parent exists, a removed variant uses its stored `parentTitle` as
plain text, with no link or workspace identity. A non-variant has no parent.
The [variant navigation contract](./mokly-variant-navigation.md#changes-rows)
owns row attachment, flat fallback and breadcrumb presentation.

The removal snapshot captures `parentTitle` from the validated baseline
parent before any current path reuse or removal selection. Every removed
screen or component variant requires it. Removed non-variants must omit it.
The [read model](./mokly-catalogue.md#projection-and-privacy) owns wire
validation. A surviving parent's new title never changes this stored title.

## Consumers

All shells use this lookup for affected-consumer destinations, the variant
bar, Before and Current props, supplied-input pairing, removed-variant tree
attachment, component workspace keys, and parent breadcrumbs. A workspace
key uses the resolved eligible parent's identity. It must not use the old
`variantOf` of a removed child when that parent moved or changed letter case.

Changes activation traverses the built navigation tree in its visible row
order. It does not reconstruct variant attachment, membership or ordering
from raw paths. Thus the row that navigation shows is also the row that
container activation can reach. Filter and activation presentation remain
under [navigation](./mokly-navigation.md#active-catalogue-visibility) and
[variant navigation](./mokly-variant-navigation.md#changes-rows).

## Verification

Pure tests cover each resolution step, kind isolation, current-side lookup,
case folding, counterpart absence, previous-path absence for case-only
renames, parent role checks, and the pair/current-path invariant.
Both complete and scoped readers reject a removed variant without a
nonempty `parentTitle`, and reject that field on a removed non-variant.

One shared set of real Git baselines supplies these cases to node and browser
tests:

1. A screen and a component consumer move while the component they use
   changes. Before evidence keeps the old paths; destinations use the pairs.
2. A component parent moves, one variant is removed, and one changes props.
3. A variant moves between surviving parents and changes props. The donor
   retains another variant.
4. Case-only screen, component-parent and variant renames, including a removed
   sibling. No stylesheet changes occur in this case.
5. A document takes a removed component's path. Its removed variants retain
   their former parent's title without linking to the document.

Assert pairs, `previousPath`, removed titles and agreement between both
readers. Run the same cases through Serve, export and the embedded viewer at
desktop and mobile widths. Assert usage link targets and destination titles,
props where baseline usage exists, removed rows, retained comparison mode,
Changes activation order, and crumb text and links. HTTP success alone is
not sufficient. The moved-consumer case must export successfully.

## Related Docs

- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
