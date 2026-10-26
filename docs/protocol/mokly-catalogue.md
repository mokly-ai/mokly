# Public Catalogue Read Model

## Supported Formats

The [format inventory](./mokly-format-versions.md) gives the version of each
catalogue boundary. The catalogue model has no version, because it lives in
memory and nothing writes it. Both catalogue kinds, with and without
registered components, use the same versions, with globally unique entry
paths. The catalogue renders from sources. Usage derives from the composed
trees. The private catalogue change snapshot pairs the review result with the
base commit. The [shell delivery contract](./mokly-shell-delivery.md)
delivers the read model as the catalogue index v7, which carries no per-view
usage or resource evidence, plus one entry detail per entry. Accepted move
pairs carry `previousPath` in review records and in the read model.

## Location And Types

Serve answers GET and HEAD `/mokly-viewer/index.json` and
`/mokly-viewer/entries/<entry path>.json` with
`application/json; charset=utf-8`, and `build` writes the same paths under
its output directory; the
[shell delivery contract](./mokly-shell-delivery.md#routes) owns the routes.
Component value types follow the
[component records](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts; the prop schema follows the
[entry props contract](./mokly-entry-props.md). The generated
[`CatalogueReadModel`](../../packages/viewer/src/generated/catalogue/CatalogueReadModel.ts)
type and the generated types that it imports define the shape of the read
model. The viewer exports these types and the component value types without a
CLI dependency. A screen's or a component's `props` hold the entry's own
props, or a variant's merged props.

No entry record carries a derived route or file name. Resource evidence names
only rendered-resource paths. A reader uses the
[artifact path contract](./mokly-artifact-paths.md): a current view is served
at `static/mokly-generated/<view route>`, a current page or document at
`static/mokly-generated/<document route>`, and the shell at `/view/<path>/`. Removed entries
have no current files; their historical documents come only from their
`preview` descriptor. `comparisonUrl` is a `PublicPath`: an
artifact-root-relative POSIX file path, without a leading slash, origin, query
or hash. A reader resolves it against the source's origin root, not the JSON
directory or host app URL. A current component parent
has its own views, rendered from its own props, and its page shows them first. `previousPath` is
present exactly on entries the
[move contract](./mokly-moves.md) paired with an entry of the base commit.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`mokly-catalogue-v1` is the permanent identity-hash namespace, not the read
model `schemaVersion`; changing it would change published catalogue ids.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Tree

The [catalogue tree contract](./mokly-catalogue-tree.md) defines `tree`, its
folder and entry nodes, hidden folders, and how `order` and `treeOrder` order
the children each section shows.

## Projection And Privacy

The [projection contract](./mokly-catalogue-delivery.md#projection-and-privacy)
owns the allowlist, evidence, source metadata and removed-entry rules.

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[shell delivery contract](./mokly-shell-delivery.md#fetch-and-fences).
