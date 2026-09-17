---
title: "Config"
description: "Every field of the Mokly configuration, and what it decides."
section: "authoring"
order: 1
---

## The shape of a config

`defineConfig` takes one object of type `MoklyConfig` and returns it typed.
`entriesDir` and `mockupsDir` are required; everything else has a default.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  generatedOutput: "committed",
  colorSchemes: ["light", "dark"],
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
  renderer: "docs/mockups/renderer.tsx",
  repoRoot: ".",
  stylesheets: [{ match: "app/**/*.html", stylesheets: ["app.css"] }],
  review: {
    base: "origin/main",
    outDir: ".context/mokly-review",
    sharedImpact: ["src/components/**", "src/tokens/**"],
  },
});
```

Paths are relative to the config file and stay inside `repoRoot`.

## Fields

| Field              | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `entriesDir`       | Where your entry modules live                                              |
| `mockupsDir`       | Where the generated catalogue is written                                   |
| `generatedOutput`  | `"committed"` (default) keeps generated files in Git; `"derived"` does not |
| `colorSchemes`     | Schemes rendered for every screen; defaults to `["light"]`                 |
| `repoRoot`         | The root every path is confined to; defaults to the config directory       |
| `renderer`         | Your module that wraps a screen in your theme and returns a document       |
| `stylesheets`      | Ordered route-to-stylesheet rules                                          |
| `publicExclude`    | Extra globs under `mockupsDir` that stay private                           |
| `moduleResolution` | Aliases, conditions, fields, extensions and loaders for your sources       |
| `review`           | The Git base, the artifact directory and shared-impact globs               |
| `watch`            | Extra inputs the watched server reacts to                                  |
| `compatibility`    | Temporary bridges while a repository moves to the current output           |

## Stylesheets

Rules are evaluated in declaration order. A rule matches a screen route with a
POSIX glob and lists stylesheets relative to `mockupsDir`, or absolute HTTP(S)
URLs. A rule may append `lightStylesheets` or `darkStylesheets` after its
shared list for the matching output.

```ts
stylesheets: [
  {
    match: "app/**/*.html",
    stylesheets: ["app.css"],
    darkStylesheets: ["dark.css"],
  },
  { match: "**/*.html", stylesheets: ["base.css"] },
];
```

## Review

`review.base` names the Git ref whose merge base with `HEAD` is the branch
point a comparison reads; it defaults to `origin/main`. `review.outDir` is the
config-relative artifact directory. `review.sharedImpact` lists globs for
files the rendered resource graph cannot see, such as token modules, so an
edit to them still marks the screens that may depend on them.
`review.baselineBuild` is only for derived output: an ordered list of argv
arrays run without a shell to rebuild the historical catalogue. It defaults to
`npm ci` followed by `npx --no-install mokly build --config` and the config
path, and it is rejected in committed mode.

## Watch

`watch.rules` classify extra inputs with `ignore`, `rebuild`, `reload` or
`restart`, and `watch.debounceMs` sets the window a burst of filesystem
notifications is collected in. Package-owned paths, configured stylesheets and
referenced resources are already handled.

## Renderer

The default renderer produces neutral static HTML. Point `renderer` at a
module that default-exports a function, and it receives the screen's node
beside the viewport, the color scheme, the entry and the stylesheets that rule
matched. Return the complete document.

```tsx
import type { RenderInput } from "@mokly/mokly";
import { renderToStaticMarkup } from "react-dom/server";

export default function render(input: RenderInput): string {
  const body = renderToStaticMarkup(
    <ThemeProvider scheme={input.colorScheme}>{input.node}</ThemeProvider>,
  );
  const links = input.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  return `<!doctype html><html lang="en"><head>${links}</head><body>${body}</body></html>`;
}
```

React and React DOM resolve from the config's own location, so the screens use
one React runtime even when the executable came from an npx cache.

## Public files

Everything below `mockupsDir` is public unless the source policy or a public
exclusion protects it. `publicExclude` extends the shipped defaults
`**/README`, `**/README.*`, `**/tsconfig.json` and `**/tsconfig.*.json`, which
are matched case-insensitively; an empty list keeps them.

## Exported types

| Type                                                      | Use                                           |
| --------------------------------------------------------- | --------------------------------------------- |
| `MoklyConfig`                                             | The object `defineConfig` takes               |
| `StylesheetRule`                                          | One entry of `stylesheets`                    |
| `ReviewConfig`                                            | The `review` object                           |
| `WatchConfig`, `WatchRule`, `WatchAction`                 | The `watch` object and its rules              |
| `ModuleResolutionConfig`, `ModuleLoader`                  | The `moduleResolution` object and its loaders |
| `CompatibilityConfig`                                     | The `compatibility` object                    |
| `Renderer`, `RenderInput`, `RenderResult`                 | Your renderer, its context and its result     |
| `CompatibilityTransformer`, `CompatibilityTransformInput` | A temporary document bridge                   |
