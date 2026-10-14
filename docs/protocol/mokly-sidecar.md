# Render Sidecar

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Boundary

The sidecar is the only place Mokly runs JavaScript. The Rust binary starts it
when a catalogue needs a JavaScript bundle, a React, page, or Storybook
render, or a consumer PostCSS module. The sidecar returns text: HTML
fragments, CSS, module and definition inventories, and diagnostics. It never
reads the catalogue, never writes files, and keeps no state beyond loaded
bundle generations. Catalogue decisions, caching, invalidation, comparison, and
output belong to the binary.

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
{"id":12,"method":"renderComponent","params":{"generation":"3f9c…","handle":"specs/ui/button.mockup.tsx#Button","props":{"label":"Save"},"viewport":"mobile","colorScheme":"light","ignoreScope":"enabled"}}
{"id":12,"result":{"html":"<button class=\"css-1x2\">Save</button>","styles":[".css-1x2{color:red}"],"resources":[],"warnings":[]}}
{"event":"diagnostic","params":{"message":"…"}}
```

## Methods

| Method            | Params                                                                                        | Result                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `hello`           | none                                                                                          | `{ version }`                                                |
| `bundle`          | entry files, renderer module, stories files, module resolution settings, source root          | `{ generation, modules, warnings }`                          |
| `describe`        | generation                                                                                    | `{ screens, pages, useCases, folders, components, stories }` |
| `renderScreen`    | generation, handle, props, viewport, colour scheme                                            | render result                                                |
| `renderComponent` | generation, handle, props, slot placeholders, viewport, colour scheme, enclosing ignore scope | render result                                                |
| `renderStory`     | generation, story id, props, viewport, colour scheme                                          | render result                                                |
| `renderPage`      | generation, handle                                                                            | `{ html, resources, warnings }`                              |
| `processCss`      | PostCSS module, source path, text                                                             | `{ text, dependencies }`                                     |
| `cssModules`      | generation, class maps by stylesheet path                                                     | nothing                                                      |
| `dispose`         | generation                                                                                    | nothing                                                      |
| `shutdown`        | none                                                                                          | nothing                                                      |

A render result is `{ html, styles, resources, warnings }`: the fragment, the
CSS rules the render produced in first-appearance order, the non-CSS resource
records the renderer declared, and build warnings. `renderPage` runs a
`definePage` callback and returns the complete document it produced, the
resource records the renderer declared, and warnings, with no styles; the
binary applies the document rules of the [pages contract](./mokly-pages.md)
to it.

## Definitions

`describe` evaluates the entry modules and the stories files of a generation
and returns every definition they export, each with its handle: screens
with their variants, pages, use cases, folders, components, and the story
inventory. An export holds exactly one definition; an array export fails with
`array-export` naming the export. A handle is the file path, `#`, and the export name, for example
`specs/account/invoice.mockup.tsx#default`; a render request names the
definition by its handle and passes the props of the entry or of the variant,
because a variant is a props set under the
[entry props contract](./mokly-entry-props.md). A component definition carries its `element`
when declared, the prop schema, its own props, the slots, the controls, and
the saved variants; a screen definition carries its prop schema when
declared, its own props, its controls, and each variant's slug, title, props,
and metadata overrides. The binary feeds
every definition into the catalogue model, builds the component registry from
the component definitions and the HTML components, applies the uniqueness and
reserved-name rules of the [components contract](./mokly-components.md), and
fails registration naming both files on a collision. `describe` shares the
`bundle` deadline. A module that cannot be evaluated returns `bundle-failed`
with the module and the diagnostic text.

## Bundling

`bundle` compiles the consumer's JavaScript into one in-memory bundle with
esbuild and keeps it in the sidecar under a generation id. The generation id is
the hash of every module in the metafile, the renderer module, the resolution
settings, and the installed React version; the binary uses it as one part of the cache key
for every fragment. The sidecar reports `modules`, the module graph: each
repository-relative source file of the graph with its imports in source order,
including re-exports and dynamic imports, and each stylesheet import by its
resolved logical path. The binary watches the files, invalidates the
generation, and reads each root's stylesheet order from the edges under the
[imported stylesheet contract](./mokly-imported-styles.md#roots-collection-and-deduplication).
The bundle compiles JSX in development mode and resolves
`react/jsx-dev-runtime` to a Mokly-owned shim inside the consumer graph; the
shim forwards to the consumer's `react/jsx-runtime` and attaches the invocation
source only to `defineComponent` wrappers, as the
[instances contract](./mokly-instances.md) reads it. A `*.module.css` import
compiles to a stub that reads the file's class map from the generation's map
table; the core scopes the file under the
[CSS Modules contract](./mokly-imported-styles-modules.md) and supplies every map of the generation through `cssModules` after `bundle`
reports the graph and before `describe` evaluates the modules; `bundle`
evaluates nothing, and `describe` or a render of a generation without its
table fails closed. esbuild is chosen because its plugin model gives the virtual entry, one React instance resolved from the consumer, the
attributed authoring facade directly, and its metafile is the module inventory. Rolldown is reviewed again after the first release.

The source root is the repository root for the head side of a comparison. For
the base side it is the directory into which the
[comparison contract](./mokly-comparison.md) extracted the base commit, and the
module resolution settings name the `node_modules` directory its dependency
tiers chose: the working tree's or the installed base set.

The bundle evaluates under `describe` and the renders, in the sidecar's own
module context with the consumer's `require`. React and React DOM resolve from the consumer. A bundle
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
[comparison contract](./mokly-comparison.md) for the component instances, slots, ignore regions, and `MockLink asChild`
controls it contains. `ReviewIgnore` writes an ignore pair; a
disabled `ReviewIgnoreScope` suppresses the pairs inside it, so no scope marker
exists. The `ignoreScope` state of the request is `enabled` or `disabled`; the
binary sends `enabled` for a component element outside every scope. The state
seeds the React scope context, so nesting across the boundary follows the
innermost scope, and the binary applies no outer scope to the fragment. A
fragment never emits `mokly-root`; the core attaches the root region of a
component page itself. The binary reads the markers into tree ownership, consumes the ignore and
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

A story file is a `*.stories.{ts,tsx,js,jsx}` file matched by a root. The
sidecar loads the consumer's `.storybook/preview` annotations with
`setProjectAnnotations`, composes each story with `composeStories` from
`@storybook/react`, and renders it with `renderToStaticMarkup`. The story id
is the file path, `#`, and the export name, and `describe` lists every story
of the generation. A stories file becomes one component entry at the path derived
from the file: the meta's `args` are its props, the schema is inferred from
the args, and each story is a
variant at the parent's path plus the export name as slug, with its `args` as
props, under the [entry props contract](./mokly-entry-props.md); the read
model needs no new kind. A `renderStory` request carries the merged data
props, applied over the composed story's own args, so non-data args stay as
the file defines them. Viewport and colour scheme reach the story as the globals
`moklyViewport` and `moklyColorScheme`. A consumer without `@storybook/react`
fails `bundle` with `bundle-failed` naming the missing package.

`argTypes` never enter the schema or validation. An entry's `options` become
the choices of the derived select, its `control.min`, `control.max`, and
`control.step` the bounds and step of the derived number control, and its
`name` and `description` the control's label and help text. An arg whose
`argTypes` entry has `control: false`, `table.disable: true`, an `action`, or
a `type` of `function` is not a prop: it is excluded from the props, the
schema, and the fragment key without a warning, and the story renders with the
file's own value for it. A function-valued arg with no `argTypes` entry is
excluded with the `props-not-data` warning of the
[entry props contract](./mokly-entry-props.md#schema-inference).

## Consumer PostCSS

`processCss` runs the consumer's PostCSS module in a worker inside the sidecar
with a fresh module context per generation. It returns the transformed text and the plugin-reported file and
directory dependencies for watching. Mokly's own CSS work stays in Rust.

## Cancellation And Timeouts

Every request carries a deadline: 120 seconds for `bundle` and `describe`, 30
seconds for a render, 60 seconds for `processCss`, each overridable by
`MOKLY_SIDECAR_TIMEOUT_MS`. When a deadline passes, the binary kills that
sidecar, retries the request once on a fresh sidecar, and then fails with
`render-timeout`. A cancelled command sends `shutdown` to every sidecar and
kills any that survives the grace period.

## Fail-Closed Rules

| Code                  | Condition                                                            | Presentation                                                                   |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `sidecar-unavailable` | Node or the sidecar entry cannot be started                          | `build-invalid` naming the missing part                                        |
| `sidecar-version`     | the sidecar version differs from the CLI version                     | `build-invalid` with both versions                                             |
| `sidecar-protocol`    | a malformed frame, an unknown method, or a frame over the size limit | `build-invalid`; the sidecar is replaced                                       |
| `sidecar-crashed`     | the process exits during a request                                   | the request's own code after one retry                                         |
| `bundle-failed`       | bundling or evaluation fails                                         | `build-invalid` with the module and diagnostic                                 |
| `render-failed`       | a render throws or returns a non-string                              | `build-invalid` with the entry and, for a view render, the viewport and scheme |
| `render-timeout`      | a deadline passed twice                                              | `build-invalid` with the entry and the deadline                                |

There is no fallback render and no partial output. Commands that need no
JavaScript never start a sidecar and never fail for these reasons.

## Security

The sidecar runs consumer code with the same trust as the consumer's own build.
It receives the environment unchanged. Installing a base commit's dependencies for the comparison contract's second
tier runs the package manager with lifecycle scripts disabled and a time limit,
so no consumer script executes at install time.

## Related Docs

- [Entry props and variants](./mokly-entry-props.md)
- [Rust core architecture](../architecture/rust-core.md)
- [HTML screens](./mokly-html-screens.md)
- [Rendering and document assembly](./mokly-rendering.md)
