# Path Identity, Spec Tree, And Markdown Documents

Status: Active. Created 2026-10-02 with the user's consent after the design
discussion in this workspace. No milestone has started. This plan supersedes
the navigation-path contract delivered by
[Path-Based Navigation Hierarchy](./nav-path-hierarchy.md) and the id-only
identity delivered by [Id-Derived Routes](./id-derived-routes.md); both stay
listed as history.

**Goal:** Replace the two placement-and-identity fields on every entry, the
global `id` and the `navPath` label list, with one path derived from the
entry's file location. The path is the entry's identity, its folder, its link
target, and its URL. Markdown files become catalogue entries by the same rule,
so a `specs/` directory that mixes written specs and rendered mockups is the
catalogue. Moves are detected and shown as moves instead of a removal plus an
addition. In the viewer, the Pages section becomes Specs, folder rows only
browse, and a folder's README is its first child row.

**Why:** Auto-discovered Markdown files have nowhere to author an id. Under
the current model Mokly would synthesise path-derived ids for them and keep a
second representation, `navPath`, derived from the same directory. One path
removes the duplication, makes uniqueness follow from hierarchy instead of a
global naming exercise, and makes the URL, the link target, and the file
location the same string. The catalogue already speaks repository paths in
`relatedDocs` and `dependencies`.

**Architecture:** Configuration lists roots. A root is a directory Mokly
scans, with an optional file pattern, an optional path prefix, and optional
transparent directory names. An entry's path is the root prefix, then the
directories between the root and the file, then a leaf. A Markdown file's
leaf is its file name; a TypeScript entry's leaf is its declared `slug`, which
defaults to the file name. `index` collapses onto the directory path. Every
component path begins with the reserved folder `components`. Folder titles,
order, and exclusions come from a folder record carried by a `defineFolder`
export or a `_folder.json` file. The manifest becomes v8, the public read model
v4, and the review result v5; all three key entries by kind and path and carry
`previousPath` for detected moves. The viewer renders one tree, splits it into
the Specs and Components sections on the reserved folder, and never navigates
from a folder row.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

1. **Identity.** Every entry has exactly one path, unique across the whole
   catalogue. Its URL is `/view/<path>`. `id` and `navPath` go away. A link,
   a flow step, a comment anchor, and a baseline pairing all use the path.
2. **Derivation.** Root prefix, then directory, then leaf. No rule compares a
   file name with its directory name, counts the entries in a file, or
   rewrites a name. A rule may use the file's own name and location and the
   root configuration, nothing else.
3. **Leaf and `index`.** A Markdown file's leaf is its file name without the
   extension; `README.md` and `index.md` are the folder's own page, detected
   case-insensitively. A TypeScript entry's leaf is `slug`, defaulting to the
   file name; two slug-less entries in one file collide and fail the build.
   The slug `index`, from a file name or the field, makes the entry the
   folder's own page. `path` overrides the derived path and is allowed on any
   entry; a written path is always complete.
4. **Segment grammar.** Letters, digits, hyphens, and underscores, ASCII only,
   case preserved, no dots, no spaces, no Windows device names. Two segments
   that differ only by case are the same segment. A file name outside the
   grammar is a build error that names the file and the fix; there is no
   slugify and no URL-encoding of spaces. An opt-in `slugify` per root may be
   added later and can never be removed, so it is not the default.
5. **Reserved `components` folder.** Mokly prefixes every component path with
   `components/`. Authors never type it for a derived path and always include
   it in a written path. A component whose written path lacks it, or any
   other kind whose path begins with it, is a build error. A root prefix
   comes after it. The name is fixed and not configurable.
6. **Sections and rows.** The viewer renders one tree. **Specs** shows every
   top-level folder except `components`; **Components** shows that folder
   with its own name hidden behind the section header. A folder row only
   expands or collapses; it never changes the content area. An entry row
   navigates. An entry with variants keeps today's row: a link beside a
   separate disclosure button. A folder's own page is its first child row,
   labelled with the page title, or "Overview" when that equals the folder
   title. A breadcrumb folder segment opens the folder page when one exists
   and otherwise expands the folder.
7. **Variants.** Declared inside the parent as today, with `slug` instead of
   `id`; the path is the parent's path plus the slug. The relationship is
   derived from the declaration and recorded in the manifest and read model;
   the authored `variantOf` field goes away. Nesting stays one level deep. A
   directory named after a screen is a folder whose index page is that screen;
   it may hold other files, which are ordinary members, not variants. Order
   inside such a folder is variants in authored order, then folders, then
   leaves. Pages, documents, and flows have no variants.
8. **Folder records.** Fields `path`, `title`, `order`, `hidden`, and, for a
   real directory, `exclude` globs relative to that directory. No `mount`:
   re-rooting is configuration only. Two carriers produce the same record: a
   `defineFolder` export in any entry module, and a `_folder.json` file in a
   directory. Title resolution: record title, then the index page's title,
   then the slug with hyphens as spaces and a capital first letter. Default
   order is folders before leaves, each by title. `order` lists children
   first; `...` stands for the unnamed rest; omitting `...` still appends the
   rest. Two records for one path, a record for an unused path, and an `order`
   name that matches no child are build errors.
9. **Module exports.** Mokly collects every exported value that is a
   definition or an array of definitions, from the default export and named
   exports, detected by the definition brand. Other exports are ignored. A
   module that exports no definition is a build error. The `mockups` name is
   no longer special.
10. **Links.** A link names a complete path, a path relative to the linking
    entry, an imported definition, or in Markdown a relative file link.
    Fields evaluated at module load, such as flow steps and flow membership,
    use complete or relative path strings. An unknown target is a build error
    naming the linking entry and the path; when the target moved, the error
    names the new path.
11. **Moves.** Pairing runs within one kind, and only a unique match pairs.
    Signals in order: an authored `movedFrom`, identical normalised rendered
    content with link targets compared through the move map, same source
    module and title, and for documents and pages only a Git-style
    similarity score. An ambiguous match pairs nothing and emits a diagnostic
    that suggests `movedFrom`. The four change kinds stay; a paired entry
    carries `previousPath`. A pure move is `unmodified` with a previous path, a
    move with edits is `changed` with a previous path, and the viewer labels
    both "Moved". A paired entry produces no removed preview.
12. **Documents.** A Markdown file discovered through a root is an entry of
    kind `document`. Front matter may set `title`, `description`, `tags`,
    `path`, and `movedFrom`. The title falls back to the first heading, then
    the file name. Mokly owns the rendering: one complete HTML document with
    shell-consistent typography, raw HTML disabled, relative links resolved to
    entry paths or validated repository files, and images copied as generated
    resources under the existing safe-path rules. Documents have no viewport
    or colour-scheme views and no variants.
13. **Configuration and layouts.** `roots` replaces `entries` and
    `entriesDir`. Each root has `dir`, optional `files` globs relative to it
    with the default `**/*.mockup.{ts,tsx}` and `**/*.md`, optional `path`,
    and optional `transparent` directory names. The default when `roots` is
    omitted is `[{ dir: "specs" }]`; a root that does not exist or yields no
    entry is an error. The documented default layout is a dedicated spec
    tree for screens, pages, documents, and flows, plus a second root over a
    component library. Co-location of mockups beside product code is the
    documented alternative, configured with a transparent directory. Both
    layouts produce the same paths.
14. **Formats.** Manifest v8, public read model v4, review result v5. Current
    and baseline readers accept only the new versions, under the existing
    pre-1.0 policy of one clean break and no compatibility shim.
15. **Out of scope.** Mokly Cloud's adoption of paths and `previousPath` for
    comments, a generated overview page for folders without a README, and a
    per-root default leaf of `index` are post-merge follow-ups.

**Artifact layout to confirm in Milestone 1:** every entry document is
written at `<path>/index.html` and its views at
`<path>/index.<viewport>[.dark].html`, so a folder page and its children
coexist on every static host and no child slug can collide with a view file,
because dots are not valid in segments. Snapshot, preview, and shell paths
follow the same shape.

## Milestone 1: Contract documentation

Define the complete contract before any code changes. Protocol documents state
rules only and never record milestone numbers, which
`tests/protocol_doc_history.test.ts` enforces. The size test
`tests/protocol_doc_sizes.test.ts` bounds each document's length, so split new
contracts rather than growing one.

- [ ] Add `docs/protocol/mokly-paths.md`: identity, derivation, segment
      grammar, `index`, the reserved `components` folder, roots and transparent
      directories, `path` overrides, collision errors with their exact text,
      and the `/view/<path>` URL grammar. Delete `mokly-nav-paths.md` and
      `mokly-nested-authoring.md` and repoint every link.
- [ ] Add `docs/protocol/mokly-folders.md`: the folder record, both carriers,
      the `_folder.json` schema, title resolution, order and `...`, `hidden`,
      `exclude`, and the exact error texts.
- [ ] Add `docs/protocol/mokly-documents.md`: discovery, front matter, title
      fallback, Mokly-owned rendering, link and image resolution, generated
      resources, Changes materiality, and the dependency boundary for the
      Markdown parser.
- [ ] Add `docs/protocol/mokly-moves.md`: pairing signals in order, uniqueness,
      the ambiguity diagnostic, `movedFrom` validation, link normalisation
      through the move map, the similarity metric for documents and pages,
      `previousPath`, and removed-preview suppression.
- [ ] Add `docs/protocol/mokly-entry-modules.md`: export collection, the
      definition brand, ignored exports, the empty-module error, slug defaults,
      and `index`.
- [ ] Update `mokly-authoring.md`, `mokly-variants.md`, `mokly-pages.md`,
      `mokly-components.md`, `mokly-link-controls.md`, and
      `mokly-instances.md` for `slug`, `path`, `movedFrom`, `defineFolder`,
      path-addressed links and flow steps, derived variant relationships, and
      the removal of `id`, `navPath`, `defineRoot`, `folder`, and nested
      `screen` and `page`.
- [ ] Update `mokly-configuration.md`: `roots`, defaults, validation, the
      recommended spec-tree layout, and the co-located alternative.
- [ ] Update `mokly-artifact-paths.md` with the confirmed layout above, the
      shared path functions, the URL parser, and provider-normalised paths.
- [ ] Update `mokly-component-manifest.md` to v8 and `mokly-catalogue.md` to
      read model v4: `path`, `previousPath`, kind `document`, folder nodes
      with an optional index, derived variant relationships, and one tree.
- [ ] Update `mokly-changes.md`, `mokly-catalogue-changes.md`,
      `mokly-component-changes.md`, `mokly-removed-previews.md`, and
      `mokly-baseline-compatibility.md` for pairing by kind and path, review
      result v5, moves, and the v8-only gate.
- [ ] Update `mokly-navigation.md`, `mokly-viewer.md`, `mokly-shell-design.md`,
      `mokly-component-explorer.md`, `mokly-variant-navigation.md`, and
      `mokly-disclosure-persistence.md`: the Specs section, browse-only folder
      rows, Overview rows, breadcrumb behaviour, path-keyed disclosure keys,
      and search over path segments.
- [ ] Update `mokly-rendering.md`, `mokly-runtime.md`, `mokly-export.md` and
      its siblings, `mokly-publication.md`, and `npm-release-notes.md` for the
      new output shape and the breaking change.
- [ ] Update `docs/protocol/README.md`: the supported-formats table and the
      contract list. Update `docs/protocol/fixtures` where fixtures carry ids.
- [ ] Update the guides under `docs/guides/start`, `docs/guides/authoring`,
      and `docs/guides/catalogue`, the root `README.md`,
      `packages/viewer/README.md`, and the `src/*/README.md` files whose
      sections describe ids, nav paths, or entry globs.
- [ ] Validate the changed Markdown with Prettier, run the protocol document
      tests and link tests under `tests/`, run `git diff --check`, and review
      the diff.
- [ ] Commit and push.

## Milestone 2: Shell design mockups

Tags: mockup

Mokly's shell mockups are the design screens under
`examples/basic/entries/design`. Update them to the new navigation and Changes
presentation before implementation. Author them with the current API; the
example migrates to the new API in Milestone 3.

- [ ] Update the browse screens (`design-browse-home`,
      `design-browse-navigation`, `design-browse-screen`,
      `design-browse-details`) and the page screens (`design-page-navigation`,
      `design-page-view`): the Specs section header, browse-only folder rows,
      an Overview row under a folder with a README, unchanged variant rows,
      and breadcrumbs that end in a folder page.
- [ ] Add `design-browse-folder-overview`: a folder's README open in the
      content area with its Overview row current.
- [ ] Add `design-browse-document`: a Markdown document rendered with the
      shell typography, breadcrumbs, and the details panel.
- [ ] Add `design-changes-moved`: Changes rows labelled "Moved", with the
      previous path in the details panel, and the Overlay view for a moved
      screen.
- [ ] Update the component design screens under
      `examples/basic/entries/design/components` so details show paths under
      `components/`.
- [ ] Give every new screen a mobile and a desktop variant, keep it reachable
      from the existing design flows and folders, and keep annotations outside
      the screen area.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and smoke-test the changed pages through `npm run dev`.
- [ ] Commit and push.

## Milestone 3: Identity core

Replace ids and nav paths with derived paths end to end, so `mokly build`,
`check`, `serve`, and `export` work on paths. The viewer's data layer is
updated here so the current shell keeps rendering; shell presentation changes
wait for Milestone 6.

- [ ] Configuration (`src/config`): add `roots` with `dir`, `files`, `path`,
      and `transparent`; the `[{ dir: "specs" }]` default; validation against
      `mockupsDir`, review output, and export destinations; remove `entries`,
      `entriesDir`, and the glob modules they used.
- [ ] Discovery (`src/build/discovery.ts`, `src/config/entry_discovery*.ts`,
      `src/build/source_inventory.ts`): walk roots, apply `files` and
      `_folder.json` `exclude`, and keep ownership and watch membership keyed
      by the resolved file set.
- [ ] Authoring API (`src/authoring`): `slug`, `path`, `movedFrom`,
      `defineFolder`, variants with `slug`, flow steps by path, `mockLink`
      accepting complete paths, relative paths, and definition references;
      remove `id`, `navPath`, `defineRoot`, `folder`, nested `screen` and
      `page`, and `variantOf` from inputs. Keep `ReviewIgnore` ids unchanged.
- [ ] Module export collection (`src/build/consumer_entry.ts`,
      `src/registry/prepare.ts`): default and named exports, arrays, brand
      detection, ignored exports, and the empty-module error.
- [ ] Path derivation and grammar as a pure module under `src/registry`:
      prefix, directory, leaf, transparent directories, `index`, the reserved
      `components` folder, case-folded uniqueness, and attributed errors.
- [ ] Folder records: the `_folder.json` loader with schema validation, the
      `defineFolder` definition, merging, title resolution, `order`, `hidden`,
      and the duplicate, unused-path, and unknown-child errors.
- [ ] Registry validation (`src/registry/entry_validation.ts`,
      `variant_validation.ts`, `relationships.ts`, `entry_order.ts`): per-kind
      rules, one-level variants, mixed folder children, the sibling comparator,
      and path-addressed flow membership.
- [ ] Manifest v8 (`src/registry/manifest*.ts`): path, authored `movedFrom`,
      derived variant relationships, folder records, kind `document` reserved,
      and no stored routes.
- [ ] Artifact paths (`packages/viewer/src/data/paths.ts`,
      `src/build/output_paths.ts`, `src/export/paths.ts`,
      `packages/viewer/src/navigation/routes.ts`): the confirmed layout, the
      `/view/<path>` parser, provider-normalised paths, snapshot and preview
      paths, and unavailable-view hrefs.
- [ ] Build output (`src/build`): nested output directories, ownership and
      orphan cleanup across moves, collision checks, link resolution for
      complete, relative, and typed links in `mock_links.ts`,
      `mock_link_routes.ts`, and `html_links.ts`, and `logicalRoutes` keyed by
      path.
- [ ] Read model v4 emission (`src/catalogue`) and the viewer data layer
      (`packages/viewer/src/catalogue`, `packages/viewer/src/navigation`,
      `packages/viewer/src/shell/disclosure_keys.ts`): one tree split on
      `components`, path-keyed disclosure keys, and unchanged presentation.
- [ ] Review pairing by kind and path without move detection, review result v5
      with `previousPath` absent, and the v8-only baseline gate
      (`src/review`, `src/baseline`).
- [ ] Migrate `examples/basic/entries` to the recommended layout with
      directories per area, slugs, and `_folder.json` where titles need
      characters outside the grammar; migrate `scripts/large`; regenerate and
      run `npm run example:check`.
- [ ] Add unit tests for derivation, grammar, collisions, folder records,
      export collection, variants, manifest v8, artifact paths, the route
      parser, and read model v4; update the existing suites and fixtures;
      update the browser suites that assert routes or disclosure keys.
- [ ] Smoke-test `npm run dev`: open entries at `/view/<path>`, follow links,
      run `check`, and export.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 4: Markdown documents

Add Markdown files as `document` entries.

- [ ] Select the Markdown and front matter parser, add it with `npm install`
      at the current version, and record it where
      `docs/protocol/dependency-security.md` requires.
- [ ] Discover `.md` files through roots, apply the grammar to file names,
      detect `README.md` and `index.md` as index pages, and parse front
      matter.
- [ ] Render documents with a Mokly-owned template: shell typography that
      follows the colour scheme, raw HTML disabled, heading anchors, code
      blocks, relative links resolved to entry paths or validated repository
      files, images copied as generated resources, and external links kept.
- [ ] Emit `document` entries in manifest v8 and read model v4 with the
      artifact `<path>/index.html`; classify them in Changes by normalised
      rendered content.
- [ ] Resolve a `relatedDocs` path that matches a discovered document to that
      entry in the read model.
- [ ] Accept kind `document` in the viewer data layer and render it through
      the existing page view.
- [ ] Add documents to the example catalogue, including a folder README, and
      regenerate.
- [ ] Add unit tests for parsing, rendering, link and image resolution,
      front matter, and Changes classification; smoke-test documents through
      `npm run dev`.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 5: Move detection

Pair moved entries with their baseline and carry `previousPath`.

- [ ] Validate `movedFrom`: grammar, complete path, not the current path, and
      a baseline entry of the same kind.
- [ ] Implement pairing in `src/review` and `src/catalogue/changes.ts` with the
      signals in order, same-kind scoping, unique matches, link normalisation
      through the move map before material comparison, the documents-and-pages
      similarity metric, and the ambiguity diagnostic.
- [ ] Emit `previousPath` in review result v5 and read model v4, keep the four
      change kinds, suppress removed previews for paired entries, and align
      Changes counts.
- [ ] Make the unknown-link build error name the new path when the target
      moved.
- [ ] Add unit tests for every signal, ambiguity, and the false-positive
      guards, including identical output under different source modules and
      titles for screens; add fixtures for moved documents and screens.
- [ ] Smoke-test by moving a directory in the example and running a review.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 6: Viewer navigation

Tags: ui

Bring the shell to the Milestone 2 mockups.

- [ ] Rename the Pages section to Specs across `packages/viewer/src/shell`
      (`nav.tsx`, `nav_model.ts`, `nav_tree.ts`, `entry_wording.ts`) and show
      the Components section from the reserved folder with its name hidden.
- [ ] Make folder rows browse-only, add the Overview first-child row with the
      title fallback, and keep the entry-with-variants row
      (`nav_rows.tsx`, `nav_leaf_rows.tsx`, `css_nav_rows.ts`,
      `css_nav_variants.ts`).
- [ ] Make a breadcrumb folder segment open the folder page when it exists and
      otherwise expand the folder.
- [ ] Move disclosure keys to `folder:<path>`, `variants:<path>`, and the
      `specs` and `components` section keys, with reconciliation and Collapse
      all (`disclosure_keys.ts`, `disclosure_storage.ts`).
- [ ] Match search against path segments and titles
      (`nav_filter.tsx`, `search_query.ts`).
- [ ] Route `/view/<path>` through the store and history
      (`store_browser_routes.ts`, `store_browser_urls.ts`) and keep the
      missing view for unknown paths.
- [ ] Add the document icon and the folder-page row icon; show paths under
      `components/` in component details.
- [ ] Update and add browser tests under `tests/browser` for browsing,
      disclosures, variants, and navigation, and the viewer unit tests under
      `packages/viewer/tests`; verify parity with the Milestone 2 screens.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 7: Viewer Changes and document presentation

Tags: ui

- [ ] Label paired entries "Moved" in Changes rows and details, show the
      previous path in details, and drive the baseline side of comparisons
      from `previousPath` (`nav_changed.ts`, `details_rows.tsx`,
      `view_status.ts`, `comparison_request.ts`,
      `packages/viewer/src/catalogue/snapshot_identity.ts`).
- [ ] Present documents in the page view with the document title, breadcrumbs,
      and the source path in details; link `relatedDocs` matches to their
      document entries.
- [ ] Add browser tests for moved rows, moved comparisons, and document pages;
      verify parity with the Milestone 2 screens.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 8: Guides, verification, close-out, and review

- [ ] Finalise the guides and READMEs for the recommended `specs/` layout and
      the co-located alternative, the root `README.md` quick start, and the
      release notes for the breaking change.
- [ ] Run the full verification: `npm run build`, unit and browser tests,
      `npm run example:build`, `npm run example:check`, the package check, and
      `cargo xtask check`.
- [ ] Smoke-test the published shape: serve the example, browse folders
      without content changes, open an Overview row, open a document, follow
      relative and typed links, move a directory and confirm "Moved", and
      export and open the static output.
- [ ] Update this plan's status and `plans/README.md`; the plan stays Active
      until its pull request merges.
- [ ] Commit and push.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete local diff against `origin/main` and report the findings without
      changing the implementation.

## Post-merge follow-up (non-blocking)

- Mokly Cloud adopts paths as comment anchors and uses `previousPath` to move
  comments on publish.
- Optional per-root `slugify` for teams that cannot rename files.
- Optional per-root default leaf of `index` for one-directory-per-component
  libraries.
- A generated overview page for folders without a README.
- Smoke-test the published package against a consumer repository that uses
  the co-located layout.
