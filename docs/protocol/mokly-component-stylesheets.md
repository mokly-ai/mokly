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
The comparison provenance, post-transform owner pruning, and graceful handling
of duplicate declarations, configured links, overlaps and renderer owner
records below are planned by the same plan's Milestone 13; their warnings are
planned by Milestone 14. Those changes are not implemented yet.

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

## Provenance And Comparison Material

Mokly must distinguish only the links it inserts from renderer-authored links,
including renderer links reused for ownership. Give each inserted link a
unique transient `data-mokly-component-stylesheet` token before the optional
compatibility transform. The attribute is reserved: a renderer-authored
occurrence fails `build-invalid` because provenance would be ambiguous. The
token is the zero-based decimal ordinal of an inserted link in that document.
A transformer retaining an inserted link retains its token; removing or
replacing the link may remove the token. An unmarked replacement, including
the same href with its token stripped, is authored page content. Each token
may survive exactly once, on a stylesheet link to its original real file;
duplicates or reassignment fail `build-invalid`. After transformation, scan
the final document, resolve marked links to declared real files, remove
the transient attribute, and store their full-link UTF-16 spans, public paths
and rendered declaring component ids in the private v6 view's
`insertedStylesheets` record. Final
HTML has no token or wrapper, so the rendered page is unchanged. Offsets refer
to final HTML including its generated header. Validate spans against those
bytes and rebase range/style offsets through attribute removal. Remove the
attribute and its leading space without reserializing the link. A removed
link produces no span. Old v6 baselines without this optional record
conservatively retain all links as page content; never guess provenance. The
first comparison to such a baseline may show a link-only migration change.

For page comparison material, remove recorded full-link spans from both
documents **before** component projection and paired or single Review-ignore
normalization. Rebase a comparison-only copy of range/style offsets through
that removal; never change the stored final-document offsets. Do this on the
complete path and before the unchanged-view fast decision's equality checks.
On a component page, retain a recorded link when its owners include that
page's root component id, even if a child also owns it; remove child-only
inserted links. A screen has no root exception. Renderer-
authored and compatibility-authored links stay page content, even when their
files have derived ownership. Public output and snapshots keep the final
documents. Resource discovery and CSS rule matching use those final documents
with their normal Review-ignore policy, **without** stripping inserted links.
Thus provenance affects page material only, not file-content evidence or owners.

## Derived Ownership And Conflicts

For every real file linked through a declaration, Mokly adds exactly one record
to the current view's `ComponentViewRecord.resources`:

```ts
interface ComponentResourceOwnership {
  path: string; // mockupsDir-relative public CSS file
  componentIds: readonly string[]; // nonempty, sorted, unique ids
}
```

Owners are exactly the rendered component ids declaring that real file (including
the component root when applicable). Merge declarations from repeated
instances/owners and realpath aliases of one file. When a configured link to
that file remains in the final document, its decoded public path is the record
path; otherwise use the first matching final link's decoded public path. Sort
records by that path and ids by the manifest's lexical order; retain the
separate link position.
Never infer ownership from selectors, a configured link alone, or an import.
Imported files remain unowned even when reached through a declared stylesheet.

Renderer-supplied `styles` offsets and `resources` records still own other
material. Ignore a renderer `resources` record for any declared real file on
every page, even without a rendered declarer, and issue the
[owner-record warning](./mokly-build-warnings.md#exact-messages). Do not
validate its asserted component owners or merge it; it cannot grant
ownership. Resolve the record's confined public path to establish real-file
identity first; malformed or unsafe paths still fail normal validation.
Validate other resource records against existing public-root and conflicting-owner
rules. After compatibility transformation, rescan final stylesheet links
recognized by normal resource discovery, by real file. Keep one derived owner
record only for a declared file still directly linked in the final page;
remove it if all its links disappeared. If an inserted link was
removed but another final authored link to the same file remains, keep the
owners and use that link's decoded public path. Derived records are private to
manifest v6, not a public catalogue field.

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
- [Watch](./mokly-watch.md), [export](./mokly-export.md), and
  [publication](./mokly-publication.md) define delivery boundaries.
