# CSS Change Attribution

## Delivery Status

Rule parsing, diffing, document matching, and classification are implemented in
both result versions, live Serve, watched updates, and publication. The
inspector receives retained and excluded stylesheet evidence for component
catalogues and screen-only catalogues, including before a comparison is loaded.
Current screen-only delivery reuses v2 classification; it does not run
component classification or an additional resource analysis. See
[CSS Change Attribution](../../plans/css-change-attribution.md).
Removing source-path evidence and applying CSS rule analysis to linked
component-declared stylesheets is planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestones 3 and 4. Those attribution rules are now live;
comparison-format changes remain planned for Milestone 7.

## Purpose

A linked stylesheet edit is conservative evidence that a screen may render
differently. Without further analysis, every screen that loads the stylesheet
is kept in Changes, even when the edit adds rules that no element on that
screen can match. This contract narrows that evidence to the views whose
documents a changed rule could apply to, while never claiming a screen is
unchanged when a rule could apply.

The analysis is a sound exclusion, not a visual proof. It can prove that no
changed rule matches a document. It cannot prove that a matching rule has a
visible effect, and it does not try to. Browser-verified refinement is a
separate future contract.

## Inputs

The analysis runs only for a CSS resource that is already in `changedPaths`
and already reachable from a view's document through the existing resource
graph: linked stylesheets, transitive `@import` chains, and stylesheets
referenced by embedded documents. It examines the resource's branch-point
bytes and working-tree bytes, and the view's branch-point and working-tree
documents after the same paired ignore normalization the comparison engine
uses. It never widens the set of examined files; unreferenced public files and
source paths add nothing on their own. Declared component CSS is eligible only
when linked in a rendered document, under the
[component stylesheet contract](./mokly-component-stylesheets.md).

Resources that are not stylesheets, including fonts, images, and embedded
documents, keep their existing file-level attribution unchanged.

### Analysis scope

A stylesheet is in scope for rule analysis only when it is a public file
inside `mockupsDir`; only such files can be reached from a view document. A
stylesheet outside that scope, such as a source or token module, is never
analysed and creates no comparison evidence on its own. One shared predicate
answers "is this stylesheet in analysis scope" for every classification path;
only rendered public stylesheets can produce CSS analysis records.

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
`CssRuleDiffResult`. Rule identity consists of conditions, selectors, and
declarations; selector-less identity additionally includes `atRule` and `prelude`
so differently named animations, imports, or rule kinds cannot cancel each other.
Ordinals are excluded from identity. Treat rule lists as multisets: cancel exact
matches first, consuming duplicate occurrences in source order, then pair remaining
rules with the same conditions/selectors (and at-rule name/prelude) in source order
as changed declarations. Excess occurrences are added or removed.

A resolved diff has three lists: `added` sorts by after ordinal, `removed` by
before ordinal, and `changed: { before, after }[]` by after ordinal. Both changed
sides are retained so custom-property removal and before-only material remain
available to matching. An unresolved diff contains side-tagged `failures` and no
partial lists. Syntax, unclosed blocks/comments/strings, and serialization failures
return a `CssRuleParseError` with code `css-parse-failed` and its original cause;
they never escape as thrown parse errors. Both sides are examined for failures.
This boundary does not attempt browser error recovery for incomplete source.

## Kept Constructs

Every case the analysis cannot resolve keeps the rule and marks the reason
`unresolved`. The list is closed; an implementation must not add silent
exclusions beyond it.

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
`.after` are optional default-adapter parse5 documents supplied after paired
normalization; the matcher performs no file reads or classification writes.

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

Both schema-v4 `ReviewResultV4` and schema-v5 `ReviewResultV5` carry
these fields. Results without them remain valid
and mean the analysis did not run.

`reasons` holds the view's retained resource evidence in both versions; it is
omitted when empty. View evidence describes the complete retained render;
v5 entry reasons still apply component ownership separately. Match selectors
against the actual paired-ignore-normalized documents, including component
markup; ownership projections determine resource eligibility, not selector
matchability. Embedded documents contribute their own normalized trees; pair
their original bytes once before both reference discovery and matching. Never
feed normalized ignore tokens back into the marker parser.

Entry rendered-resource reasons merge by path across views, unioning selectors
and giving `unresolved` precedence. Derived declared or renderer-proven ownership
also attributes retained actual-invocation CSS evidence to its component owner,
even when every saved variant excludes the stylesheet. Saved view states and
exclusions remain unchanged; no synthetic variant is created. A screen can
independently retain evidence only when its actual view keeps the stylesheet.
A broad public stylesheet glob cannot bypass rule exclusion. Non-CSS rendered
resources retain their existing file-level policy; non-public implementation
source alone supplies no evidence. Resource evidence makes a paired view
`changed`; exclusions alone do not. Diagnostic summary counts use those states
and, for v5, the resulting `changes` membership.

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
  configuration. A path outside scope cannot appear as an analysed reason or
  an excluded resource; there is no fallback source-path evidence field.
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
