# Link base rule rejects bases browsers ignore

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 2: the wider fix
  of finding 4, "Asset base check uses the unfinished tree", and the problem
  outside the scope that the check of finding 4 found.
- **Location:** `crates/mokly-html/src/link_targets.rs:31-38` (`first_base`),
  `crates/mokly-html/src/links.rs:43` and `:61-66` (`rewrite`),
  `crates/mokly-graph/src/asset_base.rs:22-40` (`first_base_href`), `validate`
  in `crates/mokly-graph/src/rendering.rs`, and
  `docs/protocol/mokly-navigation.md:71-76`.
- **Reason:** The recommended fix relaxes a rejection that `origin/main` has
  had since commit `d935e6a66`, which needs the user's approval.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Catalogue link:** an HTML `<a>` or `<area>`, or an SVG `<a>`, whose
    `href` holds a `mock:` destination. Mokly marks it with `data-mokly-link`.
  - **Browse:** the Mokly shell that shows the catalogue. It activates a
    catalogue link itself, from the marker.
  - **Final parse:** `normalization::composed` in
    `crates/mokly-html/src/normalization.rs`. It serializes the composed tree
    and parses it again, as a browser does.
  - **Asset base check:** the check that fails a document when a
    `<base href>` changes the destination of an imported asset URL, under
    `docs/protocol/mokly-imported-assets.md#base-urls`.
  - **Derived target:** the `data-mokly-target` value that Mokly writes on a
    catalogue link, from its own `target` or from the first `<base target>`.
- **Background:**
  - `rewrite` in `crates/mokly-html/src/links.rs` rewrites each `mock:` link.
    At lines 61-66, it applies the logical-link base rule. It fails the render
    when the document has a catalogue link and `first_base(nodes, "href")`
    finds a value. The failure text is "a document with an activatable
    catalogue link cannot contain `<base href>`".
  - `first_base` in `crates/mokly-html/src/link_targets.rs:31-38` returns the
    attribute of the first element named `base` that has it. It walks every
    node with `tree::walk`, and it does not check the namespace. It also
    walks into `<template>` contents, because the parser stores them as
    children of the `template` element.
  - `rewrite` reads the `<base target>` with the same function, at line 43.
    For a catalogue link without its own `target`, a non-self value becomes
    the derived target. An invalid value fails the render with "invalid
    catalogue link target".
  - For the derived target `_blank` or a named target, Browse opens the
    destination in a new browsing context, under
    `docs/protocol/mokly-navigation.md#enhanced-navigation-and-safe-degradation`.
  - `validate` in `crates/mokly-graph/src/rendering.rs` runs `links::rewrite`
    before the final parse. A JavaScript component inside `<svg>` can return
    a `<base href>`. That base stays an HTML element until the final parse
    puts it in the SVG namespace.
  - HTML takes the document base URL from the first `base` element in the
    HTML namespace that has an `href`. The base target comes from the first
    such element that has a `target`. A `base` element in another namespace,
    or in `<template>` contents, has no effect.
  - A run in Chromium on 2026-11-25 confirmed this. With an SVG
    `<base href="elsewhere/">`, or a `<template>` that holds one, the URL of a
    relative image did not change. An HTML `<base href="elsewhere/">` moved it
    into `elsewhere/`. With an SVG or template `<base target="_blank">`, a link
    opened in the same page. An HTML `<base target="_blank">` opened it in a
    new browsing context.
  - The asset base check reads only the base that HTML uses.
    `first_base_href` in `crates/mokly-graph/src/asset_base.rs:22-40` takes
    the first HTML `<base href>` outside `<template>` contents. Since
    2026-11-25, `validate` runs the token replacement and the asset base check
    after the final parse. The render tests
    `an_svg_component_base_does_not_redirect_imported_assets` and
    `an_svg_component_base_does_not_hide_a_redirecting_html_base`, in
    `crates/mokly-graph/tests/collected_asset_tests.rs`, cover a component
    inside `<svg>` that returns a base.
  - So Mokly has two base rules with two lookups. The logical-link base rule
    reads `first_base`, and the asset base check reads `first_base_href`.
  - `docs/protocol/mokly-navigation.md#logical-catalogue-links` states the
    rule: "A document with an activatable logical `href` must not contain
    `<base href>`, because the base URL would change the browser's effective
    portable destination without changing the attribute bytes that Browse
    authenticates". A base that HTML ignores changes no destination.
  - These pages repeat the rule: `docs/protocol/mokly-navigation.md:140-142`,
    `docs/protocol/mokly-authoring.md:203-206`,
    `docs/protocol/mokly-rendering.md:179-180`,
    `docs/protocol/mokly-pages.md:119-120`,
    `docs/protocol/mokly-logical-links.md:22-23`,
    `docs/protocol/mokly-link-validation.md:25-26`, and
    `docs/guides/authoring/links.md:77-78`.
  - The rejection and `first_base` are on `origin/main` since commit
    `d935e6a66` of 2026-10-25, which rebuilt the Mokly backend as a Rust core.
    The test `page_base_targets_are_kept_but_active_links_reject_base_urls`,
    in `crates/mokly-html/src/_tests_/navigation_sweep_tests.rs`, checks an
    HTML `<base href>` only.
  - A screen or an HTML component fails on a `base` element with
    `html-element`. A page, a `.page.html` file that holds a complete authored
    document, may hold one. The HTML that a JavaScript component returns may
    hold one too.
- **Problem:** The logical-link base rule fails a document for a
  `<base href>` that the browser ignores: a `base` element in the SVG
  namespace, one in `<template>` contents, or one that a component returns
  inside `<svg>`. The same lookup gives a catalogue link a derived target from
  an ignored `<base target>`. It fails the render when that value is invalid.
- **Impact if no action:** `mokly build` fails, and Serve does not serve the
  document, although its links work in the browser. An ignored
  `<base target="_blank">` makes Browse open a catalogue link in a new
  browsing context, while the same link outside Browse opens in place.
- **Root question:** How do the base rules of a composed document judge only
  the base that the browser applies?
- **Options:**
  - **A.** Keep the rejection and the lookup. The two base rules keep two
    lookups that read different elements. Effort: Small.
  - **B.** Make `first_base` read only HTML `base` elements outside
    `<template>` contents. The `<base target>` read changes with it. Keep the
    rule before the final parse. Add the SVG and template cases to the
    navigation sweep test, and change the wording of the rule in the pages
    above. A base that a component returns inside `<svg>` still fails the
    document, and the two lookups stay. Effort: Small.
  - **C.** Give both base rules, and the `<base target>` read, one lookup in
    `mokly-html`: the first HTML `base` element with the attribute, outside
    `<template>` contents. It replaces `first_base` and `first_base_href`. Run
    the logical-link base rule on the tree after the final parse. Add a render
    test: a page with an SVG `<base href>` beside a catalogue link renders.
    Change the wording of the rule in the pages above: it counts the
    `<base href>` that HTML uses for the document base URL. A `<base target>`
    that a component returns inside `<svg>` still counts, because `rewrite`
    writes the derived target before the final parse. Effort: Medium.
  - **D.** C, and a delivered-tree type that only the final parse returns.
    Every browser-facing check takes it: the asset base check, the
    logical-link base rule, the URL policy, document safety, and the anchor
    check. The one lookup of C takes it too, so Mokly writes the derived
    target after the final parse. The compiler then rejects a later check on
    the tree before the final parse. Cost: changes in
    `crates/mokly-html/src/url_safety.rs`, `crates/mokly-html/src/safety.rs`,
    `crates/mokly-graph/src/rendering.rs`, and the three test files under
    `crates/mokly-html/src/_tests_` that call those checks. Effort: Medium.
- **Left out:**
  - A separate parse of the serialized document in the link rule: it repeats
    the final parse, and C reads the tree that the final parse already gives.
  - An exception for SVG only: B costs the same and also covers `<template>`
    contents.
- **Wider fix:** C. One lookup on the tree after the final parse leaves no
  base rule with its own reading of `<base>`.
- **Previous examples:**
  - The asset base check ran before the final parse until 2026-11-25. The
    branch `calummoore/storybook-asset-follow-ups-cibm` moved it after the
    final parse, with the two render tests above.
  - `foreign_plaintext_components_keep_later_escaped_text_inert`, in
    `crates/mokly-html/src/_tests_/foreign_plaintext_tests.rs`, covers another
    change of element placement after a component inside `<svg>`.
- **Related:** [preview-srcdoc-data-base.md](./preview-srcdoc-data-base.md):
  the same cause in the viewer. Its snapshot presentation also reads a
  `<base>` that HTML ignores. Its option B, one shared table of base cases,
  can also test the one lookup of option C here.
- **Recommendation:** C. It fixes each case, a base that a component returns
  inside `<svg>` included, and it leaves one lookup for both base rules. D
  best protects the codebase, because the compiler then keeps every
  browser-facing check on the delivered tree.
- **Action:** ask the user, because C relaxes the rejection of `<base href>`
  beside a catalogue link. `origin/main` has that rejection since commit
  `d935e6a66`, `docs/protocol/mokly-navigation.md` states it, and no recorded
  user decision covers the change.
