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
stylesheet. Renderer-owned CSS is removed from the entry's bundle.
Configured shared and scheme-specific sheets come before these imported sheets.
A page receives no automatic stylesheet links. Link its own CSS in the complete
document.

## CSS Modules

A `*.module.css` import provides a class map. The core scopes class names,
IDs, keyframes, and animation references with a stable hash of the stylesheet's
repository-relative path. A CSS content edit does not change that path hash.

```tsx
import styles from "./card.module.css";

export function Card() {
  return <section className={styles.card}>Overview</section>;
}
```

Use `:global(...)` to keep a selector global. Same-file composition can name
an earlier local class. Global composition is allowed. Cross-file composition,
authored `:import`, `:export`, and `@value` are errors.

The class map is supplied before entry modules evaluate. It agrees with the
scoped CSS that the core delivers. Add an ambient `*.module.css` declaration
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

Name a config-relative module in `mokly.config.json`. Mokly supplies PostCSS.
Install the plugins in your repository.

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
Tailwind context without another emitted copy. Import shared CSS from the
renderer, or directly from an entry when it must be pruned there.

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

## Place component styles

A JavaScript component can declare its public stylesheet list. The document
links the files of components that actually render, in first-render order.
`$componentStylesheets` places those links among shared links. Without the
marker, they follow shared links and precede scheme-specific links. A file
listed by both configuration and a component links once.
