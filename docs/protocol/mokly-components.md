# Registered Components

## Delivery Status

The public `defineComponent` API, saved variants, ownership attribution,
explorer, inspection, and local controls are implemented. The
[component explorer plan](../../plans/component-explorer.md) records delivery.
Existing unregistered catalogues retain their output and Review-ignore behavior.

## Product Contract

A registered component owns a catalogue page, variant entries, and comparisons.
Its actual rendered instances connect that page to consuming screens and other
components. Registration supplies the identity used by previews, automatic
change attribution, the shared icon inspector, and highlighting; consumers do not
maintain separate usage lists or per-screen Review-ignore hashes.

A component-only change appears in Changes as a component entry. Consuming
screens are linked under Affected screens and do not enter Changes or increase
its count unless they have an independent screen change. See the
[attribution contract](./mokly-component-changes.md).

## Authoring Boundary

The root package exports `defineComponent`. It returns `entries`, the parent
entry followed by one entry per variant in authored order, beside a typed
`Component` wrapper for composition. Exporting the returned object, or its
`entries`, registers them under the
[entry module contract](./mokly-entry-modules.md). The wrapper
uses the consumer's real component through a render adapter. A consumer can
re-export that wrapper once from its mockup component module and use ordinary
JSX throughout its screens.

Register an adapter and its saved examples with the public API:

```tsx
// src/components/action/index.mockup.tsx
const action = defineComponent({
  title: "Action",
  description: "The primary action for a task.",
  dependencies: ["src/components/Action.tsx"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: {
      label: { schema: { kind: "string" } },
      disabled: { schema: { kind: "boolean" } },
    },
  },
  render: (props) => <Action disabled={props.disabled}>{props.label}</Action>,
  variants: [
    {
      slug: "default",
      title: "Default",
      props: { label: "Continue", disabled: false },
    },
    {
      slug: "disabled",
      title: "Disabled",
      props: { label: "Continue", disabled: true },
    },
  ],
  controls: {
    label: { kind: "text" },
    disabled: { kind: "boolean" },
  },
});

export default action;

// A screen uses the same registered render adapter.
const submit = (
  <action.Component
    moklyInstance="submit"
    label="Confirm payment"
    disabled={false}
  />
);
```

Registry preparation repeats the authoring helper's component validation on
every exported definition, including forged objects and definitions mutated
after registration. It snapshots schemas, controls and saved data before
rendering. Invalid exports fail with source-attributed component diagnostics
before output generation; helper branding alone is not validation.

The input includes the common entry metadata, `propSchema`, `render`, and a
nonempty ordered `variants` list. `tags`, `colorSchemes`, `controls`, `slots`,
and `ownedDependencies` are optional. Path, dependency, tag, and
color-scheme validation applies; the parent's slug defaults to the module's
file name, so the example above is `components/action` under a root with the
prefix `components`, and its file names follow the
[artifact path contract](./mokly-artifact-paths.md). Each variant contains a
slug, title, complete typed props, and an optional description. An authored description must be nonempty and becomes the variant
entry's description; when omitted, the flattened entry copies the parent's
description. `defineComponent` retains unknown variant fields for general `invalid-field` validation after
the final parent path is known; the diagnostic follows the
[variant contract](./mokly-variants.md#authoring). A variant's path is the
parent's path plus its slug, such as `components/action/default`, and each
variant flattens into its own `kind: "component"` entry carrying the derived
`variantOf`, `props`, and `suppliedSlots` and inheriting the parent's
`colorSchemes`, `dependencies`, `relatedDocs`, and `tags`, as the
[variant contract](./mokly-variants.md) defines. The parent entry has no
`variants` field and no views; its page shows its first variant entry, which
is the default. There is no implicit merge between variants.

The required [prop schema](./mokly-component-props.md) determines the adapter,
wrapper, and variant data types. Its shared runtime validator checks typed and
untyped calls, recorded props, and local controls; render annotations and saved
variants do not infer or override that schema. The adapter receives
`render(props, { viewport, colorScheme })` and may choose a
viewport-specific consumer component. Theme providers and styling remain
consumer-owned.
`RenderInput.entry` is a screen definition or a component variant entry, and
a component render carries that variant's validated props in `componentProps`;
both use the configured renderer and one consumer React instance.
Packed-consumer tests cover this public type.

Ordinary inputs are deterministic plain data: strings, booleans, finite
numbers, null, arrays, and plain objects, with the existing material-key
handling of undefined values. All supplied data props participate in material
comparison, including props without a control or without visible output.
Functions, symbols, cycles, and non-plain objects cannot be silently omitted.
Adapters expose complex values such as callbacks or icons through stable
string preset keys and resolve them to actual values in consumer code.
Mokly never fingerprints a callback's source or a function's identity.

`slots` names React-node props such as `children`. Slot content is rendered
under the caller's ownership, even when the receiving component places it
inside its markup. Its rendered content and nested registered instances remain
independently comparable. A component cannot absorb a screen's primary content
by accepting it as a slot. Named data presets remain suitable for fixed icons
or content examples. Changing a preset key is an input change; changing its
consumer implementation belongs to its defining component/dependencies.

## Instances And Ownership

`moklyInstance` is wrapper-only kebab-case input, stripped before consumer
rendering. Its default, scope, stable key, duplicate rules, and sentinels belong
to [Component Instance Identity](./mokly-instances.md). The
[usage-record contract](./mokly-component-usage-records.md) owns collector
records, input versus DOM ownership, repeated ranges, per-view separation, null
instances, and the rule that only actual rendering establishes usage.

A component's path derives from its file like every entry, and the viewer's
Components section shows the folders that contain components under the
[read model tree rule](./mokly-catalogue.md#tree); the documented convention
is a root with `path: "components"` over the component library. Components
have derived file names, tags, and breadcrumbs from folder titles. Use-case
steps continue to reference screens only.
Component-to-component and screen-to-component backlinks are derived from
usage rather than separately authored relationships.

## Generated Artifacts

One complete static document is generated for every component variant entry,
viewport, and effective color scheme. The parent has no views; its page shows
its first variant. Exact names follow the
[artifact path contract](./mokly-artifact-paths.md). Output collision,
source protection, resource validation, generated-tree inventory and transactional-write checks apply.

Every current catalogue emits manifest schema v9, including typed component
parent and variant entries and per-view usage records for screens and component
variants; no entry stores a route or view path. The
[manifest schema](./mokly-component-manifest.md) defines every record,
reference, ordering rule, and validation boundary. Baseline readers accept the
same v9 contract; earlier output makes Changes unavailable as defined by
[baseline compatibility](./mokly-baseline-compatibility.md).

Inert, package-owned DOM markers bind generated ranges to their usage records.
The collector is scoped to a render, not a process-global mutable registry.
Markers support nesting, multiple roots, and text without introducing layout
wrappers. Parsed validation rejects forged, duplicate, overlapping, unmatched,
or moved records and verifies ownership in final rendered documents.
The existing flat `ReviewIgnore` marker language remains separate and strict.

Comparison metadata, dependencies, and props contain no timestamps, absolute
checkout paths, function bodies, or transient controls values. Only data props
are serialized as values; slots serialize ownership references and rendered
material, never React elements or executable definitions. Values shown in
Inspector values come from the generated records. Source metadata is repository-relative
and remains secondary to the preview.

Build, Check, watched rebuilds, published output, and packed consumers use the
same registry and rendering pipeline. Unregistered components retain ordinary
screen rendering and Review-ignore behavior. A referenced wrapper whose entry
is absent from the exported registry is a validation error.
Implementations must not silently register an unreachable component page.

## Related Contracts

- [Component change attribution](./mokly-component-changes.md)
- [Inline style ownership](./mokly-inline-styles.md)
- [Runtime prop schema and codec](./mokly-component-props.md)
- [Manifest schema](./mokly-component-manifest.md)
- [Comparison schema](./mokly-component-review.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
- [Component controls](./mokly-component-controls.md)
- [Build pipeline](../architecture/build-pipeline.md)
