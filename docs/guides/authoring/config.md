---
title: "Config"
description: "Every field of the Mokly configuration, and what it decides."
section: "authoring"
order: 1
---

## The shape of a config

`defineConfig` takes one object of type `MoklyConfig` and returns it typed.
`mockupsDir` is required; everything else has a default.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  mockupsDir: "specs/generated",
  renderer: "specs/renderer.tsx",
  repoRoot: ".",
  roots: [{ dir: "specs" }, { dir: "packages/ui/src", path: "components" }],
  stylesheets: [{ match: "**/index.html", stylesheets: ["app.css"] }],
  review: {
    base: "origin/main",
    outDir: ".context/mokly-review",
    sharedImpact: ["packages/ui/src/**", "src/tokens/**"],
  },
});
```

Folder paths are relative to the config file and stay inside `repoRoot`.
Repository globs such as `review.sharedImpact` are relative to `repoRoot`;
the `files` globs of a root are relative to that root.

## Fields

| Field              | Meaning                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `roots`            | The directories Mokly scans; defaults to one `specs` root                       |
| `mockupsDir`       | Catalogue root; output lives in its `mokly-generated/` child                    |
| `colorSchemes`     | Schemes rendered for screens, components and documents; defaults to `["light"]` |
| `repoRoot`         | The root every path is confined to; defaults to the config directory            |
| `renderer`         | Your module that wraps a screen in your theme and returns a document            |
| `stylesheets`      | Ordered route-to-stylesheet rules                                               |
| `postcss`          | Your config-relative PostCSS module for imported CSS                            |
| `moduleResolution` | Aliases, conditions, fields, extensions and loaders for your sources            |
| `review`           | The Git base, the artifact directory and shared-impact globs                    |
| `watch`            | Extra inputs the watched server reacts to                                       |

Every configured root defines its own file selection and path derivation.

## Roots

A root is a directory Mokly reads, with up to three refinements:

| Root field    | Meaning                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `dir`         | The directory, relative to the config file                                |
| `files`       | Globs relative to `dir`; defaults to `**/*.mockup.{ts,tsx}` and `**/*.md` |
| `path`        | A prefix placed before every path derived from this root                  |
| `transparent` | Directory names removed from derived paths                                |

Matched `.md` files render as documents and stay protected and watched as source.
Other matched files are entry modules whose exported definitions join the catalogue. The glob alone
decides the shape: `files: ["**/*.ts"]` reads every TypeScript file below the
root as a module. A file's path is the root's `path`, then the directories
between the root and the file with transparent names removed, then the file
name up to its first dot, so the paths are the same whether the files sit in
a dedicated spec tree or beside product code.

Omitting `roots` means `[{ dir: "specs" }]`. The recommended layout is that
spec tree for screens, pages, documents and flows by product area, with
`mockupsDir` and `renderer` inside it, plus a second root over a component
library such as `{ dir: "packages/ui/src", path: "components" }`. The
alternative keeps every mockup beside the code it describes, for example
`{ dir: "src/features", transparent: ["__mockups__"] }`.

Each root must exist, must not equal `mockupsDir`, and must match at least
one file; a root that matches nothing lists the directories it could not
search. Two roots cannot share a `dir`, and a file matched by two roots is
a `config-invalid` error: `file <path> is matched by roots[<n>] and roots[<m>]`. Below a root, Mokly skips `.git`,
`node_modules`, `.mokly-cache`, `dist`, `coverage`, `target`, `test-results`,
`playwright-report` and `.context`. A `_folder.json` file is read as a folder
record, never as an entry. Its `exclude` globs skip matching files as entries;
those files remain protected source inputs and stay watched.

Helpers imported by an entry module are attributed to their own file: a
component registered in `button.mokly.tsx` beside `button.tsx` records that
file as its source, wherever the entry module that exports it lives.

## Stylesheets

Rules are evaluated in declaration order. A rule matches an entry's route,
`<path>/index.html`, with a POSIX glob and lists stylesheets relative to
`mockupsDir`, or absolute HTTP(S) URLs. A rule may append `lightStylesheets`
or `darkStylesheets` after its shared list for the matching output.
Imported CSS delivery appends the
configured renderer stylesheet and then the entry stylesheet after those
links, even if no rule matches. Complete page callbacks receive no automatic
links. `<mockupsDir>/mokly-generated/` holds all generated documents, the private manifest, compiled CSS and copied
assets; keep authored public stylesheets elsewhere.
In authored public or imported CSS, write local `image-set()` sources as
`url()` values (`image-set(url("./photo.png") 1x)`) so Mokly validates the
reference. Imported CSS also copies the asset into `mokly-generated/`;
authored public CSS keeps its existing public asset path. Quoted remote
HTTP(S), protocol-relative and `data:` sources remain
external and unchanged.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  mockupsDir: "specs/generated",
  stylesheets: [
    {
      match: "account/**/index.html",
      stylesheets: ["app.css"],
      darkStylesheets: ["dark.css"],
    },
    { match: "**/index.html", stylesheets: ["base.css"] },
  ],
});
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
`review.baselineBuild` runs when a pinned historical v9 inventory is missing or incomplete: an ordered list of argv
arrays run without a shell to rebuild the historical catalogue. It defaults to
`npm ci` followed by `npx --no-install mokly build --config` and the config
path, independent of head Git tracking.

## Watch

`watch.rules` classify extra inputs with `ignore`, `rebuild`, `reload` or
`restart`, and `watch.debounceMs` sets the window a burst of filesystem
notifications is collected in. Package-owned paths, configured stylesheets and
referenced resources are already handled, and so is every file a root matches:
creating, moving or deleting one is noticed without a rule.

## Renderer

The default renderer produces neutral static HTML. Point `renderer` at a
module that default-exports a function, and it receives the screen's node
beside the viewport, the color scheme, the entry and the stylesheets that rule
matched. Return the complete document.

```tsx
import type { RenderInput } from "@mokly/mokly";
import { renderToStaticMarkup } from "react-dom/server";

export default function render(input: RenderInput): string {
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{input.entry.title}</title>
          {input.stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
        </head>
        <body data-theme={input.colorScheme}>{input.node}</body>
      </html>,
    )
  );
}
```

Wrap `input.node` in your product's providers when it needs them. React escapes
the stylesheet URLs and title in this complete-document example.

React and React DOM resolve from the config's own location, so the screens use
one React runtime even when the executable came from an npx cache.

## Public files

Only authored regular files referenced by a rendered document, a stylesheet
rule or a renderer resource record are public; nested HTML and CSS URLs are
followed transitively. Keep these files under `mockupsDir` and outside
`mokly-generated/`; source files, symlinks and unreferenced files stay private.
Stylesheet hrefs are relative to each generated document inside `mokly-generated/`.

## Exported types

| Type                                      | Use                                               |
| ----------------------------------------- | ------------------------------------------------- |
| `RootConfig`                              | One source directory and its discovery/path rules |
| `MoklyConfig`                             | The object `defineConfig` takes                   |
| `StylesheetRule`                          | One entry of `stylesheets`                        |
| `ReviewConfig`                            | The `review` object                               |
| `WatchConfig`, `WatchRule`, `WatchAction` | The `watch` object and its rules                  |
| `ModuleResolutionConfig`, `ModuleLoader`  | The `moduleResolution` object and its loaders     |
| `Renderer`, `RenderInput`                 | Your renderer, its context and its result         |

A referenced authored file can be public regardless of its extension or a
folder name such as `dist`. Keep it outside actual source, package, cache and
other protected locations. Mokly uses the same checked referenced files in
Build, Serve and export. Export refuses a consumer package root equal to
`mockupsDir`; choose a separate public catalogue directory for export.
