# Changes compares iframe srcdoc values as text

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 1, check of
  finding 2.
- **Location:** `crates/mokly-compare/src/material.rs:139` and
  `docs/protocol/mokly-moves.md:76-77`.
- **Reason:** The check found the problem in code that the branch did not
  change, and the base branch compares `srcdoc` values in the same way.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Changes:** the Mokly view that lists the differences between the
    working catalogue and its base commit.
  - **Canonical form:** the normalized tree that Changes compares to decide
    whether a view changed, under
    `docs/protocol/mokly-comparison.md#materiality`.
  - **Identical-content signal:** the move pass that pairs a removed and an
    added entry when their canonical forms are equal, under
    `docs/protocol/mokly-moves.md#signals`.
  - **Imported asset URL:** the URL that Mokly writes in place of the token
    of a JavaScript asset import, relative to the route of the composed
    document.
- **Background:**
  - `attributes` in `crates/mokly-compare/src/material.rs:98-147` gives the
    canonical value of each attribute. It reads the kind of each position
    from the shared table, `kind` in
    `crates/mokly-graph/src/reference_positions.rs`.
  - For a URL, a `srcset`, or a `style` attribute, `attributes` resolves each
    local URL against the route of the composed document, with
    `crates/mokly-compare/src/material_urls.rs`. So `../assets/logo.png` and
    `../../assets/logo.png` that name one file get one value.
  - At line 139, a `srcdoc` value on an `<iframe>`, whose kind is
    `EmbeddedDocument`, keeps its decoded text as it is.
  - Mokly writes each imported asset URL relative to the route of the
    composed document, also inside a `srcdoc` value, under
    `docs/protocol/mokly-imported-assets.md#asset-urls-in-documents`. At
    another directory depth, the same embedded document holds other URL
    spellings. Authored relative URLs in a `srcdoc` value behave the same.
  - `docs/protocol/mokly-moves.md#normalisation` says: "Resource references
    compare by their resolved catalogue route, with query and fragment
    retained. Relative spelling and directory depth are not material."
  - The paired comparison of a moved view, `compare` in
    `crates/mokly-compare/src/view_material.rs`, and the identical-content
    signal, in `crates/mokly-compare/src/rendered_moves.rs`, both compare
    canonical forms.
  - The stylesheet reader of Changes, `collect` in
    `crates/mokly-compare/src/css_documents.rs:54-60`, already parses each
    `srcdoc` value to match CSS rules.
- **Problem:** When an entry moves to a path at another directory depth, the
  URLs in its `<iframe srcdoc>` value get another spelling. The canonical form
  compares that value as text, so the unchanged embedded document differs.
- **Impact if no action:** Changes lists the moved view as changed. Or the
  identical-content signal does not pair the move, so the entry shows as one
  added and one removed entry, unless another signal pairs it.
- **Root question:** How does Changes compare the document of an
  `<iframe srcdoc>`, so that relative spelling and directory depth inside it
  are not material?
- **Options:**
  - **A.** Keep the text comparison, and state in
    `docs/protocol/mokly-moves.md#normalisation` that a `srcdoc` value
    compares as written. A moved view with a relative URL in a `srcdoc` value
    keeps showing as changed. Effort: Small.
  - **B.** Parse each `srcdoc` value in the canonical form, and compare the
    canonical form of its document in place of the text. Its URLs then
    resolve against the route of the composed document, as the outer URLs
    do, and each nested `srcdoc` value gets the same treatment. Formatting
    inside a `srcdoc` document then stops being material, as in the outer
    document. Add a regression test: a page whose `<iframe srcdoc>` holds an
    imported asset URL moves to another depth, stays unchanged, and pairs as
    identical content. Effort: Medium.
  - **C.** B, built on one shared document walk in `mokly-graph` that the
    closure, the stylesheet reader, the asset base check, and the canonical
    form all use. Effort: Large.
- **Left out:**
  - Write the imported asset URLs of a `srcdoc` value from the artifact
    root: the referenced closure rejects a root-absolute reference.
  - Rewrite the URLs in the `srcdoc` text with a text search: the value can
    hold any HTML, so only a parse finds its URL positions.
- **Wider fix:** B. It gives every embedded document the canonical form of
  the outer document, so no URL inside one keeps its spelling.
- **Previous examples:** None found.
- **Related:**
  - [css-documents-reference-table.md](./css-documents-reference-table.md):
    the same wider walk. Its option C is the walk that option C here extends
    to the canonical form.
  - [self-url-material-moves.md](./self-url-material-moves.md): the same
    code. Both make a moved view differ in the canonical form of
    `crates/mokly-compare/src/material.rs`.
- **Recommendation:** B. It makes the embedded document follow the move rule,
  with a change in one crate. C best protects the codebase, because every
  reader of embedded documents then shares one walk.
- **Action:** fix after merge, apply B, because the problem lies outside the
  branch that found it, and its likelihood is Rare.
