# @mokly/mokly

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
`--config` names. Paths resolve from the configuration file. Without `roots`,
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

`npm run build` builds the host native binary, the viewer, and this package.
The [release contract](../../docs/protocol/npm-release.md) defines the packed
contents of the package.

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
  dispatches each sidecar request to its method.
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
