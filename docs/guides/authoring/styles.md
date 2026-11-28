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

Mokly removes a CSS Module from the entry only when the renderer's bundle
scopes it under the same path. If the renderer reaches the file through
another path, such as a package link, or Vite inlines it as plain CSS, the
entry keeps its own scoped copy, so its class names still match.

For CSS shared by a Storybook folder's stories, see
[Style stories from the preview](/docs/authoring/storybook/#style-stories-from-the-preview).

In generated stylesheet and asset routes, Mokly replaces a leading `.` in
each path segment with `dot-`. For example, the stylesheet bundle for
`.storybook/preview.tsx` uses `styles/dot-storybook/preview.tsx.css` under
`static/mokly-generated/`.

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

A document link fails if it points to a file that a stylesheet transform
reports as a dependency. With Vite, a link also fails if it points to a file
that `composes` reads. See [private stylesheet inputs](/docs/authoring/vite/#private-stylesheet-inputs)
for fixes.

## Import images, fonts, and media

This asset delivery applies when you do not use the Vite adapter.
Import an image, font, or media file from your component.
Use the imported value in `src`, `srcset`, `poster`, `href`, or a `style` `url()`.
Mokly delivers the file.
Mokly gives each document a working relative URL to the file.

```tsx
import logo from "./logo.png";

export function Logo() {
  return <img src={logo} alt="Company logo" />;
}
```

Code can append a `?query` or a `#fragment` to the imported value.
Use a `#fragment` to select an icon from an SVG sprite.

These file extensions work as asset imports.
Extension matching is case-sensitive.

- Images: `.apng`, `.avif`, `.bmp`, `.cur`, `.gif`, `.ico`, `.jfif`, `.jpeg`,
  `.jpg`, `.jxl`, `.pjp`, `.pjpeg`, `.png`, `.svg`, and `.webp`.
- Fonts: `.eot`, `.otf`, `.ttf`, `.woff`, and `.woff2`.
- Audio: `.aac`, `.flac`, `.m4a`, `.mp3`, `.ogg`, `.opus`, and `.wav`.
- Video: `.mov`, `.mp4`, and `.webm`.
- Other files: `.pdf`, `.vtt`, and `.webmanifest`.

Keep file and directory names URL-safe.
Use only letters, digits, dots, underscores, tildes, and hyphens in each path segment.
A name with a space fails the build.

In Serve, an edit to an imported file updates the views that use it.
Changes shows the views that reference the changed file.

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

These asset loader choices apply without the Vite adapter.
An asset import's default value is not a URL that code can fetch during a render.
Use `binary` or `text` in `moduleResolution.loaders` to read the file's bytes or text.
A configured loader overrides asset delivery for its extension.
A `.txt` import gives its text by default.

A `file` loader in `moduleResolution.loaders` gives your code a URL. Mokly
delivers the file as it does for an image import. Use `file` for `.txt` or
the [asset types listed in this guide](/docs/authoring/styles/#import-images-fonts-and-media).
The build fails if Mokly applies `file` to any other type.

An import attribute overrides a configured loader, including `file`.
For example, `with { type: "text" }` gives your code the file's text.
A CSS import stays a stylesheet even with an import attribute.
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

A rule links its sheets into every entry that it applies to. Keep a rule for
CSS that all of those entries need, such as fonts. Import other CSS from the
module of the screen or component that uses it, so that it loads only in the
entries that import it. Some CSS needs a rule because a module cannot import
it. An HTML screen or component has no module, so a rule gives it its CSS. A
sheet for one color scheme loads from `lightStylesheets` or `darkStylesheets`.
An import names a local file, so an HTTP or HTTPS stylesheet loads from a rule.

In Changes, the comparison details name the bundle that holds each changed
rule. A configured or declared local stylesheet is a bundle of its own.
CSS that an entry, the renderer, or a Storybook preview imports is part of
that module's bundle.

With the [Vite adapter](/docs/authoring/vite/), configured and component-declared
local stylesheets must use a lowercase suffix that Vite supports. For example,
use `Action.css`, not `Action.CSS`. Without the adapter, Mokly accepts `Action.CSS`.

With the adapter, if the source path does not end in `.css`, Mokly adds `.css`
to the output path. For example, `design/base.scss` becomes
`styles/design/base.scss.css` in the generated output.

## Place component styles

A JavaScript component can declare its public stylesheet list. The document
links the files of components that actually render, in first-render order.
`$componentStylesheets` places those links among shared links. Without the
marker, they follow shared links and precede scheme-specific links. A file
listed by both configuration and a component links once.
