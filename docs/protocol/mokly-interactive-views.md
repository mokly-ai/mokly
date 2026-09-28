# Interactive Views

## Delivery Status

Implemented by the [interactive views plan](../../plans/interactive-views.md).
The feature includes the approved designs, browser runtime, isolated Serve
origin, lazy bundle state, private shell transport, route-scoped per-entry
eligibility, Static/Live control, narrow-toolbar behaviour, reference example,
and static-material regression coverage.

This document is the entry point for the contract. The focused parts own:

- [Live document, mount, renderer, and navigation behaviour](./mokly-interactive-views-runtime.md);
- [interactive origin, bundle, diagnostics, and readiness](./mokly-interactive-views-serve.md);
- [Static/Live shell behaviour](./mokly-interactive-views-shell.md); and
- [approved presentation](./mokly-interactive-views-design.md).

## Purpose

A Static view is today's script-free document in a sandboxed frame. A Live
view runs the same React tree in the browser so controls respond, menus open
and local state works. Live changes only what the user sees and touches in
local Serve. Comparisons, Changes, `check`, export and publication keep using
the static HTML bytes produced by the ordinary build path. The browser bundle,
its bootstrap and the interactive origin are never material: they do not enter
`mockupsDir`, the manifest, Changes, derived baselines, export or publication.

Product copy says Static and Live. Code, configuration and documents say
`interactive`, because `live` already names the last-good routing runtime and
live evidence.

## Configuration

```ts
interface MoklyConfig {
  interactive?: "off" | "serve"; // "off"
}
```

`off` is the default. No browser bundle is built, no interactive origin opens,
and the shell shows no Static/Live control. `serve` enables Live in local Serve
only. Export and publication never bundle consumer JavaScript. A later contract
may add an `export` value. Unknown strings are config errors. `check`, `build`,
export and publication ignore the option in every mode and emit identical bytes
whether it is `off` or `serve`.

Serve accepts `--interactive-port <port>` and `--interactive-origin <origin>`;
both are rejected on other commands, and both are rejected when the resolved
config is `off`. The port follows the same integer range and assignment rules
as `--port`. Without an override, Live starts at the resolved app port plus one;
when the app has port 65535, Live delegates to an OS-selected port instead.
That delegation also applies under `--strict-port` because no adjacent port can
be requested. The origin is a canonical serialized HTTP(S) origin with no path,
query, fragment or userinfo. `--strict-port` applies to both Serve listeners.
The [Serve delivery contract](./mokly-interactive-views-serve.md#interactive-origin)
defines the listener and forwarding policy.

### Per-entry opt-out

`defineScreen`, `defineComponent`, and nested `screen` inputs accept
`interactive?: false`. Declaring `true` or any other value is rejected, so the
field can only remove Live from one entry. Screen variants inherit the parent's
value unless they declare their own. Collections, pages and use cases reject
the field. An opted-out entry shows no Static/Live control, leaving no gap, and
refuses Live document requests with 404 on the interactive origin.

When the global private interactive descriptor exists, each current screen or
component route's private workspace evidence contains `interactive: boolean`
at the workspace root when the accepted runtime has a resolved value. Serve
resolves it from `ComponentRuntime.interactiveEntries`, not from the current
manifest entry, so the live index, completed manifest, background evidence
refreshes and watched replacement generations agree. If that runtime value is
missing, Serve omits the field, reports the inconsistency once per entry and
generation, and still serves the Static page. The shell treats absent
eligibility as unknown and must not offer or mount Live for that view; the
[shell contract](./mokly-interactive-views-shell.md#eligibility) defines that
presentation and the pending interval after same-shell navigation.

`useViewerLiveState().workspace?.interactive` is the shell accessor. The
workspace remains bound to the exact route and accepted source revision. This
route-scoped scalar was chosen instead of a generation-wide eligibility set in
the capability descriptor: its size is constant for large catalogues, and it
is adopted atomically with the route the shell is displaying. The value never
appears on the workspace's nested manifest entry, in the public catalogue or
shell bootstrap, in static workspace evidence, or in build, export and
publication output. Static evidence rejects it, while private evidence accepts
only a boolean or absence for a current screen or component paired with the
interactive descriptor.

## Views That Offer Live

- Screen fragments: each mobile or desktop fragment in every configured scheme.
- Component saved variants: each variant view in every viewport and scheme.

These never offer Live: pages, use-case steps, comparison panes, removed
previous versions, and transient control previews. Each is either a complete
consumer document, a baseline-pinned document, or already a server render.

## Shell Behaviour

The [interactive views shell contract](./mokly-interactive-views-shell.md)
owns the Static/Live control: where it appears, route-scoped eligibility and
the pending interval after same-shell navigation, preview-mode state, Live
frames, the preparing and unavailable states, and inspection while Live is on
screen. A pending or ineligible view never calls the preparation endpoint and
never requests a Live document.

## Failure States

| State                      | Cause                                               | Behaviour                                                          |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `interactive-bundle`       | Node-only import or esbuild failure                 | 503 on Live documents; failure cached for generation               |
| View ineligible            | Typed entry/kind/variant eligibility reason         | 404 on the interactive origin                                      |
| Entry opted out            | `interactive: false` on the screen or component     | No control and no gap; Static frame; 404 on the interactive origin |
| Eligibility unknown        | Value omitted by Serve or route evidence unloadable | No control; Static frame; never prepared or mounted                |
| Composition fault          | Invalid generation or adapted document              | 500; never presented as a bundle-input problem                     |
| Pre-mount failure          | Invalid bootstrap or missing registry view          | Static document untouched; one diagnostic                          |
| Uncaught Live render error | Consumer render throws in the root                  | Static document restored; one diagnostic                           |
| Caught Live render error   | Consumer error boundary catches                     | Boundary result retained; one diagnostic                           |
| Origin unavailable         | Second listener cannot bind                         | Serve fails to start, naming the port                              |
| Generation replaced        | Watched rebuild during a Live session               | Page reloads, keeps Live, mounts the new generation                |

Runtime failures and restoration are defined by the
[mount contract](./mokly-interactive-views-runtime.md#mount-contract). Origin,
bundle, and readiness failures are defined by the
[Serve delivery contract](./mokly-interactive-views-serve.md).

## Verification

Unit tests cover config and per-entry validation, typed eligibility reasons,
compacted opt-outs, byte identity between `off` and `serve`, and the absence of
private Live material from export. Browser and Serve tests cover document
composition, render recovery, route-table resolution beyond 1,024 entries,
listener policy, readiness, diagnostics, watched generations, a stateful real
Serve mount, and Live navigation. The
[shell contract](./mokly-interactive-views-shell.md#verification) lists the
shell's unit and browser coverage. The reference example exercises the full
provider stack and a stateful registered component in both Static and Live.

## Related Docs

- [Live document and browser runtime](./mokly-interactive-views-runtime.md)
- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Interactive views shell](./mokly-interactive-views-shell.md)
- [Interactive views design](./mokly-interactive-views-design.md)
- [Configuration contract](./mokly-configuration.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Component controls](./mokly-component-controls.md)
