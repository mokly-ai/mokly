---
title: "Config"
description: "Every field of the Mokly configuration, and what it decides."
section: "authoring"
order: 1
---

## Use a data-only configuration

Mokly reads `mokly.config.json`. It does not execute a configuration module.
The package's JSON Schema gives editors completion and validation.

```json
{
  "$schema": "./node_modules/@mokly/mokly/config.schema.json",
  "roots": [{ "dir": "specs" }],
  "colorSchemes": ["light", "dark"],
  "stylesheets": [{ "match": "**", "stylesheets": ["design/base.css"] }],
  "review": { "base": "origin/main" }
}
```

## Configuration fields

| Field              | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `roots`            | Source directories, file globs, path prefixes, and transparent directories   |
| `repoRoot`         | Repository root; the configuration directory is the default                  |
| `colorSchemes`     | A unique set that includes `light`; the default is light only                |
| `stylesheets`      | Ordered route rules with shared and scheme-specific CSS                      |
| `renderer`         | A local module that wraps React renders with product providers               |
| `postcss`          | A local module that supplies consumer PostCSS plugins                        |
| `moduleResolution` | Consumer aliases, package roots, conditions, fields, extensions, and loaders |
| `review.base`      | The Git ref used to find the comparison base                                 |
| `watch`            | Additional watch rules and the debounce interval                             |

Paths resolve from the configuration file. Inputs stay inside `repoRoot`.
Before a Git operation, `repoRoot` must be the Git repository's top level.
A build with `--no-changes` can run without Git.

## Select source roots

```json
{
  "roots": [
    {
      "dir": "specs",
      "files": ["**/*.screen.html", "**/*.component.html", "**/*.md"]
    },
    {
      "dir": "src/features",
      "path": "features",
      "transparent": ["__mockups__"]
    }
  ]
}
```

`dir` names an existing directory. `files` supplies root-relative POSIX
globs; omit it to use the default source kinds. `path` adds a catalogue
prefix. `transparent` removes named source directories from derived paths.
Matched file sets cannot overlap. Folder records use `_folder.json`.

## Select styles

The first stylesheet rule that matches an entry's `path/index.html` applies
to all its views. Shared links precede scheme-specific links.
`$componentStylesheets` can place rendered components' declared CSS among
the shared links.

Read [Styles](/docs/authoring/styles/) for imports, assets, and CSS Modules.
Pages link their own CSS. Markdown documents use Mokly's document styles.

## Configure JavaScript rendering

`renderer` names a local provider module. It returns React content or
content with declared resources. Mokly assembles the document.
`postcss` names a local module with PostCSS 8 plugins.

`moduleResolution` supports `aliases`, `packageRoots`, `conditions`,
`mainFields`, `resolveExtensions`, and `loaders`. CSS imports are handled by
Mokly. At `.css` and `.module.css`, the only loader override is `empty`.
A JavaScript `file` loader produces no deliverable catalogue resource; use
`dataurl` or `binary` for such imports.

## Choose output and comparison options

Use `--out directory` on `build` to choose the static output. The default is
`mokly-static` at the repository root. Output paths are command options.
Use `--base ref` to override `review.base`. Use `--no-changes` on a build
when a comparison is not needed.

Watch rules use repository-relative globs with an `ignore`, `rebuild`, or
`reload` action. They cannot override Mokly's source rebuilds, resource
reloads, or protected directories.
