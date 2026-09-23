# Markdown And MDX Docs

Status: active. Created 2026-09-23 with the user's consent after the design
discussion in this workspace. No milestone has started.

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
scheme in the desktop viewport. The generated fragments use the existing
fragment-path rule, so ownership, links, resource validation, the output
transaction, watch, export, publish, Changes membership, and removed previews
all reuse the page and screen paths. A frontmatter `parent` claim is resolved
at build time into the parent collection's manifest `childIds`, so the
manifest keeps a single hierarchy and the viewer's tree code is unchanged.
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
  source-inventory rules apply.
- Frontmatter is optional and parsed by Mokly, never by a remark plugin. The
  grammar is the guides grammar extended with JSON string arrays: single-line
  `key: value` fields where a value is a double-quoted JSON string or a JSON
  array of such strings. Accepted keys are `id`, `title`, `description`,
  `rationale`, `parent`, `tags`, `dependencies`, and `relatedDocs`. Unknown
  keys fail the build. There is no `order` field because the rail sorts
  alphabetically, and no `route` field.
- Derived values. The id is the glob-root-relative path with the extension
  removed, lowercased, segments joined by `-`, validated by the id grammar; a
  value that fails the grammar or collides with another id fails the build
  with guidance to rename the file or set a frontmatter id. The route is
  `docs/<glob-root-relative path>.html`, a reserved namespace like
  `user-flows/`. The title falls back to the first level-one heading and the
  description to the first paragraph; a file with neither fails the build.
- Hierarchy. A frontmatter `parent` names a collection id. The registry
  appends the doc id to that collection's manifest `childIds`. A parent that
  is unknown or not a collection fails at the doc's source path; a doc listed
  by one collection and parented to a different one fails through the
  existing multiple-parents rule; the same collection from both sources is
  accepted. A doc may also be claimed by `childIds` alone. An unclaimed doc is
  a catalogue root.
- Navigation. Docs are leaves in the Pages section with a doc icon. Within a
  collection the rank order is groups, then docs, then other leaves, each
  alphabetical. There is no separate Docs section.
- Appearance. In standalone Browse a doc follows the effective Auto/Light/Dark
  appearance exactly like a screen: Dark shows its dark fragment and Light its
  light fragment, with no separate control. In an embedded viewer the preview
  scheme control applies to docs as it does to screens. A doc always has a
  dark fragment when the catalogue has dark fragments, so the light-only
  fallback caption never applies to a doc. The viewport switch is hidden.
- Rendering. The renderer receives `entry.kind === "doc"`, the compiled MDX
  element as `node`, `viewport: "desktop"`, and each effective color scheme.
  Fragments are `<route>.desktop.html` and `<route>.desktop.dark.html`
  through the existing `fragmentRoute` rule. The default renderer adds a
  small built-in reading stylesheet for doc entries only; custom renderers own
  their doc template. Heading ids are generated by a Mokly-owned rehype step
  using the fragment grammar, so `mock:<doc-id>#<heading>` links validate.
- Manifest schema moves to v6, adding the `doc` kind with `route`,
  `fragments.desktop`, optional `darkFragments.desktop`, and optional `tags`.
  v5 remains readable at the Git boundary only. The public read model gains a
  `doc` entry kind; Milestone 1 decides its version under that document's
  own rule.
- Changes. A doc is a single-document-per-scheme entry: it is in Changes when
  its metadata, ancestry, generated fragments, or rendered resources changed;
  it shows Current only with no comparison; a removed doc shows its light
  document through the page removed-preview path. Prose diffs are deferred.
- Links. A `.md` file links with `[text](mock:<id>)`; an `.mdx` file may also
  use `MockLink`. A related-docs chip in Details becomes a link when its path
  is a registered doc's source file.
- Out of this plan: embed blocks for screens, components, and props tables;
  a Markdown element component map; a table of contents; prose diffs in
  Changes; full-text search of doc bodies; per-doc color-scheme opt-out;
  directory-derived collections; collections defined in Markdown. Each is
  listed under deferred follow-ups so it becomes its own plan.

**Spec:** [`docs/protocol/mokly-docs.md`](../docs/protocol/mokly-docs.md),
created by Milestone 1.

## Milestone 1: Documentation and protocol contract

Define the complete doc contract before any code changes so later milestones
need no guesswork.

- [ ] Create `docs/protocol/mokly-docs.md` covering discovery, frontmatter
      grammar, derived id/route/title/description, the parent claim and its
      failures, compile formats and the raw-HTML rule, the optional peer
      loading error, rendering input and fragments, the default reading
      stylesheet, heading-id generation, manifest v6 doc shape, Changes and
      removed-preview behavior, watch, export, and publication, with an
      Acceptance section.
- [ ] Update `docs/protocol/mokly-configuration.md` with `docs` and `docsDir`,
      their validation, and the exactly-one rule mirroring `entries`.
- [ ] Update `docs/protocol/mokly-authoring.md` for the `doc` kind, the
      exported `DocDefinition` type, and the `docs/` reserved route namespace.
- [ ] Update `docs/protocol/mokly-rendering.md` and
      `docs/architecture/build-pipeline.md` for the doc render input, the
      desktop-only viewport, and the MDX compile step in the consumer graph.
- [ ] Update `docs/protocol/mokly-pages.md` to state the page/doc boundary.
- [ ] Update `docs/protocol/mokly-catalogue.md`, `docs/protocol/README.md`
      supported-formats table, and `docs/protocol/fixtures/catalogue-v1.json`
      for manifest v6 and the read-model doc entry, deciding the read-model
      version.
- [ ] Update `docs/protocol/mokly-changes.md`,
      `docs/protocol/mokly-catalogue-changes.md`, and
      `docs/protocol/mokly-removed-previews.md` for doc membership and the
      removed doc preview.
- [ ] Update `docs/protocol/mokly-shell-design.md`: rail rules for the doc
      leaf and rank, the doc stage that follows the effective appearance with
      no viewport switch, the details rows, the home count, and four new
      mockup table rows under `design/browse/docs/` with their owning-group
      note and both-schemes rendering.
- [ ] Update `docs/protocol/mokly-viewer-appearance.md` so doc frames follow
      the effective preview scheme, receive the managed-frame `color-scheme`,
      and keep the embedded preview control.
- [ ] Update `docs/protocol/mokly-navigation.md`,
      `docs/protocol/mokly-watch.md`, `docs/protocol/mokly-export.md`,
      `docs/protocol/mokly-publication.md`, and
      `docs/protocol/mokly-package.md` for doc routes, watched doc files,
      exported fragments, and the optional peer dependencies.
- [ ] Update `docs/protocol/dependency-security.md` with the optional peer
      policy and the packed-consumer audit with and without the peers.
- [ ] Add `docs/guides/authoring/docs.md` after Pages and renumber the later
      authoring guides; update `docs/protocol/mokly-guides.md` if the section
      table needs a docs mention.
- [ ] Update the root `README.md` authoring table, `packages/viewer/README.md`,
      `src/build/README.md`, `src/config` documentation, and
      `examples/basic/README.md`.
- [ ] Validate the changed Markdown with `npx prettier --check` and the guide
      tests, review the diff, commit, and push.

## Milestone 2: Design mockups

Tags: mockup

Add the doc screens to the design catalogue under `examples/basic` before any
viewer change, reusing the existing shell, navigation, details, and stage
parts.

- [ ] Extend the `catalogue-navigation` library component's row kind enum and
      the shared navigation fixture with a `doc` row and icon, keeping every
      existing depicted tree unchanged except for the added row.
- [ ] Add `design/browse/docs/view.html`: a doc in its collection at reading
      width with no viewport switch, the shared top bar with its one
      Appearance selector, rendered in both schemes, mobile and desktop
      variants, one screen component.
- [ ] Add `design/browse/docs/details.html`: Generated fragments, Schemes,
      Tags, a linked related-doc chip, and Dependencies rows.
- [ ] Add `design/browse/docs/navigation.html`: the narrow drawer open on a
      doc row.
- [ ] Add `design/browse/docs/removed.html`: a removed doc's previous version
      with baseline ancestry.
- [ ] Update the existing home mockup count line with a docs figure.
- [ ] Register the screens in the design catalogue so each is reachable from
      the Browse design collections, then run `npm run build`,
      `npm run example:build`, `npm run example:check`, the design catalogue
      tests, and smoke-test the pages through `npm run dev`.
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
      guides grammar, rejects unknown keys and malformed values, and returns
      typed metadata plus the body offset for diagnostics.
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

Turn discovered docs into catalogue entries with a single hierarchy.

- [ ] Add the `doc` definition kind, its resolved registry shape, source
      attribution to the file path, and the exported `DocDefinition` type.
- [ ] Derive id, route, title, and description with the locked rules and
      diagnostics that name the file and the frontmatter override.
- [ ] Resolve `parent` claims into collection `childIds` before the existing
      tree validation; add unknown-parent and non-collection-parent
      violations; keep the existing multiple-parents error for conflicts.
- [ ] Validate tags, dependencies, related docs, and the `docs/` route
      namespace with the shared validators; reject doc routes that collide
      with any logical route or fragment.
- [ ] Write manifest v6 with the doc entry and fragments; update the manifest
      validators, the viewer data-layer types and entry reader, the public
      read model, the compatibility readers so v5 stays readable at the Git
      boundary, and the protocol fixture bytes.
- [ ] Tests: derivation, collisions, parent resolution and each failure,
      unclaimed roots, manifest shape and determinism, v5 baseline reading,
      and read-model conformance.
- [ ] Commit and push.

## Milestone 5: Rendering, build, and delivery

Render docs and carry them through every delivery path.

- [ ] Extend the renderer input union with `DocDefinition`; render each doc
      once per effective scheme in the desktop viewport through the consumer
      renderer, with the stylesheet rules matched by the doc route.
- [ ] Add the default renderer's built-in reading stylesheet for docs.
- [ ] Run doc output through the child-control adapter, logical-link and
      fragment validation, compatibility transformer, ownership header,
      resource validation, and the output transaction; trust owners matched
      by a `docs` glob for cleanup.
- [ ] Support `mock:` links from docs to screens and from screens to docs,
      including heading fragments validated against the final documents.
- [ ] Extend Serve on-demand compilation so a requested doc fragment renders
      per scheme, and extend watch so adding, editing, or removing a doc file
      rediscovers and rebuilds before notification.
- [ ] Extend Changes: doc membership from metadata, ancestry, fragments, and
      resources; changed-route detection; the removed doc preview through the
      page preview path.
- [ ] Extend export, publication, and publish so doc fragments, id redirects,
      and shell routes are included and removed docs follow the opt-in rule.
- [ ] Add docs to `examples/basic`: a `docs` glob in the config, a spec doc
      parented to the Example collection, an unclaimed `.mdx` doc that imports
      `MockLink`, the `.md` regression fixture, a `docs/**` stylesheet rule,
      and registration of the example notes so the Welcome related-doc chip
      resolves to a doc.
- [ ] Tests: build output and ownership, links both ways with fragments,
      on-demand rendering, watch lifecycle, Changes membership, removed
      preview, export and publish inventories, and the example catalogue.
- [ ] Smoke: `npm run dev`, open a doc, change the Appearance control, follow
      a link to a screen and back, edit the file and confirm the reload.
- [ ] Commit and push.

## Milestone 6: Viewer shell

Tags: ui

Show docs in the shell as specified by the mockups.

- [ ] Add the `doc` leaf kind, icon, and rank to the navigation tree, glyph,
      and section projection; treat a removed doc like a removed page in the
      rail.
- [ ] Add the doc stage: the single-document frame at reading width that
      follows the effective appearance in standalone Browse, honours the
      embedded preview scheme control, sets the managed frame `color-scheme`,
      hides the viewport switch, and keeps fragment restoration and
      Back/Forward behavior.
- [ ] Add details rows: Generated fragments, Schemes, and the related-doc chip
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
      match the delivered behavior.
- [ ] Run `cargo xtask check` to completion with no failures.
- [ ] Run `git add -A`, commit with a Conventional Commits message, and push.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md` and report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Run the published package against a real consumer repository with a docs
  folder and record any authoring friction.
- Coordinate the cloud reader's manifest v6 and read-model update with the
  private cloud repository.

## Deferred follow-ups (separate plans)

- Embed blocks for docs: a screen block, a component block, and a props table
  block, plus a Markdown element component map for consumer typography.
- Prose diffs for changed docs in Changes, with per-scheme evidence marks on
  the scheme switch.
- A table of contents in the doc stage.
- Full-text search of doc bodies.
- Per-doc color-scheme opt-out.
- Directory-derived collections and collections defined in Markdown.
