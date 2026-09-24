# On-demand Serve

## Startup and completeness

Serve loads one consumer graph and validates its catalogue metadata, routes,
hierarchy, schemas, source inventory and output confinement before listening.
It does not render every document, write output, classify Git changes or transfer
generated HTML as a prerequisite for Browse. This applies with and without watch.

The live catalogue index is a distinct internal format, not a schema-v6 manifest.
It describes available views, not completed rendering or usage evidence. A v6
manifest still requires every view's validated records. Build, Check and Export
remain exhaustive and produce the same portable artifacts, committed or
[derived](./mokly-derived-baselines.md) according to `generatedOutput`.

The scale target is command start to searchable navigation and a real selected
preview visible in under five seconds, cold and warm on the default large fixture.
A listening socket or empty shell does not satisfy that target. Fixture creation,
package compilation and Git-baseline preparation are explicit setup operations,
reported separately and never repeated during ordinary large-fixture startup.

## Foreground documents

Generated `/static/` routes render the requested page or screen/component variant,
viewport and scheme through the retained consumer graph. Rendering runs outside
the HTTP event loop in a bounded, terminable worker. Concurrent requests for the
same view share work. Only validated results enter the generation-local bounded
cache. A renderer failure cannot make unrelated routes or shutdown unavailable.

The foreground service admits one active document and 32 queued distinct routes,
with a ten-second deadline, a 256 MiB worker heap limit and a 64 MiB result cache.
Its worker has a separate 32 MiB prepared-document cache. Failed workers terminate
before replacements start. Exhaustive background work uses one worker with a
1 GiB heap limit and yields between documents and major validation phases.

The single-document compiler reuses exhaustive Build's validation primitives: rendering,
stylesheet selection, compatibility, logical links, ownership, component ranges,
props, style/resource metadata, ignore markers, output confinement, and resource
validation. Navigation without anchors needs the destination's registered route,
not its rendered HTML. Anchors require the actual destination document; logical
anchors require every applicable destination view. Embedded local resources and
CSS imports are validated transitively. Protected sources and manifests remain
private even through aliases. No validation is skipped to meet the time target.

Route indexes and parsed resource metadata are reused within the generation.
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
The existing mobile/desktop Inspection unavailable designs also cover this usage
state: “Usage is unavailable until the catalogue has been checked.” It does not
add an environment label or replace a real zero-consumer result.

Props requests validate and capture only the edited view and its resource closure.
They never clone a full rendered manifest or validate unrelated documents. Existing
origin/token checks, cancellation, last-valid previews and memory/time limits apply.

Explicit live diffs reuse completed background evidence and capture only the selected
screen or saved variant plus its assets. They do not repeat compilation or catalogue
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
