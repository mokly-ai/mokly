# Mokly Public Authoring Contract

This implemented contract expands the [package API](./mokly-package.md).
Configuration follows the [configuration contract](./mokly-configuration.md);
consumer rendering follows the [rendering contract](./mokly-rendering.md).

## Public Authoring API

The root package export supplies typed, documented authoring helpers:

- `defineConfig`;
- `defineScreen`, `definePage`, `defineCollection`, and `defineUseCase`;
- `defineRoot`, `collection`, `screen`, and `page` for nested trees;
- `defineComponent` and its schema-derived props, variants, and control types;
- `mockLink` and `MockLink` for id-addressed links;
- `ReviewIgnore`, `ReviewIgnoreScope`, and `reviewMaterialKey`.

The root also exports the authoring input/definition types, including
`PageInput`, `PageDefinition`, and `NestedPageInput`, plus configuration,
renderer, and compatibility-transformer interfaces. `ColorScheme` is exactly
`"dark" | "light"`; `Viewport` is `"desktop" | "mobile"`.

The [registered component contract](./mokly-components.md) owns the complete
`defineComponent` shape, slots, repeated-instance identity, dependencies, saved
variants, and runtime prop schema. It returns a renderable `Component` facade
and a registry `entry`; collections can reference that entry like a screen.
Component pages and controls use the existing consumer renderer and providers.

A screen owns one mobile React node and one desktop React node. A collection is
structural and owns child ids but no route. A use case owns ordered references
to existing screens and never defines a screen inline. A page owns one
complete HTML document from a synchronous render callback, with no device or
color variants. The [page contract](./mokly-pages.md) defines both explicit
and nested authoring forms. Ids are explicit,
globally unique kebab-case values and remain stable across navigation changes.

Each entry provides a title, description, related docs, and dependency paths.
A dependency may identify an existing repository file or directory; Review
matches the path itself and every descendant and reports the concrete changed
path as impact evidence. Dependency declarations and source paths alone do not
add entries to Browse Changes: that filter compares output, rendered resources,
reviewable metadata, and collection ancestry, then propagates affected screens
to their flows. See [the Changes contract](./mokly-changes.md).
Screens, pages, and use cases provide a stable relative `.html` route; use cases live
under `user-flows/`. Screens may
provide an address-bar label and use-case membership. Nested definitions
inherit declared metadata, but ids never derive from tree position.

Collection `childIds` are the only structured navigation hierarchy. Each child
may have at most one collection parent. A collection cannot repeat one child,
reference itself, participate in a longer collection cycle, or reference an
unknown id. Entries that no collection claims are catalogue roots. Breadcrumbs
are the root-to-parent sequence of ancestor collection titles; authors never
provide a separate breadcrumb or navigation-label path.

The common and nested-root input boundary is:

```ts
interface EntryInput {
  dependencies: readonly string[];
  description: string;
  id: string;
  rationale?: string;
  relatedDocs: readonly string[];
  title: string;
}

interface CollectionInput extends EntryInput {
  childIds: readonly string[];
}

interface RootCollectionInput {
  address?: string;
  dependencies?: readonly string[];
  description: string;
  id: string;
  rationale?: string;
  relatedDocs?: readonly string[];
  title: string;
}

interface RootInput {
  children: readonly NestedChild[];
  collection?: RootCollectionInput;
  path: string;
}
```

`defineRoot` always flattens nested children into ordinary definitions and
preserves their real `childIds` relationships. With `collection` metadata it
also emits that titled collection as the parent of every direct child. Without
`collection`, its direct children remain catalogue roots. A migration that
previously used a synthetic path label must add a real parent collection if
that visible group and breadcrumb should remain; genuinely top-level entries
stay unclaimed.

`defineScreen` and nested `screen` inputs may declare `colorSchemes`. When
omitted, a screen inherits the catalogue set; `colorSchemes: ["light"]` is the
supported opt-out from a dark-enabled catalogue. A declaration must be
non-empty, duplicate-free, include `"light"`, and be a subset of the config.
Nested trees do not inherit this field from their collections or root.

`defineScreen`, `definePage`, `defineUseCase`, and nested `screen` and `page`
inputs may also declare
`tags`, a classification list whose values use the same lowercase kebab-case
grammar as ids. A list must not repeat a tag, and authored order is preserved
rather than sorted. Collections are structural and reject the field, and nested
trees never inherit it from a collection or root. A collection is rejected for
carrying the key at all, so `tags: undefined` is as much a violation as
`tags: ["forms"]`. Tags are optional catalogue vocabulary, not a second
hierarchy: an untagged catalogue stays valid.

Imports of `@mokly/mokly` from modules beneath `entriesDir` bind the authoring
helpers to that importing module. Definitions created at module evaluation or
later through a shared helper factory therefore retain the helper module's
repo-relative source path without process-global attribution state.

Every catalogue-route segment starts with an ASCII letter or digit and then
uses only URL-unreserved ASCII letters, digits, `.`, `_`, `~`, or `-`. A
segment's filename stem must not be a Windows device name, and the complete
route must end in `.html`. Mokly percent-encodes each path segment whenever
it emits a URL in HTML or an HTTP redirect, including configured static asset
paths whose filenames contain other characters.

Logical screen and use-case routes are catalogue identifiers, not generated
documents. Fragment links must target a generated fragment or public static
asset with a relative URL; root-absolute links are rejected as non-portable.
Authors use `mockLink(id, fragment?)` or
`<MockLink to={id} fragment={fragment}>` for id-addressed catalogue navigation.
Complete raw `mock:<id>[#fragment]` values may also appear in `href` or
`data-nav-href`. The fragment is a bare HTML id without `#` or percent-encoding.
Both helpers immediately apply the registry's lowercase kebab-case id grammar
and reject fragment, percent-encoded, or `mock:` syntax in the id/`to` value;
only the separate fragment input or complete raw logical attribute form may
carry a fragment. The shared runtime predicates reject non-string values before
regular-expression evaluation, so untyped JavaScript callers cannot rely on
implicit coercion for either field. Generated documents retain a portable
relative target plus stable marker metadata on native HTML/SVG links so Browse
can open the canonical catalogue page without changing standalone or Review
behavior.
Metadata-only references use `data-nav-href`, and resource elements must keep
real resource URLs. A document with an activatable logical `href` must not
contain `<base href>`; the builder rejects that combination before and after
compatibility transformation while continuing to support `<base target>`. The
complete behavior is defined by the
[catalogue navigation contract](./mokly-navigation.md).
`MockLink asChild` explicitly adapts one consumer-styled control into that
native-link contract during static generation. Child attributes stay on the
child, inactive controls remain metadata-only, and ambiguous markup fails the
build. The complete API and rendering rules are in
[Styled catalogue link controls](./mokly-link-controls.md).
Local resource URLs in HTML source attributes, `srcset`, inline/style-block
CSS, and transitively referenced HTML/CSS must likewise resolve to public
static files beneath `mockupsDir` that remain after the pending build. An owned
generated file absent from the next output set is a pending orphan, never a
valid link or resource target merely because it still exists before commit.

All public exports ship ESM JavaScript and declarations usable by NodeNext and
bundler TypeScript resolution. The package export map and packed-tarball tests
define the public boundary; consumers must not import `dist` internals.
