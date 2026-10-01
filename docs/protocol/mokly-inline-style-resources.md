# Inline Style Resource Ownership

## Delivery Status

Implemented for committed and derived comparison, including unchanged
reference-bearing rules and resources absent from saved variants.
Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md):
[M5](../../plans/scalable-inline-style-analysis.md#milestone-5-changed-segment-analysis)
implements the [matched-occurrence rule](./mokly-css-parse-reuse.md#unchanged-references-and-composition);
[M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis)
delivers derived reference seeds and fast-path raw proof; [M9](../../plans/scalable-inline-style-analysis.md#milestone-9-fingerprinted-comparison-materials)
delivers stored references for fingerprints. Propagation rules stay unchanged;
the page contract owns the precise provenance-reference equality domain.

This contract owns resource propagation for the attributions and canonical
materials defined by [inline style ownership](./mokly-inline-styles.md).
[Component attribution](./mokly-component-changes.md#dependencies-and-styles)
owns Changes membership; [review validation](./mokly-component-review-validation.md)
owns recorded reason sources and exact implementation-impact validation.

## Resolution And Propagation

A `url()` or `@import` reference inside an owned rule follows that rule's
owner: the projected material omits the rule, so the referenced file is not
discovered as entry material, and an actual-view dependency reason for a path
reached only through owned rules is attributed to those owners in the same
way `ownedDependencies` owners are. A reference inside an `excluded` rule is
discovered by neither material. A reference inside an `unresolved` or `entry`
rule remains entry material.

For ownership, use the stored reference values of retained rules for each distinct
component-owner set and traverse those seeds through the corresponding
side's ordinary resource reader at the view route. Relative paths, the
catalogue prefix, CSS imports and all transitive resources therefore resolve
exactly as they do for actual material. Owners for one retained actual-view
dependency reason are the union of matching inline owner sets and
`ownedDependencies`, filtered to components present in that view. If projected
entry material independently reaches the same path, its entry reason remains.
In derived mode, a byte-only difference without Git evidence gives inferred
owners a component `material` reason, matching `ownedDependencies`; it does not
invent a dependency reason or changed path.

An unchanged reference-bearing rule contributes on both actual sides. If it is
owned or excluded, its paired rule objects remove it symmetrically from both
projected sides (and from both actual sides when excluded). It never contributes
retained selectors, all-excluded evidence, material inequality or inline-style
evidence; its sole purpose is resource ownership and exclusion.

Pair/removal decisions name the matched occurrences under
[parse reuse](./mokly-css-parse-reuse.md#unchanged-references-and-composition),
not every object with the same identity. Fast-path views run no attribution;
their conservative raw closure proof can only fall through on a possible
change. Actual/projected seeds and fingerprint references follow
[page analysis](./mokly-page-analysis.md#derived-material-references).
