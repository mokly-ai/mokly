---
title: "Config"
description: "Choose source roots, a product renderer, styles, and review settings."
section: "authoring"
order: 1
---

## Add the configuration

Create `mokly.config.json`. Mokly searches upward for this file, or uses the
JSON file named by `--config`.

```json
{
  "colorSchemes": ["light", "dark"],
  "repoRoot": ".",
  "roots": [
    { "dir": "specs" },
    { "dir": "packages/ui/src", "path": "components" }
  ],
  "renderer": "specs/renderer.tsx",
  "stylesheets": [{ "match": "**/index.html", "stylesheets": ["app.css"] }],
  "review": { "base": "origin/main", "baseInstallScripts": false }
}
```

Filesystem fields resolve from the configuration's directory by default.
Inputs stay inside `repoRoot`. The configuration contains data. Product
JavaScript runs in entry modules, the renderer, and the optional PostCSS
module.

## Source roots

A root selects authored files and determines their path prefix.

| Field         | Purpose                                      |
| ------------- | -------------------------------------------- |
| `dir`         | Select a config-relative source directory.   |
| `files`       | Select files with root-relative globs.       |
| `path`        | Add a prefix to the derived catalogue paths. |
| `transparent` | Remove named directories from derived paths. |

The default root is `specs`. Default patterns include mockup modules,
Storybook stories, HTML screens, HTML components, HTML pages, YAML use cases,
and Markdown documents. With custom `files` globs, the globs determine the
entry shape. An ordinary matched JavaScript or TypeScript file is an entry
module. Every export of that module is inspected.

The same entry can match only one root. Keep product helpers outside the entry
patterns unless they export a definition. Imported helpers remain watched and
protected source inputs.

## Rendering and styles

`renderer` names a consumer module that wraps React screens and components.
It receives a React node and returns React content, or `{ node, resources }`.
Mokly assembles the document and its head. Storybook uses its decorators.
Pages own their complete documents.

`colorSchemes` defaults to `["light"]`. A declared list includes `light` and
has no duplicates. Screens and components can restrict that set.

The first matching `stylesheets` rule supplies the links for an entry.
Its `match` reads the entry route ending in `index.html`, before view axes are
added. Its shared list comes first, then `lightStylesheets` or
`darkStylesheets`, then the renderer's imported CSS, then the entry's imported
CSS. Use the string `$componentStylesheets` in the shared list to place
component declarations there. Without that token, declarations follow the
shared sheets. Local paths and HTTP(S) stylesheet URLs are supported.

`postcss` names a config-relative consumer PostCSS module.
See [styles](/docs/authoring/styles/).

## Resolve consumer modules

`moduleResolution` accepts `aliases`, `conditions`, `loaders`, `mainFields`,
`packageRoots`, `resolveExtensions`, and `sourcePackages`. These describe your
product's module layout. Mokly supplies no application-specific aliases.
React and React DOM resolve from the consumer. CSS imports use Mokly's delivery
rules. Only `empty` can override `.css` and `.module.css` handling.
A JavaScript `file` loader is invalid because it emits an undelivered file.

### Workspace packages

For bundled imports by workspace package name, Mokly looks for source
files that match the build targets in the working tree and the Git base.
If package lookup fails, every declared target for the import must map to
the same source file. TypeScript declaration files do not count.
Configured entry and stories files, the renderer, and the PostCSS module
keep their exact paths.

To detect the layout, Mokly reads `outDir` and `rootDir` from the package's
`tsconfig.json` and relative `extends` files in the repository outside
`node_modules`. Set both folders in the package's `tsconfig.json` when it
extends an installed configuration. Both folders must be inside the package.
Otherwise Mokly looks for the same path under `src` for targets in `dist`,
`lib`, `build`, or `out`.
For example, `dist/button.js` can map to `src/button.tsx`.

Use `moduleResolution.sourcePackages` to override automatic detection for a
workspace package. Use the `name` from its `package.json` as the key. For a
custom layout, map each build folder to its source folder. Use paths relative
to the package root.

```json
{
  "moduleResolution": {
    "sourcePackages": {
      "@acme/ui": { "esm": "source", "cjs": "source" }
    }
  }
}
```

Set the entry to `false` when the render needs the built files, for example
when the package build changes the code.

```json
{
  "moduleResolution": {
    "sourcePackages": {
      "@acme/ui": false
    }
  }
}
```

With `false`, track the built files in Git. The base render fails if those
files are missing.

Mokly tries layouts in order for each file.

- The base render tries the base commit's entry, then the working tree's
  entry, then automatic detection.
- The head render tries the working tree's entry, then automatic detection.

The first layout that finds a source file wins. If Mokly reaches `false`, it
uses the original package target and ends the search.

Import the source stylesheet by a relative path when a PostCSS plugin such
as Tailwind inlines it through its own package lookup, which bypasses
automatic detection and `sourcePackages`.

An invalid entry causes a `config-invalid` error. An entry that names one
build folder twice, such as `esm` and `./esm`, is invalid. When Changes
reports `ignored-module`, the catalogue in the working tree loaded a file
that Git ignores, for example through an import or its PostCSS configuration.
A later base may fail to load that file.

## Review and watch

`review.base` selects the Git base, with `origin/main` as its default.
`review.baseInstallScripts` enables lifecycle scripts for base dependency
installs. It defaults to `false` and only uses the working tree configuration.
Changes renders from the merge base and the working tree. It uses no committed
generated tree.

`watch.debounceMs` sets the delay that combines file events.
`watch.rules` adds ordered rules with `action` and repository-relative `paths`.
An action is `ignore`, `rebuild`, or `reload`. Required source inputs remain
watched under the source protection rules.

## Output

Serve keeps rendered documents in memory. `build --out` selects the static
output directory. Keep that directory ignored by Git.
The configuration declares no output directory and no build recipe.

## Configuration fields

| Field                       | Meaning                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `roots`                     | Source directories, file globs, path prefixes, and transparent directories  |
| `repoRoot`                  | Repository root; the configuration directory is the default                 |
| `colorSchemes`              | A unique set that includes `light`; the default is light only               |
| `stylesheets`               | Ordered route rules with shared and scheme-specific CSS                     |
| `renderer`                  | A local module that wraps React renders with product providers              |
| `postcss`                   | A local module that supplies consumer PostCSS plugins                       |
| `moduleResolution`          | Consumer aliases, package lookup, extensions, loaders, and `sourcePackages` |
| `review.base`               | The Git ref used to find the comparison base                                |
| `review.baseInstallScripts` | Run lifecycle scripts for base dependency installs, default false           |
| `watch`                     | Additional watch rules and the debounce interval                            |

Paths resolve from the configuration file by default. Inputs stay inside `repoRoot`.
Before a Git operation, `repoRoot` must be the Git repository's top level.
A build with `--no-changes` can run without Git.

Use `--no-changes` on a build when a comparison is not needed.
