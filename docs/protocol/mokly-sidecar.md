# Render Sidecar

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md); not
implemented. The frozen TypeScript backend renders in its own process and
worker threads instead.

## Purpose And Boundary

The sidecar is the only place Mokly runs JavaScript. The Rust binary starts it
when a catalogue needs a JavaScript bundle, a React or Storybook render, a
consumer PostCSS module, or the viewer shell. The sidecar returns text: HTML
fragments, CSS, module and definition inventories, and diagnostics. It never
reads the catalogue, never writes files, and keeps no state beyond loaded
bundle generations. Catalogue decisions, caching, invalidation, comparison, and output
belong to the binary.

## Lifecycle

- The binary spawns `node <mokly package>/dist/sidecar.js` with inherited
  environment, the repository root as working directory, and pipes for
  standard input and output. Standard error is forwarded to the terminal
  reporter as diagnostics.
- The pool holds between one and the machine's core count of sidecars; the
  `--sidecars <n>` option and `MOKLY_SIDECARS` override it. A catalogue that
  needs no JavaScript starts none.
- The first frame on each side is `hello`. The sidecar reports its package
  version; the binary rejects a version other than its own with
  `sidecar-version`.
- A sidecar is recycled after 500 renders or when its resident set passes
  1 GiB, whichever comes first. Recycling waits for in-flight requests, then
  replaces the process. Loaded generations are reloaded on demand.
- On `shutdown` the sidecar finishes in-flight requests, then exits. The binary
  terminates a sidecar that has not exited two seconds later.

## Transport

Frames are newline-delimited JSON, UTF-8, at most 64 MiB each. A request has
`id`, `method`, and `params`. A response repeats `id` with `result` or
`error`. An event has `event` and `params` and no `id`. Requests on one
sidecar run in order; the pool spreads independent requests across sidecars.

```json
{"id":12,"method":"renderComponent","params":{"generation":"3f9c…","export":"specs/ui/button.mockup.tsx#Button","props":{"label":"Save"},"viewport":"mobile","colorScheme":"light","ignoreScope":"enabled"}}
{"id":12,"result":{"html":"<button class=\"css-1x2\">Save</button>","styles":[".css-1x2{color:red}"],"resources":[],"warnings":[]}}
{"event":"diagnostic","params":{"message":"…"}}
```

## Methods

| Method            | Params                                                                                        | Result                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `hello`           | none                                                                                          | `{ version }`                                                |
| `bundle`          | entry files, renderer module, stories files, module resolution settings, source root          | `{ generation, modules, warnings }`                          |
| `describe`        | generation                                                                                    | `{ screens, pages, useCases, folders, components, stories }` |
| `renderScreen`    | generation, export, viewport, colour scheme                                                   | render result                                                |
| `renderComponent` | generation, export, props, slot placeholders, viewport, colour scheme, enclosing ignore scope | render result                                                |
| `renderStory`     | generation, story id, args, viewport, colour scheme                                           | render result                                                |
| `renderShell`     | catalogue read model bytes, view, context                                                     | `{ html }`                                                   |
| `processCss`      | PostCSS module, source path, text                                                             | `{ text, dependencies }`                                     |
| `dispose`         | generation                                                                                    | nothing                                                      |
| `shutdown`        | none                                                                                          | nothing                                                      |

A render result is `{ html, styles, resources, warnings }`: the fragment, the
CSS rules the render produced in first-appearance order, the non-CSS resource
records the renderer declared, and build warnings.

## Definitions

`describe` evaluates the entry modules and the stories files of a generation
and returns every definition they export, each with its export name: screens
with their variants, pages, use cases, folders, components, and the story
inventory. A component definition carries its `element` when declared, the
prop schema, the slots, the controls, and the saved variants. The binary feeds
every definition into the catalogue model, builds the component registry from
the component definitions and the HTML components, applies the uniqueness and
reserved-name rules of the [components contract](./mokly-components.md), and
fails registration naming both files on a collision. `describe` shares the `bundle` deadline. A module
that cannot be evaluated returns `bundle-failed` with the module and the
diagnostic text.

## Bundling

`bundle` compiles the consumer's JavaScript into one in-memory bundle with
esbuild and keeps it in the sidecar under a generation id. The generation id is
the hash of every module in the metafile, the renderer module, the resolution
settings, and the installed React version; the binary uses it as one part of the cache key
for every fragment. The sidecar reports `modules`, the repository-relative
source files of the graph, so the binary can watch them and invalidate the
generation. esbuild is chosen because the frozen backend's plugin behaviour
(the virtual entry, one React instance resolved from the consumer, the
attributed authoring facade) ports to it directly and its metafile is the
module inventory. Rolldown is reviewed again after the first release.

The source root is the repository root for the head side of a comparison. For
the base side it is the directory into which the
[comparison contract](./mokly-comparison.md) extracted the base commit, and the
module resolution settings name the `node_modules` directory its dependency
tiers chose: the working tree's or the installed base set.

The bundle evaluates in the sidecar's own module context with the consumer's
`require`. React and React DOM resolve from the consumer, as today. A bundle
or evaluation failure returns `bundle-failed` with the module and the
diagnostic text.

## Style Collection

A render returns the styles it produced, so their owner is the rendered
component or screen. The sidecar snapshots every style registry it knows
before the render and reports what the render added: the React Native Web
sheet through `AppRegistry.getApplication(...).getStyleElement()`, Emotion and
styled-components through their server extraction APIs, and `<style>`
elements the fragment itself contains. Rules keep first-appearance order.
The binary deduplicates rules by identity across fragments and places them in
the document head before the configured stylesheets. A styling library the
sidecar does not know contributes only the `<style>` elements in the fragment.

## Markers In Fragments

A fragment carries the comment markers of the
[comparison contract](./mokly-comparison.md) for the component instances,
slots, and ignore regions it contains. `ReviewIgnore` writes an ignore pair; a
disabled `ReviewIgnoreScope` suppresses the pairs inside it, so no scope marker
exists. The `ignoreScope` state of the request is `enabled` or `disabled`; the
binary sends `enabled` for a component element outside every scope. The state
seeds the React scope context, so nesting across the boundary follows the
innermost scope, and the binary applies no outer scope to the fragment. A
fragment never emits `mokly-root`; the core attaches the root region of a
component page itself. The binary reads the markers into tree ownership and
drops them.

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

A story file is a `*.stories.{ts,tsx,js,jsx}` file matched by a root. The
sidecar loads the consumer's `.storybook/preview` annotations with
`setProjectAnnotations`, composes each story with `composeStories` from
`@storybook/react`, and renders it with `renderToStaticMarkup`. The story id
is the file path plus the export name, and `describe` lists every story of the
generation. Viewport and colour scheme reach the
story as the globals `moklyViewport` and `moklyColorScheme`. A consumer
without `@storybook/react` fails `bundle` with `bundle-failed` naming the
missing package.

## Consumer PostCSS

`processCss` runs the consumer's PostCSS module in a worker inside the sidecar
with a fresh module context per generation, as the frozen backend's isolated
worker does. It returns the transformed text and the plugin-reported file and
directory dependencies for watching. Mokly's own CSS work stays in Rust.

## Cancellation And Timeouts

Every request carries a deadline: 120 seconds for `bundle` and `describe`, 30
seconds for a render, 60 seconds for `processCss`, each overridable by
`MOKLY_SIDECAR_TIMEOUT_MS`. When a deadline passes, the binary kills that
sidecar, retries the request once on a fresh sidecar, and then fails with
`render-timeout`. A cancelled command sends `shutdown` to every sidecar and
kills any that survives the grace period.

## Fail-Closed Rules

| Code                  | Condition                                                            | Presentation                                    |
| --------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `sidecar-unavailable` | Node or the sidecar entry cannot be started                          | `build-invalid` naming the missing part         |
| `sidecar-version`     | the sidecar version differs from the CLI version                     | `build-invalid` with both versions              |
| `sidecar-protocol`    | a malformed frame, an unknown method, or a frame over the size limit | `build-invalid`; the sidecar is replaced        |
| `sidecar-crashed`     | the process exits during a request                                   | the request's own code after one retry          |
| `bundle-failed`       | bundling or evaluation fails                                         | `build-invalid` with the module and diagnostic  |
| `render-failed`       | a render throws or returns a non-string                              | `build-invalid` with entry, viewport, scheme    |
| `render-timeout`      | a deadline passed twice                                              | `build-invalid` with the entry and the deadline |

There is no fallback render and no partial output. Commands that need no
JavaScript never start a sidecar and never fail for these reasons.

## Security

The sidecar runs consumer code with the same trust as the consumer's own build.
It receives the environment unchanged, like the frozen backend's render
workers. Installing a base commit's dependencies for the comparison contract's second
tier runs the package manager with lifecycle scripts disabled and a time limit,
so no consumer script executes at install time.

## Related Docs

- [Rust core architecture](../architecture/rust-core.md)
- [HTML screens](./mokly-html-screens.md)
- [Rendering contract of the frozen backend](./mokly-rendering.md)
