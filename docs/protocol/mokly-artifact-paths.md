# Identity-Derived Artifact Paths

## Delivery Status

Entry/view, snapshot, preview, normalized-path, and unknown-destination helpers
are implemented through the shared viewer data and navigation modules.

This is the single contract for entry routes, generated view names, comparison
snapshot names, removed-page metadata, provider-normalized shell paths, and
unknown logical destinations. Authors never supply any of these paths.

## Entry And View Paths

`@mokly/viewer/data` exports the shared pure path functions:

```ts
type EntryKind = "component" | "page" | "screen" | "use-case";
type ViewKind = "component" | "screen";
type SnapshotSide = "before" | "after";

function entryRoute(kind: EntryKind, id: string): string;
function viewRoute(
  kind: ViewKind,
  id: string,
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): string;
function viewHref(kind: EntryKind, id: string): string;
```

The results are:

| Kind      | `entryRoute`           | `viewRoute`                              |
| --------- | ---------------------- | ---------------------------------------- |
| Screen    | `screens/<id>.html`    | `screens/<id>.<viewport>[.dark].html`    |
| Page      | `pages/<id>.html`      | Not applicable                           |
| Use case  | `user-flows/<id>.html` | Not applicable                           |
| Component | `components/<id>.html` | `components/<id>.<viewport>[.dark].html` |

`viewHref` prepends `/view/` to `entryRoute`. The dark infix is present only
for `colorScheme: "dark"`. Variants use their own kind and global id exactly
like every other entry. IDs have no `.`, so an entry document cannot collide
with a view suffix belonging to another id.

`parseViewHref(pathname)` is the inverse for canonical `.html` and
provider-normalized extensionless paths. It accepts only the four literal
prefixes in the table and a portable entry id. Property names inherited from
JavaScript objects, including `constructor`, `__proto__`, and `toString`, are
not prefixes. A query or fragment is not part of `pathname` and is rejected if
passed to this parser.

## Comparison And Preview Paths

The same module exports:

```ts
function snapshotViewPath(
  side: SnapshotSide,
  kind: ViewKind,
  id: string,
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): string;
function snapshotPagePath(id: string): string;
function snapshotSidePath(side: SnapshotSide): string;
function snapshotResourcePath(side: SnapshotSide, route: string): string;
function pagePreviewMetadataPath(id: string): string;
```

`snapshotViewPath` returns
`snapshots/<side>/<viewRoute(kind, id, viewport, colorScheme)>`.
`snapshotPagePath` returns `snapshots/before/pages/<id>.html`; removed pages
have no after side. `snapshotSidePath` returns the directory prefix
`snapshots/<side>/`, including its trailing slash. `snapshotResourcePath`
appends one nonempty path accepted by `isSafeRepositoryPath` to that prefix;
it rejects absolute paths, empty or dot segments, backslashes, colons, and NUL.
`pagePreviewMetadataPath` returns `pages/<id>.json` within the comparison
generation. Each identity-specific function validates its typed axes and entry
id before composing a relative POSIX path.

Review production, selected capture, packaging, export checks, shell comparison
frames, previous-version requests, snapshot presentation roots, and public
generation validation call these functions. They do not join or slice a
`snapshots/` or `pages/` literal themselves. Review result v5 and catalogue v4
carry identity and axes rather than any of these paths.

## Browser Path Helpers

The navigation module also owns two browser-only derivations:

```ts
function providerNormalizedHtmlPath(pathname: string): string | undefined;
function unavailableViewHref(id: string): string;
```

`providerNormalizedHtmlPath` accepts a canonical absolute pathname produced by
`viewHref` or a confined `/static/**.html` artifact path and removes only its
final `.html`. A query, fragment, encoded separator, dot segment, or other
prefix returns `undefined`; callers preserve an already-separated query/hash.
Shell history, static workspace evidence, and both preview adapters use it
whenever a host removes HTML extensions, so preview scripts carry no rewrite
regular expressions.

`unavailableViewHref` returns `/view/<percent-encoded id>` for a logical frame
destination whose id is absent from the catalogue. That URL deliberately fails
the canonical route parser and opens the shell's missing view; it never guesses
an entry kind. The shell and every provider adapter share this function.

## Ownership And Validation

All returned paths are artifact-root-relative except `viewHref`, normalized
view paths, and unavailable-view hrefs, which begin with `/`. Callers still
apply their own output inventory, case-folded collision, source exclusion,
regular-file, and generation-confinement checks. These builders centralize
naming; they do not authorize reading or writing a path.
