---
title: "Vite"
description: "Use your project's Vite setup to compile JavaScript and stylesheets for the catalogue."
section: "authoring"
order: 13
---

## Enable the adapter

Install Vite 8 in the project that contains `mokly.config.json`.
Vite is an optional peer dependency of `@mokly/mokly`.
Mokly uses the project's installation.

```sh
npm install --save-dev vite@^8
```

Add `vite` to `mokly.config.json`:

```json
{
  "vite": true
}
```

`"vite": {}` also enables the adapter. The object must be empty.
An object with any fields fails the configuration check.
Set `"vite": false` or omit the field to use Mokly's default compiler.

Start the catalogue:

```sh
npx --no-install mokly serve
```

## Use the project setup

Mokly loads the first `vite.config.*` file that Vite finds beside
`mokly.config.json`. Vite's file names and search order apply.
Without a config file, Vite's defaults apply.

The setup uses command `serve` and mode `development` for every Mokly
command, including Serve and `build`.

Aliases, plugins, and `import.meta.env` values from `.env` files apply to
mockups, components, the renderer, and stories.
Queries such as `?raw` work as in `vite dev`.
SVGR's `?react` imports use the project's SVGR plugin.
A `react` or `react-dom` alias in `resolve.alias` selects the React
installation that every module, dependency, and render uses.
Without a matching alias, React and React DOM come from the project.

## Module settings

Vite resolves JavaScript imports when the adapter is enabled.
These `moduleResolution` fields do not apply to JavaScript:

- `aliases`
- `conditions`
- `mainFields`
- `resolveExtensions`
- `loaders`

`packageRoots` still selects dependency roots.
The project's Vite setup resolves imports first, including its aliases.
If it cannot find a package, Mokly also checks `node_modules` under each
configured `moduleResolution.packageRoots` directory.
This lookup applies to Serve, `build`, and both sides of Changes.

Set the `.css` loader to `"empty"` to skip JavaScript imports of stylesheets
in every supported language. Set the `.module.css` loader to `"empty"` to skip
only CSS Module imports in those languages.
See [configuration](/docs/authoring/config/).

## Imported styles

The project's Vite setup transforms local stylesheets instead of the module
in the `postcss` field of `mokly.config.json`. Vite applies its `css` options
and the stylesheet's preprocessor. The default CSS transformer also uses the
PostCSS config that Vite loads. Vite runs stylesheet transforms from plugins
such as `@tailwindcss/vite`.

Import, configure, or declare local stylesheets with these lowercase suffixes,
as in your project's own Vite build:
`.css`, `.scss`, `.sass`, `.less`, `.styl`, `.stylus`, `.pcss`, `.postcss`,
and `.sss`. Install the preprocessor in your project as you do for `vite dev`.
For example, install `sass` to use `.scss` files.

Vite inlines local `@import` rules. Mokly removes the renderer's stylesheets
from an entry's JavaScript imports, but not from `@import` rules. If an
entry's stylesheet imports a renderer stylesheet with `@import`, its rules
appear again after the renderer's CSS.

For a configured or component-declared local stylesheet, Mokly adds `.css`
to the output path if the source path does not end in `.css`. For example,
`design/base.scss` becomes `styles/design/base.scss.css` in the generated
output. Relative `url()` values still work. Mokly delivers the assets as it
does without the adapter.
See [styles](/docs/authoring/styles/).

### CSS Modules

A `.module.` stylesheet in any of these languages is a CSS Module. For
example, `card.module.scss` provides a class map. Vite scopes the module
and supports `composes` from another file.

With Vite's default CSS transformer, `css.modules` options such as
`localsConvention` apply. A `.module.css` file gets the same scoped class names
as it does without the adapter.

With `css.transformer: "lightningcss"`, set CSS Modules options in
`css.lightningcss.cssModules`. Scoped names follow `mokly_[hash]_[local]` and
differ from the names without the adapter. In Changes, both sides get the same
names if they use the same transformer and keep the same stylesheet paths
and local class names.

### Private stylesheet inputs

Files that a stylesheet transform reports as dependencies stay private, with
or without the adapter. This includes files that Tailwind reports after a scan.
With the adapter, files that `composes` reads also stay private. A document
fails to build if it links to one of these files as a public file.

If the error says the Vite setup reported the file, exclude it from the
plugin's sources. For Tailwind, use `@source not "../images/logo.svg";` with
a path relative to the stylesheet.

For a file that only `composes` reads, the error names the CSS Module.
Link to the module's delivered stylesheet or keep a separate public copy.

## Development changes

Mokly writes no file into the project when it loads and runs the Vite setup.
Vite runs without a dev server, hot reload, or dependency pre-bundling.
Mokly's Serve command serves the catalogue and watches its inputs.

An edit to the Vite config file reloads the setup in Serve.
An edit to a file it imports or an `.env` file also reloads the setup.

Serve renders again when a file that the stylesheet transform reports as a
dependency changes. This includes files that `composes` uses.

## Build errors

If Mokly cannot load the project's `vite` package, the build fails.
The error names `vite`. Check that the project installs Vite 8.

When Vite cannot transform or resolve a JavaScript module, the error names
the module and the plugin.
The error also shows the installed Vite version and the tested range.
Check the named import or plugin in the project's Vite setup.

If Vite cannot transform a stylesheet, the build fails with this message:

```text
Vite plugin {plugin} failed for {stylesheet}: {detail}; fix the Vite setup or the stylesheet
```

If the plugin reports a location in your repository, the error shows the file,
line, and column. For example, an imported Sass partial can appear as
`src/_colors.scss:2:7`. Without a location, the error names the stylesheet.

A configured or component-declared stylesheet such as `Action.CSS` fails with
the detail `Vite reads only a lowercase stylesheet suffix`. Use a lowercase
suffix.
