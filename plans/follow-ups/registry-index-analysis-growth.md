# Registry index analysis grows faster than the text

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from finding 1 of the review of branch
  `calummoore/mokly-style-registry-index-h75s`. The second round of that
  review, on the same date, added the byte budget of its finding 4 and its
  finding 5, a repeat of finding 1.
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
  - `packages/mokly/src/sidecar/registry-index.ts:22`, `:29`, `:99`, and
    `:121`: `REGISTRY_TEXT_LIMIT`, `REGISTRY_OUTPUT_LIMIT`, and the `hold`
    calls that apply them. They limit the held texts and outputs by count,
    not by bytes.
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
  - A second review on 2026-11-23 found the copies of the same-name lists
    again, as a repeat of the problem of this item. Its finding check measured
    them on that date:
    - The copies at each insert into `named` took 0.9 ms for 1,000 rules of
      one name, and 10.7 ms for 4,000.
    - The first call for a new text took 27 ms with 1,000 `@font-face` rules
      of one family, and 285 ms with 4,000. `registryStyles` took 24 ms and
      21 ms at 4,000 rules.
    - With 1,000 `@font-face` rules of one family, the `uses` lists held
      1,001,000 entries.
  - React Native Web 0.21.3 writes no `@font-face` and no `@property` rule. It
    writes each keyframes name twice, as `@-webkit-keyframes` and as
    `@keyframes`. So its sheet cannot cause the k² growth of stored entries.
    The Style Collection section of `docs/protocol/mokly-sidecar.md` allows
    other registries, because it names "a persistent registry such as the
    React Native Web sheet".
  - An output is the filtered CSS of one call. The index holds it under a key
    that lists the rules that the output keeps. Each output is at most the
    size of the text, and its key takes a few characters for each kept rule.
    So the limits of 1 text and 64 outputs bound the outputs by count only.
    No doc sets a budget in bytes for the index, so options E, F, and G each
    need a budget value from the user.
  - On 2026-11-23 a measurement used the React Native Web registry text of
    the mokly-cloud catalogue, 12,821 characters. It counted each output as
    one flat string, as the sidecar holds it after it encodes the response.
    One index held about 0.33 MB with that text and one output. In a strict
    build of that catalogue, 1,557 distinct fragments gave only 2 distinct
    outputs of that text, and the index held about the same, 0.31 MB. With 64
    outputs that each hold almost the whole text, it held about 1.2 MB.
  - The finding check of the second review measured larger texts in the same
    way. 64 near-full outputs added about 1.6 MiB for a 20.5 KiB text, and
    about 10.6 MiB for a 163 KiB text. One held 163 KiB text took 3.4 MiB,
    and its parsed tree was 3.1 MiB of that. The binary recycles a sidecar
    above 1 GiB of resident memory, as `docs/protocol/mokly-sidecar-memory.md`
    says.
  - The entry of `styles.ts` in `packages/mokly/src/sidecar/README.md` states
    the bound of the index as a function of its text, with the sizes measured
    on the mokly-cloud text. A fix that changes the bound or the sizes updates
    that entry.
  - Options A, B, C, E, F, and G keep the output byte-equal to
    `registryStyles` on `main`. This comes from the goal "with the same
    output" of `plans/follow-ups/serve-edit-background-pass-split.md`, not
    from a protocol. The Style Collection section asks only for the "required
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
  text and 64 outputs do not cap these lists, and they bound the outputs by
  count, not by bytes.
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
  - **E.** Charge each held output and its key against a budget in bytes for
    the outputs. Evict the least recently used outputs until a new output
    fits. Give an output that alone passes the budget without holding it.
    This bounds only the outputs and their keys. So it goes with A or B,
    which fix the growth of the analysis. Effort: Small.
  - **F.** Widen the cap of A to one budget in bytes for the text, the parsed
    tree, the analysis, the keys, and the outputs. A text whose held
    structures pass the budget goes straight to `registryStyles`, through the
    mark of A. This bounds every structure that the index holds. A large
    registry that passes the budget loses the saving. Effort: Medium.
  - **G.** Hold no parsed tree, and keep the other held structures within a
    budget in bytes. For an output that the index does not hold, parse the
    text again and print the output from that tree. The parsed tree is most
    of what a held text costs. But each call that needs a new output then
    parses the text, as on `main`, so the cold path changes. Effort: Medium.
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
  - Append each rule to the list of its name, with no other change. It
    removes the copies at each insert. But each rule still stores the whole
    list of each name that it names, so it fails the goal.
  - Sort the dependency rules by name, and build the list of each name in one
    pass. It removes the copies at each insert, and the sort adds work for a
    text with few same-name rules. Each rule still stores the whole lists, so
    it fails the goal.
  - A lower output limit. One output can still reach the size of the text, so
    it gives no bound in bytes.
  - Flatten each output before the index holds it. The encoder of the
    response already flattens each output, so this saves nothing.
- **Wider fix:** F. Its one budget bounds every structure that the index
  holds, also a growth path that nobody has found yet. It widens A, whose cap
  counts every entry that the analysis stores and every check that it makes,
  so that A bounds any growth of the analysis. B must know each growth path,
  so it is a direct fix. The review first named B, and its finding check
  moved the wider fix to A. The finding check of the second review widened it
  to F.
- **Previous examples:** `0910565bf`, the registry index of 2026-11-22, has
  the same loops. `3e624480e` bounded retained memory in the CSS reference
  cache: `MemoryReferenceCache` in `crates/mokly-css/src/reference_cache.rs`
  keeps no scan whose charge passes its bound. `ExportNameCache.names` in
  `packages/mokly/src/sidecar/export-name-cache.ts` charges each entry
  against its capacity, and it gives an entry that passes the capacity
  without holding it.
- **Related:**
  - [serve-edit-background-pass-split.md](./serve-edit-background-pass-split.md)
    records C1, the registry index, with its measurements and the decision of
    2026-11-23 that brought it back for the cold start of Serve. The fix of
    this item changes the code that the section "C1 at the cold start,
    measured on 2026-11-23" of that item describes. So the fix also updates
    that section.
  - [registry-index-failed-analysis.md](./registry-index-failed-analysis.md):
    a shared mechanism. Its option A holds a marker for a text whose analysis
    throws, so that each later call sends that text straight to
    `registryStyles`. Options A and F of this item need the same marker for a
    text that passes the cap or the budget. Build the marker once, as one
    "use the direct filter" state of a held text.
  - [registry-text-failure-fails-renders.md](./registry-text-failure-fails-renders.md):
    the same code. That item asks how a registry rule that the filters cannot
    read affects the renders of its generation. Its options change both
    filters, as some options of this item do, and each change keeps the index
    byte-equal to `registryStyles`. Neither item waits for the other.
- **Recommendation:** B. It keeps the indexed path and its exact bytes, and it
  removes both growth paths and the repeated walk. F protects the codebase
  best, because its one budget bounds every structure that the index holds,
  but it needs a budget value from the user.
- **Action:** fix after merge, apply B, because B is a Medium product change
  for registries with hundreds of dependency names or same-name rules, which
  React Native Web does not write in practice, and a product change in branch
  `calummoore/mokly-style-registry-index-h75s` would void the official speed
  check of its final commit.
