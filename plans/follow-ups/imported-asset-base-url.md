# Keep asset URLs right under a base URL

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: review finding 4 of round 2.
- **Location:** `crates/mokly-graph/src/asset_tokens.rs:46`,
  `crates/mokly-graph/src/references.rs:179`, and
  `crates/mokly-html/src/links.rs:61`.
- **Reason:** Each option adds a rejection or a warning, and the wider fix
  changes pages and code outside the files of that branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base URL:** the address that a browser uses to resolve relative URLs of
    a page. A page sets it with `<base href>`.
  - **Imported asset:** a file that JavaScript imports, such as an image.
    Mokly delivers it under `static/mokly-generated/assets/` and writes a URL
    relative to each document, under `docs/protocol/mokly-imported-assets.md`.
  - **Referenced closure:** the check of `docs/protocol/mokly-public-closure.md`
    that resolves each reference of a document and fails a missing target.
- **Background:**
  - Mokly writes the URL of each imported asset relative to the route of the
    document. The referenced closure checks the target against the same route.
  - The final link check rejects `<base href>` only in a document with an
    active catalogue link, at `crates/mokly-html/src/links.rs:61`. HTML
    screens, HTML components, and Markdown documents reject `<base>` already.
  - A page, or the JavaScript output of a screen or a component, can still
    keep a `<base href>`. The reference reader skips that element, at
    `crates/mokly-graph/src/references.rs:179`.
- **Problem:** A browser resolves the asset URL against the kept base URL, not
  against the document route. A review probe on 2026-11-21 built a page with
  a local `<base href>`: the image request went to another directory and
  returned 404, while `build` passed. An external base sends the request to
  another host. The same mismatch exists for authored relative references,
  which the closure checks against the route (`crates/mokly-graph/src/closure.rs:95`),
  and for configured stylesheet links that Mokly writes
  (`crates/mokly-graph/src/styles.rs:196`).
- **Impact if no action:** A catalogue builds and serves with broken images,
  and in some cases with broken stylesheets, and nothing reports it.
- **Root question:** How can the URL that Mokly writes for a resource, the
  target that the closure checks, and the URL that the browser loads stay the
  same in every composed document, also when the document sets
  `<base href>`?
- **Options:**
  - **A.** Fail a composed document whose base URL would redirect an imported
    asset, with a diagnostic that tells the author to remove the base. It
    rejects only documents that are already broken. Effort: Small.
  - **B.** Write and check each asset URL against the effective base. Support
    bases inside the catalogue. Fail an external base that would redirect an
    imported asset. The shared closure then resolves against the base, which
    also changes authored references. Effort: Medium.
  - **C.** Remove the base URL and rewrite the relative references of the page
    to keep their destinations. Page scripts that read the base URL change.
    Effort: Large.
  - **D.** Reject `<base href>` in every composed document, and keep
    `<base target>`. Widen the rule at `crates/mokly-html/src/links.rs:61`
    from documents with an active catalogue link to every document. This also
    fixes authored references and stylesheet links. It changes the decision
    in `docs/protocol/mokly-navigation.md` and its copies in the link
    validation, logical links, pages, rendering, and authoring pages, and in
    `docs/guides/authoring/links.md`. Effort: Medium.
  - **E.** Remove `<base href>` from every composed document with a build
    warning. `build --strict` fails on the warning, and a form action that
    the closure does not check changes its target silently. Effort: Medium.
- **Left out:**
  - Keep the current output: `build` passes with a broken URL.
  - A fixed host address: the catalogue must stay portable.
  - A warning that keeps the output: the output stays wrong.
- **Wider fix:** D. It does not depend on the kind of URL or on the shape of
  the base.
- **Previous examples:** Commit `d935e6a6` rejects `<base href>` beside an
  active catalogue link, because it can redirect those links.
- **Recommendation:** A. It is the smallest change that stops a successful
  build with a broken asset URL, and no released catalogue has imported
  assets yet. D protects the codebase best, at a wider cost.
- **Action:** ask the user, because A adds a new rejection, and D changes a
  decision in force in the navigation contract.
