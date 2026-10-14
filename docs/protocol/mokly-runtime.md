# Mokly Build And Browse Runtime

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page is the runtime contract of `mokly serve` and `mokly build`: how a
catalogue is discovered, rendered, cached, served, written, and shut down. The
[Rust core architecture](../architecture/rust-core.md) is the map of the
crates; the pages linked below own the exact rules of each subsystem.

## Source Of Truth

Authored sources define the catalogue: HTML screens, components, and pages,
use case files, Markdown documents, folder records, entry modules, and
stories files under the configured roots, plus the configuration file, the
renderer module, and the configured stylesheets. The catalogue model is built
from them in memory on every start and after every watched change. The [catalogue index v7](./mokly-shell-delivery.md#catalogue-index)
and the [entry detail v1](./mokly-shell-delivery.md#entry-detail) are the
public form of the model.

## Discovery And Validation

1. Load the configuration under the
   [configuration contract](./mokly-configuration.md).
2. Walk every root once. A file's suffix gives its kind under the
   [HTML screens contract](./mokly-html-screens.md) and the
   [entry module contract](./mokly-entry-modules.md); its place gives its
   path under the [path contract](./mokly-paths.md).
3. Parse HTML, YAML, Markdown, and folder records in Rust. When the catalogue
   has JavaScript, bundle it through the [sidecar](./mokly-sidecar.md) and
   take every definition from `describe`.
4. Build the catalogue model: paths, folders, variants, props and prop
   schemas under the [entry props contract](./mokly-entry-props.md), use
   cases, documents, and the component registry.
5. Validate metadata, relationships, paths, links, markers, stylesheets, and
   colour schemes. Every error is reported with its repository-relative file,
   line, and column before any render starts, and a command with an error
   fails with `build-invalid`. Non-fatal findings are
   [build warnings](./mokly-build-warnings.md).

## Render Graph And Cache

Every output is a node of the content-addressed render graph that the
[architecture page](../architecture/rust-core.md#render-graph) defines, keyed
by the hash of its inputs. A screen or component renders once per view, that
is per viewport and colour scheme; a page or Markdown document renders once.
A node recomputes only when its key moves. Fragments are memoized across
screens, so a component rendered with the same props on many screens renders
once.

Rendered documents live in the render cache: process memory, bounded by bytes,
evicted least recently used. Serve, Changes, and `build` read the cache; an
evicted document renders again from its sources on the next request. The
base-side extraction cache and the dependency install cache live in the
operating system's cache directory under a key derived from the repository
path, each with its own byte bound; the terminal names that directory, and
deleting it is safe. No cache is in the repository.

## Serve

`mokly serve` runs discovery and validation, builds the catalogue model, binds
the port, and publishes its first state with `revision` `1`. The listening
URL is reported only after validation passes. Before the first request, Serve
renders no document. Documents render on first request under the
[on-demand contract](./mokly-on-demand.md); the other views, the usage of
every entry detail, and Changes follow in background work, and each
completion publishes a new revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve). Serve
watches the sources by default under the [watch contract](./mokly-watch.md);
`--no-watch` serves one snapshot and computes the background evidence once.

Serve binds `127.0.0.1` only, starting at the port the
[package contract](./mokly-package.md#cli) names, and keeps the resolved port
for the life of the process. Git never runs on the request path: ref
resolution, changed paths, and base reads run in background work with their
own cancellation. `--base <ref>` overrides `review.base` for the life of the
process.

## Build

`mokly build` runs discovery and validation, renders every view of every
entry, reports warnings, and writes the static site into the directory `--out`
names, `mokly-static/` at the repository root by default, which Git must
ignore. It writes the shell stub per route, the index, one detail per entry,
every document, the comparison generation, the viewer bundle, styles, and
fonts under the [static build contract](./mokly-export.md) and the
[static delivery contract](./mokly-export-delivery.md). An error fails the
command before any file is written. With `--strict`, a warning fails it too.
The output transaction stages the whole site, replaces the output directory
in one step, and rolls back on failure, so the last successful output stays
in place. A validation-only run is a build to a temporary directory.

`mokly publish` builds into its own directory outside the repository and
uploads the result through the [upload exchange](./mokly-upload-exchange.md).
There is no other verb: validation is `build --strict`, and the static site
is `build`.

## Sidecar Pool

A sidecar starts only when the catalogue needs JavaScript: a `.mockup.tsx`
entry, a registered JavaScript component, a Storybook stories file, or a
consumer PostCSS module. A catalogue of HTML, YAML, and Markdown files starts
none. The pool, its size, the request deadlines, the recycling thresholds,
and the fail-closed codes belong to the
[sidecar contract](./mokly-sidecar.md). The core owns every decision the
sidecar does not make: which renders run, the cache keys, invalidation, and
the composed document. A sidecar failure fails the request that needed it
with its typed code and never makes an unrelated route or shutdown
unavailable.

## Routes

Serve answers the routes of the
[shell delivery contract](./mokly-shell-delivery.md#routes), and `build`
writes the same relative paths as files. In addition:

| Route                                           | Serve | `build` | Content                                                                                                   |
| ----------------------------------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------------- |
| `/static/mokly-generated/<route>`               | live  | files   | rendered views, pages, and documents, named under the [artifact path contract](./mokly-artifact-paths.md) |
| `/static/<closure path>`                        | live  | files   | authored assets in the [public closure](./mokly-public-closure.md), read from the roots                   |
| `/mokly-viewer/diffs/review.json?path=<path>`   | live  | absent  | an on-demand comparison, redirected to its immutable generation                                           |
| `/mokly-viewer/components/render`               | live  | absent  | the live prop render of the [controls contract](./mokly-component-controls.md)                            |
| `/mokly-viewer/components/renders/<render-id>/` | live  | absent  | a temporary preview document and its resources                                                            |

`static/mokly-generated/` is a route prefix; no directory of that name exists
in the repository. Every route answers GET and HEAD; HEAD returns the same
status and headers without a body, and a HEAD request to the event stream
opens no stream. Serve sends `Cache-Control: no-store` on every response,
because a watched rebuild replaces bytes at stable URLs. A route that the
catalogue model does not declare returns 404 even when a file of that name
exists; no reserved route falls back to the filesystem. The path decoder
rejects malformed encoding, absolute and empty paths, dot segments, and
separators introduced by decoding before any filesystem resolution, and
authored assets never resolve outside the roots or through a symlink that
leaves the repository. Protected authoring inputs are never served.

## Browse Shell

The Browse shell is the viewer package's React tree, rendered only in the
browser from the catalogue index and the current entry's detail under the
[shell delivery contract](./mokly-shell-delivery.md). Serve and `build`
deliver one identical stub page per shell route and never render shell HTML.
The [viewer contract](./mokly-viewer.md#shell-tree-and-state) owns the tree:
the top bar, search and tags, the navigation column with its All/Changes
filter, the breadcrumbs, the viewport and appearance controls, the device
chrome, the expand toggle, and the details inspector. The
[navigation contract](./mokly-navigation.md) owns routes, links, history,
and the active-tree rule; the
[variant navigation](./mokly-variant-navigation.md),
[disclosure persistence](./mokly-disclosure-persistence.md),
[appearance](./mokly-viewer-appearance.md), and
[shell design](./mokly-shell-design.md) contracts own their parts.

A screen embeds its rendered views inside package-owned device frames; a use
case renders ordered steps that reference those views; a page or document
embeds its complete document. Frames are sandboxed without script permission,
so a document cannot alter the shell; the explicit cross-origin exception is
confined to the [frame adapter](./mokly-frame-adapter.md). The All/Changes
filter, the per-view status beside the title, and the marks on the view
controls derive from the Changes evidence of the index and the detail under
the [Changes contract](./mokly-changes.md#changes-membership); a pending
calculation shows a spinner, an unavailable one keeps All browsable, and a
removed entry opens its base render under
[removed previews](./mokly-removed-previews.md). No update reloads the page:
the shell replaces the index and the details in place and reloads only the
frames whose `documentKey` changed.

## Component Workspaces

Registered components have component pages, variant entries, usage from the
composed trees, and live prop editing in Serve. The
[explorer contract](./mokly-component-explorer.md) owns the inspector and the
component page; the [controls contract](./mokly-component-controls.md) owns
live editing; [component attribution](./mokly-component-changes.md) separates
changed entries from affected consumers.

## Watched Development

The [watch contract](./mokly-watch.md) and its
[runtime continuation](./mokly-watch-runtime.md) define the inputs,
invalidation through the render graph, recovery, and publication.

## Changes

Both sides of a comparison render from sources with the current Mokly
version, the head from the working tree and the base from the base commit's
Git tree, under the [comparison contract](./mokly-comparison.md). Serve
classifies Changes in background work after readiness and publishes the
result as a revision. Comparison snapshots render on demand when the reader
selects a diff, under the
[comparison serving contract](./mokly-comparison-serving.md). `build` writes
one complete comparison generation. There is no standalone comparison
command.

## Shutdown

Serve installs its `SIGINT` and `SIGTERM` handling before it reports the
listening URL, so an interrupt at any later moment closes it cleanly. Shutdown
runs in this order:

1. Stop accepting connections, end every event stream, and close every
   remaining client connection, including incomplete requests.
2. Stop the watcher and discard a configuration candidate that has not been
   adopted.
3. Cancel outstanding render, background, and comparison work; drain the
   comparison generation work in flight before any generation is released.
4. Cancel every Git process through its process group, `SIGTERM` then
   `SIGKILL` after one second, and wait for its pipes to close.
5. Send `shutdown` to every sidecar and kill one that survives the grace
   period of the sidecar contract.
6. Release the port and the file locks, and exit.

No orphan process survives a normal shutdown, a failed startup, or an
interruption, and a step that fails does not skip the steps after it. `build`
and `publish` check cancellation before and after the output transaction's
commit point and never leave a partial output directory in place.

## No Writes

No command writes into the repository except `build` into its output
directory. Serve, Changes, live prop editing, and comparison generations keep
every result in process memory. The caches outside the repository are the
only other files Mokly writes, and deleting them changes time only.

## Verification

Rust tests cover discovery, the render graph keys, cache eviction, route
safety, the no-writes rule, and shutdown ordering with real processes. The
browser suite covers navigation, history and focus, colour schemes, watched
updates without a page reload, and on-demand comparison with
rendered-resource and ignored-region classification.

## Related Docs

- [Rust core architecture](../architecture/rust-core.md)
- [Render pipeline](../architecture/build-pipeline.md)
- [Package and authoring contract](./mokly-package.md)
- [Shell delivery and read model routes](./mokly-shell-delivery.md)
- [Changes and comparisons](./mokly-changes.md)
