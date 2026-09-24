# Serving catalogues

Serve publishes a validated catalogue, renders requested documents and exposes
comparison snapshots. `serve.ts` owns single-process Serve; `serve_watched.ts`
owns watchers, background work and the supervised HTTP child. `http.ts` and
`child.ts` serve accepted inputs and never prepare historical baselines.
`http_shutdown.ts` stops HTTP admission, ends live-update streams, and disconnects
open clients before draining every owned service. Incomplete request headers or
unfinished responses cannot keep shutdown waiting for the browser.
`watch_events.ts` owns classification and serialized event handling;
`watch_paths.ts` owns watch roots and pruning, including entry-glob traversal
boundaries that retain each stable prefix without exempting its ignored
descendants. Discovery and watching share one denied-directory policy below the
relevant glob root: traversal uses the deepest containing root, and entry-file
classification uses the deepest matching root. The glob itself defines every
entry-file shape that can trigger rediscovery. Traversal also skips
`review.outDir`. A denied leaf's directory status comes from watcher stats,
and a shared logical-and-physical package-owned check rejects alias events
for generated files, Review output, cache and denied trees before any rebuild
or directory-dependency glob classification. A symlink cannot re-enable a
package-owned path through a watch rule.
else from its event kind, else from one stat that treats any error as a file.
`addDir` and `unlinkDir` identify directories; `add`, `change`, and `unlink`
identify files. Supplied stats avoid that stat, but traversal still reads export
markers and ownership headers. Deleted matched files rebuild even when named
`target`; existing and removed denied directories outrank user watch rules.
Resource notifications coalesce by path with the latest descriptor.
PostCSS directory-dependency roots join the package-owned watch targets after
graph inventory. New regular files matching each reported glob (or `**/*`
when absent) rebuild; edits to reported files rebuild, and local PostCSS
configuration imports reconfigure before rebuilding. Ignored generated output
and denied directories do not trigger a rebuild through directory globs.
Discovery skips `review.outDir`, denied directories, and directories that vanish
or are replaced mid-walk (`ENOENT` or `ENOTDIR`). Zero-match messages list denied
and vanished paths together, including modules dropped during validation. Other
read or projection failures report
`config-invalid` with the repository-relative path and error code. Discovery
projects repository and glob roots once per pass; Review output alone uses a
lexical fallback if its projection fails. Source notifications
are isolated at the gate: classifier failures are reported, that notification
is dropped, and later notifications continue through the same watcher.

GET/HEAD `/__mokly/catalogue.json` returns the public v1
[read model](../catalogue/README.md) as JSON with `Cache-Control: no-store`.
`public_catalogue.ts` serializes an atomic snapshot when accepted content,
background usage/Changes or actual on-demand view records arrive. Requests only
read the retained bytes. Content revisions follow accepted content versions;
evidence revisions advance independently. Failed candidates preserve the last
snapshot, and superseded generations cannot replace it. `catalogue_update.ts`
prepares updates before publication; `http_types.ts` owns the lifecycle types.

Shell pages render through `@mokly/viewer/server` with CLI-owned live context.
`public_catalogue_model.ts` validates each serialized public revision once and
reuses it across shell requests until the bytes change. CSS, browser modules,
fonts, events and static documents bypass that decoding entirely.
`client_modules.ts` reads the generated viewer and CLI browser manifests,
requires exact equality with their build directories, rejects missing,
non-JavaScript, unexpected or colliding outputs, and loads the complete delivery
inventory before binding. The manifests are emitted from actual completed
esbuild outputs rather than maintained by hand. Every shell request renders the
hydrated React document and loads the canonical `react-shell.js` browser entry.
The CLI host modules retain private live-update and capability transports.

`screen_view_changes.ts` retains per-view screen-only material decisions from
the existing classification pass. The public projection does not infer Changes
membership from visual comparisons or invent empty usage for unfinished views.
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

`configured_review.ts` requires an injected `ReadOnlyReviewRepository` or a
`ReviewRepositorySource` that supplies the current reader. The full comparison
route fails with typed `review-invalid` ("The comparison is not prepared")
until a derived reader is available. `selected_review_routes.ts` owns one
bounded generation service for screen/component comparisons and removed-page
previews. The latter uses
`review.json?page=<encoded-route>`, redirects to an immutable `preview.json`,
and serves only its captured `snapshots/before/**` closure. Both selection kinds
share coalescing, refresh, admission, timeout, byte, retention, epoch and
shutdown bounds. `review_sources.ts` derives selections only from accepted
evidence; route, baseline commit and base ref must match the provider response.
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
the watched child's JSON IPC channel and decodes them before a controls preview
serves raw bytes; text documents remain strings. It also carries the accepted
per-root stylesheet routes and CSS/asset outputs so child and background
recompilation reuse the original bytes instead of silently dropping them.
`demand/http.ts` answers on-demand `/static/` stylesheet and image/font
requests from the accepted generation's CSS or opaque bytes (including HEAD),
before ordinary public-file serving can see an older reserved file on disk.
`DocumentCompiler` validates the same pending resources before any HTML view
is delivered; superseded generations never become resource fallbacks.
The classification worker uses
structured-clone byte transfer instead of JSON.
The CLI injects the terminal reporter's server-facing subset into both Serve
compositions. Plain mode emits only the historical readiness and diagnostic
bytes. Rich mode presents accepted catalogue, baseline, Changes, reference, and
watch-action boundaries. Diagnostics originating in a supervised child cross a
validated IPC message so the parent remains the sole terminal owner; a child
without IPC retains direct diagnostic output.

The [public-exclusion policy](../../docs/protocol/mokly-source-protection.md#public-exclusions)
adds config-owned `publicExclude` globs to the shared source classifier.
Case-insensitive README/tsconfig defaults remain when consumers add globs.
Serve HTTP, generated-resource validation, Review reads, static export and
public content-change classification test both candidate and realpath-alias
paths relative to `mockupsDir`. Excluded requests return 404; excluded edits are
not public content evidence, and exclusion alone never adds `sourceFiles`.
Manifest/cache privacy and independently discovered authoring inputs remain protected.

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

`shell/usage_links.ts` deduplicates the shared served/published Affected list
using complete serialized-link identity, keeping the first occurrence in evidence
order and serializing each input only once. Distinct usage contexts retain their
comparison eligibility; deduplication does not alter Changes membership.

Run the server tests with `npm test` and the navigation/comparison smoke tests
with `npm run test:browser`. `derived_child_repository.test.ts` covers revocation,
reader replacement and the transitive child-module boundary; `derived_serve`
tests exercise both parent compositions.

See [review boundaries](../review/README.md), [baseline building](../baseline/README.md),
and the [derived baseline protocol](../../docs/protocol/mokly-derived-baselines.md).
