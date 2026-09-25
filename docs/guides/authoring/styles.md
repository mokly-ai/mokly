---
title: "Styles"
description: "Style catalogue views with CSS imports, modules, assets and optional PostCSS."
section: "authoring"
order: 10
---

Per-root imported stylesheets and binary assets compile into
`mokly-generated/`. Mokly passes fragment-relative renderer and entry
stylesheet links to your renderer; emit them in the document head to make
imported CSS visible. Pages receive no automatic links. An optional PostCSS
module processes imported CSS before CSS Modules and bundling; Tailwind v4 and
autoprefixer setup is below.

## Import CSS beside a screen

With imported CSS delivery, import plain CSS from an entry or from a component
used by it. Mokly bundles a stylesheet for each entry that reaches CSS and
passes its fragment-relative URL to your renderer after any configured
`stylesheets` links. Emit those links in your renderer's document head; they
are not inserted into your HTML automatically. When a renderer imports its
own theme stylesheet, its link comes before the entry's stylesheet. A file
delivered through the renderer is removed from the entry's CSS bundle, even
when the entry reaches it through another CSS `@import`.
An entry that re-exports a screen or component defined in a helper delivers
that entry's CSS, not a bundle named after the helper. Independent entries
using the same helper each deliver their own CSS.

```tsx
import "./button.css";

export function Button() {
  return <button className="button">Continue</button>;
}
```

Entries that share a component each get their own stylesheet. Pages generate
their entry's stylesheet too, but a page callback receives no stylesheet
links; add a relative link to its complete document yourself if needed.

## Use CSS Modules and local assets

Name scoped styles `*.module.css` and import the default class map or a
valid-identifier named class. Class names are derived from the file path,
not the CSS content or unrelated entries. Same-file and global `composes`
work; composing from another file or a local composition cycle fails Build.
Classes, IDs, keyframes and their animation references are scoped together.
Counter-style names and their list-style references, and view-transition
names, are also local and exported. Global tokens such as `var(--brand)`
remain global, as do grid-area and container names. Lightning CSS can
reorder equivalent declaration values (for example `animation: pulse 1s`
becomes `animation: 1s <scoped-name>`).

```tsx
import styles from "./card.module.css";

export function Card() {
  return <div className={styles.card}>Overview</div>;
}
```

For a TypeScript application, add ambient declarations for `*.module.css`
(a default `Readonly<Record<string, string>>` class map) and `*.css`
(side-effect imports) in your own `.d.ts` file. Mokly does not generate
TypeScript declarations for consumer stylesheets.

```css
.card {
  background: url("./cover.webp?size=small#preview") center / cover;
}
```

Mokly copies local font/image URLs to generated assets, mirrors their paths
under `mokly-generated/assets/`, and preserves query/hash suffixes. Keep
asset filenames and directories URL-safe: no spaces, trailing dots or Windows
device names. An npm scope following `node_modules` may begin with `@`;
`encodeUrlPath` writes it as `%40` in links. Use a stylesheet-relative
`url()`, never `/root/asset.png`.
Remote HTTP(S), `//`, `data:` and `#fragment` URLs are unchanged. Link your
own separately authored public assets normally. An imported `url()` asset
that is already a public file under `mockupsDir` fails rather than silently
hiding its original route; keep it separate or move its source outside
`mockupsDir`. Remote CSS `@import`s stay external and are not fetched or
inventoried; valid prelude imports appear before local rules in the bundle.
CSS `@import`s of packages select the `style` export condition or `style`
main field ahead of your JavaScript conditions and main fields, so
`@import "tailwindcss"` resolves to CSS even with custom module resolution.

## Add Tailwind v4 and autoprefixer

Install PostCSS and the plugins in the **consumer** repository, then name
the config-relative module in `mokly.config.ts`. Mokly does not install,
discover or pin these plugins for you.

```sh
npm install -D postcss tailwindcss @tailwindcss/postcss autoprefixer
```

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "docs/mockups/generated",
  postcss: "postcss.config.mjs",
});
```

```js
// postcss.config.mjs
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: [
    tailwindcss({ base: import.meta.dirname, optimize: false }),
    autoprefixer({ overrideBrowserslist: ["Safari 14"] }),
  ],
};
```

Mokly bundles local PostCSS config imports for reloading, but loads package
plugins unbundled from your repository so their native bindings and
package-relative files continue to work.
Tailwind's default `base` is the working directory of the Mokly process, and
its default `optimize` changes with `NODE_ENV`; pin both as above for stable
bytes. Also use `source(none)` and explicit `@source` paths below to avoid
scanning the public mockups directory (even when launched from another cwd).
Tailwind recursively inlines local `@import`s from disk, so a nested import of
renderer-owned CSS in an entry can bypass Mokly's pruning and fails Build when
Tailwind reports it. Import shared CSS only from the renderer or directly from
the entry stylesheet so Mokly can prune it. For Tailwind context in a component
or module (`@apply`), use `@reference` instead of `@import`: when the renderer
already delivers Tailwind, a direct entry `@import "tailwindcss"` is pruned.

For `styles/catalogue.css` beneath the repository root, opt into exactly
the sources whose class names belong in this catalogue. Import the CSS from
an entry or its component and use its generated stylesheet. Import the
theme and utilities layers separately to leave existing screen defaults
intact: the full `tailwindcss` import also includes a CSS reset. The example
sets `overrideBrowserslist: ["Safari 14"]` on autoprefixer so
`user-select: none` produces a WebKit prefix.

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@source "../src";

.control {
  user-select: none;
}
```

In `examples/basic/src/components/workspace-note/utilities.css` the explicit
source is `@source "../..";`, relative to that CSS file, to scan only
`examples/basic/src`; its `@utility note-title` affects only the Welcome
component that uses that class. The example sets `BROWSERSLIST_IGNORE_OLD_DATA=1` in
its PostCSS module to prevent an aging `caniuse-lite` warning from adding
noise to this fixed-target demo. In an application, update Browserslist's
dataset instead of suppressing that warning.

If you intentionally use Tailwind's **automatic** discovery instead, use
`@source not "../docs/mockups";` to exclude direct scans in this layout.
Tailwind can still report a broad scan of the parent `docs/` directory whose
glob reaches `mockupsDir`; when the whole `docs/` tree can be excluded, use
`@source not "../docs";` instead. Otherwise keep the `source(none)` example
above and explicitly include only authored trees. The build fails if a
plugin scans public files that the catalogue links, rather than quietly
hiding them. `@source` paths are relative to the stylesheet, not the shell's
working directory.

## Keep runtime styles in the renderer

Runtime CSS-in-JS such as styled-components and Emotion still belongs to
the consumer renderer: wrap screens in the same providers and collect any
runtime-generated styles in the returned complete document. This integration
is still needed even when you import CSS. For styled-components in a
`"type": "module"` repository, `moduleResolution.mainFields` can be set
to `["module", "main"]` to prefer a package's ESM entry if your consumer
requires it; esbuild's Node default prefers `main` instead, and Mokly does
not set these fields for your app.

## Other styling workflows

Sass, Less, Stylus, non-PostCSS build-time CSS-in-JS transforms, Vite config
and Vite plugins are outside this workflow. JavaScript asset imports with a
`file` loader cannot supply portable catalogue URLs: use `dataurl` or
`binary` for those imports instead. `moduleResolution.loaders[".css"] =
"empty"` deliberately opts out of both plain CSS and CSS Modules;
`".module.css": "empty"` opts out only of CSS Modules.
