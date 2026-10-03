# Path Identity, Spec Tree, And Markdown Documents

Status: Active. Created 2026-10-02 with the user's consent after the design
discussion in this workspace. Milestones 1–5 and the Milestone 4A/5A review fixes are complete. This plan supersedes
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
leaf is its file name up to the first dot; a TypeScript entry's leaf is its declared `slug`, which
defaults to the file name. Index entries collapse onto the directory path. No rule
depends on an entry's kind. Folder titles, order, and exclusions come from a
folder record carried by a `defineFolder` export or a `_folder.json` file. The
manifest becomes v8, the public read model v4, and the review result v5; all
three key entries by kind and path and carry `previousPath` for detected
moves. The viewer renders one tree, shows component entries in the Components
section and every other kind in Specs, and never navigates from a folder row.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

1. **Identity.** Every entry has exactly one path, unique across the whole
   catalogue. Its URL is `/view/<path>`. `id` and `navPath` go away. A link,
   a flow step, a comment anchor, and a baseline pairing all use the path.
2. **Derivation.** Root prefix, then directory, then leaf. No rule compares a
   file name with its directory name, counts the entries in a file, or
   rewrites a name. A rule may use the file's own name and location and the
   root configuration, nothing else.
3. **Leaf and `index`.** A Markdown file's leaf is its file name up to its
   first `.`; `README.md` and `index.md` are the folder's own page, detected
   case-insensitively. A TypeScript entry's leaf is `slug`, defaulting to the
   file name; two slug-less entries in one file collide and fail the build.
   The slug `index`, from a file name or the field, makes a non-variant entry the
   folder's own page. `path` overrides the derived path on non-variant entries;
   a written path is always complete. Variants take their path from the parent
   and slug only and have no `path` input.
4. **Segment grammar.** Letters, digits, hyphens, and underscores, ASCII only,
   case preserved, no dots, no spaces, no Windows device names. Two segments
   that differ only by case are the same segment. A file name outside the
   grammar is a build error that names the file and the fix; there is no
   slugify and no URL-encoding of spaces. An opt-in `slugify` per root may be
   added later and can never be removed, so it is not the default.
5. **No kind-specific paths.** There is no reserved folder and no automatic
   prefix for components. A component's path derives like every other path,
   and a component and a screen with one path are an ordinary duplicate-path
   error. The documented convention for a component library is a root with
   `path: "components"`, which a team may rename or omit.
6. **Sections and rows.** The viewer renders one tree and splits it by kind.
   **Components** shows the entries of kind `component` and the folders that
   contain them; **Specs** shows every other kind. A folder that holds both
   kinds appears in both sections, each showing its own children, and its
   disclosure state stays section-scoped as today. A folder row only expands
   or collapses; it never changes the content area. An entry row navigates. An
   entry with variants keeps today's row: a link beside a separate disclosure
   button. A folder's own page is its first child row in Specs, labelled with
   the page title, or "Overview" when that equals the folder title. A
   breadcrumb folder segment opens the folder page when one exists and
   otherwise expands the folder. Splitting other kinds into sections, or
   removing the split, is a later option and not part of this plan.
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
   directory. A folder whose own page is a screen or component always takes
   that entry's title; a record `title` is invalid, while `order` and `hidden`
   remain valid. Otherwise title resolution is record title, then the index
   page's title, then the slug with hyphens as spaces and a capital first letter. Default
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
14. **Formats, with no backwards compatibility.** Manifest v8, public read
    model v4, review result v5, and navigation storage key v4. This is one
    clean break under the pre-1.0 policy, and the plan builds no logic for
    earlier versions: no reader, converter, or fallback for v7 manifests, v3
    read models, v4 review results, or v3 navigation storage; no redirect or
    alias from `/view/<kind>/<id>.html` URLs to paths; no mapping from former
    ids to paths; no translation of former disclosure keys; no special
    handling of former configuration keys, which fail as unknown fields like
    any other; and no deprecation period or migration tooling. The existing
    baseline gate keeps its one behaviour, reporting Changes unavailable for
    a base built by an earlier version, with its accepted version raised to
    v8. Move detection is content identity within the new model between two
    builds of this version, not compatibility with earlier output. The
    example catalogue, fixtures, and tests are rewritten to the new model
    rather than adapted. Migration guidance lives in the release note only.
15. **Out of scope.** Mokly Cloud's adoption of paths and `previousPath` for
    comments, a generated overview page for folders without a README, and a
    per-root default leaf of `index` are post-merge follow-ups.

**Artifact layout, confirmed in the contract documentation:** every entry
document is written at `<path>/index.html` and its views at
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

- [x] Add `docs/protocol/mokly-paths.md`: identity, derivation, segment
      grammar, `index`, roots and transparent directories, `path` overrides,
      duplicate-path errors with their exact text,
      and the `/view/<path>` URL grammar. Delete `mokly-nav-paths.md` and
      `mokly-nested-authoring.md` and repoint every link.
- [x] Add `docs/protocol/mokly-folders.md`: the folder record, both carriers,
      the `_folder.json` schema, title resolution, order and `...`, `hidden`,
      `exclude`, and the exact error texts.
- [x] Add `docs/protocol/mokly-documents.md`: discovery, front matter, title
      fallback, Mokly-owned rendering, link and image resolution, generated
      resources, Changes materiality, and the dependency boundary for the
      Markdown parser.
- [x] Add `docs/protocol/mokly-moves.md`: pairing signals in order, uniqueness,
      the ambiguity diagnostic, `movedFrom` validation, link normalisation
      through the move map, the similarity metric for documents and pages,
      `previousPath`, and removed-preview suppression.
- [x] Add `docs/protocol/mokly-entry-modules.md`: export collection, the
      definition brand, ignored exports, the empty-module error, slug defaults,
      and `index`.
- [x] Update `mokly-authoring.md`, `mokly-variants.md`, `mokly-pages.md`,
      `mokly-components.md`, `mokly-link-controls.md`, and
      `mokly-instances.md` for `slug`, `path`, `movedFrom`, `defineFolder`,
      path-addressed links and flow steps, derived variant relationships, and
      the removal of `id`, `navPath`, `defineRoot`, `folder`, and nested
      `screen` and `page`.
- [x] Update `mokly-configuration.md`: `roots`, defaults, validation, the
      recommended spec-tree layout, and the co-located alternative.
- [x] Update `mokly-artifact-paths.md` with the confirmed layout above, the
      shared path functions, the URL parser, and provider-normalised paths.
- [x] Update `mokly-component-manifest.md` to v8 and `mokly-catalogue.md` to
      read model v4: `path`, `previousPath`, kind `document`, folder nodes
      with an optional index, derived variant relationships, and one tree.
- [x] Update `mokly-changes.md`, `mokly-catalogue-changes.md`,
      `mokly-component-changes.md`, `mokly-removed-previews.md`, and
      `mokly-baseline-compatibility.md` for pairing by kind and path, review
      result v5, moves, and the v8-only gate.
- [x] Update `mokly-navigation.md`, `mokly-viewer.md`, `mokly-shell-design.md`,
      `mokly-component-explorer.md`, `mokly-variant-navigation.md`, and
      `mokly-disclosure-persistence.md`: the Specs section, browse-only folder
      rows, Overview rows, breadcrumb behaviour, path-keyed disclosure keys,
      and search over path segments.
- [x] Update `mokly-rendering.md`, `mokly-runtime.md`, `mokly-export.md` and
      its siblings, `mokly-publication.md`, and `npm-release-notes.md` for the
      new output shape and the breaking change.
- [x] Update `docs/protocol/README.md`: the supported-formats table and the
      contract list. Add the `catalogue-v4.json` fixture beside
      `catalogue-v3.json`, which the current reader tests still consume until
      the read model changes.
- [x] Add pointer sentences to the root `README.md`,
      `packages/viewer/README.md`, `examples/basic/README.md`, and the
      `src/*/README.md` files whose sections describe ids, nav paths, or entry
      globs, naming this plan and the relevant contract while keeping their
      descriptions of the released behaviour. The guides and the README quick
      start are rewritten in the milestones that implement the behaviour,
      because the [guides contract](../docs/protocol/mokly-guides.md) requires
      guides to document implemented behaviour and `tests/guides_authoring`
      couples the config guide to `MoklyConfig`. Drafts of the rewritten guides,
      root README, and viewer README are preserved in commit `d65417d` on this
      branch for those milestones to re-apply.
- [x] Validate the changed Markdown with Prettier, run the protocol document
      tests and link tests under `tests/`, run `git diff --check`, and review
      the diff. Size caps in `tests/protocol_doc_sizes.test.ts` were lowered to
      the new line counts, and the oversized changes, removed-previews,
      comparison-panes, navigation, viewer, and shell-design contracts were
      split into focused companion documents.
- [x] Commit and push.

## Milestone 2: Shell design mockups

Tags: mockup

Mokly's shell mockups are the design screens under
`examples/basic/entries/design`. Update them to the new navigation and Changes
presentation before implementation. Author them with the current API; the
example migrates to the new API in Milestone 3.

- [x] Update the browse screens (`design-browse-home`,
      `design-browse-navigation`, `design-browse-screen`,
      `design-browse-details`) and the page screens (`design-page-navigation`,
      `design-page-view`): the Specs section header, browse-only folder rows,
      an Overview row under a folder with a README, unchanged variant rows,
      and breadcrumbs that end in a folder page.
- [x] Add `design-browse-folder-overview`: a folder's README open in the
      content area with its Overview row current.
- [x] Add `design-browse-document`: a Markdown document rendered with the
      shell typography, breadcrumbs, and the details panel.
- [x] Add `design-changes-moved`: Changes rows labelled "Moved", with the
      previous path in the details panel, and the Overlay view for a moved
      screen.
- [x] Update the component design screens under
      `examples/basic/entries/design/components` so the Components section is
      the kind-filtered tree and details show component paths.
- [x] Give every new screen a mobile and a desktop variant, keep it reachable
      from the existing design flows and folders, and keep annotations outside
      the screen area.
- [x] Replace the id chip with the path chip in every design screen header,
      using one depicted path per entry, so no artboard keeps the `#id` form.
- [x] Give the depicted catalogue one fixture tree in the path model: the
      Example README as its Overview row, the Getting started page, an
      Account › Billing & Payments area, the Example folder in both sections,
      and a branch that moves `billing` under `account`.
- [x] Move the shell design screen inventory into
      `docs/protocol/mokly-shell-design-inventory.md`, lower the
      `mokly-shell-design.md` cap, and record the depicted catalogue, its
      transitions, the Moved row, the document icon, and the new Details rows
      in the shell, design-link, component-design, and library contracts.
- [x] Remove the stale `oversizedCaps` entries for `mokly-comparison-panes.md`
      and `mokly-removed-previews.md`, which the contract split left at or
      below 250 lines and which stopped the repository ratchet from running.
- [x] Update the design unit tests that pin the changed content: section ids,
      path chips, row lists, breadcrumbs, Changes rows and counts, the diff-mode
      inventory, and the documented screen counts.
- [x] Keep the Markdown document and invoice mockup styles in their own
      `design-documents.css`, registered in the example configuration's
      stylesheet and watch lists, so `design-stage.css` keeps its size.
- [x] Replace the document styles' universal child selector with a body
      element, because CSS attribution keeps any edited universal rule as
      evidence for every view that links its sheet.
- [x] Make the design library runtime browser test compare the Search
      variant's status with its own saved status instead of the parent's,
      which differs when only the variants' views changed.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and smoke-test the changed pages through `npm run dev`.
- [x] Commit and push.

## Milestone 3: Identity core

Replace ids and nav paths with derived paths end to end, so `mokly build`,
`check`, `serve`, and `export` work on paths. The viewer's data layer is
updated here so the current shell keeps rendering; shell presentation changes
wait for Milestone 6.

Status: Complete. The only full-gate blocker is pre-existing GHSA-vfj7-8cjw-p6xm in development dependencies; package, unit (2,948), browser (726), hydration (221), and all remaining repository checks pass, and the orchestrator authorized commit and push without an audit exemption or dependency change.

- [x] Configuration (`src/config`): add `roots` with `dir`, `files`, `path`,
      and `transparent`; the `[{ dir: "specs" }]` default; validation against
      `mockupsDir`, review output, and export destinations; remove `entries`,
      `entriesDir`, and the glob modules they used.
- [x] Discovery (`src/build/discovery.ts`, `src/config/entry_discovery*.ts`,
      `src/build/source_inventory.ts`): walk roots, apply `files` and
      `_folder.json` `exclude`, and keep ownership and watch membership keyed
      by the resolved file set.
- [x] Enforce the general unknown-input-field rule at runtime and in the typed
      helpers, including unknown flow-step fields; reconcile the authoring
      contract's former ignored-key wording with the clean-break requirement.
- [x] Authoring API (`src/authoring`): `slug`, `path`, `movedFrom`,
      `defineFolder`, variants with `slug`, flow steps by path, `mockLink`
      accepting complete paths, relative paths, and definition references;
      remove `id`, `navPath`, `defineRoot`, `folder`, nested `screen` and
      `page`, and `variantOf` from inputs. Keep `ReviewIgnore` ids unchanged.
- [x] Cover the orchestrator's clarified export-location and link-base rules:
      paths derive from the discovered exporting module while `sourcePath` stays
      the defining module; deduplicate aliases within one module, reject the
      same definition object across modules with `duplicate-export`, and resolve
      variant links from the parent entry's base folder.
- [x] Module export collection (`src/build/consumer_entry.ts`,
      `src/registry/prepare.ts`): default and named exports, arrays, brand
      detection, ignored exports, and the empty-module error.
- [x] Path derivation and grammar as a pure module under `src/registry`:
      prefix, directory, leaf, transparent directories, `index`, case-folded
      uniqueness, and attributed errors.
- [x] Folder records: the `_folder.json` loader with schema validation, the
      `defineFolder` definition, merging, title resolution, `order`, `hidden`,
      and the duplicate, unused-path, and unknown-child errors.
- [x] Preserve explicit local instance-name grammar while accepting a component
      path segment as the inferred default, in authoring and persisted view readers.
- [x] Registry validation (`src/registry/entry_validation.ts`,
      `variant_validation.ts`, `relationships.ts`, `entry_order.ts`): per-kind
      rules, one-level variants, mixed folder children, the sibling comparator,
      and path-addressed flow membership.
- [x] Reject conflicting folder-prefix casing in persisted manifest and public
      readers too, including entries omitted from the visible tree.
- [x] Manifest v8 (`src/registry/manifest*.ts`): path, authored `movedFrom`,
      derived variant relationships, folder records, kind `document` reserved,
      and no stored routes.
- [x] Artifact paths (`packages/viewer/src/data/paths.ts`,
      `src/build/output_paths.ts`, `src/export/paths.ts`,
      `packages/viewer/src/navigation/routes.ts`): the confirmed layout, the
      `/view/<path>` parser, provider-normalised paths, snapshot and preview
      paths, and unavailable-view hrefs.
- [x] Keep ownership when a discovered module and its defining helper move
      together, including a fixed declared path and cleanup of the old artifact path.
- [x] Build output (`src/build`): nested output directories, ownership and
      orphan cleanup across moves, collision checks, link resolution for
      complete, relative, and typed links in `mock_links.ts`,
      `mock_link_routes.ts`, and `html_links.ts`, and `logicalRoutes` keyed by
      path.
- [x] Read model v4 emission (`src/catalogue`) and the viewer data layer
      (`packages/viewer/src/catalogue`, `packages/viewer/src/navigation`,
      `packages/viewer/src/shell/disclosure_keys.ts`): one tree split by
      kind, path-keyed disclosure keys, and unchanged presentation.
- [x] Fix removed-page preview emission to use a statically checked v3 path DTO,
      so live selection and export cannot emit a stale identity field.
- [x] Review pairing by kind and path without move detection, review result v5
      with `previousPath` absent, and the v8-only baseline gate
      (`src/review`, `src/baseline`).
- [x] Align the companion wire boundaries: catalogue-change snapshot v2,
      removed-preview metadata v3, frame navigation `screenPath`, and selected
      comparison requests using `path`. Keep move lists empty until move pairing.
- [x] Lower the catalogue, configuration, design-components, export-delivery,
      export, frame-adapter, runtime and viewer caps to their M3 lengths. The
      two obsolete sub-250-line cap removals were already delivered by M2.
- [x] Migrate `examples/basic/entries` to the recommended layout with
      directories per area, slugs, and `_folder.json` where titles need
      characters outside the grammar; migrate `scripts/large`; regenerate and
      run `npm run example:check`.
- [x] Re-apply the drafted guides from commit `d65417d` for `docs/guides/start`,
      `docs/guides/authoring`, and `docs/guides/cli`, the root `README.md`
      quick start and authoring table, and `packages/viewer/README.md`, then
      reconcile them with the implemented API so `tests/guides_*` pass,
      including the config-field and export-coverage checks.
- [x] Validate folder carrier source inventories and the reserved document shape;
      make invalid runtime flow-step inputs produce attributed validation errors.
- [x] Split configuration traversal and source ownership into a protocol companion
      so the roots clarification stays within the existing document size ratchet.
- [x] Preserve unchanged output directories during replacement to avoid spurious
      watch reloads cancelling component edits; back up case-only renames using
      actual on-disk spelling and test directory pruning/rollback.
- [x] Share matched-file physical projections with the source inventory to avoid
      resolving every matched file twice while retaining generation invalidation.
- [x] Add unit tests for derivation, grammar, collisions, folder records,
      export collection, variants, manifest v8, artifact paths, the route
      parser, and read model v4; update the existing suites and fixtures;
      update the browser suites that assert routes or disclosure keys.
- [x] Preserve product component CSS class names while migrating example identities.
- [x] Restore the ordinary preview fixture's focused catalogue using roots and path destinations.
- [x] Preserve local instance-name grammar through public catalogue projection and reading.
- [x] Keep default titles nonempty for valid folder segments made only of hyphens or underscores.
- [x] Authenticate provider-normalized page directories consistently in same-origin frame ownership, readiness and geometry checks.
- [x] Accept directory-normalized index snapshots from static hosts while retaining exact generation confinement and the authored resource base.
- [x] Preserve native fragment hashes when restoring another entry through browser history.
- [x] Smoke-test `npm run dev`: open entries at `/view/<path>`, follow links,
      run `check`, and export.
- [x] Split catalogue serialization and public-exclusion configuration into focused
      companions so review clarifications fit the protocol size ratchet.
- [x] Address orchestrator review batch 1 with regression coverage:
  - [x] Retain hidden folder nodes in v4; filter only All/search, retaining Changes rows.
  - [x] Exclude hidden children from All folder counts while retaining Changes ancestry.
  - [x] Protect excluded root matches and reserve `_folder.json` case-insensitively (1, 16).
  - [x] Reject folder carriers owned by two roots, including disjoint entry globs (2).
  - [x] Sort index entries by rendered row kind and prune filtered children correctly (3, 4).
  - [x] Pair Changes by kind and case-folded path, including parent/variant shape changes (5, 7, 8).
  - [x] Pin historical snapshot identity namespace v3 (6).
  - [x] Harden path-keyed dictionaries against prototype names (9).
  - [x] Close public-reader tree, removed-record and private-metadata gaps (10).
  - [x] Exclude reserved documents from component review until document review lands (11).
  - [x] Restore persisted manifest tree validation and remove obsolete identity naming (12).
  - [x] Match folder exclusions against files only in discovery and watch (13).
  - [x] Preserve directory discovery during folder-file races; attribute filesystem failures (14).
  - [x] Align folder-object, directory-segment and configuration diagnostics (15, 18).
  - [x] Apply general unknown-input validation to `defineFolder` (17).
- [x] Protect and watch newly created root matches before candidate acceptance,
      including excluded files and invalid modules; preserve historical inventories.
- [x] Keep unknown input properties out of resolved relationships and attribution,
      so each produces only the general unknown-field diagnostic.
- [x] Apply the clarified variant identity rule: variants have no `path` input.
  - [x] Remove variant `path` inputs and derive every variant from parent plus slug.
  - [x] Require the same direct-parent path in both persisted readers, including history.
  - [x] Migrate examples, package fixtures and all tests to derived variant paths.
  - [x] Cover unknown `path` inputs, TypeScript excess keys and non-collapsing `index` slugs.
  - [x] A parent declared path must bypass invalid file/directory names for its variants too.
- [x] Address orchestrator review batch 2a with regression coverage:
  - [x] Reject unknown persisted use-case step fields (1).
  - [x] Verify parent declared paths bypass filename grammar; variant slugs never collapse `index` (2, 10).
  - [x] Ignore ordinary nested helper data; reject nested definitions (3).
  - [x] Reject copied branded objects and suppress duplicate-export follow-on noise (4, 5).
  - [x] Retain variant declaration order independently of export order (6).
  - [x] Remove former-field special cases and reject variant excess keys statically (7, 8).
  - [x] Attribute non-string flow-membership errors without coercion (9).
  - [x] Keep definition-reference tokens private and report unexported references by source/title (11).
- [x] Address orchestrator review batch 2b with regression coverage:
  - [x] Publish removed screen/page metadata by path (1).
  - [x] Accept all parser-supported URL forms for static evidence and remove dead route branches (2, 6).
  - [x] Prune empty output ancestors on installation and rollback (3).
  - [x] Preserve output ownership across defining-helper moves (4).
  - [x] Scope export snapshot exemptions to the comparison prefix (5).
  - [x] Cache public-file collision inventory per generation (7).
  - [x] Give transformer logical routes a null prototype (8).
  - [x] Update package smoke scripts to paths and current wire versions (9).
- [x] Run `cargo xtask check`, then commit and push.
  - [x] Verify formatting, lint, root/viewer types, repository ratchets, and Rust checks.
  - [x] Run the package suite, including all five packed consumer scenarios.
  - [x] Reproduce the new dependency-audit failure on pristine `3dc7663`:
        GHSA-vfj7-8cjw-p6xm reports 13 high findings through the existing
        `braces` dependency tree; no dependency manifests changed in this milestone.
  - [x] Record the approved audit disposition: no patched version is available;
        commit with every other check passing and no audit suppression or dependency change.
  - [x] Complete the independently selected unit, browser, and hydration suites
        (2,948 unit tests, 726 browser tests, 221 hydration tests; zero skips).
        The orchestrator reviews each milestone; the implementation review remains the
        final item in Milestone 8.

## Milestone 3A: Integrate main

Preserve current main's imported CSS delivery and route-scoped shell bootstraps,
adapting their contracts and implementation to path identity before later work.

Status: Complete. The only full-gate blocker is pre-existing GHSA-vfj7-8cjw-p6xm in development dependencies; package (six consumer scenarios), unit (3,686), browser (742), hydration (226), and all remaining repository checks pass under the orchestrator's approved disposition, without an audit exemption or extra dependency change.

- [x] Fetch main, capture the source tip and additions audit, and merge main;
      resolve conflicts path by path while preserving every mainline feature.
- [x] Adapt bootstrap scope, CSS delivery and assets to paths and nested artifacts;
      migrate main's fixtures, tests and example changes to roots and slugs.
- [x] Preserve reserved CSS-output validation for root directories and static file-pattern
      prefixes, including symlink aliases; keep broad root discovery and watch safe.
- [x] Reconcile docs, protocol caps and indexes; retain both sides' plans and README entries.
- [x] Run all verification suites and remaining repository checks with the approved
      GHSA-vfj7-8cjw-p6xm audit disposition; reproduce any suspected main browser failures.
  - [x] Formatting, lint, all four repository ratchets, root/viewer/script types,
        Rust formatting, Clippy, 15 Rust tests, and the Rust file-length audit.
  - [x] Unit suite: 3,686 passed, with zero skips or cancellations.
  - [x] Packed-consumer package suite: both packages passed all six scenarios.
  - [x] Browser suite: 742 passed, including scoped evidence and imported CSS; zero skips.
  - [x] Hydration suite: 226 passed, with zero skips or cancellations.
  - [x] Verify the shared-catalogue hydration test on untouched main, migrate its
        remaining flat URL, and rerun the complete hydration suite.
  - [x] Development, example-check (445 files), controls, CLI export and static-browser smoke tests.
- [x] Audit all deletions against main before and after the merge commit, record each
      authorized replacement in the commit body, then commit and push.

The orchestrator reviews this integration; the implementation review remains at M8.

## Milestone 3B: Identity core review fixes

Restore focused identity-core coverage and generic authoring helpers, then align
current guides and examples with the implemented API. Milestones 3 and 3A remain
closed. Folder-rename/disclosure tests assigned to Milestone 6 stay out of scope.

Status: Complete. Package (six consumer scenarios), unit (3,714), browser (743),
hydration (226), and all remaining repository checks pass. The approved full-gate
exception remains pre-existing GHSA-vfj7-8cjw-p6xm in development dependencies;
no dependency change or audit exemption was added.

- [x] Restore exact catalogue-reader error assertions and mutations that reach each tree rule (1).
- [x] Restore generic `defineScreen` wrappers and precise return types; retain concrete
      excess-key typing only where it also supports wrappers, and document any trade-off (2).
- [x] Restore genuine module-evaluation errors and one attributed facade presentation check (3).
- [x] Pin the immediately preceding version at every bumped wire boundary and correct test titles (4).
- [x] Assert real ancestor titles for the design-library hierarchy (5).
- [x] Restore invalid preview, snapshot, view-href and provider-normalization path coverage (6).
- [x] Restore the large fixture's nested hierarchy and verify its generator (7).
- [x] Exercise file-derived paths and both folder-record carriers in a packed consumer (8).
- [x] Make the page addition/removal and variant-relationship tests prove their stated behavior (9).
- [x] Cover the missing derivation, link diagnostic, equivalent tree/carrier, folder-title,
      top-level record-field and strict manifest-field rules (10).
- [x] Restore the removed-comparison flow in the default both viewport (11).
      The original unchanged-parent fixture selects Mobile; a genuinely changed
      parent preserves Both under the existing sticky-axis rule. Cover both.
      Untouched main passes the original fixture; no production behavior changed.
- [x] Align the current documentation with identity core (12):
  - [x] Remove premature Markdown/move claims from README and guides; add the M4/M5 restoration TODOs (docs 1).
  - [x] Correct build paths, overlapping roots, instance defaults, folder titles and decision 8 (docs 2–5).
  - [x] Fix protocol examples, page-id wording and stale implementation statements (docs 6–8).
  - [x] Replace obsolete design paths/titles and example references; correct cap provenance (docs 9–11).
- [x] Reject the reserved first path segment `mokly-generated` case-insensitively, with
      attributed diagnostics for derived/declared paths and root-prefix coverage (13).
- [x] Accept leading underscores and hyphens in generated CSS/asset routes; add a precise
      diagnostic for nonportable module paths despite a declared entry path (14).
- [x] Correct the imported-CSS export-collection description and restore comparison-serving
      configuration, ownership and ignored-region rules (15–16).
- [x] Rename live capability requests and instance-frame fields to `entryPath` throughout
      code, types, tests and viewer docs, without an `entryId` alias (17).
- [x] Run focused coverage, the large generator, changed-file Prettier, all four verification
      suites and the remaining repository checks under the approved dependency-audit disposition.
  - [x] Focused regressions, default large generator, packed API types and changed-file formatting.
  - [x] Package suite: both packages pass all six consumer scenarios; example Check validates 445 files.
  - [x] Unit suite: 3,714 pass, with zero skips or cancellations.
  - [x] Repository formatting, lint, ratchets, Rust formatting, Clippy, 15 Rust tests and file-length audit.
  - [x] Browser suite: 743 pass, with zero skips; both known base-flaky tests pass first run.
  - [x] Hydration suite: 226 pass, with zero skips or cancellations.
- [x] Commit and push the completed fixes, then report each item and its covering tests.

The orchestrator reviews this milestone; the implementation review remains at M8.

## Milestone 4: Markdown documents

Add Markdown files as `document` entries.

Status: Complete. Package (six consumer scenarios), unit (3,793), browser (745),
hydration (229), and the remaining repository checks pass. The orchestrator's
approved exceptions are GHSA-vfj7-8cjw-p6xm in development dependencies and the
28 existing source-file-length violations. All 28 files are unchanged from
`bda69311`; this milestone adds no violation or advisory and no audit exemption.

- [x] Clarify first-dot document leaves, exact index file names, file-link versus
      logical-link bases, and generated resource ownership; add regressions first.
- [x] Retain documents and copied resources across live graph replay, source
      inventory checks, scoped bootstraps, and transactional orphan cleanup.
- [x] Exercise Markdown in the packed consumer, including exported resource bytes.
- [x] Preserve copied-resource ownership when the config file is renamed; keep
      prior helper ownership scoped to its original config.
- [x] Align logical fragments with numeric and Unicode Markdown heading ids;
      retain rejection of encoded helper arguments and unsafe fragment syntax.

- [x] Restore the Markdown passages drafted in `d65417d` in README and the
      start/authoring/CLI guides once document rendering works; reconcile examples.

- [x] Add document material-change classification beside pages and document previews
      beside page previews; reserved documents are excluded from component pairing today.

- [x] Wire front-matter `path` through the shared declared-path rules: bypass
      file/directory grammar, retain README/index own-page status, and resolve
      relative links from the declared index path.
- [x] Replace the interim discovery filter that retains matched `.md` files as
      protected, watched source inputs but omits them from executable entry
      modules and catalogue output. Markdown rendering and entry collection
      begin in this milestone; a catalogue still needs a renderable definition
      during Milestone 3.

- [x] Select the Markdown and front matter parser, add it with `npm install`
      at the current version, and record it where
      `docs/protocol/dependency-security.md` requires.
- [x] Discover `.md` files through roots, apply the grammar to file names,
      detect `README.md` and `index.md` as index pages, and parse front
      matter.
- [x] Render documents with a Mokly-owned template: shell typography that
      follows the colour scheme, raw HTML disabled, heading anchors, code
      blocks, relative links resolved to entry paths or validated repository
      files, images copied as generated resources, and external links kept.
- [x] Emit `document` entries in manifest v8 and read model v4 with the
      artifact `<path>/index.html`; classify them in Changes by normalised
      rendered content.
- [x] Resolve a `relatedDocs` path that matches a discovered document to that
      entry in the read model.
- [x] Accept kind `document` in the viewer data layer and render it through
      the existing page view.
- [x] Add documents to the example catalogue, including a folder README, and
      regenerate.
- [x] Add unit tests for parsing, rendering, link and image resolution,
      front matter, and Changes classification; smoke-test documents through
      `npm run dev`.
- [x] Verify empty file-link fragments and decoded Unicode heading links.
- [x] Verify document scheme metadata for pre-hydration appearance and reload.
- [x] Keep example fixture copies free of ignored generated resources, and
      update tag inventory and fragment rejection tests for the new contracts.
- [x] Align the scroll test's small pane to the row's fractional pixel grid;
      preserve its exact visibility assertion and all navigation behavior.
- [x] Keep plain-text repository link targets private and watched, including
      source files below `mockupsDir`, without importing them.
- [x] Advertise Dark for document-only catalogues and historical documents.
- [x] Share explicit document source inputs with the CSS pass in nested roots;
      keep unrelated public assets outside that private-input permission.
- [x] Include linked attachments, such as PDFs, in document Changes and
      historical resource capture; preserve normalized ignore boundaries.
- [x] Remove the remaining reserved-document statement from the review README;
      clarify the resource-path example's folder README base in the contract
      and authoring guide, and include linked attachments in the guide.
- [x] Fetch `origin/main` and run `node scripts/verification/source-file-length.mjs`;
      verify that all 28 reported files are byte-identical to `bda69311`.
      The orchestrator assigned those existing violations to a later refactoring
      milestone after the navigation branch is merged. This milestone adds none.
- [x] Run `cargo xtask check`, then commit and push.
  - [x] Run the package suite: both packages pass all six packed consumer scenarios;
        example Build and Check validate 452 generated files.
  - [x] Run the unit, browser and hydration suites: 3,793, 745 and 229 passed,
        respectively, with no failures, skips or cancellations.
  - [x] Pass formatting, lint, all four repository ratchets, Rust formatting,
        Clippy, all 15 Rust tests and the 9-file Rust length audit.
  - [x] Pass 82 focused regressions, 32 final guide/protocol tests, changed-file
        Prettier and `git diff --check`; inspect deletions and the staged diff.
  - [x] Verify the existing audit advisory and all 28 source-length failures under
        the orchestrator's approved disposition, without changing their dependencies
        or adding an exemption. Record npm's changed fix suggestions separately.
  - [x] Smoke-test README and ordinary document routes, relative links, heading
        fragments, resource loading, Dark and reload through Serve and static export.

The orchestrator reviews this milestone; the complete implementation review
remains the final item in Milestone 8.

## Milestone 4A: Markdown documents review fixes

Close the document review findings with parser, output validation, source-boundary,
and watch regressions. Keep documents safe and consistent across Build, Check,
Serve and export. Add a failing regression before each fix.

Status: Complete. Package (six consumer scenarios), unit (3,912), browser (745),
hydration (229), and the remaining repository checks pass. The existing braces
advisory and the same 28 source-length files retain their approved disposition.
No dependency change, new violation or exemption was added.

- [x] Escape raw-mode Markdown text for code, pre, kbd and script tags; add a
      structural element/attribute/URL allowlist and evaluate template CSP (1).
- [x] Strip one leading UTF-8 BOM before front-matter parsing (2).
- [x] Reject copied resources that violate the export public-name policy (3).
- [x] Reject links to Mokly-owned output and metadata before inventory; keep
      public files public and render their references as plain text (4).
- [x] Convert destination filesystem errors into the exact attributed missing-target
      diagnostic, without absolute paths (5).
- [x] Ignore empty headings for title fallback and never emit an empty heading id (6).
- [x] Decode character references once in destinations and link/image titles (7).
- [x] Require the lower-case mock: prefix in Markdown destinations (8).
- [x] Detect duplicate indexes by exact directory spelling; preserve case-collision
      diagnostics for directories that differ only by case (9).
- [x] Restore missing destination, discovery, exact-error and Markdown/resource
      add/change/remove watch tests (10).
- [x] Keep copied resources and existing public media distinct; existing public
      images also stay public and render as alt text without becoming inputs.
- [x] Preserve bare ampersands and enforce disabled checkbox output in the
      independent structural allowlist.
- [x] Preserve literal URI references in CommonMark and GFM autolinks while
      decoding explicit link/image destinations once; add regressions first.
- [x] Update the document/source contracts, affected READMEs and guides; keep all
      changed files within their existing size limits.
- [x] Smoke-test the raw HTML reproduction through Serve and export.
- [x] Run every verification suite serially, plus repository checks and changed-file
      Prettier, under the existing audit and 28-file length dispositions.
  - [x] Package: both packages pass all six consumer scenarios; example Build/Check
        validate 452 files and all declaration checks pass.
  - [x] Unit: 3,912 passed, with zero failures, skips or cancellations.
  - [x] Repository format, lint, four ratchets, Rust fmt/Clippy, 15 Rust tests
        and the 9-file Rust length audit pass.
  - [x] Audit and source length retain only the approved advisory and 28 files.
  - [x] Browser: 745 passed, with no skips; all three known base-flaky tests
        passed on their first run.
  - [x] Hydration: 229 passed, with no failures, skips or cancellations.
- [x] Inspect deletions and staged changes, then commit and fast-forward push.

The orchestrator reviews this milestone; the complete implementation review
remains the final item in Milestone 8.

## Milestone 5: Move detection

Pair moved entries with their baseline and carry `previousPath`.

Status: Complete. Package (six consumer scenarios), unit (3,849), browser (745),
hydration (229), and the remaining repository checks pass. The approved
exceptions remain the braces advisory and the same 28 source-length violations.
No dependency change, new violation or exemption was added.

- [x] Share one accepted move-pairing result across material classification,
      catalogue projection, complete capture, selected capture and publication.
- [x] Define diagnostic storage, pure-move reason records and symmetric ambiguity
      diagnostics without adding document/page visual comparison records.
- [x] Cover component parent/variant shape guards and preserve existing case-folded
      same-path pairing, including its existing shape-change behavior.
- [x] Retain original historical bytes and paths while normalizing logical links
      and paired identity references for material comparison.
- [x] Validate previous-path fields and paired source coverage at every strict
      result/read-model boundary; keep inferred moves out of plain builds.
- [x] Keep moved component variants in their current parent's comparison group,
      including cross-parent moves and a former parent with no remaining variants.
- [x] Keep copied document resources unmodified when their relative reference and
      bytes survive a move; scope the byte proof to the paired document.
- [x] Keep canonical catalogue links in material equality while preserving real
      href values for resource traversal and CSS selector matching.
- [x] Bind inferred link suggestions to accepted render generations. Initial
      Build/Check/Serve/export compilation uses authored hints only, with no
      diagnostic preflight over incomplete output.
- [x] Preserve automatic parent priority over otherwise ambiguous same-slug
      variants; require real variant evidence for parent content equality.

- [x] Restore the move passages drafted in `d65417d` in README and the guides
      once pairing and moved-target diagnostics work; reconcile examples.

- [x] Validate `movedFrom`: grammar, complete path, not the current path, and
      a baseline entry of the same kind.
- [x] Implement pairing in `src/review` and `src/catalogue/changes.ts` with the
      signals in order, same-kind scoping, unique matches, link normalisation
      through the move map before material comparison, the documents-and-pages
      similarity metric, and the ambiguity diagnostic.
  - [x] Add an injected pure policy with ordered passes, mutual uniqueness,
        permanent ambiguity, parent/variant pairing and the exact line metric;
        cover the policy with 13 focused regression tests.
- [x] Emit `previousPath` in review result v5 and read model v4, keep the four
      change kinds, suppress removed previews for paired entries, and align
      Changes counts.
- [x] Make the unknown-link build error name the new path when the target
      moved.
- [x] Add unit tests for every signal, ambiguity, and the false-positive
      guards, including identical output under different source modules and
      titles for screens; add fixtures for moved documents and screens.
- [x] Compare `relatedDocs` references to paired documents by logical identity;
      retain plain repository labels and test screen, page and component owners.
- [x] Smoke-test by moving a directory in a separate example repository, with
      and without content edits. Serve and Review agree on seven pairs and no
      removals; selected snapshots use the old paths. Three screens retain
      material changes because their generated imported stylesheet routes moved.
- [x] Update legacy fixtures to keep genuine Added/Removed evidence distinct
      from detected moves; retain exact reader diagnostic assertions.
- [x] Update static hydration coverage to retain a real removed page and prove
      a paired page has its prior path, no removed record and no old-route alias.
- [x] Drain the new controls test service before removing its fixture workspace.
- [x] Verify identical content across the full scheme set and Light-only similarity.
- [x] Run `cargo xtask check`, then commit and push.
  - [x] Package: both packages pass all six consumer scenarios; example Build
        and Check validate 452 files; all declaration checks pass.
  - [x] Repository formatting, lint, four ratchets, Rust formatting, Clippy,
        15 Rust tests and the 9-file Rust length audit pass.
  - [x] Confirm the same braces advisory and exactly the original 28 source-length
        violations, with no dependency change or new exception.
  - [x] Pass changed-file Prettier, focused regressions and the deletion audit.
  - [x] Browser: 745 passed, with zero skips; all three known base-flaky tests
        passed on the first run.
  - [x] Hydration: 229 passed, with zero skips or cancellations.
  - [x] Unit: 3,849 passed, with zero skips or cancellations. Run suites without
        overlapping preparation builds so their assets remain stable.
  - [x] Inspect the staged diff, commit and fast-forward push.

The orchestrator reviews this milestone; the complete implementation review
remains the final item in Milestone 8.

## Milestone 5A: Move detection review fixes

Correct move evidence so authored content, resources and references retain their
identity through a directory move. Keep matching efficient and diagnostics visible
to authors. Write failing regressions before each fix, and update the contracts
with the implementation.

Status: Complete. Package (six consumer scenarios), unit (3,946), browser (745)
and hydration (229) pass. The repository checks pass under the existing braces
advisory and 28-file source-length dispositions. No dependency, new exception
or shell presentation change was added.

- [x] Compare document similarity using Markdown after front matter; define
      page similarity from authored visible body content and reject unrelated
      short documents while retaining edited moves (1).
- [x] Normalize resource references by resolved identity, pair source-derived
      generated routes by content, and suppress byte-identical moved resource
      dependency/shared-impact reasons in material classification (2).
- [x] Repeat identical-content pairing to a fixed point with newly accepted
      pairs; preserve permanent ambiguity across iterations and later signals (3).
- [x] Group normalized content by hash before full equality comparisons, with
      pairwise fallback only for differing ignore-region sets; prove linear
      full-comparison counts for unique content (4).
- [x] Strengthen removed-ambiguity and pass-order tests, restore unpaired
      kind-reuse discard coverage, and extend move fixtures with depth, CSS,
      cross-file links, separate flows, component users and unrelated documents (5).
- [x] Report ambiguity and unmatched movedFrom diagnostics in Serve and export
      terminal output through the existing terminal presentation boundary (6).
- [x] Retain accepted Markdown bodies privately, with a separate committed-source
      reader for derived baselines; never read a newer body for an accepted generation.
- [x] Share the CSS URL tokenizer with resource canonicalisation; resolve each
      original srcset token once, including repeated destinations.
- [x] Map generated styles for moved re-exporting entry roots by their accepted
      views; keep surviving consumers of a formerly shared route unchanged.
- [x] Include complete parent variant evidence in the fingerprint read set, even
      when a variant path already exists; skip incompatible candidate roles.
- [x] Preserve imported-resource identity when a source directory moves but an
      explicit entry path stays fixed; do not emit a move for that stable path.
- [x] Normalize inventoried owned-source paths through defining-module moves;
      suppress relocated dependency evidence only when confined file bytes match.
- [x] Update moves/Changes contracts, affected guides and READMEs; keep source
      files within their limits without altering the 28 existing violations.
- [x] Smoke-test a real directory move, with and without edits, including
      imported CSS, links, a flow and a component with users. Prove all pairs,
      unmodified pure moves, changed edits, old before paths and no paired removals.
- [x] Run package, unit, browser and hydration suites serially plus all repository
      checks and changed-file Prettier under the approved audit/length dispositions.
  - [x] Package: both packages pass all six packed consumer scenarios; Build/Check
        validate 452 example files and all declaration checks pass.
  - [x] Final unit: 3,946 passed, with zero failures, skips or cancellations.
  - [x] Browser: 745 passed. All three known base-flaky cases passed first run.
  - [x] Hydration: 229 passed, with zero failures, skips or cancellations.
  - [x] The 113 focused move/deletion/path-reuse regressions pass. Initial full-unit run:
        3,938 of 3,940 passed; fixed resource-validation error order. The second
        run passed 3,944 of 3,946; fixed complete parent fingerprint reads for
        the two existing parent/variant path-reuse cases. The final run passes all.
  - [x] Repository format, lint, four ratchets, Rust fmt/Clippy, 15 Rust tests
        and the 9-file Rust length audit pass. The existing audit advisory remains.
- [x] Inspect deletions and staged changes, then commit and fast-forward push.

The orchestrator reviews this milestone; the complete implementation review
remains the final item in Milestone 8.

## Milestone 6: Viewer navigation

Tags: ui

Bring the shell to the Milestone 2 mockups.

- [ ] Rename the Pages section to Specs across `packages/viewer/src/shell`
      (`nav.tsx`, `nav_model.ts`, `nav_tree.ts`, `entry_wording.ts`) and
      build the Components section from entries of kind `component` and the
      Specs section from every other kind.
- [ ] Make folder rows browse-only, add the Overview first-child row with the
      title fallback, and keep the entry-with-variants row
      (`nav_rows.tsx`, `nav_leaf_rows.tsx`, `css_nav_rows.ts`,
      `css_nav_variants.ts`).
- [ ] Make a breadcrumb folder segment open the folder page when it exists and
      otherwise expand the folder.
- [ ] Remove obsolete storage-key cleanup while moving to v4; earlier keys
      must remain unread, untranslated and untouched.
- [ ] Move disclosure keys to `folder:<path>`, `variants:<path>`, and the
      `specs` and `components` section keys, with reconciliation and Collapse
      all (`disclosure_keys.ts`, `disclosure_storage.ts`).
- [ ] Match search against path segments and titles
      (`nav_filter.tsx`, `search_query.ts`).
- [ ] Route `/view/<path>` through the store and history
      (`store_browser_routes.ts`, `store_browser_urls.ts`) and keep the
      missing view for unknown paths.
- [ ] Add the document icon; an Overview row uses its index page's own icon,
      with no dedicated folder-page icon. Show the component path in component
      details.
- [ ] Update and add browser tests under `tests/browser` for browsing,
      disclosures, variants, and navigation, and the viewer unit tests under
      `packages/viewer/tests`; verify parity with the Milestone 2 screens.
- [ ] Re-apply the drafted `docs/guides/catalogue/browse.md`,
      `search-and-filters.md`, and `details.md` from commit `d65417d` and
      reconcile them with the implemented shell.
- [ ] Run `cargo xtask check`, then commit and push.

## Milestone 7: Viewer Changes and document presentation

Tags: ui

- [ ] Attach a removed variant to its moved parent through the current parent's
      `previousPath`; the removed record retains its baseline `variantOf`.

- [ ] Treat removed document rows like removed page rows when filtering All and
      Changes; keep the document icon and final navigation behavior with the UI work.
- [ ] Show the existing Light-only fallback note when a current or removed document
      has no dark scheme but the reader selects Dark.

- [ ] Label paired entries "Moved" in Changes rows and details, show the
      previous path in details, and drive the baseline side of comparisons
      from `previousPath` (`nav_changed.ts`, `details_rows.tsx`,
      `view_status.ts`, `comparison_request.ts`,
      `packages/viewer/src/catalogue/snapshot_identity.ts`).
- [ ] Present documents in the page view with the document title, breadcrumbs,
      and the source path in details; link `relatedDocs` matches to their
      document entries (`details.relatedDocs` now emits validated `mock:<path>`
      references for discovered current documents).
- [ ] Add browser tests for moved rows, moved comparisons, and document pages;
      verify parity with the Milestone 2 screens.
- [ ] Re-apply the drafted `docs/guides/catalogue/changes.md` and
      `export-and-host.md` from commit `d65417d` and reconcile them with the
      implemented Changes view.
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
- Configurable sections: splitting other kinds into their own section, or
  removing the Specs and Components split.
- Smoke-test the published package against a consumer repository that uses
  the co-located layout.
