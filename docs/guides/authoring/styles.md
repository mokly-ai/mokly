---
title: "Styles"
description: "Use consumer CSS, CSS Modules, runtime styles, and a PostCSS configuration."
section: "authoring"
order: 10
---

## Import CSS

Import a stylesheet from an entry or a component it uses.
Mokly builds the imported stylesheet and adds its link to the document head.
A renderer returns React content and adds no stylesheet links itself.

```tsx
import "./button.css";

export function Button() {
  return <button className="button">Continue</button>;
}
```

A stylesheet imported by the renderer comes before the entry's imported
stylesheet.
Configured shared and scheme-specific sheets come before these imported sheets.
A page receives no automatic stylesheet links. Link its own CSS in the complete
document.

Without the Vite adapter, Mokly removes the renderer's stylesheets from
the entry's JavaScript imports and its `@import` chain. With the
[Vite adapter](/docs/authoring/vite/), you can also import stylesheets such as
`.scss` files. Mokly removes the renderer's stylesheets only from JavaScript
imports. A renderer stylesheet imported with `@import` appears again in the
entry's imported CSS.

## CSS Modules

A `*.module.css` import provides a class map.

```tsx
import styles from "./card.module.css";

export function Card() {
  return <section className={styles.card}>Overview</section>;
}
```

Without the Vite adapter, Mokly scopes class names, IDs, keyframes, and
animation references with a stable hash of the stylesheet's repository-relative
path. A CSS content edit does not change that path hash.

Without the adapter, use `:global(...)` to keep a selector global. Same-file
composition can name an earlier local class. Global composition is allowed.
Cross-file composition, authored `:import`, `:export`, and `@value` are errors.

With the [Vite adapter](/docs/authoring/vite/), Vite builds the class map.
A file such as `card.module.scss` is also a CSS Module. Use `composes` to
include a class from another file.

Mokly supplies the class map before it runs entry modules. The class names
match the delivered CSS. Add an ambient `*.module.css` declaration
in your application when its TypeScript setup needs one.

## Assets

Use stylesheet-relative font and image URLs. Mokly validates the files and
copies them into the static build's resource closure. Source files stay in
your repository. Rendered output stays in memory until `build --out` writes it.

```css
.card {
  background-image: url("./cover.webp");
}
```

Keep file and directory names URL-safe. Use `url(...)` around a local image
inside `image-set()`. Root-absolute URLs are not portable.
Remote HTTP(S), data, and fragment URLs keep their meanings.

## Consumer PostCSS

With the [Vite adapter](/docs/authoring/vite/), Mokly does not use the `postcss`
field. For Vite's default CSS transformer, use the PostCSS config that Vite
loads.

Without the adapter, name a config-relative module in `mokly.config.json`.
Mokly supplies PostCSS. Install the plugins in your repository.

```json
{
  "postcss": "postcss.config.mjs"
}
```

```sh
npm install --save-dev @tailwindcss/postcss autoprefixer
```

```js
// postcss.config.mjs
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: [
    tailwindcss({ base: import.meta.dirname, optimize: false }),
    autoprefixer(),
  ],
};
```

The default export contains an ordered plugin array, or a record of package
names and option objects. `map` is accepted and ignored. Other configuration
keys fail. Mokly emits no source maps.

Local helper imports keep their source locations. Plugin packages run unbundled
from your dependencies, so native bindings and package-relative files work.
Plugins are reused within a generation and start fresh for another generation.
Plugin file and directory dependency messages supply the watch inputs.

For Tailwind, prefer `source(none)` with explicit `@source` paths. This keeps
scans inside authored source trees. Use `@reference` when a CSS Module needs
Tailwind context without another emitted copy.

With or without the Vite adapter, import shared CSS from the renderer.
If Mokly must prune the file from an entry, use a JavaScript import in
that entry. With the Vite adapter, an `@import` of the same file keeps a
second copy in the entry's CSS.

## Runtime styles

Mokly collects styles from supported React Native Web, Emotion, and
styled-components registries, and from rendered `style` elements. The core puts
those rules in the document head before linked sheets. Use the renderer for
your product's providers. A custom styling library can return `style` elements
with its React tree.

## Loader choices

Use a JavaScript-safe loader, such as `dataurl` or `binary`, for JavaScript
asset imports. A `file` loader emits an undelivered file and fails.
Only `empty` can override `.css` or `.module.css` handling.
The `.css` override opts out of plain CSS and CSS Modules. The `.module.css`
override opts out of CSS Modules alone.

With the [Vite adapter](/docs/authoring/vite/), these stylesheet loader choices
apply to JavaScript imports of every supported stylesheet language.

## Configure stylesheet rules

Add ordered route rules to `mokly.config.json`. Local stylesheet paths are
relative to that configuration file. A rule matches the entry's
`path/index.html`, before viewport and color-scheme suffixes are added.

```json
{
  "stylesheets": [
    {
      "match": "account/**",
      "stylesheets": ["design/base.css", "$componentStylesheets"],
      "lightStylesheets": ["design/light.css"],
      "darkStylesheets": ["design/dark.css"]
    },
    { "match": "**", "stylesheets": ["design/base.css"] }
  ]
}
```

The first matching rule applies. Shared links come first. The scheme's links
follow them. An HTTP or HTTPS URL stays external and is never fetched during
a build. A page and a Markdown document receive no configured links. A page
links its own CSS; a Markdown document uses Mokly's document styles.

With the [Vite adapter](/docs/authoring/vite/), configured and component-declared
local stylesheets can use any stylesheet language that Vite supports. If the
source path does not end in `.css`, Mokly adds `.css` to the output path. For
example, `design/base.scss` becomes `styles/design/base.scss.css` in the
generated output.

## Place component styles

A JavaScript component can declare its public stylesheet list. The document
links the files of components that actually render, in first-render order.
`$componentStylesheets` places those links among shared links. Without the
marker, they follow shared links and precede scheme-specific links. A file
listed by both configuration and a component links once.
