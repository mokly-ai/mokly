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
  "review": { "base": "origin/main" }
}
```

Filesystem fields resolve from the configuration's directory and stay inside
`repoRoot`. The configuration contains data. Product JavaScript runs in entry
modules, the renderer, and the optional PostCSS module.

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
`packageRoots`, and `resolveExtensions`. These describe your product's module
layout. Mokly supplies no application-specific aliases.
React and React DOM resolve from the consumer. CSS imports use Mokly's delivery
rules. Only `empty` can override `.css` and `.module.css` handling.
A JavaScript `file` loader is invalid because it emits an undelivered file.

## Review and watch

`review.base` selects the Git base, with `origin/main` as its default.
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
