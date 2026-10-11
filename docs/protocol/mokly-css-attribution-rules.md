# CSS Rule Membership And Identity

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md):
element matching, rule identity, component membership and page reasons. The
comparison details are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence). These rules replace stylesheet
owner attribution for every CSS delivery path.

The inserted-link Review-ignore exception is implemented in
[M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).

## Matched Elements

A page means one rendered document: a screen view, a saved component variant
view, or a whole-document page. A component's own pages are all its saved
variants at every available viewport and color scheme. The component parent's
catalogue page displays a variant; it does not add another document.

For each changed public stylesheet, use every page that reaches it on either
side through a stylesheet link, a transitive CSS import or an embedded
document. Match in the document where the stylesheet applies; a stylesheet
inside an embedded document does not style its host document. Keep normal
resource confinement and changed-byte eligibility. Configuration, declarations,
JavaScript imports and owner records cannot bypass this scope.

Use the before and after documents after the existing paired Review-ignore
normalization, before component-output projection. Preserve the map from each
remaining element to the validated component ranges on that side. Removed
ignored content contributes no element. One-sided adoption retains the existing
paired policy; do not normalize either side again. A missing view has no tree.
Recover Mokly-inserted links from validated `insertedStylesheets` spans for
resource discovery and CSS rule scope, including inside paired Review-ignore.
Use the same [link finder and scopes](./mokly-stylesheet-links.md) on complete
and fast comparisons. Ignored authored markup still supplies no selector
matches; its own links and styles stay ignored. Comparison-only removal of
inserted links still applies to document material.

For each resolved changed rule, find all elements that any of its selectors
can match in either document, not just the first match. Reachability on either
side admits the page; both available documents then participate, even if one
side has no link. Use the existing
nesting, pseudo-class, pseudo-element and unevaluated-condition rules. Retain
the side, document, selector and enclosing component occurrences for each match
until classification finishes. These element references are internal evidence,
not serialized DOM nodes or new source-path reasons.

Component output is the material within its validated output boundary. Map an
element's source start-tag position to the containing output ranges, preserving
that mapping through normalization. Parser-inserted elements with no source
position have no proven component containment and count as page elements. An
element in nested output is also within each enclosing output boundary. This
inclusive containment is used for page rows. Component membership applies the
nested-component test below. Rendered slot material follows those same bounds;
caller ownership of props or slot edits is unchanged. Empty or text-only
output has no elements to match. Renderer wrappers outside the root output on
a component page are page elements. Never treat the whole document as the root
component. The [usage contract](./mokly-component-usage-records.md#root-output-boundary)
defines its explicit root boundary. Every available component saved view must
prove that boundary. A missing required root is invalid data, not page evidence.

An unresolved outcome supplies no proven element set. Do not guess component
matches from a selector string or owner list. Keep the existing closed list of
unresolved cases, including custom properties, global selectors, unreadable
selectors, changed references and parse failures. Independently resolved rules
in the same stylesheet still retain their matches.

## Components Changed By A Rule

First collect resolved own-page matches for every component and rule identity
across the complete catalogue. These are all matches inside that component's
root output, before any nested-component filtering. Include every saved
variant, viewport, scheme, before/after side and matching copy of the rule.

For component X, keep an own-page match only when it is not inside a nested
occurrence of a different component Y whose own-page match set for this same
rule is nonempty. Check every containing nested occurrence, at any depth, on
the match's own side. A nested occurrence of X itself never takes a match from
X; a different component nested within that occurrence can still take it.

The test for Y uses its unfiltered own-page matches, not the matches Y keeps
or whether Y is changed. It needs no traversal order, iteration or fixed point.
Apply it independently to every component. Recursive and mutually nested
components follow the same rule over their finite rendered occurrences.

X is changed by this rule exactly when at least one own-page match remains.
Keep the original per-page matches for page rows and full-view evidence;
nested filtering removes only component reasons. Union the changed parent ids
before deciding page rows. A match at an actual
invocation on a consumer page never establishes that invoked component's
own-page match set or makes that component changed.
Ordinary implementation, document-style and non-CSS resource attribution keep
their existing actual-invocation rules.

Each changed component parent gets its own dependency reason and Changes row.
For this component reason, a saved variant gets its own row only if X keeps a
match on that variant's own page. A different variant is not added solely
because the parent changed. The separate page-row rule still applies. Parent
CSS evidence is a direct reason, separate from the navigation aggregate mark.
Keep actual variant view states and exclusions; never invent a variant for a
consumer's props.

These changed parent ids contribute to the existing implementation-impact set.
Affected screens keeps the union of before/current usage, including transitive
uses and removed consumers. It is usage evidence, not proof that every use
visibly changes or matches the rule. An independently changed consumer can also
appear there. A page-only CSS reason never enters that impact set.

## Page Rows

For each resolved rule on each page, subtract matches inside the output of any
component changed by that same rule. Use containment on the match's own side;
the changed-component set is the before/after union. This subtraction includes
all nested output within a changed component's occurrence. Do not subtract a
match merely because its component changed for some other reason or some other rule.

If any match remains, give the page its own dependency reason and Changes row.
Record exactly the selectors with remaining matches as page evidence. A
selector can match both inside and outside changed components; include it once.
This rule can give a component and a consumer their own rows at the same time.
If all matches are inside changed components, the consumer is affected-only
for this rule. Zero matches gives no direct reason; the resource is excluded
only if none of its changed rules is retained.

An unresolved rule always gives every eligible page its own reason and row.
It cannot be suppressed by a known component match from another rule. A whole
stylesheet parse failure follows this rule with no partial selector claims.
Keep any independent material, metadata, input, structure, addition, removal,
non-CSS resource or flow reason. Affected-only screens do not propagate a
direct screen reason to flows.

On a component page, a page row names the saved variant entry that owns the
view. It means that this view changed outside the output of components changed
by this rule, or that the rule is unresolved. It gives that entry no Affected
screens for this rule. Do not turn a renderer-wrapper match into a parent
component change. A kept own-root match is instead the direct component change
defined above, even though subtracting its covered matches leaves no page reason.

## Rule Identity Across Stylesheets

Keep the existing per-file rule diff, including its multiset cancellation,
condition-sensitive pairing and duplicate handling. Cross-stylesheet identity
is a separate key over each resulting added, removed or changed rule. It uses
only the normalized selectors and declarations on its before and after sides.

For each present side, use `[selectors, declarations]` from the rule parser:
serialized selectors in their original order and the normalized declaration
block. Do not sort selectors or reorder declarations to make copies equal.
Retain duplicate declarations, token separation, strings and `!important` as
the rule diff does. An absent side is `null`, not an empty declaration block.
The key is lowercase SHA-256 of UTF-8 compact JSON without a final LF for
`["mokly-css-change-v1", beforeSide, afterSide]`.

Do not include stylesheet path, bundle root, ordinal, owners, enclosing
conditions, at-rule name or prelude in this cross-stylesheet key. Conditions
still participate in the file diff and nesting still participates in matching.
Selector-less and other unresolved rules cannot establish component matches,
even when their keys coincide. Confirm equal normalized side tuples before
combining internal records; a key collision must fail `review-invalid`.

Generated stylesheets copy source rules into each entry root. Equal normalized
before/after tuples therefore join a consumer bundle's rule to the copy on a
component's own page. A shared filename, source import, selector alone or equal
after declarations alone is not enough. Duplicate changed occurrences share
one identity and union evidence; each occurrence is still matched under its
own nesting context.

| Change                | Identity and matching                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Added rule            | `beforeSide` is `null`; test its selectors against both available document sides.                |
| Removed rule          | `afterSide` is `null`; test its selectors against both available document sides.                 |
| Edited rule           | Both sides are present; use both selector sets against both available document sides.            |
| Added stylesheet      | Diff an empty before stylesheet against its bytes; all rules are additions.                      |
| Removed stylesheet    | Diff its bytes against an empty after stylesheet; all rules are removals.                        |
| Added or removed view | Only the existing document contributes matches; its added/removed row remains regardless of CSS. |

Two additions can share identity; two removals can share identity. An addition,
a removal and an edit are different even if their present declarations agree.
A stylesheet rename thus does not silently pair additions with removals across
paths. Link-only changes to an unchanged file remain document material under
the existing inserted-link exclusion; they invent no changed rule. A missing
stylesheet counterpart is empty only after existing optional-read or verified-
deletion checks. Invalid reads never become empty stylesheets.

## Attribution Examples

The same decision applies to all four delivery paths. In these examples,
`Action` renders `.action` on its own saved pages and on `Checkout`. The edit
changes a normal `color` declaration, so it is resolvable.

| How CSS reaches the page            | Example                                                                                                                                        | Changes and evidence                                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configured stylesheet               | `shared.css` is linked on Action's own pages and Checkout; its changed `.action` rule matches only Action output.                              | Action and its saved variants with kept matches have rows. Checkout is under Action's Affected screens, with no page reason for this rule.                                       |
| Component `stylesheets` declaration | Action declares `action.css`; its changed `.checkout-heading` rule matches Checkout's heading outside Action. It matches no own Action output. | Checkout has a row. Action is unchanged. Details name `action.css` and `.checkout-heading`.                                                                                      |
| Import from a stylesheet            | Declared `action.css` imports `parts.css`; the changed `.action` rule in `parts.css` matches Action on its own pages and Checkout.             | The same Action rows and affected Checkout result as configured CSS. Evidence names `parts.css`, not its importing file. A heading rule in that file would instead add Checkout. |
| JavaScript import                   | An imported CSS rule is copied into separate generated bundles for Action and Checkout, with equal before/after tuples.                        | The same Action rows and affected Checkout result. Evidence names each view's generated public stylesheet; private source paths add nothing.                                     |

If a stylesheet linked only on Checkout changes `.checkout .action`, the match
is inside an Action invocation but no Action own page has the same changed
rule and match. Checkout gets the row; Action stays unchanged. The page's
details list that selector. Other Action consumers are not added by this rule.
This also holds when the screen-only rule comes from JavaScript imports.

### Nested Components

Assume each named rule has the same changed identity on the relevant pages,
and there are no independent changes:

- `.action` matches Action's root output on its own saved pages. On Toolbar's
  own page, it matches only inside Action. Action keeps its own-page matches; Toolbar loses those
  nested matches. Only Action and its saved variants with kept matches get
  component rows. Toolbar is under Action's Affected screens.
- `.toolbar .action` matches on Toolbar's own pages but not on Action's own
  pages. Action cannot take these matches from Toolbar. Toolbar keeps them
  and changes; its consumers are affected. Action stays unchanged.
- With Icon inside Action inside Toolbar, `.icon` matches Icon's root output
  on its own saved pages. Action's and Toolbar's own-page matches are all inside Icon. Only Icon
  keeps matches and changes. Action and Toolbar are under its Affected screens.
- Y's own-page matches all sit inside a nested Z that keeps its own-page
  matches. Y loses them and is not changed. On X's own saved page, the same
  rule matches inside Y but outside Z, with no other match that X can keep.
  Y still takes that match from X because Y's unfiltered own-page set is
  nonempty. X is not changed as a component. The match lies outside every
  changed component on this page, so X's saved view gets a page row, with no
  Affected screens from that page reason. This conservative fallback keeps
  the change visible.

If a rule instead matches `.renderer-frame` outside Toolbar's root, only that
saved page gets a page row, with no affected consumers for that rule.

Evidence fields and validation are defined in [CSS Attribution Membership](./mokly-css-attribution-membership.md).
