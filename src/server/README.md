# Serving catalogues

Serve publishes a validated catalogue, renders requested documents and exposes
comparison snapshots. `serve.ts` owns single-process Serve; `serve_watched.ts`
owns watchers, background work and the supervised HTTP child. `http.ts` and
`child.ts` serve accepted inputs and never prepare historical baselines.
`http_request_handler.ts` isolates per-request routing from the server's
mutable catalogue and evidence lifecycle.
`component_change_cache.ts` coalesces accepted classification reads across
the server's content generations.
`component_change_types.ts` defines the shared snapshot and classifier contracts.
`component_changes.ts` runs the repository classification against those contracts.
`render_moves.ts` binds accepted pairs to that renderer generation for saved and
controlled preview diagnostics. Pending evidence, runtime replacement and
unavailable Changes clear the map. Background classification shares one pairing
with public catalogue projection, removals and selected comparison capture.
Only accepted generations report ambiguity and unmatched `movedFrom` diagnostics
through the terminal reporter; stale background results remain silent.
Accepted document bodies also travel privately with background compilation so
Markdown similarity never reads a newer filesystem generation.
`watch_inventory.ts` refreshes exact watch inputs before watcher attachment.
`http_shutdown.ts` stops HTTP admission, ends live-update streams, and disconnects
open clients before draining every owned service. Incomplete request headers or
unfinished responses cannot keep shutdown waiting for the browser.
`http_snapshot.ts` selects startup metadata before listening. The request
handler also applies local-control admission and routes HTTP errors. `serve_lifecycle.ts`
keeps child restart, recovery and queued background work together.
`watch_events.ts` owns classification and serialized event handling;
`watch_paths.ts` owns watch roots and pruning, including entry-glob traversal
boundaries that retain each stable prefix without exempting its ignored
descendants. Discovery and watching share one denied-directory policy below the
relevant glob root: traversal uses the deepest containing root, and entry-file
classification uses the deepest matching root. Root `files` globs define entry shapes. Folder exclusions control entry collection; root matches, including new excluded
files, remain protected source-watch candidates. Traversal also skips
`review.outDir`. A denied leaf's directory status comes from watcher stats,
else from its event kind, else from one stat that treats any error as a file.
Generated output, Review and cache outrank exact required
inputs; denied directory names only prune broad discovery and directory scans.
Logical and physical aliases share these distinct reasons. A denied leaf's
directory status comes from watcher stats, else its event kind, else one stat
that treats any error as a file.
`watch_index.ts` caches the exact required inputs and their ancestors once per
accepted config. `watchTargets` drops individually covered files when an entry
root, PostCSS directory or watch-rule root already watches them, except
required files below a skipped directory segment. Those remain explicit
targets and their arrival replaces the watcher; ordinary covered files do not.
Physical event paths
under a symlinked repository root map back to configured logical paths.
`addDir` and `unlinkDir` identify directories; `add`, `change`, and `unlink`
identify files. Supplied stats avoid that stat, but traversal still reads export
markers; the watcher ignores `mokly-generated/` by prefix. Deleted matched
files rebuild even when named `target`; existing and removed denied
directories outrank user watch rules.
Resource notifications coalesce by path with the latest descriptor.
PostCSS directory-dependency roots join the package-owned watch targets after
graph inventory. Matching file additions and any new non-ignored subdirectory
below a reported directory rebuild, while deletions do not; absent globs
default to `**/*`. Edits to already inventoried files rebuild, and local PostCSS
configuration imports reconfigure before rebuilding. Ignored generated output
and denied directories do not trigger a rebuild through directory globs.
All CSS asset extensions use the MIME types in `build/styles/routes.ts` on
static, on-demand and transient delivery; opaque bytes are never decoded.
Discovery skips `review.outDir`, denied directories, and directories that vanish
or are replaced mid-walk (`ENOENT` or `ENOTDIR`). Zero-match messages list denied
and vanished paths together, including modules dropped during validation. Other
read or projection failures report
`config-invalid` with the repository-relative path and error code. Discovery
projects repository and glob roots once per pass; Review output alone uses a
lexical fallback if its projection fails. Source notifications
are isolated at the gate: classifier failures are reported, that notification
is dropped, and later notifications continue through the same watcher.

GET/HEAD `/mokly-viewer/catalogue.json` returns the public v5
[read model](../catalogue/README.md) as complete JSON with
`Cache-Control: no-store`; it never contains bootstrap-only omitted usage.
`public_catalogue.ts` serializes an atomic snapshot when accepted content,
background usage/Changes or actual on-demand view records arrive. Requests only
read the retained bytes. Content revisions follow accepted content versions;
evidence revisions advance independently. Failed candidates preserve the last
snapshot, and superseded generations cannot replace it. `catalogue_update.ts`
prepares updates before publication; `http_types.ts` owns the lifecycle types.

Entry shells use canonical `/view/<path>/` URLs. Extensionless `/view/<path>`
and `/view/<path>/index.html` forms select the same entry; browser history is
normalized without dropping its query or fragment. The
[artifact path contract](../../docs/protocol/mokly-artifact-paths.md) defines
all shell, generated document, view and snapshot names.

Shell pages render through `@mokly/viewer/server` with CLI-owned live context.
`public_catalogue_model.ts` validates each serialized public revision once and
reuses it across shell requests until the bytes change. CSS, browser modules,
fonts, events and static documents bypass that decoding entirely.
Each shell request derives the usage scope from its entry identity and snapshot,
embeds that entry-scoped public projection, and computes its private workspace from the
complete private catalogue so `Used by` and `Affected` remain complete. The
server serializes the bootstrap and capability descriptor once and passes the
strings through document rendering unchanged. Live pages load `react-host.js`,
which imports the shared `react-shell.js`; finalized pages load that same shell
bundle directly.
`client_modules.ts` reads the generated viewer and CLI browser manifests,
requires exact equality with their build directories, rejects missing,
non-JavaScript, unexpected or colliding outputs, and loads the complete delivery
inventory before binding. The manifests are emitted from actual completed
esbuild outputs rather than maintained by hand. Every shell request renders the
hydrated React document. Serve loads the small `react-host.js` composition over
the shared `react-shell.js`; export and preview load `react-shell.js` directly.
The CLI host modules retain private live-update and capability transports.

`screen_view_changes.ts` retains per-view screen-only material decisions from
the existing classification pass. The public projection does not infer Changes
membership from visual comparisons or invent empty usage for unfinished views.
Any classifier failure, including in a screen-only catalogue, is logged and
publishes Changes unavailable; there is no secondary comparison fallback.
`public_review.ts` adds content-addressed aliases for matching complete explicit
comparisons, verifying snapshot bytes against accepted input digests. Selected
comparisons leave the catalogue pointer null. Public aliases never regenerate or
redirect to another generation; invalidation clears the pointer, and retained
aliases continue to serve their original generation. These updates add no shell
requests, UI, or changes to existing local comparison controls.
Alias pruning uses the generation store's non-renewing `peek`; only serving a
retained generation through `get` extends its idle lifetime. Repeated complete
captures therefore cannot keep unused snapshot directories alive.

`demand/baseline.ts` owns baseline preparation and its cancellation drain,
independent of the content generations in `demand/generation.ts`.
It calls `review/prepare.ts` after adopting current output, then supplies the
pinned commit and accepted generated bytes to the classification worker.
`baselinePrepared(commit)` publishes the read capability before classification;
`baselinePrepared(null)` revokes it when the baseline commit/build settings
change, history becomes unavailable, or the server closes. A content edit or
a ref update with the same merge base reuses the preparation; only that
generation's classification wait is cancelled. Preparing survives content edits.
Each reference-observer session reuses a validated Git runner, avoiding a
redundant top-level lookup on every poll.
Shutdown cancels the current generation before draining preparation, preventing
an in-flight Git resolution from launching a replacement during the drain.
`demand/generation.ts` passes each generation's cancellation signal to its
output write, so a superseded generation or a closing Serve stops waiting for
the [generated-output writer lock](../../docs/protocol/mokly-rendering-generated.md#concurrent-writers)
that a concurrent Build or Serve writer holds.

Watched Serve sends the commit and selected reader (`blobs` or `rebuild`) on the
versioned `update` IPC envelope. Omission retains the reader; null revokes it. The child
uses `ServedReviewRepository` in `review_repository.ts` to open a confined cached
reader through `readOnlyRepositoryForCommit` / `baselineReaderForCommit` and
ignore stale versions. The single-process host uses the same holder directly.
The Serve parent selects the pinned baseline reader per commit, using the
historical manifest's presence and matching v9 inventory
or the rebuild cache. The child receives that selection; it neither
builds baselines nor writes output. `serve --build` writes in the parent only
after complete compilation and resource-watch readiness, including once with
`--no-watch`; plain Serve never writes output.
Only `check` consults the head Git index and guards `.mokly-cache/` tracking;
neither the Serve parent nor child needs tracked state to render or write.
That reader validates the configured Git top level on its first read, so the
unselected route reports `config-invalid` for a nested `repoRoot` while All
remains available. Parent preparation, classification and selected readers use
the same config-owned validation.

Both readers accept only manifest v9. Recognized earlier output follows the
successful unavailable behavior and single terminal line in the
[baseline compatibility contract](../../docs/protocol/mokly-baseline-compatibility.md).
`classification_result.ts` carries that expected typed outcome across the
background worker without converting it into a generic classifier failure;
unsupported newer or malformed v9 data keeps the normal safe diagnostic path.

`configured_review.ts` requires an injected `ReadOnlyReviewRepository` or a
`ReviewRepositorySource` that supplies the current reader. The full comparison
route fails with typed `review-invalid` ("The comparison is not prepared")
until a selected v9 reader is available. `selected_review_routes.ts` owns one
bounded generation service for screen/component comparisons and removed-page
previews. Pages use `review.json?page=<page-path>`, while screens and component
variants use `review.json?path=<entry-path>`; each redirects to immutable metadata
and serves only its captured `snapshots/before/**` closure. Both selection kinds
share coalescing, refresh, admission, timeout, byte, retention, epoch and
shutdown bounds. `review_sources.ts` derives selections only from accepted
evidence; identity, baseline commit and base ref must match the provider response.
Neither route can import or invoke a baseline builder. Preparing or unavailable
evidence returns the existing retryable failure while current routes remain
usable. Evidence updates invalidate selected generations and atomically clear
the public complete-comparison pointer and removed-screen descriptors.

Serve advertises `{ kind: "screen" }` only for a removed screen proven complete
in the pinned public comparison. It deliberately does not advertise page
descriptors: local pages remain selected through the stable private endpoint,
so ordinary navigation, filtering, search and catalogue reads perform no
historical capture.

The removed-preview controller and review validators are part of the shared
`react-shell.js` hydration bundle. Repository publication may add page
descriptors while externalizing captured shells; that artifact-only projection
does not change the live selected-page boundary.

`update_messages.ts` validates IPC envelopes. `supervisor.ts` orders delivery and
owns child shutdown. HTTP readiness precedes exhaustive compilation and baseline
preparation, so All remains usable while Changes is pending or preparing.
`controls/runtime_ipc.ts` encodes generated binary files as tagged base64 over
the watched child's JSON IPC channel and validates them in linear time before
a controls preview
serves raw bytes; text documents remain strings. It also carries the accepted
per-root stylesheet routes and CSS/asset outputs so child and background
recompilation reuse the original bytes instead of silently dropping them.
`demand/http.ts` answers on-demand `/static/` stylesheet and image/font
requests from the accepted generation's CSS or opaque bytes (including HEAD),
before ordinary public-file serving can see an older reserved file on disk.
All Serve hosts use accepted generated bytes from a retained runtime or an
explicit in-memory compilation. Syntactically valid strays on disk remain 404.
Watched children receive the same generation; no path reads reserved disk
output as a fallback.
`DocumentCompiler` validates the same pending resources before any HTML view
is delivered; superseded generations never become resource fallbacks.
The classification worker uses
structured-clone byte transfer instead of JSON.
The CLI injects the terminal reporter's server-facing subset into both Serve
compositions. Plain mode emits only the historical readiness and diagnostic
bytes. Rich mode presents accepted catalogue, baseline, Changes, reference, and
watch-action boundaries. Diagnostics originating in a supervised child cross a
validated IPC message so the parent remains the sole terminal owner; a child
without IPC retains direct diagnostic output. A generation's
[build warnings](../../docs/protocol/mokly-build-warnings.md) arrive on the
background compilation result through the existing structured clone.
`reportCatalogueReady` reports them once before `Catalogue ready` for watched
and snapshot Serve. On-demand documents retain diagnostics for parity but never
print or expose them through HTTP.

The [referenced asset closure](../../docs/protocol/mokly-generated-output.md#closure-urls-and-publication)
is the only authored public surface: generated routes live
under `mokly-generated/`, referenced assets remain catalogue-relative, and unreferenced
requests return 404. Manifest/cache privacy, realpath confinement and authoring
inputs remain protected now.

When controls are active, every Serve request uses the
[Host contract](../../docs/protocol/mokly-component-controls.md#request-and-lifecycle-rules):
accept only `localhost:<port>` or `127.0.0.1:<port>` with an explicit decimal
port from 1 to 65535, without a leading zero. A non-loopback Host returns 403
for the whole catalogue, including ordinary pages and static assets. A forwarded
local port may differ from the listening socket port. Render POST Origin must
equal `http://` plus Host exactly and the render token is still required.
Preview GET/HEAD uses Host and its authenticated render id; it does
not require the POST token or Origin. Non-loopback hosts and `x-forwarded-*`
headers grant no access; invalid required authorization returns 403.

`packages/viewer/src/shell/usage_links.ts` deduplicates the shared
served/published Affected list
using complete serialized-link identity, keeping the first occurrence in evidence
order and serializing each input only once. Distinct usage contexts retain their
comparison eligibility; deduplication does not alter Changes membership.

Route and live-evidence reads return ordinary scoped shell pages. The client
adopts a page's scoped catalogue and optional complete private workspace
atomically, replacing the prior route scope. Failed current reads expose
retryable Usage rather than a partial or zero-consumer list. See the
[bootstrap contract](../../docs/protocol/mokly-shell-bootstrap.md).

Run the server tests with `npm test` and the navigation/comparison smoke tests
with `npm run test:browser`. `tests/derived_child_repository.test.ts` covers revocation,
reader replacement and the transitive child-module boundary; `derived_serve`
tests exercise both parent compositions.
Imported-CSS watcher tests use `tests/helpers/watched_events.ts` to attach to the
event stream before editing and wait for the expected resource bytes after a
higher update version. Evidence-only updates and intermediate content versions
do not prove that the final CSS is served; the wait reports the last version,
status and resource excerpt if the expected bytes never arrive. Its direct tests
(`tests/watched_resource_wait*.test.ts`) cover reconnects, the startup retry,
the deadline on an open stream and repeated updates on one stream. Tests that
use the real file watcher accept in-between states on purpose, so ordering
guarantees need deterministic tests.
`tests/watched_content_resource_order.test.ts` checks that an accepted
stylesheet is installed before its content update is announced in two layers:
one in-process server, and watched Serve's parent and real child, where a
watcher that the test controls reports one CSS edit that rebuilds in place.
Worker-exit tests wait for the watch failure report before checking shutdown;
Serve startup is not subject to the worker-request timeout.

See [review boundaries](../review/README.md), [baseline building](../baseline/README.md),
and the [derived baseline protocol](../../docs/protocol/mokly-derived-baselines.md).

Snapshot validation reuses the compilation associated with an accepted manifest
when its effective configuration matches. A fresh in-memory compilation already
provides its source inventory; supplied manifests retain the independent freshness
check. This avoids a second PostCSS pass merely to recover accepted head bytes.

The implemented [shared closure](../../docs/protocol/mokly-public-closure.md)
replaces the separate Watch list with checked serving membership. Serve still
rechecks each listed file without following symlinks. The approved
[shared watch setup](../../docs/protocol/mokly-watch-writers.md) will also supply
`build --watch`, including initial edits and interruptible lock waits.

`watch_resources.ts` uses Build's closure builder. Invalid recovery edges can
keep a confined path observable but cannot grant HTTP access. The resource
watcher retains the previous checked closure on failure. Static and transient
reads use `PublicFilePolicy.read`, which rechecks components and the open file
without following symbolic links.

The approved [path/output integration](../../docs/protocol/mokly-path-output-integration.md) keeps path identity, folders,
Markdown documents and moves inside one generated tree. It introduces manifest
v9, catalogue v5 and review v6, with explicit versions for the other boundaries.
Accepted workers use immutable in-memory route sets; only writing commands
acquire the output lock. The integration plan records verification and scope.

`generated_static.ts` resolves and snapshots the accepted CSS and asset inventory
at startup. `config/root_membership.ts` owns file exclusions used by watch discovery;
protection still covers excluded matches.

Accepted runtimes carry the immutable output route set checked in memory during
generation preparation. Demand and background workers reuse
that private proof instead of taking a filesystem snapshot during a write.

Markdown documents use the page route and demand compiler, with one route per
scheme. Their copied assets come from the accepted in-memory generation even
before background writes complete. Source and resource edits rebuild together.

Document Changes follows declared attachment links as well as rendered media.
The shared resource graph uses normalized HTML so ignored regions remain excluded.
