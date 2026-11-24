# Decide which attributes are resource references

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: review finding 6 of round 2.
- **Location:** `crates/mokly-graph/src/references.rs:183`,
  `crates/mokly-compare/src/material.rs:126`,
  `docs/protocol/mokly-comparison.md:107-111`, and
  `docs/protocol/mokly-public-closure.md:45-50`.
- **Reason:** The fix changes how existing catalogues validate and compare
  attributes, in shared code and pages outside the files of that branch.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Resource reference:** a URL whose target the referenced closure checks
    and whose bytes Changes compares between the base commit and the working
    tree.
  - **Referenced closure:** the check of `docs/protocol/mokly-public-closure.md`
    that resolves each reference of a document and fails a missing target.
- **Background:**
  - One reader, `element_references` in `crates/mokly-graph/src/references.rs`,
    decides which attributes are resource references for the closure and for
    Changes. It reads `data` on every element, `xlink:href`, and
    `data-nav-href`, besides `src`, `href`, `srcset`, `poster`, and `url()`.
  - `crates/mokly-compare/src/material.rs:126` also reads `data` as a URL on
    every element.
  - `docs/protocol/mokly-comparison.md` and
    `docs/protocol/mokly-public-closure.md` list the positions without
    `data` and `xlink:href`, and the comparison list also leaves out
    `data-nav-href`, which `docs/protocol/mokly-navigation.md` calls
    metadata-only.
  - Since 2026-11-21, `docs/protocol/mokly-imported-assets.md` links the
    comparison resource rule and copies no list.
- **Problem:** A PDF-only edit marks a page with `<object data>` and a page
  with `<p data>` as changed, but only the object loads the PDF. A
  `<p data="hello">` in an HTML screen fails `mokly build` with
  `missing target hello`. The protocol pages state neither behaviour.
- **Impact if no action:** Changes can list pages that do not render a changed
  file, a plain `data` value fails a build, and the protocol does not explain
  either result.
- **Root question:** Which element and attribute positions count as resource
  references, for the referenced closure and for Changes, and which one
  protocol section states them?
- **Options:**
  - **A.** Document `data` as a reference on every element, and keep the
    current results. Effort: Small.
  - **B.** Count `data` as a reference on `<object>` only. Keep the other link
    forms. State the rule once in the comparison resource rule. Change the
    `material.rs` list to match. Effort: Medium.
  - **C.** B, and let authors declare other attributes that load resources.
    This adds an authoring API. Effort: Large.
  - **E.** Keep the behaviour, and state the positions once in the comparison
    resource rule: `data`, `xlink:href`, and `data-nav-href` on every element.
    The closure page links that rule. A `data` value that is not a URL then
    fails the build by contract. Effort: Small.
  - **F.** One table of elements and attributes in `mokly-graph`, which the
    reference reader and the material comparison share: `data` only on
    `<object>`, `srcdoc` only on `<iframe>`, and `src`, `href`, `xlink:href`,
    `srcset`, and `poster` on every element. The comparison rule states it
    once. Effort: Medium.
  - **G.** B, and give link positions, such as `<a href>` and
    `data-nav-href`, delivery without Changes evidence, as `preload` hints
    have today. A page that only links to a changed file then leaves Changes.
    Effort: Medium.
- **Left out:**
  - Ignore all `data` attributes: this loses `<object data>`.
  - A soft `data` position that gives evidence only when its value names a
    file: evidence would depend on chance, and a missing referenced file must
    fail.
  - Limit `src` and the other attributes to their HTML elements: custom
    elements load files from them.
- **Wider fix:** F. One shared table decides by element and attribute, so the
  next attribute that only one element loads needs no new copy of the list.
- **Previous examples:** The unqualified `data` rule dates to commit
  `d935e6a6`. `crates/mokly-compare/src/css_documents.rs:63` already reads
  `data` only on `<object>`.
- **Recommendation:** B. It keeps PDF changes visible where a page loads the
  PDF, and it ends the build failure for plain `data` values. F protects the
  codebase best.
- **Action:** ask the user, because B changes how existing catalogues validate
  and compare `data` attributes on other elements.
