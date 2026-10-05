# Registered Components

## Delivery Status

Root output ranges, CSS owner removal and uniform CSS attribution below are
implemented in Milestone 19 of the
[source-path removal plan](../../plans/remove-source-path-evidence.md).

The rule for comments with the former spelling in the
[instance contract](../../docs/protocol/mokly-instances.md#rendered-boundaries)
is implemented in Milestone 23 of that plan.

That plan delivered `stylesheets` in Milestone 3 and removed source-path inputs
in Milestone 6. Milestone 11 groups declarations by real file and reuses
renderer-authored links. Milestone 28 restricts placement to configured
anchors, shares link discovery, reuses body links and recovers inserted links from
their spans inside Review-ignore regions. The
[link-scope contract](../../docs/protocol/mokly-stylesheet-links.md) defines each step.

## Authoring

Use `defineComponent` to give a shared React component its own catalogue page,
variants, controls, and recorded usage in screens or other components.
Callers render the returned `Component` and export the registration or its
`entries` from a discovered module. The exporting file supplies the path while
the registration retains its defining module as source attribution. Mokly renders
the wrapper in the consumer's existing React/provider graph.

Current output uses manifest v8. Mokly groups declarations by real file, merges
all rendered declarers, and reuses renderer-authored links without exposing declarations through
`RenderInput.entry`. The first rendered declaration determines a new link's
public path; a renderer-authored link keeps its own path and position.

```tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  slug: "action",
  title: "Action",
  description: "A shared action.",
  stylesheets: ["components/action.css"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  controls: { label: { kind: "text", label: "Label", maxLength: 80 } },
  render: (props) => <button>{props.label}</button>,
  variants: [
    { slug: "default", title: "Default", props: { label: "Continue" } },
  ],
});
export const mockups = [...action.entries];
```

A registration may live beside the component it adapts. A root discovers its
exporting module through `files`; the default matches `.mockup.ts` and
`.mockup.tsx`. Prefix a component-library root with `path: "components"` when
that is the desired catalogue hierarchy. Path rules never depend on kind.

Render `<action.Component label="Save" />` in a screen. Give repeated siblings
distinct `moklyInstance` values; stable ids preserve their identity across
edits. Registered children inside another registered component appear in its
Nested components tab. React content belongs in declared `slots`; data belongs
in `propSchema`. The schema infers TypeScript props and validates actual values.
Registry preparation revalidates exported definitions and snapshots component
data before rendering, so malformed or mutated variants and controls produce
author diagnostics. An invalid component parent remains present for relationship
validation, preventing its variants from adding misleading missing-parent errors
to the root failure. Definition validation runs only after parent metadata is
valid. A parent that fails either check keeps its violations and remains
available for relationship and inherited-field checks; child props, controls,
and slots are not validated against it until both checks pass.

Instance keys remain stable across prop edits and sibling reorders. Changing the
local id, input owner, or original slot changes the key. Keys are scoped to one
entry/variant/viewport/scheme; keep that scope with any saved reference. The public
`resolveInstance(previous, current)` accepts validated `ComponentInstanceRecord`
values from the same view. It returns `missing` for an absent or different key,
`present` for equal props keys, order and slot, and `moved` otherwise. It does not
classify visual or material Changes.

Comparison projection receives canonical catalogue links for equality and keeps
real href values for resource traversal and CSS selector matching. Move pairing
aligns component identities without changing captured bytes or instance offsets.

Compiled JSX invocations record optional `source: { path, line, column }` in
manifest v8. The path identifies the caller inside the repository, with 1-based
coordinates. Programmatic or already-compiled calls can omit it. The internal
`__moklySource` prop is reserved from data schemas and slots and stripped before
validation, hashing and rendering. Source metadata never affects identity or
Changes and adds no source display to the local shell. Replayed slots keep their
original location and have one matched comment pair per recorded placement,
including empty output.

Variants are explicit named examples, never inferred from screenshots or every
combination of controls. Each variant is its own `kind: "component"` entry with
a slug and derived parent relationship, grouped beneath its component in
navigation with its own route `<parent path>/<slug>/index.html`, its own Changes
row, and its own comparison. Both viewports and every configured scheme are
built for each variant. `MockLink to="action"` opens the component page, which
shows its first variant; `MockLink to="action/disabled"` opens that variant
directly.

Local Serve edits declared text, boolean, number, and primitive preset controls.
Component views defined in a helper module use the stylesheet of the entry
that exported the component, including saved variants and both viewports.
Renderer resource records can name pending generated non-CSS assets before
Build writes them. CSS owner records are ignored with a warning after safety
checks. Missing generated resources never fall back to disk.
Complex props remain inspectable; an adapter can map a primitive preset key to
a complex consumer value. Optional controls distinguish unset from empty text
or null. Reset restores the variant's declared props; navigating to another
variant or entry, or entering comparisons, discards edits. Published catalogues
retain variants and inspection with controls read-only.
Background Usage and Changes completion preserves local prop edits and the
current preview. Complete Used by data appears without resetting controls;
per-view inspection continues to use the records from the actual displayed
on-demand document.

Implementation and owned non-CSS resource changes retain component attribution.
CSS changes X only through a kept match on X's own saved pages. A different
nested Y takes a match from X when Y has an unfiltered own-page match for that
rule. Self-nested X cannot take its own match. Y need not be changed. A consumer
invocation match alone never changes its component. A page gets a direct row
for outside matches or unresolved CSS, including a component page's renderer
wrapper; that wrapper reason has no affected consumers. Unrendered source
edits do not create Changes or evidence.
Components declare public `mockupsDir`-relative CSS with `stylesheets`. Rendered
instances (including null output and saved component roots) receive links in
first-render order; the same pass retains declaring paths for inserted-link
provenance, without creating CSS resource ownership records. A configured link to the same real file is reused, while renderer owner
records for every stylesheet are ignored with a warning. Duplicate declarations
are linked once with a warning. The comparison omits Mokly-inserted links from
consumer page material but retains a component page's own links; final
post-transform links determine which inserted spans remain.
See [component stylesheets](../../docs/protocol/mokly-component-stylesheets.md).
The [ownership and comparison contract](../../docs/protocol/mokly-component-stylesheet-ownership.md)
defines final-link validation and private link provenance.
`../html_links.ts` finds active head and body links with decoded attributes
and source spans. Placement uses only configured head links. Reuse keeps body
links in place. Template content supplies no active link, but reserved tokens
inside templates still undergo validation and removal.
`stylesheet_provenance.ts` strips transient tokens from final HTML, while
`comparison_stylesheets.ts` removes only proven inserted links from review
material. `stylesheet_spans.ts` validates each span against an active full link
in the original final HTML. Review reads inserted resources before it removes
links or ignored regions. Ignored author links and markup stay ignored.
`build/renderer_resources.ts` discards CSS ownership assertions after public
file checks and emits the stylesheet warning. `render.tsx` returns temporary
link declarations separately from the private usage record. Build, Check, export, publish and Serve now report those warnings
through the shared invocation sink.
Current and baseline v8 manifests require complete usage records, including
root ranges on component saved views and an `insertedStylesheets` array even
when it is empty. Public inspection omits that private provenance. Missing
baseline fields are invalid; comparison never fills them in.
On both baseline and current sides, a comment with the former `mokabook-`
spelling is ordinary page content. Mokly never reads it as a marker or removes
it as one. The comment alone is not a validation error. Required baseline
ranges that its document cannot prove follow the
[invalid-baseline contract](../../docs/protocol/mokly-baseline-compatibility.md#invalid-or-missing-data).
Historical marker translation is not supported. The frozen instance and slot
key domain strings are unchanged.
Compatible v8 baselines preserve each document’s UTF-16 coordinates when
applying recorded style ownership.

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

- [`definition.ts`](./definition.ts), [`types.ts`](./types.ts): public authoring
  boundary and inference.
- [`manifest_build.ts`](./manifest_build.ts) and
  [`manifest_entry_validation.ts`](./manifest_entry_validation.ts): flattened
  parent/variant records and manifest-v8 validation.
- Viewer [`props.ts`](../../packages/viewer/src/components/props.ts),
  [`schema.ts`](../../packages/viewer/src/components/schema.ts), and
  [`codec.ts`](../../packages/viewer/src/components/codec.ts): declarative
  validation and lossless data.
- [`collector.ts`](./collector.ts), [`render.tsx`](./render.tsx), and
  [`ranges.ts`](./ranges.ts): actual usage and neutral ranges.
- Viewer [`resolve_instance.ts`](../../packages/viewer/src/components/resolve_instance.ts):
  pure resolution for scoped, validated instance records.
- Viewer [`source.ts`](../../packages/viewer/src/components/source.ts) and
  [`../build/jsx_dev_runtime.ts`](../build/jsx_dev_runtime.ts): source
  validation and capture.
- [`instance_structure.ts`](./instance_structure.ts): explicit logical inputs,
  excluding source metadata.
- [`comparison_projection.ts`](./comparison_projection.ts): caller versus
  implementation material.
- [`../server/controls`](../server/controls): supervised local rendering and
  transient storage.
- Viewer [`workspace.tsx`](../../packages/viewer/src/shell/workspace.tsx),
  [`workspace_entry.ts`](../../packages/viewer/src/shell/workspace_entry.ts),
  and [`workspace_variants.ts`](../../packages/viewer/src/shell/workspace_variants.ts):
  shared component explorer, routed entry, and sibling variants.

See the [registered component contract](../../docs/protocol/mokly-components.md),
[instance identity](../../docs/protocol/mokly-instances.md),
[manifest](../../docs/protocol/mokly-component-manifest.md),
[change attribution](../../docs/protocol/mokly-component-changes.md), and
[local controls](../../docs/protocol/mokly-component-controls.md).
