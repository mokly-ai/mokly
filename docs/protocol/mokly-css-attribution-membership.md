# CSS Attribution Membership

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

## Membership Rule

A CSS dependency reason keeps a view in Changes only when its analysis status
is `matched` or `unresolved`. A view whose only CSS dependency evidence is
excluded resources is not in Changes for that evidence. Every other Changes
signal is unchanged: added or removed views, material document changes,
metadata, caller inputs, structure, non-CSS resources, component ownership, and
use-case screen reasons. Both viewports and every color scheme are analysed
separately against their own documents.

A formatting-only stylesheet edit therefore leaves every consumer out of
Changes. That is intended: the resource is still listed in the comparison
details as examined and excluded, and the comparison snapshots still contain
the real bytes.

## Evidence Schema

A dependency reason gains an optional `analysis` record. Absent `analysis`
means the analysis did not run for that path, which is the case for non-CSS
resources. Only current-format review results are readable.

```ts
interface DependencyAnalysis {
  status: "matched" | "unresolved";
  selectors: readonly string[];
}

type DependencyReason = {
  kind: "dependency";
  path: string;
  analysis?: DependencyAnalysis;
};
```

`selectors` lists every selector of each kept rule in its original serialized
form (including `&` for nested rules, before query-only substitution), sorted
lexically by UTF-16 code units and duplicate-free. For `unresolved` reasons it
lists the selectors that could be serialized and may be empty when the kept
construct has no selector.

A view also records whether its actual comparison materials differ:

```ts
interface ViewReview {
  // existing fields unchanged
  material?: true;
}
```

`material` follows the [Changes definition](./mokly-changes.md): it is present
exactly when actual comparison material differs, omitted otherwise, never
`false`. The style label also requires an analysis-bearing reason, so an
absent flag alone cannot select it.

Examined-and-excluded resources are recorded on the view, not as reasons:

```ts
interface ExcludedResource {
  path: string;
  reason: "no-matching-rule";
}

interface ViewReview {
  // existing fields unchanged
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
}
```

These fields are optional on each [review result v6](./mokly-changes-serving.md#comparison-engine)
view. Empty reason and exclusion lists are omitted. Their absence records no
retained or excluded resource evidence; it does not select an older schema.

`reasons` holds the view's retained resource evidence; it is omitted when
empty. View evidence describes the complete retained render; entry reasons
apply component ownership separately. Match component-aware original trees,
including component markup, under [subject-only ignores](./mokly-page-analysis.md#original-page-matching).
Projection controls resource eligibility, not matchability. Embedded reader
documents use this policy on their own trees: pair original bytes once, never
feed normalized tokens back into the marker parser.

Entry dependency reasons merge by path across views, unioning selectors and
giving `unresolved` precedence. Keep an in-scope stylesheet in entry `sharedImpact`
only when some eligible view retains it. Explicit or inferred ownership
also attributes retained actual-invocation CSS evidence to its component owner,
even when every variant entry excludes the stylesheet. Variant view states and
exclusions remain unchanged; no synthetic variant entry is created. An exact
screen dependency remains independent when its actual view keeps the
stylesheet.
Entry analysis unions eligible saved-view and actual-invocation evidence; one
view's exclusion does not cancel another view retaining the same path.
A broad public stylesheet glob or declaration cannot bypass rule exclusion.
CSS and non-CSS ownership, including derived byte-only changes, follows [component attribution](./mokly-component-changes.md#dependencies-and-styles).
Resource evidence makes a paired view
`changed`; exclusions alone do not. Diagnostic summary counts use those states
and, for component catalogues, the resulting `changes` membership.

Baseline CSS uses the bounded Git batch reader, including optional counterpart
reads for added/removed files. The head uses compilation outputs or the confined
public reader. Resource bytes are cached per side/path within a classification;
the [whole-input LRU](./mokly-css-parse-reuse.md#cache-lifetime-and-accounting)
shares text across paths/sides; hits avoid parsing, eviction costs only time, and injection stays supported.

## Validation

- An `excludedResources` path must be in `changedPaths` and must be a
  stylesheet reachable from that view's document on at least one side.
  Producers validate resource confinement during discovery; artifact rendering
  additionally checks retained/excluded evidence against the snapshot closure.
  The browser decoder validates the structural contract without fetching panes.
- A path may not appear both as a dependency reason and as an excluded
  resource on the same view.
- `analysis.selectors` must be sorted and duplicate-free.
- A `matched` analysis has at least one selector; `unresolved` may have none.
- View reasons and exclusions sort uniquely by path. Entry analysis is the
  union of its eligible variant-view and actual-invocation analyses; a view's
  exclusion does not conflict with another view retaining the same path.
- `analysis` may appear only on stylesheet paths. Producers guarantee analysis
  scope during discovery through the shared `analysisOwnsStylesheet` predicate
  and assert, before emitting a result, that every analysed reason path
  satisfies it, failing with `review-invalid` otherwise. The shared decoder
  validates stylesheet identity only, because scope needs the resolved
  configuration. A path outside scope may appear in `sharedImpact` but never
  as an analysed reason or an excluded resource.
- `material` is absent or `true`; a view with `material` has state `changed`,
  `added`, or `removed`.
- Optional fields are omitted when empty, matching the existing canonical
  output rules.
- Browse's lightweight classification, complete comparison generation,
  publishing, and the selected live endpoint use one analysis implementation
  and produce identical membership and evidence.

## Shell Presentation

The inspector and comparison-stage presentation of this evidence is specified
in [CSS evidence in the shell](./mokly-css-evidence-shell.md).

## Non-goals

- Evaluating media, container, or supports conditions.
- Specificity, cascade order, or override detection.
- Inheritance beyond the custom-property keep rule.
- Pixel or screenshot comparison.
- Inferring ownership from linked stylesheet files, including CSS Modules,
  CSS-in-JS, or bundled output. The separate [inline ownership](./mokly-inline-styles.md)
  contract applies to eligible style elements.
