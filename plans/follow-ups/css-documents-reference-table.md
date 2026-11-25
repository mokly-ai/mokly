# Stylesheet reader reads srcdoc outside iframes

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 1, finding 2.
- **Location:** `crates/mokly-compare/src/css_documents.rs:51-62`, and `kind`
  in `crates/mokly-graph/src/reference_positions.rs`.
- **Reason:** The workspace brief limited the branch to named files, and
  `crates/mokly-compare/src/css_documents.rs` is not one of them.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Changes:** the Mokly view that lists the differences between the
    working catalogue and its base commit.
  - **Stylesheet reader:** `collect` in
    `crates/mokly-compare/src/css_documents.rs`, which finds the documents in
    which Changes matches the rules of each linked stylesheet.
  - **Shared reference table:** `kind` in
    `crates/mokly-graph/src/reference_positions.rs`, which says whether an
    element and an attribute hold a URL, a `srcset`, or an embedded document.
  - **Embedded document:** the HTML document in the `srcdoc` attribute of an
    `<iframe>`.
  - **Linked document:** an HTML file that `<iframe src>`, `<embed src>`, or
    `<object data>` loads.
- **Background:**
  - Changes matches the changed rules of a linked stylesheet in each
    document where the stylesheet applies, under
    `docs/protocol/mokly-css-attribution-rules.md`. A changed rule that
    matches nothing in a view gives only excluded evidence, which changes no
    view, under `docs/protocol/mokly-comparison.md#style-ownership`.
  - The stylesheet reader starts at the composed document. It adds each
    embedded document and each linked document, and it reads the
    stylesheets that each one links.
  - At lines 51-62, for an `<iframe>`, `<object>`, or `<embed>` with a
    `srcdoc` attribute, the reader parses the `srcdoc` value as an embedded
    document. Then it skips the element with `continue`, so it never reads
    `data` or `src` of that element.
  - At lines 63-87, it reads `data` on `<object>` and `src` on `<iframe>`
    and `<embed>`. When that URL names an `.html` or `.htm` file, it parses
    the file.
  - HTML defines `srcdoc` only on `<iframe>`. A browser shows the file at
    `data` of an `<object>` and at `src` of an `<embed>`, and it ignores a
    `srcdoc` attribute on them.
  - On 2026-11-25 the user chose one table of elements and attributes in
    `mokly-graph`, which the reference reader of the closure and the
    canonical form of Changes share. It gives `data` only on `<object>`,
    `srcdoc` only on `<iframe>`, and `src`, `href`, `xlink:href`, `srcset`,
    and `poster` on every element.
    `docs/protocol/mokly-comparison.md#resources` states the table.
  - The branch `calummoore/storybook-asset-follow-ups-cibm` made the table
    exclude `href` on `<base>`. It also made the asset base check in
    `crates/mokly-graph/src/asset_tokens.rs` read the table. The stylesheet
    reader does not read it.
- **Problem:** On an `<object>` with both `data` and `srcdoc`, the stylesheet
  reader parses the `srcdoc` text and never reads the document at `data`,
  which the browser shows. An `<embed>` with `srcdoc` and `src` has the same
  problem.
- **Screenshot:** In Changes, after an edit to a stylesheet that only the
  document at the `data` URL of the object links, the box marks where the
  missing page should appear. The review captured no picture.
- **Impact if no action:** Changes can miss an edit to a stylesheet that only
  that document links, so the page does not appear in Changes. Rules that
  match the unused `srcdoc` text can also count for a view that never shows
  them.
- **Root question:** How does the stylesheet reader of Changes read the
  document that the browser shows in each embedding element?
- **Options:**
  - **A.** Take the `srcdoc` branch only when the shared reference table
    gives `EmbeddedDocument` for the element and `srcdoc`. Keep the
    element-specific `data` and `src` lookups for linked documents. Add a
    regression test: an edit to a stylesheet that only the `data` document
    of an `<object>` with both attributes links lists the page in Changes.
    Effort: Small.
  - **B.** A, and add the positions that load a linked document to the
    shared table: `src` on `<iframe>` and `<embed>`, and `data` on
    `<object>`. The stylesheet reader then takes both kinds of document from
    the table. Effort: Medium.
  - **C.** One shared document walk in `mokly-graph` that gives each
    embedded and linked document of a composed document, with its route. The
    closure, the stylesheet reader, and the asset base check all use it.
    Effort: Large.
- **Left out:**
  - Test the element name `iframe` in the reader: A is better on every
    point, because it costs the same and keeps one rule for `srcdoc`.
  - Read both `srcdoc` and `data` on an `<object>`: the browser never shows
    that `srcdoc`, so its rules would count for a document that nobody sees.
- **Wider fix:** C. One walk gives every reader the same documents, so no
  reader can apply its own element rule.
- **Previous examples:** Commit `d935e6a66` read `data` as a URL on every
  element, in the reference reader and in the canonical form. Commit
  `52b4c1461` of 2026-11-25 moved both to the shared table, but not the
  stylesheet reader.
- **Related:**
  - [srcdoc-material-urls-respelled.md](./srcdoc-material-urls-respelled.md):
    the same wider fix. Its option C builds the canonical form of Changes on
    the walk of option C here.
  - [embedded-document-closures.md](./embedded-document-closures.md): the
    same code. Its background cites this reader. Its option C records each
    embedding edge by element kind, as options B and C here do.
- **Recommendation:** A. It is the fix that the review chose for this file,
  and it takes under an hour. C best protects the codebase, at a Large cost.
- **Action:** fix after merge, apply A, because the workspace brief limited
  the branch to named files, and `crates/mokly-compare/src/css_documents.rs`
  is not one of them.
