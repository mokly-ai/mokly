# CSS Change Attribution

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose

A linked stylesheet edit is conservative evidence that a screen may render
differently. Without further analysis, every view that links the stylesheet
stays in Changes, even when the edit adds rules that no element on that view
can match. This contract narrows that evidence to the views whose documents a
changed rule could apply to, and names the owner of each kept rule, while it
never claims a view is unchanged when a rule could apply.

The analysis is a sound exclusion, not a visual proof. It can prove that no
changed rule matches a document. It cannot prove that a matching rule has a
visible effect, and it does not try to. Browser-verified refinement is outside
this contract.

## Inputs

The analysis takes two inputs for one stylesheet on one view:

- The stylesheet's bytes on both sides. The head side's bytes come from the
  render cache: a bundle the core wrote on `lightningcss` or through the
  consumer's PostCSS module, or a public file of the working tree. The base
  side's generated CSS comes from the bounded base capture, with pinned-source
  fallback; public files use the base-side source under [Sides](./mokly-comparison.md#sides). A side that lacks the stylesheet
  contributes an empty stylesheet after the verified-deletion check of the
  [Changes contract](./mokly-changes.md#resources); an invalid read never
  becomes an empty stylesheet.
- The head's composed documents from the bounded render cache and the base's
  from the bounded capture or pinned-source fallback, with ownership and ignore
  regions attached under the
  [tree model](./mokly-comparison.md#tree-model). A view that one side lacks
  contributes no tree.

The analysis runs only for a stylesheet whose bytes differ between the sides
and that a view's composed document reaches on at least one side: a linked
stylesheet, a transitive `@import` chain, or a stylesheet an embedded document
links. It never widens the set of examined files. A private source, such as an
imported `.css` or `.module.css` file or a token module, is never analysed and
creates no evidence; a source edit that leaves the delivered bundle's bytes
unchanged adds nothing. A stylesheet a component declares is eligible only
when a composed document links it, under the
[component stylesheet contract](./mokly-component-stylesheets.md); declaring a
file grants no ownership. No owner record controls eligibility or attribution.

Head `<style>` elements are not stylesheets of this analysis. Styles a
[sidecar](./mokly-sidecar.md#style-collection) render returned carry their
owners, and unowned head styles follow the inline rule of
[style ownership](./mokly-comparison.md#style-ownership); both use the rule
diff of this page and the per-rule records of the
[membership contract](./mokly-css-attribution-membership.md). Resources that
are not stylesheets, including fonts, images, and embedded documents, keep
file-level attribution.

### Analysis scope

A stylesheet is in scope when it is a public file that a composed document
links: a stylesheet bundle under the
[imported stylesheet delivery contract](./mokly-imported-styles.md), a
configured stylesheet, or a public file of the catalogue's referenced closure.
One predicate answers "is this stylesheet in analysis scope" for Serve,
`build`, and `publish`. A changed asset that a stylesheet references keeps
every view whose closure reaches it, without decoding the asset.

Per-view records exist only for views with at least one kept rule or one
excluded stylesheet. A view without either carries no record.

## Stages

1. **Rule diff.** Parse both sides of the stylesheet into an ordered list of
   rules. Each rule carries its selector list, its declarations, and its
   enclosing conditions: `@media`, `@container`, `@supports`, `@layer`, and
   nesting parents. Diff the two lists into changed, added, and removed rules.
   Whitespace, comments, and formatting differences produce no rules. A rule
   that moves without changing its selectors, declarations, or conditions
   produces no rule.
2. **Matchability.** Test each diffed rule's selectors against both sides'
   composed documents, after ignored regions are removed, with the `selectors`
   crate; ignored content supplies no match. A match on either side keeps the
   rule and keeps every matched element with its side, its selector, and the
   regions that contain it. Enclosing conditions are not evaluated: a
   rule inside `@media` or `@container` is tested exactly like a rule outside
   it, because evaluating conditions needs a viewport and element sizes.
   Resolve nesting parents outermost first, substituting `&` with `:is()` of
   the complete parent selector list, or applying an implicit descendant when
   needed; an unresolvable combination stays unresolved. Match the composed
   tree as the parser built it: implied elements, formatting clones, and HTML
   versus SVG and MathML name case; `template` content is inert. Interactive
   and browser-state pseudo-classes (`:hover`, `:focus`, `:visited`, and the
   like) and non-shadow pseudo-elements (`::before` and the like) are not
   evaluated: test their base compound instead, and a potential base match is
   `matched`. Broaden through functional selectors without making negation
   restrictive: `.button:not(:hover)` can match `.button`. State-dependent
   `:nth-child(... of ...)` counts are not evaluated either; static structural
   predicates stay in force. An unsupported selector or a matcher compilation
   failure stays unresolved; stripping state never strips a shadow or global
   keep construct.
3. **Reduce.** A rule with at least one match is kept with status `matched`.
   A rule with no match on either side produces no record. Any unresolved
   rule is kept with status `unresolved`, even when another rule matched. When
   no changed rule of the stylesheet is kept on this view, the stylesheet is
   examined and excluded: one record with status `excluded` marks it, and it
   supplies no reason for the view. A failed stylesheet parse yields no
   partial selector evidence.
4. **Attribute.** Join equal changed rules across stylesheets by the
   [rule identity](./mokly-css-attribution-rules.md#rule-identity-across-stylesheets).
   Decide each kept rule's owner from its matched elements and their regions
   under the [membership rule](./mokly-css-attribution-rules.md): prove changed
   components from kept own-page matches after nested filtering, then decide
   the entry's own evidence. Do not reduce away the per-rule element sets
   before this step.

## Rule Diff Representation

The parser is `lightningcss`, read before any optimization; optimized output
is never diff material. Rules receive zero-based depth-first ordinals, one
serialized string per selector in source order, a normalized declaration
block, ordered `{ kind, prelude }` conditions, and a flag for custom
properties. The condition kinds are `media`, `container`, `supports`, `layer`,
and `nesting-parent`; preludes omit the at-keyword. An anonymous layer has an
empty prelude. A nesting parent's prelude joins its selectors with `, `;
implicit nested selectors keep `&`. Declaration runs after nested rules or
directly inside nested conditions are separate `&` rules under the enclosing
context.

Declaration serialization removes comments and insignificant whitespace and
keeps token separation, string and URL contents, duplicates, shorthand and
longhand distinctions, and source order, including interleaved `!important`
declarations. It does not join tokens that a comment separates:
`url/**/("a.svg")` stays distinct from `url("a.svg")`, as do separated
identifiers. Selectors and known condition preludes are serialized in the
parser's normalized form. A selector-less at-rule has an empty selector list,
an at-rule name without `@`, a serialized prelude, and its complete normalized
body as its declarations. This includes encoding, import, namespace, and layer
statements, empty grouping rules, and opaque unsupported at-rules. An opaque
body stays one record, so its inner selectors cannot grant an exclusion.

Rule identity within one stylesheet consists of conditions, selectors, and
declarations; a selector-less rule adds its at-rule name and prelude, so
differently named animations, imports, or rule kinds cannot cancel each other.
Ordinals are excluded from identity. Rule lists are multisets: cancel exact
matches first, consuming duplicate occurrences in source order, then pair the
remaining rules with equal conditions and selectors (and at-rule name and
prelude) in source order as changed declarations. Excess occurrences are
added or removed.

A resolved diff has three lists: `added` sorts by after ordinal, `removed` by
before ordinal, and `changed` pairs of before and after sort by after ordinal.
Both sides of a changed rule are kept, so custom-property removal and
before-only material stay available to matching. An unresolved diff holds
side-tagged failures and no partial lists. A syntax error, an unclosed block,
comment, or string, or a serialization failure is the `css-parse-failed`
outcome with its cause; it never escapes as a thrown error, and both sides are
examined for failures. The parser attempts no browser error recovery for
incomplete source.

## Kept Constructs

Every case the analysis cannot resolve keeps the rule and marks it
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
- A changed `@import` or `url()` reference. The resource closure already
  attributes the referenced file; the analysis must not weaken that path.
- A parse failure on either side of the stylesheet.

Any failure that escapes the parser or matcher while analysing one stylesheet
for one view becomes an `unresolved` record for that stylesheet with the
selectors that could be serialized. It never aborts classification and never
excludes the stylesheet.

Apply these checks in the order above before ordinary matching. Global and
shadow detection includes nested selector arguments and nesting parents, not
literal attribute values or synthetic universals that state stripping
introduces. For a declaration edit, compare the custom declarations and URL
references on both sides: an unchanged custom property or URL does not trigger
its keep rule. A changed URL in an unevaluated condition prelude also counts
as a changed reference.

## Document Matching Interface

The [matching interface](./mokly-css-document-matching.md) defines the pure
per-rule matcher and the parser and matcher composition boundary.

Membership and presentation continue in
[CSS Attribution Membership](./mokly-css-attribution-membership.md).
