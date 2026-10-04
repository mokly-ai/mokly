# Interactive Browser Runtime

This directory prepares Live preview documents without changing Mokly's static
build artifacts. It owns the browser bundle and runtime plus Serve's isolated
Live listener. The viewer shell consumes that runtime through its separately
owned Static/Live control.

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
- Bind a second loopback listener, enforce its exact route and Host policies,
  and coordinate current/previous generation state with Serve.
- Validate bounded browser diagnostics and expose consumer-text-free readiness
  through the app origin's private capability channel.

## Boundaries

`bundle.ts` defines `InteractiveBundler` and its injected compiler boundary.
The esbuild implementation rejects Node built-ins with an
`interactive-bundle` error naming the importing module. Browser compilation is
never called by Build, Check, Export, or Publish. A rejected build remains
cached for its generation until explicit invalidation; a later generation gets
an independent attempt. The browser-only JSX development shim preserves
esbuild's static-children flag by selecting the consumer's `jsxs` helper for
static siblings and `jsx` for dynamic children, so React keeps meaningful key
warnings without misclassifying ordinary JSX.

## Accepted Source Captures

Serve-mode graph preparation installs `build/interactive_source_capture.ts` in
the Node consumer graph. Its load hook records the exact bytes esbuild receives
for each repository-owned module or configured-loader input, groups logical and
physical aliases around one byte blob, and records every repository resolution
by normalized importer, original specifier, esbuild kind, and import attributes.
The Node and browser virtual entries normalize to one identity; repository
importers normalize to logical repository-relative paths. Esbuild gives both
hooks the original configured-alias specifier, before applying the alias, so
the record maps that request to the accepted target. The capture is sealed only
after registry and route validation accept the generation. The accepted
`config.entryModules` and capture travel with `ComponentRuntime`; watched IPC
validates the bounded, sorted resolution record and converts file bytes to
canonical padded base64 only while sending them. Off-mode Serve and exhaustive
Build, Check, export, and publication do not create or retain this data.

Installed stylesheet importers use a separate `installed` identity with the
same safe logical repository-relative path. Both builds preserve symlinks and
share `build/interactive_source_paths.ts` to map physical root paths back to
logical paths, including pnpm package aliases. The importer must be physically
installed inside the root and outside Mokly's runtime. Only requests to
stylesheet modules actually saved by the Node loader enter these records.
Each Live resolver caches importer identities, including negative results,
for one bundle build. `installed_importers.ts` skips this lookup with no
installed records. Otherwise it checks logical relative paths against the
recorded importer set before full validation. An outside logical path needs
full normalization because a symlinked root can report physical paths.
Extensionless exports remain eligible for replay.
IPC validates this importer shape and its `.css` target under the existing
path, attribute, record-count and aggregate string bounds.

`source_resolution.ts` is the browser graph's repository resolver. It replays
recorded relative, absolute, bare, configured-alias, and repository-package
requests before any filesystem resolution. A recorded workspace linked through
`node_modules` remains repository-owned because its physical target satisfies
the same source-inventory rule; a physically installed package does not. A
captured namespace load never reads a repository source from disk, and a
missing or unrecorded repository request becomes `InteractiveBundleError` with
reason `source-not-captured`. This lets a generation's first Live request
succeed after an accepted target is edited, deleted, renamed, or made invalid.
Installed JavaScript packages, Mokly's runtime, and consumer React peers still use
esbuild's normal filesystem resolution and intentionally remain unpinned.

For recorded repository requests, Live deliberately keeps the Node graph's
accepted target even when a browser condition or repository package `browser`
field would choose another file. Resolution metadata is now a limit only for
requests absent from the record. Esbuild may reread `tsconfig.json` or package
metadata to classify such a request; a repository result produces the typed
missing-capture failure, while an installed-package result proceeds normally.

`document.ts` accepts only a document already processed by
`adaptBrowseDocument`. It validates without rewriting that adapter's inert map,
emits no props or source paths in the bootstrap, escapes canonical JSON for an
inline script, requires the metadata and sole inspector script to remain inside
the explicit head, and preserves every byte from the body start onward.
`InteractiveViewEligibilityError` exposes typed entry/kind/variant reasons for
the 404 boundary; malformed composition inputs are internal document errors,
not `interactive-bundle` failures. `server_static.ts` refuses ineligible views
before bundle preparation and composes only the current generation's ordinary
on-demand document.

`runtime/` strictly validates the bootstrap, configures the route table, finds
the bundled registry entry, and mounts with React's `createRoot` inside
`flushSync`. Component roots use their saved complete props; registered
components inside any Live tree use the non-recording component context. A
saved component's registered render stays deferred until React traverses it
under the optional renderer `interactive` export, so consumer providers wrap
both component roots and screens.

Render failures reach an injectable `InteractiveDiagnosticReporter`. The
default implementation logs locally and posts a bounded `render-error` payload
to the generation-scoped diagnostics path. Pre-root validation failures leave
the static body untouched. An uncaught root error reports once, unmounts, and
restores the retained original child nodes without duplicating body styles or
scripts; caught errors leave the consumer boundary result in place. The endpoint
strictly validates 16 KiB of JSON and logs one line per view and generation.

## Serve Origin

`server.ts` defines `InteractiveServer` and its factory boundary. The watched
HTTP child owns this listener because it already owns the current catalogue,
document service, and runtime. `server_router.ts` admits only Live documents,
confined public files, retained generation bundles and diagnostics, and the
inspector. All responses are uncached and `nosniff`; documents also restrict
frame ancestors. No route sends CORS headers.

Local Hosts use the controls listener's exact loopback rule. An explicit
browser-facing origin adds only its exact authority. Forwarded headers grant
nothing. Default CSP names both loopback app spellings; explicit forwarding
uses the documented HTTP(S) ancestor policy because the forwarded shell origin
is unknown. Forwarded host names or port numbers therefore require an explicit
origin. The frame adapter's optional request parameter is separately validated
as a canonical origin distinct from the frame.

`bundle_state.ts` tracks `idle`, `building`, `ready`, or `failed`, coalesces one
timed build, and retains exactly the current generation and one predecessor
with their captures. A third generation evicts both the oldest state and its
capture, aborts an in-flight esbuild context, and ignores a retired completion.
Repeated reload/restart transfers reuse an identical decoded capture object;
the supervisor retains only its current runtime. Typed `interactive-bundle`
failures become consumer-text-free 503 responses; internal faults remain 500.
The app origin owns the current-generation preparation POST and private
descriptor/SSE transport, so the shell can wait for readiness without reading
a cross-origin response. That POST follows the component-control rule: its
Origin must be exactly `http://` plus the accepted loopback Host.

## Navigation

The bootstrap route table resolves every routable id from the accepted
generation's manifest and maps it to only its portable href, without the
inspector map's 1,024-link limit. Parity tests pin those manifest routes to the
authored-entry Build resolver. Native `MockLink`, `MockLink asChild`, and
resolved raw `mock:` anchors
prevent unmodified primary activation and emit `mokly:interactive-navigation`
with `{ id, fragment?, target }`. The inspector strictly validates that logical
identity and sends the unchanged frame navigation protocol; the host remains
the authority for catalogue destinations. Modified and middle activation keeps
native behavior on the resolved href.

## Development

```sh
npm run build
node --import tsx --test tests/interactive_*.test.ts tests/client_interactive_capability.test.ts
npx playwright test tests/browser/interactive.spec.ts
npm run package:check
```

See the [Interactive Views overview](../../docs/protocol/mokly-interactive-views.md),
[Live runtime contract](../../docs/protocol/mokly-interactive-views-runtime.md),
[Serve delivery contract](../../docs/protocol/mokly-interactive-views-serve.md),
[rendering contract](../../docs/protocol/mokly-rendering.md), and [frame
adapter](../../docs/protocol/mokly-frame-adapter.md).

## Imported Styles In Live

The accepted Node graph passes each stylesheet loader's JavaScript result to
its source capture. CSS Modules retain the exact default map and named exports
used by Static, including consumer PostCSS transforms and installed-package
CSS. Installed relative and package-name stylesheet requests, including
self-references through `exports`, replay their recorded targets before
filesystem resolution. Package JavaScript remains unpinned. Plain CSS retains empty
JavaScript. CSS symlinks keep separate logical-path blobs because main's scoped
names depend on that path; ordinary raw-source aliases still share bytes.
Live replays those blobs with the JavaScript loader and runs no CSS
pipeline. Its preserved Static head supplies the stylesheet links once.

An installed browser condition or field can choose an unevaluated importer.
Its requests remain unrecorded. Existing captured-path fallback can satisfy a
relative request; a package-name request must still resolve before the load
hook finds the saved blob. An existing uncaptured stylesheet fails with
`source-not-captured`; a deleted unrecorded bare target can fail resolution.
Live never reads stylesheet source from disk. Imported-style processing rejects
stylesheets outside `repoRoot`. An `empty` opt-out can accept an extensionless
outside stylesheet, but Live still lacks its blob and fails. Outside-root
importers of confined CSS also stay unrecorded. These
limits and the still-open installed-to-workspace JavaScript boundary are in
the [source-pinning contract](../../docs/protocol/mokly-interactive-source-pinning.md).

`server_static.ts` serves accepted generated stylesheet and asset routes from
`DocumentService.styles`, with no reserved disk fallback in either output mode.
The route allowlist, MIME mapping, HEAD handling and origin headers still apply.
CSS asset query suffixes are accepted for these resources; other public-file
queries and non-view generated routes remain refused. Source edits or deletion
cannot change an accepted generation's modules or resource bytes.

Generated-output writes use the repository writer lock. Live source replay and
accepted resource delivery use their generation's in-memory bytes, so they keep
working while another writer waits or replaces generated output. A replacement
runtime supplies the next accepted bytes; a disk write alone does not adopt them.
