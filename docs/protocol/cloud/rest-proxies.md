# REST Trusted Proxies

This is the client-IP sub-contract of [REST API](./rest-api.md).

## Trusted Proxies

`MKC_TRUSTED_PROXY_HOPS` defaults to zero (socket peer only), accepts integers
0–16, and requires nonempty `MKC_TRUSTED_PROXY_CIDRS` when positive. CIDRs are
comma-separated IPv4/IPv6 networks. Starting at the connecting peer, walk
exactly that many entries from the right of a single `X-Forwarded-For` header.
Before every step, the current address must belong to the allowlist. Return
the selected address only when the entire walk succeeds. Missing, duplicate,
malformed, over-4096-byte or too-short headers, or any untrusted intermediary,
fall back to the original peer. Never trust the leftmost supplied entry by
default. Magic-link, preview sign-in and GitHub auth admission receive this
same selected IP.

Stable GCE ingress appends the connecting client and load-balancer address.
From the API peer the walk is GFE → reserved IPv4 → Cloudflare → client:
three hops, allowing GFE ranges, the reserved IPv4 /32 and Cloudflare CIDRs.
NetworkPolicy restricts stable ingress to GFE. A direct-to-LB request cannot
claim a Cloudflare hop unless its real source is allowed; a short chain falls
back to the peer. See
[Google's header contract](https://docs.cloud.google.com/load-balancing/docs/https#x-forwarded-for_header).

PR environments use a source-preserving passthrough load balancer in front of
an ingress-nginx controller that trusts only Cloudflare as the real-IP source
and appends the original Cloudflare peer to the forwarded chain; the
controller values are in [Preview platform](./preview-platform.md). The API
sees nginx pod → Cloudflare → client: `MKC_TRUSTED_PROXY_HOPS=2`, and
`MKC_TRUSTED_PROXY_CIDRS` contains the `10.24.0.0/14` pod range and the
Cloudflare ranges, with no GFE or ingress-IP /32. Only controller traffic and
the catalogue readiness init can reach PR API ports. Direct ingress traffic
appends its real untrusted source; the second step fails and falls back to
the nginx peer, never the forged leftmost header. The malformed-chain rules
above apply on both paths. A change to either path repeats the live
forged-header proof in the
[preview runbook](../../ops/preview.md#shared-platform-prerequisites).
