# Registered Components

Use `defineComponent` to give a shared React component its own catalogue page,
saved variants, controls, and recorded usage in screens or other components.
Callers render the returned `Component` and export its `entry` in `mockups`.
Mokly renders that wrapper in the consumer's existing React/provider graph.

The `stylesheets` input was delivered by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md) for
Milestone 3. Milestone 6 removed source-path inputs; current output uses
manifest v6.
Milestone 11 of that plan groups declarations by real file, merges all rendered
owners, and reuses renderer-authored links without exposing declarations through
`RenderInput.entry`. The first rendered declaration determines a new link's
public path; a renderer-authored link keeps its own path and position.

```tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  id: "action",
  title: "Action",
  description: "A shared action.",
  route: "components/action.html",
  stylesheets: ["components/action.css"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  controls: { label: { kind: "text", label: "Label", maxLength: 80 } },
  render: (props) => <button>{props.label}</button>,
  variants: [{ id: "default", title: "Default", props: { label: "Continue" } }],
});
export const mockups = [action.entry];
```

A registration may live in any repository module, typically beside the
component it adapts, and the entry module that exports its `entry` may be
discovered through any configured `entries` glob. The registration file is
recorded as the component's source. The glob itself defines the entry shape;
`.mockup.ts` and `.mockup.tsx` are the recommended convention selected by the
`entriesDir` shorthand, not a separate filename rule.

Render `<action.Component label="Save" />` in a screen. Give repeated siblings
distinct `moklyInstance` values; stable ids preserve their identity across
edits. Registered children inside another registered component appear in its
Nested components tab. React content belongs in declared `slots`; data belongs
in `propSchema`. The schema infers TypeScript props and validates actual values. Registry preparation
revalidates exported definitions and snapshots component data before rendering,
so malformed or mutated variants and controls produce author diagnostics.

Instance keys remain stable across prop edits and sibling reorders. Changing the
local id, input owner, or original slot changes the key. Keys are scoped to one
entry/variant/viewport/scheme; keep that scope with any saved reference. The public
`resolveInstance(previous, current)` accepts validated `ComponentInstanceRecord`
values from the same view. It returns `missing` for an absent or different key,
`present` for equal props keys, order and slot, and `moved` otherwise. It does not
classify visual or material Changes.

Compiled JSX invocations record optional `source: { path, line, column }` in
manifest v6. The path identifies the caller inside the repository, with 1-based
coordinates. Programmatic or already-compiled calls can omit it. The internal
`__moklySource` prop is reserved from data schemas and slots and stripped before
validation, hashing and rendering. Source metadata never affects identity or
Changes and adds no source display to the local shell. Replayed slots keep their
original location and have one matched comment pair per recorded placement,
including empty output.

Variants are explicit named examples, never inferred from screenshots or every
combination of controls. Both viewports and every configured scheme are built
for each variant. `MockLink to="action"` opens the default variant; canonical
page URLs use `?variant=default` to select a specific saved example.

Local Serve edits declared text, boolean, number, and primitive preset controls.
Complex props remain inspectable; an adapter can map a primitive preset key to
a complex consumer value. Optional controls distinguish unset from empty text
or null. Reset restores the saved variant; changing variants, routes, or entering
comparisons discards edits. Published catalogues retain saved variants and
inspection with controls read-only.
Background Usage and Changes completion preserves local prop edits and the
current preview. Complete Used by data appears without resetting controls;
per-view inspection continues to use the records from the actual displayed
on-demand document.

Material implementation or linked owned-resource changes belong to the component in Changes. Consuming screens are
listed as affected; their own prop, slot, structure, layout, or explicit resource
changes still count directly. Validated `stylesheets` links create derived
resource ownership records for rendered declarers; renderer style or other
resource records still handle material outside the component's body. Imports
remain unowned. Global or mixed rendered resources remain conservatively
attributed. Unrendered source edits do not create Changes or comparison evidence.
Components declare public `mockupsDir`-relative CSS with `stylesheets`. Rendered
instances (including null output and saved component roots) receive links in
first-render order; the same pass derives resource ownership for each linked
file. A configured link to the same real file is reused, while renderer owner
records for declared CSS are ignored with a warning. Duplicate declarations
are linked once with a warning. The comparison omits Mokly-inserted links from
consumer page material but retains a component page's own links; final
post-transform links determine which derived owners remain.
See [component stylesheets](../../docs/protocol/mokly-component-stylesheets.md).
Historical Mokabook comparisons preserve the original document coordinates when
applying recorded style ownership; internal marker renames alone do not create
consumer changes or alter the retained snapshots.

Comparison projection can expose caller-owned slot material that HTML parsing
discarded from contexts such as `template` or `select`. Removing component
implementation text can likewise expose a sibling hidden by its unclosed HTML. The review shortcut
therefore proves both actual and ownership-projected resource closures for
views with instances, styles, or entry-owned slots, using the same root-specific ownership and
resource exclusion policy as the complete comparison.

## Development

```sh
npm run build
node --import tsx --test tests/component_*.test.ts
```

- `definition.ts`, `types.ts`: public authoring boundary and inference.
- `props.ts`, `schema.ts`, `codec.ts`: declarative validation and lossless data.
- `collector.ts`, `render.tsx`, `ranges.ts`: actual usage and neutral ranges.
- `resolve_instance.ts`: pure resolution for scoped, validated instance records.
- `source.ts`, `../build/jsx_dev_runtime.ts`: source validation and capture.
- `instance_structure.ts`: explicit logical inputs, excluding source metadata.
- `comparison_projection.ts`: caller versus implementation material.
- `../server/controls`: supervised local rendering and transient storage.
- `../client/workspace.ts`: shared saved-view explorer and inspector.

See the [registered component contract](../../docs/protocol/mokly-components.md),
[instance identity](../../docs/protocol/mokly-instances.md),
[manifest](../../docs/protocol/mokly-component-manifest.md),
[change attribution](../../docs/protocol/mokly-component-changes.md), and
[local controls](../../docs/protocol/mokly-component-controls.md).
