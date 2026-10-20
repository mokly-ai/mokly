# @mokly/mokly

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`@mokly/mokly` supplies the `mokly` Node shim, the Node render sidecar, and the
JavaScript authoring API. The Rust binary owns catalogue decisions, document
assembly, serving, and file writes. The sidecar bundles and renders consumer
code in memory. Base package imports resolve from their importer's matching
directory in the selected dependency installation. Base source aliases and
tsconfig paths stay with the base files.
Tracked base files beneath `node_modules` supply their base bytes and keep
their dependency role in attribution.

PostCSS children retain raw whole-file and byte-range witnesses beside dependency reports.
Coverage remains incomplete for opaque readers. See the
[PostCSS evidence contract](../../docs/protocol/mokly-sidecar-postcss.md).
Observation starts before consumer preloads. File providers retain their
transformed output and the raw witnesses of underlying observed reads.
Providers that bypass observation retain late baselines.
Local script loading preserves the provider's UTF-8 behavior. Native observation
keeps the separate raw digest before text decoding.

## Install And Run

```bash
npm install --save-dev @mokly/mokly
npx --no-install mokly --help
npx --no-install mokly --version
```

The package ships `config.schema.json` for editor validation and completion.
Set `"$schema": "./node_modules/@mokly/mokly/config.schema.json"` in a
`mokly.config.json` at the consumer root. The native binary reads the same
schema and resolves paths from that configuration file.

The shim resolves `@mokly/viewer/browser` from its own package installation.
It passes that package's built directory to the binary through
`MOKLY_VIEWER_DIST`. The binary serves exactly its browser inventory, stylesheet,
and font. Consumer working-directory layout does not select the viewer.

Serve watches source, style, and referenced resource edits by default.
It updates the open viewer and reloads only documents whose input key changed.
Use `serve --no-watch` to browse one snapshot.

The native binary owns commands and file writes. The render sidecar and the
authoring API share this package under the
[package contract](../../docs/protocol/mokly-package.md).

The supported Node range is `>=22.15.0 <24.14.0 || >=24.19.0`. The shim checks
it before package lookup. Supported hosts are Linux x64 and arm64 with glibc,
macOS x64 and arm64, and Windows x64 with MSVC. Exact optional platform
packages supply the binary. The shim requires the binary's exact package
version and has no JavaScript CLI fallback.

## Authoring

Controls keep explicit declaration order. Derived controls follow schema order
or first-seen prop order. The sidecar carries this order separately from sorted
JSON object keys for the core and viewer.

Export one definition from each export of a matched entry module.

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Invoice",
  description: "A paid invoice.",
  relatedDocs: [],
  props: { state: "paid" },
  render: (props) => <main>{props.state}</main>,
  variants: [
    { slug: "overdue", title: "Overdue", props: { state: "overdue" } },
  ],
});
```

`defineScreen` and `defineComponent` render from props and a
`{ viewport, colorScheme }` context. Components require a literal JSON Schema
and expose a typed `Component` wrapper. `json-schema-to-ts` derives data prop
types. Declared slots hold React nodes separately from data props. Components
can declare `element` to enable HTML invocations.

The root also exports `definePage`, `defineUseCase`, `defineFolder`, `MockLink`,
`mockLink`, `ReviewIgnore`, `ReviewIgnoreScope`, `reviewMaterialKey`, and the
input, definition, configuration, and renderer types. A page callback returns
one complete synchronous HTML string. React and React DOM are optional peers;
React authoring resolves both from the consumer. HTML-only catalogues need
neither package. They start a sidecar when configured PostCSS processes CSS.

The package ships the authoring guides and protocol sources as Markdown.
Read the [source guide](../../docs/guides/authoring/screens.md) and
[sidecar contract](../../docs/protocol/mokly-sidecar.md).

## Sidecar Boundary

The Rust pool starts `dist/sidecar.js` with inherited environment and piped
NDJSON. Hello reports this package's exact version. Frames have a 64 MiB JSON
byte limit. Oversized compiled recipes report their size and that limit as
`bundle-failed`. A separate thread watches the parent pipe and parent identity,
so a blocked render cannot leave a sidecar behind. Requests run in order. Consumer logs go to standard error.
Closed parent output pipes and IPC channels stop the sidecar and PostCSS child
quietly. Late writes do not add a crash stack to consumer diagnostics.
The optional `hello.params.timings` boolean enables process-local timing JSON on
stderr. Bundle, describe, render, and PostCSS spans contain no authored data.
Bundle child spans separate compilation, module-graph construction, consumed
input hashing, and resolution metadata. Each keeps the enclosing bundle id.
Records start on a separate line after partial Node stderr writes. The core
redacts tokens and escapes controls in forwarded lines; ordinary timing records
retain their bytes. After child exit, completion drains stderr within the shared
shutdown deadline, also for a worker that cancellation killed first. A child
still running at the deadline is killed; completion then waits only for its
reaper. A late drain causes a tree kill without another drain wait.

`bundle` compiles an unevaluated esbuild generation and reports its immutable
compiled recipe for replay. The recipe keeps dependency-lookup provenance
for fallback diagnostics after restoration. Evaluation-only changes reuse that compilation across slots and recycling.
Resolution stamps include ancestor manifests, tsconfig candidates, and directory
membership. Failed peer resolutions remain failures during replay.
`restoreGeneration` installs retained code in a new sidecar without reading
current sources. Worker operation events count actual compilations and
PostCSS worker lifetimes. The result also reports its module
graph with stable names for selected installation files. Module digests
use the recorded compiler inputs, including text imports and
files loaded through data import attributes. Unrecorded compiler inputs fail
the bundle instead of receiving a digest from a later read. Repository-owned
workspace packages and PostCSS presets use the side's own source copy.
`cssModules` installs the core's class maps before evaluation and runs no
compiler. CSS import stubs read that table at evaluation. The default export
is the complete map. Each valid, non-reserved identifier key is also a named
export. Runtime style adapters capture the bundled consumer libraries in the
same compilation. Subpath imports select their own package's registry, and
wrappers preserve CommonJS default-import interop within the Mokly bundle:
Node's rule for `.mjs` and `.mts`, the `__esModule` default otherwise.
Bundle parsing ignores package `type` and tsconfig parse settings. Set
`@jsxImportSource` in a module when it needs another JSX runtime; a tsconfig
`jsxImportSource` does not apply. Source-side tsconfig paths still guide resolution.
`describe` inventories every definition and Storybook story and reports
generation warnings. `bindings` installs resolved paths and titles before a
render. Render methods return HTML text, collected styles, resources, typed
instance and slot drafts, and render warnings. Registered wrappers check dynamic
data props with the viewer's profile validator before calling their adapters.
The Rust core rechecks every returned instance against its registered schema.
Nested supplied slots share one encounter order per original input scope;
repeated placements keep that
input's order. A consumer
renderer wraps React screens and components and must default-export a function.
Bundle diagnostics use the compiler's source coordinates and reason without
its framing text. Runtime style adapters follow consumer package aliases,
including `react-native` mapped to `react-native-web`. Portable stories use the
consumer's `@storybook/react` annotations and decorators. PostCSS runs in a
child process in the side's source root, with consumer plugins unbundled.
A child watchdog stops even a blocked plugin after its sidecar dies.
Operation events count each fork and its terminal event once.
The child puts selected dependency directories before inherited `NODE_PATH` entries. `dispose` releases a bundle, `disposeContext` releases one PostCSS context,
and `shutdown` releases all state.
Sidecars and PostCSS children set `PWD` to their source directory and omit
`INIT_CWD`, `npm_package_json`, and `npm_config_local_prefix`.

## Development

From the workspace root:

```bash
npm run build
node --import tsx --test tests/sidecar_methods.test.ts
cargo test -p mokly-sidecar
```

The package `prepack` builds the viewer before the authoring declarations.
Release packing prepares the viewer archive before the CLI archive. It packs
a new viewer release or downloads the exact published viewer for a CLI-only release.
The package build emits ESM JavaScript and declarations, the sidecar entry and
PostCSS child entry, the shim, and packaged Markdown. Each build clears stale package
output and copied docs first. The package includes the complete guide and
protocol trees, their public receiver fixtures, and the root changelog history.
Release Please writes the root `CHANGELOG.md`; the build copies it into the
package. Copied docs, the package changelog, and build output stay ignored.
Key code: [authoring](./src/authoring/definitions.ts),
[sidecar](./src/sidecar/session.ts), and the
[Rust pool](../../crates/mokly-sidecar/README.md).
The [PostCSS preload](./src/sidecar/postcss-preload.ts) installs observation
before consumer preloads in each owned child.
Its CommonJS build supports asynchronous loaders on Node 22 and shares one
observation ledger with the worker. Loader-transformed source stays opaque.
The [descriptor observer](./src/sidecar/postcss-read-descriptors.ts) tracks
file positions and reuse. FileHandle and Node stream reads share range evidence.
The [file identity observer](./src/sidecar/postcss-file-identity.ts) binds
witnesses to opened files. [Descriptor sharing](./src/sidecar/postcss-read-sharing.ts)
keeps unobservable cursor changes opaque.
The [resolution inventory](./src/sidecar/postcss-resolution-evidence.ts) retains
known native manifest paths for late checks without inventing consumed bytes.

On POSIX, the shim forwards SIGINT, SIGTERM, and SIGHUP. On Windows, it keeps
its SIGINT and SIGBREAK listeners alive while the binary receives the shared
console signals directly.
