# Component Stylesheets

## Delivery Status

This is the approved target planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md).
Milestone 3 delivers declaration, validation, linking, ownership, Serve and
public delivery. Milestone 4 will remove legacy source-path attribution;
Milestone 6 will remove the old authoring inputs. Those removals remain target
behavior, not current behavior.

## Declaration And Public Files

The root `@mokly/mokly` export `defineComponent` accepts an optional
`stylesheets` array. It is independent of the configured route-to-stylesheet
rules. An absent array means no declared stylesheets. An empty array is valid.

```ts
import { defineComponent } from "@mokly/mokly";

interface ComponentInput {
  stylesheets?: readonly string[];
}

const { Component, entry } = defineComponent({
  id: "example-action",
  title: "Example action",
  description: "An action shared across screens.",
  route: "components/example-action.html",
  relatedDocs: [],
  propSchema: { kind: "object", properties: {} },
  render: () => null,
  variants: [{ id: "default", title: "Default", props: {} }],
  stylesheets: ["design/components/action.css"],
});
```

Each value is a nonempty, normalized POSIX path relative to `mockupsDir`, to
an existing, regular, publicly servable file with a case-insensitive `.css`
suffix. Reject absolute paths,
backslashes, empty/dot/parent segments, query/fragment suffixes, other URL
schemes, HTTP(S) URLs, non-CSS files, missing files, directories, protected
source, internal metadata and paths whose real targets escape the public root.
CSS parse failures remain unresolved rule-analysis evidence, not an input-path
validation failure.
Apply the existing public-file confinement and configured exclusion rules,
including symlinks, before accepting a declaration. Do not treat a CSS source
module or an imported source as a public stylesheet.

One component cannot declare the same public file twice (including an alias of
the same resolved file); preserve the authored order. Different components may
declare the same file. Validate input shape and duplicate lexical paths at
authoring and registry boundaries, including untyped inputs; check file
existence, realpath aliasing and public eligibility after config resolves
`mockupsDir`. Missing or invalid declarations fail Build/Check rather than
being silently skipped. Never copy declarations into
entry source-path dependency lists; these lists are removed by Milestone 6.

## Configured Placement Marker

The package root also exports `componentStylesheets`, a singleton opaque
`unique symbol` value backed by `Symbol.for("@mokly/mokly/componentStylesheets")`
so separately bundled config and consumer modules share its identity. Config
validation replaces the marker with a numeric insertion position before
passing resolved config to Serve workers (symbols cannot be cloned). It is a
position marker, not a filename, CSS URL, or
renderer input. A literal string with the same spelling is not the marker.

```ts
import { componentStylesheets, defineConfig } from "@mokly/mokly";

export default defineConfig({
  mockupsDir: "docs/mockups/generated",
  stylesheets: [
    {
      match: "design/**",
      stylesheets: ["design/base.css", componentStylesheets],
      lightStylesheets: ["design/light.css"],
    },
  ],
});
```

The shared `stylesheets` list of a configured rule accepts public/HTTP(S)
strings or that symbol, at most once. `lightStylesheets` and
`darkStylesheets` accept strings only; a marker there, a second marker in the
shared list, or a marker in any other configuration position fails loading with
`config-invalid`. Matching route rules remain unique. With a marker, insert
declared links at its position in the matching shared list. Without one,
insert after all shared links and before the matching scheme-specific links.
No marker emits a literal `<link>`. A rule for another route has no effect.

Configured stylesheet URL support is unchanged, but a configured local file
cannot also be declared by a component. This prohibition applies across
rules/schemes, not just the route currently being rendered, including local
aliases to the same real file. A conflict fails Build/Check and names the file
and the configured rule; do not deduplicate it away or grant it ownership.

## Document Linking

Apply this contract only to generated screen viewport/scheme fragments and
component saved-variant viewport/scheme fragments. Link a component's declared
files if that document renders at least one instance of it, including a null
or empty-markup instance and a registered root component on its own variant.
An unrendered supplied slot is not an instance. Pages and use-case documents
do not gain component links; their current stylesheet behavior is unchanged.

Walk the actual registered render occurrences in first-render order (root
first for a component document). Within each first-seen component append its
authored stylesheet list; emit each public file once per document. If two
rendered components declare the same file, its first occurrence determines
link position but both are owners. Do not link the union of registered or
saved-variant components: a component absent from this render contributes
neither a link nor an owner. The order is the same in Build, Check, on-demand
Serve and transient comparison renders.

Resolve each href relative to this document's output route, with the same
per-segment URL encoding as configured local stylesheet links. Emit a normal
`<link rel="stylesheet" href="...">` inside `<head>`. The path recorded for
ownership is the decoded, `mockupsDir`-relative public path, not the href.
Shared/scheme configured link ordering otherwise stays unchanged.

The renderer still receives the existing `RenderInput`, whose `stylesheets`
contains only configured hrefs in configured order; it does not receive the
marker or the component-declared paths. The renderer emits those configured
links as before. After it returns, Mokly locates the configured link elements
in the returned document and inserts component links next to them:

1. For a marker between configured links, insert immediately before the first
   configured link after the marker (and after the preceding configured link).
2. At the beginning of the shared list, insert before its first configured
   link; at the default position, insert before the first scheme-specific link.
3. If there is no configured link after the insertion position, insert just
   after the last configured link before it.
4. If this route has no configured stylesheets at all, insert at the end of
   `<head>` (before `</head>`), even if it contains unrelated link elements.

Match neighbouring renderer-emitted links by `rel="stylesheet"` and their
resolved href, in document order; do not anchor on unrelated links or text.
If insertion is needed and an expected neighbouring configured link is
missing, duplicated so the position is ambiguous, or out of configured order,
fail Build/Check with `build-invalid`, naming the route and missing/ambiguous
href. Never silently append instead. A missing `<head>` also fails rather than
creating one. Preserve the renderer's other head content. Rebase all recorded
UTF-16 style-ownership offsets after insertion and validate the final output
through the normal ownership and source-protection pipeline. A compatibility
transform must retain the links or fail normal output/resource validation.

## Derived Ownership And Conflicts

For every linked declared file, Mokly adds exactly one record to the current
view's `ComponentViewRecord.resources`:

```ts
interface ComponentResourceOwnership {
  path: string; // mockupsDir-relative public CSS file
  componentIds: readonly string[]; // nonempty, sorted, unique ids
}
```

Owners are exactly the rendered component ids declaring that file (including
the component root when applicable). Merge declarations from repeated
instances/owners of one file, sort paths and ids by the manifest's lexical
order, and retain the file's separate authored link position. Never infer
ownership from selectors, a shared config link, or a transitive CSS import.
Imported files remain unowned even when reached through a declared stylesheet.

Renderer-supplied `styles` offsets and `resources` records still own other
material. A renderer `resources` record for a declared file is an error even
if its owners agree with Mokly's derived owners; do not merge or overwrite it.
Fail Build/Check with `build-invalid`, naming the route and file. Keep the
existing prohibition on conflicting ownership records and validate all
resource paths against the same public-root rules. Derived ownership records
are present only in views that actually link the file; they remain private to
the manifest, not a public catalogue field.

## Changes And Delivery

An edit to a declared stylesheet follows the same rendered-resource and CSS
rule analysis as any linked public CSS file. Ownership attributes retained
evidence to the declaring component(s); actual consuming screens/components
are listed under Affected screens rather than added to Changes solely because
they use that component. A changed import remains an unowned rendered resource
unless another explicit renderer ownership record applies. A declared file
that no current or baseline view links does not itself add an entry to Changes.
See [component changes](./mokly-component-changes.md) and
[CSS attribution](./mokly-css-attribution.md).

Serve watches the validated declared file like a configured stylesheet:
editing it triggers a reload/evidence refresh for the views that link it,
without requiring a rebuild of source modules. Changes to the declaration or
component source still rebuild. Imports and referenced assets retain the
ordinary public-resource watch behavior. On-demand and transient renders use
the same link and ownership rules as a full build. A missing or newly
non-public file fails validation; last-good Serve output remains intact.

The [source policy](./mokly-source-protection.md) treats declared stylesheets
as public assets, never as permission to serve authoring sources. Build checks
and the resource graph require each reachable file to be confined and regular;
exports copy linked declared CSS and its transitive public imports/assets by
the existing graph, and publication validates and delivers them like other
public resources. No special export/hosted upload list is introduced. Paths
outside the public boundary are errors, not publication omissions. This
replaces the example's per-render style collector and the former separation
of stylesheet loading from manually declared review dependencies.

## Related Contracts

- [Authoring](./mokly-authoring.md), [components](./mokly-components.md), and
  [configured stylesheets](./mokly-configuration.md) define the public inputs.
- [Rendering](./mokly-rendering.md) and
  [component manifest](./mokly-component-manifest.md) define generated links
  and private view records.
- [Watch](./mokly-watch.md), [export](./mokly-export.md), and
  [publication](./mokly-publication.md) define delivery boundaries.
