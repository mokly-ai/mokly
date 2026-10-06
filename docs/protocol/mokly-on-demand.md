# On-demand Serve

## Delivery Status

CSS owner removal, root output boundaries and uniform rule evidence are
implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).

On-demand startup, rendering and evidence completion are implemented. The
route-evidence loading and failed Usage states are implemented by the
[route-scoped bootstrap plan](../../plans/route-scoped-shell-bootstrap.md).

Generation-tagged background and preview-process warnings are implemented in
[M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).

## Startup and completeness

Serve loads one consumer graph and validates its catalogue metadata, routes,
hierarchy, schemas, source inventory and output confinement before listening.
Output collision/ownership/confinement checks capture one stable snapshot under
the repository writer lock. The private runtime transfers its validated routes
and orphan routes with the accepted generation. Demand and background workers
reuse that evidence; they never scan a partially written output tree or acquire
a writer lock while executing consumer code. A new generation captures new evidence.
It does not render every document, write output, classify Git changes or transfer
generated HTML as a prerequisite for Browse. This applies with and without watch.

The live catalogue index is a distinct internal format, not a schema-v8 manifest.
It describes available views, not completed rendering or usage evidence. A v8
manifest still requires every view's validated records. Build, Check and Export
remain exhaustive and produce the same portable artifacts, committed or
[derived](./mokly-derived-baselines.md) according to `generatedOutput`.

The scale target is command start to searchable navigation and a real selected
preview visible in under five seconds, cold and warm on the default large fixture.
A listening socket or empty shell does not satisfy that target. Fixture creation,
package compilation and Git-baseline preparation are explicit setup operations,
reported separately and never repeated during ordinary large-fixture startup.

## Foreground documents

Generated `/static/` routes render the requested page, document, or
screen/component variant, viewport and scheme through the retained consumer
graph. Rendering runs outside
the HTTP event loop in a bounded, terminable worker. Concurrent requests for the
same view share work. Only validated results enter the generation-local bounded
cache. A renderer failure cannot make unrelated routes or shutdown unavailable.

Under [imported-CSS delivery](./mokly-imported-styles.md), reserved stylesheet
and asset routes use the accepted generation's compilation bytes for GET/HEAD
with CSS/image/font content types, never a stale disk file. Resource validation
accepts pending generated routes; transient Props previews use the same
generation's byte-safe closure. Ordinary authored assets retain confined
static delivery. Inventory-only startup freshness runs the CSS/PostCSS
dependency pass without rendering every view.
Every `/static/mokly-generated/**` request is generation-owned: if the route
is absent from that accepted generation, return 404 even when a stale file
exists on disk. Apply this to watched and no-watch committed/derived Serve,
on-demand dispatch, and transient controls; never delegate a reserved route
to the ordinary static filesystem fallback. Valid routes return exactly the
accepted bytes with the route's MIME type, including `%40` npm scopes.
For committed Serve without a retained runtime, derive the exact accepted
reserved-route set from the inventory-only graph and snapshot only those disk
bytes at startup; a syntactically valid stray on disk is still a 404. A runtime
already carries the accepted CSS and asset bytes for both output modes.

The foreground service admits one active document and 32 queued distinct routes,
with a ten-second deadline, a 256 MiB worker heap limit and a 64 MiB result cache.
Its worker has a separate 32 MiB prepared-document cache. Failed workers terminate
before replacements start. Exhaustive background work uses one worker with a
1 GiB heap limit and yields between documents and major validation phases.

The single-document compiler reuses exhaustive Build's validation primitives: rendering,
stylesheet selection, compatibility, logical links, ownership, component ranges,
props, style/resource metadata, ignore markers, output confinement, and resource
validation. It retains provenance only for inserted links present after the
compatibility transform and forwards render warnings to the Serve parent with
the generation captured from the document or transient Props render inputs.
The child warning message includes that generation. A render still using older
inputs cannot print warnings after a newer watched attempt starts, even while
it continues serving after a failed candidate. The
[warning contract](./mokly-build-warnings.md#watched-serve-generations) defines
the message, generation fence and deduplication scope.
Navigation without anchors needs the destination's registered route,

validation. Navigation without anchors needs the destination's registered entry,
not its rendered HTML. Anchors require the actual destination document; logical
anchors require every applicable destination view. Embedded local resources and
CSS imports are validated transitively. Protected sources and manifests remain
private even through aliases. No validation is skipped to meet the time target.

Entry indexes and parsed resource metadata are reused within the generation.
An on-demand document carries its [build warnings](./mokly-build-warnings.md)
beside its HTML; Serve reports warnings once per generation from the exhaustive
compilation, never per foreground request.
The inspector loads usage for displayed views on demand. Uncomputed catalogue-wide
usage is explicitly unavailable, never displayed as zero consumers. Live All/Changes
controls are always present. While a calculation is pending, a spinner replaces the
Changes count in a fixed-width slot. Selecting Changes replaces navigation rows with
“Checking for changes…” and a spinner; All remains searchable and usable. Complete
evidence replaces the spinner with its real count, including zero. Failed rendering,
output adoption or classification ends loading with “Changes are unavailable. You
can still browse All.” and a dash instead of a count. Status and evidence share the
same version/generation fences. A superseded job cannot change either.
The selected filter survives loading updates and their completion, even if the
current preview is unchanged or there are zero Changes. Neither the tabs nor the
navigation content's top edge moves when the count replaces the loader. Reduced
motion disables rotation. Static exports without Changes still omit these controls.
Evidence completion updates the mounted shell and retains navigation and preview
documents. It cannot clear search, open a collapsed current folder or interrupt
temporary props. The [live evidence contract](./mokly-live-evidence.md) defines
revision fences, navigation races, usage ownership and reload fallback.

After in-shell navigation, a route-scoped bootstrap can intentionally omit the
destination's usage until its paired private workspace arrives. During that
delivery gap, the Usage panel says `Loading usage…` and shows no consumer
counts, empty state, `Used by`, or `Affected` rows. A failed or rejected current
evidence read says `Usage couldn’t be loaded.` and provides a `Try again`
button. Retry repeats the fenced route-evidence read without replacing preview
frames. Omitted displayed-view usage is pending, so screen inspection keeps
`Waiting for the component preview.` until real route usage is adopted in
place. It must never flash the validated-empty copy.

The existing mobile/desktop Inspection unavailable designs cover genuinely
unavailable catalogue usage: “Usage is unavailable until the catalogue has
been checked.” That state is distinct from route delivery failure. It does not
add an environment label or replace a real zero-consumer result.

Props requests validate and capture only the edited view and its resource closure.
They never clone a full rendered manifest or validate unrelated documents. Existing
origin/token checks, cancellation, last-valid previews and memory/time limits apply.

Explicit live diffs reuse completed background evidence and capture only the selected
screen or component variant entry plus its assets. They do not repeat compilation or catalogue
classification. The [selected comparison contract](./mokly-selected-comparisons.md)
defines request scope, checked-input digests, immutable snapshots and cancellation.

## Background work and replacement

Both Serve modes complete the generated tree and Changes in background work.
Background work is bounded, gives foreground rendering priority and cannot publish
after its source generation is superseded. Source/config replacement accepts a new
validated index and rendering graph together; failed candidates retain the previous
working generation. Replacements invalidate cached documents, usage and comparisons.
Resource edits invalidate cached resource evidence. Shutdown cancels outstanding work.
HTTP shutdown stops accepting connections, ends live-update streams, and closes
all remaining client connections, including incomplete requests and responses.
It drains every owned service even if another service fails to close; it never
waits for a browser to finish sending a request or reading a preview.

Background classification runs in the worker, but Git commands run through a private
request/reply channel owned by the parent. Source replacement, shutdown and worker
failure stop command admission, cancel all active Git processes and wait for their
process/pipe closure before completing cleanup. This does not depend on the worker
handling a shutdown message or yielding its CPU. On POSIX, cancellable Git commands
have dedicated process groups so cancellation also stops their ordinary helpers.
SIGTERM escalates to SIGKILL after one second; Windows terminates the direct child.
Concurrent Git-service cleanup callers share the same drain. Late replies cannot publish stale
classification. Git output remains capped at 64 MiB per stream; classification and
its parsing/comparison work remain outside the HTTP event loop.

Background generation uses the ordinary exhaustive Build pipeline and render order,
with checkpoints between documents and major validation phases. Forward-anchor
validation cannot render a destination ahead of that order. Stateful style registries
can include different unused CSS in on-demand previews; the exhaustive background
artifacts retain Build's bytes and do not create artificial Changes.

Background warnings carry the producing generation through the worker and
parent. Stream branch producers once into the shared diagnostic sink; completion
combines `compilation.diagnostics` without replay before Catalogue ready. A watched rebuild or reconfiguration starts a fresh warning generation
before candidate work, regardless of whether that candidate succeeds. Late
warnings from superseded work are discarded. Unwatched Serve keeps its
lifetime warning scope, and one-shot commands keep their existing scopes.

Full generated output is finalized only through the existing transactional output
store. It never substitutes for demand rendering of the current generation.
Git-only baseline changes are observed off the HTTP request path, as is any
derived-mode baseline rebuild. Ref observation
must support worktrees and packed refs. Publication and offline consumers accept
only exhaustive, validated artifacts, never the live index.

## Verification

Regression tests cover cold start with an unrelated failing renderer, identical
exhaustive/demand output, cache coalescing, worker failure/timeout, source and resource
confinement, anchor checks, partial evidence, Props isolation, source replacement,
stale background results and shutdown. Real-process regressions prove Git is gone
after shutdown/replacement, ignored termination is escalated, and worker failure or
an unresponsive worker cannot orphan parent-owned Git. The full-sized browser benchmark checks real
frame content, search, themes/viewports and a successful Props edit, cold and warm.
