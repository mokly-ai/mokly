# Catalogue Read Model Fetch Rules

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Serve And Fetch Rules

Serve answers the catalogue index, every entry detail, the live descriptor,
and every JSON file of a comparison generation with GET and HEAD,
`application/json; charset=utf-8`, `X-Content-Type-Options: nosniff`, and
`Cache-Control: no-store`, because a publication replaces bytes at stable
URLs. A GET of the index or of a detail returns the current published state
and starts no render and no Git command; publication runs off the request
path under the
[shell delivery updates](./mokly-shell-delivery.md#updates-in-serve), and a
failed candidate leaves the last published state in place. Every response is
one state: the index and the details of one `revision` are published
together, and the shell fences a detail against the installed index under the
[shell delivery fences](./mokly-shell-delivery.md#fetch-and-fences).

The shell fetches the index at start and on an update message, the routed
entry's detail on each navigation and update, and the live descriptor when
the index carries `live`. Every fetch is an ordinary GET without
custom headers, uses `credentials: "omit"`, stays on the source origin, and
rejects a redirect outside it. A URL source is HTTP(S) without userinfo or
fragment. A removed entry's detail and its historical documents are read
beneath the generation that the index's `comparisonUrl` names: the detail at
`entries/<entry path>.json` under the generation, and validated HTML beneath
the generation's `snapshots/before/` and `snapshots/after/` trees, never as
frame URLs. Those HTML responses require `text/html` and the same `nosniff`
treatment as other generation files.

In the static output of `build` the index, the details, and the generation
files are immutable for one deployment: a static host may cache them under
the revalidation rules of the
[static delivery contract](./mokly-export-delivery.md), the shell keeps them
for the page's lifetime, and a different `deploymentId` means another
deployment replaced the files, which the shell delivery contract turns into a
full page load. A comparison generation URL is never rewritten to another
generation.

## Comparison Pointer

`comparisonUrl` is `null` until a complete comparison for the published state
exists; a selected-only generation of the
[on-demand contract](./mokly-on-demand.md) leaves it `null`. A non-null value
names an immutable generation under
`mokly-viewer/diffs/generations/<generation>/`, served directly from its
retained files; the route returns 404 when the generation is gone and never
redirects or starts work. Only reading a generation renews its retention;
publishing a pointer does not. A superseded completion cannot set the
pointer. The [comparison serving contract](./mokly-comparison-serving.md)
owns generation lifetimes. The shell requests comparison JSON and snapshots
only on selection, never while browsing.

## Public Paths

The public paths of a catalogue are `mokly-viewer/index.json`,
`mokly-viewer/entries/**`, `static/**`, `mokly-viewer/client/**`,
`mokly-viewer/shell.css`, `mokly-viewer/fonts/**`, and the immutable
generations under `mokly-viewer/diffs/generations/**`. Serve answers
`mokly-viewer/live.json` and `mokly-viewer/events` to the same-origin shell
only, outside the public paths; a static output never contains them. These paths keep ordinary path confinement; the list grants
no access to sources, controls, or the watcher. The
[viewer namespace](./mokly-viewer-namespace.md) owns the layout.

## Cross-Origin Hosts

A same-origin shell needs no CORS header. A host that serves the static
output to a viewer on another origin sends
`Access-Control-Allow-Origin: <exact app origin>` and
`X-Content-Type-Options: nosniff` on every public path, including error
responses and HEAD, with correct MIME types, and `Vary: Origin` when it
selects an allowed origin dynamically. No wildcard origin, cookie,
authorization header, or credential is used. Header configuration belongs to
the host; `build` cannot make a server enable CORS.
