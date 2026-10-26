---
title: "Upgrade to the Rust core"
description: "Change your commands, configuration, authoring, and viewer imports for the Rust core release."
section: "start"
order: 6
---

## Before you upgrade

The Rust core release is a breaking release. Mokly reads no configuration,
authoring module, generated output, or cache from an earlier release, and it
has no converter for them. Plan to rebuild every catalogue that you publish.

Install `@mokly/mokly` as the [install guide](/docs/start/install/) shows. npm
selects the matching viewer and native packages. Keep optional dependencies
enabled during installation, because the `mokly` command is a native binary
with no JavaScript fallback.

## Update your commands

- Use `serve` to browse. It watches your sources by default.
- Use `build` to validate the catalogue, render every view, and write a static
  site. Replace `export --out` with `build --out`.
- Use `publish` to build a private site and upload it. `publish` has no
  `--out`, and it requires a clean, committed checkout.
- `check`, `export`, and `review` are removed. To validate, run
  `mokly build --strict --out {temporary-directory}`.
- The `--watch` option of `build` and the `--build` option of `serve` are
  removed. Use `serve` for development.
- `serve`, `build`, and `publish` accept `--base`. `build` and `publish`
  accept `--no-changes`.

## Update your configuration

- Move your configuration into the data-only `mokly.config.json`. TypeScript
  and JavaScript configuration and `defineConfig` are removed. `--config`
  names another JSON file.
- Point `$schema` at the shipped `config.schema.json` for editor checks.
- Write every path relative to the configuration file.
- Replace the `componentStylesheets` export with the `$componentStylesheets`
  token in the `stylesheets` list.
- Replace extglob stylesheet matches such as `@(a|b)` with brace alternatives
  such as `{a,b}`. An extglob match raises the `stylesheet-extglob` warning.
- Replace flat generated-file matches with entry routes such as
  `product/**/index.html`.
- Remove `.css: "text"` loader overrides. Import CSS normally, so that Mokly
  delivers the stylesheet and the assets that it references.

## Stop committing generated output

Remove committed `mokly-generated/` output and `.mokly-cache` from Git.
`build` writes to `mokly-static/` by default, and Git must ignore that
directory. Serve and Changes render in memory, and their caches live in the
operating system's cache directory.

## Update your authoring

- Give each screen and component its own props and optional variants. A
  variant replaces top-level prop keys. Supply valid parent props as well as
  variant props.
- Write `defineScreen` and `defineComponent` with
  `render(props, context)`. The `context` holds `viewport` and
  `colorScheme`.
- Export one definition from each export. An array export fails. Replace uses
  of a registration's `.entries` with its definition.
- Move saved React slot content into each variant's `slots` field.
- A Storybook file is one component. Its stories are variants, and their args
  are props. `argTypes` gives control hints only.
- `definePage` returns one complete document.
- Write prop schemas in the strict JSON Schema profile of
  [props and variants](/docs/authoring/props-and-variants/). Close each object
  schema with `additionalProperties: false`.
- Keep instance names separate from entry paths. `moklyInstance` uses
  lowercase kebab-case and has no path separators.
- Keep fixture data in your own source tree. Do not import fixture files from
  the installed package.

## Update your renderer

A renderer module returns a React node or `{ node, resources }`. Its input has
`props` and an entry address with `kind`, `path`, and `title`. It no longer
receives `id`, `navPath`, or `variantOf`. Mokly assembles the document and the
stylesheet links. Put theme attributes and `lang` on the renderer's wrapper
element, and update CSS selectors that depend on attributes of `html` or
`body`. Each component render sets up its own providers, so pass values such
as a palette through declared component props.

## Update Changes

Both sides of a comparison render from their sources with the installed
Mokly version. A committed baseline is no longer used. An entry's path comes
from its file. Declare `movedFrom` when you move an entry and change its
content in the same commit. A base whose sources fail validation shows Changes
as unavailable with the diagnostics.

## Update viewer imports

- Use the `@mokly/viewer` root, `@mokly/viewer/browser`,
  `@mokly/viewer/data`, and `@mokly/viewer/styles.css`. The `server` and
  `runtime` entries are removed.
- Give `MoklyViewer` an `index` source and a `detail` source. Read them with
  `readCatalogueIndex` and `readEntryDetail`.
- Import `resolveInstance` and `InstanceResolution` from `@mokly/viewer`, not
  from `@mokly/mokly`.
- Import `ColorScheme`, `Viewport`, and `MoklyVersionError` from
  `@mokly/viewer`.
- `@mokly/viewer/data` exports only the path functions, the directory names,
  the path and link grammar, and the prop schema validators. The other
  removed exports have no public replacement.

The [changelog](/changelog/) lists every removed export of each release.

## Republish hosted catalogues

Rebuild and republish every hosted catalogue with the matching viewer and
receiver. A hosted service that stores catalogues from an earlier release
must reset them. The upload exchange is unchanged.
