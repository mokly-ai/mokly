# Markdown And MDX Docs In The Catalogue

## Delivery Status

Approved target tracked by the
[Markdown and MDX docs plan](../../plans/markdown-docs.md); not yet
implemented. Until delivery, current builds emit manifest v7 and read model v3
with no `doc` entries. The versions, paths, and errors below define the
delivered contract; other protocol documents that name docs refer here.

## Purpose And Boundary

A doc is one Markdown (`.md`) or MDX (`.mdx`) file that describes the product
or its specification in prose. Mokly discovers docs from a configured glob,
never from TypeScript definitions, and shows each as a routed entry of kind
`doc` beside the screens it describes. A page is complete authored HTML from
a callback; a doc is prose compiled to a React component and rendered through
the consumer renderer in the desktop viewport, once per effective scheme.

Docs are never members of a `defineRoot` tree and declare neither `variants`
nor `variantOf`. This contract adds no embed blocks, table of contents, prose
comparison, or body search; the plan lists those as separate follow-ups.

## Discovery And Configuration

`defineConfig` accepts two optional fields:

```ts
docs?: readonly string[]; // repository-relative POSIX globs
docsDir?: string; // shorthand for [`${dir}/**/*.{md,mdx}`]
```

Supplying both, an empty list, a duplicate glob, a glob whose stable prefix
lies inside `.mokly-cache/`, or a `docsDir` that is not an existing directory
inside `repoRoot` fails with `config-invalid` naming the field. Omitting both
configures no docs. Glob syntax, path rules, root projection, denied
directories, vanished candidates, error precedence, and the private-cache
denial follow [entry discovery](./mokly-configuration.md#entry-discovery).
An empty glob fails with `docs glob matches no file: <glob>` and the entry
diagnostic's not-searched list; a match not ending in `.md` or `.mdx` fails
with `config-invalid` naming the glob and the file.

Discovery runs with entry discovery when the configuration is resolved and at
the start of each compilation, so watched Serve observes created, renamed, and
deleted doc files. The sorted doc set travels with the resolved config beside
the entry set, and every doc file joins `sourceFiles` under the
[source-protection contract](./mokly-source-protection.md).

The MDX compiler is an optional peer dependency, never imported when no docs
are configured. When docs are configured, Mokly resolves `@mdx-js/mdx` and
`remark-gfm` from the config file's location with the consumer resolution it
uses for React; when either is missing the command fails with
`config-invalid` and this exact line:

```text
Markdown docs need the MDX compiler. Run npm install -D @mdx-js/mdx remark-gfm in the repository that holds your docs.
```

## Frontmatter

A doc may begin with a frontmatter block: a first line of exactly `---`, one
`key: value` line per field, and a closing `---` line. The grammar is the
[guides grammar](./mokly-guides.md#frontmatter) extended with arrays: a value
is a double-quoted JSON string or a one-line JSON array of such strings. The
string keys are `id`, `title`, `description`, and optional `rationale`; the
array keys are `navPath`, `tags`, `dependencies`, and `relatedDocs`. Each
replaces the derived or default value described below.

An unknown key, a repeated key, a malformed value, an unterminated block, or
a value of the wrong shape fails compilation with `build-invalid` naming the
repository-relative file, line, and reason before any output changes; `route`,
`parent`, `order`, `slug`, `address`, `colorSchemes`, `useCaseIds`, `mobile`,
`desktop`, `variants`, and `variantOf` are unknown keys. The body follows the
block; compile diagnostics add the block's length so line numbers match.

## Derived Identity

The id defaults to the file's path relative to the stable prefix of the first
configured glob that matches it, without its extension, lowercased, with each
`/` replaced by `-`. The result must satisfy the entry id grammar, including
the Windows device-name exclusion; otherwise the build fails with
`invalid-id`, naming the file and suggesting a frontmatter `id` or a rename.
An id that another entry of any kind uses fails with `duplicate-id`.

The title defaults to the text of the first level-one ATX heading, which stays
in the rendered body, and the description to the source text of the first
paragraph after it with whitespace runs collapsed; a file with no source for
either fails with `invalid-metadata` naming the file. `dependencies` and
`relatedDocs` default to `[]`; `tags` is omitted when absent. The entry's
`sourcePath` is the doc file, so attribution and ownership name the file.

Nothing but the id moves a path. The entry route is `docs/<id>.html` and the
generated views are `docs/<id>.desktop.html` and, when the catalogue renders
dark, `docs/<id>.desktop.dark.html`, through the shared functions in the
[artifact path contract](./mokly-artifact-paths.md). A file renamed without a
frontmatter `id` therefore changes its id and every path, and Changes shows a
removal and an addition. `docs/` is a reserved generated directory exactly as
`pages/` is: a public static file at a doc view path is a collision.

## Navigation Path

`navPath` places a doc exactly as the authored field places a flat screen. The
label grammar, merging, sibling conflicts, Pages-section membership, and the
sibling comparator are the [navigation path contract](./mokly-nav-paths.md)
with no doc-specific rule: a doc is an ordinary leaf sorted alphabetically
among its siblings, directory names never contribute labels, and a doc never
inherits a path from a tree or a glob root.

## Compilation

A Mokly-owned esbuild plugin in the consumer graph loads each matched doc,
strips the frontmatter, and compiles the body with `@mdx-js/mdx`. A `.md`
file compiles in the compiler's `md` format, which treats `{`, `<`, and
`import` as text, so valid Markdown never fails as MDX. An `.mdx` file
compiles in the `mdx` format and may import `MockLink`, `ReviewIgnore`, and
product components; its imports resolve through the consumer module
resolution and bind the module-bound authoring facade. Both formats enable
GitHub tables, task lists, and footnotes through `remark-gfm` and use the
consumer React automatic JSX runtime from the existing React resolver, so one
runtime renders docs and screens. Raw HTML in either format is dropped by the
compiler and Mokly adds no sanitizer. A compiler error fails with
`build-invalid` naming the file, line, and column.

A Mokly-owned rehype step gives every heading an `id` in the
[logical fragment grammar](./mokly-navigation.md): lowercase the text,
replace each run of characters outside ASCII letters and digits with one `-`,
trim leading and trailing `-`, and prefix `section-` when the result is empty
or starts with a digit; a repeated id gains `-2`, `-3`, and so on in document
order, so `mock:<doc-id>#<heading-id>` links validate like any fragment link.

## Rendering And Output

Docs render after screen and component views and before complete pages. For
each doc and each effective color scheme the renderer receives:

```ts
interface RenderInput {
  colorScheme: ColorScheme;
  entry: DocDefinition; // kind: "doc"
  node: ReactNode; // the compiled MDX component as an element
  stylesheets: readonly string[];
  viewport: "desktop";
}
```

`DocDefinition` is exported from the root package and carries `kind: "doc"`,
the common metadata, `navPath`, and the private definition brand. A doc's
effective color schemes are the catalogue set, with no per-doc opt-out, and
stylesheet rules match its entry route. The default renderer wraps a doc in
the neutral document and inlines a package-owned reading stylesheet: a
centred column of at most 72 characters, a system font stack, a heading
scale, table and code styles, and text and surface colors for the view's
scheme. A custom renderer receives the same input and owns the template. Each
view must be a complete HTML document and passes the child-control adapter,
logical-link and fragment validation across both views, the compatibility
transformer, ownership checks, HTML/CSS/resource validation, Review-ignore
validation, and the output transaction unchanged. Owners matching a `docs`
glob are trusted for replacement and cleanup like owners of an `entries` glob.

## Manifest And Read Model

Delivery moves the manifest to v8. `ManifestEntryBase.kind` gains `doc`, and:

```ts
interface ManifestDoc extends ManifestEntryBase {
  kind: "doc";
  colorSchemes: readonly ColorScheme[];
  tags?: readonly string[];
}
```

Entries sort by kind name as `component`, `doc`, `page`, `screen`,
`use-case`, then id. Current and baseline readers accept only v8; a v7 base is
incompatible earlier output under the
[baseline compatibility contract](./mokly-baseline-compatibility.md), so
Changes reports unavailable with the existing product line. The public read
model moves to v4: `CatalogueDoc` extends `CatalogueEntry` with `kind: "doc"`
and `colorSchemes`, a `docs` array follows `pages`, doc entry nodes appear in
`tree.pages`, and the removed-entry descriptor gains `preview: { kind: "doc" }`.
Review result v4 and the static delivery descriptor are unchanged. `EntryKind`
and `ViewKind` gain `doc`; `viewRoute("doc", …)` accepts only the desktop
viewport, and the view-path parser accepts the `docs/` prefix.

## Browse And Navigation

A doc appears once at its `navPath` in the Pages section with a doc icon. The
heading uses its title; breadcrumbs use its folder labels; the id chip,
search by id, title, and tags, the tag picker, details, and the home count
include docs. Details show description, rationale, Source, Schemes when the
catalogue renders dark, Tags, Related docs, and Dependencies. A related-doc
chip whose path is a current doc's source file is a link to that doc.

The stage is the plain bordered document pane that pages use, with no device
chrome and no viewport switch. In standalone Browse the doc follows the
effective Auto/Light/Dark appearance exactly as a screen does, swapping its
light and dark views; an embedded viewer applies its preview scheme control to
docs as it does to screens. Every doc has a dark view whenever the catalogue
renders dark, so the light-only caption never applies, and each doc frame
receives the managed `color-scheme` from
[viewer appearance](./mokly-viewer-appearance.md).

`/view/docs/<id>.html` opens the shell page; `/static/docs/<id>.desktop.html`
and `/static/docs/<id>.desktop.dark.html` serve the views with the existing
GET/HEAD behavior. `MockLink`, `mockLink`, and raw `mock:<id>` values accept a
doc id. A link from a screen or component view to a doc resolves to the doc's
desktop view in the linking view's scheme, a link from a page to the light
view, and a link from a doc to a screen to that screen's desktop view in the
doc view's scheme. Browse opens the canonical page and reveals its ancestor
folders; direct URLs, in-frame navigation, Back/Forward, and fragment
restoration behave identically in Serve and static delivery.

## Changes, Watch, And Publishing

A doc is in Changes when its reviewable metadata, its `navPath`, either
generated view, or a rendered local resource changed against the branch
point, under the shared [material-change rules](./mokly-changes.md) including
paired ignore regions; source edits that leave the views unchanged do not add
it. A doc exposes Current only, with no comparison band or artifacts. Per-view
evidence marks the Appearance control when only the other scheme's view changed.

A removed doc is a flat Changes row with the doc icon, following the
[removed-page presentation](./mokly-catalogue-changes.md#removed-page-presentation).
Its previous version is its light desktop view, captured through the page
preview lifecycle in [removed previews](./mokly-removed-previews.md) with
`doc=<id>` in place of `page=<id>`, metadata at `docs/<id>.json`, and the
document at `snapshots/before/docs/<id>.desktop.html`; under a dark
appearance it keeps that light view with the existing light-only note.

Watch treats every doc file as an inventoried input: an edit, including a
frontmatter-only edit, rebuilds; a created, renamed, or deleted file that
matches a `docs` glob re-runs discovery first; the stable prefix of every doc
glob is a watched root. Serve renders a requested doc view on demand per
scheme like a screen view. Export and publication include each doc's shell
page, both views, resources, metadata, search and tag behavior, and
hierarchy; removed-doc previews follow the Changes opt-in. Doc views are
ordinary marker and upload files, so the upload contracts are unchanged.

## Acceptance

Coverage includes config validation and the shorthand; discovery order,
exclusions, and the empty-glob diagnostic; the frontmatter grammar and each
failure; a `.md` fixture containing `{`, `<`, and an `import` line that
compiles as Markdown; an `.mdx` fixture importing `MockLink`; the missing-peer
line; React runtime identity; identity derivation and collisions; `navPath`
placement, conflicts, and order; manifest v8 determinism and read model v4
conformance; a v7 base reported as incompatible; both views; links in both
directions with heading fragments; on-demand rendering; watch; Changes
membership; the removed preview; export and publish inventories; the example
catalogue; packed consumers with and without the peers; and browser coverage
of navigation, appearance, links, search, Changes, and the removed preview.
