# Packed consumer fixtures

These projects test the published packages the way a user installs them.
[`scripts/package-smoke.mjs`](../../../scripts/package-smoke.mjs) packs
`@mokly/mokly` and `@mokly/viewer`, copies each project into a temporary
`.context/package-smoke-*` directory and installs both archives with npm. Each
scenario then runs the installed `mokly` command and inspects its output. No
check imports Mokly source files from this repository, and the original fixture
files never change.

```bash
npm run package:smoke
```

`cargo xtask check --suite package` and the release workflow run the same five
scenarios. The release workflow tests the exact archives that it publishes.

## Fixtures

### `esm`

A standard ESM project with its config at the project root. Three scenarios
copy it:

- `esm`
  ([`consumer_cases/esm.mjs`](../../../scripts/package/consumer_cases/esm.mjs))
  checks the public exports, `--help`, `--version`, a production `npm audit`,
  config discovery from a nested directory, folders, Markdown documents,
  co-located entries, Serve, change detection, Export, the `@mokly/viewer` APIs
  and Publish to a local receiver.
- clean cache
  ([`consumer_cases/clean_cache.mjs`](../../../scripts/package/consumer_cases/clean_cache.mjs))
  runs Mokly through `npm exec` with an empty npm cache and no project install,
  as `npx` users do. It also exports with a custom config file name.
- imported styles
  ([`imported_styles.mjs`](../../../scripts/package/imported_styles.mjs)) adds
  a CSS module, a binary asset and a project PostCSS config.

### `nodenext`

TypeScript files only. The `nodenext` scenario type-checks the public
`@mokly/mokly` and `@mokly/viewer` types and the renderer contract from
[`mokly-rendering.md`](../../../docs/protocol/mokly-rendering.md) with strict
`NodeNext` resolution. It then imports the package at runtime.

### `themed`

An npm workspace with local `@firna/ui` and `react-native-web` packages. It uses
a custom renderer, module-resolution aliases and conditions, a stylesheet for
each screen, legacy components, a page entry and watch rules. The `themed` scenario checks the rendered theme, watch events, rendered-resource
changes after a token edit and Export.

### `components`

One entry file, not a project. It defines two registered components with three
saved variants.
[`scripts/package/components.mjs`](../../../scripts/package/components.mjs)
adds it to the `esm` and `themed` projects. It then checks the manifest
component records, a live props edit through Serve and the static export.

## Adding a fixture

Each scenario installs packages and runs real commands, so it is slow. Add a
fixture only when the behavior depends on the packed package: its file list,
exports, declarations, binaries or install-time dependency resolution. Test
configuration and path behavior, such as a config file in a subdirectory, with
unit tests under [`tests/`](../..) instead. Describe each new fixture here.
