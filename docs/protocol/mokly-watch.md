# Watched Catalogue Development

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Watch Inputs

`mokly serve` watches by default; `--no-watch` serves one snapshot. Watch
belongs to Serve alone: `build` and `publish` run once and start no watcher.
The watch set derives from the resolved configuration, the [source inventory](./mokly-source-protection.md#complete-source-inventory),
the sidecar's module graph, and the resources the composed documents
reference. Each input maps to the render graph node it feeds:

| Input                                                                                                            | Node                              |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| the configuration file                                                                                           | config                            |
| HTML screens, components, and pages, use case files, Markdown documents, and `_folder.json` records under a root | entry source                      |
| entry modules, stories files, the renderer module, and every module the sidecar's `bundle` reports               | bundle generation                 |
| the consumer PostCSS module and the file and directory dependencies `processCss` reports                         | stylesheet bundle                 |
| configured stylesheets, imported CSS, their nested imports, and the assets they reference                        | stylesheet bundle                 |
| fonts, images, embedded documents, and other files in the public closure of a composed document                  | the documents that reference them |
| paths named by a `watch.rules` entry of the [configuration contract](./mokly-configuration.md)                   | the rule's action                 |

A created, renamed, moved, or deleted regular file below a root that matches
one of its `files` globs re-runs discovery before the rebuild, so the file set
follows the filesystem; a rename or move changes the entry's path and is
paired by the [move contract](./mokly-moves.md), never treated as a silent
orphan. A file created below a root that no glob matches and that no module
imports is an unrelated file. A PostCSS directory dependency watches file
additions below the reported directory, including a non-denied subdirectory
added later; an absent glob means `**/*`.

A rule's action is `ignore`, `rebuild`, or `reload`: `ignore` removes the
paths from the watch; `rebuild` makes them inputs of the config node, so a
change recomputes the whole catalogue; `reload` treats them as referenced
resources of every document. Package-owned classifications take precedence
over rules: a rule cannot override the source, module, and stylesheet inputs
above or the denied names below.

## Invalidation Through The Render Graph

A watched change hashes the changed file and finds the nodes whose keys moved
under the [render graph](../architecture/rust-core.md#render-graph); only
those recompute, in parallel, and every other cached document, fragment, and
stylesheet bundle survives:

- An edit to an HTML screen recomputes its documents. An edit to an HTML
  component recomputes the component node and the documents that use it.
- An edit to a JavaScript module rebundles once, through one `bundle`
  request, and re-renders only the fragments whose generation changed; the
  old generation is disposed after adoption and its final graph or request
  releases it. An HTML-only edit
  never rebundles.
- An edit to a configured or imported stylesheet, or to a PostCSS dependency,
  recomputes the stylesheet bundle. Documents depend on its emitted CSS and
  generated asset bytes. Equal output keeps their document keys.
- An edit to a referenced resource recomputes the documents that reference
  it and clears their resource evidence.
- A configuration change reloads the configuration under the
  [runtime continuation](./mokly-watch-runtime.md#configuration-changes).

Every completed action publishes one revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve): the
index and the details are replaced in one step, and the shell reloads only
the frames whose `documentKey` changed. Nothing is written: no output tree
exists, so no watch event comes from Mokly's own writes, and a watched change
cannot schedule a feedback loop.

## Denial Rules

Broad traversal prunes these directory names at every depth below a root:
`.git`, `node_modules`, `dist`, `coverage`, `target`, `test-results`,
`playwright-report`, and `.context`. The output directory of `build`,
`mokly-static/` by default, and its transaction paths are pruned by path
whatever their names. The operating system's cache directory is outside the
repository and never watched.

- A root directory is a traversal waypoint, not an exemption for its whole
  subtree. A candidate that is an ancestor of, or equal to, a root is never
  pruned. Descendants are evaluated relative to the deepest containing root,
  so an explicit `dist/specs` root is reachable while `src/dist` and
  `src/node_modules` are pruned beneath a `src` root, and a root at the
  repository root still prunes top-level `.git` and `node_modules`.
- Only directory segments are denied: a regular file named `target` is an
  ordinary file, and deleting it rebuilds like any other matched file.
  Non-leaf segments are checked first; a denied leaf is pruned only when it
  is a directory. Directory status comes from the watcher's event kind or
  stats, and a lookup runs only for a raw rename fallback, treating a failed
  lookup as a file.
- Exact required files, including the configuration,
  inventoried sources, the renderer module, the sidecar's reported modules,
  and configured stylesheets, keep their ancestor path and the file itself
  even when nested beneath a denied directory. Denied names apply to
  discovery and directory scans, not to inventoried files or their
  ancestors. A created path beneath a denied directory is ignored because
  discovery cannot accept it.
  A required ancestor's move or removal invalidates its required descendants.
  Each confined ancestor remains observed so directory repairs are visible.
- Package source under `node_modules` or an npx cache is never consumer
  source.

Resource discovery follows the portable HTML and CSS URL rules of the
[comparison contract](./mokly-comparison.md#resources), including transitive
imports and embedded documents, reading shared edges once per pass and
visiting cycles once. External URLs and resource hints are excluded.
Ignored-region resources are in the watch graph, so rendered chrome refreshes
even when Changes is empty. Only confined regular files are public watch
inputs: resource watchers do not follow symlinks, but the lexical path of a
dangling or escaped alias stays observable so it can be repaired as a regular
file, and the escaped target is never watched.

## Watch Targets And Readiness

The watcher is constructed before the sidecar evaluates any module, so edits
during evaluation are buffered and replayed after readiness. Watch targets
are the roots, the PostCSS directory roots, the rule roots, and the exact
required files not covered by one of them; a required file with a denied
directory between a root and itself stays an explicit target. A catalogue
state keeps a constant-time index of exact files and their ancestors for the
ignore callback. The watcher is replaced only when the set of effective roots
changes. Added exact files extend its directory registrations without a root
walk or another full preparation. Resolution metadata includes missing manifest and tsconfig candidates. File additions
and removals in a consumed-module directory invalidate compilation reuse.
Native additions and removals use one
`paths_mut()` batch; existing registrations are retained. Linux renews a
registration after its directory is replaced. Vanished directories are
skipped. A new matching file in an existing watched directory causes one
rebuild and no watcher replacement. Notifications carry path,
kind, and optional stats, coalesce by path, and deliver the latest descriptor
for that path. A classifier exception is reported once, that event is
dropped, and later notifications keep flowing. Unspecified create and remove
kinds use the raw rename lookup. A rescan flag or pathless native event
queues a repository-root change and reports one loss warning per observer.
The action rescans registrations and rebuilds inputs.

Initial startup tries the requested concrete port and then each higher port in
order until binding succeeds; port `0` delegates selection to the operating
system; exhausting the range or another bind error fails with
`server-failed` without leaking watchers. The resolved port stays stable for
the life of the process.

The repository's `npm run dev` command runs watched Serve on
`examples/basic/mokly.config.json`; arguments after `--` are forwarded to Serve,
for example `npm run dev -- --port 0`.

Rebuild actions, configuration changes, Git observation, publication, and
shutdown continue in [Watch Runtime And Recovery](./mokly-watch-runtime.md).
