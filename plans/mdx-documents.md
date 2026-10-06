# MDX Documents

Status: Active. Created 2026-10-06 with the user's consent. It replaces the
unmerged Markdown and MDX docs plan from this workspace, which
[PR #131](https://github.com/mokly-ai/mokly/pull/131) superseded on
2026-10-05 by delivering Markdown documents under the
[path identity plan](./path-identity.md). That earlier plan, its contract
draft, and its four mockups stay on the backup branch
`calummoore/nassau-before-path-identity` as history. No milestone has started.

**Goal:** Let a consumer write a document as an `.mdx` file beside its `.md`
documents, so prose can embed the product's own React components. An MDX
document is a document in every other way: the same path, folder, front
matter, icon, Details, links, Changes, moves, removed preview, and export.

**What main already delivers:** every `.md` file a root matches is an entry
of kind `document`. Mokly renders it with `marked` into a package-owned
template, one light document and one dark document per path, validated by the
[document safety allowlist](../docs/protocol/mokly-document-safety.md). The
[documents contract](../docs/protocol/mokly-documents.md) owns discovery,
front matter, titles, rendering, links, resources, and Changes. `.mdx` files
are not recognised; a root glob that matches one treats it as an entry module
and fails. This plan adds the MDX branch and changes nothing about `.md`.

**Architecture:** Discovery classifies a matched `.mdx` file as an MDX
document. The consumer graph imports each one, and a Mokly-owned esbuild
plugin compiles it with the consumer-resolved MDX compiler into a React
component: front matter is stripped with the shared parser, Markdown-syntax
links and images are resolved with the shared document destination rules,
and headings receive the shared GitHub-style ids. Mokly renders the component
through the consumer renderer, once per effective colour scheme in the desktop
viewport, wrapped in a Mokly document body that carries the same typography
and palette as the Markdown template. The output is validated as a screen
view, not with the Markdown safety allowlist, because embedded components
emit product markup. The manifest, the public read model, the review result,
and the viewer do not change.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider; decision 3 needs confirmation before Milestone 3):**

1. **Scope.** MDX only. `.md` documents keep the delivered `marked` pipeline
   and the Mokly template. Nothing in this plan changes how a `.md` file is
   discovered, rendered, validated, or compared.
2. **One kind.** An MDX document is kind `document`. Its path, leaf, index
   detection, front matter grammar and keys, title and description fallbacks,
   tags, and `movedFrom` follow the documents contract unchanged. The leaf is
   the file name up to its first `.`; `README.mdx` and `index.mdx` are index
   documents; a `.md` and an `.mdx` file with one leaf in one directory are a
   duplicate path, or a duplicate index. Manifest v8, read model v4, and
   review result v5 are unchanged: an MDX document is recorded as a document
   whose `sourcePath` ends in `.mdx`.
3. **Rendering.** The consumer renderer renders an MDX document exactly as it
   renders a screen view: `entry` is a public `DocumentDefinition`, `viewport`
   is `"desktop"`, `colorScheme` is each effective scheme, `stylesheets` are
   the rules matched by the document's route, and `node` is Mokly's document
   body wrapper around the compiled component. The wrapper scopes the Markdown
   template's typography and palette to the document body for the requested
   scheme, so an MDX document in the neutral renderer reads exactly like a
   `.md` document, and a custom renderer adds its providers and theme. Output
   passes the screen validation path: ownership header, child-control
   adapter, logical links, compatibility transformer, HTML/CSS/resource
   validation, Review-ignore validation, and the output transaction. The
   Markdown safety allowlist does not apply. Because both schemes always
   render when the catalogue enables dark, the `Light only` band never shows
   for an MDX document.
4. **Links and resources.** A Markdown-syntax link or image in an MDX file
   follows the documents contract: a relative path to a discovered document
   becomes a catalogue link, a resource is copied beside the folder, a source
   file renders as text, a missing target fails, and `mock:` names an entry.
   A JSX link or image follows the screen rules: `MockLink`, `mock:` hrefs,
   and public resources under `mockupsDir`. Raw HTML in an MDX file is JSX;
   invalid JSX fails the compile with the compiler's message.
5. **Toolchain.** `@mdx-js/mdx` and `remark-gfm` are optional peer
   dependencies of `@mokly/mokly`, resolved from the config file's location
   with the consumer resolution used for React, and loaded only when an
   `.mdx` file is discovered. When one is missing the build fails with
   `build-invalid`; the exact line, with the file as `<location>`, is
   `<location>: MDX documents need the MDX compiler; run npm install -D @mdx-js/mdx remark-gfm`.
   This repository lists both as development dependencies. The compiler runs
   in `mdx` format with GitHub
   tables, task lists, strikethrough, and autolinks, and uses the consumer
   React automatic JSX runtime through the existing React resolver.
6. **Discovery.** The default root `files` globs gain `**/*.mdx`. A consumer
   with explicit `files` adds the glob itself. An `.mdx` file is never an
   entry module.
7. **Component usage.** An MDX document records no component usage and no
   `componentViews`, like a page. A change to an imported component changes
   the rendered document, so material comparison still marks the document
   changed. Usage records for documents are a deferred follow-up.
8. **Moves.** MDX documents pair like documents: an authored `movedFrom`,
   identical normalised rendered content, the same source file and title, and
   the similarity score over the MDX source body after front matter.
9. **No viewer change.** The shell already shows documents with the document
   icon, path chip, Details, Related docs links, and the home count. No
   milestone touches `packages/viewer`.
10. **Mockup.** One light-only screen, `design/browse/pages/mdx/document`,
    depicts a branch where `payment-terms.md` became `payment-terms.mdx` and
    embeds the example's Action component. It adds no row to the depicted
    catalogue, so every other artboard is unchanged.
11. **No compatibility layer.** Before this plan an `.mdx` match was an
    invalid entry module; after it, it is a document. Nothing translates.

**Out of this plan, listed as deferred follow-ups:** an MDX component map
for consumer typography; embed blocks for screens, components, and props
tables; usage records for documents; a table of contents; prose comparisons;
body search; and `.markdown` as a second Markdown extension.

**Spec:** [`docs/protocol/mokly-documents-mdx.md`](../docs/protocol/mokly-documents-mdx.md),
created by Milestone 1 as a companion of the documents contract. Protocol
documents never record milestone numbers; `tests/protocol_doc_history.test.ts`
enforces this.

## Milestone 1: Contract documentation

Define the complete MDX contract before any code changes. Documentation only:
validate the Markdown and review the diff instead of running
`cargo xtask check`. Uncapped protocol documents stay at or below 250 lines;
capped ones keep their exact line count.

- [ ] Add `docs/protocol/mokly-documents-mdx.md`: discovery and the default
      glob, the index and duplicate rules, the compiler as an optional peer
      and its exact missing-compiler line, front matter reuse, compile format
      and plugins, heading ids, the two link rules, the render input and the
      document body wrapper, the screen validation path, both schemes and the
      absent `Light only` band, no usage records, Changes, moves, removed
      previews, watch, export, publication, and an Acceptance section.
- [ ] Update `docs/protocol/mokly-documents.md`: recognise `.mdx` in
      Discovery with a pointer to the companion, and point to it from
      Rendering; keep the file at or below 250 lines.
- [ ] Update `docs/protocol/mokly-document-safety.md`: the allowlist applies
      to Markdown documents only; MDX documents pass the screen validation
      path.
- [ ] Update `docs/protocol/mokly-paths.md` (the roots default `files` and
      "a matched `.mdx` file is an MDX document"),
      `docs/protocol/mokly-entry-modules.md` (an `.mdx` file is never an
      entry module), and `docs/protocol/mokly-configuration.md` and its
      discovery companion with net-zero edits to the default globs.
- [ ] Update `docs/protocol/mokly-rendering.md`: `RenderInput.entry` gains
      `DocumentDefinition`, with `viewport: "desktop"`, no `componentProps`,
      and the document body wrapper as `node`.
- [ ] Update `docs/protocol/mokly-component-manifest.md` (an MDX document is
      a document whose `sourcePath` ends in `.mdx`; no new field),
      `docs/protocol/mokly-moves.md` (the MDX source body feeds similarity),
      and `docs/protocol/mokly-changes.md` only if a sentence excludes MDX.
- [ ] Update `docs/protocol/mokly-package.md` (the exported
      `DocumentDefinition` type and the optional peers) and
      `docs/protocol/dependency-security.md` (optional peers are outside the
      production tree; the workspace lists them as development dependencies;
      the packed-consumer audit runs with and without them).
- [ ] Update `docs/protocol/mokly-shell-design-inventory.md` with the
      `design/browse/pages/mdx/document` row and its owning-group note, and
      `docs/protocol/mokly-shell-design-catalogue.md` with the depicted MDX
      branch; keep `docs/protocol/mokly-design-links.md` at its cap with a
      net-zero edit if the screen needs a transition.
- [ ] Update `docs/architecture/build-pipeline.md` for the MDX compile step
      in the consumer graph and the document render path.
- [ ] Update the guides: an "MDX documents" section in
      `docs/guides/authoring/pages.md` with `DocumentDefinition` in its
      exported types table, the default globs in
      `docs/guides/authoring/config.md` and `docs/guides/start/configure.md`,
      and one sentence in `docs/guides/authoring/links.md`; keep every guide
      near 200 lines.
- [ ] Update the root `README.md` quick start sentence that names `.md`
      files, and `src/documents/README.md` for the MDX modules.
- [ ] Run `npx prettier --check` on the changed Markdown, run
      `tests/protocol_doc_sizes.test.ts`, `tests/protocol_doc_history.test.ts`,
      `tests/protocol_structure.test.ts`, `tests/markdown_links.test.ts`, and
      the guide tests, review the diff, commit, and push.

## Milestone 2: Design mockup

Tags: mockup

Add the MDX document screen to the design catalogue before any build or
renderer change, reusing the Markdown stage, document link, and spec document
parts.

- [ ] Add `examples/basic/specs/design/browse/pages/mdx/` with a
      `_folder.json` titled `MDX documents` and an `index.mockup.ts`, so the
      `Document pages` folder keeps its five screens.
- [ ] Add the screen `design/browse/pages/mdx/document`, light-only, with
      mobile and desktop variants in one component: the Payment terms
      document in the shell's typography with the example's Action component
      embedded between its prose and its table, a `mock:` link to the Invoice
      screen, and Details whose Source row reads
      `specs/account/billing/payment-terms.mdx`. No implementation notes
      inside the screen area.
- [ ] Record the depicted MDX branch in the example `README.md` and
      `examples/basic/notes.md`.
- [ ] Register the screen in `tests/design_links.test.ts`, the inventory
      agreement test, and every documented count sentence that
      `tests/design_screen_counts.test.ts` checks.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design tests, and smoke-test the screen through `npm run dev` in
      both viewports; save the screenshots under `.context/`.
- [ ] Commit and push.

## Milestone 3: Discovery and the MDX toolchain

Discover `.mdx` files, load the compiler, and compile each file to a
component inside the consumer graph. At the end of this milestone an `.mdx`
file compiles and its metadata is collected, with no catalogue effect yet.

- [ ] Add `**/*.mdx` to the default root globs in `src/config/roots.ts` and
      classify `.mdx` matches as MDX documents in discovery and in
      `src/documents/load.ts`, never as entry modules.
- [ ] Add `src/documents/mdx_compiler.ts`: resolve `@mdx-js/mdx` and
      `remark-gfm` from the config file's location, cache the loaded modules
      per compilation, and fail with the exact missing-compiler line.
- [ ] Extract the heading-id slug and suffix logic from
      `src/documents/markdown.ts` into a shared pure module used by both
      renderers.
- [ ] Add the Mokly remark plugins: front matter stripped with
      `parseFrontMatter` before compiling, Markdown-syntax link and image
      destinations resolved through the shared document destination rules,
      heading ids and the first-heading title recorded, and resources
      collected.
- [ ] Add `src/build/mdx_plugin.ts`: an esbuild `onLoad` for `.mdx` that
      compiles in `mdx` format with the consumer automatic JSX runtime and
      returns the JavaScript plus the collected metadata; import each `.mdx`
      file from the virtual consumer entry and export the components keyed by
      repository-relative path.
- [ ] Add `@mdx-js/mdx` and `remark-gfm` as optional peer dependencies and as
      development dependencies, and record the audit in the dependency
      policy.
- [ ] Tests under `tests/documents_mdx_*.test.ts`: default and explicit
      globs, classification, index and duplicate rules, the missing-compiler
      line, front matter reuse and failures, heading ids shared with
      Markdown, every link rule, a fixture with a JSX component import, and
      React runtime identity.
- [ ] Commit and push.

## Milestone 4: Document entries and rendering

Turn compiled MDX files into document entries and render them through the
consumer renderer.

- [ ] Build MDX `DocumentDefinition`s with the shared path derivation, title
      and description fallbacks, tags, `movedFrom`, resources, and the MDX
      source body for similarity; export the public `DocumentDefinition`
      metadata type and rename the internal file-definition type so one name
      has one meaning.
- [ ] Extend `RenderInput.entry` with `DocumentDefinition & { path }` and add
      the document body wrapper that scopes the template's typography and
      palette, refactoring `src/documents/template.ts` so both outputs share
      one stylesheet source.
- [ ] Render each MDX document once per effective scheme in the desktop
      viewport, with the stylesheet rules matched by its route, and run the
      output through the screen validation path and the output transaction;
      write the same artifact paths as a Markdown document.
- [ ] Extend on-demand Serve compilation and the document compiler so a
      requested MDX document view renders per scheme like a screen view.
- [ ] Tests: build output and ownership, both schemes, the neutral renderer
      matching Markdown typography property by property, a custom renderer
      receiving the document entry, screen validation rejecting a bad link,
      and demand rendering.
- [ ] Commit and push.

## Milestone 5: Delivery, Changes, and the example

Carry MDX documents through watch, Changes, moves, previews, export, and the
example catalogue.

- [ ] Extend watch so an `.mdx` edit, an imported module edit, and a created,
      renamed, or deleted `.mdx` file rebuild or rediscover as for `.md`.
- [ ] Extend Changes classification, move pairing, and removed previews to
      MDX documents, including a changed imported component marking the
      document changed and the MDX source body feeding similarity.
- [ ] Extend export and publication inventories and the Changes opt-in to MDX
      documents and their resources.
- [ ] Add `examples/basic/specs/example/release-checklist.mdx`: front matter,
      prose, a Markdown link to the workspace guide, an embedded Action
      component, and a `MockLink`; update the example `README.md` and the
      example tests that count documents.
- [ ] Tests: watch lifecycle, Changes membership, a paired move, the removed
      preview, export and publish inventories, and the example catalogue.
- [ ] Smoke: `npm run dev`, open the example MDX document, change the
      Appearance control, follow the link to the Welcome screen and back, edit
      the file and the Action component and confirm both reloads.
- [ ] Commit and push.

## Milestone 6: Verification, release readiness, and review

- [ ] Extend the packed-consumer smoke: the `esm` consumer gains an `.mdx`
      document and installs the peers; the `themed` consumer stays without
      them and must build.
- [ ] Confirm every guide, protocol document, README, and the example README
      match the delivered behaviour, and that new files and exports satisfy
      the repository verification ratchets.
- [ ] Run `cargo xtask check` to completion with no failures.
- [ ] Run `git add -A`, commit with a Conventional Commits message, and push.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md` and report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Run the published package against a real consumer repository with an
  `.mdx` document that embeds a themed component and record any friction.
- Confirm Mokly Cloud needs no change: the manifest and read model are
  unchanged.

## Deferred follow-ups (separate plans)

- An MDX component map so a consumer can supply its own typography
  components for Markdown elements.
- Embed blocks for screens, components, and props tables.
- Component usage records for documents, so a component page lists the
  documents that embed it.
- A table of contents in the document pane.
- Prose comparisons for changed documents in Changes.
- Body search.
- `.markdown` as a second Markdown extension.
