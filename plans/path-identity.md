# Path Identity, Spec Tree, And Markdown Documents

Status: Complete. PR #131 merged on 2026-10-05 as `c4138a0`. The open review
items and the user's decisions on them are owned by
[Path Identity Follow-up](./path-identity-follow-up.md). Created 2026-10-02
with the user's consent. Milestones 1–7 and all lettered milestones through 7D are
complete, including main integration, viewer integration and file-length
compliance. Milestone 8 implementation, verification and the fresh
implementation review are complete. On 2026-10-04 the user approved the
recommended option for each of the eight findings in the
[review record](../docs/reviews/path-identity.md); Milestones 9–13 deliver
those fixes and end with a new review. Milestones 9–12 are complete. Milestone
13 is complete, including a second fresh review with fifteen findings in the
[review record](../docs/reviews/path-identity.md#second-review). On 2026-10-04
the user approved one shared branch-point lookup for findings 1, 6, 8, 9, and 11. Milestones 14–17 deliver it and end with a new review. Milestones 14–17
are complete, including a third fresh review whose six findings, and four
items found during Milestone 16, are in the
[review record](../docs/reviews/path-identity.md#third-review). On 2026-10-05
the user approved a shared console rule for item 9, found during Milestone 16, which
failed the pull request's CI. Milestone 18 delivered it, and CI passes; its
review found four Low findings. They, the other third-review items, and the ten
undecided second-review findings await the user's decision.
This plan supersedes
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
    builds of this version, not compatibility with earlier output. Only the
    current encoded Mokly HTML header proves ownership; plain Mokly and all
    Mokabook headers grant no replacement or deletion authority. Preview output
    needs current export ownership; earlier preview markers cannot adopt
    pre-derived `view/` files. Authors preserve authored files, delete earlier
    generated output, and rebuild manually. The example catalogue, fixtures, and tests are rewritten to the new model
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

Status: Complete.

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

Status: Complete.

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

Status: Complete. After merging Milestone 3B, package (six consumer
scenarios), unit (3,738), browser (751), hydration (226), and the repository
commands that were run pass. The approved full-gate exception remains
pre-existing GHSA-vfj7-8cjw-p6xm in development dependencies; no dependency
change or audit exemption was added. That run omitted the source file-length
audit, which also fails on files earlier milestones changed; Milestone 6 added
`tests/nav_tree.test.ts` to that list, and Milestone 6A split it.

- [x] Rename the Pages section to Specs across `packages/viewer/src/shell`
      (`nav.tsx`, `nav_model.ts`, `nav_tree.ts`, `entry_wording.ts`) and
      build the Components section from entries of kind `component` and the
      Specs section from every other kind.
- [x] Make folder rows browse-only, add the Overview first-child row with the
      title fallback, and keep the entry-with-variants row
      (`nav_rows.tsx`, `nav_leaf_rows.tsx`, `css_nav_rows.ts`,
      `css_nav_variants.ts`).
- [x] Make a breadcrumb folder segment open the folder page when it exists and
      otherwise expand the folder.
- [x] Remove obsolete storage-key cleanup while moving to v4; earlier keys
      must remain unread, untranslated and untouched.
- [x] Move disclosure keys to `folder:<section>:<path>`, `variants:<path>`,
      and the `specs` and `components` section keys, with reconciliation and
      Collapse all (`disclosure_keys.ts`, `disclosure_storage.ts`).
- [x] Match search against path segments and titles
      (`nav_filter.tsx`, `search_query.ts`).
- [x] Route `/view/<path>` through the store and history
      (`store_browser_routes.ts`, `store_browser_urls.ts`) and keep the
      missing view for unknown paths.
- [x] Add the document icon; an Overview row uses its index page's own icon,
      with no dedicated folder-page icon. Show the component path in component
      details.
- [x] Replace the `#`-prefixed ID chip with the path chip, which shows the
      path as written and announces `Copied path <path>`.
- [x] Render a breadcrumb folder without its own page as a button that opens
      its section, ancestors, enclosing entry lists, and the folder, clears
      only a hiding filter, opens the drawer below the breakpoint, and
      focuses the folder row; keep hidden folders and removed entries' crumbs
      as text.
- [x] Name an entry row's toggle `contents` instead of `variants` when its
      list also holds folder members, before and after hydration.
- [x] Retitle the watched folder test at
      `tests/browser/watch_folders.spec.ts` as a title change and add a case
      that changes the folder's path and proves the old keys leave saved
      storage.
- [x] Rewrite the obsolete-key tests in `nav_sections.test.ts`,
      `client_disclosures.test.ts`, `client_browse_navigation.test.ts`,
      `client_browse.test.ts`, and `tests/browser/browse_disclosures.spec.ts`
      with current folder paths and v3 storage, so they prove earlier keys
      are never read, translated, or removed.
- [x] Show the path chip before the change status, as the screen header
      design does.
- [x] Start stacked frames at the top of a narrow stage so the first frame
      and its label stay reachable, a defect found by the parity check
      (`css_views_responsive.ts`, `tests/browser/stage_stacking.spec.ts`).
- [x] Update and add browser tests under `tests/browser` for browsing,
      disclosures, variants, and navigation, and the viewer unit tests under
      `packages/viewer/tests`; verify parity with the Milestone 2 screens.
- [x] Re-apply the drafted `docs/guides/catalogue/browse.md`,
      `search-and-filters.md`, and `details.md` from commit `d65417d` and
      reconcile them with the implemented shell.
- [x] Run `cargo xtask check`, then commit and push.

## Milestone 6A: Index entry mockups

Tags: mockup

Mock up a screen that is its folder's own page and lists the folder's members
under its row, in Browse and in Changes, before Milestone 7 implements the
Changes click rule for it.

Status: Complete. Package (six consumer scenarios), unit (3,748), browser
(753), hydration (232), format, lint, repository ratchets, Rust formatting,
Clippy, and Rust tests pass. Two repository checks still fail on earlier work:
GHSA-vfj7-8cjw-p6xm, the approved exception, and the source file-length audit,
which flags 28 files that Milestones 3 and 3B changed and that were already
over 300 lines. This milestone added no file to that list. The user decided
to have those files split in a separate refactoring milestone after this branch
merges, and to run `node scripts/verification/source-file-length.mjs` in every
later milestone's verification.

- [x] Add design screens, each with mobile and desktop variants, for: a screen
      that is its folder's own page with its variants and folder members under
      its row, showing the link beside the disclosure button, the `contents`
      toggle wording, variants before members, and a member's breadcrumbs; an
      unchanged index entry whose only changed rows are folder members, shown
      in Changes as a container row with no dot; and the first changed member
      that activating that row opens. Extend the depicted catalogue under
      Account, keep each screen reachable from existing designs, keep
      annotations outside the screen area, and stay within five screens per
      folder.
- [x] Add catalogue navigation library variants for those rows, so the shared
      component also shows them in its mobile drawer presentation.
- [x] Rename `mbk-idchip` to `mbk-pathchip` throughout the mockups and their
      styles, and update the tests that pin the class name.
- [x] Define the Changes click rule in `mokly-variant-navigation.md` and
      `mokly-changes.md`, and record the new screens and transitions in
      `mokly-shell-design-inventory.md` and the design-links contract.
- [x] Move the depicted catalogue, its branches, and its transitions from the
      inventory into `mokly-shell-design-catalogue.md`, so the inventory stays
      within its 250-line limit and the design-links contract within its cap.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design unit tests and design browser specs, and the full gate except
      the known audit failure; smoke-test the new screens through
      `npm run dev`.
- [x] Split `tests/nav_tree.test.ts`, which Milestone 6 grew past 300 lines,
      into `nav_tree.test.ts`, `nav_tree_tags.test.ts`, and a shared
      `tests/helpers/nav_tree_fixture.ts`.
- [x] Mark `design/browse/index-entries/member-changes` as a changed design
      in the comparison-eligibility browser spec, because it offers the
      comparison band.
- [x] Commit and push (`916d3c0e`).

## Milestone 6B: Viewer navigation review fixes

Tags: ui

Fix what an independent review of Milestone 6 found in the shell's rows,
breadcrumb reveal, search, and tests. Every bug gets a failing test first.

Status: Complete. Package (six consumer scenarios), unit (3,759), hydration
(234), format, lint, repository ratchets, Rust formatting, Clippy, and Rust
tests pass. The browser suite passes 756 of 757 tests. The failing test,
`component_example.spec.ts` › desktop, fails on a cold server in this
environment and passes when the server is warm; it fails in two of three
fresh-server runs both at `916d3c0e` and on this branch, so it is not caused by
this milestone. The dependency audit still fails on GHSA-vfj7-8cjw-p6xm, the
approved exception, and the source file-length audit lists only the 28
pre-existing files.

- [x] Hide the variant and member rows of a hidden folder's own screen or
      component in All and search, and keep a saved-open list hidden before
      hydration when its parent row is hidden (`nav_tree.ts`,
      `early_disclosures.ts`, `preferences.ts`); cover a hidden screen index
      and a hidden component index in unit and browser tests.
- [x] Make the breadcrumb reveal clear a tag-only query, and keep the reveal
      pending until the folder row is visible, then focus and scroll it, also
      when an embedded host commits the cleared selection later
      (`store_actions.ts`, `nav_scroll.ts`).
- [x] When search and the Changes filter hide a folder only together, clear
      the search, then fall back to All (`nav_reveal.ts`), and state that order
      in the folder contract.
- [x] Sort a folder whose own page is in the other section by the row it
      renders as in each section (`registry/hierarchy.ts`). The public tree
      now carries each folder's `order` and the top-level `treeOrder`, so the
      viewer orders each section as Serve does
      (`docs/protocol/mokly-catalogue-tree.md`).
- [x] Match search against folder titles, so a folder whose resolved title
      matches shows with all its descendants (`nav_model.ts`), and state the
      rule in the navigation contract.
- [x] Use one shared helper for a row's search text, so Changes activation and
      row visibility agree for removed variants (`changes_activation.ts`,
      `nav_model.ts`).
- [x] Make three tests prove their titles: v3 keys whose form v4 keeps in
      `browse_disclosures.spec.ts`, both file layouts built through the real
      registry (moved from `nav_folder_rows.test.ts` to
      `tests/nav_file_layouts.test.ts`, because the registry lives in the root
      package), and the pre-hydration state held back with `delayHydration` in
      `browse_folder_rows.spec.ts`.
- [x] Replace the stale Pages statements in `mokly-component-explorer.md` and
      `examples/basic/README.md` (the README statement was already replaced in
      Milestone 6A).
- [x] Require the folder-title lookup in `revealSelection`,
      `mergeSelection`, and `searchRow`, so no caller can leave folder titles
      out of a search row.
- [x] Move the shell destination queries from `mokly-navigation.md` to
      `mokly-shell-destinations.md`, so the navigation contract states the
      folder-title search rule within its reviewed cap, now 383 lines.
- [x] Run the focused tests, Prettier on changed files, the full gate except
      the known audit failure, and
      `node scripts/verification/source-file-length.mjs`, which must list no
      file beyond the 28 pre-existing ones; re-check parity for changed rows.
      The example's section trees are identical before and after the change,
      and no design state depicts a hidden folder, a cross-section folder
      page, or a free-text search.
- [x] Commit and push (`f01a6e2f`).

## Milestone 6C: Integrate Milestone 4

Bring Milestone 4's Markdown documents into this branch, so the later
integration with the feature branch meets only Milestone 5's changes, and
reconcile documents with the viewer navigation.

Status: Complete. Package (six consumer scenarios), unit (3,841), browser
(763), hydration (237), format, lint, repository ratchets, Rust formatting,
Clippy, Rust tests, and the Rust file-length audit pass. The dependency audit
still fails on GHSA-vfj7-8cjw-p6xm, and the source file-length audit lists
only the 28 known files.

- [x] Fetch the feature branch, record the source tip `4b10b657` and the
      additions audit from `bda69311` (one commit, `1b0eb703`: 27 added and
      108 changed files, no deletions), and merge it; resolve each conflict
      path by path.
- [x] Reconcile documents with the navigation: a `README.md` or `index.md`
      folder page renders as the Overview row with the document icon;
      documents use the document icon in the tree and in search; search
      covers their titles, path segments, and tags; breadcrumbs open document
      folder pages; the example's README documents produce the rows the
      mockups show. The merged code already did all of this; new tests guard
      it (`tests/nav_markdown_rows.test.ts`,
      `tests/browser/markdown_navigation.spec.ts`).
- [x] Re-check parity against `design/browse/views/folder-overview` and
      `design/browse/pages/document` with the real example, and save
      screenshots under `.context/m6c/`. The rows, icons, titles, path chips,
      crumbs, and control-free stage match. The document typography did not
      match the design; Milestone 6D aligns it. The design's
      `Catalogue home` crumb and icon-only Details bar differ for every entry
      kind, so they stay with the earlier design and runtime differences
      outside this plan. The real example also lists `Workspace guide`, which
      the design's fixture catalogue does not depict.
- [x] Update two browser tests that expected the Example folder's crumb to be
      plain or absent: the README now gives Example its own page, so the crumb
      links to `/view/example/` (`browse.spec.ts` "breadcrumbs track hierarchy
      through progressive history", `static_example.spec.ts` "the exported
      example discloses a screen's variants without a server").
- [x] Run the full gate and, after `git fetch origin main`,
      `node scripts/verification/source-file-length.mjs`; only the 28 known
      files may be listed. The known exceptions are the dependency audit and
      the cold-server `component_example.spec.ts` desktop failure. The first
      browser run passed 761 of 763; after the two crumb test updates, the
      complete browser suite passed 763 of 763, the cold-server test
      included.
- [x] Commit and push (`13faa1e6`, `a341bbb1`).

Merge decisions (no file is deleted):

- `docs/protocol/mokly-changes.md`: keep Milestone 4's statement that
  documents use the page material rules, and keep Milestone 6A's statement
  that opening a folder screen's first changed member remains planned.
- `examples/basic/README.md`: keep this branch's statement that the runtime
  renders the Specs tree, because Milestone 6 replaced the Pages label; take
  Milestone 4's description of the real example documents; name the design
  screens as the subject of the next sentence, which had become ambiguous.
- `plans/path-identity.md`: list both sides' complete milestones in the
  header; in Milestone 7, keep Milestone 4's extended `relatedDocs` TODO and
  Milestone 6A's container-row TODO.

## Milestone 6D: Document typography parity

Tags: ui

Render Markdown documents in the typography that the document design
depicts, which the Milestone 6C parity check found different.

Status: Complete, verified by the Milestone 6C full gate.

- [x] Add a browser test that compares the document template's computed
      styles with the `design/browse/pages/document` artboard, on desktop and
      mobile, for the body, measure, headings, paragraphs, links, inline
      code, tables, and lists; confirm that it fails first
      (`tests/browser/document_typography.spec.ts`).
- [x] Align `src/documents/template.ts` with the design: 14.5px body text on
      a 720px measure, 26px and 17px headings, semibold underlined links,
      bordered inline code, full-width tables, 22px list indents, and the
      shell's soft background; below 600px, 14px body text and a 22px
      title. Undepicted elements follow the same scale.
- [x] State the typography in `docs/protocol/mokly-documents.md` and the
      documents README.
- [x] Run the full gate and, after `git fetch origin main`,
      `node scripts/verification/source-file-length.mjs`.
- [x] Commit and push (`a341bbb1`).

## Milestone 6E: Light-only document mockup

Tags: mockup

Status: Complete.

Milestone 7 shows the existing Light-only fallback note on documents. A
document's stage has no frame label, and no design showed where the note goes,
so mock it up first.

- [x] Add `design/browse/appearance/states/light-only-document` in both schemes
      and both viewports: on a branch that removed the Payment terms document,
      its previous version has only a light render, so under Dark its pane
      stays light and its label reads `Showing previous version — Light only`.
- [x] Record the screen in the shell design inventory and the depicted
      catalogue, and state the note's placement in the documents and removed
      previews contracts.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and the design tests; smoke-test the screen through `npm run dev`.
- [x] Keep the pane light with a `data-mbk-light-only` palette scope in
      `generated/design.css`, because an artboard states its own appearance
      exactly once; add the screen's own stylesheet rule so it reads in the
      shell's Markdown typography; update the design counts.
- [x] Commit and push (`2b213e96`, pushed with the first part of
      Milestone 7).

## Milestone 6F: Index member landing view mockup

Tags: mockup

Status: Complete.

Activating the unmodified Profile row in Changes opens Security on its first
changed view, because `mokly-changes.md` lands a reader on the first changed
view when the current selection is not a changed entry. The
`design/browse/index-entries/member-changes` mockup showed Both instead. This
milestone aligns the mockup with that rule, as
`design/browse/variants/variant-changes` already shows one view.

- [x] Depict Security as changed in its Light views on both viewports, so its
      first changed view is Mobile · Light. Select Mobile on both artboards,
      and mark the viewport control because Desktop also changed; the
      Appearance control stays unmarked.
- [x] Describe the landing view in the shell design inventory and the
      depicted catalogue.
- [x] Pin the selection and the mark in the design unit and browser tests
      (`tests/design_index_entries.test.ts`,
      `tests/browser/design_index_entries.spec.ts`).
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and the design tests; smoke-test the screen through `npm run dev`. The
      design unit tests (167) and design browser tests (92) pass. At both
      artboard widths the screen shows Mobile with the viewport mark and the
      comparison band (`.context/m6f/`).
- [x] Commit and push (`99032ff2`).

## Milestone 6G: Integrate main

Preserve main's audited dependency exception and output/frame race fixes while
adapting them to file-derived paths, nested output transactions and path-keyed
frame usage. Keep the viewer branch separate until the orchestrator requests it.

Status: Complete. Package (six consumer scenarios), unit (4,050), browser (746)
and hydration (229) pass. The dependency audit now passes with main's unchanged,
reviewed exception. Only 26 members of the old 28-file length list remain.
The two-parent merge and every remerge-diff path were reviewed before push.

- [x] Fetch main, capture the source tip and merge base, and save every main
      addition in `.context/main-additions-6g.txt` before integration.
- [x] Merge `origin/main` and resolve each conflict path by path. Preserve the
      audit evaluator, exception, fixtures and tests without alteration.
- [x] Retain the writer lock, cancellation and export capture/recheck protection
      around nested output installation, pruning and rollback.
- [x] Retain frame usage synchronization and its race test with path-keyed
      identity; migrate every new main regression to the path layout.
- [x] Audit every main addition, source README and protocol change for feature
      preservation; enumerate every authorized deletion relative to main.
- [x] Run focused regressions and the unmodified `cargo xtask check`; run every
      remaining suite and repository command if the known length check stops it.
      Keep only the known 28-file length disposition for Milestone 6I.
- [x] Commit the two-parent merge with its resolution and deletion decisions.
      Immediately confirm exactly two parents and inspect every remerge-diff path.
- [x] Finish any required post-merge verification, then fast-forward push the
      feature branch and report the merge review and test results.

Preservation record:

- Source tip: `25afbc75bbae5638acf5a70b0a7385de3be41f1f`; merge base:
  `b2c82c15`; main tip: `800fe9f88a0173429b25baa1bcf41ed9e59b2256`.
  The saved additions audit lists 67 paths, including 28 additions. All remain.
- `docs/protocol/README.md`: keep main's exception/audit description and the
  feature's catalogue serialization and public-exclusion links.
- `plans/README.md`: retain Path Identity as Active, update its status, and keep
  main's completed Imported CSS Delivery entry instead of its stale Active copy.
- `src/build/README.md`: retain the path-specific module guide and add main's
  lock APIs and transaction guidance without duplicating existing module entries.
- `src/build/transaction.ts`: retain both `OutputDirectories` and the lock imports.
  Main's lock surrounds validation, backup, nested-directory pruning, installation,
  rollback, cleanup and final generated-directory pruning. Case-folded target
  discovery and previous-manifest ownership remain unchanged.
- `packages/viewer/src/shell/frame_mount_hook.ts` keeps `entryPath`/`variantPath`
  while main's unchanged `frame_session_usage.ts` finishes usage adoption in the
  same task as its final revision check. Keep the extracted fake and race test;
  migrate the harness's replacement URL to `<path>/index.html`.
- `tests/helpers/generated_output_fixture.ts` uses complete nested paths instead
  of `id`/`navPath`. The concurrency test retains main's exact-byte/tree checks
  and also proves removal of obsolete screen directories. The existing rollback
  test asserts the lock remains held; the no-directory-watch test now permits
  only the lock's private cache-directory cleanup, not generated-directory churn.
- Preserve every audit evaluator, exception, fixture and audit test byte for byte
  from main. Keep export's locked write/capture and recheck, Serve wait cancellation,
  baseline ancestor retries, streaming watch helpers, and native CI lock coverage.
- `mokly-component-explorer.md`: state the retained mount/usage rule in concise
  prose so the merged document stays within its existing 250-line cap.
- Main's frame hook and harness extraction resolves two of the old 28 length
  violations. The audit now lists 26 members of that original set, with no new
  violation or exemption; Milestone 6I owns the remaining split.

Authorized deletions relative to main:

All 17 deletions predate this merge and follow the accepted Milestone 1/3 path
migration and decision 14. No main addition is deleted. The exact paths and
preserved replacements are:

- `docs/protocol/mokly-nav-paths.md`: Milestone 1 replaces navigation labels with `mokly-paths.md` and `mokly-folders.md`.
- `docs/protocol/mokly-nested-authoring.md`: Milestone 1 replaces the old nesting model with roots and folder contracts.
- `examples/basic/entries/design/browse/appearance/index.tsx`: Milestone 3 splits discovery into `specs/design/browse/appearance/*.mockup.ts` and preserves the overview and child render helpers.
- `examples/basic/entries/design/components/controls/index.tsx`: Milestone 3 relocates the controls definition to `specs/design/components/controls/index.tsx` with an `index.mockup.ts` entry.
- `examples/basic/entries/design/components/index.tsx`: Milestone 3 relocates the component overview to `specs/design/components/index.tsx` with an `index.mockup.ts` entry.
- `examples/basic/entries/design/components/pages/stacked/screens.tsx`: Milestone 3 preserves these screens at `specs/design/components/pages/stacked/screens.tsx`.
- `examples/basic/entries/design/components/parts/destinations.ts`: Milestone 3 preserves the destination map at `specs/design/components/parts/destinations.ts`, using paths.
- `examples/basic/entries/design/components/states/additions/screens.tsx`: Milestone 3 preserves these screens at `specs/design/components/states/additions/screens.tsx`.
- `examples/basic/entries/design/components/states/loading/screens.tsx`: Milestone 3 preserves these screens at `specs/design/components/states/loading/screens.tsx`.
- `examples/basic/entries/design/components/states/shared-impact/screens.tsx`: Milestone 3 preserves these screens at `specs/design/components/states/shared-impact/screens.tsx`.
- `examples/basic/entries/design/design.mockup.tsx`: Milestone 3 replaces the `defineRoot`/`folder` aggregator with discovered `.mockup.ts` entries and `_folder.json` records under `specs/design`.
- `examples/basic/entries/design/library/library.mockup.ts`: Milestone 3 replaces the aggregate export with one `.mockup.ts` entry beside each library component under `specs/design/library`.
- `examples/basic/entries/design/parts/destinations.ts`: Milestone 3 preserves the path-based destination map at `specs/design/parts/destinations.ts`.
- `examples/basic/entries/design/parts/screen_heads.tsx`: Milestone 3 preserves the header components at `specs/design/parts/screen_heads.tsx`.
- `packages/viewer/src/registry/hierarchy_conflicts.ts`: Milestone 3 replaces navPath/title conflicts with path collision validation and the path-derived hierarchy.
- `src/config/entry_globs.ts`: Milestone 3 replaces the single entry-glob model with `roots.ts`, `root_membership.ts` and root-scoped discovery.
- `src/registry/changed_ids.ts`: Milestone 3 replaces ID comparison with `src/registry/changed_paths.ts`.

Focused integration checks: 122 passed. Package checks pass all six consumer
scenarios and validate 452 example files. Unit checks pass all 4,050 tests with
zero failures, skips or cancellations. Browser checks pass all 746 tests, including
main's frame-usage race regression; all three known flaky tests pass first run.
Hydration passes 229 tests with zero failures, skips or cancellations. All four
repository ratchets, Rust fmt/Clippy, 15 Rust tests and the 9-file Rust length
audit pass. Changed-file Prettier and whitespace checks pass.
The unmodified aggregate gate passes
its audit, format and lint steps, then stops at the 26 remaining known length
violations. No other exception is added; the remaining commands run separately.

Merge review:

- Confirmed exactly two parents immediately after committing: the saved source
  tip `25afbc75` and main `800fe9f8`. No octopus or viewer merge was created.
- Reviewed all 11 remerge-diff paths: the protocol index, component-explorer
  contract, shell README, frame hook harness, plan index, this plan, build README,
  transaction, concurrency test, generated-output fixture and path transaction
  regressions. Each difference is accounted for by the preservation record above.
- No lost main feature was found. The subsequent amendment only completes this
  review record and verification status; repeat the two-parent and every-path
  remerge checks after that amendment, before pushing.
- Rechecked all 17 authorized deletions against main. They exactly match the
  pre-integration ledger; this merge removes no file from its feature parent.
- The 6A–6F text is a plan-only copy from the viewer branch, with its separate
  branch status stated above. The viewer implementation remains unmerged.

The orchestrator owns the later viewer merge and length split. The complete
implementation review remains the final item in Milestone 8.

## Milestone 6H: Main integration review fixes

Close the remaining compile/read race and integration gaps. Capture stable
output-validation evidence without holding the writer lock while rendering.
Write failing regressions first and preserve the native safety checks.

Status: Complete. Package (six consumer scenarios), unit (4,059), browser (746)
and hydration (229) pass. Audit and the remaining repository checks pass.
Only the same 26 source-length files retain their approved disposition.

- [x] Capture compile and Serve output-validation snapshots under the writer
      lock; handle vanished paths and manifest reads without hiding unsafe
      symlinks. Prove case-only and ordinary directory moves with two processes (1).
- [x] Clarify that marked adds no advisory and the reviewed Braces record is
      the live audit's only exception (2).
- [x] Run path transaction regressions on native macOS/Windows CI and pin
      the workflow coverage in its test (3).
- [x] Assert the lock inside output-tree mkdir/rmdir calls during pruning,
      installation, rollback and final reserved-directory cleanup (4).
- [x] Retain validated output routes and orphan evidence in private runtime IPC;
      keep demand/background workers free of filesystem snapshot reads and locks.
- [x] Preserve export cancellation while its initial and recheck compilations
      wait for an output snapshot; keep the Serve close test focused on write waits.
- [x] Use directory-entry spelling for case-only assertions and native path
      separators for rollback injection in the newly enabled native tests.
- [x] Update the affected contracts and READMEs; keep files within their limits.
- [x] Run the unmodified aggregate gate and all remaining suites/commands under
      the existing 26-file length disposition; inspect deletions and staged output.
  - [x] Package checks pass all six consumer scenarios and validate 452 example files.
  - [x] Unit: 4,059 passed, with zero failures, skips or cancellations.
  - [x] Browser: 746 passed. All three known flaky cases and the frame-usage
        race regression pass on the first run.
  - [x] Hydration: 229 passed, with zero failures, skips or cancellations.
  - [x] Repository audit, formatting, lint, four ratchets, Rust fmt/Clippy,
        15 Rust tests and the 9-file Rust length audit pass. Source length
        retains exactly the 26 known files; no override or exemption changed.
  - [x] Focused regressions pass: 42 lifecycle/snapshot/resource checks, 102
        boundary/config/privacy checks and 22 final targeted checks. Protocol and
        guide checks pass all 32 tests. Changed-file Prettier passes all 36 files.
- [x] Commit and fast-forward push the feature branch.

The orchestrator owns the next viewer merge. The complete implementation review
remains the final item in Milestone 8.

## Milestone 6I: Integrate the viewer branch

Use a module lexer for export references, review the viewer branch's backend
changes, then integrate its navigation and Changes presentation when the
orchestrator confirms the branch is final. Preserve every accepted feature and
the output/frame race fixes. Keep the scanner fix in its own commit.

Status: Complete. The orchestrator confirmed viewer tip `af4f0f15` as final.
Scanner commit `e5aca6fa` is pushed. The read-only 7A review, integration
verification and two-parent remerge-diff review are complete. Milestone 6J
follows the integration push.

- [x] Replace the export import regular expression with a real module lexer;
      add failing regressions for quoted prose, the minified Moved from label,
      and missing relative specifiers containing `+` or `:`. Record the dependency
      and verify the packed consumers, audit and remaining gate before committing
      and fast-forward pushing this fix separately.
- [x] Review the Milestone 7A backend commit `3996b061` read-only against the
      moves, catalogue, export and reference contracts. Record findings and
      recommended fixes without changing that code before the merge.
- [x] Wait for the orchestrator's explicit final-branch signal, then fetch and
      merge `origin/conductor/path-identity-m6-viewer` into the feature branch.
- [x] Resolve conflicts path by path. Preserve every milestone and tick, real
      Markdown navigation, race fixes, and both branches' data/contract intent.
      Keep the lexer instead of 7A's regex tweak and keep its regression test.
- [x] Fix confirmed 7A backend findings after the merge, with failing tests first;
      update affected contracts and READMEs and report the review scope.
- [x] Reproduce the design-library temporary-props status failure in isolation.
      Keep its exact saved-variant status through reset and variant selection,
      including when the uncommitted integration makes that variant Changed.
- [x] Run the unmodified gate after integration. Run all remaining suites and
      repository checks if the known source-length violations stop it; add no
      audit exception and rerun known browser failures in isolation.
- [x] Inspect deletions and staged changes, then commit the two-parent merge.
      Immediately confirm exactly two parents and inspect every remerge-diff
      path, recording each resolution and authorized deletion here.
- [x] Fast-forward push the merge and report its verification and review results.

Scanner verification: `es-module-lexer` 3.0.2 adds one MIT-licensed package with
no runtime dependencies and no new audit advisory. Seven focused regressions
fail before the fix; all 32 focused export tests pass after it. Package checks
pass both packages and all six consumer scenarios, including Serve/export smoke
and the production-only audit. Build/Check validate 452 example files. Unit,
browser and hydration pass 4,071, 746 and 229 tests, respectively, with no skips
or cancellations. All three known browser flakes pass first run. The unmodified
aggregate gate passes audit, format and lint, then stops only at the exact same
26-file length list as 6H. Remaining ratchets, Rust fmt/Clippy, 15 Rust tests and
the 9-file Rust length audit pass. This fix deletes no file and changes no shell
module.

7A review and integration record:

- Reviewed `git show 3996b061` and its Serve/update, export, public projection,
  and validation call chains against the moves, catalogue and export contracts.
  The only confirmed finding is the known regex scanner: quoted `Draft` becomes
  an import, while relative specifiers with `+` or `:` disappear. The separately
  authorized scanner commit fixes it with regressions first. No further backend
  fix is required. The focused review is saved in `.context/m6i-7a-review.md`.
- Source tip `e5aca6fa`, viewer tip `af4f0f15`, common ancestor `943fd190`.
  Saved main and viewer additions audits before merging. Main has no additions
  after the integrated `800fe9f8` tip.
- `src/export/references.ts`: keep the module lexer and remove 7A's regex.
  Keep its exact minified Moved-from-label regression in
  `tests/export_references.test.ts`.
- `docs/protocol/mokly-export-browser.md` and `src/export/README.md`: replace
  the character-list rule with the lexer rule. Keep all other delivery,
  snapshot-lock and inventory documentation unchanged.
- `plans/path-identity.md` merges without a conflict. Preserve both parents'
  completed TODOs, all milestones, and the new 6I/6J work. Viewer navigation,
  real Markdown Overview rows/icons, documents, move presentation and 7D's
  moved-component fixes enter together. No shell edit is made during resolution.
- `plans/README.md`: record completed main/viewer integration and keep the
  source-length split and final verification pending. The plan remains Active.
- `tests/browser/design_library_runtime.spec.ts`: the first merged browser run
  passes 805 of 807 tests. Both desktop and mobile fail the final hard-coded
  Unmodified assertion; both fail again in isolation. The accepted catalogue
  correctly marks Search Changed against the pre-merge HEAD. Require a valid
  saved status, then retain that exact status after both Reset and reselecting
  Search. All rendered-prop, style and unchanged-file assertions remain. Both
  isolated cases pass after the fix. This is a fixture expectation fix, not a
  flaky-test exemption or a product behavior change.
- The merge deletes no file from the feature parent. Against main, retain the
  17 authorized deletions listed under 6G. One former rename now appears as a
  deletion: `examples/basic/entries/design/browse/appearance/states/screens.tsx`
  moved to `examples/basic/specs/design/browse/appearance/states/screens.tsx`
  in the approved layout migration; the viewer branch's added light-only
  document design reduces Git's rename similarity. Its original states remain.

Integration verification: both packages pass all six consumer scenarios and
Build/Check validate 468 example files. Unit, final browser and hydration suites
pass 4,149, 807 and 260 tests, respectively, with no skips or cancellations.
The final browser run passes the corrected design-props cases and all three
known flaky cases. Audit, formatting, lint, four repository ratchets, Rust
fmt/Clippy, 15 Rust tests and the 9-file Rust length audit pass. Both unmodified
aggregate runs stop only at the same 26 overlong files, with no new exemption.

Merge review confirms exactly two parents: `e5aca6fa` and `af4f0f15`.
Every remerge-diff path was inspected: `mokly-export-browser.md`, the plan index, this plan,
`src/export/README.md`, `src/export/references.ts`, and the design-library props
test. The differences match the resolution and test records above; no feature
loss was found. The deletion audit matches all 18 authorized paths in the
merge body. The final amendment records this review and the plan index status;
repeat the parent and six-path remerge checks before the fast-forward push.

The orchestrator reviews this integration; the complete implementation review
remains the final item in Milestone 8.

## Milestone 6J: Source file-length compliance

After viewer integration, split every file named by the source-length audit
without changing behavior or removing tests. Keep each module cohesive and
preserve public APIs. Record per-file test counts before and after each split.

Status: Complete, based on pushed merge `753fef99`. The unmodified full gate
passes, including the dependency audit and both file-length audits. The audit lists 26 files:
one production module, one browser harness and 24 test files. No protocol
file is over its applicable cap. The merged reports supply the counts below;
helper modules have zero direct tests and retain their existing consumers.

- [x] Fetch `origin/main`, run the source-length audit after the pushed viewer
      merge, and retain the complete per-file runtime reports before splitting.
- [x] Split `tests/client_navigation_state.test.ts` by responsibility; preserve its 13 direct tests.
- [x] Split `tests/client_removed_preview_requests.test.ts` by responsibility; preserve its 7 direct tests.
- [x] Split `tests/design_screens.test.tsx` by responsibility; preserve its 11 direct tests.
- [x] Split `tests/design_variants.test.ts` by responsibility; preserve its 16 direct tests.
- [x] Split `tests/publish_run.test.ts` by responsibility; preserve its 9 direct tests.
- [x] Split `tests/removed_preview_delivery.test.ts` by responsibility; preserve its 4 direct tests.
- [x] Split `tests/server.test.ts` by responsibility; preserve its 7 direct tests.
- [x] Split `tests/server_removed_preview_lifecycle.test.ts` by responsibility; preserve its 5 direct tests.
- [x] Split `tests/variant_validation.test.ts` by responsibility; preserve its 13 direct tests.
- [x] Split `tests/watch_glob_boundaries.test.ts` by responsibility; preserve its 10 direct tests.
- [x] Split `packages/viewer/tests/server.test.tsx` by responsibility; preserve its 17 direct tests.
- [x] Split `packages/viewer/tests/shell_state.test.ts` by responsibility; preserve its 14 direct tests.
- [x] Split `tests/browser/viewer_lifecycle.spec.ts` by responsibility; preserve its 8 direct tests.
- [x] Split `tests/browser/browse_navigation_security.spec.ts` by responsibility; preserve its 4 direct tests.
- [x] Split `tests/browser/changed_views.spec.ts` by responsibility; preserve its 5 direct tests.
- [x] Split `tests/browser/removed_previews.spec.ts` by responsibility; preserve its 11 direct tests.
- [x] Split `tests/browser/viewer_variants.spec.ts` by responsibility; preserve its 9 direct tests.
- [x] Split `tests/browser/standalone_appearance.spec.ts` by responsibility; preserve its 18 direct tests.
- [x] Split `tests/design_component_variant_navigation.test.ts` by responsibility; preserve its 11 direct tests.
- [x] Split `tests/browser/browse.spec.ts` by responsibility; preserve its 33 direct tests.
- [x] Split `tests/shell.test.ts` by responsibility; preserve its 29 direct tests.
- [x] Split `packages/viewer/tests/component_workspace.test.tsx` by responsibility; preserve its 3 direct tests.
- [x] Split `tests/browser/component_explorer_runtime.spec.ts` by responsibility; preserve its 11 direct tests.
- [x] Split `tests/browser/component_design.spec.ts` by responsibility; preserve its 12 direct tests.
- [x] Split `packages/viewer/tests/evidence_harness.tsx` by responsibility; preserve its 0 direct tests.
- [x] Split `packages/viewer/src/viewer/host_bridge.tsx` by responsibility; preserve its 0 direct tests.
- [x] Verify unchanged test declarations and assertions against the captured
      syntax trees, and verify each split group's runtime count against the
      merged reports.
- [x] Point the deployment source-inspection test at `browse_layout.spec.ts`,
      where its JavaScript-disabled context moved. Keep its test name and every
      assertion unchanged; confirm no other source-inspection path needs updating.
- [x] Keep the source module and harness APIs stable; update the viewer README
      for the extracted highlight hook and evidence runtime.
- [x] Confirm that no protocol document needs splitting; add no size exemption.
- [x] Run the unmodified `cargo xtask check` after the splits. Require every
      suite, dependency audit and source-length check to pass completely.
- [x] Inspect deletions and staged changes, commit the splits separately, then
      fast-forward push and report per-file counts and full verification results.

The syntax comparison preserves all 3,357 test declarations and all 16,739
original assertion expressions. The extracted highlight callback and its
dependencies, and the extracted evidence runtime bodies, also match their
pre-split syntax trees exactly. The largest formatted split file is 284 lines.
No test name or assertion was removed, and no file is deleted. One
source-inspection test changes only its moved source-file locator. Runtime
counts and browser test titles match the retained integration reports exactly.

The first unmodified full gate passes the repository and package suites, then
reports 4,148 of 4,149 unit tests passing. Its only failure is the deployment
test's old browse-spec locator. The new locator passes all three focused
deployment tests. The complete gate then passes on the corrected tree: six
consumer scenarios, 468 example files, 4,149 unit tests, 807 browser tests and
260 hydration tests. There are no skips or cancellations. Audit, formatting,
lint, all four ratchets, Rust fmt/Clippy and 15 Rust tests pass. Source length
passes for 1,550 files; the additional Rust all-files audit passes for 9 files.
No new exception or override is added.

Per-file test counts (before → after; new files are summed by original file):

| Original file                                        | Before | After |
| ---------------------------------------------------- | -----: | ----: |
| `packages/viewer/src/viewer/host_bridge.tsx`         |      0 |     0 |
| `packages/viewer/tests/component_workspace.test.tsx` |      3 |     3 |
| `packages/viewer/tests/evidence_harness.tsx`         |      0 |     0 |
| `packages/viewer/tests/server.test.tsx`              |     17 |    17 |
| `packages/viewer/tests/shell_state.test.ts`          |     14 |    14 |
| `tests/browser/browse.spec.ts`                       |     33 |    33 |
| `tests/browser/browse_navigation_security.spec.ts`   |      4 |     4 |
| `tests/browser/changed_views.spec.ts`                |      5 |     5 |
| `tests/browser/component_design.spec.ts`             |     12 |    12 |
| `tests/browser/component_explorer_runtime.spec.ts`   |     11 |    11 |
| `tests/browser/removed_previews.spec.ts`             |     11 |    11 |
| `tests/browser/standalone_appearance.spec.ts`        |     18 |    18 |
| `tests/browser/viewer_lifecycle.spec.ts`             |      8 |     8 |
| `tests/browser/viewer_variants.spec.ts`              |      9 |     9 |
| `tests/client_navigation_state.test.ts`              |     13 |    13 |
| `tests/client_removed_preview_requests.test.ts`      |      7 |     7 |
| `tests/design_component_variant_navigation.test.ts`  |     11 |    11 |
| `tests/design_screens.test.tsx`                      |     11 |    11 |
| `tests/design_variants.test.ts`                      |     16 |    16 |
| `tests/publish_run.test.ts`                          |      9 |     9 |
| `tests/removed_preview_delivery.test.ts`             |      4 |     4 |
| `tests/server.test.ts`                               |      7 |     7 |
| `tests/server_removed_preview_lifecycle.test.ts`     |      5 |     5 |
| `tests/shell.test.ts`                                |     29 |    29 |
| `tests/variant_validation.test.ts`                   |     13 |    13 |
| `tests/watch_glob_boundaries.test.ts`                |     10 |    10 |

The source module and harness have zero direct tests; existing unit, browser
and hydration consumers cover them. All 280 direct tests in the split groups
remain. The detailed file mapping is saved in `.context/m6j-counts-all.json`.

The complete implementation review remains the final item in Milestone 8,
after the completed work has been committed and pushed.

## Milestone 7: Viewer Changes and document presentation

Tags: ui

Status: Complete.

The first part implements what does not depend on move data. The second part
follows the merge of Milestone 5.

- [x] Treat removed document rows like removed page rows when filtering All and
      Changes; keep the document icon and final navigation behavior with the UI work.
      A removed document is now a flat row that only Changes shows, with the
      document icon (`nav_model.ts`; `removed_document_rows.test.ts`,
      `document_changes.spec.ts`).
- [x] Show the existing Light-only fallback note when a current or removed document
      has no dark scheme but the reader selects Dark; match the Milestone 6E
      screen. `scheme_fallback.tsx` decides the fallback. A current document
      gets a band above its pane, and a removed one a suffix on
      `Showing previous version`; the stylesheet shows the note only under
      Dark. A Git fixture with a light-only baseline proves that the retained
      document keeps its light render under Dark
      (`document_light_only.test.tsx`, `document_light_only.spec.ts`).
- [x] Present documents in the page view with the document title, breadcrumbs,
      the path chip, and Details showing the description, tags, and Markdown
      source file; link `relatedDocs` matches to their document entries
      (`details.relatedDocs` now emits validated `mock:<path>` references for
      discovered current documents). Serve and export read the manifest, which
      keeps repository paths, so the row also links a path that names a
      current document's source; a removed entry keeps labels. The served
      Dependencies row now lists a document's resources, as projection does
      (`document_details.test.tsx`, `document_pages.spec.ts`,
      `document_changes.spec.ts`).
- [x] In Changes, keep an unchanged screen or component index whose only
      changed rows are folder members as a container row with no change dot,
      and make activating that row open its first visible changed member, as
      an unchanged variant parent opens its first changed variant
      (`changes_activation.ts`); match the Milestone 6A screens. The
      activation walks the section's own rows in list order
      (`index_container_activation.test.ts`, `document_changes.spec.ts`). The
      rows, dots, selection, crumbs, statuses, and comparison band match. The
      redirect lands on the member's first changed view, as `mokly-changes.md`
      requires, but `member-changes` shows Both; the difference is reported
      for a decision.
- [x] Add browser tests for document pages in Light and Dark at both widths,
      the index-entry container rule, and the removed-document filters; verify
      parity with `design/browse/pages/document`,
      `design/browse/views/folder-overview`, and the four
      `design/browse/index-entries/*` screens. The screenshots are under
      `.context/m7/`. Besides the known `Catalogue home` crumb and Details bar
      (Milestone 6C), the runtime also shows status chips and changed dots in
      All, which the designs show only under Changes; `origin/main` already
      behaves this way.
- [x] Re-apply the drafted `docs/guides/catalogue/export-and-host.md` from
      commit `d65417d` and reconcile it with the implemented export. The
      draft matches the export layout and the URL forms unchanged; a new
      `static_example.spec.ts` test opens an exported document from each URL
      form.
- [x] Run the full gate for the first part, then commit and push. The gate
      passed on the final code: format, lint, file length (only the 28 known
      files), ratchets, Rust fmt, Clippy, tests, and file length, and the
      package, unit (3,853 tests), browser (771), and hydration (238) suites.
      The dependency audit fails only on the known GHSA-vfj7-8cjw-p6xm. The
      first unit run failed one CSS assertion in `tests/shell.test.ts`; the
      document note now has its own rule, and a viewer test guards it.

Second part, after Milestone 5 merges:

- [x] Merge `origin/calummoore/file-paths-vs-navpath` at `52753e26`
      (Milestone 5) into this branch at `99032ff2`; the merge base is
      `1b0eb703`. Milestone 5 adds 38 files and changes 95, and deletes none;
      the merge deletes none. Merge decisions:
  - `docs/protocol/mokly-removed-previews.md`: state that document previews,
    their `Light only` note, and suppression for paired moves are
    implemented.
  - `docs/protocol/mokly-shell-design.md`: keep this branch's implemented
    Specs rows, breadcrumbs, path chip, and Markdown document pages, and
    Milestone 5's single entry for a paired move; the `Moved` label remains.
  - `plans/path-identity.md`: list both sides' complete milestones in the
    header, keep Milestone 5's ticked section unchanged, keep this branch's
    two-part Milestone 7, and move Milestone 5's new removed-variant TODO
    into the second part, because it depends on move data.
- [x] Merge `origin/calummoore/file-paths-vs-navpath` at `f817a1c4`
      (Milestone 4A) into this branch at `74b15a13`; the merge base is
      `52753e26`. Milestone 4A adds 10 files and changes 18, and deletes none;
      the merge deletes none. Merge decisions:
  - `plans/path-identity.md`: list both sides' complete milestones in the
    header.
  - `src/documents/README.md`: take Milestone 4A's hardened rendering
    description and keep this branch's typography sentence.
- [x] Move the remaining TODOs to Milestones 7A and 7B. Serve and export did
      not give the shell catalogue the accepted pairs, and export's script
      reference check read a minified `Moved from` label as an import, so that
      backend work comes first.

## Milestone 7A: Move data in the shell catalogue

Status: Complete.

The shell needs each paired entry's previous path in Serve, export, and the
public viewer, and export must accept a `Moved from` label in its scripts.

- [x] Give `createCatalogue` the accepted move pairs and keep each paired
      current entry's branch-point path in `previousPaths`. Serve's change
      snapshots and updates, and export, pass the pairs; the public viewer
      reads `previousPath` from the read model
      (`packages/viewer/tests/moved_catalogue.test.ts`).
- [x] Accept only module-specifier characters after `from` or `import` when
      export checks `__mokly/` scripts, so text that ends in either word is
      never read as an import (`tests/export_references.test.ts`); record the
      rule in the export browser contract.
- [x] Run the full gate, then commit and push. The gate passed: format,
      lint, file length (only the 28 known files), ratchets, Rust fmt,
      Clippy, tests, and file length, and the package, unit (3,977 tests),
      browser (773), and hydration (238) suites. The dependency audit fails
      only on the known GHSA-vfj7-8cjw-p6xm.

## Milestone 7B: Moved presentation

Tags: ui

Status: Complete.

Present paired entries as the Milestone 2 mockups and the shell contract
define.

- [x] Attach a removed variant to its moved parent through the current parent's
      `previousPath`; the removed record retains its baseline `variantOf`.
      `catalogueMovedPath` maps the baseline path back, so the row joins the
      moved parent, and its crumb and `Variant of` chip link there.
- [x] Label paired entries "Moved" in Changes rows and details, show the
      previous path in details, and drive the baseline side of comparisons
      from `previousPath` (`nav_changed.ts`, `details_rows.tsx`,
      `view_status.ts`, `comparison_request.ts`,
      `packages/viewer/src/catalogue/snapshot_identity.ts`). Milestone 5
      already takes the comparison's before side and per-view evidence from
      the paired baseline entry, and a paired entry has no removed record, so
      those five files need no change. `nav_moves.ts` puts the previous path on
      each row; under Changes a moved row reads `<label> · Moved` without the
      changed mark. Details add `Moved from` after Source, and the comparison
      details name the previous path. The server render now finds a moved
      entry's baseline through that path and counts material changes only,
      so a pure move stays Unmodified before and after hydration, and a moved
      component keeps its baseline and removed variants
      (`moved_rows.test.tsx`, `client_moved_evidence.test.ts`).
- [x] Add browser tests for moved rows and moved comparisons; verify parity
      with the Milestone 2 screens. `moved_changes.spec.ts` covers the rows at
      both widths, Details, a pure move, and the removed variant;
      `moved_comparisons.spec.ts` covers every comparison mode; and
      `moved_export.spec.ts` covers the static export. The fixture pairs
      through `movedFrom` and identical content only. Parity with
      `design/changes/outcomes/moved` holds at both widths for the rows,
      crumbs, path chip, comparison band, frame label, `Moved from` row, and
      the sentence that names the previous path (`.context/m7b/`).
- [x] Re-apply the drafted `docs/guides/catalogue/changes.md` from commit
      `d65417d` and reconcile it with the implemented Changes view. The draft
      matches the implemented behavior; a sentence adds the variant deleted
      during a move. Every delivery status that still called documents, the
      runtime Specs section, or moves planned now states them as implemented.
- [x] Run `cargo xtask check`, then commit and push. The gate
      passed: format, lint, file length (only the 28 known files), ratchets,
      Rust fmt, Clippy, tests, and file length, and the package, unit (3,982
      tests), browser (780), and hydration (238) suites. The dependency audit
      fails only on the known GHSA-vfj7-8cjw-p6xm.

## Milestone 7C: Moved comparison wording mockup

Tags: mockup

Status: Complete.

The runtime's comparison details name a moved entry's previous path in words
that fit every entry. The `design/changes/outcomes/moved` mockup said "the
invoice at" instead, so the mockup takes the runtime wording.

- [x] Change the moved screen's comparison details to "The previous version is
      at `billing/invoice`, where it was before the move." and pin the
      wording at both artboards (`tests/design_moved_evidence.test.ts`). No
      contract text pins the old wording.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and the design tests. The design unit tests (169) and design browser
      tests (92) pass.
- [x] Commit and push (`a34a883e`).

## Milestone 7D: Moved presentation review fixes

Tags: ui

Status: Complete.

An independent review of Milestone 7 (`9d827811`) found gaps on moved
component paths, which the browser tests never moved, and a changed mark that
All shows for a pure move. Each fix starts with a failing test.

Before the fixes, this branch merged `origin/calummoore/file-paths-vs-navpath`
at `943fd190` (Milestones 5A and 6G) into `a34a883e`; the merge base is
`f817a1c4`. The feature branch adds 47 files and changes 98, and deletes none;
the merge deletes none of its files. Merge decisions:

- `plans/path-identity.md`: list both sides' complete milestones in the
  header. The feature branch carried copies of Milestones 6A–6F and a note
  that their implementation was not integrated there; this branch owns that
  implementation, so the merged plan keeps one copy and drops the note.
- `plans/README.md`: combine both sides' status for this plan, and take
  main's move of Imported CSS Delivery to Completed.
- `docs/guides/catalogue/changes.md`: match the pairing paragraph to the
  merged move contract from Milestone 5A.

The merge (`91900381`) has exactly two parents, and its remerge diff changes
only these three paths. It passes the unmodified `cargo xtask check` except
the source file-length audit, which lists the 26 known files. The package,
unit (4122), browser (781), and hydration (238) suites pass.

- [x] A moved component variant with only a metadata edit reads Changed:
      decide pure moves from the material change set, not the visual review
      state. `workspace_variants.ts` drops the visual-state shortcut and reads
      `materialChangedEntries`, so a pure move stays Unmodified. The public
      workspace reads a variant's `changes.kind` when its compared views show
      no change.
- [x] A variant deleted during a component move opens with its parent's
      workspace: resolve the parent through the move map, and match removed
      variants through the parent's `previousPath` in Serve, export, and the
      embedded viewer, from the first paint. `workspaceComponent` resolves
      the parent through `catalogueVariantParent`, and
      `catalogueComponentParent` and `catalogueComponentVariants` reach a
      moved parent through its previous path, so the public workspace and
      the scoped usage list the removed variant too. A held route-evidence
      fetch proves the first paint after a client navigation.
- [x] Moved component variants keep their nested-input details: map each
      current view's `variantPath` and nested `componentId` through the move
      map before pairing views (`workspace_input_changes.ts`). The embedded
      viewer shows no input changes, moved or not, because the read model
      carries no baseline usage, so that case runs in Serve and export.
- [x] In All, a pure move carries no changed mark: mark a moved row only when
      the entry is in the material change set, and keep the Changes
      presentation. `navRowPresentation` reads the context: under All, a
      moved row, and a moved variant's share of its parent's aggregate mark,
      need the entry in `materialChangedEntries`. The public projection sets
      `materialEntries` from each entry's `changes.kind`; server pages read
      `componentChanges.changedEntries`.
- [x] Cover the fixes: a moved component in the browser fixture, with a
      deleted variant, a metadata-only variant edit, and a nested-input
      change; real reasons in the evidence unit test; and the moved specs
      through an embedded viewer host as well as Serve and export.
      `moved_changes_sources.ts` adds a `components` library that becomes
      `ui`: Action loses Secondary, Ghost changes only its description, and
      Iconic's ring holds a glyph whose name changes, while Icon moves
      unchanged. Both parent kinds now keep a removed variant at their new
      place. `client_moved_evidence.test.ts` reads real review reasons
      (`moved_component_evidence.ts`), and `moved_public_workspace.test.ts`
      covers the public path. The row, component, and comparison cases run
      in Serve (`moved_changes.spec.ts`), export (`moved_export.spec.ts`),
      and the embedded viewer (`moved_viewer.spec.ts`), and
      `moved_hydration.spec.ts` hydrates every moved route cleanly in Serve
      and export. Before the fixes, 8 new unit tests and 13 browser cases
      failed, each for its own item; parity with `design/changes/outcomes/moved`
      holds at both widths for the Changes rows and Details (`.context/m7d/`).
- [x] Run the full gate, then commit and push. The unmodified
      `cargo xtask check` stops only at the source file-length audit, which
      lists the same 26 known files. The dependency audit, format, lint,
      ratchets, `cargo fmt`, clippy, `cargo test`, and the Rust file-length
      lint pass, and the package, unit (4129), browser (807), and hydration
      (260) suites pass.

## Milestone 8: Guides, verification, close-out, and review

Finish the current documentation and runnable examples, verify the complete
implementation, and smoke-test Serve and ordinary static hosting. The
orchestrator assigns the final implementation review to a fresh reviewer after
this push; the implementation agent leaves that final TODO unticked.

Status: Implementation and verification complete. The final review remains
assigned to the orchestrator's fresh reviewer after this push. Main remains at
`800fe9f8`; no further merge is needed.

- [x] Finalise the guides and READMEs for the recommended `specs/` layout and
      the co-located alternative, the root `README.md` quick start, and the
      release notes for the breaking change.
  - [x] Read every guide and the root, package, viewer and example READMEs;
        remove stale delivery claims and complete invalid example fragments.
  - [x] Validate documented roots, index documents, links, registrations and
        renderer examples against the real public API in scratch consumers.
  - [x] Clarify the embedded viewer's lack of branch-point input-change data.
  - [x] State every removed field, new wire/storage version and the clean break
        in the release note; keep migration guidance documentation-only.

Documentation validation: all 31 guides and the root, viewer and example
READMEs were checked against the final API. All 41 TypeScript fences compile
with strict checking; the folder JSON example parses. Seven documented configs
build and check in a scratch Git consumer. It includes index screens, a README,
a document, a page, reciprocal flow membership, registered components, variants,
relative and definition-reference links, fragments, and review-ignore controls.
Both folder-record forms and both complete renderers pass. Imported CSS,
CSS Modules with an asset, Tailwind, autoprefixer, and the transparent co-located
root also build and check. The 34 focused guide/protocol tests pass. Scratch
scripts and logs are under `.context/m8/`; no fixture output is tracked.
The viewer contract states the embedded input-change limitation and removes
redundant delivery-status prose; its reviewed size cap falls from 456 to 454.
The release note covers `43404882`, all removed fields and wire/storage versions,
and the manual migration. Earlier release notes remain clearly historical.

- [x] Run the full verification: `npm run build`, unit and browser tests,
      `npm run example:build`, `npm run example:check`, the package check, and
      `cargo xtask check`.
- [x] Smoke-test the published shape: serve the example, browse folders
      without content changes, open an Overview row, open a document, follow
      relative and typed links, move a directory and confirm "Moved", and
      export and open the static output.
- [x] Update this plan's status and `plans/README.md`; the plan stays Active
      until its pull request merges.

Verification on the close-out tree:

- `npm run build`, `npm run example:build`, `npm run example:check` and
  `npm run package:check` pass; the example contains 468 generated files.
- The unmodified `cargo xtask check` passes every suite. Package checks pass
  all six packed-consumer scenarios. Unit tests pass 4,149/4,149; browser tests
  pass 807/807; hydration tests pass 260/260. No skips, cancellations or reruns
  are needed. All three known browser flakes pass on the first run.
- Dependency audit, formatting, lint, four repository ratchets, Rust fmt,
  Clippy and all 15 Rust tests pass. Source length passes for 1,551 files with
  no violations. The additional all-files Rust length audit passes for 9 files.
  The existing reviewed Braces exception remains the sole audit exception;
  this milestone adds no package, override or exception.

Fresh published-shape smoke results:

- Serve the real example with `--base HEAD --no-watch`. Collapse and reopen
  Example; the URL, heading and mounted frame remain unchanged. The Overview
  row opens the real README. Its relative document link opens Workspace guide
  at `your-first-visit`. The document renders in Dark, and its relative logical
  link opens Welcome. No browser page error occurs.
- Copy the real example into `.context/m8/example-move`, register a definition
  reference for the Welcome-to-Details link, and commit only the scratch
  baseline. Move `specs/example` to `specs/relocated` and update its authored
  references. All seven moved entries (README, document, page, screens, variant
  and flow) pair as Unmodified, carry their old paths and produce no removals.
  Changes shows Moved, Details shows Moved from, and the definition-reference
  link opens the new Details path and fragment.
- Edit Welcome's heading without committing the move. It becomes Changed;
  Side by side loads Before from `example/screens/welcome` and Current from
  `relocated/screens/welcome`. The frame bodies show the old and new headings.
  The scratch repository still has exactly one baseline commit.
- Export that scratch catalogue and open it with `python3 -m http.server`.
  Overview, Workspace guide and Welcome each open from `/view/<path>/`,
  `/view/<path>` and `/view/<path>/index.html`, normalizing to the canonical
  URL. Frames load, and the exported document renders in Dark.

Commands, assertions, logs and inspected screenshots are in `.context/m8/`:
`verification.log`, `smoke-serve.log`, `smoke-moves.log`, `smoke-export.log`,
`document-dark.png`, `moved-comparison.png` and `static-document.png`.
The scratch move and generated artifacts are not part of the branch.

The main-relative name-status and deletion checks match the 18 authorized
replacements listed under Milestones 6G and 6I. The close-out commit repeats
each path and its replacement in its body. It adds no file deletion. Every
required item is complete before PR merge except the final fresh review below.
The six post-merge items remain optional and do not block plan completion.

- [x] Commit and push.
- [x] After the push, the orchestrator assigns a fresh reviewer to use
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main` and report findings without changing the implementation.
      The implementation agent must not run this review. Two fresh reviewers
      reviewed `74e7596b` against `origin/main` at `800fe9f8`: Codex for the
      backend and documentation, and Claude for the viewer UI and mockups.
      The orchestrator confirmed every finding. The
      [review record](../docs/reviews/path-identity.md) lists eight findings
      (one High, two Medium, five Low) for the user's decision. No finding
      was fixed during the review.

## Milestone 9: Review fix contracts

Define the contract for every approved review fix before any code changes, and
remove documentation drift (findings 7 and 8).

Status: Complete. All 38 protocol, guide and Markdown-link tests pass, including
the size caps. Prettier and whitespace validation pass. No runtime code changes. The design inventory and the
document band's design reference belong to Milestone 10.

- [x] Finding 1 (option A): state in the catalogue read model contract and in
      `mokly-moves.md` that a removed component parent may have no remaining
      removed variants when every variant paired with an entry of another
      parent, while a current component parent still needs at least one
      variant. Align the reader rules in the same documents.
- [x] Finding 2 (option A): state in the export contracts and the source
      protection contract that export trusts the accepted compilation's exact
      generated-file inventory, including parent directories, so an entry path
      with a segment such as `coverage`, `dist`, `node_modules`, or `README`
      exports, while the private-directory and public-name filters still apply
      to every other file.
- [x] Finding 3 (option A): state in the ownership and source protection
      contracts, decision 14, and the release notes that only the current
      ownership header proves ownership. The plain `Generated by mokly from …`
      and `Generated by mokabook from …` headers, and the preview adapter's
      adoption of earlier `view/` paths, are removed. Add migration guidance:
      delete output that an earlier version generated.
- [x] Finding 4 (option A): state in `mokly-shell-design.md` that a folder
      row's count is the number of child rows that the active filter shows
      (All, Changes, or search), using the same visibility rule as the rows.
- [x] Finding 5 (option A): state in the shell contract that the home summary
      counts every entry kind present, documents included, and omits a kind
      whose count is zero.
- [x] Finding 7 (option B): make `mokly-folders.md#titles` the single owner of
      the search matching rule, and replace the restated rules in
      `mokly-shell-design.md`, `mokly-runtime.md`, and
      `packages/viewer/src/shell/README.md` with links to it.
- [x] Finding 8 (option B): replace delivery-status prose that calls delivered
      features pending (for example in `mokly-rendering.md`,
      `docs/architecture/build-pipeline.md`, and
      `docs/architecture/package-boundary.md`) with current behaviour and links
      to the owning contracts. Search all of `docs/` and the READMEs. Progress
      stays only in this plan.
- [x] Validate the Markdown with Prettier, run the protocol, guide, and link
      tests, then commit and push.

The search owner also replaces copies in the document, page, variant,
navigation and embedded-viewer contracts. The guides link to the published
navigation reference, which delegates to the folder contract; no unpublished
Reference route is introduced. The guide-link test now validates each real link
against the existing allowed destinations instead of requiring an empty corpus.
The status scan covers every Markdown file under `docs/` and every README;
remaining matches are runtime pending states, historical review quotations or
undelivered work, not current delivery claims. The design inventory, design
sources and current-document band sentence are unchanged.

## Milestone 10: Light-only current document mockup

Tags: mockup

Status: Complete.

Depict the band that names the light fallback above a current document's pane
(finding 6, option A), before the UI milestone tests it.

- [x] Add a design state for a current document shown under Dark without a
      dark render, with the quiet `Light only` band above its pane, in mobile
      and desktop variants. Keep it reachable from the appearance designs and
      within five screens per page.
      `design/browse/appearance/states/light-only-current` is the fourth of
      the five allowed screens on the Appearance states page. Its Dark
      artboards show the band and keep the Light palette and document
      typography in the pane; its Light artboards show the document alone, as
      the runtime stylesheet does. The appearance designs' `Payment terms`
      row opens it from the navigation and the drawer, so a Dark artboard
      stays Dark (`tests/design_light_only_document.test.ts`). The example's
      document stylesheet rule now covers both light-only document states,
      and `tests/design_document_styles.test.ts` fails any design that
      renders a document without that stylesheet.
- [x] Record the state in `mokly-shell-design-inventory.md`, and make
      `mokly-documents.md` name it as the design for the current-document band.
      The appearance folder table in `mokly-viewer-appearance.md`, the
      transitions in `mokly-shell-design-catalogue.md`, and the design-screen
      counts in the example README, `mokly-design-links.md`, and two design
      tests include it.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and the design tests; smoke-test the state through `npm run dev`; then
      commit and push. The example builds and checks 472 files. The design unit
      tests (190), the design browser tests (115), and the protocol, guide, and
      link tests (36) pass. Through `npm run dev`, the Dark artboards show the
      band and the Light ones do not, and the Dark overview's `Payment terms`
      row opens the Dark state (`.context/m10/`).

## Milestone 11: Catalogue, export, and ownership review fixes

Fix the backend findings (1, 2, and 3), each with a failing test first.

Status: Complete. The unmodified `cargo xtask check` passes every suite:
4,161 unit tests, 807 browser tests and 260 hydration tests. No skips,
cancellations or retries. The contracts were pushed first in `c2222348`.

- [x] Finding 1 (option A): accept a removed component parent with no
      remaining variants wherever records are validated. Keep the rule for
      current parents. Add a regression test that moves a component's last
      variant into another component and deletes the old component, and run
      it through the review result, the catalogue reader, Serve (every page
      returns HTTP 200), and export.
- [x] Run every existing move fixture through the catalogue reader, Serve,
      and export as well as the review result, so a disagreement between these
      boundaries fails a test.
- [x] Finding 2 (option A): make export capture generated files from the
      accepted compilation's exact inventory, including parent directories,
      and keep the filters for every other file. Add tests that carry entries
      named `coverage`, `dist`, `node_modules`, and `README` through Build,
      Check, Serve, and export in committed and derived output modes, and a
      test that a real build directory that is not generated output stays
      private.
- [x] Finding 3 (option A): remove the legacy plain and Mokabook header
      readers and the preview adapter's adoption of earlier `view/` paths. Add
      rejection tests with real earlier-format samples for every ownership
      consumer: replacement, orphan deletion, Check, export ownership, and
      preview adoption.
- [x] Correct the discovered screen-guide claim about an ordinary entry beside
      a same-named directory: only an index entry can have ordinary descendants.
- [x] Keep private generated metadata outside the export allowance, even when
      named in a supplied output set. A new failing policy test covers this
      boundary; historical CSS/assets use the exact captured side closure.
- [x] Run the unmodified `cargo xtask check`, then commit and push.

The new removed-parent regression first reproduced the reader error, Serve HTTP
500 and export failure. Both readers now accept an empty removed parent and
still reject an empty current parent. The regression exercises all current and
removed shell routes. Shared move-fixture validation records real Git baselines
and runs accepted fixtures through review, complete/scoped readers, every Serve
page and export; it also exposed the private-name rejection for `new/target`.
The source-only signal tests remain pure and do not fabricate HTML fixtures.

Export now passes the accepted output map through capture and rechecks in both
modes. Exact parent traversal never admits siblings. Historical snapshots use
their side's manifest routes and captured CSS/asset closure. Source, metadata,
configuration exclusions and alias boundaries remain mandatory. The new matrix
covers `coverage`, `dist`, `node_modules` and `README`, real private siblings,
current views, both comparison sides, removed screen/page previews and assets,
through Build, Check, Serve and export in committed and derived modes. A further
red/green policy test prevents even an explicit set from admitting private
generated metadata or bypassing source/exclusion rules.

Real plain Mokly, plain Mokabook and encoded Mokabook samples first demonstrated
the old ownership grants. They now prove no authority at parsing, replacement,
orphan cleanup, committed/derived Check, frame adaptation, watch classification,
material-header normalization and export ownership. Earlier preview markers,
with either pre-derived or current-shaped `view/` paths, fail without changing
output. The internal legacy ownership adapter and transaction parameters are
removed; current marker validation, reservations and rollback remain exercised.
The index-guide correction follows the existing path collision rule; the
index-screen/member example compiles in `.context/m11/guide-layout.log`.

Focused verification passes 288 tests, followed by 24 tests after the final
inventory guards. Type checking passes. All logs and red/green evidence are
under `.context/m11/`. The M11 changes add no dependency or audit exception.

The complete gate passes dependency audit (with only main's reviewed Braces
record), formatting, lint, all four repository ratchets, Rust fmt/Clippy and
15 Rust tests. Both packed packages pass all six consumer scenarios, and the
example builds and checks all 468 files. Source length passes for 1,579 files;
the all-files Rust audit passes for 9 files. All three known browser flakes pass
on the first run. Final fixture corrections also pass a 12-test ownership run;
seven move tests verify exact pair agreement across review and catalogue data.
The main-relative deletion list remains the same 18 authorized replacements,
recorded again in the commit body; this milestone deletes no file. No shell
presentation module changed. The orchestrator owns the fresh review after the
Milestone 13 integration; this implementation agent does not run it.

## Milestone 12: Navigation counts, home summary, and light-only band

Tags: ui

Status: Complete.

Fix the UI findings (4, 5, and 6), each with a failing test first.

- [x] Finding 4 (option A): compute each folder row's count from the same
      visibility rule as its rows, under All, Changes, and search. Add unit
      and browser tests for each filter, and check parity with the Changes and
      search mockups. `nav_rows.tsx` counts the immediate children that
      `navNodeVisible` keeps under the live selection, which an unstored render
      reads as All (`UNFILTERED_SELECTION`). `nav_folder_counts.test.ts` and
      `nav_folder_counts.spec.ts` cover All, Changes, free text, and a tag;
      before the fix both failed, with Shop counting 4 above one row. Counts
      match the shown rows in `design/changes/outcomes/moved` and
      `design/browse/views/screen/tag-forms` at both widths (`.context/m12/`).
- [x] Finding 5 (option A): build the home summary from a type-checked map of
      every entry kind, documents included, and omit kinds with a zero count,
      so a new kind cannot be left out. `home_summary.ts` checks its labels
      with `satisfies Record<ManifestEntry["kind"], …>`, so a new kind fails
      to compile until it has one (`home_summary.test.ts`, which failed
      before the fix on the missing document and on zero counts).
- [x] Finding 6 (option A): add a browser test that shows the current-document
      `Light only` band under Dark, and check parity with the Milestone 10
      state. `light_only_document_band.spec.ts` builds a catalogue whose
      config dropped Dark while a removed screen keeps a dark render, and
      checks the band's text, place above the pane, and style in Serve and
      export at both widths. Hiding the band under Dark fails all four cases.
      Parity with `design/browse/appearance/states/light-only-current` holds
      at both widths. `branch_hosts.ts` now builds and hosts these Git-backed
      catalogues, including the moved fixture.
- [x] Run the unmodified `cargo xtask check`, then commit and push. It passes
      completely: the repository suite with both file-length audits, and the
      package, unit (4158), browser (814), and hydration (261) suites.

## Milestone 13: Review fix integration, verification, and review

Bring the UI fixes into the feature branch, verify everything, and assign a
fresh review. The implementation agent does not run that review.

Status: Implementation complete. Merge, full verification and fresh smoke
checks pass. The final independent review remains assigned to the orchestrator.

- [x] Merge the UI branch under the merge rules in `AGENTS.md`.
      Merge `594e78db` joins exactly two parents: `8a347d80` and `7aa89d9a`.
      There are no conflicts. Both milestone lists and every completed TODO
      remain. The remerge diff is empty, so there are no resolution paths to
      inspect. Milestone 11 production files remain unchanged from the feature
      parent. Main remains `800fe9f8`, with no unintegrated additions. The
      deletion audit retains the same 18 authorized path replacements.
      `npm run build` and 46 focused viewer, design, protocol, guide and link
      tests pass before the full gate.
- [x] Run the full verification, including the unmodified `cargo xtask check`.
- [x] Smoke-test each fix: moving a component's last variant into another
      component, exporting an entry named `coverage`, rejecting an earlier
      ownership header, folder counts under Changes and search, the home
      summary with documents, and the current-document `Light only` band.
- [x] Record the outcome of each finding in
      `docs/reviews/path-identity.md`, and update this plan's status and
      `plans/README.md`.

Verification and smoke evidence:

- The unmodified `cargo xtask check` passes completely: six packed-consumer
  scenarios; 472 example files; 4,170 unit tests; 814 browser tests; and 261
  hydration tests. There are no skips, cancellations or retries. All three
  known browser flakes pass first run. Audit, formatting, lint, four ratchets,
  Rust fmt/Clippy and 15 Rust tests pass. Source length passes for 1,586 files,
  and the Rust audit passes for 9 files. No exception or dependency is added;
  main's existing reviewed Braces record remains active.
- In a fresh scratch Git catalogue, move `old/primary` to `new/primary` with
  `movedFrom` and delete `old`. The actual CLI `serve --base main --no-watch`
  publishes the pair and removed parent; every current and removed route plus
  home returns HTTP 200 (14 pages). `export --base main` succeeds, retains
  `old` as a removed component and writes its shell, while the moved variant
  carries `previousPath: "old/primary"` and has no removed record.
- That same CLI export includes `coverage`, with both its shell and generated
  view. The legacy-header check uses a separate scratch catalogue. Build
  refuses `coverage/index.mobile.html` and reports
  `has no valid generated ownership header`. Its exact bytes remain. After the author moves it aside,
  a successful build leaves that earlier-format orphan unchanged.
- At 1280px and 390px, every visible folder count matches its immediate retained
  rows. Shop reads 5 in All and 2 in Changes (Overview and Cart). Searches for
  `checkout`, `orders` and `tag:sale` each retain one Shop child; the nested
  Archive count is also 1 for `orders`.
- At both widths, home reads `6 screens · 3 components · 2 documents`, omitting
  zero-count kinds. Payment terms has no dark render. Under Dark its
  `Light only` band appears above the pane, which keeps the light document URL. The
  band is hidden under Light. Both browser runs report no page errors.
- `.context/m13/smoke-results.json`, `smoke.log`, `serve.log`, `export.log` and
  `ownership.log` contain the assertions and CLI transcript. Inspected
  screenshots are `counts-changes-1280.png`, `counts-search-1280.png`,
  `light-only-1280.png` and their 390px counterparts. The full gate log is
  `full-gate.log`. Scratch sources and artifacts stay outside the feature diff.

The Approved Follow-up section of `docs/reviews/path-identity.md` now records
all eight findings as fixed, with their implementation commits and covering
tests. The plan stays Active until PR merge. No production edits follow the
merge; the close-out commit updates only the plan, its index and the review
record. The main-relative deletion inventory retains the same 18 authorized
replacements. Both commit bodies explicitly record the approved removal of
earlier ownership readers and preview-adoption plumbing. The final review
below remains unticked and is not run by this implementation agent.

- [x] Commit and push.
- [x] After the push, the orchestrator assigns fresh reviewers to use
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main` and report findings without changing the implementation.
      Fresh Codex and Claude reviewers reviewed `013b8add` against
      `origin/main` at `800fe9f8`. The first-round fixes hold. The
      [second review](../docs/reviews/path-identity.md#second-review) lists
      fifteen new findings (one High, four Medium, ten Low) for the user's
      decision. No finding was fixed during the review.

## Milestone 14: Branch-point lookup contracts

Define one owner for the rule that maps a branch-point path to the entry it
names now, before any code changes. On 2026-10-04 the user approved one shared
lookup for second-review findings 1 (option A), 6 (option B), 8 (option A),
9 (option B), and 11 (option A), with one shared fixture set. The lookup
handles moves, case-only renames, a path that another kind reuses, and the
former parent's title. Each fixed surface keeps its current design; only the
entry that a link, row, key, or crumb resolves to changes. The
[variant navigation contract](../docs/protocol/mokly-variant-navigation.md)
already defines the flat fallback row and the plain-text former-parent crumb.
This work therefore needs no mockup milestone.

Status: Complete.

- [x] Add one protocol page, `docs/protocol/mokly-branch-point-lookup.md`,
      that owns these rules:
  - [x] A branch-point reference is a path from the baseline side: a baseline
        entry, a removed record's `variantOf`, or `before`-side review
        evidence. It resolves in this order: the current entry that an
        accepted move pair joins to that path; else the current entry of the
        same kind whose path is equal under case folding; else the removed
        record of the same kind whose path is equal under case folding; else
        nothing. A current-side reference, such as `after`-side evidence,
        names its current entry directly. It never resolves through a move
        pair.
  - [x] The counterpart of a current entry is the baseline entry that its
        move pair names; else the baseline entry of the same kind whose path
        is equal under case folding; else nothing, because the entry is new.
  - [x] A variant's parent is the resolution of its `variantOf`, limited to
        non-variant entries of the variant's kind. When no such entry exists,
        the variant has no parent. The shell then shows the record's stored
        former-parent title as plain text, as the variant navigation contract
        requires.
  - [x] "Same kind" compares the manifest `kind`. An entry of another kind at
        the same path never matches.
  - [x] A `before`-side usage evidence that resolves to nothing has no
        destination, so the shell omits its row. This happens only when an
        entry of another kind took the path. The catalogue treats that as a
        kind change, not a removal.
  - [x] Name every consumer: affected-consumer links, the variant bar, the
        Before and Current props, supplied-input pairing, removed-variant rows
        in the tree, the workspace key, the Changes activation order (built
        from the navigation tree), and breadcrumbs.
  - [x] Verification: list the shared fixture cases from Milestone 15 and the
        three hosts (Serve, export, and the embedded viewer). Require
        assertions on the rendered UI, not only on HTTP status.
- [x] Add the former parent's title to the removed record. Every removed
      variant record carries `parentTitle`, the baseline title of its
      `variantOf` parent. A non-variant record has none. Update the read model
      contract in `mokly-catalogue.md`, the change snapshot in
      `mokly-catalogue-changes.md`, the reader validation (reject a removed
      variant without `parentTitle`, and a non-variant record with it), and
      the shape of `docs/protocol/fixtures/catalogue-v4.json`. The fixture and
      reader implementation ship together in Milestone 15 so the fixture stays
      readable at each commit. The read model stays v4,
      because v4 is unreleased and decision 14 forbids compatibility layers.
- [x] Make the removal rule consistent. `mokly-catalogue.md` says that a
      baseline entry is removed only when no current entry "of its kind" has
      its path. `mokly-catalogue-changes.md` and `src/registry/changes.ts`
      use any kind, which the reader's shared-path rejection requires. Keep
      the any-kind rule in one owner, and link to it from the other document.
- [x] Replace restated mapping rules with links to the new page: the Result
      section of `mokly-moves.md`, `mokly-variant-navigation.md`, the Changes
      activation rule in `mokly-navigation.md`, the breadcrumb rule in
      `mokly-folders.md`, the component workspace and usage contracts, and the
      shell README. Add the page to `docs/protocol/README.md`.
- [x] Validate the changed Markdown with Prettier and with the protocol,
      guide, and Markdown-link tests. Then commit and push.

Verification: Prettier passed. The protocol, guide and Markdown-link run
passed all 38 tests. The source file-length audit passed; the new owner is
137 lines, and Moves remains 245 lines. No file was deleted in this milestone.

## Milestone 15: Former parent title, shared lookup, and fixture set

Store the former parent's title, add the pure lookup, and build the shared
fixture set. The shell consumers move to the lookup in Milestone 16.

Status: Complete.

- [x] Write failing tests first. The change snapshot and the read model must
      carry `parentTitle` on every removed variant, also when another kind
      reuses the parent's path. Both readers must reject a removed variant
      without `parentTitle`, and a non-variant record with it.
- [x] Carry `parentTitle` through `src/registry/changes.ts`, the catalogue
      projection, the complete and scoped readers, the viewer
      `RemovedEntrySnapshot` type, and the v4 fixture.
- [x] Update hand-built removed-variant fixtures for the required title, and
      update the canonical v4 byte/hash pin without changing its assertions.
- [x] Add the pure lookup to the viewer catalogue data layer, next to
      `createCatalogue`. Give it these operations:
  - [x] resolve a branch-point reference (path and kind) to a current entry,
        a removed record, or nothing;
  - [x] give the counterpart identity of a current entry, for matching
        baseline variants, views, and instances;
  - [x] resolve a variant's parent to a current parent, a removed parent, or
        the stored former-parent title;
  - [x] give the previous path of a paired current entry, for `Moved` rows.
- [x] Unit-test each rule: a move pair, a case-only rename, a path that
      another kind reuses, a removed record, an unresolved path, a
      current-side reference, and a variant parent with and without a
      same-kind parent. Do not change shell consumers in this milestone.
- [x] Build the shared fixture set as real Git baselines in `tests/helpers/`.
      Reuse `commitMoveBaseline` and the move catalogue sources, so that node
      tests and the browser hosts in `tests/browser/branch_hosts.ts` can both
      use it. Each case is one catalogue:
  - [x] Case 1 (finding 1): a screen that renders a component moves with
        `movedFrom`, and the component changes. A component consumer of the
        same component also moves.
  - [x] Case 2 (findings 6, 8, and 9): a component parent moves with
        `movedFrom`. One of its variants is removed, and one changes props.
  - [x] Case 3 (finding 6): a variant moves to another parent with
        `movedFrom` and changes props.
  - [x] Case 4 (findings 6, 8, and 9): case-only renames of a screen, of a
        component parent with a removed variant, and of a variant. Keep
        stylesheet edits out of this case while second-review finding 2
        awaits a decision.
  - [x] Case 5 (finding 11): a document takes a removed component's path,
        and the component's variants are removed.
  - [x] Keep every case clear of the other open second-review findings (2, 3,
        4, 5, 7, and 10).
- [x] For each case, assert the data: the review pairs, the `previousPath`
      fields, the removed records with `parentTitle`, and agreement between
      both readers. Do not assert Serve, export, or embedded-viewer behaviour
      in this milestone; Milestone 16 adds it after the shell uses the
      lookup.
- [x] Run the unmodified `cargo xtask check`. Then commit and push.

The strict reader exposed older hand-built fixtures without parent titles.
Those fixtures now supply their real baseline titles; all 52 targeted tests
pass. The canonical v4 pin now checks 12,418 bytes and the new exact digest.
No assertion was removed or weakened.

Test-first evidence: `.context/m15-parent-title-red.log` records all six
parent-title tests failing because snapshots and readers dropped the field.
The lookup and fixture suites first failed on their missing modules in
`.context/m15-lookup-red.log` and `.context/m15-fixtures-red.log`. The title
suite now passes for both variant kinds and both readers.

The lookup lives beside `createCatalogue` in `catalogue_branch_point.ts`.
It accepts the current catalogue and an optional baseline identity inventory.
`resolve` takes an explicit before/after side; `counterpart`, `parent`, and
`previousPath` supply the other shared operations. No shell consumer was
migrated. The shell snapshot type and public viewer projection carry the new
field. The public v4 fixture now includes a removed screen variant.

`branchPointFixture` returns the `config` and `fixture` shape accepted by
`startBranchHost`, plus real before/after compilations and a Git reader. It
commits main and origin/main with `commitMoveBaseline` and uses the shared
move component source. The five node cases assert review pairs, prior paths,
removed titles and both reader forms. Case 1 retains the exact old receipt
path in before evidence. Case 4 changes no stylesheet.

Verification: the unmodified `cargo xtask check` passed with 4,194 unit,
814 browser and 261 hydration tests. All six packed-consumer scenarios, the
472-file example build/check, type checks, formatting, lint, repository
ratchets, 15 Rust tests, Clippy, Rust formatting and both file-length audits
passed. The source audit covered 1,595 files and the Rust audit covered 9.
The dependency audit passed with only main's reviewed Braces exception.

Focused runs passed 24 new tests, 175 catalogue/move tests and 52 updated
fixture tests. An initial gate attempt found an import-group spacing error;
that was corrected. Another found the old fixtures without parent titles.
After those fixes, one full run passed every check except the Serve
`billing/invoice/paid` case in `moved_hydration.spec.ts`: Chromium reported
blocked script execution in `about:srcdoc`. That unchanged test passed in
isolation. The subsequent complete, unmodified gate passed with no skips or
retries. No console filter or test assertion was weakened. Logs are retained
in `.context/m15-gate-final.log` and `.context/m15-hydration-isolated.log`.

No file was deleted in this milestone. All 18 deletions against main match
the previously approved replacements recorded in the integration milestones.
No shell consumer or unapproved second-review finding was changed.

## Milestone 16: Shell branch-point consumers

Tags: ui

Move every shell consumer to the shared lookup, with a failing test first for
each finding. Then assert the rendered UI of the shared fixture set in every
host.

Status: Complete. Milestone 17 passed the full gate on the integrated head.

- [x] Finding 1 (option A): build affected-consumer links from the lookup. A
      `before`-side evidence links to the current entry that its path resolves
      to, or to the removed record. Omit a row that resolves to nothing.
      `affectedUsageLinks` resolves each evidence on its own side. Covered by
      `tests/branch_point_workspace.test.ts` (moved consumers, both shells),
      `tests/branch_point_inputs.test.ts` (reused path, case fold, after side)
      and the `moved-consumers` browser checks.
- [x] Finding 6 (option B): build the variant bar, the Before and Current
      props, the supplied-input pairing, and the removed-variant rows in the
      tree from the lookup. A variant that moved between parents, and a
      case-only rename, must keep their details. A removed sibling must attach
      to its parent. The bar pairs each current variant with its own
      `baselineEntry` and lists `removedVariants`; inputs pair through
      `counterpart` with the baseline inventory; `catalogueNavSections` attaches
      rows through `parentOf`; the public workspace maps the same results to
      its records in `public_variants.ts`. Covered by
      `tests/branch_point_workspace.test.ts`,
      `tests/branch_point_inputs.test.ts` (moved and case-renamed supplied
      inputs), `tests/branch_point_navigation.test.ts` and the
      `moved-parent`, `moved-variant` and `case-renames` browser checks.
- [x] Finding 8 (option A): key the component workspace by the resolved
      parent. Opening a removed variant of a moved or case-renamed parent must
      keep the comparison mode. `views.tsx` keys the workspace with
      `workspaceKey`. Covered by `tests/branch_point_workspace_key.test.ts` and
      the browser checks, which open the removed sibling from the bar in Side
      by side. Serve resets the mode on the first navigation after any new
      comparison, siblings included, because each on-demand document
      republishes evidence; the Serve suite renders those comparisons first.
      That reset predates this milestone and is reported for a decision.
- [x] Finding 9 (option B): build the Changes activation order from the built
      navigation tree. A container row must reach a moved member's removed
      variant. `changes_activation.ts` walks `catalogueNavSections` rows with
      `navLeafVisible`. Covered by `tests/branch_point_navigation.test.ts` and
      the browser checks, which search for the removed sibling and activate
      the container row.
- [x] Finding 11 (option A): build the parent crumb from the lookup. When the
      variant has no same-kind parent, show the record's `parentTitle` as
      plain text. `targetHead` builds the crumb from `parentOf`; `VariantOfChip`
      shows only an eligible parent. Covered by
      `tests/branch_point_navigation.test.ts`,
      `tests/nav_tree_removed_variants.test.ts` and every browser case's crumb
      checks.
- [x] Remove the superseded mappings: `catalogueMovedPath`, the parent
      fallback chain in `catalogueVariantParentEntry`, and the direct
      `previousPaths`, `variantOf`, and case-folded path comparisons in shell
      modules. Add a guard test that fails when a shell module outside the
      lookup reads `previousPaths` or compares a `variantOf` with a path. The
      guard stops new code from repeating these five findings. This milestone
      may refine the lookup's interface; its rules stay as Milestone 14
      defines them. `catalogueVariantParent`, `catalogueVariantParentEntry`,
      `catalogueMovedPath` and `catalogueComponentParent` are removed;
      `branchPoints` is the one memoized construction point, `counterpart`
      takes the baseline inventory per call, and `baselineEntry`, `parentOf`
      and `removedVariants` were added. `tests/branch_point_guard.test.ts`
      parses every shell and viewer module and fails on `previousPaths`, a
      followed or compared `variantOf`, or a case-folded path.
- [x] Run the shared fixture set through Serve, export, and the embedded
      viewer with `tests/browser/branch_hosts.ts`, at desktop and mobile
      widths. Assert the rendered UI, not only HTTP status. The cases run from
      `tests/browser/branch_point_{serve,export,viewer}.spec.ts` through
      `branch_point_suite.ts`, and every check fails on a server error:
  - [x] each usage link's target and destination title, and export success
        for case 1; the embedded viewer has no affected-consumer evidence, so
        it asserts that no affected section appears;
  - [x] the Before and Current props of moved and case-renamed variants;
  - [x] the removed-variant rows under their parents;
  - [x] the comparison mode after a removed variant opens;
  - [x] the Changes activation order;
  - [x] each crumb's text, and its link when it has one.
- [x] Update the shell README and the viewer README.
- [x] Run the unmodified `cargo xtask check`. Then commit and push. The
      branch is committed and pushed, but the unmodified gate did not pass on
      the Milestone 16 machine, which ran about twice as slowly as on
      2026-10-04 morning. Every stage passed except three checks that also
      fail on the unchanged base build there: the 2,500 ms budget in
      `postcss_dependency_review.test.ts` (2,861 and 3,341 ms in the gate,
      2,261–2,739 ms alone; its code is untouched), the 300 s
      `ordinaryPreview` fixture setup in `preview_design_links.spec.ts` and
      `preview_navigation.spec.ts`, and the `moved_hydration.spec.ts` export
      case for `billing/invoice/paid` (base fails two of four runs). Run the
      unmodified gate on a healthy machine before integration. This gate is
      now complete: Milestone 17 ran it with HEAD at `3aff9c03`, containing
      `3aff9c03` unchanged, plus only its documented projection correction
      and progress records. The second complete run passed all checks:
      4,214 unit, 844 browser and 261 hydration tests. Its first run hit only
      the known export `billing/invoice/paid` sandbox-console failure.
      Logs: `.context/m17-gate-1.log` and `.context/m17-gate-2.log`.

## Milestone 17: Branch-point verification and review

Verify the combined work, smoke-test each case, and assign a fresh review. The
implementation agent does not run that review.

Status: Integration, verification and smoke complete. The final review remains
assigned to fresh reviewers after the push.

- [x] Bring Milestone 16 into the feature branch. Fast-forward when the
      feature branch has not moved; otherwise merge under the merge rules in
      `AGENTS.md`. If `origin/main` has new additions, merge them under the
      same rules.
- [x] Correct the projection sentence that Milestone 14 changed in
      `mokly-catalogue.md`. It says that projection rejects dangling component
      references. The code does not reject them: when a removed entry's
      usage names a component that the model does not publish, projection
      omits that usage, so the view's usage is unavailable. State that rule,
      and add a projection test if none covers it.
- [x] Run the full verification, including the unmodified `cargo xtask check`.
- [x] Smoke-test each fixture case with the CLI, `serve --base main` and
      `export --base main`. In a browser at 1280px and 390px, follow every
      usage link, open each removed variant, and check the crumbs, the props,
      and the Changes order.
- [x] Record the outcome of findings 1, 6, 8, 9, and 11 in
      `docs/reviews/path-identity.md`. Update this plan's status and
      `plans/README.md`.
- [x] Commit and push.
- [x] After the push, the orchestrator assigns fresh reviewers to use
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main` and report findings without changing the implementation.
      Fresh Codex and Claude reviewers reviewed `aaf6fd75` against
      `origin/main` at `800fe9f8`. The five approved fixes work as specified.
      The [third review](../docs/reviews/path-identity.md#third-review) lists
      six findings (two Medium, four Low), plus four items found during
      Milestone 16, for the user's decision. No finding was fixed during the
      review.

Integration: fast-forwarded from `612c0032` through `5127f9b5` to
`3aff9c03`. There were no conflicts or merge commit. Main remains `800fe9f8`;
`.context/main-additions-17.txt` is empty.

The projection contract now states the implemented unavailable-usage rule.
`tests/catalogue_history_conflicts.test.ts` already asserts it for removed
screens and component variants in both Serve and export. It also proves that
restoring the dangling usage makes the reader reject the model.

Verification ran with HEAD at `3aff9c03` and only the projection contract,
its README and progress records changed. The implementation from `3aff9c03`
is unchanged. The first complete `cargo xtask check` passed 4,214 unit and
844 browser tests, but hydration passed 260 of 261: the export
`billing/invoice/paid` case logged `Blocked script execution in 'about:srcdoc'`.
The second complete, unmodified gate passed all 4,214 unit, 844 browser and
261 hydration tests. No tests, time limits or console filters changed; no test
was skipped and neither run enabled retries. The 30 shared browser cases pass.

Both runs passed the 2,500 ms PostCSS budget (1,516.5 ms, then 1,485.4 ms).
Both passed the 300 s ordinaryPreview setup; its export phase took
238,422.68 ms, then 253,704.68 ms. The six packed-consumer scenarios, build,
type checks, 472-file example build/check, dependency audit, formatting,
lint, repository ratchets, Rust formatting, Clippy, 15 Rust tests and both
file-length audits passed. The source audit covered 1,609 files; the Rust
audit covered 9. Main's reviewed Braces exception is unchanged.

CLI smoke used real `build`, `check`, `serve --base main --no-watch --port 0`
and `export --base main --out site` commands. A plain static server served
the exported files. Each scratch repository committed its baseline on main
before applying the shared head edits. Browser checks ran at 1280px and 390px.

| Fixture           | Serve and export result at both widths                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moved-consumers` | Followed all 8 rendered usage links per host/width, 32 in total. Both used-by and affected links reached Status or Receipt with the expected heading. Badge's affected links use `library/archive/status/default` and `shop/archive/receipt`. Export succeeded.                           |
| `moved-parent`    | Primary shows Before `Continue` and Current `Submit`. Removed Secondary shows `Cancel`, the baseline Library crumb and a link to the moved Action parent. Side by side stays selected in export. Changes plus `secondary` search makes the Library index open `library/action/secondary`. |
| `moved-variant`   | Receiver Primary shows Before `Continue` and Current `Submit`, with Receiver's crumb and variant bar. Donor retains Spare with `Later`.                                                                                                                                                   |
| `case-renames`    | Receipt opens at `shop/receipt`. Action Primary retains Before `Continue` and Current `Submit`. Removed Secondary shows `Cancel` and links its crumb to lowercase `library/action`. Export retains Side by side. Changes reaches `library/Action/secondary`. No stylesheet was edited.    |
| `reused-parent`   | The removed Default shows `Saved action`. Library and former Action crumbs are plain text. The variant has one flat Removed row. The current document opens separately as Action guide.                                                                                                   |

All 20 case/host/width combinations passed, with no browser page errors or
HTTP 500s. Serve mode-reset behavior remains as recorded under finding 8;
export mode retention is asserted without preparing comparisons. Scratch
runner corrections were limited to its loading wait and bundling browser
callbacks without tsx name helpers. No product code changed. Sources,
artifacts, CLI logs, `smoke-results.json` and screenshots remain under
`.context/m17/`, outside the feature diff. Gate logs are
`.context/m17-gate-1.log` and `.context/m17-gate-2.log`.

The review record now lists the outcomes and covering tests for findings
1, 6, 8, 9 and 11. It records the remaining Serve reset and the other three
new items for the user's decision. No unapproved finding was addressed.
The plan stays Active until its pull request merges. The final review TODO
is intentionally unticked; the implementation agent did not run it.

No file was deleted in this milestone. All 18 main-relative deletions are
the previously approved path identity replacements; they are listed with
reasons in the close-out commit body.

## Milestone 18: Sandboxed-frame console reports in browser checks

Fix item 9, found during Milestone 16, which failed the CI run for pull request #131.
The previous-version frames contain no script. Playwright's trace recorder
tries to run a script in each frame, and Chrome reports the block in the
sandboxed `about:srcdoc` frames. The hydration helper accepted that report
only from `/static/` frames. On 2026-10-05 the user approved one shared rule:
the report from a viewer-owned sandboxed frame is expected, and every other
console error stays a failure. The
[review record](../docs/reviews/path-identity.md#approved-third-follow-up)
has the evidence.

Status: Complete. The fresh review found four Low findings for the user's
decision.

- [x] Write a failing test first.
      `tests/browser/removed_preview_script_hydration.spec.ts` deletes a screen
      whose render holds an inline script. In Serve and export, the removed
      screen's previous version keeps the script in its sandboxed `srcdoc`
      frame, the script does not run, and hydration must stay clean. Before
      the fix, both cases failed on the blocked-script report. The real
      `billing/invoice/paid` route failed 13 of 50 runs with tracing on.
- [x] Add `tests/browser/console_notices.ts`, the one rule for Chrome's
      blocked-script report from viewer-owned sandboxed frames: stage views
      under `/static/`, temporary renders under `/__mokly/components/renders/`,
      and `about:srcdoc` previous versions. Cover it with
      `tests/console_notices.test.ts`.
- [x] Use the rule in every browser check that fails on console errors: the
      hydration helper, `react_host_capabilities.spec.ts` (which accepted every
      sandbox report), `react_shell_smoke.spec.ts` (which accepted every error
      from `/static/`), and `moved_rows.ts` (which accepted every message that
      named a sandbox). `removed_previews_viewer.spec.ts` and
      `viewer_hydration.spec.ts` read only CSP or hydration messages, so they
      keep their own filters.
- [x] State the rule in `docs/protocol/ci-verification.md`, and record the
      cause and the approved fix in the review record.
- [x] Verify. The new test passes in both hosts. The `billing/invoice/paid`
      route passes 50 of 50 runs with tracing on. The full
      `moved_hydration.spec.ts` (22 tests) and the 36 chromium tests of the
      specs that use `console_notices.ts` directly or through `moved_rows.ts`
      pass. Four more chromium specs use the changed hydration helper
      (`browse_folder_rows`, `route_scoped_shell_routes`,
      `standalone_appearance` and `standalone_preview_scheme`; 18 tests).
      They passed in the local full gate and in CI run `37301313588`. Type
      checks, ESLint, and Prettier pass. Logs are in `.context/m18/`.
- [x] Run the unmodified `cargo xtask check`. On the orchestrator's machine
      it passed the repository checks, ratchets, Rust checks, package checks,
      all 4,216 unit tests, and every browser test except the 14 that share
      the `ordinaryPreview` fixture. That fixture exceeded its fixed 300 s
      setup limit there, also when run alone (item 8, found during Milestone 16). It uses
      no file that this milestone changes, and the pull request's first CI
      run passed it. The gate stops at that suite, so the full hydration
      suite ran separately and passed all 263 tests. The pull request's CI
      run on the pushed commit is the complete check: run `37301313588` on
      `7664e598` passed every job, including the repository, package, four
      unit shards, four browser shards, hydration, both native platforms, and
      Required CI.
- [x] Commit and push. `7664e598` deletes no file.
- [x] After the push, a fresh reviewer uses
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main`, focused on this milestone, and reports findings without
      changing the implementation. The reviewer confirmed the cause and that
      the rule misses no viewer frame, and found four Low findings, recorded
      in the [review record](../docs/reviews/path-identity.md#milestone-18-review)
      for the user's decision. No finding was fixed during the review.

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
