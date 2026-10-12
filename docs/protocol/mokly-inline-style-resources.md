# Inline Style Resource Ownership

## Delivery Status

Implemented for Git-blob and rebuilt baselines, including unchanged
reference-bearing rules and resources absent from saved variants.
The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
implements the following behavior. Decision 13 performance acceptance is
deferred by the user decision of 2026-10-06.
The [matched-occurrence rule](./mokly-css-parse-reuse.md#unchanged-references-and-composition),
derived reference seeds, stored owner-group references and fast-path raw proof
are implemented. Page analysis implements stored references for fingerprints.
Propagation rules stay unchanged;
the page contract owns the precise provenance-reference equality domain.

This contract owns resource propagation for the attributions and canonical
materials defined by [inline style ownership](./mokly-inline-styles.md).
[Component attribution](./mokly-component-changes.md#rendered-resources-and-styles)
owns Changes membership; [review validation](./mokly-component-review-validation.md)
owns recorded reason sources and exact implementation-impact validation.

## Resolution And Propagation

A non-CSS reference inside an owned rule follows that rule's owner. The
projected material omits the rule, so a file reached only through that rule
has no entry reason. References inside excluded rules supply no retained
material. References inside unresolved or entry rules remain entry material.

For ownership, use stored reference values for each distinct component-owner
set and traverse the corresponding side's ordinary resource graph at the view
route. Relative paths, the catalogue prefix, CSS imports and transitive assets
therefore resolve as they do for actual material. Traverse CSS files to find
non-CSS assets, but never add a CSS path to the owner map. Every CSS file uses
own-page rule membership, even when reached through an owned inline rule.

For each retained non-CSS dependency reason, union inferred inline owners with
renderer `resources` owners. Keep only components present in that view,
including the saved root. Independently reached entry resources retain their
entry reason. A byte-only difference without Git evidence gives the same
owners a component material reason; it invents no dependency reason or changed
path. Move normalization maps recorded component ids while preserving resource
paths and original document coordinates.

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
