# Mokly Cloud Origin Router

`@mokly-cloud/worker` is the Cloudflare Worker that gives the marketing site
and the Mokly application one public origin. It runs on the app/API zone apex
and on every `*.preview.<domain>` host, passes the site's declared paths
through to Cloudflare Pages in production, and proxies every other path to the
environment's internal app workload. Depend on this npm workspace only when you
change the edge host mapping that
[Origin router](../../docs/protocol/cloud/origin-router.md) defines.

## Responsibilities

- Own the Worker script, its plain-text `DOMAIN` binding and the two zone
  routes `<domain>/*` and `*.preview.<domain>/*`.
- Map a public host to its internal app-origin host: the production apex,
  `br-<branch>` preview labels and `pr-N` preview labels.
- Pass production site paths through unchanged, and proxy every other path
  with edge caching disabled, the forwarding headers set and internal
  redirect targets rewritten to the public host.
- Answer `/_router-health`, invalid labels and unresolved disposable origins
  with synthetic no-store responses, and mark every preview response
  `X-Robots-Tag: noindex`.
- Hold no secret, set no cookie, authenticate no reader and call no API.

## What This Package Does

The Worker reads one runtime value, `DOMAIN`. On the apex it sends the root,
the site's first path segments and ACME challenge paths to Pages and every
other path to `app-origin.<domain>`. On a preview host it validates the label
and proxies every path to `app-origin-pr-N.preview.<domain>` or
`app-origin-<branch>-preview.<domain>`. An unprovisioned PR reaches the ingress
default backend's 404 through the proxy; an unresolved branch origin or an
invalid label gets the router's own 404 without an origin request. The site
segment list is a module generated from the site's route inventory, so the
site, the Worker and the reserved workspace names cannot drift apart.

Wrangler does not interpolate shell variables inside JSON configuration, so a
renderer writes the ignored `wrangler.json` from `MKC_DOMAIN` and the
32-character lowercase hexadecimal `MKC_CLOUDFLARE_ZONE_ID` at deploy time.
Re-running it with the same inputs is idempotent. The deploy workflow supplies
those two values, `CLOUDFLARE_ACCOUNT_ID` and the Worker-only API token on
configured pushes and manual dispatches from `main`; PR preview workflows never
deploy this shared Worker.

## Quick Start

```sh
npm ci
MKC_DOMAIN=example.com MKC_CLOUDFLARE_ZONE_ID=0123456789abcdef0123456789abcdef \
  npm run configure --workspace @mokly-cloud/worker
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  npm exec --workspace @mokly-cloud/worker -- wrangler deploy
```

To undo a bad deployment, render the same configuration and run
`npm exec --workspace @mokly-cloud/worker -- wrangler rollback`
with the Worker credentials.

## Development

```sh
npm run typecheck --workspace @mokly-cloud/worker
npm test --workspace @mokly-cloud/worker
cargo xtask origin-router
```

Tests run in the Cloudflare Workers Vitest pool against a configuration
rendered for `example.invalid` at `wrangler.test.json`, which leaves the
operator's `wrangler.json` untouched, with network access disabled. After a
site route or top-level site asset changes, run
`npm run site:routes` to regenerate the segment module; the site
build checks its outputs against that inventory, and the Worker, domain-layout
and infrastructure tests keep edge ownership and reserved workspace names
aligned. The pool and Vitest pins are repeated at the npm workspace root so
that npm hoists one Wrangler.

### Key Code

- `src/index.ts` — the Worker: `domainLayout()` derives the public and internal hosts of an environment name, `appOriginHost()` maps a public host to its internal app origin, and the default `fetch` handler selects Pages pass-through, app proxy or a synthetic response.
- `src/site-segments.ts` — the generated `SITE_FIRST_SEGMENTS` list, written by `apps/site/scripts/generate-site-segments.ts` from `apps/site/src/navigation.ts` and the site's root output names.
- `scripts/render-wrangler.mjs` — writes `wrangler.json`, or `wrangler.test.json` with `--test`, from `MKC_DOMAIN` and `MKC_CLOUDFLARE_ZONE_ID`.
- `vitest.config.ts` — the Workers pool configuration bound to `wrangler.test.json`.
- `tests/routing.test.ts` — production route ownership, preview host mapping, label boundaries and the synthetic responses.
- `tests/proxy.test.ts` — request and response preservation, cache bypass, header rewriting, preview `noindex` and the unprovisioned-PR ingress 404.
- `tests/render-wrangler-tests.mjs` — the renderer's input validation and its output.

### Related Docs

- [Origin router](../../docs/protocol/cloud/origin-router.md)
- [PR preview environments](../../docs/protocol/cloud/pr-preview-environments.md)
- [Deployment smoke checks](../../docs/protocol/cloud/deployment-smoke-checks.md)
- [Marketing boundary](../../docs/protocol/cloud/marketing-site.md)
- [Deployment runbook](../../docs/ops/deploy.md#origin-router)
- [Architecture](../../docs/architecture/cloud.md)
