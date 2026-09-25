# CSS Attribution Rules

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

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

Continue with [CSS Attribution Membership And Evidence](./mokly-css-attribution-evidence.md).
