# @mokly/mokly

Status: The [Serve plan change](../../plans/serve-plan-editor-invalidation.md) adds the path table and candidate names described here.

`@mokly/mokly` is the Mokly command-line tool and authoring API. Mokly turns
product screens into a searchable static catalogue. A screen is an HTML file
with YAML front matter, a React component, or a Storybook story. Mokly renders
every screen at mobile and desktop sizes, in light and dark, and shows which
screens changed between two Git commits.

The package holds the `mokly` command, the JavaScript authoring API, and the
render sidecar, the Node process that runs your JavaScript. A Rust binary does
the catalogue work. npm installs that binary from the `@mokly/native-<target>`
package that matches your system. The catalogue viewer comes from
[`@mokly/viewer`](https://www.npmjs.com/package/@mokly/viewer), at the exact
version that this package depends on.

## Install

Mokly needs Node.js `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`:
22.15 or newer, excluding Node 23 and Node 24.14 through 24.18. The binary
ships for Linux x64 and arm64 with glibc, macOS x64 and arm64, and Windows x64.

```bash
npm install --save-dev @mokly/mokly
```

The binary comes from an optional dependency, so keep optional dependencies
enabled when you install. React and React DOM 19 or newer are optional peer
dependencies. Install them only when screens or components are written in
React. A catalogue of HTML files needs neither package.

## Configure

Create `mokly.config.json` in your repository root:

```json
{
  "$schema": "./node_modules/@mokly/mokly/config.schema.json",
  "colorSchemes": ["light", "dark"],
  "roots": [
    { "dir": "specs" },
    { "dir": "packages/ui/src", "path": "components" }
  ]
}
```

Mokly searches upward for `mokly.config.json`, or reads the file that
`--config` names. Filesystem paths, such as each root's `dir`, resolve from the
configuration file. Each root's `files` globs resolve from that root, and
`watch.rules` paths resolve from the repository root. Without `roots`,
Mokly reads the `specs` directory beside the file. `$schema` gives your editor
validation and completion from the schema that this package ships. The
[configuration guide](../../docs/guides/authoring/config.md) describes every
field.

## Add a Screen

Create `specs/account/invoice.mockup.tsx`:

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

With the default `specs` root, the screen's path is `account/invoice`, and
`account/invoice/overdue` is its variant. An HTML screen needs no JavaScript:
it is a `.screen.html` file with YAML front matter.

The package also exports `defineComponent`, `definePage`, `defineUseCase`,
`defineFolder`, `MockLink`, `mockLink`, `ReviewIgnore`, `ReviewIgnoreScope`,
`reviewMaterialKey`, and the input, definition, configuration, and renderer
types.

## Commands

Run the installed executable with `npx --no-install mokly`. Options follow the
command, for example `npx --no-install mokly serve --port 0`.

| Command           | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `mokly serve`     | Serve the catalogue, render on demand, and watch for changes     |
| `mokly build`     | Validate, render every view, and write the static site           |
| `mokly publish`   | Build into a private directory and upload to a catalogue service |
| `mokly --help`    | Show every command and option                                    |
| `mokly --version` | Show the installed package version                               |

`mokly` without a command runs `serve`. `serve --open` opens the catalogue in
a browser, and `serve --no-watch` serves one snapshot without watching.
`build` writes `mokly-static/` at the repository root, or the directory that
`--out` names, and keeps a `.mokly-export-reservations/` directory beside it.
Git must ignore both. `publish` needs a clean Git checkout, and it reads the
receiver's endpoint and token from `MOKLY_ENDPOINT` and `MOKLY_TOKEN`. The
[options and exit status guide](../../docs/guides/cli/options-and-exit-status.md)
lists every option.

## How Mokly Runs Your Code

The Rust binary reads the configuration, composes HTML screens and Markdown
documents, assembles every document, serves the catalogue, and writes the
static site. JavaScript runs only in the render sidecar. The sidecar bundles
your entry modules and your renderer module with your module resolution and
your own React. It also runs your PostCSS module on local stylesheets. A
catalogue of HTML files without a renderer or a PostCSS module starts no
sidecar.

The [render sidecar contract](../../docs/protocol/mokly-sidecar.md), the
[module sources contract](../../docs/protocol/mokly-sidecar-modules.md), and
the [PostCSS contract](../../docs/protocol/mokly-imported-styles-postcss.md)
define this boundary.

## Documentation

The package ships the guides and the protocol documents as Markdown.

- Get started: [install](../../docs/guides/start/install.md),
  [configure](../../docs/guides/start/configure.md), and
  [your first screen](../../docs/guides/start/your-first-screen.md)
- Author the catalogue: [screens](../../docs/guides/authoring/screens.md),
  [components](../../docs/guides/authoring/components.md),
  [Storybook stories](../../docs/guides/authoring/storybook.md),
  [pages and documents](../../docs/guides/authoring/pages.md),
  [use-case flows](../../docs/guides/authoring/use-case-flows.md), and
  [styles](../../docs/guides/authoring/styles.md)
- Use the catalogue: [browse](../../docs/guides/catalogue/browse.md),
  [Changes](../../docs/guides/catalogue/changes.md), and
  [build and host](../../docs/guides/catalogue/export-and-host.md)
- Run the commands: [`serve`](../../docs/guides/cli/serve.md),
  [`build`](../../docs/guides/cli/build.md), and
  [`publish`](../../docs/guides/cli/publish.md)
- Publish from CI: [the guide](../../docs/guides/ci/publish-from-ci.md) and
  the [GitHub Action](../../.github/actions/publish/README.md)
- Read the specifications: the
  [protocol index](../../docs/protocol/README.md) and the
  [package contract](../../docs/protocol/mokly-package.md)

## Development

From the repository root:

```bash
npm run build
node --import tsx --test tests/sidecar_methods.test.ts
cargo test -p mokly-sidecar
```

`npm run build` builds the host native binary, the UI package, the viewer, and
this package. The [release contract](../../docs/protocol/npm-release.md) defines
the packed contents of the package.

### Key Code

- [`bin/mokly.mjs`](./bin/mokly.mjs) is the `mokly` executable, which runs the
  shim and reports a startup failure on standard error.
- [`src/shim.mjs`](./src/shim.mjs) holds `runShim`, which checks the Node
  version, selects the platform package, and requires its exact version.
- [`src/runtime.mjs`](./src/runtime.mjs) holds `systemRuntime`, which passes
  the package root, the Node executable, and the viewer build to the binary.
- [`src/execution.mjs`](./src/execution.mjs) holds `executeNative`, which runs
  the binary with inherited standard streams and handles interrupt signals.
- [`src/index.ts`](./src/index.ts) is the public authoring API.
- [`src/authoring/definitions.ts`](./src/authoring/definitions.ts) holds the
  `define*` helpers that turn authored input into catalogue definitions.
- [`config.schema.json`](./config.schema.json) is the configuration schema,
  which the binary embeds and enforces.
- [`src/sidecar.ts`](./src/sidecar.ts) is the sidecar process entry, which
  reads framed requests from the binary and writes one response for each.
- [`src/sidecar/session.ts`](./src/sidecar/session.ts) holds `Session`, which
  dispatches each sidecar request to its method. It removes the request-only
  `capture` and `plan` values of a `bundle` request before the reuse check,
  the compile, the identity, and the restore see the settings. It gives a
  `CaptureDurability` only to a `full` request.
- [`src/sidecar/transport.ts`](./src/sidecar/transport.ts) splits and decodes
  the binary's typed requests and limits the size of each response.
- [`src/sidecar/bundle.ts`](./src/sidecar/bundle.ts) holds `bundle`, which
  compiles the catalogue modules. Each call shares its read bytes across
  attempts, while each attempt keeps its own consumed-file and CSS-module
  records. esbuild resolves most imports itself, and
  [`src/sidecar/native-plan.ts`](./src/sidecar/native-plan.ts) classifies the
  result. It plans a second compile when esbuild's own resolution would change
  the bundle. Its `planNative` keys each planned import by importer,
  specifier, and import kind, and it reports whether the native compile is
  exact. A failed native compile compiles again with full resolution. The
  resolve callback of `consumerPlugins` in
  [`src/sidecar/plugins.ts`](./src/sidecar/plugins.ts) applies the resolution
  mode of
  [`src/sidecar/native-resolution.ts`](./src/sidecar/native-resolution.ts). A
  planned compile resolves each import outside its plan with the full
  resolver. A `full` call keeps the native plan, also of an exact native
  compile. A `serveEdit` call with a plan runs one planned compile with that
  plan and no native compile. In a `full` call, one evidence owner and one
  preparation serve every attempt. A `serveEdit` call creates no evidence
  owner, no evidence plugin, and no durability check. It still records the
  consumed sources, the module graph, the metadata digests, and the directory
  lists.
  [`src/sidecar/bundle-entry.ts`](./src/sidecar/bundle-entry.ts) builds the
  virtual entry module. Without a captured preview selection, a `serveEdit`
  call selects only a regular preview file.
- [`src/sidecar/bundle-recipe.ts`](./src/sidecar/bundle-recipe.ts) holds
  `bundleRecipe`, which turns one compile into its compiled recipe: the module
  graph, the input digests, the reuse evidence, the toolchain identity, and
  the compilation identity. An incomplete recipe gets a fresh identity, also
  when `checkRecipeSize` in
  [`src/sidecar/recipe-size.ts`](./src/sidecar/recipe-size.ts) drops its
  evidence to fit a frame. `checkRecipeSize` drops the optional plan of the
  result before it drops the evidence. A `serveEdit` compile gets empty,
  incomplete evidence with the `uncaptured: "serveEdit"` marker. A compile
  without a toolchain identity gets no marker.
- [`src/sidecar/captured-plan.ts`](./src/sidecar/captured-plan.ts) holds
  `capturedPlan`, which gives the result of a `full` compile its native plan
  only with complete, durable, and unmarked evidence. It lists each path of
  the plan once in its path table, and it adds the candidate names of the
  recorded directories. The plan, its candidate names, and the evidence must
  fit 8 MiB together. It counts their JSON bytes without building an
  oversized string.
- [`src/sidecar/compiled.ts`](./src/sidecar/compiled.ts) holds `reuse`, which
  accepts an earlier compilation only while its settings, dependency roots,
  toolchain, input digests, and directory lists still match. It tries the
  captured compilations first, and also checks their reuse evidence. Then a
  `serveEdit` request tries the marked compilations with these live checks
  alone. A `full` request never takes a marked compilation. Its `restore`
  installs a recipe without a compile.
- [`src/sidecar/toolchain.ts`](./src/sidecar/toolchain.ts) holds
  `toolchainIdentity`, which each sidecar process computes once from the
  package root, the Mokly, esbuild, and Node versions, and every `dist/` file.
- [`src/sidecar/resolution-evidence.ts`](./src/sidecar/resolution-evidence.ts)
  holds `ResolutionEvidence`, the esbuild plugin that records the candidate
  directories, manifests, and configurations of each import before esbuild
  resolves it. A form that it cannot map makes the evidence incomplete. With
  esbuild 0.28.2, it also collects the candidate names that esbuild can look
  up in each recorded directory. A directory whose names it cannot derive, or
  that has a non-ASCII candidate or recorded entry name, gets none. The reuse evidence itself
  keeps whole directory listings.
  [`src/sidecar/resolution-request.ts`](./src/sidecar/resolution-request.ts)
  applies written plugin names and aliases before built-in filtering.
  [`src/sidecar/config-inputs.ts`](./src/sidecar/config-inputs.ts) records
  each `tsconfig.json` or `jsconfig.json` and its `extends` chain, and
  [`src/sidecar/config-json.ts`](./src/sidecar/config-json.ts) parses JSON
  with comments and trailing commas.
- [`src/sidecar/physical-inputs.ts`](./src/sidecar/physical-inputs.ts) holds
  `PhysicalInputs`, the one owner of the evidence reads. It reads each
  metadata file within 1 MiB, parses the configurations, and queues each
  unique resolution request once. Each queued capture uses synchronous
  filesystem reads before esbuild resolves the import. Its retained
  observations, metadata read bytes, visited paths, and request keys each stay
  within 8 MiB. Each charged visited path keeps its first-touch kind. Later
  presence and kind probes of the same capture use that kind, but metadata
  content and link targets are still read. `currentEvidence` reads the
  evidence again for a reuse check, with no saved kind. The protected
  filesystem operations of the same owner are in
  [`src/sidecar/physical-input-reader.ts`](./src/sidecar/physical-input-reader.ts),
  which uses bounded reads and `realpathSync.native` for canonical paths. Its
  `pathKinds` map holds the first-touch kinds, of the `CaptureKind` type in
  [`src/sidecar/capture-kind.ts`](./src/sidecar/capture-kind.ts).
  [`src/sidecar/file-digests.ts`](./src/sidecar/file-digests.ts) streams each
  file digest through one 64 KiB buffer and checks inputs with four workers.
- [`src/sidecar/capture-durability.ts`](./src/sidecar/capture-durability.ts)
  holds `CaptureDurability`, which decides the `durable` flag of the reuse
  evidence when `hello` carries a `capture` hint. Before the first observation
  of a compile, it can wait once, until at most 50 ms after the compile starts.
  It records the stamps and the identity of each directory and metadata file
  at the first touch, and it reads them again after the last attempt. It never
  changes `complete`.
  [`src/sidecar/capture-paths.ts`](./src/sidecar/capture-paths.ts) follows raw
  link targets and observes their parent directories within the same path bound.
  Through `CaptureDurability.sharePaths`, `CapturePaths.share` borrows the kinds
  that the physical owner already charged and witnessed. A repeat of a
  successful whole walk checks its recorded expansion charge again.
  `CaptureDurability.finish` still reads each witness afresh.
  [`src/sidecar/capture-runtime.ts`](./src/sidecar/capture-runtime.ts) holds
  the stat and clock boundary and the age guard. On Windows, its
  `captureSnapshot` reads a witness through `handleStat`, a read-only handle
  stat, because some libuv versions report a wrong device for a path stat.
  `sameCaptureStat` compares a witness with its recheck.
  [`src/sidecar/capture-volumes.ts`](./src/sidecar/capture-volumes.ts)
  classifies each volume by its Linux file system type or by the hint.
- [`src/sidecar/postcss.ts`](./src/sidecar/postcss.ts) holds `PostcssWorkers`,
  which owns the PostCSS child processes.
- [`src/generated/sidecar`](./src/generated/sidecar) holds the request and
  result types that `cargo xtask generate-types` writes from the Rust types.
- [`scripts/build.mjs`](./scripts/build.mjs) builds `dist/` and copies the
  guides, the protocol documents, and the root changelog into the package.
- The [Rust sidecar pool](../../crates/mokly-sidecar/README.md) starts and
  stops the sidecar processes.

## License

Mokly is available under the [MIT License](./LICENSE).
