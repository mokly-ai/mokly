# Decide the value of a CSS import with type css

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The options check of its decision C2 found the problem on
  2026-11-18.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:159-178`.
- **Reason:** The CSS route of the bundle is outside the asset loading part
  that track C may change, and each fix adds a requirement or an error for
  the user to review.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **CSS module script:** a browser feature. An import of a `.css` file
    with `{ type: "css" }` gives a `CSSStyleSheet` object. Code adopts that
    object into a document or a shadow root.
  - **Document stylesheet:** a stylesheet that Mokly bundles and links from
    the head of each document that renders the importing entry, under
    `docs/protocol/mokly-imported-styles.md`.
- **Background:**
  - The resolve hook at `plugins.ts:159-178` sends each import that ends in
    `.css` to Mokly's stylesheet pipeline. It does not read the import
    attributes.
  - A plain `.css` import gives an empty default export, and its CSS
    reaches the document as a document stylesheet.
  - esbuild supports only the attribute types `json`, `text`, and `bytes`.
    It rejects `type: "css"`.
  - No protocol doc says what Mokly does with a CSS module script.
- **Problem:** An import of `./x.css` with `{ type: "css" }` builds in
  Mokly and gives an empty object, but the same import fails in esbuild.
  The component never gets a `CSSStyleSheet`.
- **Impact if no action:** The styles of such a component show through the
  document stylesheet, but code that reads the sheet gets an empty object.
  The behaviour has no requirement, so a later change can break it without
  notice.
- **Root question:** What does Mokly give a component that imports a
  stylesheet as a CSS module script?
- **Options:**
  - **A.** Keep the behaviour, and state it in
    `docs/protocol/mokly-imported-styles.md`: the CSS reaches the document
    as a document stylesheet, and the value is an empty object. Effort:
    Small.
  - **B.** Fail such an import with a `bundle-failed` message, as esbuild
    does. This is a new build error. Effort: Small.
  - **C.** Give the import an object that holds the CSS text of the sheet,
    and still link the document stylesheet. Code that reads the sheet then
    gets its rules. Effort: Medium.
- **Left out:** A real `CSSStyleSheet`: Mokly renders in Node, which has no
  CSS object model.
- **Wider fix:** None. Each option settles the one attribute type that
  esbuild rejects.
- **Previous examples:** None found.
- **Related:** Decision C2 of the Storybook support plan, open on
  2026-11-20, asks which wins when an import names its type: the attribute,
  or a rule for its file extension. Its option D gives a `.css` import with
  a `json`, `text`, or `bytes` attribute that value and no stylesheet.
  Option D does not cover `type: "css"`, so no option of C1 or C2 covers
  this problem.
- **Recommendation:** A. The styles still show, the build does not fail,
  and the protocol tells authors what the value is.
- **Action:** ask the user, because A adds a requirement that no protocol
  doc states, and B adds a build error.
