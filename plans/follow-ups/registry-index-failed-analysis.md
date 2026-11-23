# Failed registry analysis repeats on every render

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from finding 6 of the second round of the review of
  branch `calummoore/mokly-style-registry-index-h75s`.
- **Location:**
  - `packages/mokly/src/sidecar/registry-index.ts:118`: the `catch` of
    `RegistryIndex.indexed`, which returns without holding the text.
  - `packages/mokly/src/sidecar/registry-index.ts:89`: the call of
    `registryStyles` in `RegistryIndex.styles` for a text that `indexed` does
    not give.
  - `packages/mokly/src/sidecar/registry-index.ts:70` to `:72`: the class
    comment of `RegistryIndex`, which describes the repeat.
- **Reason:** A product change would void the official speed check of branch
  `calummoore/mokly-style-registry-index-h75s`, and React Native Web renders
  that take this path fail anyway.

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
  - **Analysis:** the work of `indexText` in `registry-index.ts`, which parses
    a registry text and records the class names of every selector and the
    dependency rules that each rule names.
  - **Direct filter:** `registryStyles` in
    `packages/mokly/src/sidecar/registry-styles.ts`, the filter of `main`,
    which parses the registry text on each call.
- **Background:**
  - After each render, `collectStyles` filters the style registry with
    `RegistryIndex.styles`. The filter keeps the rules that the fragment of
    the render uses. The fragment is the HTML that the render gives.
    `RegistryIndex.styles` asks `indexed` for the held analysis of the text,
    or for a new one.
  - `indexed` runs the analysis inside a `try`. When the analysis throws,
    `indexed` returns nothing, and `styles` calls the direct filter. So each
    fragment gets the output or the error of the direct filter, as on `main`.
  - Two kinds of text make the analysis throw. A text that does not parse
    makes `postcss.parse` throw a `CssSyntaxError`. A selector escape above
    U+10FFFF, as in `.a,.\110000{color:red}`, makes `unescape` in
    `registry-styles.ts` throw `RangeError: Invalid code point 1114112`. The
    analysis reads the class names of every selector, so it always meets the
    escape.
  - The direct filter reads the selectors of a rule only until one matches.
    So for `.a,.\110000{color:red}`, it returns the rule for a fragment with
    the class `a`, and it throws the `RangeError` for a fragment without it.
    For a text that does not parse, it throws the same `CssSyntaxError` as
    the analysis.
  - The test "the index uses registryStyles when registry analysis or parsing
    throws" in `tests/sidecar_registry_index_edge_cases.test.ts` compares the
    results for both kinds of text with the direct filter. It does not count
    the parses.
  - React Native Web 0.21.3 writes no backslash in its sheet, so its texts
    hold no escape. A React Native Web text that does not parse already fails
    every render on `main`, because the direct filter throws. So the repeat
    costs time only on paths that fail anyway or that React Native Web does
    not take.
  - The section "C1 at the cold start, measured on 2026-11-23" of
    `plans/follow-ups/serve-edit-background-pass-split.md` describes the
    repeat under "What came back". A fix updates that text and the class
    comment of `RegistryIndex`.
- **Problem:** The index does not hold a text whose analysis throws. So each
  call with that text runs the analysis, with its parse, and then the direct
  filter, which parses the text a second time. `main` parses it once. A probe
  counted 6 `postcss.parse` calls for 3 calls with `.a,.\110000{color:red}`.
- **Impact if no action:** Each render with such a text parses the registry
  twice and repeats an analysis that already failed. So it takes longer than
  on `main`.
- **Root question:** How can a text that the index cannot analyse cost each
  render no more than the direct filter alone costs on `main`, while each
  fragment still gets the output or the error of the direct filter?
- **Options:**
  - **A.** Hold a fallback marker in the text slot when the analysis throws.
    Each later call with that text then goes straight to the direct filter,
    with one parse, as on `main`. The first call still parses twice. The
    marker uses the one text slot, so the text limit applies to it, and a new
    text replaces it. Effort: Small.
  - **B.** Share one parsed tree between the analysis and the direct filter.
    When the analysis throws after the parse, the direct filter reads that
    tree. So no call parses twice, also the first one. The direct filter
    then takes a parsed tree, and the change must keep the order of its
    errors. Without a marker as in A, each later call still runs the
    analysis again. Effort: Medium.
  - **C.** Build the cache while the direct filter visits the selectors and
    the dependency rules of each call, in place of the analysis before the
    first call. The index then reads only what the direct filter reads, so it
    throws only where the direct filter throws. This rewrites both filters.
    Effort: Large.
  - **D.** Parse outside the `try` of `indexed`, and let a parse error
    propagate. A text that does not parse then costs one parse on each call,
    and it gives the same `CssSyntaxError` as the direct filter. The escape
    case still parses twice on each call. Effort: Small.
  - **E.** Hold one failure flag for the whole generation. After the first
    analysis that throws, each later call of that generation goes to the
    direct filter, for any text. The React Native Web sheet only grows, so
    its later texts keep the rule that failed. But a registry that changes in
    other ways also loses the saving for texts that the index can analyse.
    Effort: Small.
  - **F.** Make `unescape` give U+FFFD for an escape above U+10FFFF, as CSS
    Syntax Level 3 says, and do D. Then no known text makes the analysis
    throw after its parse. This changes the result of the direct filter on
    `main`: a render that failed with the `RangeError` then succeeds. So it
    needs the user's approval. Effort: Small.
  - **G.** Do D, and also hold the parse error of a text that does not parse.
    Each later call with that text then throws the held error with no parse.
    The escape case still parses twice on each call. Effort: Small.
- **Left out:**
  - Hold the CSS or the error of a call under the text alone. It can give
    the result of one fragment to another fragment, so it breaks the rule
    that each fragment gets the result of the direct filter.
  - Change nothing. Each call with such a text keeps its two parses, so it
    fails the goal.
- **Wider fix:** B. One shared parse removes the extra parse for every cause
  of a failed analysis, also on the first call and for a cause that nobody
  has found yet.
- **Previous examples:** `0910565bf`, the registry index of 2026-11-22, has
  the same `catch`. As an example of the fix, `ServeEditPaths.scope` in
  `packages/mokly/src/sidecar/serve-edit-paths.ts:104` holds a `null` outcome
  of a scope lookup, so that later calls reuse that outcome.
- **Related:**
  - [registry-index-analysis-growth.md](./registry-index-analysis-growth.md):
    a shared mechanism. Its options A and F send a text that passes a cap or
    a budget straight to `registryStyles`, through a mark of the held text.
    Option A of this item needs the same marker. Build the marker once, as
    one "use the direct filter" state of a held text.
  - [registry-text-failure-fails-renders.md](./registry-text-failure-fails-renders.md):
    the same code. That item asks how a registry rule that the filters cannot
    read affects the renders of its generation. If it chooses U+FFFD for the
    escape, the escape case of this item goes away, and option F of this item
    becomes part of that choice. Option A of this item does not wait for its
    answer.
- **Recommendation:** A. It removes the repeated analysis and the second
  parse from each later call with a small change, and the direct filter
  stays responsible for each result. B protects the codebase best, because
  one shared parse removes the extra parse for every cause of a failed
  analysis.
- **Action:** fix after merge, apply A, because A changes product code, which
  would void the official speed check of the final commit of branch
  `calummoore/mokly-style-registry-index-h75s`. The extra cost also does not
  matter with React Native Web sheets: a sheet that does not parse fails
  every render, as on `main`, and those sheets hold no backslash.
