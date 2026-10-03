# Component Change Attribution

## Delivery Status

Document and non-CSS attribution are implemented. Uniform CSS classification
is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
Its comparison details are planned for [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

## Changes Membership

Changes counts directly changed entries, including components and component
variant entries, once per entry. Instances and affected consumers do not
increase that count.
Existing folder ancestor disclosure and screen-to-use-case propagation
remain; an affected-only screen does not make its use cases changed.

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
Affected-consumer evidence keys on the parent component id, which instance
records reference.

A component page has Used by links for all known consumers. A changed component
also has Affected screens, built from the union of baseline and current usage,
including transitive component use and removed consumers. Each canonical screen
appears once with affected view/instance evidence. A direct screen change does
not remove it from this list. Links can open the actual before/current screen
comparison even when the screen has no row in Changes.

Affected describes dependency/usage evidence, not proof of a visual regression.
In derived mode, a resource-byte difference without a changed Git path is a
material change. It does not invent a Git dependency reason or changed path.
No pixel counts or layout-safety claims are inferred. A changed component can
alter surrounding layout without changing any screen-owned markup.

## One Classification Policy

Browse, watched Changes updates, comparison JSON, and published catalogues use
one materiality policy. A raw generated HTML path appearing in Git is candidate
evidence, not sufficient reason to classify a registered consumer as changed.
Component catalogues use the same ownership-aware classifier for Browse and
detailed comparisons; unregistered catalogues retain their id-keyed
changed-entry set.

That set is `changedIds`: the ids of every current entry whose
material, resources, or reviewable metadata differ from the baseline, plus the
flows that step through a changed screen.

Lightweight Browse classification reads the current compiled manifest and usage
metadata together with the baseline manifest and required fragment material.
Committed mode reads the baseline side from Git branch-point blobs; derived mode
reads it from the validated rebuilt cache. It does not generate snapshots or copy
comparison assets. Opening All/Changes, navigating, changing viewport/theme in
Current, and watch notifications retain the no-eager-comparison-generation
contract. Cache classification by catalogue generation and resolved baseline;
invalidate it with source, config, stylesheet, resource, or Git-baseline changes
that affect its inputs. No-watch Serve and publication instead reuse their
validated startup snapshot, including ownership evidence and unavailable-history
state, for the lifetime of that capture.

The comparison artifact is the schema v5 result with component/variant records
and explicit affected-consumer evidence; readers accept only v5, and every
record addresses its entry by id. Screen entries retain their actual view
results, with affected-only evidence separate from direct Changes membership.
All comparisons keep accepted before/after bytes and isolated assets.
The [comparison schema](./mokly-component-review.md) defines the exact result,
Changes membership, reasons, affected evidence, and side pairing; the [validation contract](./mokly-component-review-validation.md) defines validation.
Live [selected comparisons](./mokly-selected-comparisons.md) project this
completed evidence onto one screen or component variant entry before capturing
its assets.
They retain the full catalogue's affected-consumer evidence in the shell inspector.

## Normalization And Input Ownership

Match component occurrences by owner, scoped instance id, component id, viewport,
and scheme; a component variant entry's own comparison is keyed by that entry's
id. At a consuming
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
[stylesheet-owner warning](./mokly-build-warnings.md#exact-messages), after
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

Renderer `styles` records still identify exact document material ranges, such
as component-generated text in a head style element. These records do not own
stylesheet files. Validate offsets against the final compatibility output.
Only proven owned document material is excluded from a consumer projection;
mixed or unclaimed head material stays material.

All classification paths use the same unfiltered and kept own-page CSS sets, including
the fast decision, Browse, selected comparisons and publication. Keep CSS
eligible through actual normalized resource discovery regardless of ownership
projection. Retain actual styles, fonts and images in screenshots and snapshot
trees; never strip styles or whole documents to suppress consumer rows.

## Baselines

Baseline and current documents come from validated manifest-v8 output and
retain their original bytes. Style offsets and component ranges share each
document's UTF-16 coordinate space. Historical v3–v7 metadata is normalized
before attribution. An older stored route layout never reaches attribution;
it follows the [baseline compatibility contract](./mokly-baseline-compatibility.md).

Use the existing merge base with `origin/main` or the configured base; staged,
unstaged, and untracked current edits still participate. Cross-kind id reuse
follows the [comparison pairing rule](./mokly-changes-serving.md#comparison-engine);
title edits remain metadata changes.

New/removed components and variants retain explicit missing comparison sides.
Union baseline/current usage so removing a component does not erase its former
consumers. A component with no saved variant affected by an implementation edit
can still be changed through a linked owned non-CSS resource or a proven
implementation difference at a paired actual invocation with unchanged inputs.
This exception never supplies a stylesheet-rule component reason.
For that invocation, retain parent-owned child inputs and exclude caller-owned
slots using the same ownership policy as saved variants. Metadata-only edits
do not invent affected consumers. Do not
invent a variant representing every possible prop combination.

When either side lacks validated component metadata, compare its real content
conservatively. Initial registration or one-sided ownership adoption must not
hide a simultaneous edit or create synthetic empty components. Do not rebuild
or check out the baseline during comparison.

## Required Evidence

Unit/integration and browser fixtures must establish agreement between Changes
rows/count, on-demand results, watch updates, and published output. Cover all
rows in the table, repeated/nested/empty instances, caller-owned slots, invalid
markers, unchanged-render prop edits, both viewports/themes, owned external and
head styles, shared rendered-resource ownership, independent screen edits, compatible and
incompatible baselines, removed consumers, and concurrent watched updates. Component styling
must remain visibly changed in an affected screen's comparison.

Historical dependency declaration provenance is ignored in attribution and
display. Registering an unrelated component in a previously component-free
catalogue must not add an otherwise unchanged screen or component to Changes.
