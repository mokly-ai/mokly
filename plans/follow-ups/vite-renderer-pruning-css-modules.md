# Renderer pruning removes needed module styles

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 63.
- **Location:** `crates/mokly-css/src/vite.rs:99`,
  `crates/mokly-render/src/bundle_styles.rs:76`,
  `crates/mokly-render/src/bundle_styles.rs:128`, and the section "Imports
  Inside Stylesheets" of `docs/protocol/mokly-vite-adapter-styles.md`.
- **Reason:** The recommended option changes the renderer pruning rule of
  `docs/protocol/mokly-vite-adapter-styles.md`, and no user decision covers
  that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Renderer:** The shared JavaScript wrapper module of a catalogue. Its
    stylesheet links come before the stylesheet links of the entries.
  - **CSS Module:** A `.module.` stylesheet that gives JavaScript a map of
    generated class names.
  - **Renderer's closure:** The renderer's top-level stylesheets and each
    file that their transform reports as a dependency.
  - **Pruning:** Mokly's removal of a renderer stylesheet from the
    stylesheets of an entry, so that renderer CSS does not come back after
    the entry's CSS.
- **Background:**
  - Under the adapter, the setup resolves and inlines every import inside a
    stylesheet. Mokly removes renderer stylesheets only from the stylesheets
    that JavaScript imports. The section "Imports Inside Stylesheets" of
    `docs/protocol/mokly-vite-adapter-styles.md` states this rule. An
    orchestrator design call answered the decision on renderer CSS inside
    nested imports this way on 2026-11-23.
  - An orchestrator design call of 2026-11-23 says that the renderer
    stylesheets of that rule are the files of the renderer's closure. Its
    reason was the wording of the options of the decision above. Those
    options call each file of the closure a renderer stylesheet, such as a
    shared Sass partial. This call is the only source of the rule that a nested
    dependency removes an entry import. It is not a user requirement.
  - The pruning removes from each entry each path in the renderer's
    `dependency_digests`, at `crates/mokly-render/src/bundle_styles.rs:87`.
    `crates/mokly-css/src/vite.rs:99` builds that map from the dependency set
    that `packages/mokly/src/sidecar/vite-css-transform.ts:92` collects from
    plugin reports and resolver reads.
  - `stylesheets::scan_roots` already removes the renderer's
    JavaScript-imported stylesheets from each entry, at
    `crates/mokly-render/src/stylesheets.rs:173` to line 192.
  - The guide `docs/guides/authoring/styles.md:59` promises that CSS Module
    class names match the delivered CSS.
  - These rules stay:
    - The renderer and each entry keep separate bundles, and the renderer's
      bundle comes first. See `docs/protocol/mokly-rendering.md:133` and
      `docs/protocol/mokly-imported-styles.md:72`.
    - Mokly removes whole files from an entry, never single rules. See
      `docs/protocol/mokly-imported-styles.md:94`: nothing is pruned by
      selector or by emitted text.
    - Mokly keeps the rules of Vite's inline output and changes only its
      asset URLs. The user's decision of 2026-11-06 chose the Vite adapter
      because it removes Mokly's JavaScript and CSS copies of the setup.
    - The class map of an entry is Vite's scoped map of the file that the
      entry imports. An orchestrator design call of 2026-11-23 chose Vite's
      own CSS Modules under the adapter.
    - A stylesheet that the renderer's JavaScript imports is removed from the
      JavaScript imports of each entry. The project's own Vite build loads
      one stylesheet module once, so this pruning gives the CSS of that build.
- **Problem:**
  - When the renderer's plain CSS uses `@import` on a CSS Module, Vite's
    default transformer inlines the module's unscoped rules, at
    `node_modules/vite/dist/node/chunks/node.js:30487`.
  - Mokly prunes that file from the entry's CSS, also when the entry's
    JavaScript imports its class map.
  - The fallback builds the scoped map for the entry without its stylesheet.
    The delivery roots come from `prepare_roots` at
    `crates/mokly-render/src/graph.rs:226`.
  - The same cause has two more cases. A renderer `.less` stylesheet can use
    `@import (reference)` on a file that an entry imports from JavaScript.
    Vite reports such an import as a dependency, at `node.js:31188`, but Less
    emits only the rules that the renderer uses as mixins or extends. So the
    entry loses all CSS of that file. A Sass `@use ... with (...)` in the
    same position gives the entry the renderer's configured copy.
- **Screenshot:** In the component preview, mark the card whose CSS Module
  selector is missing from the linked stylesheets.
- **Impact if no action:** The rendered element uses a scoped class, and the
  linked CSS has only the original selector. The renderer test at
  `tests/vite_stylesheets.test.ts:68` uses a plain stylesheet, so it cannot
  show this mismatch.
- **Root question:** When has the renderer already supplied the styles that
  an entry's JavaScript import needs?
- **Options:**
  - **A.** Keep direct CSS Module imports when the renderer reached them only
    inside another stylesheet. Add a regression that matches the entry's
    generated class to a linked rule. Cost: A leaves conditional plain CSS at
    risk. It also leaves a Less `(reference)` import, a Sass
    `@use ... with (...)`, and a Sass `@import` inside a rule at risk. In each
    case, the renderer emits other CSS than the standalone transform of the
    same file. Effort: Small.
  - **B.** Prune only a shared standalone import. Keep nested dependencies
    watched and protected.
    - Cost: the entry can get a second copy of a file's CSS after the
      renderer's CSS. That copy can override a renderer rule after the
      `@import`, as in the project's own Vite build.
    - B reverses the assertion at `tests/vite_stylesheets.test.ts:87`.
    - B changes the design call on the renderer's closure,
      `docs/protocol/mokly-vite-adapter-styles.md:62` to line 70,
      `docs/guides/authoring/styles.md:28` to line 33, and
      `docs/guides/authoring/vite.md:102` to line 105.
    - B deletes the extra renderer compile at
      `crates/mokly-render/src/bundle_styles.rs:77` to line 90, because
      `stylesheets::scan_roots` already removes the renderer's
      JavaScript-imported stylesheets.
    - Under B, the entry root bundles the CSS Module itself. Its class map
      then comes from that root, at `crates/mokly-css/src/vite.rs:89` to
      line 93, not from the fallback.
    - Effort: Small.
  - **C.** Use transform provenance to remove nested output that has the same
    scoping and conditions as the standalone import. This needs that
    information from Vite's stylesheet transformers. Effort: Large.
  - **D.** Let a nested renderer dependency remove an entry import only when
    Mokly can show that the renderer inlined the file's standalone CSS:
    - The file is a plain `.css` file, not a CSS Module, and only
      unconditional `@import` rules in plain `.css` importers reach it.
    - The resolver hook at `packages/mokly/src/sidecar/vite-css-hooks.ts:57`
      to line 66 records each read with its importer and its authored
      specifier.
    - Mokly reads the media, `supports()`, and `layer()` conditions of that
      `@import` from the importer's text.
    - Each CSS Module, each preprocessor dependency, and each file that only
      a plugin reports stays in the entry.
    - Cost: Mokly keeps a removal that the project's own Vite build does not
      make. A transform of the whole chain, such as Tailwind's plugin or
      another PostCSS plugin, can still change the inlined copy. So the class
      stays partly open. D changes the generated `ViteCssResult` type and the
      protocol rule.
    - Effort: Medium.
- **Left out:**
  - Keep the path-only rule. It keeps the class without a matching selector.
  - Match text. It cannot show that conditional rules apply in the same
    contexts.
  - A warning or an error when Mokly removes a CSS Module import. A
    non-strict build keeps the unmatched class, and the project's own Vite
    build accepts this setup. A new warning also needs the user.
  - Rewrite the renderer's inlined copy, or stop Vite's inlining of the
    module. It breaks the rule that the setup resolves and inlines every
    import inside a stylesheet. It also breaks the user's choice to keep no
    Mokly copy of Vite's CSS rules.
  - An unscoped class map for a removed module. It breaks the rule that the
    class map comes from Vite's own CSS Modules, and it makes the module's
    classes global.
  - No pruning under the adapter. A stylesheet that the JavaScript of the
    renderer and of an entry both import then comes back after the renderer's
    CSS. The project's own Vite build loads that module once.
  - A change to the class map fallback at
    `crates/mokly-render/src/bundle_styles.rs:128` to line 148. A stylesheet
    that the fallback attaches is the rule of A at a second place.
- **Wider fix:** B. No nested dependency then removes an entry import, so B
  prevents the class for each transformer. C and D must know how each
  transformer inlines a file, so they are direct fixes.
- **Previous examples:** The options of the decision of 2026-11-23 on
  renderer CSS inside nested imports already name such a case. A shared Sass
  partial is a dependency, but it emits no CSS.
- **Related:**
  - The branch that found this item built one plugin report collector that
    also takes the reports of `order: "pre"` hooks. Those reports join the
    dependency set that the pruning reads. Under the current rule and under
    A, each such report can remove an entry's JavaScript import. This happens
    also when the renderer emits none of that file's CSS. Under B, C, and D, a
    plugin
    report alone removes no entry import. If the user does not choose B,
    define the pruning set over the actual inlined reads, not over plugin
    reports, and test the two together.
  - `plans/follow-ups/vite-sass-outside-root-reads.md`: its option B carries
    the actual preprocessor reads in a separate record. C and D here need a
    record of actual reads with the importer and the conditions. One record
    can serve both items.
  - `plans/follow-ups/vite-composed-stylesheet-assets.md` and
    `plans/follow-ups/vite-nested-css-url-escapes.md`: their option B carries
    the source location of each reference through both Vite transformers. C
    here needs the source file, the conditions, and the scoping of each
    inlined rule. One provenance record can serve all three items. It does
    not affect B.
- **Recommendation:** B, as the review says. B gives the CSS of the
  project's own Vite build. Vite loads a JavaScript-imported stylesheet
  module once. A JavaScript import of a file that a stylesheet inlines with
  `@import` still loads that file as its own module. B also closes the whole
  class with less code.
- **Action:** ask the user, because B changes the renderer pruning rule of
  `docs/protocol/mokly-vite-adapter-styles.md` and the design call on the
  renderer's closure, which no user decision covers.
