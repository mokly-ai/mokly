# Inline Style Ownership

## Delivery Status

Implemented across comparison, classification, result delivery and shell
presentation. The span, diff, attribution and canonical-material engine runs on
complete paired views and reference-bearing fast-path views. The renderer is
string-only, current manifests contain no head-style or public-resource
assertions, and historical readers discard the retired arrays. References
inside inferred-owned rules follow their owners through the ordinary resource
graph, including on the fast path. Component-aware results carry validated
`inlineStyles` evidence and the shell presents each outcome. This document owns
the analysis, attribution, comparison material and membership rules for
style material that a renderer places outside component markup. The
[CSS change attribution contract](./mokly-css-attribution.md) owns the
parser, rule diff, keep list and matcher that this analysis reuses; the
[changes contract](./mokly-changes.md) owns the definition of a view's
`material` flag and states; the
[CSS evidence presentation contract](./mokly-css-evidence-presentation.md) owns the
presentation.

## Purpose

Styling libraries can place component CSS outside recorded markup ranges,
including atomic React Native Web rules and CSS-in-JS head output. Mokly
therefore infers each changed rule's owner from all matching elements in the
paired documents. It can prove a rule reaches only component-owned markup or
no markup, but never claims exclusion when a rule reaches entry-owned markup.

## Scope

The analysis runs inside the component-aware classifier for a paired view with
usage records on both sides, including a component-aware view whose records
contain no instances. The complete path always considers it; the fast path runs
it only for possible references. A one-sided view or a paired view missing
either usage record keeps the existing comparison behavior.
Without component usage, inline style edits remain ordinary material changes
in the unified v4 classifier. One-sided views run no analysis. Views settled by the
[unchanged view decision](./mokly-component-review-fast-path.md)
have equal marker-retaining documents, so there is nothing to diff; the
analysis runs there only when an unowned rule carries a `url()` or `@import`
reference, so that projected resource discovery applies the same exclusion on
both paths. Before doing span discovery on this fast path, test both original
documents with the same `/url\(|@import|\\/i` prefilter as resource discovery.
If neither can contain a reference, skip inline analysis entirely.

The eligible style elements of a document are HTML-namespace `<style>`
elements in the document tree, excluding template contents and SVG/MathML
elements. Their `type` attribute is absent, empty or ASCII-case-insensitively
`text/css`, and they have no `media` attribute. Every other style element stays
in the document and compares as ordinary markup. An eligible element is
unowned when its start offset lies inside no recorded range and no paired
manual-ignore region. It is located on each side's original document with the
validated v7 ranges. Its span uses that
document's coordinates and covers the start tag's start through the end tag's
end; the record retains both that outer source and the content text between
the tags.

Style elements inside an instance range already belong to that instance
through markup ownership; style elements inside a slot range belong to the
slot's owner. Ignore pairing exposes ids rather than normalized offsets,
because generated-source removal changes lengths. The span finder walks the original document's comment nodes, accepts
the current ignore prefix and leaves an element inside a paired id
in place. A one-sided region remains ordinary analyzed material. The renderer
supplies only the document string; the manifest supplies no head-style or
public-resource assertions.

When the ordered sequence of unowned outer sources is identical on both sides
and neither side can contain a reference, the analysis is skipped and both
materials keep the documents unchanged. A possible reference prevents that
skip: the cached parser confirms it and owner attribution decides projected
resource discovery. An attribute-only difference runs the analysis even when
the content text is equal. Two sequences that split the same rules across
different elements also run it and render equal fragments when their rule
multisets are equal.

## Analysis

1. **Documents.** Derive the paired ignore ids and marker-retaining texts once
   with `normalizeReviewPair(base, head, path)` on validated v7 documents.
   Span discovery runs first against the original documents and their
   v7 ranges. If the eligible outer-source sequences are identical and
   their parsed rules contain no reference, stop before validating ranges
   against the normalized texts or parsing source-located trees. Otherwise
   validate both sides' ranges against those texts and parse each side once
   with source locations. Elements inside paired
   manual-ignore regions therefore never grant a match, exactly as in
   stylesheet matching. Matching and owner resolution use these normalized
   documents; span removal uses the original documents, so the two coordinate
   spaces never mix.
2. **Rules.** Parse each element's content separately through the
   classification's shared cached `CssRuleParser`, because each element is a
   browser stylesheet. Concatenate a side's successful rule lists in document
   order while rebasing ordinals to one unique monotonic sequence, then diff
   the two lists as one multiset, so element order and formatting carry no
   identity. Analyze the added, removed and changed rules of that diff plus
   every eligible rule on either side that carries a reference. A rule carries
   a reference when its declarations, its own at-rule prelude, or a
   non-nesting condition prelude contains a tokenized `url()` or string-form or
   `url()`-form `@import`. This is the same detector as HTML/CSS resource
   discovery, including escaped identifier forms. Pair an unchanged reference
   identity with both sides' rule records and analyze it once. One failed
   element makes the side and diff unresolved: there are no rule lists, no
   attribution, no owned set, no removals and no appended fragment. Both
   materials keep every unowned style element verbatim, and a view whose
   materials differ carries `inlineStyles` with status `unresolved` and an
   empty selector list.
3. **Matching.** Test each analyzed rule's selectors against both documents
   with the stylesheet matcher after its state-pseudo stripping, collecting
   every matched element rather than the first. Stripping can only widen the
   matched set, which can only widen the owner set, so the result stays
   conservative.
4. **Owners.** Resolve each matched element's start offset in the normalized,
   marker-retaining document to the innermost range whose content contains it;
   ranges are validated against that same text. An instance range resolves to
   that instance; a slot range resolves directly to its validated slot record's
   `owner`, which already names the original supplier through forwarding; no
   enclosing range resolves to the entry. An instance then resolves by this
   rule: an instance is paired when the same key names the same component id
   on both sides; an unpaired instance resolves to the entry; a paired
   instance whose `propsKey` is equal on both sides resolves to its
   component; a paired instance whose `propsKey` differs passes the element
   to the owner of its inputs, which is the entry or another instance resolved
   by the same rule. This is the pairing condition the implementation diff
   already uses, so a caller prop edit that produces a new instance-only head
   rule stays with the caller and a parent that changed the props it passes to
   a child owns the resulting child rule. The root component of a
   saved-variant page resolves to the entry, as does any resolved owner equal
   to the root component id. Resolution guards input-owner recursion against a
   cycle even though manifest validation already rejects one.

## Attribution

Every analyzed rule receives exactly one attribution, decided in this order:

- `unresolved` when the shared closed keep list of the stylesheet analysis applies: a
  selector the matcher cannot parse, a shadow-scoped or global selector, an
  unresolvable nesting parent, a changed custom property, or a selector-less
  at-rule. Inline analysis selects the keep policy's matchable-reference switch,
  so a changed reference can follow the matched rule's owner. Stylesheet-file
  analysis keeps its unresolved-reference policy. An `@import` remains
  unresolved because it is selector-less, independently of that switch.
- `excluded` when the rule's selectors match no element on either side.
- `entry` when any matched element on either side resolves to the entry.
- `owned`, with a sorted non-empty set of component ids, when every matched
  element on both sides resolves to a paired component instance with equal
  inputs.

`unresolved` and `entry` rules are retained by the entry. `owned` rules belong
to their components. `excluded` rules cannot change the rendered result and
belong to nobody. Ownership is inferred per view; the same rule can be owned on
one view and entry-retained on another.

## Comparison Material

One analysis produces two renderings. Each removes every unowned style
element, from its start tag through its end tag, from the original document in
the original coordinates, and appends one `<style>` element containing the
canonical rendering after the document, in the same way caller-slot material
is appended. The projected rendering makes those removals in the same
replacement pass as its instance identity tokens and caller-slot projection;
the actual rendering applies no tokens. The count, order and attributes of
unowned style elements therefore carry no identity, so a library that emits
one style element per component, or none when nothing is styled, compares by
its rules alone.

- The **actual material** decides the view `state`, its `material` flag and
  its actual resource discovery. It renders every rule except `excluded` ones.
  Owned rules stay, so a consuming screen whose component styles changed still
  shows as `changed`, as it does for markup-owned implementation edits.
- The **projected material** decides the entry's `material` reason and its
  projected resource discovery. It renders every rule except `excluded` and
  `owned` ones, beside the existing instance identity tokens and caller-slot
  projection.

The canonical rendering ignores ordinals. It sorts statement at-rules that
must lead a sheet (`@charset`, `@import`, `@namespace` and `@layer` statements)
first in valid statement order, then sorts the remaining rules by identity
(conditions, selectors, at-rule form/name/prelude and declarations). It emits
statement and block at-rules faithfully, wraps conditions outermost first and
renders nesting parents as enclosing selector blocks. Declaration text is the
parser's normalized text, so `url()` and `@import` references survive resource
discovery. Equal rule multisets render identically regardless of source order,
element split, whitespace or comments; an entry-retained rule edit still
changes material.

Resource discovery uses the actual or projected material appropriate to that
comparison. Linked-stylesheet selector matching does not use either rewritten
material: both resource comparisons match against the real paired-normalized,
marker-retaining documents. Removing a style element or appending a canonical
fragment therefore cannot alter sibling selectors such as `style + main` or
`:last-child` during linked-stylesheet analysis.

Owned attributions join the implementation-impact set that
`changedComponentImplementations` produces for the view, so each owning
component receives a `material` reason and its consumers become affected even
when no saved variant exercises the edited rule. A component's own
saved-variant page reports root-owned rule edits as material through the
ordinary entry path, because root-owned elements resolve to the entry.

The [inline resource contract](./mokly-inline-style-resources.md) owns
reference-bearing rule propagation, transitive paths and byte-only changes.

## Membership And States

The view `state` and `material` flag derive from the actual materials under
the [changes contract's definition](./mokly-changes.md): the paired
ignore-normalized actual materials decide whether a paired view is `changed`
with `material`, and the single-document normalizations of the two actual
materials decide `unchanged` against `ignored-only`.

- A view whose unowned inline styles differ only through `excluded` rules has
  equal actual materials: its state is `unchanged`, it carries no `material`
  flag, it contributes no reason and it is not in Changes.
- A view with `owned` rule edits and no entry-retained edit is `changed` with
  `material`, contributes no entry reason for those rules, and is affected
  through the owning components.
- A view with an `entry` or `unresolved` rule edit is `changed` with
  `material` and contributes a `material` entry reason.
- Every other Changes signal is unchanged: added or removed views, markup
  material, metadata, caller inputs, structure, linked-resource evidence,
  component ownership and use-case screen reasons.

## Result Evidence

The [inline evidence contract](./mokly-inline-style-evidence.md)
owns the optional `inlineStyles` shape, coupling to states and material, and
delivery through live, complete, selected and published v4 results. The
[validation contract](./mokly-component-review-validation.md#inline-style-evidence-validation)
owns strict paired-view validation and canonical selector order.

## Diagnostics

`review.inline-style-analysis` measures the synchronous span, diff, match and
attribution pass for one view, including parser-cache lookups. Contained parse
and selector failures return `unresolved` attributions with span status `ok`;
an escaping error ends the span with `error`. It logs no paths, selectors, CSS
or document text.

## Non-goals

- Evaluating media, container or supports conditions, specificity, cascade
  order or inheritance beyond the custom-property keep rule.
- Owner inference for linked stylesheet files; their ownership stays declared
  through `ownedDependencies`.
- Browser-verified refinement, pixel comparison or screenshots.
- Any change to what a component's own page compares.
