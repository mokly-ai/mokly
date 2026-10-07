# Comparison Generation And Serving

## Delivery Status

Implemented. This document is split from
[Changes and screen comparisons](./mokly-changes-serving.md#generation-and-serving) and
owns on-demand comparison generation in development and packaged comparisons
in published catalogues. The
[path identity plan](../../plans/path-identity.md) changes none of these rules
beyond the path-derived snapshot names they reference.

## Generation And Serving

The comparison engine's ownership and ignored-region rules remain in force.
Review configuration selects the Git base, snapshot directory, and commands
for derived baselines. `serve --base` and `export --base` override that base.

The [consumer static export](./mokly-export.md) reuses the comparison engine
and result schema of the [Changes contract](./mokly-changes-serving.md#comparison-engine).
Its [static delivery contract](./mokly-export-delivery.md)
defines direct generation URLs without requiring a hosting-provider redirect;
the server and repository adapter retain their stable redirect for compatibility.

The development shell requests `/mokly-viewer/diffs/review.json` for the selected
entry on demand, following the
[selected comparison contract](./mokly-selected-comparisons.md). The response
redirects to an immutable generation; snapshot URLs resolve relative to that
response URL. No standalone HTML report or navigation payload is generated.
Only comparison JSON and snapshot files are served through this private route.
Before changing an open comparison's view or diff mode, the browser renews its
generation with HEAD. A missing or replaced generation is reacquired for the
same selection before new panes load; retained results reuse their loaded JSON.
Development responses disable caching. Refresh requests and watched invalidation reuse
the generation queue, retaining superseded snapshots briefly for in-flight
requests and draining active work before shutdown.

Published catalogues retain the same All / Changes navigation and screen controls.
Publishing generates one validated Git comparison in a private staging directory,
then packages its JSON and complete before/after snapshot trees under the resolved
generation path. Static shell metadata addresses that generation directly; the
repository adapter also retains the stable JSON redirect. The same client
resolves relative snapshot and resource URLs without a live server.
Snapshot HTTP responses disable caching and MIME sniffing. Diagnostic summaries
and internal ownership markers are not published.

No comparison data or snapshot document is requested until a user selects a diff
or opens a removed entry. Refresh and retry fetch the currently published
comparison; only publishing a new
artifact updates the underlying snapshots. Removed entries retain their Changes
rows and previous-version pages. Comparison failure aborts publishing
transactionally and preserves the previous artifact, except that recognized
earlier baseline output completes with Changes unavailable under the
compatibility contract. Publishing never
writes to a running development server's configured comparison directory.
