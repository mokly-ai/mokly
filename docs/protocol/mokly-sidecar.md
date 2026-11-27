# Render Sidecar

## Purpose And Boundary

The sidecar runs JavaScript bundles, React, page and Storybook renders, and
consumer PostCSS. It returns HTML, CSS, module and definition inventories,
and diagnostics. It never reads the catalogue or writes files. It keeps loaded
generations, explicit PostCSS contexts, and bounded export-name data. The binary
owns catalogue decisions, caching, invalidation, comparison, and output.

## Lifecycle

- The binary spawns `node <mokly package>/dist/sidecar.js` with input/output
  pipes and the [source worker environment](./mokly-sidecar-modules.md#source-root-workers).
  Its directory stays at `sourceRoot`. Another root replaces it before replay.
  A missing source directory is the unavailable part. Standard error goes to the terminal reporter as diagnostics, except the consumer output that a [quiet call](./mokly-sidecar-return-warmup.md#warm-up-steps) drops.
- The default pool size is the machine's core count, and a default pool grows
  under the [memory admission rules](./mokly-sidecar-memory.md#default-admission).
  `--sidecars <n>` and `MOKLY_SIDECARS` accept any positive integer and set an
  exact size without memory admission. The option takes precedence over the
  variable.
- The first request is `hello`; the sidecar's first frame is its matching hello
  response with the package version. Reject a mismatch with `sidecar-version`
  before other traffic.
  When the binary keeps a [bundle cache](./mokly-base-cache.md#stable-capture),
  `hello` carries the private `capture` hint. It lists at most 64 supported
  local macOS and Windows volumes in 64 KiB. Without it, no evidence is stable.
- Recycle after 500 renders or over 1 GiB of resident memory across the sidecar
  and its Node descendants, under the [memory sampling](./mokly-sidecar-memory.md)
  rules. Finish in-flight work before recycling. Reload generations on demand.
- `shutdown` drains in-flight work; the binary kills survivors after two seconds.

A sidecar never outlives its binary, on every platform. Pipe closure or parent
death terminates even a blocked render. PostCSS children use the same
protection, including on the historical side.

## Transport

Frames are newline-delimited UTF-8 JSON, with at most 64 MiB of JSON bytes
per frame, excluding its LF delimiter. A request has `id`, `method`, and
`params`, and a [warm-up](./mokly-sidecar-return-warmup.md#warm-up-steps) call also has `quiet: true`; a method without parameters uses `{}`. A response repeats `id` with
exactly one of `result` or `error`; a method without a return value uses
`result: null`. An event has `event` and `params` and no `id`. Requests on one
sidecar run in order; the pool spreads independent requests across sidecars. A request waiting for its affine slot does not block the first later request that can use another slot.

Decision: each side trusts the frames that the other side of the same version
writes, and checks only author data. JSON decoding, the hello and version
check, and the frame size limit still apply. Checks of every frame field on
both sides were rejected, because the copies drift and increase the code size.

```json
{"id":12,"method":"renderComponent","params":{"generation":"3f9c…","handle":"specs/ui/button.mockup.tsx#Button","entry":{"path":"ui/button","title":"Button"},"props":{"label":"Save"},"slots":{},"viewport":"mobile","colorScheme":"light","ignoreScope":"enabled"}}
{"id":12,"result":{"html":"<!--mokly-output:start id=\"r-1\"--><button class=\"css-1x2\">Save</button><!--mokly-output:end id=\"r-1\"-->","styles":[{"css":".css-1x2{color:red}","owners":["ui/button"]}],"markers":[{"id":"r-1","payload":{"kind":"output"}}],"resources":[],"instances":[],"slots":[]}}
{"event":"diagnostic","params":{"message":"…"}}
```

## Methods

| Method              | Params                                                                                                                                                                                                                                                                                                                                      | Result                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hello`             | optional `timings` boolean, default `false`, and optional `capture` hint                                                                                                                                                                                                                                                                    | `{ version }`                                                                                                                                                                     |
| `readStorybook`     | source root, configuration directory, [Storybook folder](./mokly-storybook.md#storybook-folders), repository roots, resolution settings                                                                                                                                                                                                     | `{ main, entries, inputs, dependencyDirectories }` or `{ mainError }`                                                                                                             |
| `bundle`            | entry files, renderer, stories files and each file's [Storybook folder](./mokly-storybook.md#storybook-folders), resolution settings, source root, configuration directory, repository roots, optional `vite`, [`viteInputs`](./mokly-vite-adapter-inputs.md), `capture`, and [`preparation`](./mokly-sidecar-postcss.md#prepared-contexts) | `{ generation, modules, compiled }` or a [short result](./mokly-sidecar-recipes.md#restored-reuse)                                                                                |
| `restoreGeneration` | generation, original bundle params, module graph, immutable compiled recipe                                                                                                                                                                                                                                                                 | nothing                                                                                                                                                                           |
| `describe`          | generation                                                                                                                                                                                                                                                                                                                                  | `{ screens, pages, useCases, folders, components, stories, diagnostics }`                                                                                                         |
| `renderScreen`      | generation, handle, effective entry, props, viewport, colour scheme                                                                                                                                                                                                                                                                         | render result                                                                                                                                                                     |
| `renderComponent`   | generation, handle, effective entry, props, tagged slots, viewport, colour scheme, enclosing ignore scope                                                                                                                                                                                                                                   | render result                                                                                                                                                                     |
| `renderStory`       | generation, story id, props, viewport, colour scheme                                                                                                                                                                                                                                                                                        | render result or [story failure](./mokly-storybook-failures.md#failed-views)                                                                                                      |
| `renderPage`        | generation, handle                                                                                                                                                                                                                                                                                                                          | `{ html, resources }`                                                                                                                                                             |
| `processCss`        | context, source root, repository roots, resolution settings, PostCSS module, source path, text                                                                                                                                                                                                                                              | `{ text, dependencies, readEvidence }`                                                                                                                                            |
| `transformViteCss`  | [`TransformViteCssParams`](../../packages/mokly/src/generated/sidecar/TransformViteCssParams.ts): the side's `bundle` settings with empty entry and stories file lists, the logical stylesheet path, and the selected physical file                                                                                                         | [`ViteCssResult`](../../packages/mokly/src/generated/sidecar/ViteCssResult.ts), with `importedBy` for the [`composes` rule](./mokly-vite-adapter-styles.md#stylesheet-transforms) |
| `bindings`          | generation, handle-to-path-and-title table                                                                                                                                                                                                                                                                                                  | nothing                                                                                                                                                                           |
| `disposeContext`    | PostCSS context                                                                                                                                                                                                                                                                                                                             | nothing                                                                                                                                                                           |
| `prepareContext`    | PostCSS context and module, source root, repository roots, and resolution settings                                                                                                                                                                                                                                                          | nothing                                                                                                                                                                           |
| `cssModules`        | [`CssModulesParams`](../../packages/mokly/src/generated/sidecar/CssModulesParams.ts): generation, class maps by stylesheet path, and the optional `namedExports` of the [Vite adapter](./mokly-vite-adapter-styles.md#css-modules)                                                                                                          | nothing                                                                                                                                                                           |
| `dispose`           | generation                                                                                                                                                                                                                                                                                                                                  | nothing                                                                                                                                                                           |
| `shutdown`          | none                                                                                                                                                                                                                                                                                                                                        | nothing                                                                                                                                                                           |

The [render records contract](./mokly-sidecar-render-records.md) defines the
render result, bindings, entry context, usage drafts, and slot inputs. Page results follow the [pages contract](./mokly-pages.md).

## Definitions

`describe` returns every exported definition with its handle and a
`diagnostics` list. The [definition transport](./mokly-sidecar-definitions.md)
defines typed metadata, raw authored schemas, and source-attributed authoring
errors. These errors keep their own codes and do not invalidate the transport.
The core validates schemas with its single schema validator before it
registers definitions or starts a render.

## Bundling

`bundle` compiles an unevaluated in-memory generation with esbuild or the [Vite adapter](./mokly-vite-adapter.md) and returns its id. A
change to any input that can change the compiled code or its evaluation gives
a new id. Equal head and base sources have separate generations, class maps, and
bindings. Render input keys never contain a generation id. Render cache keys use
the [render input keys](./mokly-watch.md#invalidation-through-the-render-graph),
so equal head and base inputs share cache entries under the
[runtime contract](./mokly-runtime.md#render-graph-and-cache), and a cache miss
renders with its own side's generation. The whole-bundle key of the watch
contract contains the generation id, so it never matches across sides. A selected dependency installation is
part of the key, so a base with its own installation shares no JavaScript render.
Decision: equal inputs share entries across sides. A side marker in every key
was rejected, because the base would render every unchanged view again.
[Compiled recipes](./mokly-sidecar-recipes.md) define replay and release.

The module graph reports the digest of each module's consumed bytes, sources,
and dependencies with imports, including re-exports, dynamic imports, and
stylesheets. The import order follows the compile path: the
[esbuild order](./mokly-sidecar-modules.md#source-and-dependency-files) or the
[Vite order](./mokly-vite-adapter.md#module-graph). The graph marks each module
that gives an [asset token](./mokly-imported-assets.md#asset-tokens). A file inside
a selected dependency root, a `node_modules` directory, is a dependency on
both sides. JavaScript and CSS imports from it are allowed and use stable
logical names relative to that root, such as `node_modules/pkg/style.css`.
The binary reads them from that dependency root and excludes them from the
catalogue source inventory.

The [module sources contract](./mokly-sidecar-modules.md#source-and-dependency-files)
defines repository mapping for `bundle` and `processCss`, including PostCSS
configuration, plugins, and presets. A mapping failure returns `bundle-failed`
with the logical module path and the importing file's location.

The head source root is the working repository. The base source root is the
extracted base commit. Resolution settings select each side's dependency
installation under the [comparison tiers](./mokly-comparison.md#sides).
React and React DOM resolve from that side's configuration directory through
its settings, with one React runtime. The JSX development shim forwards to
the consumer runtime and attaches invocation source only to Mokly wrappers.

`bundle` evaluates nothing. `cssModules` must install all maps before
`describe` evaluates the generation. A bundle or evaluation failure returns
`bundle-failed` with its source and diagnostic.

## Style Collection

A render keeps style delivery separate from comparison ownership under the
[render records contract](./mokly-sidecar-render-records.md#results). Emotion
and styled-components retain one render-local server extraction. Their rules
name the registered component that used them, in component and screen renders.
Slot content keeps its supplier. The sidecar also collects `<style>` elements in the fragment. For a persistent registry such
as the React Native Web sheet from `AppRegistry.getApplication`, it returns
only rules whose class selectors match the fragment's class tokens, their
required at-rules and keyframes, and the registry's element-level resets.
Unused rules and rules used only by earlier renders are excluded. Results
are independent of render order. Rules keep first-appearance order.
The binary deduplicates rules by identity across fragments and places them in
the document head before configured stylesheets. Unknown styling libraries
contribute only the `<style>` elements in the fragment.
Comparison applies the shared [style
ownership](./mokly-comparison.md#style-ownership) rules to those owners and
emits the shared per-rule evidence, including one excluded record when no
changed rule is kept.

## Markers In Fragments

A fragment carries the comment markers of the
[comparison contract](./mokly-comparison.md) for the component instances, slots, ignore regions, and `MockLink asChild`
controls it contains. `ReviewIgnore` writes an ignore pair; a
disabled `ReviewIgnoreScope` suppresses the pairs inside it, so no scope marker
exists. The `ignoreScope` state of the request is `enabled` or `disabled`; the
binary sends `enabled` for a component element outside every scope. The state
seeds the React scope context, so nesting across the boundary follows the
innermost scope, and the binary applies no outer scope to the fragment. A
fragment never emits `mokly-root`; the core attaches the root region of a
component page itself. Private `mokly-output` pairs locate adapter output
inside renderer wrappers and are consumed before serialization. The binary
reads markers into tree ownership, consumes the ignore and
`mokly-link` pairs, and writes the instance and slot pairs around the composed
regions under the [comparison contract](./mokly-comparison.md#markers).

## Slots For JavaScript Components

When an HTML screen passes slot content to a JavaScript component, the sidecar
renders each slot as the placeholder element
`<mokly-slot name="<slot>" token="<token>" ignore-scope="<state>"></mokly-slot>`
at the position the component renders its children, with the scope state at
that position, `enabled` or `disabled`. The binary replaces the placeholder
with the slot's HTML after the fragment returns, with the placeholder's state as
the innermost scope of that content. A placeholder that the component did not
render fails the screen with `html-slot`.

## Storybook

The [Storybook stories contract](./mokly-storybook.md) defines how the
sidecar reads stories files, which stories `describe` lists, and how
`renderStory` prepares and renders a story.

`readStorybook` loads the `main.*` of one Storybook folder before discovery,
under the [roots from `main.*` rules](./mokly-root-discovery.md#roots-from-main).
It resolves the `storybook` package and the imports of `main.*` with the
resolution settings of its side. `main` is the repository-relative path of
that `main.*`. `entries` holds each `stories` entry in authored order, as a
`directory` relative to the source root and a `files` pattern relative to that
directory. `inputs` maps the repository-relative path of each repository file
outside `node_modules` that the load read to the digest of its bytes. It
also maps each other candidate name of `main.*` to its digest, or to `null`
when that file does not exist. A `main.*` that is missing, fails to load, or
gives invalid `stories` gives `{ mainError }` with the reason. Every other
failure gives the error reply of its kind.
`dependencyDirectories` lists the dependency directories that the load used.

## Consumer PostCSS

The [PostCSS context and evidence contract](./mokly-sidecar-postcss.md) defines
consumer processing, context preparation and lifetime, read witnesses, and incomplete coverage.

## Cancellation And Timeouts

The [cancellation rules](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts)
define deadlines, process replacement, and shutdown grace.

## Fail-Closed Rules

| Code                  | Condition                                                                                       | Presentation                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `sidecar-unavailable` | Node or the sidecar entry cannot be started, or a required PostCSS context worker is out of use | `build-invalid` naming the missing part                                        |
| `sidecar-version`     | the sidecar version differs from the CLI version                                                | `build-invalid` with both versions                                             |
| `sidecar-protocol`    | a malformed frame or a frame over the size limit                                                | `build-invalid`; the sidecar is replaced                                       |
| `sidecar-crashed`     | the process exits during a request                                                              | the request's own code after one retry                                         |
| `bundle-failed`       | bundling or evaluation fails                                                                    | `build-invalid` with the module and diagnostic                                 |
| `render-failed`       | a render throws or returns a non-string, unless it gives a failed story view                    | `build-invalid` with the entry and, for a view render, the viewport and scheme |
| `render-timeout`      | a deadline passed twice                                                                         | `build-invalid` with the entry and the deadline                                |

The error document of a [failed story view](./mokly-storybook-failures.md#failed-views)
is the only fallback render or partial output. When `readStorybook` reports
a missing or failed `main.*` or invalid `stories`, discovery fails with
`config-invalid` and names the file and the failure. Every other
`readStorybook` failure keeps its code and presentation from the table.

Commands that need neither JavaScript, PostCSS, nor a
[Vite stylesheet transform](./mokly-vite-adapter-styles.md#catalogues-without-javascript)
never start a sidecar or fail for these reasons. The `main.*` of a root
without `dir` counts as JavaScript.

## Security

See [Sidecar Security](./mokly-sidecar-security.md).

## Related Docs

- [Sidecar head bundle affinity](./mokly-sidecar-head-bundle-affinity.md)
- [Sidecar restored reuse](./mokly-sidecar-restored-reuse.md)
- [Entry props and variants](./mokly-entry-props.md), [Rust core architecture](../architecture/rust-core.md)
- [HTML screens](./mokly-html-screens.md), [Rendering and document assembly](./mokly-rendering.md)
