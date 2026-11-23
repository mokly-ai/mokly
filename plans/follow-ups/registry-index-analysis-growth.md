# Registry index analysis grows faster than the text

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from finding 1 of the review of branch
  `calummoore/mokly-style-registry-index-h75s`.
- **Location:**
  - `packages/mokly/src/sidecar/registry-index.ts:163` and `:167`: the name
    map `named` of `indexText`, which copies the whole list of a name at each
    insert.
  - `packages/mokly/src/sidecar/registry-index.ts:170`: `uses` of
    `indexText`, which copies into each rule the rule lists of the names that
    the rule names.
  - `packages/mokly/src/sidecar/registry-index.ts:201`: the `var(` scan of
    `namedNodes`, which checks a value against every dependency name.
  - `packages/mokly/src/sidecar/registry-index.ts:218`: the walk of
    `neededNodes`, which reads the stored list of each rule that a render
    reaches.
- **Reason:** The measured React Native Web registry gives a small index, and
  a product change in branch `calummoore/mokly-style-registry-index-h75s`
  would void the official speed check of its final commit.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Style registry:** the CSS text that React Native Web accumulates across
    the renders of one generation, which `collectStyles` in
    `packages/mokly/src/sidecar/styles.ts` filters after each render.
  - **Generation:** an evaluated consumer bundle that a sidecar process uses
    for a series of renders.
  - **Registry index:** `RegistryIndex` in
    `packages/mokly/src/sidecar/registry-index.ts`, one for each generation,
    which holds the parsed tree, the analysis, and the outputs of at most one
    registry text.
  - **Dependency rule:** a `@keyframes`, `@font-face`, or `@property` rule,
    which the filter keeps only when a kept declaration names it by its
    dependency name.
  - **Analysis:** the work of `indexText`, which parses a registry text and
    records, for each rule, every dependency rule that its declaration values
    name.
- **Background:**
  - After each render, `collectStyles` filters the style registry with the
    registry index of the generation. A call keeps the selector rules that
    match the class tokens of the fragment and every dependency rule that they
    name. For a text whose analysis throws, the index calls `registryStyles`
    in `packages/mokly/src/sidecar/registry-styles.ts`, the filter without an
    index.
  - The analysis of a text runs before the index matches any fragment. A
    render then starts at its matched selector rules. In `neededNodes`, it
    walks the stored list of each rule that it reaches.
  - The dependency name of a rule is its keyframes name, its property name, or
    the font family of a `@font-face` rule. `dependencyName` in
    `registry-styles.ts` gives it.
  - A declaration value names a dependency rule in one of two ways, as in
    `registryStyles`. A word of the value equals the dependency name. Or the
    value holds `var(` directly followed by the name, as `namesVariable` in
    `registry-styles.ts` tests. This second way matches a prefix, so
    `var(--size-extra,2px)` also names `@property --size`.
  - The name map `named` holds the rule list of each dependency name. Each
    insert copies the whole list of its name, so k rules with one name cost
    about k²/2 copies while the analysis runs.
  - Two sizes show the growth. 1,000 distinct `var()` values and 1,000
    animation names make one million name checks, also when no fragment uses
    them. 1,000 `@font-face` rules of one family store one million entries,
    because each rule that names the family stores the list of all 1,000
    rules.
  - A read of the code and a run show the cost. At these sizes, the analysis
    takes about 40 ms and keeps about 5 MiB of lists while the index holds the
    text. The review graded the severity Medium. Its finding check lowered it
    to Low, because the defect costs little.
  - React Native Web 0.21.3 writes no `@font-face` and no `@property` rule. It
    writes each keyframes name twice, as `@-webkit-keyframes` and as
    `@keyframes`. So its sheet cannot cause the k² growth of stored entries.
    The Style Collection section of `docs/protocol/mokly-sidecar.md` allows
    other registries, because it names "a persistent registry such as the
    React Native Web sheet".
  - On 2026-11-23 the React Native Web registry text of the mokly-cloud
    catalogue, 12,821 characters, gave an index of about 0.37 MB with its text
    and one output. In a strict build of that catalogue, 1,557 distinct
    fragments gave only 2 distinct outputs of that text.
  - Options A, B, and C keep the output byte-equal to `registryStyles` on
    `main`. This comes from the goal "with the same output" of
    `plans/follow-ups/serve-edit-background-pass-split.md`, not from a
    protocol. The Style Collection section asks only for the "required
    at-rules and keyframes", and it says that unused rules are excluded. So
    the prefix rule is not a requirement.
  - `tests/sidecar_registry_index_edge_cases.test.ts` compares the index with
    `registryStyles` over 128 generated registry texts.
    `tests/sidecar_registry_index_bounds.test.ts` tests the text and output
    limits.
- **Problem:** The analysis checks each declaration value that contains
  `var(` against every dependency name. For each rule, it also stores a copy
  of the full rule list of each name that the rule names. So k rules with one
  name cost about k² stored entries, and each render that reaches them walks
  those entries again.
- **Impact if no action:** A large registry can slow its first render and
  keep much memory in lists that grow faster than its text. The limits of 1
  text and 64 outputs do not cap these lists.
- **Root question:** How can the index keep its saving for each render, while
  its build time, its retained memory, and its walk for each render grow
  about linearly with the registry text?
- **Options:**
  - **A.** Cap the checks and the stored entries of the analysis. The cap
    counts every check that the analysis makes and every entry that it
    stores. When a text reaches the cap, the index marks it, so that each
    later call sends it straight to `registryStyles`. A large registry that
    reaches the cap loses that saving. Effort: Small.
  - **B.** Store one rule list for each dependency name, in place of a copy in
    each rule that names it. Build each list in place, with no copy at each
    insert. Find the names of a `var(` value with a prefix lookup that keeps
    the prefix rule of `namesVariable`. A render visits each name that it
    reaches once. The output bytes do not change. Effort: Medium.
  - **C.** Cache the outputs by the set of matched selector rules. Resolve the
    dependency rules on the held parsed tree only when that set has no cached
    output. This moves more work to the first render of each distinct set.
    Effort: Medium.
  - **D.** Do B, but drop its prefix lookup. Change the shared `var(` rule of
    both filters, `namesVariable` in
    `packages/mokly/src/sidecar/registry-styles.ts`, so that
    `var(--size-extra,2px)` names only `--size-extra`. The index then looks up
    one name for each `var(`. The published CSS then drops a rule whose name
    is only a prefix of a used variable, such as `@property --size`, which
    `main` keeps. This changes behaviour that is on `main`, so it needs the
    user's approval and a new byte proof. Effort: Medium.
- **Left out:**
  - Fewer outputs. Both costs stay inside the one held registry text, so it
    fails the goal.
  - Change nothing. A React Native Web registry can still hold many keyframes
    names and many `var()` values, and the build cost grows with their
    product. So it fails the goal.
  - The `var(` rule only for names that start with `--`. A registry with many
    `@property` rules still gets the full scan, so it fails the goal.
  - One shared array for rules with equal lists. Each render still walks the
    shared array once for each rule that it reaches, so it fails the goal.
- **Wider fix:** A, when its cap counts every entry that the analysis stores
  and every check that it makes. Such a cap bounds any growth of the analysis.
  B must know each growth path, so it is a direct fix. The review first named
  B, and its finding check moved the wider fix to A.
- **Previous examples:** `0910565bf`, the registry index of 2026-11-22, has
  the same loops. `3e624480e` bounded retained memory in the CSS reference
  cache: `MemoryReferenceCache` in `crates/mokly-css/src/reference_cache.rs`
  keeps no scan whose charge passes its bound.
- **Related:**
  [serve-edit-background-pass-split.md](./serve-edit-background-pass-split.md)
  records C1, the registry index, with its measurements and the decision of
  2026-11-23 that brought it back for the cold start of Serve. The fix of this
  item changes the code that the section "C1 at the cold start, measured on
  2026-11-23" of that item describes. So the fix also updates that section.
- **Recommendation:** B. It keeps the indexed path and its exact bytes, and it
  removes both growth paths and the repeated walk. A protects the codebase
  best, because its cap also bounds a growth path that nobody has found yet.
- **Action:** fix after merge, apply B, because B is a Medium product change
  for registries with hundreds of dependency names or same-name rules, which
  React Native Web does not write in practice, and a product change in branch
  `calummoore/mokly-style-registry-index-h75s` would void the official speed
  check of its final commit.
