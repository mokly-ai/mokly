# Component Stylesheets

## Delivery Status

This implemented contract was planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md).
Milestone 3 delivered declaration, validation, linking, ownership, Serve and
public delivery. Milestone 4 removed legacy source-path attribution and
Milestone 6 removed the old authoring inputs.
Milestone 11 of the same plan implemented the optional-never authoring types,
startup/reconfiguration watching, real-file alias deduplication, stylesheet
`rel` token and omitted-tag handling, and renderer-link reuse described below;
these refinements are now in Build, Check, Serve, export and publication.
Milestone 13 implemented graceful handling of duplicate declarations,
configured links and overlaps. The linked
[ownership and comparison contract](./mokly-component-stylesheet-ownership.md)
covers its provenance and post-transform rules. Milestone 14 implemented
their warnings.

## Declaration And Public Files

The root `@mokly/mokly` export `defineComponent` accepts an optional
`stylesheets` array. It is independent of the configured route-to-stylesheet
rules. An absent array means no declared stylesheets. An empty array is valid.

```ts
import { defineComponent } from "@mokly/mokly";

interface ComponentInput {
  stylesheets?: readonly string[];
  dependencies?: never;
  ownedDependencies?: never;
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

Preserve authored order and group paths by resolved real file. If one component
lists a file twice, by the same path or an alias, keep its first path and
position, link it once and issue the
[duplicate warning](./mokly-build-warnings.md#exact-messages). Different
components may declare the same file. Validate input shape at authoring and
registry boundaries, including untyped inputs; check existence, realpath
identity and public eligibility after config resolves `mockupsDir`. Missing
or invalid files still fail Build/Check. Never copy declarations into entry
source-path dependency lists or manifest entry metadata. This follows the
[graceful-handling rule](./README.md#graceful-handling).

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

Configured stylesheet URL support is unchanged. A local file may be both
configured and declared, including through aliases of one real file. On a
matching route, keep the configured link at the renderer's position, add no
second Mokly link, and give the file the rendered declaring components as
owners. If the renderer omitted that configured link, insert one component
link under the fallback rule and warn about the missing configured href. A
declaration whose configured rule does not match this route follows
ordinary component linking. Configuration supplies placement; the declaration
supplies ownership. This overlap is not an error or an ignored input.

## Document Linking

Apply this contract only to generated screen viewport/scheme fragments and
component saved-variant viewport/scheme fragments. Link a component's declared
files if that document renders at least one instance of it, including a null
or empty-markup instance and a registered root component on its own variant.
An unrendered supplied slot is not an instance. Pages and use-case documents
do not gain component links; their current stylesheet behavior is unchanged.

Walk the actual registered render occurrences in first-render order (root
first for a component document). Within each first-seen component append its
authored stylesheet list. Group declarations by resolved real file, not by
their lexical paths: two components may name that file through different
public aliases. Emit one link per real file that Mokly must link. The first
occurrence determines its link position and the declared public path used for
its href; all rendered components declaring that real file are owners. Do not
link the union of registered or saved-variant components: a component absent
from this render contributes neither a link nor an owner. This order is stable
in Build, Check, on-demand Serve and transient comparison renders.

Resolve each href relative to this document's output route, with the same
per-segment URL encoding as configured local stylesheet links. Emit a normal
`<link rel="stylesheet" href="...">` inside `<head>`. The path recorded for
ownership is the decoded, `mockupsDir`-relative public path used by that link,
not its encoded href or the real filesystem path. For a Mokly-inserted link,
the pre-transform href uses the first rendered declaration's lexical public
path, even when later declarers use aliases of the same real file. The final
ownership path follows the retained final link, including a transform's alias.
Shared/scheme configured link ordering otherwise stays unchanged.

`RenderInput.stylesheets` contains only configured hrefs in configured order;
it does not receive the marker or component-declared paths. Its component
`entry` omits `stylesheets` at runtime and in its public type. The renderer
emits configured links as before. If it also emits a local stylesheet link to
the same real file as a declaration, Mokly keeps that link at its authored
position and does not insert another. Its decoded, `mockupsDir`-relative href
path becomes the ownership-record path when no retained configured link to
that real file takes precedence, even when an alias was declared first.
Query and fragment suffixes on a renderer-authored local href do not change
real-file identity; keep them on that link but omit them from the record path.
If several renderer links already name the same real file, Mokly leaves them
unchanged, adds none, and takes the first in document order for the record;
Mokly's one-link guarantee applies to links it inserts, not duplicates the
renderer already authored. For files not already linked by the renderer, Mokly
locates the configured links and inserts component links next to them.

A configured link is a `<link>` in the logical head whose `rel` includes the
ASCII-case-insensitive, whitespace-delimited `stylesheet` token and whose href
matches a resolved configured href. `alternate stylesheet` qualifies. Use the
first document occurrence when an href repeats. Let `p` be the marker/default
boundary in configured order. A present link at index `i < p` is `p - i`
positions away; one at `i >= p` is `i - p + 1` positions away. Choose the
present link with the smallest distance; on a tie choose the following link.
Insert the ordered component-link block after a chosen preceding link or
before a chosen following link. This uses configured order even when the
renderer reordered its links. If no configured link is present, insert at the
end of logical head content, after unrelated links. Use `</head>` when present,
otherwise the parsed head's last element or the start of body content when
the head is empty. Omitted optional tags never fail placement.

Missing, repeated or reordered configured links do not fail insertion; a
missing href gets a [warning](./mokly-build-warnings.md#exact-messages).
Keep every renderer-authored link unchanged, even duplicates. Preserve other
head content, rebase UTF-16 style offsets, and validate final output normally.
See the [graceful-handling rule](./README.md#graceful-handling).

## Ownership And Comparison

The linked [ownership and comparison contract](./mokly-component-stylesheet-ownership.md)
defines transient provenance, final-document owner pruning, comparison-only
link projection and Changes attribution. It retains renderer-authored links as
page content and keeps CSS evidence based on final linked documents.

## Delivery

Watched Serve makes the source inventory watcher ready before evaluating
consumer modules. After validating declarations it replaces that watcher with
one containing every declared stylesheet, even if no view renders its
component, before the child starts or readiness is reported. After a successful
configuration reload, it refreshes that set from the new declarations without
waiting for a later full build. Serve
watches each declared file like a configured stylesheet:
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
- [Ownership and comparison](./mokly-component-stylesheet-ownership.md)
  defines final-document ownership and comparison provenance.
- [Watch](./mokly-watch.md), [export](./mokly-export.md), and
  [publication](./mokly-publication.md) define delivery boundaries.
