# HTML Components

Status: Component bodies do not render as templates yet. [Milestone 4](../../plans/mokly-html-minijinja-templates.md#milestone-4-render-before-the-parse) adds the render before the parse.

## Purpose And Boundary

An HTML component is one `.component.html` file: front matter that declares
the element name, the props, the slots, and the saved variants, then a body
that renders them as a [template](./mokly-html-templates.md). Mokly renders
it without JavaScript. It
joins the same registry as JavaScript components, so an HTML
screen can use either kind, a component page shows its variants, and Changes
attributes rules and resources to it like any registered component. An HTML
component can loop, branch, and compute text through the template language.
It runs no JavaScript and reads no input other than its props. A component
that needs JavaScript stays a JavaScript component.

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
| `colorSchemes` | string list      | non-empty subset including `light`                                  |
| `propSchema`   | map, required    | a JSON Schema object under the prop schema profile; see Props       |
| `props`        | map              | the component's own prop values, rendered first on its page         |
| `slots`        | string list      | declared slot names; `children` must be declared to accept children |
| `variants`     | list             | saved variants; see Variants                                        |

`element` follows the custom element name grammar: lowercase ASCII, starts
with a letter, contains at least one hyphen, and is none of the names the HTML
standard reserves. It must be unique across HTML and JavaScript components;
a collision fails the build naming both files. Every `mokly-` name is
reserved for Mokly.

## Props

`propSchema` is a JSON Schema object under the
[prop schema profile](./mokly-entry-props.md#prop-schema-profile), in YAML:

```yaml
propSchema:
  type: object
  additionalProperties: false
  required: [label, tone]
  properties:
    label: { type: string, minLength: 1 }
    tone:
      oneOf:
        - { const: primary, title: Primary }
        - { const: secondary, title: Secondary }
    disabled: { type: boolean }
    badge:
      type: object
      additionalProperties: false
      required: [count]
      properties: { count: { type: integer } }
```

A prop absent from `required` is optional. The schema gives no defaults or
coercions. The body can compute text from the props under the
[template language](./mokly-html-templates.md). Controls for live editing
derive from the schema under the
[entry props contract](./mokly-entry-props.md).

## Body

The body is a [template](./mokly-html-templates.md) that renders to an HTML
fragment, with the component's own props as its context. It follows the
[screen body](./mokly-html-screens.md#screen-body) rules: `mokly-if`,
`mokly-viewport`, and the
[component element rules](./mokly-html-screens.md#component-elements) for the
components it nests, with the same diagnostics. A component body adds:

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
the variant's page. Each saved slot is a template that renders with the
variant's props. A variant flattens into an entry of kind `component` at
the parent's path plus the slug, parent first, under the
[variant contract](./mokly-variants.md). Variants are optional: the
component's own `props` render first on its page, under the
[entry props contract](./mokly-entry-props.md).

## Rendering And Ownership

Rendering a component element renders the body with the coerced props, fills
the slots with the supplied content, and renders nested components the same way. Each
rendered instance is an ownership region of the composed tree under the
[comparison contract](./mokly-comparison.md), carrying the component path, the
instance id, and the props key, so usage derives from the output rather than
from recorded offsets. Slot content keeps
its supplier as owner and keeps the supplier's relative-link base. Relative
links in the component body use the component entry's base, including when
another entry renders it. A JavaScript component used from an HTML screen renders
through the [sidecar](./mokly-sidecar.md); the binary reads the fragment's
markers into the same regions.

A component's own page renders the component's own props and then each
variant, each with the component as the root instance, at every viewport and
colour scheme, with the configured stylesheets.

## Diagnostics

Errors use the [HTML screen codes](./mokly-html-screens.md#diagnostics) with
the component file, line, and column. The component's `props`, or a
variant's merged `props`, that the schema rejects fail with `html-attribute`
naming the variant slug, when any, and the property path.

## Example

`src/components/ui-button.component.html`:

```html
---
element: ui-button
title: Button
description: The primary action control.
tags: [ui]
propSchema:
  type: object
  additionalProperties: false
  required: [label, tone]
  properties:
    label: { type: string, minLength: 1 }
    tone: { enum: [primary, secondary] }
    disabled: { type: boolean }
props: { label: Save, tone: primary }
slots: [children]
variants:
  - slug: primary
    title: Primary
    props: { label: Save, tone: primary }
  - slug: disabled
    title: Disabled
    props: { disabled: true }
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
- [HTML body templates](./mokly-html-templates.md)
- [Registered components](./mokly-components.md) for the JavaScript form
- [Component prop schema](./mokly-component-props.md)
