# CSS Change Attribution

## Delivery Status

Rule analysis is implemented for screen-only and component catalogues, live
Serve, watch and publication. Inspectors receive retained/excluded evidence
before loading comparisons; screen-only delivery reuses classification without
component classification or additional analysis. [Inline ownership](./mokly-inline-styles.md)
shares this parser, diff, keep list, matcher and resource detector; its
reference-bearing rules follow inferred owners with validated evidence.
Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md):
[M3](../../plans/scalable-inline-style-analysis.md#milestone-3-bounded-memory) delivers the bounded parser cache;
[M4](../../plans/scalable-inline-style-analysis.md#milestone-4-rule-segment-parse-reuse) stores rule data/forms,
and [M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis) uses original trees.
Shared forms apply to both CSS paths; page analysis is component-aware only.
The no-component classifier's routing is unchanged. Only M7 remains pending.

## Purpose

A linked stylesheet edit conservatively suggests different rendering. Without
rule analysis, every loading screen is kept in Changes, even for rules no
element can match. Analysis narrows evidence to views a changed rule could
affect, never excluding a view where the rule could apply.

This proves non-matching exclusion, not a matching rule's visible effect.
Browser-verified refinement remains a separate future contract.

## Inputs

The analysis runs only for a CSS resource that is already in `changedPaths`
and already reachable from a view's document through the existing resource
graph: linked stylesheets, transitive `@import` chains, and stylesheets
referenced by embedded documents. It examines the resource's branch-point
bytes and working-tree bytes, and the view's branch-point and working-tree
documents under [original-page matching](./mokly-page-analysis.md#original-page-matching)
for component-aware classification; other catalogues retain delivered matching.
It never widens the set of examined files; unreferenced public files and
broad `review.sharedImpact` globs continue to add nothing on their own.

Non-stylesheet resources (fonts, images, embedded documents) keep file-level attribution.

### Analysis scope

A stylesheet is in scope for rule analysis only when it is a public file
inside `mockupsDir`; only such files can be reached from a view document. A
stylesheet outside that scope, such as a source or token module matched by a
`review.sharedImpact` glob or a declared dependency directory, is never
analysed. Screen-only results retain file-level `sharedImpact` evidence;
component results follow the
[component result definition](./mokly-component-review.md#reasons-and-secondary-evidence).
One shared predicate answers "is this stylesheet in analysis scope"
for every classification path; in-scope paths need retained reasons.

Per-view evidence records are emitted only for views with at least one reason
or excluded resource. Views and screens with neither carry no record in the
live classification snapshot or in static exports.

## Stages

1. **Rule diff.** Parse both sides of the stylesheet into an ordered list of
   rules. Each rule carries its selector list, its declarations, and its
   enclosing conditions: `@media`, `@container`, `@supports`, `@layer`, and
   nesting parents. Diff the two lists into changed, added, and removed rules.
   Whitespace, comments, and formatting differences produce no rules. A rule
   that moves without changing its selectors, declarations, or conditions
   produces no rule.
2. **Matchability.** Test each diffed rule's selectors against the view's
   branch-point document and working-tree document. A match on either side
   keeps the rule. Enclosing conditions are not evaluated: a rule inside
   `@media` or `@container` is tested exactly like a rule outside it.
   Evaluating conditions needs a viewport and element sizes, which belongs to
   browser refinement.
   Resolve nesting parents outermost first, substituting `&` with `:is()` of
   the complete parent selector list, or applying an implicit descendant when
   needed. Unresolvable combinations stay unresolved. Match using the default
   parse5 document tree, respecting document quirks, inert template boundaries,
   and HTML versus SVG/MathML name case; absent view sides contribute no tree.
   Interactive/browser-state pseudo-classes (`:hover`, `:focus`, `:visited`,
   etc.) and non-shadow pseudo-elements (`::before`, etc.) are not evaluated.
   Test their base compound instead; a potential base match is `matched`.
   Broaden through functional selectors without making negation restrictive:
   `.button:not(:hover)` can match `.button`. State-dependent `:nth-child(... of
...)` counts are likewise unevaluated. Static structural predicates remain
   in force. Unsupported selectors and matcher compilation failures remain
   unresolved; stripping state never strips shadow/global keep constructs.
3. **Reduce.** If at least one rule is kept, the resource remains a dependency
   reason for that view and the reason records the kept selectors. If no rule
   is kept, the resource is recorded on the view as examined and excluded, and
   it does not contribute to Changes membership for that view.
   Any unresolved rule makes the reduced status `unresolved`, even if another
   rule matched. A failed stylesheet parse yields no partial selector evidence.

## Rule Diff Representation

`CssRuleParser.parse(stylesheet: string): CssRuleParseResult` is the synchronous
injection boundary. `LightningCssRuleParser` captures Lightning CSS's stylesheet
visitor before optimization. Rules receive zero-based depth-first ordinals,
one serialized string per selector in source order, a normalized declaration
block, ordered `{ kind, prelude }` conditions, and `hasCustomProperties`.
The condition kinds are `media`, `container`, `supports`, `layer`, and
`nesting-parent`; preludes omit the at-keyword. Anonymous layers have an empty
prelude. A nesting parent's prelude joins its selectors with `, `; implicit
nested selectors retain `&`. Declaration runs after nested rules or directly
inside nested conditions are separate `&` rules under the enclosing context.

Declaration serialization removes comments and insignificant whitespace, retaining
token separation, string and URL contents, duplicates, shorthand/longhand distinctions,
and source order, including interleaved `!important` declarations. It does not
join tokens separated by comments: `url/**/("a.svg")` remains distinct from
`url("a.svg")`, as do separated identifiers. It does not
use optimized stylesheet output as diff material. Native serialization normalizes
selectors and known condition preludes. Selector-less at-rules have `selectors: []`,
an explicit `atRule` name without `@`, a serialized `prelude`, and their complete
normalized body in `declarations`. This includes encoding/import/namespace and
layer statements, empty grouping rules, and opaque unsupported at-rules. Opaque
bodies remain one record, so their inner selectors cannot grant an exclusion.

`diffCssRules(before: string, after: string, parser: CssRuleParser)` returns a
`CssRuleDiffResult`. The [stored rule data](./mokly-css-parse-reuse.md#stored-rule-data)
own address/identity, including statement-or-block `block` form and excluding
ordinals. Thus `@layer a;` against `@layer a{}` is an unresolved removed/added
change on linked and inline paths. Treat lists as multisets: cancel earliest
exact identities per address, then pair survivors in source order as changed
declarations; excess occurrences are added/removed. Linked CSS does not use
inline segment cancellation or its duplicate-displacement exception.

A resolved diff has three lists: `added` sorts by after ordinal, `removed` by
before ordinal, and `changed: { before, after }[]` by after ordinal. Both changed
sides are retained so custom-property removal and before-only material remain
available to matching. An unresolved diff contains side-tagged `failures` and no
partial lists. Syntax, unclosed blocks/comments/strings, and serialization failures
return a `CssRuleParseError` with code `css-parse-failed` and its original cause;
they never escape as thrown parse errors. Both sides are examined for failures.
This boundary does not attempt browser error recovery for incomplete source.

## Kept Constructs

Unresolved cases keep the rule; this closed list permits no other silent
exclusions. [Inline attribution](./mokly-inline-styles.md#attribution) disables
only the changed-reference keep rule; linked stylesheets retain it.

- A selector the matcher cannot parse.
- Shadow-scoped selectors: `:host`, `:host()`, `:host-context()`, `::part()`,
  and `::slotted()`.
- Universal, `:root`, `html`, and `body` selectors.
- A rule inside a nesting parent whose combined selector cannot be resolved.
- Any changed custom property declaration (`--*`), because inheritance can
  reach any descendant.
- Selector-less at-rules: `@font-face`, `@keyframes`, `@property`,
  `@counter-style`, `@page`, and any other at-rule without a selector list.
- A changed `@import` or `url()` reference. The resource graph already
  attributes the referenced file; the analysis must not weaken that path.
- A parse failure on either side of the stylesheet.

Any failure that escapes the parser or matcher while analysing one resource
for one view is converted to an `unresolved` reason for that resource with the
selectors that could be serialized. It never aborts classification and never
excludes the resource.

Apply these checks in the order above before ordinary matching. Global and
shadow detection includes nested selector arguments and nesting parents, not
literal attribute values or synthetic universals introduced by state stripping.
For a declaration edit, compare the custom declarations and URL references on
both sides: an unchanged custom property or URL does not trigger its keep rule.
Changed URLs in unevaluated condition preludes also count as changed references.

## Document Matching Interface

`matchCssRules(diff: CssRuleDiffResult, documents: CssDocumentPair):
CssRuleMatchResult` returns `status: "resolved"` with one `{ change, outcome }`
per diffed rule, in added, removed, then changed list order. It preserves each
list's ordinal ordering and original rule records. An unresolved diff passes
through with its side-tagged parse failures. `CssDocumentPair.before` and
`.after` are optional default-adapter parse5 documents. Component-aware calls
use the page contract's original trees and ignored-subject predicate; the
matcher performs no file reads or classification writes.

`analyzeStylesheetChange(before: string, after: string, documents:
CssDocumentPair, parser?: CssRuleParser): CssAnalysisOutcome` composes all three
stages for one resource on one view. The default parser is
`LightningCssRuleParser`; missing stylesheet sides use an empty string.
The outcome is `{ kind: "kept", status: "matched" | "unresolved", selectors }`
or `{ kind: "excluded" }`. No match means excluded, including a resolved empty
diff. Callers remain responsible for reachability and `changedPaths` eligibility.

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

Every [review result v4](./mokly-changes.md#comparison-engine) view record
carries these fields. Results without them remain valid and mean the analysis
did not run.

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
A broad public stylesheet glob or declaration cannot bypass rule exclusion.
CSS and non-CSS ownership, including derived byte-only changes, follows
[component attribution](./mokly-component-changes.md#dependencies-and-styles). Resource evidence makes a paired view
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
- Inferring ownership from import graphs or bundled stylesheet output.
