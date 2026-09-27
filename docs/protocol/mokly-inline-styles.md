# Inline Style Ownership

## Delivery Status

Approved target tracked by the
[inferred inline style ownership plan](../../plans/inferred-inline-style-ownership.md).
Until its Milestone 4 lands, the builder still accepts renderer-returned
ownership records and applies them as the
[component change attribution contract](./mokly-component-changes.md)
described before that plan; the reference-bearing rule analysis and
reference-following arrive with Milestone 5, the `inlineStyles` evidence with
Milestone 6, and the shell presentation with Milestone 7. This document owns
the analysis, attribution, comparison material, membership and evidence rules
for style material that a renderer places outside component markup. The
[CSS change attribution contract](./mokly-css-attribution.md) owns the
parser, rule diff, keep list and matcher that this analysis reuses; the
[changes contract](./mokly-changes.md) owns the definition of a view's
`material` flag and states; the
[CSS evidence shell contract](./mokly-css-evidence-shell.md) owns the
presentation.

## Purpose

A styling library can write the CSS of a registered component into a
`<style>` element in the document head, outside every recorded component
range. React Native Web atomic classes and CSS-in-JS output work this way.
Markup ownership cannot attribute that CSS, and a renderer cannot know which
registered component produced a rule. Mokly therefore infers the owner of each
changed head rule from the rendered documents themselves: a rule belongs to
the paired component instances whose markup it can match. The same sound
matchability argument that narrows linked stylesheet evidence applies. The
inference can prove a rule reaches only component-owned markup, or no markup
at all; it never claims a rule has no visible effect when it can match
entry-owned markup.

## Scope

The analysis runs inside the component-aware classifier for a paired view.
Catalogues without registered components keep the schema-v2 classifier, where
an inline style edit remains an ordinary material change. One-sided views run
no analysis. Views settled by the
[unchanged view decision](./mokly-component-changes.md#unchanged-view-decision)
have equal marker-retaining documents, so there is nothing to diff; the
analysis runs there only when an unowned rule carries a `url()` or `@import`
reference, so that projected resource discovery applies the same exclusion on
both paths.

The unowned style elements of a document are its `<style>` elements whose
start offset lies inside no recorded range and inside no paired manual-ignore
region. They are located on each side's original document with the ranges
validated in that side's own marker dialect; their spans, from start tag
through end tag, and their texts are taken from that document and used for
removal and for the skip test below. Style elements inside an instance range
already belong to that instance through markup ownership; style elements
inside a slot range belong to the slot's owner; a style element inside a
paired ignored region stays in place and is neutralised by paired
normalization as today. Only unowned style elements are analysed. The
renderer reports nothing; `RenderResult`, `styles` and `resources` records
are retired.

When the ordered sequence of unowned span texts is identical on both sides
and no unowned rule carries a reference, the analysis is skipped and both
materials keep the documents unchanged. Two sequences that split the same
rules across different elements are not identical; they run the analysis,
which finds no diffed rule and renders equal fragments.

## Analysis

1. **Documents.** Build the paired ignore-normalized, marker-retaining
   documents, normalizing the base to the current marker dialect first, then
   validate both sides' ranges against those texts and parse each side with
   source locations. Elements inside paired manual-ignore regions therefore
   never grant a match, exactly as in stylesheet matching. Matching and
   owner resolution use these normalized documents; span removal uses the
   original documents, so the two coordinate spaces never mix.
2. **Rules.** Parse each side's unowned style texts through the
   classification's shared cached `CssRuleParser` and diff the two sides as
   one multiset with `diffCssRules`, so element order and formatting carry no
   identity. The analyzed rules are the added, removed and changed rules of
   that diff plus every rule on either side that carries a `url()` or
   `@import` reference in its declarations or prelude. When either side's
   unowned styles fail to parse, the diff is unresolved: there are no rule
   lists, no attribution and no owned set. Both materials then keep every
   unowned style element verbatim on both sides, and a view whose materials
   differ carries `inlineStyles` with status `unresolved` and an empty
   selector list.
3. **Matching.** Test each analyzed rule's selectors against both documents
   with the stylesheet matcher after its state-pseudo stripping, collecting
   every matched element rather than the first. Stripping can only widen the
   matched set, which can only widen the owner set, so the result stays
   conservative.
4. **Owners.** Resolve each matched element to its innermost enclosing range.
   An instance range resolves to that instance; a slot range resolves to the
   slot's owner, which is the entry or the instance that supplied the slot; no
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
   to the root component id.

## Attribution

Every analyzed rule receives exactly one attribution, decided in this order:

- `unresolved` when the closed keep list of the stylesheet analysis applies: a
  selector the matcher cannot parse, a shadow-scoped or global selector, an
  unresolvable nesting parent, a changed custom property, or a selector-less
  at-rule. A changed reference alone does not keep a rule;
  reference-bearing rules are attributed by matching so that the reference can
  follow the rule's owner.
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

The canonical rendering sorts rules by their identity (conditions, selectors,
at-rule name, prelude and declarations), ignores ordinals, wraps each rule in
its conditions outermost first with nesting parents rendered as enclosing
selectors, and emits valid CSS whose declaration text is the parser's
normalized text. `url()` and `@import` references therefore survive for
reference discovery, and unchanged rules render identically on both sides. A
reordered or reformatted inline stylesheet with the same rules is not a
change; an entry-retained rule edit is.

Owned attributions join the implementation-impact set that
`changedComponentImplementations` produces for the view, so each owning
component receives a `material` reason and its consumers become affected even
when no saved variant exercises the edited rule. A component's own
saved-variant page reports root-owned rule edits as material through the
ordinary entry path, because root-owned elements resolve to the entry.

A `url()` or `@import` reference inside an owned rule follows that rule's
owner: the projected material omits the rule, so the referenced file is not
discovered as entry material, and an actual-view dependency reason for a path
reached only through owned rules is attributed to those owners in the same
way `ownedDependencies` owners are. A reference inside an `excluded` rule is
discovered by neither material. A reference inside an `unresolved` or `entry`
rule remains entry material.

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

## Evidence Schema

`ViewReview` gains one optional field, allowed in both result schema versions
and emitted only by the component-aware classifier:

```ts
type InlineStyleEvidence =
  | { status: "matched" | "unresolved"; selectors: readonly string[] }
  | { status: "excluded" };

interface ViewReview {
  // existing fields unchanged
  inlineStyles?: InlineStyleEvidence;
}
```

`matched` and `unresolved` mean the entry retained at least one analyzed
diffed rule; `selectors` lists those rules' selectors in their original
serialized form, sorted lexically by UTF-16 code units and duplicate-free.
`unresolved` takes precedence when both apply and may have an empty list;
`matched` requires at least one selector. `excluded` means the diff produced
at least one rule, every diffed rule was excluded, and the view's resulting
state is `unchanged`. When excluded rules exist but the view's state is
`changed` or `ignored-only`, the view retains any reason, or owned rules
exist, the field is omitted, because the view's other evidence explains it.
Reference-bearing rules that are not diffed contribute no evidence. Views
settled by the unchanged decision, one-sided views and views without unowned
inline style differences carry no field.

The live classification snapshot's `screenEvidence` records, the static export
projection, publication and the selected live endpoint carry `inlineStyles`
beside `reasons` and `excludedResources`, with the same omission and canonical
ordering rules. Schema versions do not change; results without the field
remain valid and mean the analysis did not run.

## Validation

- `status` is one of `matched`, `unresolved` or `excluded`; `selectors` is
  present exactly for `matched` and `unresolved`, sorted and duplicate-free,
  and non-empty for `matched`.
- A view carrying `inlineStyles` with status `matched` or `unresolved` has
  state `changed` and `material`; a view carrying status `excluded` has state
  `unchanged`, no `material` and no reason of its own.
- The field never appears on one-sided views. Unknown keys and inconsistent
  shapes fail rather than being dropped.
- Browse's lightweight classification, complete comparison generation,
  publishing and the selected live endpoint use one implementation and produce
  identical membership and evidence.

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
