# Component Change Attribution

## Delivery Status

The classifier, Browse/watch cache, comparison artifacts, and static exporter
share this attribution policy. The [component explorer plan](../../plans/component-explorer.md)
records delivery. All catalogues use the same rendered-output evidence rule.
Replacing source-path ownership with rendered stylesheet/resource attribution
and applying one Changes rule to every catalogue was planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
delivered across Milestones 3 and 4. Source paths no longer classify changes;
Milestone 6 removed the legacy authoring fields; the current writer emits v6.
Actual-invocation ownership of retained non-CSS resource evidence is implemented
by the same Milestone 4 classifier.
The inserted-link comparison projection and post-transform ownership rule
below were implemented by [remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
Milestone 13. Milestone 14 implemented warning delivery.

## Changes Membership

Changes counts directly changed routed entries, including components, once per
entry. Variants, instances, and affected consumers do not increase that count.
Existing collection ancestor disclosure and screen-to-use-case propagation
remain; an affected-only screen does not make its use cases changed.

| Edit                                                          | Direct Changes entries | Secondary impact                                                             |
| ------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Component implementation or owned styling                     | Component              | Its consuming screens/components                                             |
| Screen supplies different component data props                | Screen                 | None solely from this input edit                                             |
| Screen changes rendered slot content                          | Screen                 | None solely from this content edit                                           |
| Screen adds/removes/replaces/reorders an instance             | Screen                 | Usage links update                                                           |
| Screen changes surrounding content or layout                  | Screen                 | Existing screen/use-case rules                                               |
| Parent component changes props passed to a child              | Parent component       | Parent's consuming screens                                                   |
| Child implementation changes with parent inputs unchanged     | Child component        | Parent components and consuming screens                                      |
| Component and a consuming screen both change directly         | Component and screen   | Screen is also a consumer                                                    |
| Component saved variant, controls schema, or metadata changes | Component              | Consumers only when their rendering/resources are affected                   |
| Component adds or removes a declared stylesheet               | Component              | Consumers under Affected screens; no consumer row solely for Mokly's link    |
| Parent starts or stops showing a child with declared CSS      | Parent component       | Child usage and parent's Affected screens update; no row solely for the link |
| Temporary controls edits                                      | None                   | None                                                                         |

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
detailed comparisons; screen-only catalogues retain `changedManifestRoutes`
for output, rendered resources, metadata and ancestry, but not source paths.

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

The comparison artifact adds a versioned component/variant result and explicit
affected-consumer evidence. Readers accept schema-v4 screen artifacts and
schema-v5 component-aware results only. Screen entries retain their actual view
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
Its own Mokly-inserted stylesheet links stay in its comparison material; a
child-only inserted link does not. A screen's inserted component links never
count as screen material. Renderer-authored links stay material even when
Mokly reuses them to record owners. The
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

1. Remove only non-root inserted stylesheet spans from comparison copies of
   both documents, rebase their range/style offsets, normalize historical
   marker prefixes in the base, retain component markers on both sides, and
   apply paired manual-ignore normalization. If the resulting documents differ
   outside paired ignored regions, take the complete path. Marker-stripped
   equality is not sufficient because marker
   positions participate in ownership projection.
2. Compare the two usage records canonically. Neither side having usage is
   eligible; exactly one side having usage takes the complete path. When both
   records exist, every field must match except `props` and `propsKey` on
   entry-owned instances. In particular, viewport, color scheme, instance
   `componentId`, `key`, `id`, `owner`, `slotKey`, and `order`, instance-owned
   `props` and `propsKey`, and every slot, range, style, resource and
   `insertedStylesheets` record must match. Optional invocation `source`
   metadata is excluded from this
   comparison, as it is from every Changes projection. Any other difference
   takes the complete path.
3. If the paired view routes differ, take the complete path. Otherwise form
   the comparison-material normalized pair from the step-1 copies by stripping
   historical component markers from the base and current component markers
   from the head, then applying paired manual-ignore normalization. If the
   normalized documents differ, take the complete path. Discover the actual
   head closure from the unmodified final document under the normal
   ignored-region exclusion in committed mode and both actual closures
   independently in derived mode.
4. When either usage record has instances, styles, or entry-owned slots,
   compute the same ownership projection as the complete comparison, including
   historical/current range validation in each side's marker dialect and
   root-specific ownership, using the rebased step-1 copies and offsets.
   Require the projected HTML pair to be equal and discover its resources with
   the same exclusion policy; resource evidence for linked declared CSS still
   comes from the unmodified final documents. In committed mode discover the
   head projected closure; in derived mode discover both projected closures.
5. If any actual or projected resource is a changed Git path, take the complete
   path; ownership, exclusion, and rule analysis are decided there.
6. In derived mode, compare historical and current closure membership and
   bytes independently for actual material and projected material. Any
   difference in either comparison takes the complete path; equal unions do
   not substitute for equal per-comparison sets.
7. Otherwise the view is unchanged by content and resources. Its state is
   `unchanged` when the single-document normalizations of both stripped
   comparison-material sides are equal and `ignored-only` otherwise;
   `ignoredIds` come from the paired normalization. The view carries no
   `material`, `reasons`, or
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
component ranges against the final document, removes eligible inserted-link
spans from a comparison copy and rebases its offsets. Removed base documents
use the historical marker dialect; added head documents use the current dialect. A
malformed one-sided ownership tree fails closed with a `$document` validation
error rather than being reported as an ordinary addition or removal.

## Rendered Resources And Styles

Ownership comes only from explicit renderer `styles`/`resources` records and
the `resources` records Mokly derives for
[linked component-declared stylesheets](./mokly-component-stylesheets.md).
Each such record belongs to the rendered declaring component ids. A file
listed by several components has several owners; a stylesheet import without
its own record remains unowned. Registered source modules alone have no
ownership, Changes membership or comparison evidence. A changed owned resource
belongs to its owning component; actual consumers appear under Affected screens
unless they also have an independent rendered or metadata change.
Adding or removing a declaration changes the owning component's own page
material or ownership, not a consuming page merely because its
resource closure gains or loses that owned file. Attribute retained file-byte
and CSS-rule evidence to the rendered declarers; keep consumers affected-only
unless another independent reason survives.
A changed derived ownership record on the component's own page is a component
material change even when a configured link keeps the HTML bytes identical.
Starting or stopping a rendered child remains a parent usage/structure change;
its inserted link does not create an additional consumer material reason.

Theme/global CSS and unowned linked resources retain conservative
rendered-resource attribution. A mixed source-file edit without a rendered
effect does not. For linked stylesheets, attribution is narrowed by
[CSS change attribution](./mokly-css-attribution.md): the stylesheet keeps a
consuming view in Changes only when a changed rule could match that view's
document or cannot be resolved, and otherwise is recorded as examined and
excluded. Ownership and rule analysis compose; neither widens the other. Ownership is not inferred from a filename, one import, or the presence
of a component marker somewhere in the document. Configured/declared CSS
overlap reuses the configured link and assigns rendered declarers as owners;
renderer owner records for declared CSS are ignored with a
[warning](./mokly-build-warnings.md#exact-messages), never merged.

The rule analysis is implemented in Browse/watch classification, complete and
selected comparison evidence, and publication. Actual normalized view documents
supply matching trees; ownership projections supply eligible resources. A public
stylesheet glob cannot restore an excluded stylesheet.
Entry reasons combine retained view selectors by path, with unresolved evidence
taking precedence, while excluded resources stay on their own views. Formatting
alone therefore leaves every consumer out of Changes for that stylesheet.
Retained CSS evidence at an actual invocation also keeps its declared or
renderer-proven component owner in Changes when saved variants do not match.
Their own view exclusions stay intact; affected-consumer links retain the actual
invocation context. A screen can independently retain the same stylesheet
only when its own rendered-resource analysis keeps it. A retained non-CSS
resource reason follows the file-level resource check, then belongs to every
rendered component named as its owner in that view's `resources` record,
including an actual invocation with no matching saved variant. Its consumers
remain affected-only unless they have an independent change; an unowned resource
reason remains with the consuming view.

Component-generated style material can live in the document head rather than
inside a component boundary. Extend the renderer result with optional typed
style/resource ownership records while continuing to accept a plain HTML string.
Records identify exact style ranges or public resource paths and component
owners. Validate them against the rendered document and final compatibility
output. Only proven component-owned material is excluded from the consuming
screen projection; mixed or unclaimed head material remains material.

Owned asset edits must flag component pages even when HTML is byte-identical.
Retain actual styles, fonts, and images in screenshots and snapshot trees. Never
strip all styles or ignore the whole
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
can still be changed through a linked owned resource or a proven
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
head styles, independent screen edits, historical
manifests, removed consumers, and concurrent watched updates. Component styling
must remain visibly changed in an affected screen's comparison.

Historical dependency declaration provenance is ignored in attribution and
display. Registering an unrelated component in a previously component-free
catalogue must not add an otherwise unchanged screen or component to Changes.
