# CSS Attribution Membership And Evidence

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
resources and for historical results.

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

A view also records whether its own normalized documents differ:

```ts
interface ViewReview {
  // existing fields unchanged
  material?: true;
}
```

`material` is present exactly when the paired ignore-normalized before and
after documents differ, in both result versions. It is omitted otherwise and
never carries `false`. Historical results without it remain valid: the style
label additionally requires an `analysis`-bearing reason, which only producers
that also emit `material` ever write, so an absent flag on a historical view can
never select the style label.

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

Both the schema-v2 `ReviewResult` and the schema-v3 `ReviewResultV3` carry
these fields. Schema versions do not change. Results without them remain valid
and mean the analysis did not run.

`reasons` holds the view's retained resource evidence in both versions; it is
omitted when empty. This supplies the dependency-analysis location that v2 did
not previously have. View evidence describes the complete retained render;
v3 entry reasons still apply component ownership separately. Match selectors
against the actual paired-ignore-normalized documents, including component
markup; ownership projections determine resource eligibility, not selector
matchability. Embedded documents contribute their own normalized trees; pair
their original bytes once before both reference discovery and matching. Never
feed normalized ignore tokens back into the marker parser.

Entry dependency reasons merge by path across views, unioning selectors and
giving `unresolved` precedence. Keep a stylesheet in entry `sharedImpact`
only when some eligible view retains it. Explicit or renderer-proven ownership
also attributes retained actual-invocation CSS evidence to its component owner,
even when every saved variant excludes the stylesheet. Saved view states and
exclusions remain unchanged; no synthetic variant is created. An exact screen
dependency remains independent when its actual view keeps the stylesheet.
A broad public stylesheet glob or declaration cannot bypass rule exclusion.
Non-CSS and non-public implementation dependencies retain their existing
ownership policy. Resource evidence makes a paired view
`changed`; exclusions alone do not. Diagnostic summary counts use those states
and, for v3, the resulting `changes` membership.

Baseline CSS uses the bounded Git batch reader, including optional counterpart
reads for added/removed files. The head uses compilation outputs or the confined
public reader. Resource bytes are cached per side/path within a classification;
the injected parser cache additionally shares identical source text across
paths and sides. Parsing a shared stylesheet therefore does not repeat per view.

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
  union of its eligible saved-view and actual-invocation analyses; a view's
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
- Inferring ownership from CSS Modules, CSS-in-JS, or bundled output.
