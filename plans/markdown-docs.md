# Markdown And MDX Docs

Status: active. Created 2026-09-23 with the user's consent after the design
discussion in this workspace. Rebased onto `origin/main` on 2026-10-01 after
the navigation-path, id-derived-route, variant, and delta-publishing changes
merged; the hierarchy, route, schema-version, publish, and mockup-inventory
decisions below were rewritten to match those contracts. On 2026-10-01 the
user chose plain alphabetical ordering over a docs-first rank and confirmed
that placement stays frontmatter `navPath` plus id until a later plan adds
filesystem-derived paths. No milestone has started.

**Goal:** Let a consumer drop Markdown (`.md`) and MDX (`.mdx`) files into
their repository, describe the product and its specification in prose, and
have Mokly show each file as a catalogue entry beside the screens it
describes. A doc reads at a comfortable width in both catalogue color
schemes, links to screens and components with the existing catalogue link
grammar, appears in navigation, search, details, and Changes, exports with the
rest of the catalogue, and is reachable from the screens that name it.

**Architecture:** A doc is a new routed entry kind, `doc`, discovered from a
`docs` glob rather than defined in TypeScript. Mokly strips the file's
frontmatter, compiles the body to a React component inside the existing
consumer esbuild graph with the MDX compiler, and renders that component
through the consumer renderer exactly like a screen, once per effective color
scheme in the desktop viewport. Its paths derive from kind and id under the
[artifact path contract](../docs/protocol/mokly-artifact-paths.md), so
ownership, links, resource validation, the output transaction, watch, export,
publish, Changes membership, and removed previews all reuse the page and
screen paths. Its place in navigation is a frontmatter `navPath`, the same
field every other leaf carries under the
[navigation path contract](../docs/protocol/mokly-nav-paths.md), so the
hierarchy analysis, folder keys, breadcrumbs, and public tree are unchanged.
The viewer adds a doc leaf, a doc stage, and a doc count.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

- MDX component pipeline, not an HTML-string pipeline. Mokly owns an esbuild
  plugin that calls the MDX compiler directly: `.md` compiles in the compiler's
  `md` format, which disables JSX, expressions, and ESM so a plain Markdown
  file with `{` or `<` in its text never fails; `.mdx` compiles in `mdx`
  format and may import `MockLink`, `ReviewIgnore`, or product components.
  Raw HTML written in a file is dropped by the compiler and documented as
  unsupported; Mokly adds no sanitizer.
- `@mdx-js/mdx` and `remark-gfm` are optional peer dependencies. Mokly loads
  them dynamically only when `docs` is configured and fails with a
  `config-invalid` error naming the install command when they are missing. The
  repository adds both as development dependencies for tests and the example.
- Discovery uses a new `docs` glob list, or the `docsDir` shorthand that
  expands to `<dir>/**/*.{md,mdx}`, separate from `entries`. The same root
  projection, private-directory exclusion, zero-match failure, and
  source-inventory rules apply. Docs are never members of a `defineRoot` tree.
- Frontmatter is optional and parsed by Mokly, never by a remark plugin. The
  grammar is the guides grammar extended with JSON string arrays: single-line
  `key: value` fields where a value is a double-quoted JSON string or a JSON
  array of such strings. Accepted keys are `id`, `title`, `description`,
  `rationale`, `navPath`, `tags`, `dependencies`, and `relatedDocs`. Unknown
  keys fail the build, including `route`, `parent`, `order`, `variants`, and
  `variantOf`.
- Derived values. The id is the glob-root-relative path with the extension
  removed, lowercased, segments joined by `-`, validated by the id grammar; a
  value that fails the grammar or collides with another id fails the build
  with guidance to rename the file or set a frontmatter id. The title falls
  back to the first level-one heading and the description to the first
  paragraph; a file with neither fails the build. Nothing else is derived
  from the path: the route is `docs/<id>.html` and the generated views are
  `docs/<id>.desktop[.dark].html` from the shared path functions, so a file
  renamed without a frontmatter id changes its id and every path, and Changes
  shows a removal plus an addition.
- Navigation path. A frontmatter `navPath` places the doc exactly as the
  authored field places a flat screen; omitting it places the doc at the top
  of the Pages section. Directory names never contribute labels. Labels,
  merging, case-folded sibling conflicts, and the leaf-versus-folder conflict
  follow the navigation path contract with no doc-specific rule. There is no
  separate Docs section.
- Ordering. A doc is an ordinary leaf under the existing sibling comparator:
  folders first, then leaves alphabetical by label. No doc rank is added.
- Variants. A doc declares neither `variants` nor `variantOf`; both keys are
  rejected under the existing variant contract.
- Appearance. In standalone Browse a doc follows the effective Auto/Light/Dark
  appearance exactly like a screen: Dark shows its dark view and Light its
  light view, with no separate control. In an embedded viewer the preview
  scheme control applies to docs as it does to screens. A doc always has a
  dark view when the catalogue has dark fragments, so the light-only
  fallback caption never applies to a doc. The viewport switch is hidden.
- Rendering. The renderer receives `entry.kind === "doc"`, the compiled MDX
  element as `node`, `viewport: "desktop"`, and each effective color scheme.
  The default renderer adds a small built-in reading stylesheet for doc
  entries only; custom renderers own their doc template. Heading ids are
  generated by a Mokly-owned rehype step using the fragment grammar, so
  `mock:<doc-id>#<heading>` links validate.
- Schema. The manifest moves to v8 and the public read model to v4, because
  each gains the `doc` union discriminant and the read model gains
  `preview.kind: "doc"`. Review result v4 is unchanged. Readers accept only
  v8, so a v7 comparison base is incompatible earlier output under the
  [baseline compatibility contract](../docs/protocol/mokly-baseline-compatibility.md)
  and Changes reports unavailable with the existing product line. The
  implementation commit uses `feat!:` with a `BREAKING CHANGE:` footer.
- Changes. A doc is in Changes when its reviewable metadata, `navPath`,
  generated views, or rendered resources changed; it shows Current only with
  no comparison; a removed doc shows its previous light desktop view through
  the page previous-version path generalized to single-document entries.
  Prose diffs are deferred.
- Links. A `.md` file links with `[text](mock:<id>)`; an `.mdx` file may also
  use `MockLink`. The shared view-path parser accepts the `docs/` prefix. A
  related-docs chip in Details becomes a link when its path is a registered
  doc's source file.
- Publish. The content-addressed upload exchange needs no change: doc views
  are ordinary files in the export ownership marker with their own digests.
- Out of this plan: embed blocks for screens, components, and props tables;
  a Markdown element component map; a table of contents; prose diffs in
  Changes; full-text search of doc bodies; per-doc color-scheme opt-out;
  filesystem-derived `navPath`, which the navigation path plan deferred with
  the three rules a later plan must settle; and folders defined in Markdown.
  Each is listed under deferred follow-ups so it becomes its own plan.

**Spec:** [`docs/protocol/mokly-docs.md`](../docs/protocol/mokly-docs.md),
created by Milestone 1. Protocol documents never record milestone numbers; the
repository test that enforces this applies to the new document.

## Milestone 1: Documentation and protocol contract

Define the complete doc contract before any code changes so later milestones
need no guesswork.

- [ ] Create `docs/protocol/mokly-docs.md` covering discovery, frontmatter
      grammar, derived id/title/description, `navPath` placement, compile
      formats and the raw-HTML rule, the optional peer loading error,
      rendering input and views, the default reading stylesheet, heading-id
      generation, the manifest v8 doc shape, Changes and removed-preview
      behavior, watch, export, and publication, with an Acceptance section.
- [ ] Update `docs/protocol/mokly-configuration.md` with `docs` and `docsDir`,
      their validation, and the exactly-one rule mirroring `entries`.
- [ ] Update `docs/protocol/mokly-authoring.md` for the `doc` kind, the
      exported `DocDefinition` type, and the statement that docs are
      discovered files outside nested trees.
- [ ] Update `docs/protocol/mokly-artifact-paths.md`: `EntryKind` and
      `ViewKind` gain `doc`, the tables gain `docs/<id>.html` and
      `docs/<id>.desktop[.dark].html`, the view-path parser accepts the
      `docs/` prefix, and the removed-doc snapshot path is named.
- [ ] Update `docs/protocol/mokly-nav-paths.md` for docs in the Pages section
      as ordinary leaves, and `docs/protocol/mokly-variants.md` for the
      rejected keys.
- [ ] Update `docs/protocol/mokly-rendering.md`,
      `docs/protocol/mokly-component-manifest.md` (manifest v8 entry shape
      with the fifth kind), and `docs/architecture/build-pipeline.md` for the
      doc render input, the desktop-only viewport, and the MDX compile step in
      the consumer graph.
- [ ] Update `docs/protocol/mokly-pages.md` to state the page/doc boundary
      beside its "no parallel discovery" sentence.
- [ ] Update `docs/protocol/mokly-catalogue.md` for read model v4 with
      `CatalogueDoc` and `preview.kind: "doc"`, replace
      `docs/protocol/fixtures/catalogue-v3.json` with `catalogue-v4.json`,
      update the `docs/protocol/README.md` supported-formats table, and move
      the `docs/protocol/mokly-baseline-compatibility.md` gate to v8.
- [ ] Update `docs/protocol/mokly-changes.md`,
      `docs/protocol/mokly-catalogue-changes.md`,
      `docs/protocol/mokly-removed-previews.md`, and
      `docs/protocol/mokly-removed-preview-acceptance.md` for doc membership
      and the removed doc preview.
- [ ] Update `docs/protocol/mokly-shell-design.md`: rail rules for the doc
      leaf, the doc stage that follows the effective appearance with
      no viewport switch, the details rows, the home count, and four inventory
      rows `design-doc-view`, `design-doc-details`, `design-doc-navigation`,
      and `design-doc-removed` in the Browse shell › Specification docs
      folder, rendered in both schemes, with their owning-group note.
- [ ] Update `docs/protocol/mokly-viewer-appearance.md` so doc frames follow
      the effective preview scheme, receive the managed-frame `color-scheme`,
      and keep the embedded preview control.
- [ ] Update `docs/protocol/mokly-navigation.md`,
      `docs/protocol/mokly-watch.md`, `docs/protocol/mokly-export.md`,
      `docs/protocol/mokly-export-browser.md`,
      `docs/protocol/mokly-export-safety.md`,
      `docs/protocol/mokly-publication.md`, and
      `docs/protocol/mokly-package.md` for doc view paths in inventories,
      watched doc files, shell documents at `/view/docs/<id>`, and the
      optional peer dependencies; confirm the upload contracts need no change.
- [ ] Update `docs/protocol/dependency-security.md` with the optional peer
      policy and the packed-consumer audit with and without the peers.
- [ ] Add `docs/guides/authoring/docs.md` after Pages and renumber the later
      authoring guides; update `docs/protocol/mokly-guides.md` if the section
      table needs a docs mention.
- [ ] Update the root `README.md` authoring table, `packages/viewer/README.md`,
      `src/build/README.md`, `src/config` documentation, and
      `examples/basic/README.md`.
- [ ] Validate the changed Markdown with `npx prettier --check`, run the
      guides and protocol-history tests, review the diff, commit, and push.

## Milestone 2: Design mockups

Tags: mockup

Add the doc screens to the design catalogue under `examples/basic` before any
viewer change, reusing the existing shell, navigation, details, and stage
parts.

- [ ] Extend the `catalogue-navigation` library component's row kind enum and
      the shared navigation fixture with a `doc` row and icon, keeping every
      existing depicted tree unchanged except for the added row.
- [ ] Add `design-doc-view`: a doc in its folder at reading width with no
      viewport switch, the shared top bar with its one Appearance selector,
      rendered in both schemes, mobile and desktop variants, one screen
      component.
- [ ] Add `design-doc-details`: Generated views, Schemes, Tags, a linked
      related-doc chip, and Dependencies rows.
- [ ] Add `design-doc-navigation`: the narrow drawer open on a doc row.
- [ ] Add `design-doc-removed`: a removed doc's previous version with its
      baseline folder labels.
- [ ] Update the existing home mockup count line with a docs figure.
- [ ] Register the screens with `navPath` under the design root so each is
      reachable from the Browse shell folders, update the inventory agreement
      test, then run `npm run build`, `npm run example:build`,
      `npm run example:check`, the design catalogue tests, and smoke-test the
      screens through `npm run dev`.
- [ ] Commit and push.

## Milestone 3: Configuration, discovery, and the MDX toolchain

Discover doc files, parse frontmatter, and compile bodies inside the consumer
graph. At the end of this milestone docs are validated inputs with no
catalogue effect yet.

- [ ] Add `docs` and `docsDir` to the config types, `defineConfig`,
      validation, and path policy, reusing the entry glob helpers.
- [ ] Extend discovery to project doc glob roots, walk them with the same
      exclusions and error precedence, fail an empty glob, and return the
      sorted doc file set beside the entry modules.
- [ ] Add a frontmatter module that strips the block, parses the extended
      guides grammar including the `navPath` array, rejects unknown keys and
      malformed values, and returns typed metadata plus the body offset for
      diagnostics.
- [ ] Add the optional peer loader for `@mdx-js/mdx` and `remark-gfm` with a
      `config-invalid` error naming `npm install -D @mdx-js/mdx remark-gfm`.
- [ ] Add a Mokly-owned esbuild plugin that loads matched doc files, strips
      frontmatter, compiles with `format` chosen by extension, GFM tables,
      the consumer JSX runtime, and the heading-id rehype step, and returns
      JavaScript to the bundle.
- [ ] Add the doc files to the virtual consumer entry and the source
      inventory; confirm the compiled output imports the consumer React.
- [ ] Add `@mdx-js/mdx` and `remark-gfm` as optional peer dependencies and as
      development dependencies; record the audit in the dependency policy.
- [ ] Tests: config validation, shorthand expansion, discovery ordering and
      exclusions, frontmatter grammar and errors, a `.md` regression fixture
      containing `{`, `<`, and an `import` line that compiles as Markdown, an
      `.mdx` fixture importing `MockLink`, the missing-peer error, and the
      React runtime identity.
- [ ] Commit and push.

## Milestone 4: Doc entries in the registry and manifest

Turn discovered docs into catalogue entries that the shared hierarchy and path
rules already understand.

- [ ] Add the `doc` definition kind, its resolved registry shape, source
      attribution to the file path, and the exported `DocDefinition` type.
- [ ] Derive id, title, and description with the locked rules and diagnostics
      that name the file and the frontmatter override; take `navPath` from
      frontmatter with `[]` as the default.
- [ ] Run docs through the shared id, tag, dependency, related-doc, and
      navigation path validation, including the sibling label conflicts and
      the leaf-versus-folder conflict, and reject `variants` and `variantOf`.
- [ ] Extend the shared path functions in `@mokly/viewer/data` with the `doc`
      kind, its entry route, its views, the parser prefix, and the removed-doc
      snapshot path; add the case-folded output collision check for doc views.
- [ ] Write manifest v8 with the doc entry; update the manifest validators,
      the viewer data-layer types and entry reader, read model v4, the
      baseline compatibility gate, and the protocol fixture bytes.
- [ ] Tests: derivation, collisions, `navPath` placement and each conflict,
      top-level docs, alphabetical placement among sibling leaves, manifest
      shape and determinism, the v7 base reported as incompatible, and
      read-model conformance.
- [ ] Commit and push.

## Milestone 5: Rendering, build, and delivery

Render docs and carry them through every delivery path.

- [ ] Extend the renderer input union with `DocDefinition`; render each doc
      once per effective scheme in the desktop viewport through the consumer
      renderer, with the stylesheet rules matched by the doc's derived view
      route.
- [ ] Add the default renderer's built-in reading stylesheet for docs.
- [ ] Run doc output through the child-control adapter, logical-link and
      fragment validation, compatibility transformer, ownership header,
      resource validation, and the output transaction; trust owners matched
      by a `docs` glob for cleanup.
- [ ] Support `mock:` links from docs to screens and from screens to docs,
      including heading fragments validated against the final documents.
- [ ] Extend Serve on-demand compilation so a requested doc view renders per
      scheme, and extend watch so adding, editing, or removing a doc file
      rediscovers and rebuilds before notification.
- [ ] Extend Changes: doc membership from metadata, `navPath`, views, and
      resources; changed-id detection; the removed doc preview through the
      page previous-version path generalized to single-document entries.
- [ ] Extend export and publication so doc views, shell documents at
      `/view/docs/<id>`, and inventories are included and removed docs follow
      the opt-in rule; confirm publish needs no exchange change because doc
      views are ordinary marker entries.
- [ ] Add docs to `examples/basic`: a `docs` glob in the config, a spec doc
      with `navPath` beside the Example screens, a top-level `.mdx` doc that
      imports `MockLink`, the `.md` regression fixture, a `docs/**` stylesheet
      rule, and registration of the example notes so the Welcome related-doc
      chip resolves to a doc.
- [ ] Tests: build output and ownership, links both ways with fragments,
      on-demand rendering, watch lifecycle, Changes membership, removed
      preview, export and publish inventories, and the example catalogue.
- [ ] Smoke: `npm run dev`, open a doc, change the Appearance control, follow
      a link to a screen and back, edit the file and confirm the reload.
- [ ] Commit and push.

## Milestone 6: Viewer shell

Tags: ui

Show docs in the shell as specified by the mockups.

- [ ] Add the `doc` leaf kind and icon to the navigation tree, glyph, and
      section projection; treat a removed doc like a removed page in the
      rail.
- [ ] Add the doc stage: the single-document frame at reading width that
      follows the effective appearance in standalone Browse, honours the
      embedded preview scheme control, sets the managed frame `color-scheme`,
      hides the viewport switch, and keeps fragment restoration and
      Back/Forward behavior.
- [ ] Add details rows: Generated views, Schemes, and the related-doc chip
      link when the path is a doc source.
- [ ] Add the docs figure to the home count and the search rows.
- [ ] Route the removed doc through the previous-version presentation.
- [ ] Tests: viewer unit tests for the tree, details, stages, and copy;
      browser tests for navigation, the Appearance control in standalone and
      the preview control when embedded, link following, search, the Changes
      filter, and the removed preview in Serve and export.
- [ ] Commit and push.

## Milestone 7: Verification, release readiness, and review

- [ ] Extend the packed-consumer smoke with a consumer that configures docs
      and installs the peers, and one that does not configure docs and does
      not install them.
- [ ] Confirm every guide, protocol index, README, and the example README
      match the delivered behavior, and that the new public exports and new
      files satisfy the repository verification ratchets.
- [ ] Run `cargo xtask check` to completion with no failures.
- [ ] Run `git add -A`, commit with a Conventional Commits message, and push.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md` and report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Run the published package against a real consumer repository with a docs
  folder and record any authoring friction.
- Coordinate the cloud reader's manifest v8 and read model v4 update with the
  private cloud repository.

## Deferred follow-ups (separate plans)

- Embed blocks for docs: a screen block, a component block, and a props table
  block, plus a Markdown element component map for consumer typography.
- Prose diffs for changed docs in Changes, with per-scheme evidence marks.
- A table of contents in the doc stage.
- Full-text search of doc bodies.
- Per-doc color-scheme opt-out.
- Filesystem-derived `navPath` for docs, settling the three rules the
  navigation path plan recorded: how directory names become labels, a
  per-glob prefix for multiple roots, and precedence over frontmatter.
- Folders defined in Markdown.
