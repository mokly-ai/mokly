# Interactive Browser Runtime

This directory prepares Live preview documents without changing Mokly's static
build artifacts. Milestone 3 exposes the bundle, document-composition, and
browser-mount boundaries for the interactive-origin server to consume. The
second listener and shell control are separate delivery milestones.

## Responsibilities

- Compile the consumer's ordinary entry graph plus Mokly's browser entry as an
  ESM bundle with the configured aliases, conditions, loaders, package roots,
  extensions, and consumer-owned React peers.
- Cache one in-flight or completed bundle per catalogue generation, retaining
  only the current and previous generations and allowing explicit invalidation.
- Turn a Browse-adapted static document into a Live document by adding only the
  canonical bootstrap and package scripts inside `head`.
- Rebuild the selected screen or saved component variant in the browser and
  synchronously mount a fresh root on `document.body` after static first paint.
- Preserve host-owned catalogue navigation through a validated Live identity
  event and the existing frame-adapter transport.

## Boundaries

`bundle.ts` defines `InteractiveBundler` and its injected compiler boundary.
The esbuild implementation rejects Node built-ins with an
`interactive-bundle` error naming the importing module. Browser compilation is
never called by Build, Check, Export, or Publish. A rejected build remains
cached for its generation until explicit invalidation; a later generation gets
an independent attempt.

`document.ts` accepts only a document already processed by
`adaptBrowseDocument`. It validates without rewriting that adapter's inert map,
emits no props or source paths in the bootstrap, escapes canonical JSON for an
inline script, requires the metadata and sole inspector script to remain inside
the explicit head, and preserves every byte from the body start onward.
`InteractiveViewEligibilityError` exposes typed entry/kind/variant reasons for
the future 404 boundary; malformed composition inputs are internal document
errors, not `interactive-bundle` failures. The future interactive origin owns
route selection, response policy, and when composition runs.

`runtime/` strictly validates the bootstrap, configures the route table, finds
the bundled registry entry, and mounts with React's `createRoot` inside
`flushSync`. Component roots use their saved complete props; registered
components inside any Live tree use the non-recording component context. The
optional renderer `interactive` export wraps the node in consumer providers.

Render failures reach an injectable `InteractiveDiagnosticReporter`. The
default implementation logs locally and posts a bounded `render-error` payload
to the generation-scoped diagnostics path. Pre-root validation failures leave
the static body untouched. An uncaught root error reports once, unmounts, and
restores the retained original child nodes without duplicating body styles or
scripts; caught errors leave the consumer boundary result in place. The endpoint
and its Serve stderr policy belong to the interactive-origin server.

## Navigation

The bootstrap route table reuses the static artifact resolver and maps every
routable id to only its portable href, without the inspector map's 1,024-link
limit. Native `MockLink`, `MockLink asChild`, and resolved raw `mock:` anchors
prevent unmodified primary activation and emit `mokly:interactive-navigation`
with `{ id, fragment?, target }`. The inspector strictly validates that logical
identity and sends the unchanged frame navigation protocol; the host remains
the authority for catalogue destinations. Modified and middle activation keeps
native behavior on the resolved href.

## Development

```sh
npm run build
node --import tsx --test tests/interactive_*.test.ts tests/interactive_*.test.tsx
npx playwright test tests/browser/interactive.spec.ts
npm run package:check
```

See the [Interactive Views contract](../../docs/protocol/mokly-interactive-views.md),
[rendering contract](../../docs/protocol/mokly-rendering.md), and
[frame adapter](../../docs/protocol/mokly-frame-adapter.md).
