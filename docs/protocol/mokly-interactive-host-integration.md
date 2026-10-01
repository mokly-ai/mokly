# Interactive Views: Host Integration

## Status And Ownership

Implemented for local Serve when `interactive: "serve"`. This document owns
the cross-cutting configuration, host, frame, navigation, shell-state, and
static-output rules that connect the
[Serve delivery](./mokly-interactive-views-serve.md),
[browser runtime](./mokly-interactive-views-runtime.md), and
[shell](./mokly-interactive-views-shell.md) contracts. Those documents retain
ownership of their route, composition, eligibility, and presentation details.

## Configuration And Listener Lifecycle

`interactive` defaults to `"off"`, which builds no browser bundle and shows no
Static/Live control. `"serve"` enables Live views in local Serve only. Unknown
strings are `config-invalid`. Build, Check, export, and publication ignore the
option and emit identical bytes in both modes.

Serve rejects `--interactive-port` and `--interactive-origin` while the option
is off. Otherwise the Live listener starts at the resolved app port plus one,
unless `--interactive-port` supplies another start. Either listener advances
past occupied ports, `0` delegates to the operating system, and `--strict-port`
prevents both from advancing. When the app port is 65535, the adjacent default
does not exist, so the Live port delegates to the operating system even in
strict mode. The watched supervisor retains both resolved ports across child
restarts, and shutdown closes both listeners and their active connections.

`--interactive-origin` is a canonical browser-facing HTTP(S) origin for a
forwarding layer; it never changes the loopback bind. Its exact authority is
the only additional Live Host value admitted, and forwarded headers grant
nothing. Forwarding that changes a browser-facing host name or only a port
requires the explicit origin; local derivation and policy always use Serve's
socket ports. The private descriptor carries the resolved Live port and the
explicit origin only when supplied.

The app origin owns the generation-scoped preparation POST. The second
loopback listener owns only Live documents, public resources, browser bundles,
diagnostics, and the inspector. It never serves the shell, public catalogue,
component controls, review, comparisons, uploads, or publication endpoints.

## Frame Host Boundary

Static frames retain the same-origin script-disabled policy. A selected and
eligible Live view mounts in a new frame on the separate interactive origin;
the shell never changes an existing Static frame's sandbox. Live frames use
the cross-origin policy `allow-same-origin allow-scripts`, supply pending usage,
and subscribe only to navigation. The frame registry keeps one
`postMessageAdapter` per Live origin.

The local interactive listener treats `mokly-host` as an authentication axis,
not a view-selection axis. Without an explicit forwarded origin, it must equal
either canonical loopback spelling at the resolved app port. Forwarded mode
accepts one canonical HTTP(S) app origin distinct from the frame and uses the
broader frame-ancestor policy defined by Serve delivery. Unknown or duplicate
query parameters remain invalid. A manual document request may omit
`mokly-host`, but its inspector then has no authenticated host and stays inert.

The adapter's nonce handshake stays pinned to the exact accepted host. Host
validation never trusts `document.referrer`, a message-supplied origin, or
forwarded headers. Content hosting and forwarding isolation remain the
consumer's responsibility.

## Live Navigation

Live documents rebuild native `MockLink` and raw `mock:` hrefs from their
bootstrap route table. Native links and `MockLink asChild` prevent unmodified
primary activation and dispatch the package-owned
`mokly:interactive-navigation` event with exactly
`{ id, fragment?, target }`. The inspector applies the bounded logical-identity
validators, adds `activation: "primary"`, and sends the ordinary navigation
wire event. The DOM and wire events contain no href, label, HTML, or arbitrary
URL.

Consumer JavaScript can synthesize the DOM event, so its shape is validated
rather than authenticated. The host still validates the id against its public
catalogue and resolves the canonical identity-derived route. Modified and
middle activation emit no package event and retain native sandbox behavior on
the resolved portable href. Missing route-table ids stay inert. The Live route
table is independent of the static inspector map's 1,024-link limit; restored
static fallback nodes continue using their original authenticated indices.

## Private Readiness Transport

The app-origin endpoint is
`POST /__mokly/interactive/<generation>/prepare`. It exists only with an
interactive descriptor, accepts only the current generation, and starts or
joins its one lazy build. Its exact terminal JSON is
`{ "generation": <32-lowercase-hex>, "state": "ready" | "failed" }`.
Status is 200 for ready, 503 for a typed browser-bundle failure, 500 for an
internal failure, and 404 for an absent capability or stale generation.
Origin must equal `http://` plus the accepted loopback Host exactly; other
origins receive 403. The browser validates body, generation, state, and status,
and no consumer diagnostic text crosses this boundary.

`/__mokly/events` emits a private `interactive` event with the complete
descriptor whenever the generation enters `building`, `ready`, or `failed`,
and replays the current descriptor when a stream opens. The client adopts an
event only when generation, port, and optional explicit origin match the
installed descriptor. The shell prepares only while Live is selected and the
descriptor is not ready, presents the pending state, and mounts only after
ready. Events, results, and evidence cannot move one generation from `ready`
or `failed` back to `building`.

## Shell State And Static Boundaries

Preview mode is Static or Live. It persists across in-shell navigation,
including opted-out entries that temporarily show Static, but is not part of
the public viewer selection and starts as Static in every other host. Watched
reload recovery accepts an older payload without the field and restores
Static. Component editing and inspection stay on Static; switching to Live
discards temporary prop edits under the shell contract.

The screen header adds Static/Live beside viewport controls only when private
eligibility is known. At 760px and narrower, a group containing that control
uses its own row. Watched rebuild progress and failure presentation follow the
separate [rebuild status design](./mokly-rebuild-status-design.md).

Export and publication include no consumer Live bundle, bootstrap, descriptor,
origin, private route evidence, or rebuild status. They still include the
viewer shell's own React hydration bundle. Application-owned embedded viewers
receive neither Live nor watched-Serve capabilities.

## Related Docs

- [Interactive views overview](./mokly-interactive-views.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Catalogue navigation](./mokly-navigation.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Watched development](./mokly-watch.md)
- [Consumer static export](./mokly-export.md)
