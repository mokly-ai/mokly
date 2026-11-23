# One bad registry rule fails every render

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-23, from the finding check of finding 6 of the second
  round of the review of branch `calummoore/mokly-style-registry-index-h75s`.
  The check reported both problems outside the scope of that review.
- **Location:**
  - `packages/mokly/src/sidecar/registry-styles.ts:95`: the `postcss.parse`
    call of `registryStyles`, which throws for the whole registry text when
    one rule does not parse.
  - `packages/mokly/src/sidecar/registry-styles.ts:27`: the
    `String.fromCodePoint` call of `unescape`, which throws for a selector
    escape above U+10FFFF.
  - `packages/mokly/src/sidecar/registry-index.ts:135` and `:185`: the parse
    and the selector read of `indexText`, which the registry index runs on
    the same text.
  - `docs/protocol/mokly-sidecar.md`, the sections Style Collection and
    Fail-Closed Rules, which an option that changes the behaviour updates.
- **Reason:** Each fix changes behaviour that `main` has at the sidecar
  boundary, so it waits for the user, outside the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Style registry:** the CSS text that React Native Web accumulates across
    the renders of one generation. `collectStyles` in
    `packages/mokly/src/sidecar/styles.ts` filters it after each render.
  - **Generation:** an evaluated consumer bundle that a sidecar process uses
    for a series of renders.
  - **Fragment:** the HTML that one render gives. Its class tokens decide
    which registry rules the render keeps.
  - **Direct filter:** `registryStyles` in
    `packages/mokly/src/sidecar/registry-styles.ts`, which parses the style
    registry and keeps the rules that the fragment of one render uses.
  - **Registry index:** `RegistryIndex` in
    `packages/mokly/src/sidecar/registry-index.ts`, which caches the parse and
    the analysis of the style registry for each generation. It gives the same
    bytes or the same error as the direct filter.
- **Background:**
  - After each render, `collectStyles` filters the style registry with the
    registry index, which gives the result of the direct filter. When the
    filter throws, the render throws. `render` in
    `packages/mokly/src/sidecar/render.ts` then fails the request with
    `render-failed`, which the CLI presents as `build-invalid`.
  - The Style Collection section of `docs/protocol/mokly-sidecar.md` sets
    what the sidecar returns from the registry. It returns only the rules
    whose class selectors match the class tokens of the fragment. It also
    returns their required at-rules and keyframes, and the element-level
    resets of the registry. Unused rules are excluded. The section says
    nothing about a rule that does not parse.
  - The Fail-Closed Rules of the same page give `render-failed` when a render
    throws. They also say: "There is no fallback render and no partial
    output."
  - React Native Web 0.21.3 inserts the rules of a style when
    `StyleSheet.create` runs, before a render uses the style. Its sheet holds
    one rule on each line. The sheet of a generation only grows, so a rule
    stays in the text of every later render.
  - In a browser, React Native Web inserts each rule on its own, and it
    ignores a rule that the browser rejects. So one bad rule affects only
    that rule.
  - A probe on 2026-11-23 with React Native Web 0.21.3 wrote
    `fontFamily: '"Bar'` as `.r-fontFamily-10zvwaz{font-family:"Bar;}`.
    PostCSS failed on the whole sheet with a `CssSyntaxError` and the reason
    `Unclosed string`. Each other line of the sheet parsed on its own.
  - CSS Syntax Level 3 gives U+FFFD for an escape of zero, of a surrogate, or
    of a code point above U+10FFFF. `unescape` gives U+FFFD for zero, and it
    returns a lone surrogate for a surrogate. For `\110000` it throws
    `RangeError: Invalid code point 1114112`.
  - The direct filter reads the selectors of a rule only until one matches.
    So for `.a,.\110000{color:red}`, it returns the rule for a fragment with
    the class `a`, and it throws for a fragment without it. No React Native
    Web sheet holds a backslash.
  - For an authored stylesheet with a syntax error, the build fails with a
    message that names the stylesheet, the line, and the column, as
    `docs/protocol/mokly-imported-styles-errors.md` says. In the comparison
    analysis of `docs/protocol/mokly-css-attribution.md`, a parse failure
    never aborts the classification.
  - Both problems are also on `main`, because the direct filter is the filter
    of `main`. The registry index gives the same results.
- **Problem:** One style value with an unbalanced quote makes the whole
  registry text fail to parse. So every later render of its generation fails,
  also each render that does not use the style. A selector escape above
  U+10FFFF fails some renders, where CSS Syntax Level 3 reads the escape as
  U+FFFD.
- **Impact if no action:** One typing error in one style value fails every
  later render of its generation, in Serve and in a build. The error gives
  only a position in the registry text, so the author must search for the
  style.
- **Root question:** How should one registry rule that the filters cannot
  read affect the renders of its generation?
- **Options:**
  - **A.** Change nothing. One bad style keeps failing each later render of
    its generation, with an error that gives only a position in the registry
    text. An escape above U+10FFFF keeps failing some renders. Effort: Small.
  - **B.** Make `unescape` give U+FFFD for an escape of a surrogate or of a
    code point above U+10FFFF, as CSS Syntax Level 3 says. Both filters use
    `unescape`, so the registry index can then analyse such a text. This
    fixes only the escape case. A rule that does not parse still fails every
    render. Effort: Small.
  - **C.** Do B. For a rule that does not parse, keep the failure, but name
    the rule in the message, with its selector and its text. The author can
    then find the style at once. But every render of the generation still
    fails. Effort: Small.
  - **D.** Do B. When the registry text does not parse, skip the registry
    styles of the render, and send a warning as a `diagnostic` event in place
    of the failure. Every render of that generation then lacks every React
    Native Web style, so each page looks wrong, with only a warning. This
    changes the Style Collection section and the Fail-Closed Rules of
    `docs/protocol/mokly-sidecar.md`. Effort: Medium.
  - **E.** Do B. When the registry text does not parse, parse it again one
    line at a time, and drop each line that does not parse. Send a warning as
    a `diagnostic` event that names the dropped rule. Each render keeps every
    other style, as in a browser. A render that uses the dropped style shows the page without it,
    which can differ from a browser. This relies on the layout of React
    Native Web, one rule on each line. Both filters must drop the same lines,
    so that the index keeps the bytes of the direct filter. This changes the
    Style Collection section and the Fail-Closed Rules of
    `docs/protocol/mokly-sidecar.md`. Effort: Medium.
  - **F.** Do B. When the registry text does not parse, parse it again one
    line at a time, and set aside each line that does not parse. Fail only a
    render whose fragment matches the selector of a line that was set aside.
    Its message names the rule of that line. Each other render succeeds with
    every rule that it uses. When the selector of such a line cannot be read,
    each render fails, as now. This relies on the same layout as E. Both
    filters must set aside the same lines. This changes the Style Collection
    section of `docs/protocol/mokly-sidecar.md`. Effort: Medium.
- **Left out:**
  - A tolerant parse of the whole text, such as the `postcss-safe-parser`
    package. A probe on 2026-11-23 read `.r-1{font-family:"Bar;}`,
    `.r-2{color:red;}`, and `.r-3{font-family:"Foo";}`, on three lines, with
    the tokenizer of PostCSS and its `ignoreErrors` option. The unclosed quote
    paired with the next quote of the text, so `.r-2` became part of one
    string value. A render that uses `.r-2` then loses that rule with no
    error. So it breaks the rule of the Style Collection section that a render
    gets each rule that matches its fragment.
- **Wider fix:** F, and E in the same way. Each sets aside every rule that
  does not parse, whatever its cause. So one bad rule cannot fail a render
  that does not use it. B fixes only the escape case.
- **Previous examples:** None found.
- **Related:**
  - [registry-index-failed-analysis.md](./registry-index-failed-analysis.md):
    the same code. Its option F holds the `unescape` change of option B of
    this item, and a change of the parse of the index. If this item chooses
    B, the escape case of that item
    goes away. If it chooses E or F, the analysis of the index must also set
    aside the lines that do not parse, so that such a text no longer makes
    the analysis throw. Option A of that item does not wait for this answer.
  - [registry-index-analysis-growth.md](./registry-index-analysis-growth.md):
    the same code. Both items change the two filters, and each change keeps
    the index byte-equal to the direct filter. Neither item waits for the
    other.
- **Recommendation:** F. It fails only a render whose output would be wrong,
  names the bad style in the message, and lets every other render succeed.
- **Action:** ask the user, because F changes behaviour that the direct
  filter has on `main`. It changes the result for a rule that does not parse
  and for an escape above U+10FFFF. No requirement covers either case, and no
  recorded user decision covers the change.
