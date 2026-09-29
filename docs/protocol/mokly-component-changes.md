# Component Change Attribution

## Delivery Status

The classifier, Browse/watch cache, comparison artifacts, and static exporter
share this attribution policy. The [component explorer plan](../../plans/component-explorer.md)
records delivery. Unregistered catalogues retain their ordinary behavior.

## Changes Membership

Changes counts directly changed entries, including components and component
variant entries, once per entry. Instances and affected consumers do not
increase that count.
Existing folder ancestor disclosure and screen-to-use-case propagation
remain; an affected-only screen does not make its use cases changed.

| Edit                                                      | Direct Changes entries | Secondary impact                                              |
| --------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Component implementation or owned styling                 | Component              | Its consuming screens/components                              |
| Screen supplies different component data props            | Screen                 | None solely from this input edit                              |
| Screen changes rendered slot content                      | Screen                 | None solely from this content edit                            |
| Screen adds/removes/replaces/reorders an instance         | Screen                 | Usage links update                                            |
| Screen changes surrounding content or layout              | Screen                 | Existing screen/use-case rules                                |
| Parent component changes props passed to a child          | Parent component       | Parent's consuming screens                                    |
| Child implementation changes with parent inputs unchanged | Child component        | Parent components and consuming screens                       |
| Component and a consuming screen both change directly     | Component and screen   | Screen is also a consumer                                     |
| Component variant props, title, or description change     | That variant entry     | Consumers only when their rendering/dependencies are affected |
| Component controls schema or parent metadata changes      | Component              | Consumers only when their rendering/dependencies are affected |
| Temporary controls edits                                  | None                   | None                                                          |

A component implementation or owned-style edit lists each variant entry
whose views changed. The parent entry is listed only for its own reasons:
schema, controls, slots, declared metadata, and declared-file or shared-file
evidence attributed to the component itself. A parent whose only change is a
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

The comparison artifact is the schema v4 result with component/variant records
and explicit affected-consumer evidence; readers accept only v4, and every
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
not enclose component boundaries or caller-owned slots and erase their signals.
Reject that ambiguous composition with a validation diagnostic. Existing
catalogues without component boundaries remain byte-compatible.

### Unchanged view decision

The [component review fast-path contract](./mokly-component-review-fast-path.md)
owns the ordered decision, usage exceptions, actual/projected resource proof,
cache reuse, one-sided validation, and equivalence tests.

## Dependencies And Styles

Component registration declares implementation dependency paths. Ownership must
be explicit: ordinary shared registry/source-module attribution is not proof
that the entire file belongs exclusively to one component. A component may
declare `ownedDependencies` for files or directory roots whose effects are
confined to the named registered component(s). These paths follow normal
repository confinement and validation and are included in its dependencies.
Shared ownership by several registered components is allowed and affects each.

A changed path gives an entry an independent `dependency` reason only when, on either side, the entry:

1. is a component whose `ownedDependencies` file or directory root contains it;
2. is a screen whose `declaredDependencies` names it exactly, owned or not; or
3. names it exactly in `declaredDependencies`, and no component owns it.

A `review.sharedImpact` glob match, a file inside a declared dependency
directory, or automatic source attribution alone adds no reason, Changes row,
affected consumer, or use-case `screen` reason. Renderer, theme, and token
edits still reach Changes when rendered documents or referenced resources change.

For linked stylesheets, [CSS change attribution](./mokly-css-attribution.md)
keeps a consuming view in Changes only when a changed rule could match that
view's document or cannot be resolved, and otherwise records it as examined
and excluded. Ownership and rule analysis compose; neither widens the other.
Ownership is not inferred from a filename, one import, or the presence of a
component marker somewhere in the document. Screen/component-owned
dependency overlap must be validated and explained rather than silently dropped.
The rule analysis is implemented in Browse/watch classification, complete and
selected comparison evidence, and publication. Actual normalized view documents
supply matching trees; ownership projections supply eligible resources. A public
stylesheet glob or dependency declaration cannot restore an excluded stylesheet.
Entry reasons combine retained view selectors by path, with unresolved evidence
taking precedence, while excluded resources stay on their own views. Formatting
alone therefore leaves every consumer out of Changes for that stylesheet.
Retained CSS evidence at an actual invocation also keeps its explicit or
renderer-proven component owner in Changes when saved variants do not match.
Their own view exclusions stay intact; affected-consumer links retain the actual
invocation context. An exact screen dependency can independently retain the same
stylesheet only when its actual view analysis keeps it. Non-CSS path-only
evidence follows the independent-reason rule above.

Component-generated style material can live in the document head rather than
inside a component boundary. Extend the renderer result with optional typed
style/resource ownership records while continuing to accept a plain HTML string.
Records identify exact style ranges or public resource paths and component
owners. Validate them against the rendered document and final compatibility
output. Only proven component-owned material is excluded from the consuming
screen projection; mixed or unclaimed head material remains material.

Owned asset edits must flag component pages even when HTML is byte-identical.
Retain actual styles, fonts, and images in screenshots and snapshot trees. Never
strip all styles, drop a shared-impact glob globally, or ignore the whole
consumer document to make a component-only example pass.

## Baselines

Baseline and current documents come from validated manifest-v7 output and
retain their original bytes. Style offsets and component ranges share each
document's UTF-16 coordinate space. Earlier output never reaches attribution;
it follows the [baseline compatibility contract](./mokly-baseline-compatibility.md).

Use the existing merge base with `origin/main` or the configured base; staged,
unstaged, and untracked current edits still participate. Cross-kind id reuse
follows the [comparison pairing rule](./mokly-changes.md#comparison-engine);
title edits remain metadata changes.

New/removed components and variants retain explicit missing comparison sides.
Union baseline/current usage so removing a component does not erase its former
consumers. A component with no saved variant affected by an implementation edit
can still be changed through declared implementation dependencies or a proven
implementation difference at a paired actual invocation with unchanged inputs.
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
head styles, shared-impact overlap, independent screen edits, compatible and
incompatible baselines, removed consumers, and concurrent watched updates. Component styling
must remain visibly changed in an affected screen's comparison.

Dependency declaration provenance is attribution input, not display metadata.
Changing declarations without a matching changed resource, or registering an
unrelated component in a previously component-free catalogue, must not add an
otherwise unchanged screen or component to Changes.
