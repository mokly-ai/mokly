# Component-aware Style-only Route

## Delivery Status

Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
not yet implemented. [M8](../../plans/scalable-inline-style-analysis.md#milestone-8-style-only-route)
delivers this route, its differential test switch and `stylePath` counts.
It uses [M7 page analysis](./mokly-page-analysis.md) and
[parse reuse](./mokly-css-parse-reuse.md); later fingerprints do not change its
result contract.

## Position And Scope

In component-aware classification, try this route **after a failed unchanged
quick check and before the full comparison**. One-sided views and catalogues
without registered components never take it. Reuse the quick check's page
analysis/resource proof; a failed attempt is not a settled style-path view.
No production CLI/config switch exposes the route. The test-only
`useStylePath` switch beside `useFastPath` disables only this route, so enabled
and disabled classification use identical inputs and all other decisions.
Disabling `useFastPath` alone may still try the style route; a complete-path
oracle disables both switches. Neither switch changes validation.

## Eligibility

Every condition must hold, otherwise use the full comparison:

1. Both view sides exist at the same path, both have validated usage, and
   canonical usage topology is equal under the unchanged-decision rule.
   Entry-owned input changes remain allowed and retain their signals.
2. Texts are unequal. Compute their longest common UTF-16 prefix, then their
   longest common suffix without overlapping that prefix on either side.
   What remains is exactly one changed window per side; either may be empty.
3. The head analysis locates one eligible unowned style element whose **content
   span**, not tag/outer span, wholly contains the head window. The corresponding
   base window is in the same element, with unchanged start/end tags and attrs.
   The windows are disjoint from paired ignore regions and material-signal
   spans; validation and the existing one-sided-material rule still apply.
4. Neither window contains `<`, nor do the up-to-eight code units immediately
   before either window. Check actual code units, not serialized selectors or
   a decoded string. This rules out a partial raw-text end-tag transition at
   the start; empty insertion/deletion windows use the same guard.
5. Both complete eligible-unowned rule lists resolve under the full path's
   parse-reuse policy, including unchanged other style elements. Reuse their
   runs and compute the **view-wide** diff/cancellation with original ordinals,
   not an independent diff of just the edited element. Every added/removed/changed
   rule is reference-free by its **stored full-rule references**, not a search
   only in the window. No resolved selector of those rules uses `:empty`,
   `:contains` or `:icontains`, including inside functional selectors or
   resolved nesting parents. Literal attribute/string values with those words
   do not count. A selector compilation failure remains unresolved under the
   closed keep policy, not a proof of exclusion.
6. The quick check's resource proof passes using the head analysis's shared
   raw reference seeds through **each side's reader**: no changed reachable
   Git path in committed mode, and additionally equal closure membership and
   bytes in derived mode. These are transitive checks, not seed-path checks;
   do not use a union in place of separate closures.

Unchanged rules may contain references. Condition 5 means the diff changes
none, even when a URL straddles a window boundary or lies in a condition
prelude. Parse failures and any uncertain source/span proof take fallback;
malformed usage or ignore markers remain validation failures, not suppressed
errors. A non-eligible style, ownership edit, attribute/tag edit, two separated
style edits, changed reachable asset, or text-dependent selector fails the
corresponding condition.

## Why These Conditions Suffice

Both windows enter the same HTML raw-text style context through an identical
prefix. No `<` in or just before them can open or finish an end-tag candidate;
the tokenizer consumes plain text and enters the identical suffix in the same
state. Thus element structure, attributes, ownership boundaries and all markup
outside that style text are identical, with base suffix offsets shifted only
by the window-length difference. Source-span/ignore validation confirms that
the edit is not ignored content or a material-key change.

The only differing node content is the style text. Identical other elements
can still affect duplicate cancellation order, so their rules participate in
the view-wide diff; a failure there also makes the full inline analysis fail.
The excluded text-dependent predicates could make a resolved changed selector's
match set depend on that content. Other structural predicates and owners
therefore see identical trees. Attribute both sides' diffed rules using the
head original tree and original ranges, with the ordinary closed keep list
and input-owner/root resolution. Unresolved selectors remain conservative.

All changed rules lack references, while unchanged reference-bearing rules
have identical values. The shared seed proof is conservative over potential
actual/projected reachability and rules out resource evidence on either side.
Equal topology and identical implementation markup leave no non-inline
implementation difference to discover. No projection, full HTML material,
normalized tree parse or implementation comparison is needed.

## Result

Use the same rule diff, occurrence selection and attribution as the full
comparison. Compose/compare the actual retained rule multiset (excluded
occurrences removed) and entry-projected multiset (excluded and owned removed).
Stored canonical keys/text suffice; do not build page materials merely to
compare them. Equal actual material yields `unchanged`; unequal actual material
yields `changed` and `material: true`. It cannot yield `ignored-only` because
the edited windows are outside paired ignores and all other content is equal.

Entry reasons are `material` exactly when projected material differs, plus
the ordinary usage `inputs`/`structure` signals. Union the components owning
diffed rules into the implementation-impact set, so affected consumers and
entry membership stay delivered. Root-owned rules on a component variant page
remain entry material. No source/dependency path is invented for this route;
entry metadata and other evidence outside the view comparison still apply.

Emit `inlineStyles` exactly under the
[inline evidence contract](./mokly-inline-style-evidence.md): retained entry
rules select matched/unresolved evidence and selectors; all-excluded evidence
requires the full contract's unchanged/no-other-reason/no-owned-rule coupling.
Unchanged reference pairs contribute no inline evidence. Return no ignored ids,
owned resources or excluded resources, and no resource reasons. The result,
including omitted fields, ordering, owners, state/material, usage reasons and
evidence, must equal the full comparison using the **same** new parsing,
matching and derived-reference policies; earlier intentional policy changes
are not extra route exceptions.

## Fallback, Counters And Proof

Any failed condition returns prepared analysis/discovery for the full path;
do not publish a provisional owner set or partial evidence. The full path
remains the oracle with `useStylePath: false`. Test both resource modes and
all retained/excluded/owned/unresolved cases, usage-only input changes,
empty windows and format-only changes. Prove every named eligible cumulative
fixture view takes this route, not merely that a bystander increments a count.

For each fallback test prove the named view takes the full path: markup/tags,
attrs, multiple elements, `<` in/before a window, references crossing its edge,
changed transitive resources, text predicates, a parse failure in the edited
or an unchanged element, unequal topology,
missing usage and a window intersecting paired ignore/material-signal spans.
Also test accepted duplicate displacement across elements, subject to the same
reference/text-predicate guards and exact route/full equality.

The [timing counts](./mokly-timings.md#component-analysis-counts) increment
`stylePath` once for each view settled here; attempted fallback increments
`completePath` only when that view runs the full comparison. A successful quick
check increments `fastPath` instead. Counts are opt-in diagnostics only.
