# Component Comparison Schema

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Normative Result

Every catalogue emits the review result v8 of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4),
whose envelope, view record, and rule evidence that page owns. The
[component comparison records](./mokly-component-comparison-records.md) page
owns the entry record, the affected-consumer record, and the diagnostic
record inside that envelope, with the sides, the pairing, the view union, and
the `included` membership field. The generated TypeScript types of the model
crate are the normative shapes. One shape serves every catalogue: a catalogue
without registered components emits no component entries and an empty
`affected` list, and there is no second screen-only shape. This page defines
the semantics of the reasons and the proof behind each affected-consumer
record.

## Reasons And Secondary Evidence

A changed entry has duplicate-free reasons; the list is empty only for a
paired pure move, which is included under the move contract. An entry is
`included` exactly when it has at least one reason or is a paired move. The
kinds are:

- `added` and `removed` require the corresponding missing side.
- `metadata` compares the explicit entry projection of the
  [Changes contract](./mokly-changes.md#changes-membership), including a
  component's schema, controls, and slots and a variant's props and supplied
  slots.
- `material` means a canonical-form change of at least one view under the
  [materiality rule](./mokly-comparison.md#materiality) and the
  [instance projection](./mokly-component-changes.md#normalization-and-input-ownership).
- `implementation` means a render difference proved at an actual paired
  instance with unchanged props and supplied slot content, when no own or
  variant view proves that render impact. It is a component-parent reason,
  not a material change to that parent's own views.
- `inputs` means caller-owned props of an instance changed; `structure`
  means caller-owned instance identity or order changed, under the same
  projection.
- `dependency` names a stylesheet or resource whose change is attributed to
  this entry: a view of the entry carries a rule or resource record owned by
  the entry for that `path`, under
  [rendered resources and styles](./mokly-component-changes.md#rendered-resources-and-styles).
  CSS uses own-page matches kept after nested filtering, never a stylesheet
  owner record; a non-CSS resource is owned by the region that references
  it. The `path` is the public route of the stylesheet or resource and never
  a private source.
- `screen` names a step's `screenPath`; it is allowed only on a use case and
  must reference a directly changed screen that the use case uses on at least
  one side. A use case also keeps its own metadata reasons. A screen with only
  affected component evidence produces no use case screen reason.

Record every applicable reason; membership is never derived from a changed
path alone. An affected-only consumer has no reasons and is not included
unless it has another direct reason; its full comparison stays available
through its views. A component-owned rule record can be absent from a
consumer's reasons while it appears in the consumer's view evidence. CSS at a
consumer instance cannot change a component whose own pages keep no match for
that rule. One view's `excluded` record never cancels another view's
evidence. Reasons sort by kind, then by `path` or `screenPath`.

Entry reasons determine membership independently of the aggregate view state.
Actual-instance proof never changes the states of the component's own views.

A view reported `unchanged` or `ignored-only` under the
[unchanged view decision](./mokly-component-changes.md#unchanged-view-decision)
carries no entry-owned record, keeps its `ignoredIds`, and adds no
implementation-impact or owned-resource evidence. Views omit empty `rules` and
`resources` lists.

Each affected record groups one changed component and one canonical consumer:
`changedComponentId`, the component's parent path, whose parent entry or
included variant entry proves implementation impact on that component; the consumer's kind and path; and nonempty evidence.
Evidence is built from the union of base and head actual usage, deduplicated.
A consumer may also be directly changed. Self-impact is not listed. A
component is affected only through an actual usage path, never because it
shares a directory.

Each evidence item names its side, its context (the consuming screen view, or
the consuming component view with the entry address of the component or
variant that owns it, with viewport and colour scheme), and `via`, a nonempty
caller-ownership chain of instance regions from the consumer to the changed
component. Each chain element names the instance's `componentId`, the
component path, and its `instanceKey`, the scoped instance identity of the
[instance contract](./mokly-instances.md); the last `componentId`, mapped
through accepted move pairs, equals `changedComponentId`. Each instance must
exist in the named side's composed tree with that component path and an
ownership edge to the next element. Direct screen use has one element. A
component consumer either owns the context entry or owns the first instance
on that chain. The chain omits the consumer's own instance and outer ancestors.
Use input ownership, not physical slot placement, to determine the
edges: a screen-supplied child in a container slot is a direct screen
dependency. Repeated placements of one logical instance do not duplicate
evidence or screen counts. The
[branch-point lookup](./mokly-branch-point-lookup.md#reference-sides) resolves
each evidence destination from its own side; stored evidence paths never
change. No evidence invents a variant for a screen-supplied prop combination.

Manual Review-ignore evidence lives in each view's `ignoredIds`; component
variant views keep their own ids. Component suppression is described through
`affected`, never through ignore ids.

## Validation And Publication

The [validation contract](./mokly-component-review-validation.md) owns source
coverage, affected-consumer proof, canonical ordering, snapshot confinement,
and strict reader admission. Its rules apply to Serve's background
classification, the selected comparison, `build`, and `publish`. Every
producer writes version 8, and every reader accepts only version 8.
