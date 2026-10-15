# HTML Screens, Pages, And Use Cases

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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

| Key            | Type             | Meaning                                                                                           |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `title`        | string, required | entry title                                                                                       |
| `description`  | string           | defaults to the empty string                                                                      |
| `tags`         | string list      | kebab-case tags, unique, authored order kept                                                      |
| `path`         | string           | declared complete path replacing the derived one                                                  |
| `movedFrom`    | string           | previous complete path for the [move contract](./mokly-moves.md)                                  |
| `rationale`    | string           | design rationale shown in Details                                                                 |
| `relatedDocs`  | string list      | related document links                                                                            |
| `address`      | string           | screens: the address-bar label                                                                    |
| `useCasePaths` | string list      | screens: use cases the screen belongs to                                                          |
| `colorSchemes` | string list      | screens and components: non-empty subset including `light`                                        |
| `propSchema`   | map              | a JSON Schema object under the prop schema profile; optional for screens, required for components |
| `props`        | map              | screens and components: the entry's own prop values                                               |
| `variants`     | list             | screens and components: see Variants                                                              |
| `steps`        | list             | use cases: `{ screenPath, title?, description? }` in order                                        |

An unknown key fails with `unknown field <field>`. Keys that do not apply to
a kind are unknown for that kind. A prop name matches
`^[A-Za-z][A-Za-z0-9_-]*$`; a prop that no `$name`, `{{name}}`, or `mokly-if`
reference in the body reads is the `html-unused-props` warning. Props, schema inference, and variants follow the
[entry props contract](./mokly-entry-props.md).

## Screen Body

The body after the closing `---` is an HTML fragment parsed by the HTML
fragment algorithm with `body` as the context element. Raw HTML elements pass
through unchanged. `script`, `html`, `head`, `body`, and `base` elements fail
with `html-element`, under the [document safety](./mokly-document-safety.md)
script policy. One body renders both viewports; an element with
`mokly-viewport="mobile"` or `mokly-viewport="desktop"` is kept in that
viewport only and removed from the other. An element with `mokly-if="$name"`
names a prop whose schema `type` is exactly `boolean`; it is kept when the
prop is true and removed when it is false or absent. `{{name}}` in text or in
an attribute value substitutes a prop, HTML-escaped, with no raw form; a
dotted path such as `{{badge.count}}` reads into an object prop; a `boolean`
prop in an attribute whose value is exactly `{{name}}` keeps the attribute
when true and removes it when false; an absent optional prop substitutes the
empty string in text and removes such an attribute; `{{…}}` naming an
undeclared prop, an array, or an object without a path fails with
`html-props`; `{{` that does not close is ordinary text. Every other
attribute is ordinary HTML and is never interpreted. A component body uses
this same template language with the component's own props and adds slot
placeholders under the [HTML components contract](./mokly-html-components.md#body);
one parser and one renderer serve both.

A hyphenated element name resolves against the component registry: the
`element` of an [HTML component](./mokly-html-components.md) or of a
JavaScript component registered with `element`, which the sidecar's `describe`
call reports. A hyphenated name that matches
no component fails with `html-element`, because rendering it as a plain element
would silently lose the component. Every element name with the `mokly-`
prefix is reserved for Mokly: `mokly-ignore` and `mokly-ignore-scope` are
defined below, `mokly-slot` belongs to the [render sidecar](./mokly-sidecar.md),
and any other `mokly-` name fails with `html-element`.

## Component Elements

- An attribute name is kebab-case and maps to the camelCase prop key. The
  value is coerced through the component's prop schema: `string` takes the
  text; `boolean` accepts an empty value, `true`, or `false`; `number` and
  `integer` accept a JSON number; `null` accepts `null`; `enum`, `const`, and
  `oneOf` accept the text equal to the string form of exactly one value; a
  `type` list or `anyOf` takes the first member that accepts. Array and object
  props need a `$name` reference.
- A value that is exactly `$name` substitutes the prop unchanged for any prop
  type; `$$` escapes a literal leading dollar. A reference to an undeclared
  prop fails with `html-props`; an absent optional prop omits the attribute,
  so the component receives no value. Schema validation runs after
  substitution and reports the component and the property path.
- `to`, `fragment`, `slot`, `mokly-instance`, `mokly-viewport`, and `mokly-if`
  are reserved on component elements and never reach props. Registering an
  `element` whose schema declares `to`, `fragment`, `slot`, `moklyViewport`, or
  `moklyIf` fails.
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
  `ReviewIgnore` and `ReviewIgnoreScope`. An ignore region becomes an ignored
  region of the composed tree under the
  [comparison contract](./mokly-comparison.md). A scope is resolved while the
  screen is composed and leaves nothing in the output: a disabled scope
  suppresses the ignore regions inside it, and the innermost scope wins. A
  component element inside a scope renders with that scope state, the
  component's own scopes nest inside it, and slot content takes the state at
  its placeholder.

## Variants

A screen `variants` entry declares `slug` and `title` and may declare
`description`, `tags`, `colorSchemes`, `address`, `rationale`, `relatedDocs`,
`useCasePaths`, `movedFrom`, and `props`. A variant `props`
map replaces matching top-level keys and never deep merges, under the
[entry props contract](./mokly-entry-props.md). Metadata inheritance follows the
[variant contract](./mokly-variants.md). The body is shared: a variant changes
what it shows through `$name`, `{{name}}`, and `mokly-if`, and a variant that
needs another tree is a separate file.

## Pages And Use Cases

A page body is one complete document starting with `<!doctype html>`. It may
use component elements, links, and markers like a screen, and it renders once,
with no viewport or colour-scheme variants, under the
[page contract](./mokly-pages.md). A use case file carries the front matter
keys and `steps`; each step's `screenPath` must name an existing screen,
including a variant.

## Rendering

1. Parse the front matter and the body, resolve the props of the entry or
   the variant, substitute them, and resolve every component element.
2. Render HTML components in Rust by substitution and slot filling, recursively.
   Render JavaScript components through the [sidecar](./mokly-sidecar.md),
   memoized by props, viewport, colour scheme, and the enclosing ignore
   scope, with slot placeholders that report their scope state.
3. Compose the fragment once per viewport and colour scheme, attach the
   instance ownership and the ignore regions to the tree, collect the styles
   the sidecar returned, and assemble the document with the configured
   stylesheets.
4. Rewrite links and validate them. Keep the views in the render cache keyed
   by their inputs; Serve, Changes, and `build` read them there, and nothing is
   written to the repository. Record the entry's usage in the catalogue model
   from the attached ownership.

Serve, `build`, Changes, and publish treat an HTML screen like every other
screen. A catalogue of HTML files alone never starts a sidecar.

## Diagnostics

| Code                   | Meaning                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html-front-matter`    | missing block, YAML error, unknown or invalid key                                                                                                                                       |
| `html-element`         | forbidden element, unknown hyphenated element, component cycle                                                                                                                          |
| `html-attribute`       | a value the prop schema rejects, or a reserved prop name                                                                                                                                |
| `html-props`           | a `$name`, `{{name}}`, or `mokly-if` reference to an undeclared prop, `{{name}}` on an array or an object without a path, or `mokly-if` on a prop whose `type` is not exactly `boolean` |
| `html-slot`            | content for an undeclared slot, or an unrendered placeholder                                                                                                                            |
| `html-unused-props`    | warning: a prop no reference in the body reads                                                                                                                                          |
| `html-foster-parented` | warning: a component element moved out of a table                                                                                                                                       |

The discovery warning messages are exactly
`prop "<name>" is not read by the body` for `html-unused-props` and
`component element <element> is moved out of a table` for `html-foster-parented`.
The subject is the complete entry path; an unused component prop uses a
component subject. Source coordinates are one-based.

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
props:
  user: { name: Ada, plan: pro }
  renews: true
variants:
  - slug: free
    title: Account home, free plan
    props:
      user: { name: Ada, plan: free }
      renews: false
---

<ui-header user="$user"></ui-header>
<main class="account">
  <h1>Welcome back, {{user.name}}</h1>
  <ui-button label="Manage billing" to="account/billing"></ui-button>
  <ui-card tone="info" mokly-viewport="desktop" mokly-if="$renews">
    <p>Your plan renews on 1 November.</p>
  </ui-card>
</main>
```

The entry `account/home` renders at both viewports with `ui-header`,
`ui-button`, and `ui-card` resolved from the registry; `account/home/free` is
its variant with the replaced props, and its card is removed because `renews`
is false. The inferred schema has `user` as an object and `renews` as a
`boolean`. The card's paragraph fills its `children` slot.

## Related Docs

- [HTML components](./mokly-html-components.md)
- [Entry props and variants](./mokly-entry-props.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md) for the JavaScript form
- [Rust core architecture](../architecture/rust-core.md)
