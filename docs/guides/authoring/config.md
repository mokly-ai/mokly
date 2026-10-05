---
title: "Config"
description: "Every field of the Mokly configuration, and what it decides."
section: "authoring"
order: 1
---

## The shape of a config

`defineConfig` takes one object of type `MoklyConfig` and returns it typed.
`mockupsDir` and exactly one of `entries` or `entriesDir` are required;
everything else has a default.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "docs/mockups",
  renderer: "docs/mockups/renderer.tsx",
  repoRoot: ".",
  stylesheets: [{ match: "screens/*.html", stylesheets: ["app.css"] }],
  review: {
    base: "origin/main",
    outDir: ".context/mokly-review",
    sharedImpact: ["src/components/**", "src/tokens/**"],
  },
});
```

Folder paths are relative to the config file and stay inside `repoRoot`.
Globs are relative to `repoRoot`.

## Fields

| Field              | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `entries`          | Globs whose matched regular files are entry modules                          |
| `entriesDir`       | Shorthand for `<folder>/**/*.mockup.{ts,tsx}`                                |
| `mockupsDir`       | Catalogue root; generated files live only under its `mokly-generated/` child |
| `colorSchemes`     | Schemes rendered for every screen; defaults to `["light"]`                   |
| `repoRoot`         | The root every path is confined to; defaults to the config directory         |
| `renderer`         | Your module that wraps a screen in your theme and returns a document         |
| `stylesheets`      | Ordered route-to-stylesheet rules                                            |
| `postcss`          | Your config-relative PostCSS module for imported CSS                         |
| `moduleResolution` | Aliases, conditions, fields, extensions and loaders for your sources         |
| `review`           | The Git base, the artifact directory and shared-impact globs                 |
| `watch`            | Extra inputs the watched server reacts to                                    |

## Entries

`entries` lists repository-relative globs. Every matched regular file is an
entry module, with no separate suffix or extension filter. A glob such as
`src/**/*.mockup.{ts,tsx}` selects the recommended naming convention and lets
each entry live beside the component or screen it describes. A broader glob
such as `src/**/*.ts` deliberately makes every matched TypeScript file an entry,
but a file with no registry export simply contributes no definitions. If no
matched file contributes a definition, compilation reports the normal empty
registry error. The matched set is sorted by path, so neither glob order nor
filesystem order changes the catalogue. Discovery skips denied directories and
`review.outDir`. A glob with no matched module reports the skipped denied roots,
if any. A matched barrel that re-exports another matched module's registry array
fails with `duplicate-id`. Narrow the glob, rename the barrel so the glob no
longer matches it, or stop re-exporting registry arrays.

List multiple globs when entry modules genuinely live in multiple locations,
for example `entries: ["src/**/*.mockup.{ts,tsx}",
"docs/mockups/entries/**/*.mockup.tsx"]`. Every item is validated separately,
so each glob must match at least one entry module.

`entriesDir` names one folder relative to the config file and is exactly
`entries: ["<folder>/**/*.mockup.{ts,tsx}"]`. Set one of the two fields, not
both.

Helpers imported by an entry module are attributed to their own file: a
component registered in `button.mokly.tsx` beside `button.tsx` records that
file as its source, wherever the entry module that exports it lives.

## Stylesheets

Rules are evaluated in declaration order. A rule matches a screen's derived
route, such as `screens/account-home.html`, with a POSIX glob and lists
stylesheets relative to `mockupsDir`, or absolute HTTP(S)
URLs. A rule may append `lightStylesheets` or `darkStylesheets` after its
shared list for the matching output.
Imported CSS delivery appends the
configured renderer stylesheet and then the entry stylesheet after those
links, even if no rule matches. Complete page callbacks receive no automatic
links. `<mockupsDir>/mokly-generated/` is reserved for CSS and asset
output; keep authored public stylesheets elsewhere.
In authored public or imported CSS, write local `image-set()` sources as
`url()` values (`image-set(url("./photo.png") 1x)`) so Mokly validates the
reference. Imported CSS also copies the asset into `mokly-generated/`;
authored public CSS keeps its existing public asset path. Quoted remote
HTTP(S), protocol-relative and `data:` sources remain
external and unchanged.

```ts
stylesheets: [
  {
    match: "screens/account-*.html",
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
files a screen might use but its rendered files cannot reveal, such as renderer
and token modules. A renderer or token file matched only by a glob appears in
Details without adding the screen to Changes. A changed preview or resource
still appears there, as can a registered component's own file or a dependency
named by its exact path.
`review.baselineBuild` runs when a pinned historical v8 inventory is missing or incomplete: an ordered list of argv
arrays run without a shell to rebuild the historical catalogue. It defaults to
`npm ci` followed by `npx --no-install mokly build --config` and the config
path, independent of head Git tracking.

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

Only authored regular files referenced by a rendered document, a stylesheet
rule or a renderer resource record are public; nested HTML and CSS URLs are
followed transitively. Keep these files under `mockupsDir` and outside
`mokly-generated/`; source files, symlinks and unreferenced files stay private.
Stylesheet hrefs are relative to each generated document inside `mokly-generated/`.

## Exported types

| Type                                      | Use                                           |
| ----------------------------------------- | --------------------------------------------- |
| `MoklyConfig`                             | The object `defineConfig` takes               |
| `StylesheetRule`                          | One entry of `stylesheets`                    |
| `ReviewConfig`                            | The `review` object                           |
| `WatchConfig`, `WatchRule`, `WatchAction` | The `watch` object and its rules              |
| `ModuleResolutionConfig`, `ModuleLoader`  | The `moduleResolution` object and its loaders |
| `Renderer`, `RenderInput`, `RenderResult` | Your renderer, its context and its result     |

A referenced authored file can be public regardless of its extension or a
folder name such as `dist`. Keep it outside actual source, package, cache and
other protected locations. Mokly uses the same checked referenced files in
Build, Serve and export. A consumer package root must not equal `mockupsDir`;
choose a separate public catalogue directory.
