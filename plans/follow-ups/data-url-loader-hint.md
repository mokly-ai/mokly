# Name the dataurl loader in the data URL error

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan. The options check of its decision C1 found the problem on
  2026-11-18.
- **Location:** `crates/mokly-html/src/url_safety.rs:18-24` and
  `docs/protocol/mokly-document-safety.md:41-48`.
- **Reason:** The URL policy is outside the files that track C may change,
  and the fix changes an exact message that the document safety contract
  states.

- **Source:** Design.
- **Category:** UX wording.
- **Terms:**
  - **URL policy:** the rule of `docs/protocol/mokly-document-safety.md`
    that allows only `http:`, `https:`, `mailto:`, and portable relative
    URLs in the `href` and `src` of a composed document.
  - **Asset import:** an import of an image, font, or media file. Mokly
    delivers the file and gives the component a URL, under
    `docs/protocol/mokly-imported-assets.md`.
- **Background:**
  - Before the asset imports, `docs/guides/authoring/styles.md` told
    authors to use a `dataurl` or `binary` loader in
    `moduleResolution.loaders` for JavaScript asset imports.
  - A `dataurl` loader gives a `data:` URL. The URL policy rejects it in
    `src`. The reason names the attribute, the element, and the URL, as
    in `src on <img> is not an allowed URL: "data:..."`.
  - Mokly now delivers images, fonts, and media without a loader. A
    configured loader still wins over that delivery, so a project that
    followed the old advice keeps the failure.
- **Problem:** The failure names the URL, but not the `dataurl` loader that
  made it, and not the fix.
- **Impact if no action:** An author who followed the old guide cannot see
  that the removal of the loader fixes the build.
- **Root question:** How does an author whose build fails on a `data:` URL
  learn to let Mokly deliver the file?
- **Options:**
  - **A.** Change nothing. The guide no longer advises `dataurl`. Effort:
    Small.
  - **B.** Add advice to the `data:` case of the URL policy failure, for
    example "remove a dataurl loader so that Mokly delivers imported
    files". The exact reason text in
    `docs/protocol/mokly-document-safety.md` changes with it. Effort: Small.
  - **C.** Add a migration step to `docs/guides/authoring/styles.md` that
    gives the failure text and the fix. Effort: Small.
- **Left out:** Let the asset delivery win over a configured `dataurl`
  loader: the asset contract keeps a configured loader first, because an
  explicit choice wins.
- **Wider fix:** None. The one message covers each `data:` URL in `src` and
  `href`.
- **Previous examples:** None found.
- **Related:** Decision C1 of the Storybook support plan, answered on
  2026-11-23, makes a configured `file` loader deliver the file. It does not
  change a `dataurl` loader, so it does not cover this problem.
- **Recommendation:** B. The failure then names its fix where the author
  sees it.
- **Action:** ask the user, because B changes an exact message that the
  document safety contract states.
