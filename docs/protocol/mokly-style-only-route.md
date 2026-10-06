# Component-aware Style-only Route

## Delivery Status

Implemented in [M8](../../plans/scalable-inline-style-analysis.md#milestone-8-style-only-route)
of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
including its differential test switch and `stylePath` counts.
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
   Link/move normalization, when present, must prove that equal original text
   has equal link material on both sides, using the
   [metadata-only proof](./mokly-page-analysis.md#identical-text-quick-check).
   A missing proof takes full comparison: a moved target's old path can be
   reused by a different entry while the link's written bytes stay unchanged.
2. Texts are unequal. Compute their longest common UTF-16 prefix, then their
   longest common suffix without overlapping that prefix on either side.
   What remains is exactly one changed window per side; either may be empty.
3. The head analysis locates one eligible unowned style element whose **content
   span**, not tag/outer span, wholly contains the head window. The corresponding
   base window is in the same element, with unchanged start/end tags and attrs.
   The windows are disjoint from paired ignore regions and material-signal
   spans; validation and the existing one-sided-material rule still apply.
   Fall back when any paired ignore region, including either of its markers,
   intersects any eligible unowned style's outer span on either side. Also
   fall back for any `<!--mokly-review-` substring in an eligible style's
   start-tag or end-tag text. These checks include unchanged elements and
   preserve full material normalization and validation after style removal.
4. Neither window contains `<`, nor do the up-to-eight code units immediately
   before either window. Check actual code units, not serialized selectors or
   a decoded string. This rules out a partial raw-text end-tag transition at
   the start; empty insertion/deletion windows use the same guard.
   When link normalization is present, fall back if the original parse leaves
   SVG or MathML open at EOF: the full path's appended style can acquire foreign
   entity decoding. The safe raw-text window proves equal EOF structure on both
   sides, so the head's existing parse proves this without a second parse.
5. Both complete eligible-unowned rule lists resolve under the full path's
   parse-reuse policy, including unchanged other style elements. Reuse their
   runs and compute the **view-wide** diff/cancellation with original ordinals,
   not an independent diff of just the edited element. Every added/removed/changed
   rule is reference-free by its **stored full-rule references**, not a search
   only in the window. No resolved selector of those rules uses a pseudo-class
   that the matcher evaluates from child content: `:empty`, `:parent`
   (`:not(:empty)`), `:contains` or `:icontains`, including inside functional
   selectors or resolved nesting parents. Literal attribute/string values with
   those words do not count. A selector compilation failure remains unresolved
   under the closed keep policy, not a proof of exclusion.
   Also take full fallback when the reserved substring `<!--mokly-` occurs in
   any eligible element's original content on either side, or in any composed
   canonical actual/projected material on either side. Check composed text
   because serialization can produce the spelling from a CSS string escape
   such as `\3c !--mokly-component:`. The prefix covers component, ignore,
   material and inline-fingerprint markers, preserving full-path normalization
   and validation. Ordinary `mokly` text is allowed.
6. The edited element's raw reference values from `extractCssReferences`
   must be identical on both sides, including their order and multiplicity.
   Stored rule references omit selectors; the raw detector can find `url()`
   inside selector arguments, so reference-free rule deltas alone do not prove
   equal raw seeds. The quick check's resource proof then passes using the
   head analysis's shared raw reference seeds. In committed mode traverse only the **head reader's
   closure** and require no changed reachable Git path. In derived mode
   traverse both readers independently, reject changed reachable paths and
   require equal closure membership and bytes. These are transitive checks,
   not seed-path checks; a union cannot replace the derived comparisons.
   Traverse the base proof closure with optional reads at every depth. Any
   missing seed or transitive file fails the proof and takes fallback, never a
   required-read error from the optimization. Reuse successful reads/closures;
   a failed proof cannot cache a partial closure as complete or replace the
   full path's own required-read diagnostic with a cached absence.
   Prove those shared seeds cover the stored references of the canonical
   rules as well. A source record touching a paired ignore span can be dropped
   while inline canonicalization retains its rule reference. Missing seed
   coverage fails the conservative source/span proof and takes full fallback;
   do not infer resource safety from the incomplete closure or add a second
   discovery policy.

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

All changed rules lack stored references, while unchanged reference-bearing
rules have identical values. Equal raw references in the edited element also
cover selector-argument URLs that stored rule references omit. Missing base
files fail the optional proof at any graph depth, before required traversal. The shared seed proof is conservative over potential
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
remains the oracle with `useStylePath: false`; a complete-path oracle disables
both `useStylePath` and `useFastPath`. This section owns M8's test obligations:

- Compare route-enabled and disabled results in committed and derived modes
  for excluded, owned, entry-retained and unresolved diffed rules, and an
  entry-owned usage input change. Assert the named view's route, not a
  catalogue-wide counter satisfied by a bystander. Prove every eligible view
  of the small cumulative component-style fixture takes this route.
- Positive cases include an adjacent **unchanged** reference-bearing rule,
  a window ending at `</style>` (the `<` is in the suffix, not the window),
  empty insertion/deletion windows, and format-only edits. All still satisfy
  the reference, prefix and resource guards.
- For each fallback prove the named view takes the full path: markup/tags,
  attrs, multiple edited elements; **a `<` in or up to eight code units before
  a window; a reference in a diffed rule, including one crossing the window
  edge**; changed transitive resources; every child-content pseudo above,
  explicitly `style:parent ~ main`, also inside functions/nesting parents;
  a parse failure in the edited or an unchanged element; unequal topology,
  missing usage; or a window intersecting paired ignore/material-signal spans.
  Also cover an unchanged reference whose style-text source span touches a
  paired ignore but whose canonical rule retains the reference: require full
  fallback and unchanged resource evidence.
- Require full fallback and route-disabled equality, per view in both modes,
  for component-marker string edits (`r-10`/`r-20`), review-ignore start/end
  lookalikes, material signals, an escaped `\3c !--mokly-component:` spelling
  present only in composed text, inline-fingerprint lookalikes, and a lookalike
  in an unchanged eligible element. An ordinary sheet containing `mokly` without
  the reserved prefix must still route. Reuse prepared runs and safe diff
  attribution on fallback; unchanged reference pairs retain two-tree matching
  when their child-content selectors can distinguish the two texts.
  Also preserve full-path validation failure when an eligible style's tags
  contain one or both ignore boundaries and removal leaves a lone boundary or
  a material signal without its region. Cover paired regions inside content,
  across styles and in tag attributes, including an unchanged eligible element.
  Prove both original sides reach the full path without counting a failed view
  as completed. Test the base-only raw-end-tag and plain `<` cases, attribute
  edits beyond the eight-code-unit guard, and each original/composed prefix
  guard independently. Selector failures `&`, `:is()` and `:where()` retain
  unresolved evidence on the route. Assert exact production path counts for
  the cumulative fixture and a mixed routed/fallback batch.
- Run seeded single-window edits on real React Native Web sheets, including
  marker lookalikes. Assert each view's path and exact route-disabled result
  equality whenever the route is taken; print the seed on failure.
- Include grouped/nested duplicate displacement across differently shaped
  runs/elements under the cancellation contract. Require route/full equality
  when guards pass, and full fallback for reference-bearing diffed variants.
  Never decide from an independent changed-element-only diff.

The [timing counts](./mokly-timings.md#component-analysis-counts) increment
`stylePath` once for each view settled here; attempted fallback increments
`completePath` only when that view runs the full comparison. A successful quick
check increments `fastPath` instead. Counts are opt-in diagnostics only.
