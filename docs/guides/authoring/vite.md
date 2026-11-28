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

In Changes, the base side reads Git-tracked env files from the base commit.
Both sides share local values from untracked env files in the working tree,
such as a Git-ignored `.env.local`. A new env file you add to Git supplies
values only to the working-tree side. Changes can show the effect of those
values.

## Module settings

Vite resolves JavaScript imports when you enable the adapter. Its setup
replaces these `moduleResolution` fields in `mokly.config.json`.

- `aliases`
- `conditions`
- `mainFields`
- `resolveExtensions`

Mokly reports a `vite-replaced-setting` warning for each field you set from
this list, even with an empty list or map. Mokly reports the same warning
for `loaders` only if it has a key other than `.css` or `.module.css`.
Remove the field or keys named in the warning, or move the settings to your
Vite setup. A build with `--strict` fails on `vite-replaced-setting`.

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

The project's Vite setup transforms local stylesheets. Mokly reports a
`vite-replaced-setting` warning if you set `postcss` in `mokly.config.json`.
Remove the field or move your PostCSS settings to the Vite setup.

Vite applies its `css` options and the stylesheet's preprocessor. The default
CSS transformer also uses the PostCSS config that Vite loads. Vite runs
stylesheet transforms from plugins such as `@tailwindcss/vite`.

Import, configure, or declare local stylesheets with these lowercase suffixes,
as in your project's own Vite build:
`.css`, `.scss`, `.sass`, `.less`, `.styl`, `.stylus`, `.pcss`, `.postcss`,
and `.sss`. Install the preprocessor in your project as you do for `vite dev`.
For example, install `sass` to use `.scss` files.

For stylesheets that JavaScript imports, a preview or entry bundle leaves out
files that the renderer already delivers. A stories file's bundle also skips
JavaScript imports of files that its preview already delivers. Vite inlines
local `@import` rules, so those rules can include the same CSS in a later bundle.

An earlier stylesheet can `@import` a CSS Module, and Vite then inlines it as
plain CSS. The story or entry that imports the same module from JavaScript
still keeps its own scoped copy, because its class names need the scoped
selectors.

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

Serve reloads the Vite setup when the Vite config file, a file it imports, or
an env file changes. Serve also reloads when you add, change, or remove a
PostCSS config file that Vite looks up.

Serve renders again when a file that the stylesheet transform reports as a
dependency changes. This includes files that `composes` uses.

For other files that your setup or its plugins read directly, add a
`rebuild` rule in `watch.rules`. Serve reloads the Vite setup when a file
that matches the rule changes. Use paths relative to the repository root.
For example, add this rule to `mokly.config.json` if your Vite config reads
`config/theme.json` with `fs`.

```json
{
  "watch": {
    "rules": [{ "action": "rebuild", "paths": ["config/theme.json"] }]
  }
}
```

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
