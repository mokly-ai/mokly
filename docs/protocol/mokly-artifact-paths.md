# Path-Derived Artifact Paths

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Layout

Every entry owns one directory named by its path under the
`static/mokly-generated/` namespace. Its own document, when it has one, is
`index.html` inside that directory, and its rendered views sit beside it with
viewport and scheme suffixes. Path segments contain no dot, so no child entry
directory can collide with these file names, and a folder page coexists with
the folder's children on every static host.

| Kind                         | Documents under `static/mokly-generated/`        |
| ---------------------------- | ------------------------------------------------ |
| Screen                       | `<path>/index.<viewport>[.dark].html` per view   |
| Component, parent or variant | `<path>/index.<viewport>[.dark].html` per view   |
| Page                         | `<path>/index.html`                              |
| Document                     | `<path>/index.html` and `<path>/index.dark.html` |
| Use case                     | none; the shell composes its steps               |

`<viewport>` is `mobile` or `desktop`; the `.dark` infix is present only for
`colorScheme: "dark"`. A component parent renders its own props, so it has
views like a variant. The logical entry route of every kind is
`<path>/index.html`; for a screen, a component, or a use case it is a durable
identifier and not a document.

Resources share the namespace: a root's bundled stylesheet at
`styles/<repository-relative module path>.css` and a CSS asset at
`assets/<repository-relative asset path>` under the
[imported stylesheet contract](./mokly-imported-styles.md). A Markdown
document's resource is a closure file at `static/<repository-relative path>`
under the [documents contract](./mokly-documents.md); no copy is made under
`static/mokly-generated/`. `styles` and `assets` are
reserved as the first segment of a document route. An entry's first path
segment cannot equal `mokly-generated`, compared case-insensitively, under
the [segment grammar](./mokly-paths.md#segment-grammar). No kind prefix
exists, so a top-level folder may be named `screens`, `pages`, or
`components`.

The namespace is a route prefix, not a directory in the repository. Serve
answers `/static/mokly-generated/<route>` through
[generation delivery](./mokly-imported-styles-assets.md#validation-and-the-render-cache), and `build`
writes `static/mokly-generated/<route>` into its output directory under the
[shell delivery contract](./mokly-shell-delivery.md). A route uses the
authored case of each segment; the output inventory rejects two files whose
case-folded paths collide, including a resource against a document directory.
Nothing is read from disk by route.

## Shared Functions

`@mokly/viewer/data` exports the shared pure path functions:

```ts
type EntryKind = "component" | "document" | "page" | "screen" | "use-case";
type ViewKind = "component" | "screen";
type SnapshotSide = "before" | "after";

function entryRoute(path: string): string;
function viewRoute(
  path: string,
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): string;
function documentRoute(path: string, colorScheme: "light" | "dark"): string;
function viewHref(path: string): string;
function parseViewHref(pathname: string): string | undefined;
```

`entryRoute` returns `<path>/index.html`. `viewRoute` returns
`<path>/index.<viewport>[.dark].html`. `documentRoute` returns
`<path>/index[.dark].html` for pages and documents. `viewHref` returns the
canonical URL `/view/<path>/`. `parseViewHref` accepts `/view/<path>/`,
`/view/<path>`, and `/view/<path>/index.html`, decodes percent-encoded
segments, validates the result as a path, and returns the path; any other
pathname, including one with a query or fragment, returns `undefined`. The
parser knows no kinds: the shell resolves the path against the catalogue
index and opens the missing view when no current or removed entry has it.
Property names inherited from JavaScript objects, including `constructor`,
`__proto__`, and `toString`, are ordinary segments that resolve against the
catalogue like any other and never against object prototypes.

Entry and view routes are relative to `mokly-generated/`; `GENERATED_DIRECTORY`
names that route segment. The resource helpers
`generatedResourcePath` and `generatedResourceRoute` join and remove that
exact prefix. `currentDocumentPath` adds `static/` for a frame URL. Authored
closure resource paths stay repository-relative under `static/`.

## Comparison And Preview Paths

The same module exports:

```ts
function snapshotViewPath(
  side: SnapshotSide,
  path: string,
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): string;
function snapshotDocumentPath(
  side: SnapshotSide,
  path: string,
  colorScheme: "light" | "dark",
): string;
function snapshotSidePath(side: SnapshotSide): string;
function snapshotResourcePath(side: SnapshotSide, route: string): string;
function previewMetadataPath(path: string): string;
```

`snapshotViewPath` returns `snapshots/<side>/mokly-generated/<viewRoute(...)>`.
`snapshotDocumentPath` returns
`snapshots/<side>/mokly-generated/<documentRoute(...)>`; a removed page or
document has a before side only. `snapshotSidePath` returns the directory
prefix `snapshots/<side>/`, including its trailing slash.
`snapshotResourcePath` appends one nonempty path accepted by
`isSafeRepositoryPath` to that prefix; it rejects absolute paths, empty or
dot segments, backslashes, colons, and NUL. `previewMetadataPath` returns
`previews/<path>/index.json`. Each path is relative to the comparison
generation `mokly-viewer/diffs/generations/<generation>/`, and each function
validates its typed axes and its path before composing a relative POSIX
path.

Comparison production, the static build, shell comparison frames,
removed-preview requests, snapshot presentation roots, and generation
validation call these functions; none joins or slices a `snapshots/` or
`previews/` literal itself. The catalogue index and the entry details carry
paths and axes, never these file names. The ESLint rule
`mokly/no-artifact-path-literals` keeps that ban in the viewer package: it
reports a string literal that contains `snapshots/`, or `pages/` followed
later by `.json`, tests a template literal as one string with each
substitution replaced by `${}`, exempts the route builder module and test
directories, and runs with the repository suite.

## Shell Documents And Browser Paths

`build` writes the shell stub once per shell route: `view/<path>/index.html`
for every current and removed entry, `index.html` for the home, and
`404.html` for the not-found view, under the
[shell delivery contract](./mokly-shell-delivery.md). A static host serves
`view/<path>/index.html` for `/view/<path>/` without rewrites, which is why
the canonical URL carries a trailing slash. Serve answers `/view/<path>`,
`/view/<path>/`, and `/view/<path>/index.html` with the same stub, and the
shell normalises its history entries to the canonical form. Hosts that
remove `index.html` or add or remove a trailing slash therefore need no
Mokly adapter; `parseViewHref` accepts every form.

The navigation module also owns:

```ts
function providerNormalizedHtmlPath(pathname: string): string | undefined;
```

It accepts a canonical shell pathname produced by `viewHref`, a
`/view/<path>/index.html` document path, or a confined `/static/**.html`
artifact path and returns the form a host serves for it: the canonical
trailing-slash URL for shell documents and static `index.html` documents,
and the pathname without its final `.html` for other static artifacts. A
query, fragment, encoded separator, dot segment, or other prefix returns
`undefined`; callers preserve an already separated query and hash. `viewHref`
of a path with no entry opens the missing view.

## Frames And Reverse Mapping

The catalogue index and the entry details carry paths and view axes and no
route or layout-prefix field; a reader derives every current URL from the path
through the shared functions, and disk existence, host settings, and payload
metadata select no other layout. A reader rejects another `schemaVersion`
before it derives a URL. The shell, component stages, geometry, inspection,
and navigation derive paths from the same functions and construct no second
route map: validated segments are encoded once, a query and a fragment are
kept under the [navigation contract](./mokly-navigation.md), and an
artifact-relative path resolves at the source origin root, not at the JSON
directory or an embedding application's URL. An adapter validates a current
document's path under `/static/mokly-generated/`, strips that fixed prefix
once, resolves the logical route through the path functions, and keeps a
valid fragment separately; authored closure URLs are resources, not entry
routes. Comparison snapshots and removed previews resolve from the generation
that the index's `comparisonUrl` names; their `snapshots/before/` and
`snapshots/after/` paths are generation-local, never current `/static/`
paths, and use their own adapters, as do transient renders under
`mokly-viewer/components/renders/` of the
[component controls contract](./mokly-component-controls.md). A
provider-normalized extensionless URL identifies the same document through
`providerNormalizedHtmlPath`.

## Reserved Prefixes And Validation

`view/`, `static/`, `mokly-viewer/`, `snapshots/`, `previews/`, and
`mokly-generated/` are reserved artifact prefixes. `static/mokly-generated/`
holds only rendered documents, bundled stylesheets, and CSS assets. `static/<repository-relative path>` holds the referenced
authored closure, whose paths cannot start with `mokly-generated/`. Each
helper keeps its stated scope: namespace-relative, static-relative,
generation-relative, or origin-relative; `viewHref` and
`providerNormalizedHtmlPath` begin with `/`. Callers still apply their own
output inventory, case-folded collision, source exclusion, regular-file, and
generation-confinement checks. These builders centralise naming; they do not
authorise reading or writing a path.
