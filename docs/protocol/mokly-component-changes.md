# Component Change Attribution

## Delivery Status

The classifier, Browse/watch cache, comparison artifacts, and static exporter
share this attribution policy. The [component explorer plan](../../plans/component-explorer.md)
records delivery. Unregistered catalogue and legacy behavior remains intact.

## Changes Membership

Changes counts directly changed routed entries, including components, once per
entry. Variants, instances, and affected consumers do not increase that count.
Existing collection ancestor disclosure and screen-to-use-case propagation
remain; an affected-only screen does not make its use cases changed.

| Edit                                                          | Direct Changes entries | Secondary impact                                              |
| ------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Component implementation or owned styling                     | Component              | Its consuming screens/components                              |
| Screen supplies different component data props                | Screen                 | None solely from this input edit                              |
| Screen changes rendered slot content                          | Screen                 | None solely from this content edit                            |
| Screen adds/removes/replaces/reorders an instance             | Screen                 | Usage links update                                            |
| Screen changes surrounding content or layout                  | Screen                 | Existing screen/use-case rules                                |
| Parent component changes props passed to a child              | Parent component       | Parent's consuming screens                                    |
| Child implementation changes with parent inputs unchanged     | Child component        | Parent components and consuming screens                       |
| Component and a consuming screen both change directly         | Component and screen   | Screen is also a consumer                                     |
| Component saved variant, controls schema, or metadata changes | Component              | Consumers only when their rendering/dependencies are affected |
| Temporary controls edits                                      | None                   | None                                                          |

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
historical roots. A resource-byte difference without a changed Git path is a
material change. It does not invent a Git dependency reason or changed path.
No pixel counts or layout-safety claims are inferred. A changed component can
alter surrounding layout without changing any screen-owned markup.

## One Classification Policy

Browse, watched Changes updates, comparison JSON, and published catalogues use
one materiality policy. A raw generated HTML path appearing in Git is candidate
evidence, not sufficient reason to classify a registered consumer as changed.
Component catalogues use the same ownership-aware classifier for Browse and
detailed comparisons; unregistered catalogues retain `changedManifestRoutes`.

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

The comparison artifact adds a versioned component/variant result and explicit
affected-consumer evidence. New readers retain schema-v2 screen artifact support;
component-aware results use schema v3. Screen entries retain their actual view
results, with affected-only evidence separate from direct Changes membership.
All comparisons keep full unmodified before/after documents and isolated assets.
The [comparison schema](./mokly-component-review.md) defines the exact result,
Changes membership, reasons, affected evidence, side pairing, and validation.
Live [selected comparisons](./mokly-selected-comparisons.md) project this
completed evidence onto one screen or saved variant before capturing its assets.
They retain the full catalogue's affected-consumer evidence in the shell inspector.

## Normalization And Input Ownership

Match component occurrences by owner, scoped instance id, component id, viewport,
and scheme; saved component comparisons also include variant id. At a consuming
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
Reject that ambiguous composition with a migration diagnostic. Existing
catalogues without component boundaries remain byte-compatible.

### Unchanged view decision

Classification cost must follow the size of the change, not the size of the
catalogue. For a view present on both sides, the classifier first decides
whether the view can differ at all. The decision validates ranges and projects
ownership only for views whose usage can edit text through instances, styles,
or entry-owned slots, then performs CSS rule analysis and implementation
diffing only on complete-path fall-through. That decision is part of the
materiality policy and must produce output equal to the complete
comparison for every view produced by the validated builder; a differential
test over the shared fixtures is required evidence. Identical handcrafted
documents with the same malformed ownership markers are outside this equality
guarantee for views without ownership text edits because those views do not
repeat range validation.

The decision, in order:

1. Normalize historical marker prefixes in the base document, retain component
   markers on both sides, and apply paired manual-ignore normalization. If the
   resulting documents differ outside paired ignored regions, take the
   complete path. Marker-stripped equality is not sufficient because marker
   positions participate in ownership projection.
2. Compare the two usage records canonically. Neither side having usage is
   eligible; exactly one side having usage takes the complete path. When both
   records exist, every field must match except `props` and `propsKey` on
   entry-owned instances. In particular, viewport, color scheme, instance
   `componentId`, `key`, `id`, `owner`, `slotKey`, and `order`, instance-owned
   `props` and `propsKey`, and every slot, range, style, and resource record
   must match. Optional invocation `source` metadata is excluded from this
   comparison, as it is from every Changes projection. Any other difference
   takes the complete path.
3. If the paired view routes differ, take the complete path. Otherwise form
   the actual normalized pair by stripping historical component markers
   from the base, stripping current component markers from the head, and
   applying paired manual-ignore normalization. If the normalized documents
   differ, take the complete path. Discover both historical and head closures
   independently, regardless of whether historical bytes came from Git or cache.
4. When either usage record has instances, styles, or entry-owned slots,
   compute the same ownership projection as the complete comparison, including
   historical/current range validation in each side's marker dialect and
   root-specific ownership.
   Require the projected HTML pair to be equal and discover its resources with
   the same exclusion policy. Discover both closures independently in every case.
5. If any actual or projected resource is a changed Git path, take the complete
   path; ownership, exclusion, and rule analysis are decided there.
6. Compare historical and current closure membership and
   bytes independently for actual material and projected material. Any
   difference in either comparison takes the complete path; equal unions do
   not substitute for equal per-comparison sets.
7. Otherwise the view is unchanged by content and resources. Its state is
   `unchanged` when the single-document normalizations of both stripped sides
   are equal and `ignored-only` otherwise; `ignoredIds` come from the paired
   normalization. The view carries no `material`, `reasons`, or
   `excludedResources` fields and contributes no owned-resource or
   implementation-impact evidence, exactly as the complete path would.

`inputs` and `structure` reasons are derived from validated usage records,
never from document text, so an entry-owned input edit that renders identical
HTML keeps its `inputs` reason on either path. Those entry-owned `props` and
`propsKey` values are the only usage fields allowed to differ because the fast
decision computes their signals with the same projection as the complete path.
Nested instance input changes and all topology or ownership changes require
projection and implementation-impact analysis. Entry-level `metadata`,
`added`, `removed`, and dependency reasons are unaffected because they are
computed outside the per-view comparison.

Projected resources are not always a subset of actual-document resources.
HTML parsing can discard caller slot content in contexts such as `template` or
`select`, while ownership projection can expose that content. Removing
component implementation text can also expose a later sibling that the
implementation's unclosed HTML had hidden. Views whose usage cannot edit
document text retain the actual-only proof. Views with instances, styles, or
entry-owned slots remain eligible after both actual and projected resource
comparisons are proved safe. Identical `(route, document, exclusion)` discovery
work is reused on fall-through.

Each resource discovery performed by the decision is reused when the view falls
through to the complete path. Each side passes byte-identical route and
normalized text to a cache keyed by route, content digest, and exclusion
callback identity, so discovery is never repeated for that document and
policy within one classification without retaining the full document as a map
key.

Added and removed views do not use the paired fast decision. Before their
one-sided document is normalized, the classifier validates all recorded
component ranges against that document. Removed base documents use the
historical marker dialect; added head documents use the current dialect. A
malformed one-sided ownership tree fails closed with a `$document` validation
error rather than being reported as an ordinary addition or removal.

## Dependencies And Styles

Component registration declares implementation dependency paths. Ownership must
be explicit: ordinary shared registry/source-module attribution is not proof
that the entire file belongs exclusively to one component. A component may
declare `ownedDependencies` for files or directory roots whose effects are
confined to the named registered component(s). These paths follow normal
repository confinement and validation and are included in its dependencies.
Shared ownership by several registered components is allowed and affects each.

A changed component-owned path is attributed to its component entries and
their affected consumers. Its presence in a broad `review.sharedImpact` glob
or containing screen dependency directory must not re-add those consumers to
Changes. The v4 `declaredDependencies` record distinguishes explicit paths from automatic
source attribution. An explicitly declared exact direct screen dependency, screen-owned
material change, or additional unowned changed path remains independent
evidence and keeps the screen in Changes.

Renderer, theme, global stylesheet, or mixed source-file changes whose effects
cannot be assigned exclusively retain the existing conservative shared-impact
behavior. For linked stylesheets that behavior is narrowed by
[CSS change attribution](./mokly-css-attribution.md): the stylesheet keeps a
consuming view in Changes only when a changed rule could match that view's
document or cannot be resolved, and otherwise is recorded as examined and
excluded. Ownership and rule analysis compose; neither widens the other. Ownership is not inferred from a filename, one import, or the presence
of a component marker somewhere in the document. Screen/component-owned
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
stylesheet only when its actual view analysis keeps it. Non-CSS dependencies
retain the existing file-level policy.

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

## Baselines And Migration

Historical Git documents may carry retired `mokabook-component` and
`mokabook-review-*` comments. Parse their boundaries against the original HTML:
style ownership offsets and component ranges must share its UTF-16 coordinate
space. Normalize retired comments only in comparison material after projection,
never before applying stored style offsets. Current output remains `mokly`-only;
historical and current snapshots retain their original bytes. A marker-only
rename is not a content change, while owned CSS edits still affect the component
and independent caller edits still affect the consumer.

Use the existing merge base with `origin/main` or the configured base; staged,
unstaged, and untracked current edits still participate. Pair component entries
by stable id, and variants by component id plus variant id; route or title edits
remain metadata changes. Screen route pairing retains the existing contract.

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
hide a simultaneous edit. Do not rebuild or check out the baseline. Markers and
metadata introduced on just one side do not create synthetic empty components.
The first migration may therefore show consumer changes; automatic suppression
applies once both sides carry matching validated boundaries.

## Required Evidence

Unit/integration and browser fixtures must establish agreement between Changes
rows/count, on-demand results, watch updates, and published output. Cover all
rows in the table, repeated/nested/empty instances, caller-owned slots, invalid
markers, unchanged-render prop edits, both viewports/themes, owned external and
head styles, shared-impact overlap, independent screen edits, historical
manifests, removed consumers, and concurrent watched updates. Component styling
must remain visibly changed in an affected screen's comparison.

Dependency declaration provenance is attribution input, not display metadata.
Changing declarations without a matching changed resource, or registering an
unrelated component in a previously component-free catalogue, must not add an
otherwise unchanged screen or component to Changes.
