# CSS Attribution Membership

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

## Membership Rule

The [rule membership contract](./mokly-css-attribution-rules.md) defines
matched elements, the components a rule changes on their own pages, the
entry's own evidence, and rule identity across stylesheets. The outcome for a
view is the set of per-rule records below, each with an owner. A `matched` or
`unresolved` record whose owner is the entry makes a paired view `changed` and
gives the entry a Changes row. A record whose owner is a component is that
component's change and keeps the view's entry affected without a row of its
own. An `excluded` record changes nothing. A component-only match can change
the complete render of an affected consumer without giving that consumer a
row. A formatting-only edit has no changed rules and produces no record.
Every independent Changes signal keeps its meaning.

Rule evidence is read from the delivered stylesheets that the composed
documents link. The analysis compares bytes, so a stylesheet needs no changed
Git path to be evidence. A stylesheet that one side links and the other does
not is a difference in the composed documents under the
[materiality rule](./mokly-comparison.md#materiality), not a rule record.

A variant's view states follow the matches on its own view; no synthetic
variant is created for a consumer's props. Non-CSS resources keep their
file-level attribution.

## Evidence Schema

The [comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4)
owns the record: `RuleEvidence` with `stylesheet`, `selector`, `status`, and
`owner`, in the `rules` list of a review view. This section states how the
analysis fills it.

- One record exists per stylesheet, changed rule, and selector that the
  analysis keeps on this view. A rule with several selectors produces one
  record per selector that matched or is unresolved; a selector that matched
  nothing produces none. A rule that matches no element on either side
  produces no record. A stylesheet whose changed rules all match nothing on
  this view has one record with status `excluded`.
- `stylesheet` is the public route of the delivered stylesheet, repository
  relative, including a bundle under `static/mokly-generated/`. It never names
  a private source.
- `selector` is the serialized selector as the parser wrote it, including `&`
  before nesting substitution. A selector-less at-rule's record carries the
  at-rule name and its prelude. An excluded stylesheet's record and a
  whole-stylesheet parse failure's record carry an empty `selector`.
- `status` is `matched` when the selector matched an element on either side
  after ignored regions are removed, `unresolved` for a kept construct, a
  parse failure, or an analysis failure, and `excluded` on the one record of
  a stylesheet whose changed rules all match nothing. For one selector of one
  rule on one view, `unresolved` takes precedence over `matched`.
- `owner` is `{ kind: "component", path }` when the rule changes exactly one
  registered component and every match of this selector on this view lies
  inside that component's regions after nested filtering. Otherwise it is
  `{ kind: "entry" }`: a match outside every changed component, matches that
  span several changed components, an unresolved rule, a parse failure, a
  component page's renderer wrapper, or an `excluded` record.
- Records of equal rules in different stylesheets stay separate records,
  because `stylesheet` differs; the rule identity joins their proof, not their
  records.

Records sort by `stylesheet`, then `selector`, then `status`, then owner kind
and path, and are unique. An empty `rules` list is omitted. A view with no
record has no kept and no excluded stylesheet evidence.

## Projection And Merging

The `rules` list of a view describes the complete composed render of that
view, affected-only consumers included. Membership reads only the records
whose owner is the entry: a view with one gives its entry a `dependency`
reason for that stylesheet under the
[component comparison schema](./mokly-component-review.md#reasons-and-secondary-evidence).
A changed component's own reason comes from the records on its own pages whose
owner is that component, under the stylesheets those pages link, never from a
consumer-only path. A variant's component reason comes only from matches that
the component keeps on that variant's own page; the variant can still have an
entry-owned record of its own.

Across the views of one entry, the shell merges records by `stylesheet` and
`selector`, with `unresolved` taking precedence, under the
[CSS evidence presentation](./mokly-css-evidence-presentation.md) contract.
One view's `excluded` record never cancels another view's `matched` record.
An entry-owned record and a component-owned record from one stylesheet
coexist on one view without turning every selector of that stylesheet into
entry evidence.

The [entry detail](./mokly-shell-delivery.md#entry-detail) of a screen or
component carries each view's `rules` and `resources` records as the view's
`resourceEvidence`, and a page's detail carries the records of its one
document; the index carries none. A detail carries them only while Changes is
`ready`; pending, unavailable, and disabled states omit them. A removed
entry's detail inside a comparison generation keeps its before-side records.
The static build copies the same validated records. The selected comparison
of Serve never reruns the analysis and never recomputes a smaller
changed-component set from the selected entry alone.

## Validation

- Every `stylesheet` is a changed public stylesheet that the view's composed
  document reaches on at least one side. An embedded document uses its own
  tree.
- Records are sorted and unique as stated above. A stylesheet with a
  `matched` or `unresolved` record on a view has no `excluded` record on that
  view.
- A component owner names a registered component whose own pages keep at
  least one match for the rule after nested filtering. The producer checks
  each owner against the recorded own-page match sets, never against the
  result's own rows and never against consumer-instance matches.
- An `unresolved` record is owned by the entry.
- A record never carries a private source path, a text offset, or a match
  node.
- Serve's background classification, the selected comparison, `build`, and
  `publish` produce the same records for one view. The cache key of a record
  set includes both sides' document keys, both sides' stylesheet bytes, and
  the catalogue-wide own-page match sets, not a view's bytes alone.
- A violation fails the result with `review-invalid`.

## Read And Analysis Reuse

Both sides' stylesheet bytes and composed documents come from the render
cache and the base-side render; the analysis reads no file again and renders
nothing. Parsed stylesheets are cached by content hash with a byte bound, so a
stylesheet shared across paths and sides parses once, and eviction changes
time only. Own-page matches are collected and filtered catalogue-wide before
any entry's evidence is decided, without rendering a consumer again or
generating snapshots.

The shell's exact text and grouping are in
[CSS evidence presentation](./mokly-css-evidence-presentation.md).

## Non-goals

Do not evaluate media, container, or supports conditions, specificity,
cascade order, overrides, pixels, or screenshots. Do not infer owners from
CSS Modules, CSS-in-JS, bundle paths, or source imports. The custom-property
keep rule is the only inheritance analysis.
