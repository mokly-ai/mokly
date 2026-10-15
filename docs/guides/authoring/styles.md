---
title: "Styles"
description: "Link shared and scheme-specific CSS, then deliver its imports and assets with the catalogue."
section: "authoring"
order: 10
---

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

## Keep asset paths relative

A local stylesheet can import other CSS and use local image or font URLs.

```css
@import "./tokens.css";

.card {
  color: var(--ink);
  background-image: url("./images/card.svg");
}
```

Mokly bundles each configured local root. It delivers CSS below
`static/mokly-generated/styles/` and images and fonts below
`static/mokly-generated/assets/`. Local URLs keep their query and fragment.
Use existing regular files inside the repository. Root-absolute URLs,
symlinks, missing files, and unsupported asset extensions fail the build.

A local `@import` comes before style rules. Remote imports stay external.
For image sets, write `url()` for each local candidate.

```css
.preview {
  background-image: image-set(url("./small.png") 1x, url("./large.png") 2x);
}
```

Imported CSS and assets are private sources. Reference their delivered
routes in page HTML. Use a separate public copy when another document needs
an authored file URL.

## Use CSS Modules

A JavaScript import of `*.module.css` receives a class map. The same names
appear in delivered CSS. Names depend on the repository-relative stylesheet
path and the local name. Moving the file changes them. Editing a declaration
does not.

```css
.base {
  color: red;
}
.card {
  composes: base;
  padding: 16px;
}
:global(.app) .title {
  font-weight: 600;
}
```

Local classes, ids, and animation names are scoped. `:global(...)` keeps
names global. Custom properties, grid names, counter styles, and container
names stay global. A local `composes` names a class defined earlier in the
same file. `composes: utility from global` can add a global class.

## Place component styles

A JavaScript component can declare its public stylesheet list. The document
links the files of components that actually render, in first-render order.
`$componentStylesheets` places those links among shared links. Without the
marker, they follow shared links and precede scheme-specific links. A file
listed by both configuration and a component links once.

## Add consumer transforms

The optional `postcss` setting names one local module. It supplies PostCSS 8
plugins. Mokly applies them before CSS Modules and bundling. Imported CSS
from the renderer or entry modules uses the same delivery process. Keep
product providers in the renderer. It wraps React content and collects
styles; it does not assemble the document or add stylesheet links.

Read [Config](/docs/authoring/config/) for the configuration fields.
