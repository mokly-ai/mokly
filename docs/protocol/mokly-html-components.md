# HTML Components

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md); not
implemented. The frozen TypeScript backend registers components only through
`defineComponent`.

## Purpose And Boundary

An HTML component is one `.component.html` file: front matter that declares
the element name, the props, the slots, and the saved variants, then a body
that renders them by substitution. Mokly renders it in Rust without
JavaScript. It joins the same registry as JavaScript components, so an HTML
screen can use either kind, a component page shows its variants, and Changes
attributes rules and resources to it like any registered component. An HTML
component cannot run code, loop, branch on values, or compute; a component
that needs those stays JavaScript.

## Front Matter

The block follows the [HTML screen front matter](./mokly-html-screens.md#front-matter)
rules. Keys:

| Key            | Type             | Meaning                                                             |
| -------------- | ---------------- | ------------------------------------------------------------------- |
| `element`      | string, required | the custom element name screens use                                 |
| `title`        | string, required | entry title                                                         |
| `description`  | string           | defaults to the empty string                                        |
| `tags`         | string list      | kebab-case tags                                                     |
| `path`         | string           | declared complete path                                              |
| `movedFrom`    | string           | previous complete path                                              |
| `rationale`    | string           | design rationale                                                    |
| `relatedDocs`  | string list      | related document links                                              |
| `dependencies` | string list      | declared files or directories                                       |
| `colorSchemes` | string list      | non-empty subset including `light`                                  |
| `propSchema`   | map, required    | prop name to schema; see Props                                      |
| `props`        | map              | the component's own prop values, rendered first on its page         |
| `slots`        | string list      | declared slot names; `children` must be declared to accept children |
| `variants`     | list             | saved variants; see Variants                                        |

`element` follows the custom element name grammar: lowercase ASCII, starts
with a letter, contains at least one hyphen, and is none of the names the HTML
standard reserves. It must be unique across HTML and JavaScript components;
a collision fails the build naming both files. Every `mokly-` name is
reserved for Mokly.

## Props

`propSchema` maps each prop name to a schema with the shape of the
[normative prop schema](./mokly-component-props.md#normative-schema) in YAML:

```yaml
propSchema:
  label: { kind: string, minLength: 1 }
  tone: { kind: enum, values: [primary, secondary] }
  disabled: { kind: boolean, optional: true }
  badge:
    { kind: object, optional: true, properties: { count: { kind: number } } }
```

`optional: true` marks an optional prop; everything else is the schema. There
are no defaults, coercions, or computed values, as in the normative schema.
Controls for live editing derive from the schema: a text control for `string`,
a toggle for `boolean`, a number control for `number`, a select for `enum`;
other kinds are shown but not editable.

## Body

The body is an HTML fragment with the screen body rules, plus substitution:

- `{{name}}` in text or in an attribute value substitutes the prop. A dotted
  path such as `{{badge.count}}` reads into an object prop. The value is
  HTML-escaped; there is no raw substitution.
- A substituted `boolean` prop in an attribute whose value is exactly
  `{{name}}` keeps the attribute when true and removes it when false.
- An omitted optional prop substitutes the empty string in text and removes an
  attribute whose value is exactly `{{name}}`.
- `{{…}}` naming an undeclared prop, an array, or an object without a path
  fails with `html-attribute`. `{{` that does not close is ordinary text.
- `<slot></slot>` is the `children` placeholder and `<slot name="x"></slot>`
  a named one. Supplied content replaces the element; the placeholder's own
  children are the default content when nothing is supplied. A placeholder for
  an undeclared slot fails with `html-slot`.
- A body may use other components by element name. A cycle fails with
  `html-element` naming the files in the cycle.

## Variants

Each `variants` entry declares `slug`, `title`, `props`, and may declare
`description`, `tags`, `movedFrom`, and `slots`. `props` replace top-level
keys of the component's own props, and the merged props must satisfy the
schema. `slots` maps declared slot names to HTML fragments that fill them on
the variant's page. A variant flattens into an entry of kind `component` at
the parent's path plus the slug, parent first, under the
[variant contract](./mokly-variants.md). Variants are optional: the
component's own `props` render first on its page, under the
[entry props contract](./mokly-entry-props.md).

## Rendering And Ownership

Rendering a component element substitutes the coerced props, fills the slots
with the supplied content, and renders nested components the same way. Each
rendered instance is an ownership region of the composed tree under the
[comparison contract](./mokly-comparison.md), carrying the component path, the
instance id, and the props key, so usage derives from the output rather than
from recorded offsets. Slot content keeps
its supplier as owner. A JavaScript component used from an HTML screen renders
through the [sidecar](./mokly-sidecar.md); the binary reads the fragment's
markers into the same regions.

A component's own page renders the component's own props and then each
variant, each with the component as the root instance, at every viewport and
colour scheme, with the configured stylesheets.

## Diagnostics

Errors use the [HTML screen codes](./mokly-html-screens.md#diagnostics) with
the component file, line, and column. One condition is specific to
components: `props`, or a variant's `props`, that the schema rejects fail with
`html-attribute` naming the variant slug and the property path.

## Example

`src/components/ui-button.component.html`:

```html
---
element: ui-button
title: Button
description: The primary action control.
tags: [ui]
propSchema:
  label: { kind: string, minLength: 1 }
  tone: { kind: enum, values: [primary, secondary] }
  disabled: { kind: boolean, optional: true }
props: { label: Save, tone: primary }
slots: [children]
variants:
  - slug: primary
    title: Primary
    props: { label: Save, tone: primary }
  - slug: disabled
    title: Disabled
    props: { label: Save, tone: primary, disabled: true }
---

<button class="btn btn-{{tone}}" disabled="{{disabled}}" type="button">
  <span class="btn-label">{{label}}</span>
  <slot></slot>
</button>
```

Used from a screen as `<ui-button label="Save" tone="primary"></ui-button>`,
it renders `<button class="btn btn-primary" type="button"><span
class="btn-label">Save</span></button>` as an ownership region. The entry
`components/ui-button` renders its own props first and has the variants
`components/ui-button/primary` and `components/ui-button/disabled`.

## Related Docs

- [Entry props and variants](./mokly-entry-props.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Registered components](./mokly-components.md) for the JavaScript form
- [Component prop schema](./mokly-component-props.md)
