# Registered Components

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Product Contract

A registered component owns a catalogue page, optional variant entries, and
comparisons. Its rendered instances connect that page to consuming screens
and other components. Registration supplies the identity used by previews,
automatic change attribution, the shared icon inspector, and highlighting;
consumers do not maintain separate usage lists or per-screen Review-ignore
hashes.

A component-only change appears in Changes as a component entry. Consuming
screens are linked under Affected screens and do not enter Changes or increase
its count unless they have an independent screen change. See the
[attribution contract](./mokly-component-changes.md).

A component is written in one of two forms. An HTML component is a
`.component.html` file under the
[HTML components contract](./mokly-html-components.md). A JavaScript
component is a `defineComponent` definition, defined below. Both join one
registry and render under one model: a render over props, with a prop schema,
the component's own props, and optional variants that are props sets, under
the [entry props contract](./mokly-entry-props.md).

## Authoring Boundary

The `@mokly/mokly` package exports `defineComponent`. It returns one definition, which
an entry module exports to register it under the
[entry module contract](./mokly-entry-modules.md). The definition carries a
typed `Component` wrapper that renders the consumer's real component through
the adapter; a consumer re-exports that wrapper once from its mockup
component module and uses ordinary JSX throughout its React screens.

```tsx
// src/components/action/index.mockup.tsx
const action = defineComponent({
  element: "app-action",
  title: "Action",
  description: "The primary action for a task.",
  stylesheets: ["components/action.css"],
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string", minLength: 1 },
      disabled: { type: "boolean" },
    },
  } as const,
  props: { label: "Continue" },
  slots: ["children"],
  render: (props) => <Action disabled={props.disabled}>{props.label}</Action>,
  variants: [
    { slug: "disabled", title: "Disabled", props: { disabled: true } },
  ],
});

export default action;

// A React screen uses the same registered render adapter.
const submit = (
  <action.Component
    moklyInstance="submit"
    label="Confirm payment"
    disabled={false}
  />
);
```

The input includes the common entry metadata, `propSchema`, and `render`.
`element`, `props`, `variants`, `tags`, `colorSchemes`, `controls`, `slots`,
and `stylesheets` are optional. Path, tag, and colour-scheme validation
applies; the parent's slug defaults to the module's file name, so the example
above is `components/action` under a root with the prefix `components`.

- `propSchema` is a JSON Schema object under the
  [prop schema profile](./mokly-entry-props.md#prop-schema-profile); the
  [component prop schema contract](./mokly-component-props.md) defines the
  derived types, the plain-data rule, and the wire form. There is no
  inference for a component: the schema is declared.
- `props` are the component's own prop values. They default to the empty map
  and must satisfy the schema, so a schema with a `required` prop needs
  `props`. The component's page renders them first.
- `variants` each declare `slug`, `title`, and `props` that replace top-level
  keys of the component's own props; `description`, `tags`, `movedFrom`, and
  `slots` are optional. A variant's `slots` maps declared slot names to
  React nodes shown on its page. The merged props must satisfy the schema.
  Each variant flattens into a `kind: "component"` entry at the parent's path
  plus the slug with `variantOf`, `props`, and `suppliedSlots`, inheriting the
  parent's `colorSchemes`, `relatedDocs`, and `tags`, under the
  [variant contract](./mokly-variants.md#authoring). Unknown variant fields
  fail the general `invalid-field` rule after the parent's path is known.
- `render(props, { viewport, colorScheme })` receives the validated props
  and may choose a viewport-specific consumer component. Theme providers and
  styling are consumer-owned; the configured renderer module wraps the
  render.
- `controls` replaces the controls derived from the schema under the
  [controls contract](./mokly-component-controls.md).
- `slots` names React-node props such as `children`; `children` must be
  declared to accept children. Slot content renders under the caller's
  ownership, even when the receiving component places it inside its markup,
  so its rendered content and nested registered instances stay independently
  comparable. A component cannot absorb a screen's primary content by
  accepting it as a slot.
- `stylesheets` declares local CSS delivery roots under the
  [stylesheet contract](./mokly-component-stylesheets.md).

Data props are plain data. Adapters expose complex values such as callbacks or
icons through stable string preset keys and resolve them to actual values in
consumer code. Changing a preset key is an input change; changing its consumer
implementation is attributed through changed output or a changed rendered
resource, not its source path alone. Mokly never fingerprints a callback's
source or a function's identity. All supplied data props participate in
material comparison, including props without a control or without visible
output.

## Registry

HTML components and `defineComponent` definitions share one registry. The
[sidecar](./mokly-sidecar.md#definitions) reports every JavaScript
definition through `describe`; the Rust core parses the HTML components and
builds the registry from both before any render starts.

`element` names the custom element that HTML screen and component bodies use
for the component under the
[component element rules](./mokly-html-screens.md#component-elements), with
attributes coerced through the prop schema. It follows the custom element
name grammar: lowercase ASCII, starts with a letter, contains at least one
hyphen, and is none of the names the HTML standard reserves. Every `mokly-`
name is reserved for Mokly. An element name must be unique across HTML and
JavaScript components; a collision fails registration naming both files. A
component without `element` is usable only from React through its wrapper.
Registering an `element` whose schema declares `to`, `fragment`, `slot`,
`moklyViewport`, or `moklyIf` fails, because those attributes are reserved
on component elements.

Registration validates every definition with source attribution before any
output exists: the schema against the profile, the component's own props and
every variant's merged props against the schema, each control against a
declared data prop, and the slot names against the data keys. Data keys and
slot names must be disjoint, and neither may use `moklyInstance`, `key`, or
`ref`.

A private definition can remain unregistered while its `Component` wrapper
is unused. Invoking the wrapper of a definition that no entry module exports
fails at render time with `render-failed`, presented by the CLI as `build-invalid`.
The exact message is
`{module} export {name} ({viewport}, {colorScheme}): unexported component {title} from {definedIn}`.
The prefix identifies the invoking entry. The defining module can be an
imported helper. If its module is outside the owned repository sources,
`{definedIn}` is `unknown module`. Mokly never registers an unreachable
component page.

## Instances And Ownership

`moklyInstance` is wrapper-only kebab-case input, stripped before consumer
rendering; `mokly-instance` is its attribute form on a component element in
an HTML body. Its default, scope, stable key, duplicate rules, and sentinels
belong to [Component Instance Identity](./mokly-instances.md). Each rendered
instance is an ownership region of the composed tree under the
[comparison contract](./mokly-comparison.md#markers): the Rust core attaches
the region to an HTML component it renders, and reads a sidecar fragment's
markers into the same regions. Usage derives from those regions, so only
actual rendering establishes usage; import lists do not. The
[usage-record contract](./mokly-component-usage-records.md) owns the records,
input versus rendered ownership, per-view separation, and null instances.

A component's path derives from its file like every entry, and the viewer's
Components section shows the folders that contain components under the
[read model tree rule](./mokly-catalogue.md#tree); the documented convention
is a root with `path: "components"` over the component library. Components
have derived tags and breadcrumbs from folder titles. Use-case steps reference
screens only. Component-to-component and screen-to-component backlinks are
derived from usage rather than separately authored relationships.

## Rendering, Documents, And Read Model

From a React screen, the wrapper renders inside the screen's fragment and
writes the instance markers. From an HTML body, the core renders the
component through `renderComponent` with the coerced props, the slot
placeholders, and the enclosing ignore scope, memoized by handle, props,
viewport, colour scheme, and scope, and grafts the returned fragment with its
collected styles under the [sidecar contract](./mokly-sidecar.md). The
component's own page renders its own props first and then each variant, with
the component as the root instance, at every viewport and effective colour
scheme, with the configured and declared stylesheets. Serve keeps every
document in the render cache. `build` reads the head capture under the
[render graph contract](./mokly-render-cache.md#render-cache-and-captures),
and nothing is written to the repository.

Read model v7 gives a component entry `propSchema`, `props` in the wire form,
`slots`, `suppliedSlots`, `controls`, `views`, and `variantOf` exactly on a
variant, under the [catalogue contract](./mokly-catalogue.md); a parent has
its own views and an empty `suppliedSlots`. Per-view usage, resource
evidence, and the workspace lists travel in the entry detail of the
[shell delivery contract](./mokly-shell-delivery.md#entry-detail).
Comparison metadata and props contain no timestamps, absolute checkout paths,
function bodies, or transient control values. Only data props are serialized
as values; slots serialize ownership references and rendered material, never
React elements or executable definitions. Inspector values come from the
recorded props. Source metadata is repository-relative and secondary to the
preview.

Serve, `build`, watched rebuilds, Changes, and publish use the same registry
and rendering path. Unregistered components keep ordinary screen rendering
and Review-ignore behaviour.

## Diagnostics

Every code below is a `build-invalid` failure attributed to the module path
and export name of the definition; a variant failure names the variant slug,
and a props failure names the property path.

| Code                 | Condition                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `component-schema`   | `propSchema` is absent, is not an object schema, or uses a keyword outside the profile             |
| `component-props`    | the component's own props or a variant's merged props fail the schema, or a prop is not plain data |
| `component-element`  | `element` is outside the grammar, reserved, already registered, or declares a reserved prop        |
| `component-controls` | a control names an undeclared prop or a slot, or its kind does not fit the prop's schema           |
| `component-slots`    | a slot name repeats a data key, or a slot or data key is `moklyInstance`, `key`, or `ref`          |
| `invalid-field`      | an unknown input or variant field, with the text `unknown field <field>`                           |

## Related Contracts

- [Entry props and variants](./mokly-entry-props.md)
- [HTML components](./mokly-html-components.md)
- [Component change attribution](./mokly-component-changes.md)
- [Component stylesheet declaration and linking](./mokly-component-stylesheets.md)
- [Component prop schema and codec](./mokly-component-props.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
- [Component controls](./mokly-component-controls.md)
- [Render sidecar](./mokly-sidecar.md)
- [Render pipeline](../architecture/build-pipeline.md)
