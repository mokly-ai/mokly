# Branch-Point Entry Lookup

## Scope

This page owns the lookup between baseline identities and the current
catalogue. It consumes validated entries, removed records, and accepted
[move pairs](./mokly-moves.md). It does not infer moves, change evidence paths,
or read Git. Each lookup belongs to one accepted catalogue generation.

The lookup is one shared module of the viewer's catalogue data layer. The
CLI's server projection imports it from `@mokly/viewer/data`. Every layer that
maps a branch-point path to an entry uses it: the server projection, both
catalogue readers, the review-result reader, the data helpers, the Serve and
export shells, and the embedded viewer. No layer keeps its own index or exact
match of branch-point paths.

An identity is an entry path and its manifest `kind`. Component parents and
component variants both have kind `component`. Screens and screen variants
both have kind `screen`. Match paths under the
[path contract's case folding](./mokly-paths.md#segment-grammar), while retaining the
selected entry's actual spelling in results and URLs. Another kind at the
same path never matches. A title is display text, never identity.

## Reference Sides

A branch-point reference comes from a baseline entry, a removed variant's
`variantOf`, an instance component name in a removed record's usage, or
`before`-side usage evidence. Resolve it in this order:

1. The current entry reached by an accepted move pair of that kind whose
   previous path matches the reference.
2. The current entry of that kind whose path matches the reference.
3. The removed record of that kind whose path matches the reference.
4. No destination.

The result distinguishes a current entry from a removed record. A removed
result retains its record, including its snapshot identity and display titles.
An accepted pair's previous path cannot also name a current entry of the same
kind: move candidates exclude existing identities. Both catalogue readers and
the review-result reader reject a `previousPath` that a current entry of the
same kind uses, compared with case folding. An entry of another kind may use
that path. Case-only renames are existing identities, not move pairs, and
carry no `previousPath`.

A current-side reference, including `after`-side evidence and an instance
component name in a current entry's usage, looks up only a current entry of
its kind. It never uses move pairs or removed records. The reference side must
be explicit; consumers must not guess it from the path.

`AffectedConsumer.consumer.path` already uses the accepted current identity
for a surviving consumer. Its evidence keeps each side's original context
and chain paths under the [review contract](./mokly-component-review.md).
Resolve each evidence destination using that evidence's side. A before-side
reference with no destination yields no usage row. A different kind can reuse
the path and suppress its removal under the
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence).
Never link that evidence to the replacement entry.

## Usage Component Names

An instance `componentId` in a view's usage names a component parent. It takes
its record's side: usage in a removed record is `before`-side, and usage in a
current entry is `after`-side. One lookup operation resolves a name on a given
side. Only a component parent is a destination; a variant at that identity
counts as no destination.

A name that resolves through a move pair or a case-only rename keeps its
usage. The server projection publishes that usage, and both catalogue readers
accept it. Every shell labels the instance with the resolved component's
title and links to that component. This applies to instance lists, Props and
its `Open component` link, and Highlight labels. A `Used by` list matches
usage to its component through the same resolution.

Never rewrite a stored name. An instance id may equal the last segment of its
component name; a rewrite that changes the name's letter case would then make
that id invalid. A name without a destination gets no title or link from the
lookup, and never the entry of another kind that reuses its path. The
[read model](./mokly-catalogue.md#projection-and-privacy) owns how projection
and readers treat usage with such a name.

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

On a component page, each current variant pairs its supplied inputs through
its own counterpart. The page does not require a counterpart for the current
parent, so a variant that moved into a new component still shows its Before
and Current values. A screen pairs its supplied inputs only when the screen
itself has a counterpart.

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

The removed variants that resolve to one eligible parent keep baseline
authored order. The server projection orders `removedEntries` through this
resolution under the
[serialization contract](./mokly-catalogue-serialization.md). A parent that
moved or changed letter case therefore keeps that order in the published
catalogue, the navigation and the variant bar.

The removal snapshot captures `parentTitle` from the validated baseline
parent before any current path reuse or removal selection. Every removed
screen or component variant requires it. Removed non-variants must omit it.
The [read model](./mokly-catalogue.md#projection-and-privacy) owns wire
validation. A surviving parent's new title never changes this stored title.

## Typed References

The shared data types give branch-point references and current paths distinct
types. A value that names a baseline identity has the reference type: each
branch-point reference above, every `previousPath`, and every path in a
baseline inventory. A value that addresses a record of this catalogue has the
current path type: a current entry's path, a current-side reference, and a
removed record's own path, which no current entry can share. Readers validate
stored strings and then produce typed values. The projection also produces
typed values.

Only the lookup converts between the two types. Resolution maps a reference to
a current entry or a removed record. The counterpart and previous-path
operations map a current entry to a reference. Display may show a reference's
stored text, but that text never becomes a comparison operand, a lookup key or
a current path.

The shell, the embedded viewer, the server projection and the catalogue data
layer, except reader validation, never mix the two types outside the lookup.
They do not compare them, look up data keyed by one type with a value of the
other, or convert one to the other through a plain string. A type-aware guard
test rejects each such mix in that scope. Reader validation checks stored
strings before they become typed values. Move pairing and removal selection
create the lookup's inputs and are outside this rule. The guard compares
repository-relative file paths with POSIX separators on every platform, so it
scans the same files on Windows.

## Consumers

The server projection uses the lookup for counterparts, previous paths, usage
component names and removed-variant order. Each reader validates paths and
move records before it uses the lookup. Both catalogue readers then validate
usage component names through it. A catalogue reader takes the lookup's inputs
from the model's current entries, `removedEntries` and `previousPath` fields.
The review-result reader takes them from its own records: a record with an
`after` side is a current entry, a record with only a `before` side is a
removed record, and each `previousPath` is a pair. It resolves each evidence
context and chain component name on that evidence's side.

The data helpers, `catalogueComponentVariants` and the usage scope, take a
component parent, or resolve a variant's parent through the lookup. They
collect that parent's current variants and the removed variants that resolve
to it. A variant without an eligible parent collects only itself.

All shells use this lookup for affected-consumer destinations, usage labels
and links, `Used by` lists, the variant bar, Before and Current props,
supplied-input pairing, removed-variant tree attachment, component workspace
keys, and parent breadcrumbs. A workspace key uses the resolved eligible
parent's identity. It must not use the old `variantOf` of a removed child when
that parent moved or changed letter case.

Changes activation traverses the built navigation tree in its visible row
order. It does not reconstruct variant attachment, membership or ordering
from raw paths. Thus the row that navigation shows is also the row that
container activation can reach. Filter and activation presentation remain
under [navigation](./mokly-navigation.md#active-catalogue-visibility) and
[variant navigation](./mokly-variant-navigation.md#changes-rows).

## Verification

Pure tests cover each resolution step, kind isolation, current-side lookup,
case folding, counterpart absence, previous-path absence for case-only
renames, parent role checks, and the pair/current-path invariant. They cover
usage component names on both sides, including a variant at the named
identity and a name without a destination. Both complete and scoped readers
reject a removed variant without a nonempty `parentTitle`, and reject that
field on a removed non-variant. Both catalogue readers and the review-result
reader reject a `previousPath` that a current entry of the same kind uses,
also with different letter case. They accept it when only an entry of another
kind uses that path. The guard test rejects a sample of each mix in its scope,
and its file selection gives the same result with either path separator.

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
6. A component moves, and separately changes only letter case, while a
   removed screen uses it. The removed screen shows the component's title and
   link in Serve and export. The published catalogue keeps the usage, the
   embedded viewer inspects the screen, and the component's `Used by` in the
   embedded viewer lists the screen.
7. A parent component moves, and separately changes only letter case, with
   two removed variants in non-alphabetical authored order. The navigation,
   the variant bar, the published catalogue and the embedded viewer keep the
   authored order.
8. A variant with a nested component moves into a new component, and the
   nested input changes. Details in Serve and export shows the Before and
   Current values.

Assert pairs, `previousPath`, removed titles and agreement between both
readers. Run the same cases through Serve, export and the embedded viewer at
desktop and mobile widths. Assert usage link targets and destination titles,
usage labels, props where baseline usage exists, removed rows and their order,
retained comparison mode, Changes activation order, and crumb text and links.
HTTP success alone is not sufficient. The moved-consumer case must export
successfully.

## Related Docs

- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Catalogue serialization](./mokly-catalogue-serialization.md)
- [Component review validation](./mokly-component-review-validation.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
