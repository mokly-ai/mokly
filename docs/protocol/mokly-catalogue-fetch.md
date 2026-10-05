# Catalogue Read Model Fetch Rules

## Delivery Status

Implemented. This contract is split from the
[public catalogue read model](./mokly-catalogue.md) and keeps the serving and
fetch rules for `__mokly/catalogue.json` and the files it points at. The read
model's shape, projection, and versions stay in that contract.

## Serve And Fetch Rules

Serve uses `Cache-Control: no-store` and live-index metadata, with pending usage
until real view/background records arrive. GET never triggers Git or rendering.
Revisions are nonnegative safe integers: content
advances on accepted content, evidence on accepted usage/Changes updates. Each
response is one atomic snapshot; failed candidates retain the last good content.
Watched notifications refresh that snapshot. Evidence-only refresh preserves
frames, focus, valid snapshot selection, scrolling and local edits; a changed
baseline invalidates the selected snapshot without falling back to current
content. Content changes otherwise follow the existing reload lifecycle. Serve hashes the canonical public snapshot with its
`deploymentId` zeroed; it is not a static artifact attestation.
Live comparison URLs stay null until a matching immutable generation exists;
Serve's existing explicit comparison integration prepares it and refreshes the
model without moving that work onto catalogue GET or altering local controls.

Only a complete comparison can supply this catalogue-wide pointer; selected-only
generations leave it null. A matching complete live generation gains a
content-addressed alias while retaining its existing local URL. Public aliases
serve their retained generation directly, return 404 when unavailable, and never
redirect or generate work. Superseded completions cannot set the pointer.
Alias bookkeeping never renews a generation's idle retention window; only an
actual retained-generation read renews it. Unused generations expire even when
complete captures continue.

Public paths are `__mokly/catalogue.json`, `static/**`,
`__mokly/client/**`, `__mokly/shell.css`, `__mokly/fonts/**`, and immutable
comparison generations under `__mokly/diffs/__generations/**`. These retain
normal path confinement; this list grants no source, controls or watcher access.
For removed entries and comparisons, the viewer fetches validated HTML beneath
the advertised generation's permitted `snapshots/before/` and `after/` trees
instead of framing artifact URLs. Those responses require `text/html`, CORS,
and the same `nosniff` treatment as other generation files.
Same-origin clients need no CORS header. A cross-origin artifact host must send
`Access-Control-Allow-Origin: <exact app origin>` and
`X-Content-Type-Options: nosniff` on these responses (including errors and HEAD),
with correct MIME types. No wildcard origin, cookies, authorization headers or
credentials are used; fetch uses `credentials: "omit"`. Send `Vary: Origin`
when selecting an allowed origin dynamically. Hosts retain the revalidation and
comparison no-store rules in [static delivery](./mokly-export-delivery.md).
Use ordinary GET/HEAD without custom headers; reject redirects outside the
configured source origin. URL sources are HTTP(S), without userinfo or fragment.
Host header configuration is external; export cannot make a server enable CORS.
