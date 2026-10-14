# Component Stylesheets

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Two Kinds Of Component CSS

A component's CSS reaches a document in two ways. Styles that a
[sidecar](./mokly-sidecar.md#style-collection) render produces are collected
with the fragment and written into the head as
`<style data-mokly-owners="<component paths>">` elements, one rule list per
owner set, before the configured stylesheets; every rule inside such an
element belongs to those components by construction, under the
[comparison contract](./mokly-comparison.md#style-ownership). Public CSS
files that a component declares through `stylesheets` are linked with
`<link rel="stylesheet">` in every document that renders an instance of the
component, and their rules are attributed like every linked stylesheet's
through [CSS attribution](./mokly-css-attribution.md), never through the
declaration. This page defines the declarations, their placement, and their
delivery. An HTML component declares no stylesheets; its CSS is configured or
collected.

## Declaration And Public Files

`defineComponent` accepts an optional `stylesheets` array. It is independent
of the configured route-to-stylesheet rules. An absent array means no
declared stylesheets. An empty array is valid.

```ts
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  path: "example/components/action",
  title: "Example action",
  description: "An action shared across screens.",
  relatedDocs: [],
  propSchema: { type: "object", additionalProperties: false } as const,
  render: () => null,
  stylesheets: ["design/components/action.css"],
});
```

Each value is a nonempty, normalized POSIX path, relative to the
configuration file like a configured local stylesheet, to an existing,
regular, publicly servable file inside `repoRoot` with a case-insensitive
`.css` suffix. Reject absolute paths, backslashes, empty, dot, or parent segments,
query or fragment suffixes, other URL schemes, HTTP(S) URLs, non-CSS files,
missing files, directories, protected source, and paths whose real targets
escape the public root. A CSS parse failure is unresolved rule-analysis
evidence, not an input-path validation failure. The
[public closure policy](./mokly-public-closure.md) decides public eligibility
before a declaration is accepted; it rejects a symbolic link at every
component of a public path, even when the target stays confined, for declared
CSS and configured CSS alike. A CSS source module or an imported source is
not a public stylesheet.

Preserve authored order and group paths by resolved real file. If one
component lists the same validated file twice, keep its first position, link
it once, and issue the [duplicate warning](#warning-messages). Different
components may declare the same file. Validate the input shape when the
registry accepts the definition, including untyped inputs; check existence,
real-path identity, and public eligibility after the configuration resolves.
A missing or invalid file fails `build` and Serve's rebuild.
Declarations never enter an entry's metadata or its source inventory. This
follows the [graceful-handling rule](./README.md#graceful-handling).

## Configured Placement Marker

The shared `stylesheets` list of a configured rule may contain the token
`$componentStylesheets` once. It is a position marker, not a filename, CSS
URL, or renderer input; a `$`-prefixed string in a stylesheet list is
reserved for tokens, and this is the only token.

```json
{
  "stylesheets": [
    {
      "match": "design/**",
      "stylesheets": ["design/base.css", "$componentStylesheets"],
      "lightStylesheets": ["design/light.css"]
    }
  ]
}
```

The shared `stylesheets` list of a configured rule accepts public or HTTP(S) strings or that token, at most once. `lightStylesheets` and
`darkStylesheets` accept strings only; a marker there or a second marker in the
shared list fails loading with `config-invalid`. Matching route rules stay unique. With a marker, the
declared links take its position in the matching shared list. Without one,
they follow all shared links and precede the matching scheme-specific links.
No marker emits a literal `<link>`. A rule for another route has no effect.

A local file may be both configured and declared through the same validated
public file. On a matching route the document carries one link, at the
configured position. A declaration whose configured rule does not match the route
follows ordinary component linking. Configuration supplies placement;
declarations supply required links, not CSS ownership. This overlap is not an
error or an ignored input.

## Document Linking

This contract applies to the viewport and colour-scheme documents of screens
and of components, including a component's own page. The core links a
component's declared files when the document renders at least one instance of
it, including a null or empty-markup instance and the root component of its
own page. An unrendered supplied slot is not an instance. Pages and use cases
gain no component links; a page links its own CSS.

Walk the rendered instances in first-render order, root first for a component
document. Within each first-seen component append its authored stylesheet
list. Group repeated declarations by their validated file. Emit one link per
file. The first occurrence decides the link's position within the component
block and the declared public path its href uses. A component absent from this
render contributes no link; the union of registered or saved
components is never linked. This order is stable in Serve, `build`,
on-demand renders, and both sides of a comparison.

The core assembles the head, so it places the component block itself: at the
marker's position among the configured links, or after the shared links and
before the scheme-specific links. Each href is a relative URL from the
document's route under `static/mokly-generated/` to the public file's route,
which the [public closure policy](./mokly-public-closure.md) assigns, with the
same per-segment URL encoding as configured local stylesheet links. The renderer module wraps React
renders and emits no
links, so no authored link is reused or anchored on; the configured
stylesheet order of the [rendering contract](./mokly-rendering.md) is
otherwise unchanged.

## Ownership And Comparison

A declared stylesheet's rules enter a comparison as linked-stylesheet rules:
the rule diff and selector matching of
[CSS attribution](./mokly-css-attribution.md) and the own-page match rule of
[rule membership](./mokly-css-attribution-rules.md) attribute a changed rule
to the one component whose regions contain every matched element, else to the
entry; declaring the file grants no ownership. An unlinked declaration has no
CSS evidence. The link element belongs to the entry like every head element
outside a region, and the stylesheet's `url()` and `@import` closure is
resource evidence under the
[comparison contract](./mokly-comparison.md#resources). Collected
`data-mokly-owners` styles need no matching: their owner is the rendering
component. Head styles leave the canonical form; a declared or collected rule
changes a view only through rule evidence.

## Delivery

Serve watches each declared file like a configured stylesheet: editing it
reloads the views that link it and refreshes their evidence without
re-rendering sources, under the [watch contract](./mokly-watch.md). Every
validated declaration is a watch target before Serve reports readiness, even
if no view renders its component, and a successful configuration reload
refreshes that set from the new declarations. Changing the declaration or the
component source rebuilds the bundle generation. On-demand and comparison
renders use the same linking and warning rules as `build`. A
missing or newly non-public file fails validation; Serve keeps its last good
documents.

The [source policy](./mokly-source-protection.md) treats declared stylesheets
as public assets, never as permission to serve authoring sources. The
resource closure requires each reachable file to be confined and regular;
`build` copies linked declared CSS and its transitive public imports and
assets into `--out` through the same closure, and publish uploads them like
every other public resource. No special list exists for declared CSS. A path
outside the public boundary is an error, not an omission.

## Related Contracts

- [Authoring](./mokly-authoring.md), [components](./mokly-components.md), and
  [configured stylesheets](./mokly-configuration.md) define the public inputs.
- [Render sidecar](./mokly-sidecar.md) defines style collection, and
  [tree comparison](./mokly-comparison.md) defines style ownership.
- [CSS attribution](./mokly-css-attribution.md) defines rule evidence.
- [Watch](./mokly-watch.md), the [static build](./mokly-export.md), and
  [publication](./mokly-publication.md) define delivery boundaries.

## Warning Messages

`duplicate-component-stylesheet` names a component subject and says
`duplicate component stylesheet <path> is ignored; it is linked once.`
`<path>` is the first authored public path for that real file, JSON-quoted.
The [warning channel](./mokly-build-warnings.md) counts it in strict mode. A
configured and declared overlap needs no warning. No other warning exists for
component stylesheets: the core places every link itself, so no anchor can be
missing.
