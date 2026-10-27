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

Rule evidence is read from linked stylesheets and owned or ownerless head
styles in the composed documents. The analysis compares delivered bytes. A link added or removed without a byte change is document material under the
[materiality rule](./mokly-comparison.md#materiality) and invents no rule.
When the bytes change, reachability on either side admits both available
documents for rule matching, including a side without that link.

A variant's view states follow the matches on its own view; no synthetic
variant is created for a consumer's props. Non-CSS resources keep their
file-level attribution.

## Evidence Schema

The [comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4)
owns the record: `RuleEvidence` with `stylesheet`, `selector`, `status`, and
`owner`, in the `rules` list of a review view. This section states how the
analysis fills it.

- One record exists per stylesheet, changed rule, selector, and owner that
  the analysis keeps on this view. A rule with several selectors produces one
  record per selector that matched or is unresolved; a selector that matched
  nothing produces none. A rule that matches no element on either side
  produces no record. A stylesheet whose changed rules all match nothing on
  this view has one record with status `excluded`.
- `stylesheet` is the public route of the delivered stylesheet, relative to
  the artifact root, including a bundle under `static/mokly-generated/`. It never names
  a private source. An inline or head style uses the containing public
  document route; no synthetic stylesheet file is required.
- `selector` is the serialized selector as the parser wrote it, including `&`
  before nesting substitution. A selector-less at-rule's record carries the
  at-rule name and its prelude. An excluded stylesheet's record and a
  whole-stylesheet parse failure's record carry an empty `selector`.
- `status` is `matched` when the selector matched an element on either side
  after ignored regions are removed, `unresolved` for a kept construct, a
  parse failure, or an analysis failure, and `excluded` on the one record of
  a stylesheet whose changed rules all match nothing. For one selector of one
  rule on one view, `unresolved` takes precedence over `matched`.
- Each linked-CSS or ownerless head match belongs to the innermost physically containing component
  changed by that rule. Emit one `{ kind: "component", path }` record for
  each such owner. Emit `{ kind: "entry" }` only for matches outside every
  changed component. A selector can have component and entry records on the
  same view. Unresolved rules, parse failures, and excluded records have
  only the entry owner. Both sources use the shared own-page proof and nested test under
  [style ownership](./mokly-comparison.md#style-ownership).
  A receiver can claim supplied slot content when its own pages prove the
  rule. Without that proof, the match falls back to the entry unless another
  physically containing changed component claims it.
- Trusted sidecar rules join the same unfiltered own-page proof and nested
  test as linked CSS. Equal identities join across owner sets. A nested copy
  of the same component never takes its match. Supplier input ancestry only
  decides whether a nested component can take a declared supplier's rule.
  A kept match inside the declared owner's physical region belongs to that
  owner, including supplied content. Exact-instance proof does not require
  own-page matches under [style ownership](./mokly-comparison.md#style-ownership).
  Owned, ownerless, and linked sources share the same excluded and unresolved
  record rules.
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
A changed component's own reason comes from kept own-page matches under
[style ownership](./mokly-comparison.md#style-ownership), never from a
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

- Every `stylesheet` names a changed public stylesheet reached on either
  side, or the containing public document of changed inline style rules. An embedded document uses its own
  tree.
- Records are sorted and unique as stated above. A stylesheet with a
  `matched` or `unresolved` record on a view has no `excluded` record on that
  view.
- A component owner names a registered component with a kept own-page match
  for that rule identity, or a kept trusted exact-instance match. Physical
  containment supplies the claim for owned, ownerless, and linked rules.
  Supplier ancestry only prevents a nested component from taking a supplier's
  own rule for content that the supplier passed into it.
  The producer checks
  each owner against that proof, never against the result's own rows.
- An `unresolved` record is owned by the entry.
- A record never carries a private source path or a match node.
- Serve's background classification, the selected comparison, `build`, and
  `publish` produce the same records for one view. The cache key of a record
  set includes both sides' document keys, both sides' stylesheet bytes, and
  the catalogue-wide own-page match sets, not a view's bytes alone.
- A violation fails the result with `review-invalid`.

## Read And Analysis Reuse

Serve head documents use the bounded render cache; evicted views render again
on the head root. `build` and `publish` head documents use their 256 MiB head
capture, with source fallback for documents that are not retained. Base
documents use the 256 MiB capture or pinned-source fallback. A
comparison-scoped route map reuses resource digests, byte proofs, and
changed-byte state. Public asset reads and planning digests do not enter the
private source snapshot.
Planning batches the generation's known read set before digest reads. Opaque
resources use streamed digests when they exceed the blob read budget. Resource
bytes and content-keyed stylesheet diffs have byte-bounded caches; eviction
changes work only. The analysis renders no document. Parsed stylesheets are
cached by content hash with a byte bound, so a stylesheet shared across paths
and sides parses once, and eviction changes time only. Own-page matches are
collected and filtered catalogue-wide before
any entry's evidence is decided, without rendering a consumer again or
generating snapshots.

The shell's exact text and grouping are in
[CSS evidence presentation](./mokly-css-evidence-presentation.md).

## Non-goals

Do not evaluate media, container, or supports conditions, specificity,
cascade order, overrides, pixels, or screenshots. Do not infer owners from
CSS Modules, CSS-in-JS, bundle paths, or source imports. The custom-property
keep rule is the only inheritance analysis.
