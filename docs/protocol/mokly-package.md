# Mokly Package And Authoring Contract

## Scope

Mokly is shared developer tooling for repositories that keep visual mockups
as code. The package owns catalogue definitions, rendering, validation,
browsing, comparisons, the static build, and publication. A consumer owns all
product screens, product copy, product components, styling, theme setup, and
hosting.

The package must be usable by structurally different applications without
importing them or recognizing application-specific route names. Synthetic
screens may exist only under examples and test fixtures.

## Packages

| Package                  | Contents                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mokly/mokly`           | the Node shim that resolves and runs the `mokly` binary, the render sidecar entry, the JavaScript authoring API, the guides, and the protocol documents |
| `@mokly/native-<target>` | one `mokly` binary per platform: `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, and `win32-x64-msvc`                                 |
| `@mokly/viewer`          | the Browse shell, rendered in the browser, and the readers of the catalogue index and entry detail                                                      |

`@mokly/mokly` lists the five platform packages as exact optional
dependencies and depends on the exact coordinated `@mokly/viewer` version. It
declares `react` and `react-dom` `>=19.0.0` as peer dependencies, needed only
when screens or components are written in React; an HTML-only catalogue runs
without them and never starts the sidecar. The shim requires a version in the
[supported Node range](#node-support) and rejects another version with an actionable error before it starts
the binary. It resolves the platform package for the current platform,
requires its version to equal the CLI package version, and runs the binary
with inherited standard streams; it never falls back to a JavaScript
implementation. The binary owns every command and every file write under the
[Rust core architecture](../architecture/rust-core.md), and it starts the
[render sidecar](./mokly-sidecar.md) only when a catalogue needs JavaScript.
The [package boundary](../architecture/package-boundary.md) names what each
package may depend on.

## Node Support

The supported range is `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`.
Node 23 is unsupported. The shim rejects it before package lookup or native
execution, so accepted runtimes retain the PostCSS dependency evidence hooks.
The floor is 22.15.0. Node 24.14.0 through 24.18.x are also unsupported.
The [CI workflow contract](./ci-workflow.md#runtime-profiles) defines the tested representatives.

Node 24.14.0 through 24.18.x can abort concurrent ESM-to-CommonJS loading before
JavaScript can handle an error. The upstream
[`cjs_lexer::Parse` empty-`MaybeLocal` fix](https://github.com/nodejs/node/pull/63885)
shipped in Node 24.19.0. The shim and sidecar run on the consumer's Node, so
the shim rejects affected versions before it resolves the binary.

## Package Identity

- The public package name is `@mokly/mokly`.
- The package exposes one executable named `mokly`.
- With no subcommand, the executable runs watched Browse mode.
- Install with `npm install --save-dev @mokly/mokly`, adding `react` and
  `react-dom` for React authoring, then use `npx mokly`. Zero-install usage
  explicitly selects the scoped package with `npx --package @mokly/mokly mokly`.
- The scoped package is always public. Mokly is its author, and the `mokly`
  npm organization manages approved maintainer-team access and the release
  workflow.
- The unscoped `mokly`, `mokabook`, and `mockbook` names are not package
  aliases. The latter two are not executable aliases either. Config discovery uses `mokly.config.json`, and `MOKLY_*` environment variables do not include
  the npm scope.

## CLI

The public commands are:

```text
mokly                 Alias for `mokly serve`
mokly serve           Serve the catalogue and comparisons; watch by default
mokly build           Validate, render every view, and write the static site
mokly publish         Build into a private directory and upload
mokly --help          Show commands, options, and config discovery
mokly --version       Show the installed package version
```

An explicit command comes first and its options follow it. Options before an
explicit command fail. Without a command, Serve options follow `mokly`.
The [help and version contract](./mokly-terminal-help.md) defines their exact
stdout bytes, including `-v` and the bare package version.

`serve` and `build` are the two verbs. `build` validates the catalogue,
renders every view, fails on errors and, with `--strict`, on warnings, and
writes the static output into the directory `--out` names, `mokly-static/`
at the repository root by default, which Git must ignore; the
[static build contract](./mokly-export.md) owns that output. `publish` runs
the same build into its own directory outside the repository and uploads the
result under the [upload contract](./mokly-upload.md); it accepts `--strict`
too. Serve refuses `--strict`. There is no `check`, `export`, or `review`
command: a validation-only run is `build --strict` into a temporary
directory. Every warning follows the count and failure boundary in
[Build Warnings](./mokly-build-warnings.md).

Common options are `--config <path>`, `--sidecars <n>` under the sidecar
contract, and the opt-in `--debug-timings` of the
[diagnostic contract](./mokly-timings.md). Serve accepts `--port`, `--base`,
`--watch`, `--no-watch`, and `--open`. `build` accepts `--out`, `--base`, `--strict`, and `--no-changes`. `publish`
accepts `--base`, `--no-changes`, and the options of the upload contract; it
has no `--out`. `--out` on `serve` is rejected. Screen comparisons are requested
from the catalogue. A flag after the package name belongs to Mokly; docs must
show npx arguments in a form that is unambiguous to current npm.

Every long option taking a value accepts `--name=value` as well as
`--name value`. Split at the first `=` only. Assigned values may start with
`-`; separate values may not. Empty values, unknown options and assignments
to boolean flags (including `--help=false`) fail. The same value validation
and command restrictions apply to both forms; short flags do not take
assignments.

Serve uses `4173` as its default starting port. An occupied concrete starting
port advances one at a time through `65535` until binding succeeds;
exhausting that range fails. Port `0` delegates free-port selection to the
operating system.

Unknown commands, invalid values, absent configuration, and invalid catalogue
data exit non-zero. Expected author errors do not print stacks unless
diagnostic output is explicitly requested.

No command writes into the repository except `build` into its output
directory. The [runtime contract](./mokly-runtime.md#render-graph-and-cache)
owns the caches outside the repository.

The [terminal output contract](./mokly-terminal-output.md) defines plain
output compatibility, rich progress, errors and
[build warnings](./mokly-build-warnings.md), watched lifecycle events,
keyboard shortcuts, and browser opening. `--help` and `--version` print
plain text and do not render progress in either output mode.

## Configuration Discovery

Mokly searches upward for `mokly.config.json`, unless `--config` names
another JSON file. Filesystem fields resolve relative to that config file.
The [configuration contract](./mokly-configuration.md) defines the complete
shape, its JSON Schema, path validation, source and public-file boundaries,
and individual field behavior.

Only referenced, validated closure assets are served and built; see the
[public closure policy](./mokly-public-closure.md).

Two layouts are recommended. A dedicated spec tree uses the default `specs`
root for screens, components, pages, Markdown documents, and flows by product
area, with `renderer: "specs/renderer.tsx"` when React screens need the
product's providers; the stylesheets, fonts, and images the documents
reference become public through the referenced closure. A component library
adds a second root such as `{ dir: "packages/ui/src", path: "components" }` so component
mockups stay beside component code. The co-located alternative places every
mockup beside the product code it describes, for example
`roots: [{ dir: "src/features", transparent: ["__mockups__"] }]`. Both
layouts derive the same catalogue paths; source protection applies to every
layout. These are examples, not mandatory runtime locations. A root's `files`
globs define the complete entry shape with no additional suffix filter; the
[root field contract](./mokly-root-discovery.md#root-fields) gives the default
patterns.

## Public Authoring API

The [authoring contract](./mokly-authoring.md) defines the exported helpers
and input types, path identity, derived file names, and catalogue links. The
[HTML screens contract](./mokly-html-screens.md) defines the authoring form
that needs no JavaScript.

## Rendering Boundary

The Rust core composes HTML screens and components, pages, and documents and
assembles every document. JavaScript renders only in the
[render sidecar](./mokly-sidecar.md). The
[rendering contract](./mokly-rendering.md#rendering-boundary) defines the
consumer renderer module that wraps React renders, React resolution, and
stylesheet application.

## Documents And Routes

Served and built documents live under the `static/mokly-generated/<route>`
namespace of the [artifact path contract](./mokly-artifact-paths.md); the
namespace is a route prefix, not a repository directory. Serve and `build`
deliver the shell stub, the catalogue index, and one entry detail per entry
under the [shell delivery contract](./mokly-shell-delivery.md). The
[imported-styles contract](./mokly-imported-styles.md) defines bundled CSS
and binary assets and their routes.

## Pages And Comparisons

Register a complete synchronous HTML document with `definePage`, or write a
`.page.html` file; Markdown documents need no registration. The
[page contract](./mokly-pages.md) defines the public page inputs, the
document rules, derived paths, inheritance, and schema validation.

Comparisons render both sides from sources with the current Mokly version:
the head from the working tree and the base from the base commit's Git tree
under the [comparison contract](./mokly-comparison.md). A base whose sources
fail the current validation makes Changes unavailable with those
diagnostics; it never fails the current output.

## Packaged Documentation

The `@mokly/mokly` package ships the CLI guides and the protocol documents, and
the package version is the documentation version. The
[guides contract](./mokly-guides.md) defines the source tree,
frontmatter, sections, link mapping, published Reference allowlist,
release-managed version literals, and package boundary.

## Non-Goals

- Owning or publishing consumer application screens.
- Replacing a consumer's product component library or design tokens.
- Deploying a hosted Mokly service.
- Hydrating product fragments into interactive application replicas.
- Requiring a monorepo, npm-workspace layout, or one fixed mockup directory.

## Related Docs

- [Rust core architecture](../architecture/rust-core.md)
- [Package and consumer boundary](../architecture/package-boundary.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Static build](./mokly-export.md) and [upload](./mokly-upload.md)
- [Packaged CLI guides](./mokly-guides.md)
- [CI and npm release](./npm-release.md)

## Native Runtime Inputs

The shim passes `MOKLY_PACKAGE_ROOT` as the executing `@mokly/mokly` package
root and `MOKLY_NODE_EXECUTABLE` as its `process.execPath`. The binary starts
`dist/sidecar.js` from that package with the resolved repository as its working
directory. An HTML-only catalogue without a renderer or configured PostCSS needs neither
Node nor a sidecar entry. Configured PostCSS starts a sidecar when the CSS
pipeline processes a stylesheet. Direct binary execution uses `node` from
`PATH` when `MOKLY_NODE_EXECUTABLE` is absent. It first checks the adjacent installed package, then
walks invocation-directory and executable ancestors for
`node_modules/@mokly/mokly/dist/sidecar.js` or `packages/mokly/dist/sidecar.js`.
These inputs do not select a consumer React runtime; consumer resolution
follows the configuration and base dependency contracts.

The shim also passes `MOKLY_VIEWER_DIST`, the directory of the
`@mokly/viewer/browser` build that its own installation resolves. The binary
serves exactly that build's browser inventory, stylesheet, and font, so the
consumer's working directory never selects the viewer.

The binary's version is the `@mokly/mokly` package version. The binary sends
that version in the sidecar hello. Cargo crate versions do not determine the
published Mokly package version.
