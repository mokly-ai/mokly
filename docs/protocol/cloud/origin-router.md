# Origin Router

The Cloudflare Worker gives the marketing site and Mokly application one public
origin. `D` is the app/API zone apex (`mokly.ai` in production). The Worker
selects Pages or the app origin; it does not deploy or render either workload.
The [architecture doc](../../architecture/cloud.md) places it in front of the public
origin only.

## Routes And Ownership

Wrangler binds exactly two routes:

| Route           | Ownership                                                   |
| --------------- | ----------------------------------------------------------- |
| `D/*`           | Production site pass-through or app proxy, selected by path |
| `*.preview.D/*` | Preview app proxy for every path                            |

`apps/worker` owns the script, the plain-text `DOMAIN` binding and both routes by
app/API zone ID. The deploy workflow applies them on configured pushes and
manual dispatches from `main`. Terraform owns neither edge resource.
Foundation Terraform owns the
supporting `*.preview.D` and `*.preview.api.D` proxied A records on the shared
regional preview address and the shared Advanced Certificate Manager pack.
Stable environment records belong to their environment state.

Once cloud image publication is configured, the Worker account, token, domain
and zone are all required. A missing value stops promotion before the
main-preview Terraform plan, so DNS cannot move to Worker-dependent hosts while
the router is absent. Only a repository with cloud deployment wholly
unconfigured may accept the explicit Worker skip.

The Worker token is a Secret Manager version under the protected
`mkc-cloudflare-worker-token` ID. Only the GitHub deploy service account can
access it, after GCP verifies the repository IDs and `deploy.yml` workflow ref
on `refs/heads/main`. The token reaches only the Wrangler deployment and is
discarded when Wrangler finishes. No repository secret contains the token, so
selecting a different branch for `workflow_dispatch` cannot expose it by
changing that branch's workflow definition.

On production, the exact root, a path whose first segment belongs to the site,
and `/.well-known/acme-challenge/…` pass through unchanged to Cloudflare Pages.
Every other path proxies to the app origin. The site, the Worker and the
reserved workspace names share one route inventory. A new site route must
land in that inventory before release so a workspace cannot claim it and
the Worker cannot send it to the app. Only the production apex is shared: a PR
site preview keeps its `pr-N.mokly-site.pages.dev` Pages alias and an app
preview is `<label>.preview.D`, because every same-repository pull request
gets a site preview while only a labelled one gets an app preview, so the two
cannot be assumed to exist together.

Every preview path goes to the app. Preview hosts have no Pages pass-through or
synthetic outside-app document. Unmatched app routes render the single-page
Mokly not-found state with one `/dashboard` recovery action and no product-data
read; the reserved `/_sitemap` address renders that same state. The Worker does
not duplicate the app's route table. A
matched workspace or project route whose resource is unknown or inaccessible uses the authorized recovery in
[Product navigation](./product-navigation.md). Production paths outside the
site segments use those same app rules; a missing path beneath a site segment
uses the site's own 404.

## Preview Labels And Origins

A preview host is exactly `<label>.preview.D`. Accepted labels are:

- `pr-N`, where `N` is a positive decimal of at most nine digits without a
  leading zero, mapping to `app-origin-pr-N.preview.D`.
- `br-<branch>`, where the whole DNS label is at most 63 characters and the
  branch part contains lowercase ASCII letters, digits and interior hyphens,
  mapping to `app-origin-<branch>-preview.D`.

Production maps `D` to `app-origin.D`. Matching is case-sensitive after URL
hostname normalization. Empty, extra, Unicode or underscore labels and invalid
numbers are rejected without an origin request. A valid but unprovisioned PR still resolves through the foundation wildcard and
returns ingress-nginx's default-backend 404. A valid branch label whose
first-level internal record is absent receives the router's no-store 404. Neither
case falls through to the production site.

| Public host             | Internal app-origin host        |
| ----------------------- | ------------------------------- |
| `D`                     | `app-origin.D`                  |
| `br-<branch>.preview.D` | `app-origin-<branch>-preview.D` |
| `pr-N.preview.D`        | `app-origin-pr-N.preview.D`     |

Stable internal hosts are proxied first-level records covered by Universal SSL,
GCE ingress and the environment's Origin CA certificate and Cloud Armor. The PR
internal host is beneath `*.preview.D`; the foundation wildcard and shared edge
pack cover it, and ingress-nginx uses the shared Origin CA default certificate.
Nothing in the site, app, API, email, provider registration or user-facing
responses links to an internal hostname.

The PR internal host matches the wildcard Worker route but has the unsupported
label `app-origin-pr-N`. Direct browser requests, including the health path, get
the router 404 without a fetch. A public PR request uses a same-zone subrequest;
Cloudflare sends it to the origin without re-entering the Worker.

## Requests And Responses

The exact `/_router-health` path returns `200`, body `ok` as
`text/plain; charset=UTF-8`, `Cache-Control: no-store`, and no origin request.
On preview it also carries `X-Robots-Tag: noindex`.

Site pass-through preserves the complete request and Pages response. App proxy
requests preserve method, path, query, headers and body; set
`X-Forwarded-Host` to the public host and `X-Forwarded-Proto` to `https`; and
let the fetch runtime set `Host` for the selected internal origin. App-origin
subrequests disable Cloudflare caching with a negative cache TTL for every
status, so the origin's `Cache-Control` reaches the client untouched. A zero
TTL is rejected because it caches with an immediate expiry and rewrites
`Cache-Control` to the zone browser TTL, which strips `immutable` from hashed
assets and makes browsers hold the app document for hours. The Worker streams
status and bytes without parsing HTML.

Absolute or scheme-relative internal-origin targets in `Location`,
`Content-Location` and each angle-bracket target in `Link` are rewritten to
`https` and the public request host, preserving path, query and fragment.
Relative and unrelated targets remain byte-for-byte unchanged. On preview, the
Worker replaces any `X-Robots-Tag` value with `noindex` on health, proxy and
error responses. It does not alter `Content-Security-Policy`, `Cache-Control`,
`Content-Type`, `Set-Cookie` or other app headers.

A missing PR namespace returns ingress-nginx's HTTP 404 through the proxy. Its
body, status and headers pass through with preview `noindex`; the Worker does not
substitute its synthetic response. A fetch-resolution failure for a disposable
origin becomes the router 404. A reachable origin's HTTP response never does.
Synthetic 404s have an empty body, `text/plain; charset=UTF-8`,
`Cache-Control: no-store`, and preview `noindex` where applicable. See
[PR previews](./pr-preview-environments.md) for ownership and TLS.

The Worker holds no secret, sets no cookie, authenticates no reader and calls no
API. Its only runtime value is `D`; Wrangler also receives the zone ID while
attaching routes. The [deployment smoke checks](./deployment-smoke-checks.md)
prove both origins, whole-host preview proxying and the preview indexing
boundary after every rollout.
