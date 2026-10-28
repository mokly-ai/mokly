# HTML Screens, Pages, And Use Cases

## File Kinds Without JavaScript

| Kind      | File suffix       | Body                                              |
| --------- | ----------------- | ------------------------------------------------- |
| screen    | `.screen.html`    | an HTML fragment rendered at both viewports       |
| component | `.component.html` | see [HTML components](./mokly-html-components.md) |
| page      | `.page.html`      | one complete HTML document, no viewport variants  |
| use case  | `.use-case.yaml`  | ordered steps that reference existing screens     |
| document  | `.md`             | see [Markdown documents](./mokly-documents.md)    |

The [default root globs](./mokly-root-discovery.md#root-fields) include these
suffixes. The [path contract](./mokly-paths.md)
derives paths from each file's root and removes the suffix before deriving its
slug. HTML and YAML sources are protected from public delivery, watched, and never bundled.

## Front Matter

A screen, component, or page file starts with a front matter block: a first
line of exactly `---`, YAML, and a closing line of exactly `---`, after an
optional byte-order mark. LF and CRLF line endings are accepted. The YAML
follows the [front matter YAML rules](./mokly-front-matter-yaml.md). A use
case file is one YAML document with the same keys and no body. Front matter
is required because `title` is required; a missing block fails with
`html-front-matter`.

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
this template language with its own props and adds slot placeholders under the [HTML components contract](./mokly-html-components.md#body).
One parser and one renderer serve both. Checks and warnings read each body in the parser's text modes, with scripting disabled, so raw text holds no elements.

Substitutions accept ASCII whitespace around the prop path: `{{ name }}` equals
`{{name}}` in text and attributes. Whitespace inside a dotted path fails.

A hyphenated name resolves against the component registry. Its name comes from
the `element` of an HTML component or JavaScript component; the sidecar
`describe` call reports JavaScript names. An unknown hyphenated name fails with
`html-element` because plain rendering would lose the component. Every `mokly-`
name is reserved: `mokly-ignore` and `mokly-ignore-scope` are defined below,
`mokly-slot` belongs to the [render sidecar](./mokly-sidecar.md), and any other `mokly-` name fails with `html-element`.

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
  that named slot. Several children can fill one slot, in document order.
  Content for a slot the component does not declare fails with `html-slot`.
- `mokly-instance` names the instance for comparison and inspection, under
  the [instance contract](./mokly-instances.md); it defaults to the slug rule.
- HTML5 parsing can move a component or its output, including direct table
  use, blocks in `p`, and nested anchors. Mokly uses the re-parsed browser tree.
  `html-foster-parented` names the component and parent. Split instance, slot,
  and ignore regions lose their regions; their nodes belong to the enclosing
  region, and ignored content then compares normally. Use a parent that permits
  the output, such as `td`, `th`, or `caption` in tables.

## Links And Markers

Authored comments starting with `mokly-` after leading whitespace are removed
without an error. Served documents reserve this prefix for package markers.
Ordinary comments remain content. Composed `href` and `src` follow the
[URL policy](./mokly-document-safety.md#url-policy), which rejects `data:`
and protocol-relative `//` URLs.

- `href="mock:<path>[#fragment]"` on an anchor is rewritten after render under
  the [navigation contract](./mokly-navigation.md).
- `to="<path>"`, with an optional `fragment`, on a component element or on a
  raw `a`, `button`, `div`, or `span` makes that element a catalogue link
  control under the [link control contract](./mokly-link-controls.md), with
  the same root, tier, and fragment rules as `MockLink asChild`.
- `<mokly-ignore id="…" material-key="…">` marks a Review-ignore region and
  `<mokly-ignore-scope enabled="true|false">` a scope, with the semantics of
  `ReviewIgnore` and `ReviewIgnoreScope`. An ignore region becomes an ignored
  region under the [comparison contract](./mokly-comparison.md). Scopes leave
  nothing in the output. Disabled scopes suppress their ignore regions, and
  the innermost scope wins. Components inherit that state and nest their own
  scopes inside it. Slot content takes the state at its placeholder.

Ignore ids use lowercase kebab-case. `mokly-ignore` accepts `id` and
`material-key`; `mokly-ignore-scope` accepts `enabled`. Both accept `mokly-if`
and `mokly-viewport`. Invalid ids fail with `html-element`. Unknown attributes
warn once per shared body and attribute. Their values are not evaluated and do not enter document keys.
Strict builds fail. The reserved navigation names `data-mokly-link` and `data-mokly-link-control…` are not unknown attributes: a body or callback output that supplies one fails, and a saved slot warns that the name is rejected.
Delivered documents and `srcdoc` values keep unknown wrapper attributes for resource and style checks.
The [public closure](./mokly-public-closure.md) and Changes never see unknown attributes on wrappers in authored bodies or in sidecar output.

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

HTML components render by substitution and slot filling, recursively.
JavaScript components render through the [sidecar](./mokly-sidecar.md), with
slot placeholders that report their scope state. The
[rendering contract](./mokly-rendering.md) owns document composition and
assembly. Rendering writes nothing to the repository. Serve, `build`,
Changes, and publish use the same rendering. An HTML-only catalogue never
starts a sidecar.

## Diagnostics

| Code                   | Meaning                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html-front-matter`    | missing block, YAML error, unknown or invalid key                                                                                                                                       |
| `html-element`         | forbidden element, unknown hyphenated element, component cycle                                                                                                                          |
| `html-attribute`       | a value the prop schema rejects, or a reserved prop name                                                                                                                                |
| `html-props`           | a `$name`, `{{name}}`, or `mokly-if` reference to an undeclared prop, `{{name}}` on an array or an object without a path, or `mokly-if` on a prop whose `type` is not exactly `boolean` |
| `html-slot`            | content for an undeclared slot, or an unrendered placeholder                                                                                                                            |
| `html-unused-props`    | warning: a prop no reference in the body reads                                                                                                                                          |
| `html-foster-parented` | warning: HTML5 parsing moved component content                                                                                                                                          |

The warning messages are exactly
`prop "<name>" is not read by the body` for `html-unused-props` and
`component element <element> is moved out of <parent> by HTML parsing` for `html-foster-parented`.
Discovery checks each shared body once. Discovery and render warnings name the
parent entry, including for variants, and equal warnings are reported once.
Component bodies use a component subject; screen bodies use an entry subject.

Errors are `build-invalid` failures with the repository-relative file and
one-based line and column. Warnings use the [build warning record](./mokly-build-warnings.md).

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

`account/home` renders both viewports with the three registered components.
The `account/home/free` variant replaces props and removes the card when
`renews` is false. Inference gives `user` an object schema and `renews` a
boolean schema. The paragraph fills the card's `children` slot.

## Related Docs

- [HTML components](./mokly-html-components.md)
- [Entry props and variants](./mokly-entry-props.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md) for the JavaScript form
- [Rust core architecture](../architecture/rust-core.md)
