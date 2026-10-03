# Serving catalogues

Serve publishes a validated catalogue, renders requested documents and exposes
comparison snapshots. `serve.ts` owns single-process Serve; `serve_watched.ts`
owns watchers, background work and the supervised HTTP child. `http.ts` and
`child.ts` serve accepted inputs and never prepare historical baselines.
`http_request_handler.ts` isolates per-request routing from the server's
mutable catalogue and evidence lifecycle.
`component_change_cache.ts` coalesces accepted classification reads across
the server's content generations.
`watch_inventory.ts` refreshes exact watch inputs before watcher attachment.
`http_shutdown.ts` stops HTTP admission, ends live-update streams, and disconnects
open clients before draining every owned service. Incomplete request headers or
unfinished responses cannot keep shutdown waiting for the browser.
`watch_events.ts` owns classification, gating and debounce;
`watch_action_queue.ts` serializes event work and keeps progress across queued actions;
`watch_paths.ts` owns watch roots and pruning, including entry-glob traversal
boundaries that retain each stable prefix without exempting its ignored
descendants. Discovery and watching share one denied-directory policy below the
relevant glob root: traversal uses the deepest containing root, and entry-file
classification uses the deepest matching root. The glob itself defines every
entry-file shape that can trigger rediscovery. Traversal also skips
`review.outDir`. Generated output, Review and cache outrank exact required
inputs; denied directory names only prune broad discovery and directory scans.
Logical and physical aliases share these distinct reasons. A denied leaf's
directory status comes from watcher stats, else its event kind, else one stat
that treats any error as a file.
`watch_index.ts` caches the exact required inputs and their ancestors once per
accepted config. `watchTargets` drops individually covered files when an entry
glob, PostCSS directory or watch-rule root already watches them, except
required files below a skipped directory segment. Those remain explicit
targets and their arrival replaces the watcher; ordinary covered files do not.
Physical event paths
under a symlinked repository root map back to configured logical paths.
`addDir` and `unlinkDir` identify directories; `add`, `change`, and `unlink`
identify files. Supplied stats avoid that stat, but traversal still reads export
markers and ownership headers. Deleted matched files rebuild even when named
`target`; existing and removed denied directories outrank user watch rules.
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

GET/HEAD `/__mokly/catalogue.json` returns the public v3
[read model](../catalogue/README.md) as complete JSON with
`Cache-Control: no-store`; it never contains bootstrap-only omitted usage.
`public_catalogue.ts` serializes an atomic snapshot when accepted content,
background usage/Changes or actual on-demand view records arrive. Requests only
read the retained bytes. Content revisions follow accepted content versions;
evidence revisions advance independently. Failed candidates preserve the last
snapshot, and superseded generations cannot replace it. `catalogue_update.ts`
prepares updates before publication; `http_types.ts` owns the lifecycle types.

Entry shells are served at canonical `/view/<kind-prefix>/<id>.html` and the
matching provider-normalized `/view/<kind-prefix>/<id>` path; both return the
same 200 shell when the identity exists, while generated links stay canonical.
ID-alias paths receive the ordinary not-found shell and are never redirected.

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

Watched Serve sends that commit as `baselineCommit` on the existing versioned
`update` IPC envelope. Omission retains the reader; null revokes it. The child
uses `ServedReviewRepository` in `review_repository.ts` to open a confined cached
reader through `readOnlyRepositoryForCommit` / `baselineReaderForCommit` and
ignore stale versions. The single-process host uses the same holder directly.
Committed mode can open a Git-blob reader locally, without preparation.
That reader validates the configured Git top level on its first read, so the
unselected route reports `config-invalid` for a nested `repoRoot` while All
remains available. Parent preparation, classification and selected readers use
the same config-owned validation.

Both readers accept only manifest v7. Recognized earlier output follows the
successful unavailable behavior and single terminal line in the
[baseline compatibility contract](../../docs/protocol/mokly-baseline-compatibility.md).
`classification_result.ts` carries that expected typed outcome across the
background worker without converting it into a generic classifier failure;
unsupported newer or malformed v7 data keeps the normal safe diagnostic path.

`configured_review.ts` requires an injected `ReadOnlyReviewRepository` or a
`ReviewRepositorySource` that supplies the current reader. The full comparison
route fails with typed `review-invalid` ("The comparison is not prepared")
until a derived reader is available. `selected_review_routes.ts` owns one
bounded generation service for screen/component comparisons and removed-page
previews. Pages use `review.json?page=<page-id>`, while screens and component
variants use `review.json?id=<entry-id>`; each redirects to immutable metadata
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
owns child shutdown, while `supervisor_types.ts` owns the shared supervised-child
state and injected runtime contracts. HTTP readiness precedes exhaustive compilation and baseline
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
Committed Serve without a runtime derives the exact output route set from the
inventory-only graph and snapshots only those disk bytes; syntactically valid
strays in the reserved tree remain 404 even before startup. Derived Serve and
watched children use retained runtime bytes, never reserved disk fallbacks.
`DocumentCompiler` validates the same pending resources before any HTML view
is delivered; superseded generations never become resource fallbacks.
The classification worker uses
structured-clone byte transfer instead of JSON.
The CLI injects the terminal reporter's server-facing subset into both Serve
compositions. Plain mode emits only the historical readiness and diagnostic
bytes plus the optional Live-origin announcement. Rich mode presents accepted catalogue, baseline, Changes, reference, and
watch-action boundaries. Diagnostics originating in a supervised child cross a
validated IPC message so the parent remains the sole terminal owner; a child
without IPC retains direct diagnostic output.

Watched Serve owns rebuild status in `rebuild_status.ts`, behind the
`WatchRebuildStatus` interface. The serialized action queue keeps progress true
across qualifying queued and running actions. `watch_action_outcome.ts` gives
every action a typed result and splits rebuild/reconfigure at runtime adoption:
pre-adoption configuration, graph, validation and invalidation failures replace
the browser failure, while post-adoption child delivery and watcher replacement
failures remain terminal-only. Adoption clears an existing failure before a
live update, restart/recovery, or previous-watcher close can fail, including the
rebuild path that discovers new watch targets and reconfigures. Failure detail
is normalized, stripped of terminal escapes, made repository-relative and
bounded before publication. The supervisor retains each complete snapshot
independently of its child and sends the exact validated `rebuild-status`
envelope during every startup transfer.
`rebuild_status_state.ts` stages future-fenced snapshots in the child until the
matching update version commits, then the HTTP server exposes the snapshot only
through the private capability descriptor and replayable `rebuild` SSE event.
Unwatched Serve, public catalogue JSON and static evidence never receive it.

When `interactive: "serve"` is resolved, `http_interactive.ts` composes a
second loopback listener through the `InteractiveServer` factory after the app
port is known. It defaults to app port plus one, or an OS-selected port when
the app owns 65535, supports an explicit start, and shares public
`--strict-port` behavior with the app listener. In watched Serve the HTTP child owns both listeners and reports the
resolved Live port in its readiness message, so the supervisor can bind both
strictly on later restarts. `http_shutdown.ts` closes the interactive service
beside documents, controls, Review, event streams, and the app listener.

Each accepted Serve-mode runtime carries the repository source bytes captured
by its Node consumer graph. Watched IPC validates their canonical base64 wire
projection; the child retains only current and previous captures with their
Live bundle states, while the supervisor retains only the current runtime for
recovery. Browser compilation uses the capture for repository modules and
continues to resolve installed packages from disk. Retiring a third generation
aborts any obsolete in-flight compiler before its capture is released.

The Live listener never owns shell routes. The app listener puts
`{ generation, port, origin?, state }` only in its private capability descriptor
and interactive SSE events, and exposes the private current-generation prepare
POST. That POST requires Origin to equal `http://` plus its accepted loopback
Host exactly. Public catalogue JSON and exports receive none of this state. The Live
listener itself serves the exact document, public-file, bundle, diagnostic, and
inspector allowlist described by the
[interactive Serve delivery contract](../../docs/protocol/mokly-interactive-views-serve.md).
Eligibility precedes lazy bundle work; the current `ComponentRuntime.generation`
binds the document, bootstrap, bundle, diagnostics, and descriptor.

For a current screen or component route, the same private descriptor's
workspace contains one `interactive` boolean resolved from the current
`ComponentRuntime.interactiveEntries` map. It remains available when background
completion replaces the live index with a full manifest and when watched Serve
installs a replacement runtime. If a routed id is absent from the map, Serve
reports it once per entry and generation but omits the value and still returns
the Static page; unknown eligibility never enables Live. The route-scoped
scalar is removed from the nested entry and never enters public catalogue JSON,
static workspace evidence, export or publication.

The [public-exclusion policy](../../docs/protocol/mokly-source-protection.md#public-exclusions)
adds config-owned `publicExclude` globs to the shared source classifier.
Case-insensitive README/tsconfig defaults remain when consumers add globs.
Serve HTTP, generated-resource validation, Review reads, static export and
public content-change classification test both candidate and realpath-alias
paths relative to `mockupsDir`. Excluded requests return 404; excluded edits are
not public content evidence, and exclusion alone never adds `sourceFiles`.
Manifest/cache privacy and independently discovered authoring inputs remain protected.
Screen-level resource classification shares Review's verified-deletion decision,
so committed and derived runs agree without weakening these path checks.

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
status and resource excerpt if the expected bytes never arrive. A server-level
test checks that an accepted stylesheet is installed before its content update
is announced. Worker-exit tests wait for the watch failure report before
checking shutdown; Serve startup is not subject to the worker-request timeout.

See [review boundaries](../review/README.md), [baseline building](../baseline/README.md),
and the [derived baseline protocol](../../docs/protocol/mokly-derived-baselines.md).
