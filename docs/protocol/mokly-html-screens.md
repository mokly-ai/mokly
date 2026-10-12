# HTML Screens, Pages, And Use Cases

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md); not
implemented. The frozen TypeScript backend accepts only TypeScript entry
modules and Markdown documents. The format adopts the decisions of the HTML
screens design on branch `calummoore/yaml-vs-html-screens`, with one change:
the screen suffix is `.screen.html`, not `.mockup.html`, so that screens,
components, and pages written in HTML follow one naming rule.

## File Kinds Without JavaScript

| Kind      | File suffix       | Body                                              |
| --------- | ----------------- | ------------------------------------------------- |
| screen    | `.screen.html`    | an HTML fragment rendered at both viewports       |
| component | `.component.html` | see [HTML components](./mokly-html-components.md) |
| page      | `.page.html`      | one complete HTML document, no viewport variants  |
| use case  | `.use-case.yaml`  | ordered steps that reference existing screens     |
| document  | `.md`             | see [Markdown documents](./mokly-documents.md)    |

The default root globs add these suffixes beside `**/*.mockup.{ts,tsx}`,
`**/*.stories.{ts,tsx,js,jsx}`, and `**/*.md`. A file's place in a root gives
its path under the [path contract](./mokly-paths.md); the suffix is removed
before the slug is derived. HTML and YAML files are inventoried authored
sources: protected from public delivery, watched, and never bundled.

## Front Matter

A screen, component, or page file starts with a front matter block: a first
line of exactly `---`, YAML, and a closing line of exactly `---`, after an
optional byte-order mark. LF and CRLF line endings are accepted. The YAML uses
the 1.2 core schema: duplicate keys fail, custom tags fail, aliases are
allowed, and `no` stays a string. A use case file is one YAML document with
the same keys and no body. Front matter is required because `title` is
required; a missing block fails with `html-front-matter`.

| Key            | Type             | Meaning                                                          |
| -------------- | ---------------- | ---------------------------------------------------------------- |
| `title`        | string, required | entry title                                                      |
| `description`  | string           | defaults to the empty string                                     |
| `tags`         | string list      | kebab-case tags, unique, authored order kept                     |
| `path`         | string           | declared complete path replacing the derived one                 |
| `movedFrom`    | string           | previous complete path for the [move contract](./mokly-moves.md) |
| `rationale`    | string           | design rationale shown in Details                                |
| `relatedDocs`  | string list      | related document links                                           |
| `dependencies` | string list      | declared files or directories, as today                          |
| `address`      | string           | screens: the address-bar label                                   |
| `useCasePaths` | string list      | screens: use cases the screen belongs to                         |
| `colorSchemes` | string list      | screens and components: non-empty subset including `light`       |
| `data`         | map              | screens: values that `$name` references substitute               |
| `variants`     | list             | screens: see Variants                                            |
| `steps`        | list             | use cases: `{ screenPath, title?, description? }` in order       |

An unknown key fails with `unknown field <field>`. Keys that do not apply to
a kind are unknown for that kind. A `data` key matches
`^[A-Za-z][A-Za-z0-9_-]*$`; an unused `data` entry is the `html-unused-data`
warning.

## Screen Body

The body after the closing `---` is an HTML fragment parsed by the HTML
fragment algorithm with `body` as the context element. Raw HTML elements pass
through unchanged. `script`, `html`, `head`, `body`, and `base` elements fail
with `html-element`, under the [document safety](./mokly-document-safety.md)
script policy. One body renders both viewports; an element with
`mokly-viewport="mobile"` or `mokly-viewport="desktop"` is kept in that
viewport only and removed from the other. Every other attribute is ordinary
HTML and is never interpreted.

A hyphenated element name resolves against the component registry: the
`element` of an [HTML component](./mokly-html-components.md) or of a
JavaScript component registered with `element`. A hyphenated name that matches
no component fails with `html-element`, because rendering it as a plain element
would silently lose the component. `mokly-ignore` and `mokly-ignore-scope` are
reserved names, below.

## Component Elements

- An attribute name is kebab-case and maps to the camelCase prop key. The
  value is coerced through the component's prop schema: `string` takes the
  text; `boolean` accepts an empty value, `true`, or `false`; `number` accepts
  a JSON number; `null` accepts `null`; `enum` accepts the text equal to the
  string form of exactly one value; `union` takes the first member that
  accepts. Array and object props need a `data` reference.
- A value that is exactly `$name` substitutes the `data` entry unchanged for
  any prop type; `$$` escapes a literal leading dollar. A missing reference
  fails with `html-data`. Schema validation runs after substitution and reports
  the component and the property path.
- `to`, `fragment`, `slot`, `mokly-instance`, and `mokly-viewport` are reserved
  on component elements and never reach props. Registering an `element` whose
  schema declares `to`, `fragment`, `slot`, or `moklyViewport` fails.
- Element children fill the `children` slot; a child with `slot="name"` fills
  that named slot. Content for a slot the component does not declare fails
  with `html-slot`.
- `mokly-instance` names the instance for comparison and inspection, under
  the [instance contract](./mokly-instances.md); it defaults to the slug rule.
- The HTML fragment algorithm moves a component element that sits directly in
  a raw `table`, `thead`, `tbody`, `tfoot`, or `tr` out of the table. When a
  component element's source lies inside a table whose subtree no longer
  contains it, Mokly reports `html-foster-parented`. Put component elements in
  `td`, `th`, or `caption`, or make the table a component.

## Links And Markers

- `href="mock:<path>[#fragment]"` on an anchor is rewritten after render under
  the [navigation contract](./mokly-navigation.md).
- `to="<path>"`, with an optional `fragment`, on a component element or on a
  raw `a`, `button`, `div`, or `span` makes that element a catalogue link
  control under the [link control contract](./mokly-link-controls.md), with
  the same root, tier, and fragment rules as `MockLink asChild`.
- `<mokly-ignore id="…" material-key="…">` marks a Review-ignore region and
  `<mokly-ignore-scope enabled="true|false">` a scope, with the semantics of
  `ReviewIgnore` and `ReviewIgnoreScope`. Both become the marker comments the
  [comparison contract](./mokly-comparison.md) reads.

## Variants

A screen `variants` entry declares `slug` and `title` and may declare
`description`, `tags`, `colorSchemes`, `address`, `rationale`, `relatedDocs`,
`dependencies`, `useCasePaths`, `movedFrom`, and `data`. A variant `data` map
replaces matching top-level keys and never deep merges. Inheritance follows the
[variant contract](./mokly-variants.md). The body is shared; a variant that
needs another tree is a separate file.

## Pages And Use Cases

A page body is one complete document starting with `<!doctype html>`. It may
use component elements, links, and markers like a screen, and it renders once,
with no viewport or colour-scheme variants, under the
[page contract](./mokly-pages.md). A use case file carries the front matter
keys and `steps`; each step's `screenPath` must name an existing screen,
including a variant.

## Rendering

1. Parse the front matter and the body. Resolve every component element.
2. Render HTML components in Rust by substitution and slot filling, recursively.
   Render JavaScript components through the [sidecar](./mokly-sidecar.md),
   memoized by props, viewport, and colour scheme, with slot placeholders.
3. Compose the fragment once per viewport and colour scheme, insert the
   instance and ignore markers, collect the styles the sidecar returned, and
   assemble the document with the configured stylesheets.
4. Rewrite links and validate them. Write the views under
   `mokly-generated/` with the [generated output](./mokly-generated-output.md)
   rules. Record the entry in manifest v11 with its usage ranges derived from
   the markers.

Build, Check, Serve, export, Changes, and publish treat an HTML screen like
every other screen. A catalogue of HTML files alone never starts a sidecar.

## Diagnostics

| Code                   | Meaning                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `html-front-matter`    | missing block, YAML error, unknown or invalid key              |
| `html-element`         | forbidden element, unknown hyphenated element, component cycle |
| `html-attribute`       | a value the prop schema rejects, or a reserved prop name       |
| `html-data`            | a missing `$name` reference                                    |
| `html-slot`            | content for an undeclared slot, or an unrendered placeholder   |
| `html-unused-data`     | warning: a `data` entry no element references                  |
| `html-foster-parented` | warning: a component element moved out of a table              |

Errors are `build-invalid` failures with the repository-relative file, line,
and column. Warnings use the [build warning record](./mokly-build-warnings.md).

## Example

`specs/account/home.screen.html`:

```html
---
title: Account home
description: The account landing screen.
tags: [account]
useCasePaths: [account/sign-in]
data:
  user: { name: Ada, plan: pro }
variants:
  - slug: empty
    title: Account home, empty
    data:
      user: { name: Ada, plan: free }
---

<ui-header user="$user"></ui-header>
<main class="account">
  <h1>Welcome back</h1>
  <ui-button label="Manage billing" to="account/billing"></ui-button>
  <ui-card tone="info" mokly-viewport="desktop">
    <p>Your plan renews on 1 November.</p>
  </ui-card>
</main>
```

The entry `account/home` renders at both viewports with `ui-header`,
`ui-button`, and `ui-card` resolved from the registry; `account/home/empty` is
its variant with the replaced `user` data. The card's paragraph fills its
`children` slot. Substitution with `{{…}}` belongs to component bodies; in a
screen body it is ordinary text.

## Related Docs

- [HTML components](./mokly-html-components.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md) for the JavaScript form
- [Rust core architecture](../architecture/rust-core.md)
