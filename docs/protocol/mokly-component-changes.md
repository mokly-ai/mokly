# Component Change Attribution

## Delivery Status

Main's source-path removal and file-level rule membership are implemented in the
[source-path removal plan](../../plans/remove-source-path-evidence.md).
The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
integrates [original-page analysis](./mokly-page-analysis.md),
[inline ownership](./mokly-inline-styles.md) and the
[equivalent style route](./mokly-style-only-route.md) with that policy.
The [fast-path contract](./mokly-component-review-fast-path.md) owns ordering.
All classification paths share path-keyed v7 results. Inline evidence stays in
the review and catalogue data; its separate mockup and UI work is scheduled in
Milestones 16 and 17 of the scalable plan. Performance acceptance is deferred
under that plan's Decision 13 (2026-10-06).

## Changes Membership

Changes counts each directly changed entry, including components/variants,
once, not instances or affected consumers. Folder ancestor disclosure and
screen-to-use-case propagation remain; affected-only screens do not flag use cases.

| Edit                                                      | Direct Changes entries | Secondary impact                                                       |
| --------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Component implementation or owned document style material | Component              | Its consuming screens/components                                       |
| Screen supplies different component data props            | Screen                 | None solely from this input edit                                       |
| Screen changes rendered slot content                      | Screen                 | None solely from this content edit                                     |
| Screen adds/removes/replaces/reorders an instance         | Screen                 | Usage links update                                                     |
| Screen changes surrounding content or layout              | Screen                 | Existing screen/use-case rules                                         |
| Parent component changes props passed to a child          | Parent component       | Parent's consuming screens                                             |
| Child implementation changes with parent inputs unchanged | Child component        | Parent components and consuming screens                                |
| Component and a consuming screen both change directly     | Component and screen   | Screen is also a consumer                                              |
| Component variant props, title, or description change     | That variant entry     | Consumers only when their rendering or rendered resources are affected |
| Component controls schema or parent metadata changes      | Component              | Consumers only when their rendering or rendered resources are affected |
| Temporary controls edits                                  | None                   | None                                                                   |

| CSS delivery path                    | Direct Changes entries                                                                     | Secondary impact                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| Configured stylesheet                | Components with kept own-page rule matches; pages with outside matches or unresolved rules | Consumers of those changed components |
| Component `stylesheets` declaration  | The same rule; declaring the file grants no ownership                                      | The same affected-consumer rule       |
| Import from a stylesheet             | The same rule, using the changed imported file                                             | The same affected-consumer rule       |
| JavaScript import into generated CSS | The same rule, joining equal changed rules across entry bundles                            | The same affected-consumer rule       |

The [CSS rule contract](./mokly-css-attribution-rules.md) defines containment,
identity and examples. Component rows require own-page matches kept after the
nested-component test. Inclusive nested output remains part of page-row
containment. Consumer invocation matches alone never change that component.
On a component page, a wrapper-only or unresolved page reason adds the saved
variant entry, but gives it no Affected screens for that rule.

A component implementation or owned document-style edit lists each variant entry
whose views changed. The parent entry is listed only for its own reasons:
schema, controls, slots, declared metadata, non-CSS resource ownership, and
CSS rules with kept matches in its own output on its own saved pages. A parent whose only change is a
changed variant carries the navigation aggregate mark defined by the
[variant navigation contract](./mokly-variant-navigation.md#changes-rows) and is
not a Changes row.
Affected-consumer evidence keys on the parent component's path, which instance
records reference as `componentId`.

A component page has Used by links for all known consumers. A changed component
also has Affected screens, built from the union of baseline and current usage,
including transitive component use and removed consumers. Each canonical screen
appears once with affected view/instance evidence. A direct screen change does
not remove it from this list. Links can open the actual before/current screen
comparison even when the screen has no row in Changes.

Affected describes dependency/usage evidence, not proof of a visual regression.
For any baseline source, pair generated views by route and authored assets by
their side's catalogue-relative path, using the
[baseline descriptor](./mokly-baseline-addressing.md#comparison-namespaces).
Git changed-path evidence remains repository-relative; it does not translate
historical roots. A non-CSS resource-byte difference without a changed Git path
is a material change. Preserve actual public-pipeline CSS rule evidence. Without
Git evidence, CSS byte differences retain the material-reason and view-state
fallback only when that stylesheet is linked on both actual sides. One-sided
inserted-link membership and projection-only CSS cannot grant it. The fallback
does not invent a Git dependency reason or changed path.
No pixel counts or layout-safety claims are inferred. A changed component can
alter surrounding layout without changing any screen-owned markup.

## One Classification Policy

Browse, watched Changes updates, comparison JSON, and published catalogues use
one materiality policy. A raw generated HTML path appearing in Git is candidate
evidence, not sufficient reason to classify a registered consumer as changed.
Component catalogues use the same ownership-aware classifier for Browse and
detailed comparisons; unregistered catalogues retain their path-keyed
changed-entry set.

That set is `changedEntries` in the
[catalogue change snapshot](./mokly-catalogue-changes.md): the paths of every
current entry whose material, resources, or reviewable metadata differ from its
baseline or paired baseline entry, plus the flows that step through a changed
screen.

Lightweight Browse classification reads the current compiled manifest and usage
metadata together with the baseline manifest and required fragment material.
Per-commit selection reads complete Git blobs or the validated rebuilt cache.
It does not generate snapshots or copy
comparison assets. Opening All/Changes, navigating, changing viewport/theme in
Current, and watch notifications retain the no-eager-comparison-generation
contract. Cache classification by catalogue generation and resolved baseline;
invalidate it with source, config, stylesheet, resource, or Git-baseline changes
that affect its inputs. No-watch Serve and publication instead reuse their
validated startup snapshot, including ownership evidence and unavailable-history
state, for the lifetime of that capture.

The comparison artifact is the review result v7 with component/variant records
and explicit affected-consumer evidence. Readers accept only review result v7.
Every record addresses its entry by path. Screen entries retain their actual view
results, with affected-only evidence separate from direct Changes membership.
All comparisons keep accepted before/after bytes and isolated assets.
The [comparison schema](./mokly-component-review.md) defines the exact result,
Changes membership, reasons, affected evidence, and side pairing; the [validation contract](./mokly-component-review-validation.md) defines validation.
Live [selected comparisons](./mokly-selected-comparisons.md) project this
completed evidence onto one screen or component variant entry before capturing
its assets.
They retain the full catalogue's affected-consumer evidence in the shell inspector.

## Normalization And Input Ownership

Match component occurrences by owner, scoped instance id, `componentId`,
viewport, and scheme; a component variant entry's own comparison is keyed by
that entry's path. At a consuming
boundary, replace only a paired component's implementation output with its
stable identity token. Keep the caller's input material and occurrence order in
the caller's comparison. This suppresses internal rendering changes while
retaining input changes even when they currently render identical HTML.

The component under review is never ignored against itself on its own page.
Its own Mokly-inserted stylesheet links stay in its comparison material; a
child-only inserted link does not. A screen's inserted component links never
count as screen material. Renderer-authored links stay material even when
Mokly reuses them for declared stylesheets. The
[stylesheet provenance contract](./mokly-component-stylesheet-ownership.md#provenance-and-comparison-material)
defines the private final-document spans that distinguish those cases.
Nested registered components use the same boundary rules, so a child-only
implementation edit does not create duplicate direct changes on every parent.
Internal child props are owned by the parent component; props supplied by the
screen into a slot remain owned by the screen regardless of their DOM nesting.

Rendered slot content is projected back into its caller's material before
normalization of the receiving component. Nested boundaries inside the slot
retain their own identities and data input signals. Outer suppression must not
erase these signals. Added/removed/replaced occurrences and changes in their
ordered position remain material, including empty-rendering instances.

Data keys use the shared [prop validator and codec](./mokly-component-props.md)
for every declared prop, including uncontrolled fields. Object key order is
immaterial; array order, primitive types, null, and optional undefined semantics
remain explicit. Missing input evidence never means unchanged inputs. Invalid
or incomplete records fail validation instead
of granting blanket ignore behavior.

Existing manual `ReviewIgnore` regions retain their current id, material, and
one-sided adoption semantics. Component markers are a separate ownership tree;
do not weaken the flat parser by accepting arbitrary nested ignore regions.
Manual ignore regions may sit within component-owned implementation, but may
not enclose instance boundaries or caller-owned slots and erase their signals.
The root-only CSS boundary preserves existing valid Review-ignore regions.
Reject that ambiguous composition with a validation diagnostic. Existing
catalogues without component boundaries remain byte-compatible.

### Unchanged view decision

The [component review fast-path contract](./mokly-component-review-fast-path.md)
owns the ordered decision, usage exceptions, actual/projected resource proof,
cache reuse, one-sided validation, and equivalence tests.

## Rendered Resources And Styles

Stylesheet changes follow one rule for configured, declared, transitively
imported and JavaScript-bundled CSS. Match each changed rule against before and
after documents after paired Review-ignore. A component changes only through
a kept match in its root output on one of its own saved pages. X loses a match
inside a different nested Y if this rule has any match on Y's own pages, before
filtering Y's nested output. Self-nested X never takes a match from X. This test
needs no ordering, even with mutual nesting. Only kept matches give X's saved
variants component reasons; page rows use inclusive output containment.
Match identical changed rules across files by their normalized
before/after selectors and declarations, never by their source path or owner.

A page has its own row when a match remains outside every component changed by
that rule, or the rule is unresolved. Otherwise a consumer stays under Affected
screens. A wrapper outside a component page's root counts as page material.
Only rules with no matches and no unresolved outcome are excluded. Retain
per-rule facts before merging evidence by path. See the
[rule contract](./mokly-css-attribution-rules.md) and
[evidence schema](./mokly-css-attribution-membership.md).

Mokly derives no CSS resource ownership records. Renderer `resources` records
for any stylesheet are ignored with the
[stylesheet-owner warning](./mokly-component-stylesheet-ownership.md#ignored-owner-warning), after
public-path safety checks. Declarations still control links and
`insertedStylesheets` provenance. Adding or removing a declaration changes
material only if retained document content changes, or CSS/resource evidence
changes. Reusing an identical configured link creates no owner-change reason.
Starting or stopping a child remains a parent usage/structure change; an
inserted child link creates no additional consumer document reason.

Non-CSS resources retain file-level attribution. A retained non-CSS resource
reason belongs to every rendered component named by that view's `resources`
record, including an actual invocation with no matching saved variant. Its
consumers stay affected-only unless they have an independent change. An
unowned non-CSS resource reason stays with the consuming page. Source modules
and unrendered files supply no ownership or evidence.

Eligible inline style rules use [inferred ownership](./mokly-inline-styles.md).
Unresolved rules and rules that reach entry markup stay with that entry;
unmatched rules are excluded, and owned rules follow paired equal-input
components. On a component's saved page, its root maps to the entry.
Returned renderer `styles` assertions are ignored with a warning.

CSS file delivery uses the own-page rule membership above, including a file
reached from an inline `@import`. CSS files never receive resource owners.
Non-CSS references use the union of renderer-record and inferred-inline owners.
Evidence at an actual invocation can keep an owner changed even when no saved
variant reaches that path. A changed Git path supplies a dependency reason;
byte-only changes supply material without invented Git evidence. Independent
entry reachability remains independent. See [resource propagation](./mokly-inline-style-resources.md#resolution-and-propagation).

All classification paths use the same unfiltered and kept own-page CSS sets.
Original view analyses supply matching trees under [page matching](./mokly-page-analysis.md#original-page-matching),
while paired ignores and ownership recipes determine retained resource material.
Keep CSS eligible through actual resource discovery regardless of ownership
projection. Retain actual styles, fonts and images in snapshots; never strip
styles or whole documents to suppress consumer rows.

## Baselines

The [baseline validation contract](./mokly-component-review-validation.md#baselines)
defines same-version admission, original snapshot bytes and source protection.

## Required Evidence

Unit, integration and browser fixtures must agree on Changes, affected consumers,
watch updates and published output. Cover repeated, nested and empty instances,
caller slots, root boundaries and paired ignores, invalid markers, unchanged-render
prop edits, both viewport/theme axes, linked file membership and inferred inline
ownership. Include non-CSS record/inline owner unions, byte-only edits, independent
screen edits, removed consumers and concurrent updates. Comparisons must retain
component styling in affected screens.

Historical source-path declarations supply no attribution or display evidence.
Registering an unrelated component must not add an unchanged entry to Changes.
