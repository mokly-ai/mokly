# Registered Components

## Delivery Status

The public `defineComponent` API, saved variants, ownership attribution,
explorer, inspection, and local controls are implemented. The
[component explorer plan](../../plans/component-explorer.md) records delivery.
Existing unregistered catalogues retain their output and Review-ignore behavior.

## Product Contract

A registered component owns a catalogue page, saved variants, and comparisons.
Its actual rendered instances connect that page to consuming screens and other
components. Registration supplies the identity used by previews, automatic
change attribution, the shared icon inspector, and highlighting; consumers do not
maintain separate usage lists or per-screen Review-ignore hashes.

A component-only change appears in Changes as a component entry. Consuming
screens are linked under Affected screens and do not enter Changes or increase
its count unless they have an independent screen change. See the
[attribution contract](./mokly-component-changes.md).

## Authoring Boundary

The root package exports `defineComponent`. It returns an `entry` for the
`mockups` export and a typed `Component` wrapper for composition. The wrapper
uses the consumer's real component through a render adapter. A consumer can
re-export that wrapper once from its mockup component module and use ordinary
JSX throughout its screens.

Register an adapter and its saved examples with the public API:

```tsx
const action = defineComponent({
  id: "action",
  title: "Action",
  description: "The primary action for a task.",
  route: "components/action.html",
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
      id: "default",
      title: "Default",
      props: { label: "Continue", disabled: false },
    },
    {
      id: "disabled",
      title: "Disabled",
      props: { label: "Continue", disabled: true },
    },
  ],
  controls: {
    label: { kind: "text" },
    disabled: { kind: "boolean" },
  },
});

export const mockups = [action.entry];

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

The input includes the common entry metadata, a stable relative `.html` route,
`propSchema`, `render`, and a nonempty ordered `variants` list. `tags`,
`colorSchemes`, `controls`, `slots`, and `ownedDependencies` are optional. Existing id, route,
dependency, tag, and color-scheme validation applies. Variant ids are unique
kebab-case strings within their component; the first variant is the default.
Each variant contains an id, title, complete typed props, and an optional
description. There is no
implicit merge between variants.

The required [prop schema](./mokly-component-props.md) determines the adapter,
wrapper, and variant data types. Its shared runtime validator checks typed and
untyped calls, recorded props, and local controls; render annotations and saved
variants do not infer or override that schema. The adapter receives
`render(props, { viewport, colorScheme })` and may choose a
viewport-specific consumer component. Theme providers and styling remain
consumer-owned.
`RenderInput.entry` becomes a screen/component union and gains the selected
variant id for component renders; both use the configured renderer and one
consumer React instance. Packed-consumer tests cover this public type change.

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

`moklyInstance` is reserved for the wrapper, stripped before calling the
consumer adapter, and uses the kebab-case id grammar. Its identity is scoped to
the calling screen or component instance and slot. With no supplied instance
id, the component id is the default; repeated instances in the same scope
must supply distinct explicit ids. Duplicate identities fail with entry and
view context rather than falling back to array indexes or random ids.

The render collector records component id, scoped instance id, owner, parent
instance, encounter order, data props and their material key, slot ownership,
and a DOM range reference for each rendered occurrence. Ownership determines
where an input change is reported; DOM ancestry determines inspector nesting.
These relationships are distinct when a screen supplies another component in
a container's slot. Repeated placement of one slot receives distinct range
references while retaining the same input owner.

Actual rendering supplies usage. Imports, unused branches, or declared
dependencies do not invent instances. Mobile, desktop, light, dark, and saved
variants have separate usage records. A registered component that renders null
is still an invoked instance, but has no visible bounds. Folder and use-case
membership never duplicates canonical usage records.

Components author their own `navPath`; Components-section folders form from
matching paths, independently of Pages. Components have normal routes,
id redirects, tags, and path-derived breadcrumbs. Use-case steps continue
to reference screens only. Component-to-component and screen-to-component
backlinks are derived from usage rather than separately authored relationships.

## Generated Artifacts

One complete static document is generated for every component variant,
viewport, and effective color scheme. For a route `components/action.html`,
the default variant's mobile light file is
`components/action.variants/default.mobile.html`; dark and desktop use the
existing suffix conventions. Every variant follows this same rule. Output
collision, ownership, resource, orphan, and transactional-write checks apply.

Catalogues with registered components emit manifest schema v6, including typed
component entries, variant fragments, and per-view usage records for screens
and components. The [manifest schema](./mokly-component-manifest.md) defines
every record, reference, ordering rule, and validation boundary. All current catalogues use v6, including those without components. Historical
Git readers accept v3, both disjoint v4 formats, v5, and the explicit v2 fallback;
unknown versions fail. Historical manifests without usage metadata do not imply an empty
component tree or justify suppressing changes.

Inert, package-owned DOM markers bind generated ranges to their usage records.
The collector is scoped to a render, not a process-global mutable registry.
Markers support nesting, multiple roots, and text without introducing layout
wrappers. Parsed validation rejects forged, duplicate, overlapping, unmatched,
or moved records and verifies ownership again after compatibility transforms.
The existing flat `ReviewIgnore` marker language remains separate and strict.

Comparison metadata, dependencies, and props contain no timestamps, absolute
checkout paths, function bodies, or transient controls values. Only data props
are serialized as values; slots serialize ownership references and rendered
material, never React elements or executable definitions. Values shown in
Inspector values come from the generated records. Source metadata is repository-relative
and remains secondary to the preview.

Build, Check, watched rebuilds, published output, and packed consumers use the
same registry and rendering pipeline. Existing unregistered components and
legacy pages keep their current rendering and comparison behavior. A referenced
wrapper whose entry is absent from the exported registry is a validation error.
Implementations must not silently register an unreachable component page.

## Related Contracts

- [Component change attribution](./mokly-component-changes.md)
- [Runtime prop schema and codec](./mokly-component-props.md)
- [Manifest v6 schema](./mokly-component-manifest.md)
- [Comparison v3 schema](./mokly-component-review.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
- [Component controls](./mokly-component-controls.md)
- [Build pipeline](../architecture/build-pipeline.md)
