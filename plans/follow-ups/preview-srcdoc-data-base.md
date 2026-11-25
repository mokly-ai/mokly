# Snapshot presentation resolves against ignored bases

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 2, a problem
  that the review found outside the scope.
- **Location:** `packages/viewer/src/previews/presentation_document.ts:32-34`
  (`prepareDocument`), `packages/viewer/src/previews/presentation_url.ts:21-30`
  (`relativeAddress`), and `docs/protocol/mokly-removed-previews.md:188-190`.
- **Reason:** The review found the problem in viewer code that the branch did
  not change, and the fix changes a rule that
  `docs/protocol/mokly-removed-previews.md` states.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Snapshot presentation:** `presentSnapshotDocument` in
    `packages/viewer/src/previews/presentation_document.ts`. It turns a
    fetched historical document into the `srcdoc` text of an inert viewer
    frame.
  - **Changes:** the Mokly view that lists the differences between the working
    catalogue and its base commit.
  - **Removed preview:** the viewer view of the last version of an entry that
    the working catalogue removed, under
    `docs/protocol/mokly-removed-previews.md`.
  - **Effective base:** the URL against which the snapshot presentation
    resolves the relative addresses of one document.
- **Background:**
  - Removed previews and the comparison panes of Changes show each snapshot
    document through the snapshot presentation.
    `createSnapshotPresentationLoader` in
    `packages/viewer/src/previews/presentation.ts` serves both.
    `docs/protocol/mokly-comparison-panes.md` says that the panes follow the
    rules of `docs/protocol/mokly-removed-previews.md#frames-and-lifecycle`
    exactly.
  - The viewer assigns the presented document to `srcdoc`. A host's
    `base-uri 'none'`, as on the Mokly Cloud catalogue origin, blocks each
    `<base>` in a `srcdoc` document. So the viewer resolves each relative
    address itself. The protocol rejects "documenting the limit because
    relative images and links stay broken."
  - The protocol says: "The effective base is the first `<base href>` in
    document order, resolved against the document address, or that address
    when there is none or it does not resolve." An `<iframe srcdoc>` document
    uses the outer effective base in place of the document address.
  - `prepareDocument` in
    `packages/viewer/src/previews/presentation_document.ts:26-45` applies that
    rule. Line 32 takes `doc.querySelector("base[href]")`, and line 34
    resolves its `href` with `new URL`. It checks no scheme. A CSS type
    selector matches an element in any namespace, so the selector also
    returns an SVG `base` element.
  - `rewriteDocumentAddresses` in
    `packages/viewer/src/previews/presentation_addresses.ts` replaces each
    relative address through `relativeAddress` in
    `packages/viewer/src/previews/presentation_url.ts:21-30`. An address that
    does not resolve against the effective base stays as written. A relative
    URL does not resolve against a `data:` or `javascript:` URL.
  - The presentation removes every `<base>` from the outer document, and the
    `href` of every `<base>` in an embedded document. So an address that
    stays relative resolves against the base URL of the viewer page.
  - HTML ignores a `<base href>` whose URL has the `data` or `javascript`
    scheme. It also ignores a `base` element outside the HTML namespace. The
    document then uses its fallback base URL.
  - A run in Chromium on 2026-11-25 confirmed this. In a `srcdoc` document
    with `<base href="data:text/plain,x">`, `<base href="javascript:void(0)">`,
    or an SVG `<base href="elsewhere/">`, the image `logo.png` resolved against
    the base of the embedding document. An HTML `<base href="elsewhere/">`
    moved it into `elsewhere/`.
  - The core accepts such documents. `validate` in
    `crates/mokly-html/src/url_safety.rs` rejects a `data:` or `javascript:`
    `href` on each element of the composed document. It does not read the
    text of a `srcdoc` value. The referenced closure skips `href` on `<base>`.
  - The asset base check of the core treats a `data:` or `javascript:` base
    as no base, as HTML does. `validate_at` in
    `crates/mokly-graph/src/asset_base.rs` holds that rule.
  - A page, a `.page.html` file that holds a complete authored document, may
    hold a `base` element. So may the HTML that a JavaScript component
    returns. A screen body fails on a `base` element, but no check reads the
    text of a `srcdoc` value in a screen.
  - A run of `presentSnapshotDocument` on 2026-11-25 gave these results, at
    the address
    `https://artifact.test/mokly-viewer/diffs/generations/1/snapshots/before/mokly-generated/home/index.html`:
    - `<iframe srcdoc="<base href='data:text/plain,x'><img src='logo.png'>">`:
      the presented embedded document holds `<base><img src="logo.png">`. The
      image address stays relative.
    - The same input with `javascript:void(0)` gives the same result.
    - `<svg><base href="elsewhere/"></base></svg><img src="logo.png">`: the
      presented image address ends in `home/elsewhere/logo.png`. The browser
      loads `home/logo.png`.
  - The browser spec `tests/browser/removed_preview_presentation.spec.ts`
    covers an invalid base, `http://[`, and nested `srcdoc` bases. It has no
    `data:`, `javascript:`, or SVG base.
- **Problem:** The presentation takes the first `base[href]` as the effective
  base, also when HTML ignores it. A `data:` or `javascript:` base in a
  `srcdoc` document leaves each relative address unresolved. An SVG `base`
  element sends each relative address to another directory.
- **Impact if no action:** Changes and removed previews show broken images and
  wrong links for such a document, while Serve and the static build show it
  correctly. A reviewer can take the break for a defect of the change.
- **Root question:** How does the snapshot presentation resolve each address
  against the base that the browser applies?
- **Options:**
  - **A.** Apply the HTML rule in `prepareDocument`. Take the first `base`
    element in the HTML namespace that has an `href`. Use the fallback when
    its URL does not resolve or has the `data` or `javascript` scheme. Change
    the effective-base sentence of `docs/protocol/mokly-removed-previews.md`
    to the same rule. Add the three inputs above to
    `tests/browser/removed_preview_presentation.spec.ts`. Effort: Small.
  - **B.** A, and one shared table of base cases. Each case gives the markup,
    the document address, and the expected effective base. A viewer test of
    the presentation and a Rust test of the asset base check both read the
    table. A later base reader reads it too. Effort: Medium.
- **Left out:**
  - Document the limit: the protocol already rejects it, because relative
    images and links stay broken.
  - Reject such a base in the core: it adds a rejection for a document that
    works in Serve and the static build. A fixes the presentation with less
    change.
  - Remove each ignored base from the delivered bytes in the core: it edits
    authored markup that Serve delivers, and A is better on every point.
  - Let the browser compute the base: `DOMParser` gives the parsed document
    the address of the viewer page. So the browser resolves a relative base
    against the wrong address.
- **Wider fix:** B. One table keeps the viewer and the core on the same base
  for each listed case.
- **Previous examples:** Since commit `d935e6a66`, `first_base` in
  `crates/mokly-html/src/link_targets.rs` reads a `base` element in any
  namespace and in `<template>` contents.
- **Related:** [base-rules-read-final-tree.md](./base-rules-read-final-tree.md):
  the same cause in the core. Its link rule also reads a `<base>` that HTML
  ignores. Its option C lets a page with a catalogue link hold an SVG
  `<base href>`, which this presentation then reads.
- **Recommendation:** A. It makes the presentation follow the browser, with a
  change to one function, one protocol sentence, and one browser spec. B best
  protects the codebase, because one table then holds the base cases of each
  reader.
- **Action:** ask the user, because A changes the effective-base rule that
  `docs/protocol/mokly-removed-previews.md` states, and no recorded user
  decision covers that change.
