# Path-Derived Artifact Paths

## Delivery Status

Path-derived documents, snapshots, previews and canonical shell URLs are
implemented for every entry kind, including Markdown documents.

This is the single contract for entry documents, generated view names,
comparison snapshot names, preview metadata, shell documents, URL parsing, and
reserved prefixes. Every name derives from an entry's path under the
[path contract](./mokly-paths.md); authors never supply any of them.

## Layout

Every entry owns one directory named by its path. Its own document, when it
has one, is `index.html` inside that directory, and its rendered views sit
beside it with viewport and scheme suffixes. Because path segments contain no dot, no child entry directory can collide
with these HTML filenames, and a folder page coexists with the folder's children on every static
host.

| Kind              | Documents under `static/mokly-generated/`        |
| ----------------- | ------------------------------------------------ |
| Screen            | `<path>/index.<viewport>[.dark].html` per view   |
| Component variant | `<path>/index.<viewport>[.dark].html` per view   |
| Page              | `<path>/index.html`                              |
| Document          | `<path>/index.html` and `<path>/index.dark.html` |
| Use case          | none; the shell composes its steps               |
| Component parent  | none; its page shows its first variant           |

`<viewport>` is `mobile` or `desktop`; the `.dark` infix is present only for
`colorScheme: "dark"`. The logical entry route of every kind is
`<path>/index.html`; for a screen, use case, or component parent it is a
durable identifier and not a written file.

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
parser knows no kinds: the shell resolves the path against its catalogue read
model and opens the missing view when no current or removed entry has it.
Property names inherited from JavaScript objects, including `constructor`,
`__proto__`, and `toString`, are ordinary segments that resolve against the
catalogue like any other and never against object prototypes.

Entry and view routes are relative to `mokly-generated/`. The catalogue-relative
resource helpers `generatedResourcePath` and `generatedResourceRoute` join and
remove that exact prefix. `currentDocumentPath` adds `static/` for a frame URL.
Authored closure resource paths remain catalogue-relative.

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
`snapshotDocumentPath` returns `snapshots/<side>/mokly-generated/<documentRoute(...)>`; a
removed page or document has a before side only. `snapshotSidePath` returns
the directory prefix `snapshots/<side>/`, including its trailing slash.
`snapshotResourcePath` appends one nonempty path accepted by
`isSafeRepositoryPath` to that prefix; it rejects absolute paths, empty or dot
segments, backslashes, colons, and NUL. `previewMetadataPath` returns
`previews/<path>/index.json` within the comparison generation. Each function
validates its typed axes and its path before composing a relative POSIX path.

Review production, selected capture, packaging, export checks, shell comparison
frames, previous-version requests, snapshot presentation roots, and public
generation validation call these functions. They do not join or slice a
`snapshots/` or `previews/` literal themselves. The review result and the
public read model carry paths and axes rather than any of these file names.

The ESLint rule `mokly/no-artifact-path-literals` enforces the literal ban. It
reports a string literal whose value contains `snapshots/`, or contains
`pages/` followed later by `.json`. It tests a template literal as one string,
its raw text with each substitution replaced by `${}`, and reports it at most
once. Regular-expression literals and comments are outside the rule. It
applies to `.cjs`, `.cts`, `.js`, `.jsx`, `.mjs`, `.mts`, `.ts` and `.tsx`
modules in every directory. It excludes every `tests` and `generated`
directory, the root `docs` and `plans` directories, the builder module
`packages/viewer/src/navigation/routes.ts`, and every path that ESLint ignores
for the whole repository: the `.gitignore` patterns, which exclude `.context`,
`.mokly-cache`, `.mokly-review-*`, `.mokly-write-*`, `.superpowers`,
`.wrangler`, `coverage`, `dist`, `node_modules`, `playwright-report`, `target`
and `test-results` directories at any depth, plus the root `.claude/worktrees`
and `examples/basic/mokly-generated` directories. The rule lives in
`scripts/eslint/` and runs with `npm run lint` in the repository suite.

## Shell Documents And Browser Paths

An export writes one shell document per current or removed entry at
`view/<path>/index.html`, the home at `index.html`, and the not-found view at
`404.html`. A static host serves `view/<path>/index.html` for `/view/<path>/`
without rewrites, which is why the canonical URL carries a trailing slash.
Serve answers `/view/<path>`, `/view/<path>/`, and `/view/<path>/index.html`
with the same shell, and the shell normalises its history entries to the
canonical form. Hosts that remove `index.html` or add or remove a trailing
slash therefore need no Mokly adapter; `parseViewHref` accepts every form.

The navigation module also owns:

```ts
function providerNormalizedHtmlPath(pathname: string): string | undefined;
```

It accepts a canonical shell pathname produced by `viewHref`, a
`/view/<path>/index.html` document path, or a confined `/static/**.html`
artifact path and returns the form a host serves for it: the canonical
trailing-slash URL for shell documents and static `index.html` documents,
and the pathname without its final `.html` for other static artifacts. A query, fragment, encoded separator, dot
segment, or other prefix returns `undefined`; callers preserve an already
separated query and hash. The former `unavailableViewHref` is unnecessary:
`viewHref` of a path with no entry opens the missing view.

## Reserved Prefixes And Validation

`view/`, `static/`, `mokly-viewer/`, `snapshots/`, `previews/`, and
`mokly-generated/` are reserved artifact prefixes. The last contains only
generated HTML, the private manifest, compiled CSS and copied resources beneath
`mockupsDir`; public generated files appear below exported `static/`. An
entry's first path segment cannot equal `mokly-generated`, compared
case-insensitively, under the [path grammar](./mokly-paths.md#segment-grammar).
Generated HTML also reserves `styles` and `assets` as its first segment under
the [unified output contract](./mokly-unified-output.md#one-owned-tree). No kind prefix exists, so a top-level folder may be
named `screens`, `pages`, or `components`. Generated file names use the
authored case of each segment; the output inventory rejects two files whose
case-folded paths collide, including a resource against a document directory.

Keep each helper's stated scope: generated-root, catalogue-root, comparison-generation
or origin-relative. `viewHref` and `providerNormalizedHtmlPath` begin with `/`. Callers still apply their
own output inventory, case-folded collision, source exclusion, regular-file,
and generation-confinement checks. These builders centralise naming; they do
not authorise reading or writing a path.
