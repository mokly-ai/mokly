# Accept standard hyphenated SVG and MathML names

- **Severity:** Medium (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the HTML pipeline decision work of
  2026-10-26.
- **Location:** `crates/mokly-catalogue/src/templates.rs:163-172` and
  `docs/protocol/mokly-html-screens.md:76-81`.
- **Reason:** The review found the problem outside its change, and each fix
  adds an exception to a protocol rule, which needs the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Component registry:** the element names of the catalogue's HTML and
    JavaScript components, which the template checks resolve.
- **Background:**
  - `docs/protocol/mokly-html-screens.md:76-81` says that a hyphenated
    element name resolves against the component registry. An unknown
    hyphenated name fails with `html-element`, because plain rendering would
    lose the component.
  - `templates.rs:163-172` applies that rule. It fails a hyphenated name
    that is not a `mokly-` name and not a registered component, with the
    message "unknown element {name}".
  - The HTML standard reserves eight hyphenated names for SVG and MathML
    elements: `annotation-xml`, `color-profile`, `font-face`,
    `font-face-src`, `font-face-uri`, `font-face-format`, `font-face-name`,
    and `missing-glyph`. They can never be custom element names.
- **Problem:** A screen with inline MathML that uses `annotation-xml`, or
  inline SVG that uses one of the other names, fails as an unknown element.
  No component is missing in that case.
- **Impact if no action:** Valid inline SVG and MathML cannot render. The
  author must remove standard markup.
- **Root question:** How does the unknown-element check catch a missing
  component without rejecting standard markup?
- **Options:**
  - **A.** Accept the eight names that the HTML standard reserves, and state
    the exception in the protocol. Effort: Small.
  - **B.** Accept a hyphenated name only inside an SVG or MathML subtree, as
    the tree builder's namespace shows. Effort: Medium (estimate).
  - **C.** Keep the rule, and state in the protocol that these names fail.
    Effort: Small.
- **Left out:** Accept every unknown hyphenated name. It loses the check for
  a missing component, which is the reason for the rule.
- **Wider fix:** A. The standard list is fixed, so one exception covers the
  whole class.
- **Previous examples:** Before the one-tokenizer change of 2026-10-26, a
  separate token pass missed SVG `desc` and encoded MathML `annotation-xml`
  as integration points. That change resolved it.
- **Recommendation:** A (estimate). It follows the HTML standard and keeps
  the check for missing components.
- **Action:** ask the user, because condition 1 holds (estimate): A and B
  add an exception to the protocol rule that every unknown hyphenated name
  fails.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5664).
