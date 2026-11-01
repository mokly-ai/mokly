# Shell Fetch And Fences

This page supplements the [shell delivery contract](./mokly-shell-delivery.md)
with the rules that fetch the read model and fence each entry detail.

## Fetch And Fences

At start the shell fetches the index, then the routed entry's detail. A current
component variant also needs its parent's detail. A use case also needs the
detail of each step screen whose views its frames show. The navigation renders
when the index arrives. The stage, Props, and Usage wait for all route details.
The shell does not request the deployment file on the first load. On navigation
inside the shell it commits the route from the index at once and fetches the
destination's details. A static catalogue requests
`mokly-viewer/deployment.json` with each detail request from that in-shell
navigation, and before it opens a comparison or a removed entry. An embedded
viewer makes this request only when it fetched the index from a URL. Each check
uses the catalogue origin root. An unreadable or missing deployment file
changes nothing.

The separate deployment file checks old static tabs, so unchanged details keep
their bytes across deployments. The rejected record-and-detail id misses
viewer-only deployments and removed comparisons.

The shell checks every current route detail, including a variant's parent
detail, in this order: `revision`, then `detailId`, then identity and content.
Revision comes first because newer Serve details have new ids. A revision
mismatch refetches the index once. If the revision still disagrees, the entry
shows its unavailable state with retry. If the revision matches but the
`detailId` differs, the detail has the replaced status in a static build and in
Serve. The standalone shell performs a full page load, and an embedded host
receives one `onError` and keeps its state. From then on the shell loads no
index or detail, closes the event stream, and reports no later failure. An
identity or content mismatch leaves the entry unavailable with retry. A route
shows that state only after each of its details has arrived, failed, or been
replaced. Until then its stage keeps loading, and an embedded host still
receives the `onError` of each failure at once. A failed parent detail makes
the variant page unavailable with `Try again`. Separate delivery for Usage was
rejected because it adds delivery state without reducing the first load's data.
A route that still waits for a detail has the replaced delivery status: in both
hosts its stage keeps the loading state, never the unavailable state, until the
new data arrives with the full page load or the `index` that the host supplies.
A route whose details all arrived keeps them. A removed detail is accepted only
when `identity` equals the index, its path selects the index's removed record,
and `snapshotId` and `detailId` equal that record. Held details stay installed
when a new index lists the same `detailId`; a current detail also keeps its
`revision`.

Every fetch uses ordinary GET without custom headers and `credentials: "omit"`.
URL sources use HTTP(S) without userinfo or fragments. Fetches stay same-origin
and reject cross-origin redirects. Serve JSON uses `Cache-Control: no-store`.
Static hosts may cache the immutable index and details under the [static revalidation rules](./mokly-export-delivery.md#headers-caching-and-revalidation).
The shell keeps the index and the details for the page's lifetime.

## Fail-Closed Rules

| Condition                                                                                                                                                                                                                                                             | Shell behaviour                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| an index, detail, or live descriptor with another `schemaVersion` of the [format inventory](./mokly-format-versions.md)                                                                                                                                               | the version error state of the [viewer namespace](./mokly-viewer-namespace.md) contract                                 |
| an index or an event message with another `deploymentId`, or a current detail whose `detailId` differs from the index record at the same revision                                                                                                                     | a full page load in the standalone shell; one `onError` and a loading stage in an embedded host                         |
| a static deployment file with another `deploymentId`                                                                                                                                                                                                                  | a full page load in the standalone shell; one `onError` in an embedded host                                             |
| a missing or unreadable static deployment file                                                                                                                                                                                                                        | no change                                                                                                               |
| a detail or a publication refresh that fails after another `deploymentId` answered                                                                                                                                                                                    | the replaced status: the stage keeps its loading state, and the failure is not reported                                 |
| a live descriptor that fails while the index carries `live`                                                                                                                                                                                                           | browsing works; live prop editing shows `Editing could not start.` with `Try again`, which fetches the descriptor again |
| a current route detail whose identity or revision differs from the index after one refetch, a removed entry's detail whose identity, snapshot id, or `detailId` differs from the index, or a JSON route that redirects outside the origin, has another type, or fails | the entry's unavailable state with retry after every route detail arrived, failed, or was replaced                      |
| a current component variant's parent detail that fails or is rejected under those rules                                                                                                                                                                               | the same unavailable state for the variant page, with `Try again`, after both details settle                            |
