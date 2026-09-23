# Mokly Package And Authoring Contract

## Scope

Mokly is shared developer tooling for repositories that keep visual mockups
as code with optional Git-tracked static artifacts. The package owns catalogue definitions,
generation, validation, browsing, and on-demand comparisons. A consumer owns all product
screens, product copy, product components, styling, theme setup, and generated
product output.

The package must be usable by structurally different applications without
importing them or recognizing application-specific route names. Synthetic screens
may exist only under examples and test fixtures.

## Delivery Status

This document describes implemented pre-release package and authoring behavior.
The catalogue-link implementation and its verification history are recorded in
the completed
[in-frame catalogue link navigation plan](../../plans/in-frame-catalogue-link-navigation.md).

[Whole-document pages](./mokly-pages.md) use the same IDs and hierarchy as
screens and flows. Current manifests require v6. The
[breaking migration](./mokly-page-migration.md) removes legacy configuration,
discovery, and rendering adapters; consumers use ordinary page definitions.
The co-located layout below, discovered through `entries` globs, was delivered
by the [co-located entry discovery plan](../../plans/co-located-entry-discovery.md).

## Package Identity

- The public package name is `@mokly/mokly`.
- The package exposes one executable named `mokly`.
- With no subcommand, the executable runs watched Browse mode.
- Install with `npm install --save-dev @mokly/mokly react react-dom`, then use
  `npx mokly`. Zero-install usage explicitly selects the scoped package with
  `npx --package @mokly/mokly mokly`.
- The scoped package is always public. Mokly is its author, and the `mokly`
  npm organization manages approved maintainer-team access and the release
  workflow.
- The unscoped `mokly`, `mokabook`, and `mockbook` names are not package aliases.
  The latter two are not executable aliases either. Config discovery continues
  to use `mokly.config.*`; generator identities, plain generated markers, and
  `MOKLY_*` environment variables do not include the npm scope.

The initial supported runtime is Node.js 22.14 or newer. CI must exercise the
minimum supported release and the current Firna release runtime. Unsupported
Node versions fail immediately with an actionable version error.

## CLI

The public commands are:

```text
mokly                 Alias for `mokly serve`
mokly serve           Serve the catalogue and diffs; watch by default
mokly build           Generate static artifacts and the manifest
mokly build --watch   Generate and update output when inputs change
mokly check           Validate source; compare disk only when output is tracked
mokly export --out <path>  Build a complete static catalogue for hosting
mokly publish         Export and upload to a configured catalogue service
mokly --help          Show commands, options, and config discovery
mokly --version       Show the installed package version
```

Common options include `--config <path>` and opt-in `--debug-timings`
([diagnostic contract](./mokly-timings.md)). Serve accepts `--port`, `--base`,
`--watch`, `--no-watch`, `--build`, and `--open`. Build accepts `--watch`.
Export requires `--out` and accepts `--base`;
Publish accepts an optional `--out` and the options in the
[upload contract](./mokly-upload.md). `--out` on other commands and the removed
`review` command are rejected.
Screen comparisons are requested from the catalogue. A flag after
the package name belongs to Mokly; docs must show npx arguments in a form
that is unambiguous to current npm.

Every long option taking a value accepts `--name=value` as well as
`--name value`. Split at the first `=` only. Assigned values may start with `-`;
separate values may not. Empty values, unknown options and assignments to
boolean flags (including `--help=false`) fail. The same value validation and
command restrictions apply to both forms; short flags do not take assignments.

The consumer `export` command and its config-relative `--out` option follow the
[static export contract](./mokly-export.md). It compiles without writing to
the catalogue, packages
comparisons using the configured or overridden Git base, and never uploads.
It adds no public JavaScript API or hosting-provider dependency.

Serve uses `4173` as its default starting port. An occupied concrete starting
port advances one at a time through `65535` until binding succeeds; exhausting
that range fails. Port `0` delegates free-port selection to the operating
system.

Unknown commands, invalid values, absent configuration, and invalid catalogue
data exit non-zero. Expected author errors do not print JavaScript stacks unless
diagnostic output is explicitly requested.

The [terminal output contract](./mokly-terminal-output.md) defines plain output
compatibility, rich progress and errors, watched lifecycle events, keyboard
shortcuts, and browser opening. `--help` and `--version` retain their established
bytes and do not render progress in either output mode.

## Configuration Discovery

Mokly searches upward for `mokly.config.ts`, `.mts`, `.js`, or `.mjs`, unless
`--config` is supplied. Filesystem fields resolve relative to that config file.
The [configuration contract](./mokly-configuration.md) defines the complete typed
shape, path validation, source/output boundaries, and individual field behavior.

Only referenced, validated closure assets are served and exported; see
[generated output](./mokly-generated-output.md#closure-urls-and-publication).

Two layouts are recommended. Sibling source and output directories use
`entriesDir: "docs/mockups/entries"`, `mockupsDir: "docs/mockups"`,
and `renderer: "docs/mockups/renderer.tsx"` for a repository-root config, with
referenced authored assets in the catalogue and generated pages only in
`.generated/`. Co-located entries use `entries: ["src/**/*.mockup.{ts,tsx}"]` so
each entry module sits beside the product component or screen it describes,
with the same output and renderer locations. Nested `docs/mockups/src` layouts
remain supported; source protection applies to every layout. These are
examples, not mandatory runtime locations. An explicit `entries` glob defines
the complete entry shape with no additional suffix filter. The `.mockup.ts` and
`.mockup.tsx` convention remains recommended, and `entriesDir` selects it by
expanding to `<dir>/**/*.mockup.{ts,tsx}`. See
[entry discovery](./mokly-configuration.md#entry-discovery).

## Public Authoring API

The [authoring contract](./mokly-authoring.md) defines exported helpers and
input types, hierarchy, routes, and catalogue links.

## Rendering Boundary

The [rendering contract](./mokly-rendering.md#rendering-boundary) defines the
consumer renderer, React resolution, stylesheet application, and validation.

### Temporary Document Compatibility

The [temporary transformer contract](./mokly-rendering.md#temporary-document-compatibility)
defines the consumer cutover adapter and its route/link constraints.

## Generated Contract

The [generated-output contract](./mokly-generated-output.md) defines
fragments, manifest v6, deterministic ordering, Git tracking and asset closure.

## Page Migration And Historical Comparisons

`legacy` configuration is rejected, including an explicitly undefined value.
Register complete synchronous HTML with `definePage` or nested `page`; move
comment components, source allowlists, and stage policy into consumer code.
The [migration contract](./mokly-page-migration.md) specifies safe archival
of verified old artifacts without weakening source protection.

Current reads accept only canonical `.generated/mokly-manifest.json` schema v6 with a
`mokly` generator identity and validate the
[resolved source inventory](./mokly-source-protection.md). Git comparisons
prefer that filename, then accept the former `mokabook-manifest.json` and
normalize its `mokabook` generator identity. They accept v5, historical v3, and
both disjoint historical v4 formats. A v2 `mockbook-manifest.json` is considered
only when both newer historical filenames are absent and
`compatibility.readManifestV2` is enabled. Invalid higher-precedence history
never falls back. Historical readers never execute consumer code.

The [page contract](./mokly-pages.md) defines the public page inputs,
rendering pipeline, exact routes, inheritance, and schema validation.

## Packaged Documentation

The root package ships the plain-Markdown CLI guides under `docs/guides` and
the protocol sources under `docs/protocol`. The package version is the
documentation version. The private cloud repository renders those files into
the public documentation site and owns its cloud, review, changelog, legal, and
marketing pages; this repository owns no site runtime or deployment.

The [guides contract](./mokly-guides.md) defines the source tree, frontmatter,
sections, link mapping, published Reference allowlist, release-managed version
literals, and package boundary.

## Non-Goals

- Owning or publishing consumer application screens.
- Replacing a consumer's product component library or design tokens.
- Deploying a hosted Mokly service.
- Hydrating product fragments into interactive application replicas.
- Requiring a monorepo, npm-workspace layout, or one fixed mockup directory.

## Related Docs

- [Build, Browse, and Review runtime](./mokly-runtime.md)
- [Packaged CLI guides](./mokly-guides.md)
- [CI and npm release](./npm-release.md)
