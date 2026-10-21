# Render Sidecar

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Boundary

The sidecar runs JavaScript bundles, React, page and Storybook renders, and
consumer PostCSS. It returns HTML, CSS, module and definition inventories,
and diagnostics. It never reads the catalogue or writes files. It retains
only loaded bundle generations and explicit PostCSS contexts. The binary owns
catalogue decisions, caching, invalidation, comparison, and output.

## Lifecycle

- The binary spawns `node <mokly package>/dist/sidecar.js` with input/output
  pipes and the [source worker environment](./mokly-sidecar-modules.md#source-root-workers).
  Its directory stays at `sourceRoot`. Another root replaces it before replay.
  A missing source directory is the unavailable part. Standard error goes to the terminal reporter as diagnostics.
- The default pool size is the machine's core count. `--sidecars <n>` and
  `MOKLY_SIDECARS` accept any positive integer and override that default;
  the option takes precedence over the variable. A catalogue that needs no
  JavaScript starts none.
- The first request is `hello`; the sidecar's first frame is its matching hello
  response with the package version. Reject a mismatch with `sidecar-version`
  before other traffic.
- Recycle after 500 renders or over 1 GiB of resident memory across the sidecar
  and its Node descendants. Exclude native helpers when its executable is known.
  Allow one request per fresh worker. After a memory recycle, double completed
  requests before the replacement's first memory check, capped at 500. Reset
  after a sample at or below the bound. Report one line per pressure episode
  when a replacement's first check is still over the bound. Finish in-flight
  work before recycling. Reload generations on demand; see [memory sampling](./mokly-sidecar-memory.md).
- `shutdown` drains in-flight work; the binary kills survivors after two seconds.

A sidecar never outlives its binary. Linux spawns set `PR_SET_PDEATHSIG` to
`SIGKILL` from a persistent launch thread and check for an earlier parent exit.
On every platform a separate watchdog thread owns the parent pipe and checks
parent identity. Pipe closure or parent death terminates even a blocked render.
PostCSS children use the same protection, including on the historical side.

## Transport

Frames are newline-delimited UTF-8 JSON, with at most 64 MiB of JSON bytes
per frame, excluding its LF delimiter. A request has `id`, `method`, and
`params`; a method without parameters uses `{}`. A response repeats `id` with
exactly one of `result` or `error`; a method without a return value uses
`result: null`. An event has `event` and `params` and no `id`. Requests on one
sidecar run in order; the pool spreads independent requests across sidecars. A request waiting for its affine slot does not block the first later request that can use another slot.

```json
{"id":12,"method":"renderComponent","params":{"generation":"3f9c…","handle":"specs/ui/button.mockup.tsx#Button","entry":{"path":"ui/button","title":"Button"},"props":{"label":"Save"},"slots":{},"viewport":"mobile","colorScheme":"light","ignoreScope":"enabled"}}
{"id":12,"result":{"html":"<!--mokly-output:start id=\"r-1\"--><button class=\"css-1x2\">Save</button><!--mokly-output:end id=\"r-1\"-->","styles":[{"css":".css-1x2{color:red}","owners":["ui/button"]}],"markers":[{"id":"r-1","payload":{"kind":"output"}}],"resources":[],"instances":[],"slots":[],"warnings":[]}}
{"event":"diagnostic","params":{"message":"…"}}
```

## Methods

| Method              | Params                                                                                                            | Result                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `hello`             | optional `timings` boolean, default `false`                                                                       | `{ version }`                                                                       |
| `bundle`            | entry files, renderer, stories files, resolution settings, source root, configuration directory, repository roots | `{ generation, modules, warnings, compiled }`                                       |
| `restoreGeneration` | generation, original bundle params, module graph, immutable compiled recipe                                       | nothing                                                                             |
| `describe`          | generation                                                                                                        | `{ screens, pages, useCases, folders, components, stories, diagnostics, warnings }` |
| `renderScreen`      | generation, handle, effective entry, props, viewport, colour scheme                                               | render result                                                                       |
| `renderComponent`   | generation, handle, effective entry, props, tagged slots, viewport, colour scheme, enclosing ignore scope         | render result                                                                       |
| `renderStory`       | generation, story id, props, viewport, colour scheme                                                              | render result                                                                       |
| `renderPage`        | generation, handle                                                                                                | `{ html, resources, warnings }`                                                     |
| `processCss`        | context, source root, repository roots, resolution settings, PostCSS module, source path, text                    | `{ text, dependencies, readEvidence }`                                              |
| `bindings`          | generation, handle-to-path-and-title table                                                                        | nothing                                                                             |
| `disposeContext`    | PostCSS context                                                                                                   | nothing                                                                             |
| `cssModules`        | generation, class maps by stylesheet path                                                                         | nothing                                                                             |
| `dispose`           | generation                                                                                                        | nothing                                                                             |
| `shutdown`          | none                                                                                                              | nothing                                                                             |

The [render records contract](./mokly-sidecar-render-records.md) defines the
render result, bindings, entry context, usage drafts, and slot inputs. Page results follow the [pages contract](./mokly-pages.md).

## Definitions

The core serializes description across clones of one runtime.

`describe` returns every exported definition with its handle and a
`diagnostics` list and generation warnings. The [definition transport](./mokly-sidecar-definitions.md)
defines typed metadata, raw authored schemas, and source-attributed authoring
errors. These errors keep their own codes and do not invalidate the transport.
The core validates schemas with its single `jsonschema` validator before it
registers definitions or starts a render.

## Bundling

`bundle` compiles an unevaluated in-memory esbuild generation. Its id hashes
module paths, imports, non-CSS source and loader bytes, and the core's optional
evaluation digest for resolved configuration and CSS Modules; entry and stories lists; preview and renderer;
the configuration directory; repository roots; module resolution settings;
the installed React version; the real source root; and the selected real
dependency roots. Equal head and base sources have separate generations,
class maps, and bindings. The binary uses the id in each fragment key. [Compiled recipes](./mokly-sidecar-modules.md#compiled-recipes-and-release) define replay and release.

The module graph reports the digest of each module's consumed bytes, sources,
and dependencies with imports in source order, including re-exports, dynamic imports, and stylesheets. A file inside
a selected dependency root, a `node_modules` directory, is a dependency on
both sides. JavaScript and CSS imports from it are allowed and use stable
logical names relative to that root, such as `node_modules/pkg/style.css`.
The binary reads them from that dependency root and excludes them from the
catalogue source inventory. Files outside the source root and all selected
dependency roots fail closed unless repository mapping supplies a source copy.

For a real module inside `repositoryRoots` and outside `node_modules`, the
sidecar maps its repository-relative path into `sourceRoot`. This rule
applies to `bundle` and `processCss`, including PostCSS configuration,
plugins, and presets. Missing or escaping mapped sources fail `bundle-failed`
with a logical module path and the importing file's location. The
[module sources contract](./mokly-sidecar-modules.md) defines logical names,
confinement, attribution, and the CSS Modules evaluation order.

The head source root is the working repository. The base source root is the
extracted base commit. Resolution settings select each side's dependency
installation under the [comparison tiers](./mokly-comparison.md#sides).
React and React DOM resolve from that side's configuration directory through
its settings, with one React runtime. The JSX development shim forwards to
the consumer runtime and attaches invocation source only to Mokly wrappers.

`bundle` evaluates nothing. `cssModules` must install all maps before
`describe` evaluates the generation. A bundle or evaluation failure returns
`bundle-failed` with its source and diagnostic. A render without installed
bindings fails closed under the [render records](./mokly-sidecar-render-records.md).

## Style Collection

A render returns styles owned by the rendered component or screen. Emotion
and styled-components use render-local server extraction. The sidecar also
collects `<style>` elements in the fragment. For a persistent registry such
as the React Native Web sheet from `AppRegistry.getApplication`, it returns
only rules whose class selectors match the fragment's class tokens, their
required at-rules and keyframes, and the registry's element-level resets.
Unused rules and rules used only by earlier renders are excluded. Results
are independent of render order. Rules keep first-appearance order.
The binary deduplicates rules by identity across fragments and places them in
the document head before configured stylesheets. Unknown styling libraries
contribute only the `<style>` elements in the fragment.
Page-wide sheets retain their owners. Comparison applies the shared [style
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

A story file is a `*.stories.{ts,tsx,js,jsx}` file matched by a root. The
sidecar loads the consumer's `.storybook/preview` annotations with
`setProjectAnnotations` immediately before each composition, composes each
story without passing the annotations a second time to `composeStories` from
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

`argTypes` never change the prop schema. Their control bounds apply to complete
merged props during live validation. Saved args outside those bounds produce
`props-control-bounds` build warnings. An entry's `options` become
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

The [PostCSS context and evidence contract](./mokly-sidecar-postcss.md) defines
consumer processing, context lifetime, read witnesses, and incomplete coverage.

## Cancellation And Timeouts

The [cancellation rules](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts)
define deadlines, process replacement, and shutdown grace.

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

There is no fallback render and no partial output. Commands that need neither
JavaScript nor PostCSS never start a sidecar or fail for these reasons.

## Security

The sidecar runs consumer code with the consumer build's trust and inherits its environment.
Each PostCSS child puts selected dependency directories before inherited `NODE_PATH` entries. Base dependency installation
disables lifecycle scripts and has a time limit, so no consumer script runs at install time.

## Related Docs

- [Entry props and variants](./mokly-entry-props.md), [Rust core architecture](../architecture/rust-core.md)
- [HTML screens](./mokly-html-screens.md), [Rendering and document assembly](./mokly-rendering.md)
