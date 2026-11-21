# Reject a stylesheet asset name without an extension

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The check of review finding 8 of round 2 found it.
- **Location:** `stylesheet_content_type` at
  `crates/mokly-css/src/imported_assets.rs:50-52`, and
  `crates/mokly-css/src/compiler_assets.rs:84`.
- **Reason:** The lines existed before that branch, and the fix adds a
  rejection.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Stylesheet asset:** a file that a CSS `url()` names. Mokly delivers it
    under `static/mokly-generated/assets/`, under
    `docs/protocol/mokly-imported-styles-assets.md`.
- **Background:**
  - The stylesheet asset contract accepts only the extensions of its table,
    and every other extension fails with "unsupported CSS asset extension".
  - The extension check reads the text after the last dot of the path. For a
    name without a dot, it reads the whole name.
- **Problem:** A `url(png)` that names a repository-root file called `png`
  passes the check as a PNG asset, although the file has no extension. A
  check program on 2026-11-21 confirmed that the stylesheet lookup gives a
  type for `"png"`, while the JavaScript asset lookup gives none.
- **Impact if no action:** Such a file is delivered as `image/png`. The
  contract says that it fails.
- **Root question:** How does the stylesheet check read the extension of a
  name without a dot?
- **Options:**
  - **A.** Read the extension only after a dot in the last path segment, as
    the JavaScript asset lookup does, so that such a name fails with the
    existing message. Effort: Small.
  - **B.** Change nothing, and state in the contract that a whole name can act
    as an extension. Effort: Small.
- **Left out:** A third approach adds nothing: a name has an extension or not.
- **Wider fix:** A. One extension rule for both lookups removes the case.
- **Previous examples:** None found.
- **Recommendation:** A. The check then matches the contract.
- **Action:** ask the user, because A rejects a path that builds today.
