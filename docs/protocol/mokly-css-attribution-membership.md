# CSS Attribution Membership

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

## Delivery Status

Planned for [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md):
rule and page evidence, classification and strict readers. Comparison details
are planned for [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence). Comparison result v5, catalogue read model v4 and
manifest v8 are unreleased and change in place; no version is added.

## Membership Rule

The [rule membership contract](./mokly-css-attribution-rules.md) defines matched
elements, components changed on their own pages, page rows, rule identity and
all four delivery paths. Retained CSS makes a paired view `changed`; direct
entry membership is separate. A component-only match can change the complete
render of an affected consumer without giving that consumer its own row.
A formatting-only edit has no changed rules and stays excluded. All independent
Changes signals retain their existing meaning.

Variant view states and exclusions remain unchanged by consumer-only matches;
no synthetic variant entry is created for actual-invocation evidence. CSS
component reasons require kept own-page matches under the nested-component
test. Non-CSS resources and document `styles` records keep their existing actual-invocation attribution.

## Evidence Schema

Use these records on both retained view reasons and direct entry reasons in
comparison result v5. Keep the wire reason kind `dependency`.

```ts
interface CssRuleAttribution {
  ruleKey?: string;
  status: "matched" | "unresolved";
  selectors: readonly string[];
  changedComponentIds: readonly string[];
  pageSelectors: readonly string[];
}

interface CssPageEvidence {
  selectors: readonly string[];
  unresolved?: true;
}

interface DependencyAnalysis {
  status: "matched" | "unresolved";
  selectors: readonly string[];
  rules: readonly CssRuleAttribution[];
  pageEvidence?: CssPageEvidence;
}

interface DependencyReason {
  kind: "dependency";
  path: string;
  analysis?: DependencyAnalysis;
}

interface ExcludedResource {
  path: string;
  reason: "no-matching-rule";
}

interface ResourceEvidence {
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
}

interface ViewReview extends ResourceEvidence {
  // Existing axes, state and ignoredIds remain.
  material?: true;
}
```

`path` names the reachable stylesheet in the existing repository-relative
resource-path space, including generated public routes. It never names a
private imported source. `ruleKey` is the cross-stylesheet key defined in the
[identity contract](./mokly-css-attribution-rules.md#rule-identity-across-stylesheets).
`rules` is nonempty and contains each retained identity once for this path and
view. Excluded rules are omitted. Repeated occurrences union their evidence;
unresolved takes precedence over matched for the same identity on this view.

A parse failure has no diffed rule identity: emit one unkeyed unresolved record,
with empty selector and component arrays, and no keyed records for that path
on this view.
An unexpected analysis failure also uses this unkeyed form if no diff survives;
keep any selectors that could safely be serialized. If a diff survives, retain
its keys and mark the failing outcomes unresolved. An unkeyed record never
joins another file or establishes a component match.

`selectors` lists the original serialized selectors of each retained rule,
including `&` before query-only nesting substitution. Sort and deduplicate this
presentation list by UTF-16 code units. It is distinct from the ordered selector
arrays used in identity. Unresolved rules may have no selectors.

`changedComponentIds` is the sorted, unique set of parent component ids proved
changed by this identity across the whole catalogue after the nested-component
test. Unfiltered own-page matches decide whether Y takes a match from X; only
kept matches decide which ids enter this array. It is independent of this
path, view and delivery method. A local unresolved occurrence can carry ids
proved by kept matches of resolved copies on other own pages, but still gives
this page an unresolved reason. Unkeyed failures have no changed ids. Never include variant
ids, an owner claim or a component inferred only from a consumer invocation.

`pageSelectors` is the sorted, unique subset of this record's `selectors` with
at least one proven match outside components changed by this rule on this view.
It is empty for unresolved occurrences and for wholly covered matches. No
selector from another rule may cover or explain this rule's page matches.

`analysis.selectors` is the union of rule selector lists. Its `status` is
unresolved if any rule is unresolved, otherwise matched. `pageEvidence` is
present exactly when a rule has page selectors or is unresolved. Its selectors
are the union of `pageSelectors`; `unresolved: true` is present exactly when
at least one rule is unresolved. Empty selectors are required for unresolved-
only evidence; never invent an outside match. Omit the whole `pageEvidence`
when no rule gives the page a reason. This absence means component-only CSS
evidence, not an excluded resource.

## Projection And Merging

View evidence describes the full normalized render, including affected-only
consumers. Direct page entry reasons retain only rules with page evidence.
A saved variant's component reasons retain only rules with matches that its
component keeps on that variant's own page. A variant can still have a separate
page reason without a kept match or a changed parent. A changed component
parent's reasons retain rule records only from own pages with kept matches.
Use those pages' stylesheet paths, never a consumer-only path. For these root-match reasons, `pageEvidence` may be absent.

Merge entry reasons by path, then by rule key, unioning selectors, changed ids
and page selectors, with unresolved precedence. Merge unkeyed records together
only within that same path. Recompute the summary fields from the merged rules.
One view's exclusion cannot cancel another view's retained reason. A direct
page rule and a component rule from the same file can coexist without turning
all its selectors into page evidence.

`material` is present exactly when the paired ignore-normalized document
material differs, including added and removed views. Keep the existing
inserted-link comparison exclusion. It is absent otherwise and never `false`.
It describes documents, not CSS membership or component ownership records.
Retain actual final bytes in snapshots and keep private document coordinates
out of public evidence.

Catalogue read model v4 gains optional `resourceEvidence: ResourceEvidence` on
`CatalogueView` and on the single-document `CataloguePage`. Screen and component
variant views use the same records as comparison v5. Whole-document pages gain
no v5 comparison records or comparison controls. Their catalogue evidence comes
from the same classifier and pinned baseline. Component parents use their
saved views and the existing component result, not invented parent views.
These fields are allowed only with ready Changes; omit empty evidence. Pending,
unavailable and disabled generations omit them. Removed entries can retain
their before-side evidence in the existing removed-entry projection.

Live classification and its selected shell projection retain these fields
before snapshots exist. Static export and publication copy the same validated
evidence. Selection never reruns CSS analysis. Selected comparisons retain the
catalogue-wide changed-component sets computed before selection; they must not
recompute a smaller set from the selected page alone. The shared browser reader
can validate id syntax; the complete producer also verifies unfiltered and kept own-page proof.

## Validation

- An analysed or excluded path must be a changed public stylesheet reachable
  from that view on at least one side. Both before and after discovery obey
  paired Review-ignore. Embedded documents use their own normalized trees.
- No path is both retained and excluded on one view. Reasons and exclusions
  sort uniquely by path. Omit empty optional lists; required empty arrays stay.
- Every analysed v5 reason has nonempty `rules`. A `ruleKey` has 64 lowercase
  hex digits. Keyed records sort by key; an unkeyed record sorts last. A whole-file parse
  failure has no keyed siblings on that view. Entry aggregates can retain keyed
  evidence from other views beside an unkeyed failure.
  Missing `analysis` is valid for non-CSS reasons, never a CSS ownership bypass.
- Every selector/id array is sorted and unique. A matched rule has at least
  one selector. Page selectors must be a subset of its selectors. Verify
  summary unions and unresolved precedence, including `pageEvidence` presence.
- Producers validate each changed component id against its frozen kept own-page
  matches for that identity. Validate nested filtering against unfiltered own-page
  sets, never against `changedComponentIds`. Page-only reasons never create affected consumers.
  Keep existing usage validation for the resulting implementation-impact set.
- Entry reasons must come from recorded eligible rules, not merely a retained
  path. Source validation must reject a component-only rule forged as a page
  reason and a consumer-only match forged as a component reason.
- `analysis` appears only on stylesheet paths in public analysis scope. Use
  the shared `analysisOwnsStylesheet` predicate; violations fail `review-invalid`.
  Browser decoding checks structure and stylesheet identity without fetching
  panes or receiving private range coordinates.
- `material` is absent or true; when present the view is changed, added or
  removed. Independent input reasons may still have unchanged view states.
- Complete, fast, Browse, watched, selected, export and publication paths must
  agree on membership and evidence. Cache keys include the accepted generation,
  baseline and complete rule-to-component facts, not just a view's local bytes.

## Read And Analysis Reuse

Baseline CSS uses the bounded Git batch reader, including optional counterpart
reads for added/removed files. Head reads use compilation outputs or the confined
public reader. Resource bytes are cached per side/path; parser results share
identical source text across paths and sides. Parsing shared CSS does not repeat
per view. Collect and filter own-page matches before reducing page reasons, without
rerendering consumer modules, rerunning PostCSS or generating snapshots.

The shell's exact text and grouping are in
[CSS evidence presentation](./mokly-css-evidence-presentation.md).

## Non-goals

Do not evaluate media/container/supports conditions, specificity, cascade order,
overrides, pixels or screenshots. Do not infer owners from CSS Modules,
CSS-in-JS, bundle paths or source imports. The existing custom-property keep
rule remains the only inheritance analysis.
