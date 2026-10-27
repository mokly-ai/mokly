# Component Change Attribution

## Changes Membership

Changes counts directly changed entries, components and component variants
included, once per entry, under the
[Changes count](./mokly-catalogue-changes.md#changes-count). Instances and
affected consumers do not increase that count. Folder ancestor disclosure and screen-to-use-case propagation
apply as for every entry; an affected-only screen does not make its use cases
changed. The [comparison contract](./mokly-comparison.md#changes-membership)
owns the membership list. This page states how a component edit is attributed.

| Edit                                                    | Direct Changes entries                                    | Secondary impact                                              |
| ------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Component render, or the styles its render returns      | Component                                                 | Its consuming screens and components                          |
| Screen supplies different props to an instance          | Screen                                                    | None from this edit alone                                     |
| Screen changes the slot content it supplies             | Screen                                                    | None from this edit alone                                     |
| Screen adds, removes, replaces, or reorders an instance | Screen                                                    | Usage links update                                            |
| Screen changes surrounding content or layout            | Screen                                                    | The ordinary screen and use case rules                        |
| Parent component changes the props it passes to a child | Parent component                                          | The parent's consumers                                        |
| Child render changes with the parent's inputs unchanged | Child component                                           | Parent components and consuming screens                       |
| Component and a consuming screen both change directly   | Component and screen                                      | The screen is also a consumer                                 |
| Variant props, title, or description change             | That variant entry                                        | Consumers only when their render or rendered resources change |
| Prop schema, controls, or declared slots change         | Component parent                                          | Consumers only when their render or rendered resources change |
| Other parent metadata changes                           | Parent and each variant whose metadata projection changes | Consumers only when their render or rendered resources change |
| Temporary control edits in Serve                        | None                                                      | None                                                          |

| CSS delivery path                   | Direct Changes entries                                                                                      | Secondary impact                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Styles a sidecar render returned    | Owners with matches kept by the shared nested test; entry-owned unresolved rules                            | Consumers of those components         |
| Unowned head `<style>` elements     | Components with kept own-page matches in physical regions; entries with outside matches or unresolved rules | Consumers of a component owner        |
| Configured stylesheet               | Components with kept own-page matches; entries with outside matches or unresolved rules                     | Consumers of those changed components |
| Component `stylesheets` declaration | The same rule; declaring the file grants no ownership                                                       | The same affected-consumer rule       |
| Import from a stylesheet            | The same rule, using the changed imported stylesheet                                                        | The same affected-consumer rule       |
| JavaScript import into a bundle     | The same rule, joining equal changed rules across bundles                                                   | The same affected-consumer rule       |

The [CSS rule contract](./mokly-css-attribution-rules.md) defines containment
and identity. A component row through a linked stylesheet requires
own-page matches kept after the nested-component test; inclusive nested
regions stay part of the entry's own containment; consumer-instance matches
alone never change the component. On a component page, a wrapper-only or
unresolved entry reason adds the entry that owns the view and gives it no
Affected screens for that rule.

A component render edit lists each variant entry whose views changed, and the
component's own entry when its own views changed. The parent entry is also
listed for its own reasons: schema, controls, slots, declared metadata,
non-CSS resource ownership, and rules it owns on its own pages. A parent whose
only change is a changed variant carries the navigation aggregate mark of the
[variant navigation contract](./mokly-variant-navigation.md#changes-rows) and
is not a Changes row. Affected-consumer evidence keys on the component's path,
the one identity a component has, which every instance region carries.

A component page has Used by links for every known consumer. A changed
component also has Affected screens, built from the union of base and head
usage, including transitive use and removed consumers. Each canonical screen
appears once with its affected view and instance evidence. A direct screen
change does not remove it from the list. Each link names the entry whose views
its evidence names, so a variant's own views link the variant. In Serve and in
a static build, a link opens the consumer's Side by side comparison when that
view has a base side, in or out of Changes. An Added consumer opens Current
because its view has no base side. A consumer without a row stays Unmodified and
outside Changes. A pure move, a consumer whose other views changed, and a
component variant compare the linked view the same way. A React host opens the
consumer in Current, where the band offers the same comparison. A removed
screen consumer opens its previous version. Affected describes usage evidence,
not proof of a visual regression: a changed component can alter surrounding layout
without changing any screen-owned markup, and no pixel or layout-safety claim
is inferred.

## One Classification Policy

Serve's background classification, the selected comparison, watched updates,
`build`, and `publish` apply the same materiality policy to the same composed
trees, so Changes rows, counts, on-demand results, and built output agree.
Every catalogue, with or without registered components, follows it.
Registering an unrelated component in a catalogue without components must not
add an unchanged screen or component to Changes. Classification generates no
snapshot and copies no asset. Opening All or Changes, navigating, changing
viewport or scheme in Current, and a watch notification generate no
comparison. A source, configuration, stylesheet, resource, or base ref change
that affects the inputs of a classification invalidates its result.

The comparison artifact is the review result v8 of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4),
with component and variant records and explicit affected-consumer evidence,
every record addressed by its entry path and every rule and resource record
naming its owner. Screen records keep their actual view states, with
affected-only evidence separate from direct membership. Every comparison
keeps the real bytes of both sides and isolated assets. The
[comparison schema](./mokly-component-review.md) defines the reasons, the
affected evidence, and the side pairing; the
[validation contract](./mokly-component-review-validation.md) defines the
validation. The [selected comparison](./mokly-selected-comparisons.md) of
Serve projects this completed evidence onto one entry before it captures that
entry's snapshots, and the shell keeps the catalogue-wide affected-consumer
evidence.

## Normalization And Input Ownership

Instances pair across the sides by owner, scoped instance id, component path,
viewport, and scheme, read from the instance regions of the
[tree model](./mokly-comparison.md#tree-model); a variant entry's own
comparison is keyed by that entry's path. In a consumer's view, a paired
instance region is compared by its identity, the component path, the instance
id, and the canonical props digest that the region carries, not by its
rendered content. The caller's slot content and the order of its instances
stay in the caller's comparison. This suppresses the component's internal
rendering changes in the consumer and keeps the consumer's input changes, even
when the two sides render identical HTML.

The component under review is never projected against itself on its own page.
Nested registered components use the same boundary, so a child-only render
edit does not create duplicate direct changes on every parent. Props a parent
passes to a child are owned by the parent; props and slot content the screen
supplies stay owned by the screen regardless of their place in the tree.

Slot content is compared in its supplier's view, because its owner is the
region that supplied it. Nested instance regions inside the slot keep their
own identities and input signals; the outer projection must not erase them.
Added, removed, replaced, and reordered instances stay material, including an
instance that renders nothing.
CSS claims use physical containment. A receiver's declared rule can own a
match on supplied content. Supplier ancestry only prevents that receiver from
taking the supplier's own rule for the supplied content.

Props digests use the canonical JSON of the
[entry props contract](./mokly-entry-props.md) for every declared prop. Object
key order is immaterial; array order, primitive types, `null`, and an absent
optional prop are explicit. Missing input evidence never means unchanged
inputs; an incomplete region fails validation instead of granting blanket
ignore behaviour.

Review-ignore regions keep their id, material key, and one-sided adoption
rules. An ignore region may lie inside a component's render, but it may not
enclose an instance boundary or caller-owned slot content and erase their
signals; that composition fails with a validation diagnostic.

### Unchanged view decision

A view is `unchanged` when the canonical forms of its two sides, after the
instance projection above, are equal and no rule or resource record on the
view is owned by the entry. A component-owned record leaves the view
`unchanged` and the entry affected; an `ignored-only` view follows the
[materiality rule](./mokly-comparison.md#materiality). An `unchanged` or
`ignored-only` view keeps its `ignoredIds` and adds no implementation-impact
or owned-resource evidence. Serve's background classification and the
complete comparison produce equal records for one view.

## Rendered Resources And Styles

Stylesheet changes follow one rule for configured, declared, transitively
imported, JavaScript-bundled, and ownerless head CSS. Match each changed rule against both
sides' composed trees. A component changes through a linked stylesheet only
through a kept match in its root region on one of its own pages. X loses a
match inside a different nested Y when this rule has any match on Y's own
pages, before filtering Y's nested regions. Self-nested X never takes a match
from X. The test needs no ordering, even with mutual nesting. Only kept
matches give X's variants component reasons; entry evidence uses inclusive
containment. Identical changed rules across stylesheets match by their
normalized before and after selectors and declarations, never by their path
or owner.
A receiving component claims supplied content through these sources only
when its own pages prove the rule. Otherwise the match uses the entry rule
below, just as a linked stylesheet does.

An entry has its own row when a match is left outside every component changed
by that rule, or when the rule is unresolved. Otherwise a consumer stays under
Affected screens. A wrapper outside a component page's root region is entry
material. Only a rule with no match and no unresolved outcome produces no
record. Per-rule facts are kept before any merging by stylesheet. See the
[rule contract](./mokly-css-attribution-rules.md) and the
[evidence schema](./mokly-css-attribution-membership.md).

Styles a [sidecar](./mokly-sidecar.md#style-collection) render returned keep
trusted owners and normalized rule identities. Owned rules use the same
catalogue-wide unfiltered own-page sets and nested test as linked CSS. A
self-nested copy never takes its own component's match. Supplier input ancestry
only filters whether a nested component takes a supplier's own rule.
Declared owners claim kept matches inside their physical regions, including
supplied content and instances whose own previews have no matching content.
Equal rules join proof across documents
with different owners. Kept own-page matches give component reasons; a kept
exact-instance match can still prove an implementation change with unchanged
caller inputs. Unresolved rules keep entry ownership. Owned, ownerless head,
and linked CSS follow the same evidence rules, including the one excluded
source record of a view where none of the source's changed rules applies.
Mokly derives no stylesheet ownership from files. A renderer `resources` record
for a stylesheet supplies no CSS evidence and raises the `stylesheet-owner`
warning of the [rendering contract](./mokly-rendering.md#renderer-module). A
component's `stylesheets` declaration controls links only.
Adding or removing a declaration changes material only when the composed
document changes or when rule or resource evidence changes. Starting or
stopping a child is a parent usage change; a child's link adds no consumer
document reason.

Non-CSS resources keep file-level attribution. A changed non-CSS resource is
a reason for every view that references it, attributed to the owner of the
referencing element under the [resource rule](./mokly-comparison.md#resources):
a component when the reference lies inside its region, including an instance
with no matching variant, else the entry. A consumer whose only reason is a
component-owned resource stays affected-only. Source modules and unrendered
files supply no ownership and no evidence.

Every classification path uses the same unfiltered and kept own-page sets:
background classification, the selected comparison, `build`, and `publish`.
CSS stays eligible through actual resource discovery in the composed trees
regardless of ownership. Snapshots keep the actual styles, fonts, and images;
nothing strips styles or whole documents to suppress consumer rows. Component
styling stays visibly changed in an affected screen's comparison.

## Sides

The [validation contract](./mokly-component-review-validation.md#sides)
defines the sides, the pairing of components and variants, and the missing
side rules.
