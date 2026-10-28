# CSS Rule Membership And Identity

Continuation of [CSS Change Attribution](./mokly-css-attribution.md).

## Matched Elements

A page is one composed document: a screen view, a component view, or a
whole-document page. A component's own pages are the views of the component's
own props and of each of its variants, at every available viewport and colour
scheme, under the [entry props contract](./mokly-entry-props.md). The
component page shows those views; it adds no other document.

For each changed public stylesheet, use every page that reaches it on either
side through a stylesheet link, a transitive `@import`, or an embedded
document. Match in the document where the stylesheet applies; a stylesheet
inside an embedded document does not style its host document. Resource
confinement and changed-byte eligibility stay in force. Configuration,
declarations, JavaScript imports, and owner records cannot widen this scope.
The decision is the same however the stylesheet reaches the page: through
configuration, a component declaration, an `@import`, or a JavaScript import.

Match against both sides' composed trees of the
[tree model](./mokly-comparison.md#tree-model), with their ownership regions
attached and their ignored regions removed, before any projection of owned
regions. A missing view has no tree. Every element knows the instance regions
that contain it: an element inside a nested instance region lies within each
enclosing instance region too, and this inclusive containment decides the
entry's own evidence. Ignored content supplies no match; its own links and
styles stay ignored. Implied `html`, `head`, and `body` elements, formatting clones, and every
element outside any region belong to the entry. On a component page the root
region `r-0` is the component itself; a renderer wrapper outside it is an
entry element. The whole document is never the root component.

For each resolved changed rule, find every element that any of its selectors
can match in either document, not just the first match. Reachability on
either side admits the page; both available documents then participate, even
when one side has no link. Apply the nesting, pseudo-class, pseudo-element,
and unevaluated-condition rules of the attribution contract. Matched elements
are internal evidence, never serialized nodes or new reasons.

An unresolved outcome supplies no proven element set. Never guess component
matches from a selector string or an owner list. The closed keep list of the
attribution contract applies: custom properties, global selectors, unreadable
selectors, changed references, and parse failures. Independently resolved
rules in the same stylesheet keep their matches.

## Components Changed By A Rule

First collect resolved own-page matches for every component and rule identity
across the complete catalogue: every match inside that component's root
region on one of its own pages, before any nested-component filtering. Include
every own view and variant view, viewport, scheme, before and after side, and
matching copy of the rule.

For component X, keep an own-page match only when it is not inside a nested
instance region of a different component Y whose own-page match set for this
same rule is nonempty. Check every containing nested instance, at any depth,
on the match's own side. A nested instance of X itself never takes a match
from X; a different component nested within that instance can still take it.
For a declared owner's rule, a nested component must also belong to the
match's supplier input ancestry to take that match. This protects a supplier's
own rule for content passed through a receiver. Linked and ownerless head
rules use physical containment for both claims and own-page filtering.

The test for Y uses its unfiltered own-page matches, not the matches Y keeps
or whether Y is changed. It needs no traversal order, iteration, or fixed
point. Apply it independently to every component. Recursive and mutually
nested components follow the same rule over their finite rendered instances.

X is changed by this rule exactly when at least one own-page match is kept.
Keep the original per-page matches for the entry's own evidence; nested
filtering removes only component reasons. Union the changed component paths
before deciding any entry's evidence. A match at an instance on a consumer
page never establishes that component's own-page match set and never makes
that component changed. Render, document-style, and non-CSS resource
attribution keep their own instance rules under the
[component attribution contract](./mokly-component-changes.md).

Each own component or variant view with a kept match supplies that entry's
reason and Changes row. A variant-only match permits the parent identity in
affected evidence without adding a parent row. A variant gets its own row for this component reason only when X keeps a
match on that variant's own page; a variant is never added solely because the
parent changed. The entry-evidence rule below still applies to every page.
Parent CSS evidence is a direct reason, separate from the navigation
aggregate mark of the
[variant navigation contract](./mokly-variant-navigation.md#changes-rows).

The changed component paths feed the affected consumer records: Affected
screens is the union of before and after usage, including transitive uses and
removed consumers. It is usage evidence, not proof that every use visibly
changes or matches the rule. An independently changed consumer can also appear
there. An entry-owned record never enters that set.

## Page Rows

For each resolved rule on each page, subtract the matches inside the regions
of any component changed by that same rule. Use containment on the match's
own side; the changed-component set is the before and after union. The
subtraction includes every nested region within a changed component's
instance. Do not subtract a match because its component changed for another
reason or another rule.

If any match is left, the rule's records for those selectors are owned by the
entry, and the page's entry has its own reason and Changes row. Record exactly
the selectors with matches left as entry evidence; a selector that
matches both inside and outside changed components is recorded once, owned by
the entry. One rule can give a component and a consumer their own rows at the
same time. If every match lies inside changed components, the consumer is
affected-only for this rule. Zero matches gives no rule record; a stylesheet
is examined and excluded, with one `excluded` record, only when none of its
changed rules is kept on the view.

An unresolved rule always gives every eligible page an entry-owned record and
a row. A known component match from another rule cannot suppress it. A whole
stylesheet parse failure follows this rule with no partial selector claim.
When either matching tree exceeds 512 element levels, changed selectors that
contain `:has()` are unresolved on that page. Other selectors keep their normal
matching. This bounds native stack use with a safety margin instead of risking
a process abort on deeply nested pages.
Every independent material, metadata, input, structure, addition, removal,
non-CSS resource, or use case reason stays. An affected-only screen does not
propagate a direct screen reason to its use cases.

On a component page, an entry-owned record names the entry that owns the
view: the component for its own props, or the variant. It means that this view
changed outside the regions of the components changed by this rule, or that
the rule is unresolved. It gives that entry no Affected screens for this rule.
A renderer-wrapper match is never a parent component change. A kept own-root
match is instead the direct component change defined above, even though
subtracting its covered matches leaves no entry evidence.

## Rule Identity Across Stylesheets

The per-stylesheet rule diff keeps its multiset cancellation,
condition-sensitive pairing, and duplicate handling. Cross-stylesheet identity
is a separate key over each resulting added, removed, or changed rule. It uses
only the normalized selectors and declarations on its before and after sides.

For each present side, the identity is the pair of the serialized selectors in
their original order and the normalized declaration block, as the rule parser
wrote them. Selectors are not sorted and declarations are not reordered to
make copies equal. Duplicate declarations, token separation, strings, and
`!important` stay as the rule diff keeps them. An absent side is absent, not
an empty declaration block. Two rules are one identity exactly when their
before sides are equal and their after sides are equal.

The identity excludes the stylesheet path, the bundle root, the source
position, the owners, the enclosing conditions, and the at-rule name and
prelude.
Conditions still participate in the stylesheet diff, and nesting still
participates in matching. A selector-less or otherwise unresolved rule cannot
establish a component match, even when its identity coincides with another
rule's.

Stylesheet bundles copy a source rule into each root that imports it, so equal
before and after tuples join a consumer bundle's rule to the copy on a
component's own page. A shared filename, a source import, a selector alone, or
equal after declarations alone is not enough. Duplicate changed occurrences
share one identity and union their proof; each occurrence is still matched
under its own nesting context and recorded under its own stylesheet.

| Change                | Identity and matching                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Added rule            | the before side is absent; test its selectors against both available document sides              |
| Removed rule          | the after side is absent; test its selectors against both available document sides               |
| Edited rule           | both sides are present; use both selector sets against both available document sides             |
| Added stylesheet      | diff an empty before stylesheet against its bytes; all rules are additions                       |
| Removed stylesheet    | diff its bytes against an empty after stylesheet; all rules are removals                         |
| Added or removed view | only the existing document contributes matches; its added or removed row stays regardless of CSS |

Two additions can share an identity; two removals can share an identity. An
addition, a removal, and an edit are different even when their present
declarations agree, so a stylesheet rename does not pair additions with
removals across paths. A link-only change to an unchanged stylesheet is
document material under the [materiality rule](./mokly-comparison.md#materiality);
it invents no changed rule. A missing stylesheet counterpart is empty only
when that side does not reference the file and its absence is proved by the
confined source reader. A missing referenced target fails validation; an
invalid read never becomes an empty stylesheet.

Evidence fields and validation are defined in
[CSS Attribution Membership](./mokly-css-attribution-membership.md).
