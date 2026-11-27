# CSS asset URLs bypass Vite's resolver

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, findings 102 and 133,
  which repeat each other. This item merges the options of both findings
  and of their finding checks. It also holds a new problem of the check of
  finding 133: a bare package URL.
- **Location:** `packages/mokly/src/sidecar/vite-css-hooks.ts:51`,
  `packages/mokly/src/sidecar/vite-css-paths.ts:56`,
  `crates/mokly-css/src/vite.rs:135`, and the section "Stylesheet Transforms"
  of `docs/protocol/mokly-vite-adapter-styles.md`.
- **Reason:** Every option adds a CSS `url()` rule under the Vite adapter, and
  no requirement covers a `url()` that the setup maps to another file.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Vite alias:** A `resolve.alias` rule of the Vite setup that maps an
    import name or prefix to another path.
  - **Asset delivery:** Mokly's validation and copy of each asset that a
    stylesheet `url()` names, to a generated route.
  - **Placeholder table:** The table in
    `packages/mokly/src/sidecar/vite-css-paths.ts` that keeps a rebased
    `url()` as a stylesheet-relative path through Vite's transform, so that
    the core can deliver it.
- **Background:**
  - Mokly's core validates and delivers each local asset that a stylesheet
    `url()` names. A relative URL resolves against the stylesheet that holds
    it, under `docs/protocol/mokly-imported-styles-assets.md:18`. The target
    must be a regular file inside the repository, reached without a symbolic
    link. Serve and the static output need this route and this file.
  - Under the adapter, Vite's CSS URL resolver is Vite's full resolver with
    `preferRelative: true`, at
    `node_modules/vite/dist/node/chunks/node.js:29891`. It applies the
    setup's aliases and `resolve.tsconfigPaths`, at `node.js:29226`. For a
    bare value, such as `url(brand-icons/logo.svg)`, it tries the relative
    file first and then a package.
  - Mokly overrides `config.createResolver` in `configureViteCss`, at
    `packages/mokly/src/sidecar/vite-css-hooks.ts:47`. The `@import` branch,
    at line 56, sends each stylesheet import through `resolveViteStylesheet`
    with Vite's resolver. The URL branch, at line 51, calls only
    `css.active.urls.resolve`, at
    `packages/mokly/src/sidecar/vite-css-paths.ts:56`. That function rebases
    a relative string and never asks the setup.
  - On 2026-11-06 the user chose the adapter, because it removes Mokly's
    copies of the project's JavaScript and CSS setup. That decision chose no
    URL rule. Under the adapter, Mokly applies none of its own
    `moduleResolution.aliases`, and the adapter page rejects a second alias
    source, at `docs/protocol/mokly-vite-adapter.md:226`.
  - The esbuild path keeps relative-only `url()` values. There, Mokly's
    `moduleResolution.aliases` apply only to `@import`
    (`docs/protocol/mokly-imported-styles.md:111`,
    `crates/mokly-css/src/compiler_assets.rs:76`). That rule stays.
  - When Vite gets the real path of a small `.svg` file, its URL rewrite
    writes a data URL, at `node.js:32629`. That asset then leaves Mokly's
    delivery. Only a placeholder path prevents this.
  - In a Sass or Less partial in another directory, Vite rebases each `url()`
    through the `@import` branch, at `node.js:31067`. So an aliased `url()`
    already works there. It fails in the requested stylesheet, in a plain
    CSS partial, in a partial in the same directory, and in Less for a URL
    that starts with `@`, at `node.js:31080`.
  - Vite 8.3.8 calls the `createResolver` override for the `ssr` environment
    of Mokly's transform, at `node.js:29659`. Vite marks the API
    `@deprecated`, at `node_modules/vite/dist/node/index.d.ts:3734`. No other
    hook reaches the CSS URL resolver, because that resolver runs its own
    plugin container with only the alias plugin and Vite's resolve plugin, at
    `node.js:29674`.
  - Later Storybook support work turns Vite's JavaScript asset URLs into
    Mokly asset tokens. One mapping from a file that Vite selects to a Mokly
    asset route can serve that work and options C and D here.
- **Problem:**
  - The URL branch never asks the setup which file a local `url()` names.
  - With an alias key such as `@images`, the core gets the path
    `@images/logo.svg` beside the stylesheet. It fails with "CSS asset route
    is not portable", and its fix text asks the author to rename path
    segments (`crates/mokly-css/src/compiler_assets.rs:93`,
    `crates/mokly-css/src/paths.rs:20`).
  - With a bare alias key, such as `images`, the core delivers a decoy file
    at the literal relative path, when one exists.
  - A bare package URL, such as `url("leaflet/dist/images/layers.png")`,
    which the project's own Vite build finds in `node_modules`, also reaches
    the core as a path beside the stylesheet and fails.
- **Screenshot:** In a Canvas with a second logo at the literal relative
  path, mark the background that displays that logo.
- **Impact if no action:** A Vite project with aliased or package image and
  font URLs fails a Mokly build or delivers the wrong file, although its own
  Vite build works.
- **Root question:** Under the adapter, how does Mokly deliver the file that
  the Vite setup selects for a CSS `url()`, when that file is not beside the
  stylesheet?
- **Options:**
  - **A.** Keep the stylesheet-relative rule, and name the cause. In the URL
    branch, ask Vite's resolver whether it selects another file. When it
    does, fail the transform with a diagnostic that names the stylesheet and
    the URL and asks for a path relative to the stylesheet. Add the rule to
    `docs/protocol/mokly-vite-adapter-styles.md`, the row to
    `docs/protocol/mokly-imported-styles-errors.md`, and a sentence to
    `docs/guides/authoring/vite.md:110`. Cost: projects must change each
    aliased `url()`, although their own Vite build accepts it. A bare alias
    key that delivers a decoy file today then fails. That is a new build
    error, so the user must approve it. Effort: Small.
  - **B.** Apply the setup's aliases only. In the URL branch, run the alias
    step of the side's `ViteLookup`. Confine the target, and pass its path
    relative to the stylesheet, with the authored query and fragment,
    through the placeholder table. Test a top-level and a nested stylesheet,
    and a bare alias key with a decoy file at the relative path. Cost: B
    misses `resolve.tsconfigPaths` and the package lookup of Vite's CSS URL
    resolver. Effort: Medium.
  - **C.** Let Vite's full URL resolver select each target:
    - In the URL branch, resolve each local URL through
      `resolveViteStylesheet` with Vite's resolver, as the `@import` branch
      does.
    - When Vite selects the real path of the authored relative target, keep
      the authored path. The core then applies its link rule as now. Vite
      follows symbolic links, so this keeps the link rule of the asset
      contract.
    - When a setup alias gives an absolute path, pass that path, not Vite's
      real path, for the same reason.
    - Otherwise, pass the logical path of Vite's file, relative to the
      requested stylesheet, with the authored suffix.
    - Always pass the result through the placeholder table, and never give a
      real path back to Vite.
    - For a URL without an importer, such as a URL of a composed rule, apply
      the alias step only.
    - State the rule on the adapter styles page, and change the `url()`
      sentence at `docs/guides/authoring/vite.md:110`.
    - Test an `@` alias, a bare alias key with a decoy file at the relative
      path, and a bare package URL. Test them in a top-level and in a nested
      plain CSS file, and with the lightningcss transformer.
    - Cost: a package in a linked store, such as a pnpm store, still fails on
      the route rule, because its real path holds a `.pnpm` segment, under
      `docs/protocol/mokly-imported-styles-assets.md:57`. The adapter then
      accepts package URLs that the esbuild path rejects.
    - Effort: Medium.
  - **D.** One resolved asset record for each CSS URL: the referring
    stylesheet, the URL, and the file that Vite's full resolver selects. Both
    Vite CSS transformers give it to the core's delivery, and the core reads
    and confines each file itself. It is the record of option B of
    `plans/follow-ups/vite-composed-stylesheet-assets.md`. It also removes the
    text round trip that `plans/follow-ups/vite-nested-css-url-escapes.md`
    fixes. Cost: it waits for the answer to the composed stylesheet item.
    Effort: Large.
- **Left out:**
  - Copy the alias table into Rust. It fails the goal for a RegExp `find`,
    for an alias entry with a `customResolver`
    (`node_modules/vite/dist/node/index.d.ts:34`), and for
    `resolve.tsconfigPaths`. It also breaks the decision that Mokly keeps no
    copy of the setup, at `docs/protocol/mokly-vite-adapter.md:201`.
  - Keep the relative rule with a guide note only. A is better on every
    point, because with a note alone a bare alias key still delivers a decoy
    file in silence.
  - Pass Vite's browser URL straight through. It fails the goal, because
    Serve and the static output need a Mokly route and a confined file.
  - Let Vite rewrite the URLs, and map them back to files afterwards. It
    fails the goal, because Vite writes a data URL for a small `.svg` file.
  - Apply Mokly's own `moduleResolution.aliases` to CSS URLs under the
    adapter. It breaks the rejection of a second alias source, which stays.
  - A Mokly PostCSS plugin that rewrites aliased URLs. C is better on every
    point. Both CSS transformers call the one URL resolver (`node.js:29937`,
    `node.js:31432`), and the lightningcss transformer runs no PostCSS step.
  - Let Vite emit the asset bytes into Mokly's inventory. D is better on
    every point. Vite emits no asset under the `serve` command that Mokly
    uses, at `node.js:32615`, and the core must read each file from the base
    commit on the base side.
- **Wider fix:** C for this class. It asks Vite's own resolver for every
  local URL, so it still holds when the mapping changes shape: a RegExp
  alias, a `customResolver`, tsconfig paths, or a package. D is wider still,
  because it also removes the text round trip, and it stays the shared record
  with the composed stylesheet and nested URL items.
- **Previous examples:** The adapter already needed Vite's resolver for an
  aliased stylesheet `@import`. The `@import` branch at
  `packages/mokly/src/sidecar/vite-css-hooks.ts:56` is that fix.
- **Related:**
  - `plans/follow-ups/vite-composed-stylesheet-assets.md`: the same code,
    `ViteCssUrls.resolve`, and a shared wider fix. D here is its record, so D
    waits for its answer. A, B, and C use the same placeholder table as its
    options C and D. A composed rule reaches `resolve` with no importer, and
    line 58 then returns, so the alias step of B and C must run before that
    check.
  - `plans/follow-ups/vite-nested-css-url-escapes.md`: the same code. B and C
    put their targets into the replacement table at `vite-css-paths.ts:63`,
    which applies `encodeURI`. Build each replacement with one encoding
    function, or land C after its option C, so that an escaped query keeps
    its text.
  - `plans/follow-ups/vite-sass-outside-root-reads.md`: the same resolver
    override. Its option D also changes `configureViteCss`. Keep both changes
    on the one `ViteLookup`.
  - `plans/follow-ups/vite-rebased-css-url-links.md`: the same resolver
    override. The authored-path rule of C can also serve the rebase of a
    partial's `url()`.
  - `plans/follow-ups/workspace-import-resolution-record.md`: same code. C
    sends each URL through `resolveViteStylesheet`, so the Vite part of that
    record must also describe the URL lookups.
  - `plans/follow-ups/vite-base-workspace-export.md`: same code. C sends a
    bare package URL through the package lookup of `resolveViteStylesheet`,
    so the fix of that item must also cover it.
- **Recommendation:** C. It has the same Medium effort as B, and it reuses
  the lookup that the `@import` branch already uses. It also covers tsconfig
  paths and the package lookup, which the alias step of B misses. If the user
  keeps the relative rule, choose A, because it replaces the wrong fix text
  with a clear message. Choose D after the merge, with the composed
  stylesheet and nested URL items.
- **Action:** ask the user, because every option adds a CSS `url()` rule
  under the adapter that no requirement covers.
