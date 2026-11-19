---
title: "Vite"
description: "Use your project's Vite setup to compile JavaScript for the catalogue."
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
React and React DOM come from the project.

## Module settings

Vite resolves JavaScript imports when the adapter is enabled.
These `moduleResolution` fields do not apply to JavaScript:

- `aliases`
- `conditions`
- `mainFields`
- `resolveExtensions`
- `loaders`

`packageRoots` still selects dependency roots.
The `"empty"` loader choices for `.css` and `.module.css` still apply.
See [configuration](/docs/authoring/config/).

## Imported styles

Mokly handles `.css` and `.module.css` imports.
An imported stylesheet reaches the document through Mokly's stylesheet rules.
A CSS Module supplies Mokly's class names.
The `postcss` field still selects Mokly's PostCSS module.
See [styles](/docs/authoring/styles/).

## Development changes

Mokly writes no file into the project when it loads and runs the Vite setup.
Vite runs without a dev server, hot reload, or dependency pre-bundling.
Mokly's Serve command serves the catalogue and watches its inputs.

An edit to the Vite config file reloads the setup in Serve.
An edit to a file it imports or an `.env` file also reloads the setup.

## Build errors

If Mokly cannot load the project's `vite` package, the build fails.
The error names `vite`. Check that the project installs Vite 8.

A Vite transform or resolution error names the module and the plugin.
The error also shows the installed Vite version and the tested range.
Check the named import or plugin in the project's Vite setup.
